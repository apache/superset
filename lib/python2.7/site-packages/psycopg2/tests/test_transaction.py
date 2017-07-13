#!/usr/bin/env python

# test_transaction - unit test on transaction behaviour
#
# Copyright (C) 2007-2011 Federico Di Gregorio  <fog@debian.org>
#
# psycopg2 is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# In addition, as a special exception, the copyright holders give
# permission to link this program with the OpenSSL library (or with
# modified versions of OpenSSL that use the same license as OpenSSL),
# and distribute linked combinations including the two.
#
# You must obey the GNU Lesser General Public License in all respects for
# all of the code used other than OpenSSL.
#
# psycopg2 is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public
# License for more details.

import threading
from testutils import unittest, ConnectingTestCase, skip_before_postgres, slow

import psycopg2
from psycopg2.extensions import (
    ISOLATION_LEVEL_SERIALIZABLE, STATUS_BEGIN, STATUS_READY)


class TransactionTests(ConnectingTestCase):

    def setUp(self):
        ConnectingTestCase.setUp(self)
        self.conn.set_isolation_level(ISOLATION_LEVEL_SERIALIZABLE)
        curs = self.conn.cursor()
        curs.execute('''
            CREATE TEMPORARY TABLE table1 (
              id int PRIMARY KEY
            )''')
        # The constraint is set to deferrable for the commit_failed test
        curs.execute('''
            CREATE TEMPORARY TABLE table2 (
              id int PRIMARY KEY,
              table1_id int,
              CONSTRAINT table2__table1_id__fk
                FOREIGN KEY (table1_id) REFERENCES table1(id) DEFERRABLE)''')
        curs.execute('INSERT INTO table1 VALUES (1)')
        curs.execute('INSERT INTO table2 VALUES (1, 1)')
        self.conn.commit()

    def test_rollback(self):
        # Test that rollback undoes changes
        curs = self.conn.cursor()
        curs.execute('INSERT INTO table2 VALUES (2, 1)')
        # Rollback takes us from BEGIN state to READY state
        self.assertEqual(self.conn.status, STATUS_BEGIN)
        self.conn.rollback()
        self.assertEqual(self.conn.status, STATUS_READY)
        curs.execute('SELECT id, table1_id FROM table2 WHERE id = 2')
        self.assertEqual(curs.fetchall(), [])

    def test_commit(self):
        # Test that commit stores changes
        curs = self.conn.cursor()
        curs.execute('INSERT INTO table2 VALUES (2, 1)')
        # Rollback takes us from BEGIN state to READY state
        self.assertEqual(self.conn.status, STATUS_BEGIN)
        self.conn.commit()
        self.assertEqual(self.conn.status, STATUS_READY)
        # Now rollback and show that the new record is still there:
        self.conn.rollback()
        curs.execute('SELECT id, table1_id FROM table2 WHERE id = 2')
        self.assertEqual(curs.fetchall(), [(2, 1)])

    def test_failed_commit(self):
        # Test that we can recover from a failed commit.
        # We use a deferred constraint to cause a failure on commit.
        curs = self.conn.cursor()
        curs.execute('SET CONSTRAINTS table2__table1_id__fk DEFERRED')
        curs.execute('INSERT INTO table2 VALUES (2, 42)')
        # The commit should fail, and move the cursor back to READY state
        self.assertEqual(self.conn.status, STATUS_BEGIN)
        self.assertRaises(psycopg2.IntegrityError, self.conn.commit)
        self.assertEqual(self.conn.status, STATUS_READY)
        # The connection should be ready to use for the next transaction:
        curs.execute('SELECT 1')
        self.assertEqual(curs.fetchone()[0], 1)


