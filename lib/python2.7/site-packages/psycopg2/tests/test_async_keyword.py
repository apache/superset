#!/usr/bin/env python
# -*- coding: utf-8 -*-

# test_async_keyword.py - test for objects using 'async' as attribute/param
#
# Copyright (C) 2017 Daniele Varrazzo  <daniele.varrazzo@gmail.com>
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

import psycopg2
from psycopg2 import extras

from testconfig import dsn
from testutils import ConnectingTestCase, unittest, skip_before_postgres, slow

from test_replication import ReplicationTestCase, skip_repl_if_green
from psycopg2.extras import LogicalReplicationConnection, StopReplication


class AsyncTests(ConnectingTestCase):
    def setUp(self):
        ConnectingTestCase.setUp(self)

        self.sync_conn = self.conn
        self.conn = self.connect(async=True)

        self.wait(self.conn)

        curs = self.conn.cursor()
        curs.execute('''
            CREATE TEMPORARY TABLE table1 (
              id int PRIMARY KEY
            )''')
        self.wait(curs)

    def test_connection_setup(self):
        cur = self.conn.cursor()
        sync_cur = self.sync_conn.cursor()
        del cur, sync_cur

        self.assert_(self.conn.async)
        self.assert_(not self.sync_conn.async)

        # the async connection should be autocommit
        self.assert_(self.conn.autocommit)

        # check other properties to be found on the connection
        self.assert_(self.conn.server_version)
        self.assert_(self.conn.protocol_version in (2, 3))
        self.assert_(self.conn.encoding in psycopg2.extensions.encodings)

    def test_async_subclass(self):
        class MyConn(psycopg2.extensions.connection):
            def __init__(self, dsn, async=0):
                psycopg2.extensions.connection.__init__(self, dsn, async=async)

        conn = self.connect(connection_factory=MyConn, async=True)
        self.assert_(isinstance(conn, MyConn))
        self.assert_(conn.async)
        conn.close()

    def test_async_connection_error_message(self):
        try:
            cnn = psycopg2.connect('dbname=thisdatabasedoesntexist', async=True)
            self.wait(cnn)
        except psycopg2.Error, e:
            self.assertNotEqual(str(e), "asynchronous connection failed",
                "connection error reason lost")
        else:
            self.fail("no exception raised")


class CancelTests(ConnectingTestCase):
    def setUp(self):
        ConnectingTestCase.setUp(self)

        cur = self.conn.cursor()
        cur.execute('''
            CREATE TEMPORARY TABLE table1 (
              id int PRIMARY KEY
            )''')
        self.conn.commit()

    @slow
    @skip_before_postgres(8, 2)
    def test_async_cancel(self):
        async_conn = psycopg2.connect(dsn, async=True)
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
        async_conn = psycopg2.connect(dsn, async=True)
        async_conn.close()
        self.assertTrue(async_conn.closed)


class ConnectTestCase(unittest.TestCase):
    def setUp(self):
        self.args = None

        def connect_stub(dsn, connection_factory=None, async=False):
            self.args = (dsn, connection_factory, async)

        self._connect_orig = psycopg2._connect
        psycopg2._connect = connect_stub

    def tearDown(self):
        psycopg2._connect = self._connect_orig

    def test_there_has_to_be_something(self):
        self.assertRaises(TypeError, psycopg2.connect)
        self.assertRaises(TypeError, psycopg2.connect,
            connection_factory=lambda dsn, async=False: None)
        self.assertRaises(TypeError, psycopg2.connect,
            async=True)

    def test_factory(self):
        def f(dsn, async=False):
            pass

        psycopg2.connect(database='foo', host='baz', connection_factory=f)
        self.assertDsnEqual(self.args[0], 'dbname=foo host=baz')
        self.assertEqual(self.args[1], f)
        self.assertEqual(self.args[2], False)

        psycopg2.connect("dbname=foo host=baz", connection_factory=f)
        self.assertDsnEqual(self.args[0], 'dbname=foo host=baz')
        self.assertEqual(self.args[1], f)
        self.assertEqual(self.args[2], False)

    def test_async(self):
        psycopg2.connect(database='foo', host='baz', async=1)
        self.assertDsnEqual(self.args[0], 'dbname=foo host=baz')
        self.assertEqual(self.args[1], None)
        self.assert_(self.args[2])

        psycopg2.connect("dbname=foo host=baz", async=True)
        self.assertDsnEqual(self.args[0], 'dbname=foo host=baz')
        self.assertEqual(self.args[1], None)
        self.assert_(self.args[2])


class AsyncReplicationTest(ReplicationTestCase):
    @skip_before_postgres(9, 4)     # slots require 9.4
    @skip_repl_if_green
    def test_async_replication(self):
        conn = self.repl_connect(
            connection_factory=LogicalReplicationConnection, async=1)
        if conn is None:
            return

        cur = conn.cursor()

        self.create_replication_slot(cur, output_plugin='test_decoding')
        self.wait(cur)

        cur.start_replication(self.slot)
        self.wait(cur)

        self.make_replication_events()

        self.msg_count = 0

        def consume(msg):
            # just check the methods
            "%s: %s" % (cur.io_timestamp, repr(msg))

            self.msg_count += 1
            if self.msg_count > 3:
                cur.send_feedback(reply=True)
                raise StopReplication()

            cur.send_feedback(flush_lsn=msg.data_start)

        # cannot be used in asynchronous mode
        self.assertRaises(psycopg2.ProgrammingError, cur.consume_stream, consume)

        def process_stream():
            from select import select
            while True:
                msg = cur.read_message()
                if msg:
                    consume(msg)
                else:
                    select([cur], [], [])
        self.assertRaises(StopReplication, process_stream)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
