#!/usr/bin/env python

# test_green.py - unit test for async wait callback
#
# Copyright (C) 2010-2011 Daniele Varrazzo  <daniele.varrazzo@gmail.com>
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

import unittest
import psycopg2
import psycopg2.extensions
import psycopg2.extras

from testutils import ConnectingTestCase, slow


class ConnectionStub(object):
    """A `connection` wrapper allowing analysis of the `poll()` calls."""
    def __init__(self, conn):
        self.conn = conn
        self.polls = []

    def fileno(self):
        return self.conn.fileno()

    def poll(self):
        rv = self.conn.poll()
        self.polls.append(rv)
        return rv


class GreenTestCase(ConnectingTestCase):
    def setUp(self):
        self._cb = psycopg2.extensions.get_wait_callback()
        psycopg2.extensions.set_wait_callback(psycopg2.extras.wait_select)
        ConnectingTestCase.setUp(self)

    def tearDown(self):
        ConnectingTestCase.tearDown(self)
        psycopg2.extensions.set_wait_callback(self._cb)

    def set_stub_wait_callback(self, conn):
        stub = ConnectionStub(conn)
        psycopg2.extensions.set_wait_callback(
            lambda conn: psycopg2.extras.wait_select(stub))
        return stub

    @slow
    def test_flush_on_write(self):
        # a very large query requires a flush loop to be sent to the backend
        conn = self.conn
        stub = self.set_stub_wait_callback(conn)
        curs = conn.cursor()
        for mb in 1, 5, 10, 20, 50:
            size = mb * 1024 * 1024
            del stub.polls[:]
            curs.execute("select %s;", ('x' * size,))
            self.assertEqual(size, len(curs.fetchone()[0]))
            if stub.polls.count(psycopg2.extensions.POLL_WRITE) > 1:
                return

        # This is more a testing glitch than an error: it happens
        # on high load on linux: probably because the kernel has more
        # buffers ready. A warning may be useful during development,
        # but an error is bad during regression testing.
        import warnings
        warnings.warn("sending a large query didn't trigger block on write.")

    def test_error_in_callback(self):
        # behaviour changed after issue #113: if there is an error in the
        # callback for the moment we don't have a way to reset the connection
        # without blocking (ticket #113) so just close it.
        conn = self.conn
        curs = conn.cursor()
        curs.execute("select 1")  # have a BEGIN
        curs.fetchone()

        # now try to do something that will fail in the callback
        psycopg2.extensions.set_wait_callback(lambda conn: 1 // 0)
        self.assertRaises(ZeroDivisionError, curs.execute, "select 2")

        self.assert_(conn.closed)

    def test_dont_freak_out(self):
        # if there is an error in a green query, don't freak out and close
        # the connection
        conn = self.conn
        curs = conn.cursor()
        self.assertRaises(psycopg2.ProgrammingError,
            curs.execute, "select the unselectable")

        # check that the connection is left in an usable state
        self.assert_(not conn.closed)
        conn.rollback()
        curs.execute("select 1")
        self.assertEqual(curs.fetchone()[0], 1)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
