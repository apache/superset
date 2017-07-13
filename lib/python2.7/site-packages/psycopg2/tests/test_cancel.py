#!/usr/bin/env python
# -*- coding: utf-8 -*-

# test_cancel.py - unit test for query cancellation
#
# Copyright (C) 2010-2011 Jan Urbański  <wulczer@wulczer.org>
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

import time
import threading

import psycopg2
import psycopg2.extensions
from psycopg2 import extras

from testconfig import dsn
from testutils import unittest, ConnectingTestCase, skip_before_postgres, slow


class CancelTests(ConnectingTestCase):

    def setUp(self):
        ConnectingTestCase.setUp(self)

        cur = self.conn.cursor()
        cur.execute('''
            CREATE TEMPORARY TABLE table1 (
              id int PRIMARY KEY
            )''')
        self.conn.commit()

    def test_empty_cancel(self):
        self.conn.cancel()

    @slow
    @skip_before_postgres(8, 2)
    def test_cancel(self):
        errors = []

        def neverending(conn):
            cur = conn.cursor()
            try:
                self.assertRaises(psycopg2.extensions.QueryCanceledError,
                                  cur.execute, "select pg_sleep(60)")
            # make sure the connection still works
                conn.rollback()
                cur.execute("select 1")
                self.assertEqual(cur.fetchall(), [(1, )])
            except Exception, e:
                errors.append(e)
                raise

        def canceller(conn):
            cur = conn.cursor()
            try:
                conn.cancel()
            except Exception, e:
                errors.append(e)
                raise
            del cur

        thread1 = threading.Thread(target=neverending, args=(self.conn, ))
        # wait a bit to make sure that the other thread is already in
        # pg_sleep -- ugly and racy, but the chances are ridiculously low
        thread2 = threading.Timer(0.3, canceller, args=(self.conn, ))
        thread1.start()
        thread2.start()
        thread1.join()
        thread2.join()

        self.assertEqual(errors, [])

    @slow
    @skip_before_postgres(8, 2)
    def test_async_cancel(self):
        async_conn = psycopg2.connect(dsn, async_=True)
        self.assertRaises(psycopg2.OperationalError, async_conn.cancel)
        extras.wait_select(async_conn)
        cur = async_conn.cursor()
        cur.execute("select pg_sleep(10)")
        time.sleep(1)
        self.assertTrue(async_conn.isexecuting())
        async_conn.cancel()
        self.assertRaises(psycopg2.extensions.QueryCanceledError,
                          extras.wait_select, async_conn)
        cur.execute("select 1")
        extras.wait_select(async_conn)
        self.assertEqual(cur.fetchall(), [(1, )])

    def test_async_connection_cancel(self):
        async_conn = psycopg2.connect(dsn, async_=True)
        async_conn.close()
        self.assertTrue(async_conn.closed)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