class DeadlockSerializationTests(ConnectingTestCase):
    """Test deadlock and serialization failure errors."""

    def connect(self):
        conn = ConnectingTestCase.connect(self)
        conn.set_isolation_level(ISOLATION_LEVEL_SERIALIZABLE)
        return conn

    def setUp(self):
        ConnectingTestCase.setUp(self)

        curs = self.conn.cursor()
        # Drop table if it already exists
        try:
            curs.execute("DROP TABLE table1")
            self.conn.commit()
        except psycopg2.DatabaseError:
            self.conn.rollback()
        try:
            curs.execute("DROP TABLE table2")
            self.conn.commit()
        except psycopg2.DatabaseError:
            self.conn.rollback()
        # Create sample data
        curs.execute("""
            CREATE TABLE table1 (
                id int PRIMARY KEY,
                name text)
        """)
        curs.execute("INSERT INTO table1 VALUES (1, 'hello')")
        curs.execute("CREATE TABLE table2 (id int PRIMARY KEY)")
        self.conn.commit()

    def tearDown(self):
        curs = self.conn.cursor()
        curs.execute("DROP TABLE table1")
        curs.execute("DROP TABLE table2")
        self.conn.commit()

        ConnectingTestCase.tearDown(self)

    @slow
    def test_deadlock(self):
        self.thread1_error = self.thread2_error = None
        step1 = threading.Event()
        step2 = threading.Event()

        def task1():
            try:
                conn = self.connect()
                curs = conn.cursor()
                curs.execute("LOCK table1 IN ACCESS EXCLUSIVE MODE")
                step1.set()
                step2.wait()
                curs.execute("LOCK table2 IN ACCESS EXCLUSIVE MODE")
            except psycopg2.DatabaseError, exc:
                self.thread1_error = exc
                step1.set()
            conn.close()

        def task2():
            try:
                conn = self.connect()
                curs = conn.cursor()
                step1.wait()
                curs.execute("LOCK table2 IN ACCESS EXCLUSIVE MODE")
                step2.set()
                curs.execute("LOCK table1 IN ACCESS EXCLUSIVE MODE")
            except psycopg2.DatabaseError, exc:
                self.thread2_error = exc
                step2.set()
            conn.close()

        # Run the threads in parallel.  The "step1" and "step2" events
        # ensure that the two transactions overlap.
        thread1 = threading.Thread(target=task1)
        thread2 = threading.Thread(target=task2)
        thread1.start()
        thread2.start()
        thread1.join()
        thread2.join()

        # Exactly one of the threads should have failed with
        # TransactionRollbackError:
        self.assertFalse(self.thread1_error and self.thread2_error)
        error = self.thread1_error or self.thread2_error
        self.assertTrue(isinstance(
            error, psycopg2.extensions.TransactionRollbackError))

    @slow
    def test_serialisation_failure(self):
        self.thread1_error = self.thread2_error = None
        step1 = threading.Event()
        step2 = threading.Event()

        def task1():
            try:
                conn = self.connect()
                curs = conn.cursor()
                curs.execute("SELECT name FROM table1 WHERE id = 1")
                curs.fetchall()
                step1.set()
                step2.wait()
                curs.execute("UPDATE table1 SET name='task1' WHERE id = 1")
                conn.commit()
            except psycopg2.DatabaseError, exc:
                self.thread1_error = exc
                step1.set()
            conn.close()

        def task2():
            try:
                conn = self.connect()
                curs = conn.cursor()
                step1.wait()
                curs.execute("UPDATE table1 SET name='task2' WHERE id = 1")
                conn.commit()
            except psycopg2.DatabaseError, exc:
                self.thread2_error = exc
            step2.set()
            conn.close()

        # Run the threads in parallel.  The "step1" and "step2" events
        # ensure that the two transactions overlap.
        thread1 = threading.Thread(target=task1)
        thread2 = threading.Thread(target=task2)
        thread1.start()
        thread2.start()
        thread1.join()
        thread2.join()

        # Exactly one of the threads should have failed with
        # TransactionRollbackError:
        self.assertFalse(self.thread1_error and self.thread2_error)
        error = self.thread1_error or self.thread2_error
        self.assertTrue(isinstance(
            error, psycopg2.extensions.TransactionRollbackError))


class QueryCancellationTests(ConnectingTestCase):
    """Tests for query cancellation."""

    def setUp(self):
        ConnectingTestCase.setUp(self)
        self.conn.set_isolation_level(ISOLATION_LEVEL_SERIALIZABLE)

    @skip_before_postgres(8, 2)
    def test_statement_timeout(self):
        curs = self.conn.cursor()
        # Set a low statement timeout, then sleep for a longer period.
        curs.execute('SET statement_timeout TO 10')
        self.assertRaises(psycopg2.extensions.QueryCanceledError,
                          curs.execute, 'SELECT pg_sleep(50)')


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
