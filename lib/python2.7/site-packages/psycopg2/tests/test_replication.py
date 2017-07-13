#!/usr/bin/env python

# test_replication.py - unit test for replication protocol
#
# Copyright (C) 2015 Daniele Varrazzo  <daniele.varrazzo@gmail.com>
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

import psycopg2
from psycopg2.extras import (
    PhysicalReplicationConnection, LogicalReplicationConnection, StopReplication)

import testconfig
from testutils import unittest, ConnectingTestCase
from testutils import skip_before_postgres, skip_if_green

skip_repl_if_green = skip_if_green("replication not supported in green mode")


class ReplicationTestCase(ConnectingTestCase):
    def setUp(self):
        super(ReplicationTestCase, self).setUp()
        self.slot = testconfig.repl_slot
        self._slots = []

    def tearDown(self):
        # first close all connections, as they might keep the slot(s) active
        super(ReplicationTestCase, self).tearDown()

        import time
        time.sleep(0.025)  # sometimes the slot is still active, wait a little

        if self._slots:
            kill_conn = self.connect()
            if kill_conn:
                kill_cur = kill_conn.cursor()
                for slot in self._slots:
                    kill_cur.execute("SELECT pg_drop_replication_slot(%s)", (slot,))
                kill_conn.commit()
                kill_conn.close()

    def create_replication_slot(self, cur, slot_name=testconfig.repl_slot, **kwargs):
        cur.create_replication_slot(slot_name, **kwargs)
        self._slots.append(slot_name)

    def drop_replication_slot(self, cur, slot_name=testconfig.repl_slot):
        cur.drop_replication_slot(slot_name)
        self._slots.remove(slot_name)

    # generate some events for our replication stream
    def make_replication_events(self):
        conn = self.connect()
        if conn is None:
            return
        cur = conn.cursor()

        try:
            cur.execute("DROP TABLE dummy1")
        except psycopg2.ProgrammingError:
            conn.rollback()
        cur.execute(
            "CREATE TABLE dummy1 AS SELECT * FROM generate_series(1, 5) AS id")
        conn.commit()


class ReplicationTest(ReplicationTestCase):
    @skip_before_postgres(9, 0)
    def test_physical_replication_connection(self):
        conn = self.repl_connect(connection_factory=PhysicalReplicationConnection)
        if conn is None:
            return
        cur = conn.cursor()
        cur.execute("IDENTIFY_SYSTEM")
        cur.fetchall()

    @skip_before_postgres(9, 0)
    def test_datestyle(self):
        if testconfig.repl_dsn is None:
            return self.skipTest("replication tests disabled by default")

        conn = self.repl_connect(
            dsn=testconfig.repl_dsn, options='-cdatestyle=german',
            connection_factory=PhysicalReplicationConnection)
        if conn is None:
            return
        cur = conn.cursor()
        cur.execute("IDENTIFY_SYSTEM")
        cur.fetchall()

    @skip_before_postgres(9, 4)
    def test_logical_replication_connection(self):
        conn = self.repl_connect(connection_factory=LogicalReplicationConnection)
        if conn is None:
            return
        cur = conn.cursor()
        cur.execute("IDENTIFY_SYSTEM")
        cur.fetchall()

    @skip_before_postgres(9, 4)     # slots require 9.4
    def test_create_replication_slot(self):
        conn = self.repl_connect(connection_factory=PhysicalReplicationConnection)
        if conn is None:
            return
        cur = conn.cursor()

        self.create_replication_slot(cur)
        self.assertRaises(
            psycopg2.ProgrammingError, self.create_replication_slot, cur)

    @skip_before_postgres(9, 4)  # slots require 9.4
    @skip_repl_if_green
    def test_start_on_missing_replication_slot(self):
        conn = self.repl_connect(connection_factory=PhysicalReplicationConnection)
        if conn is None:
            return
        cur = conn.cursor()

        self.assertRaises(psycopg2.ProgrammingError,
            cur.start_replication, self.slot)

        self.create_replication_slot(cur)
        cur.start_replication(self.slot)

    @skip_before_postgres(9, 4)  # slots require 9.4
    @skip_repl_if_green
    def test_start_and_recover_from_error(self):
        conn = self.repl_connect(connection_factory=LogicalReplicationConnection)
        if conn is None:
            return
        cur = conn.cursor()

        self.create_replication_slot(cur, output_plugin='test_decoding')

        # try with invalid options
        cur.start_replication(
            slot_name=self.slot, options={'invalid_param': 'value'})

        def consume(msg):
            pass
        # we don't see the error from the server before we try to read the data
        self.assertRaises(psycopg2.DataError, cur.consume_stream, consume)

        # try with correct command
        cur.start_replication(slot_name=self.slot)

    @skip_before_postgres(9, 4)     # slots require 9.4
    @skip_repl_if_green
    def test_stop_replication(self):
        conn = self.repl_connect(connection_factory=LogicalReplicationConnection)
        if conn is None:
            return
        cur = conn.cursor()

        self.create_replication_slot(cur, output_plugin='test_decoding')

        self.make_replication_events()

        cur.start_replication(self.slot)

        def consume(msg):
            raise StopReplication()
        self.assertRaises(StopReplication, cur.consume_stream, consume)


class AsyncReplicationTest(ReplicationTestCase):
    @skip_before_postgres(9, 4)     # slots require 9.4
    @skip_repl_if_green
    def test_async_replication(self):
        conn = self.repl_connect(
            connection_factory=LogicalReplicationConnection, async_=1)
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
