#!/usr/bin/env python

# test_lobject.py - unit test for large objects support
#
# Copyright (C) 2008-2011 James Henstridge  <james@jamesh.id.au>
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

import os
import shutil
import tempfile
from functools import wraps

import psycopg2
import psycopg2.extensions
from testutils import (unittest, decorate_all_tests, skip_if_tpc_disabled,
    ConnectingTestCase, skip_if_green, slow)


def skip_if_no_lo(f):
    @wraps(f)
    def skip_if_no_lo_(self):
        if self.conn.server_version < 80100:
            return self.skipTest("large objects only supported from PG 8.1")
        else:
            return f(self)

    return skip_if_no_lo_

skip_lo_if_green = skip_if_green("libpq doesn't support LO in async mode")


class LargeObjectTestCase(ConnectingTestCase):
    def setUp(self):
        ConnectingTestCase.setUp(self)
        self.lo_oid = None
        self.tmpdir = None

    def tearDown(self):
        if self.tmpdir:
            shutil.rmtree(self.tmpdir, ignore_errors=True)

        if self.conn.closed:
            return

        if self.lo_oid is not None:
            self.conn.rollback()
            try:
                lo = self.conn.lobject(self.lo_oid, "n")
            except psycopg2.OperationalError:
                pass
            else:
                lo.unlink()

        ConnectingTestCase.tearDown(self)


class LargeObjectTests(LargeObjectTestCase):
    def test_create(self):
        lo = self.conn.lobject()
        self.assertNotEqual(lo, None)
        self.assertEqual(lo.mode[0], "w")

    def test_connection_needed(self):
        self.assertRaises(TypeError,
            psycopg2.extensions.lobject, [])

    def test_open_non_existent(self):
        # By creating then removing a large object, we get an Oid that
        # should be unused.
        lo = self.conn.lobject()
        lo.unlink()
        self.assertRaises(psycopg2.OperationalError, self.conn.lobject, lo.oid)

    def test_open_existing(self):
        lo = self.conn.lobject()
        lo2 = self.conn.lobject(lo.oid)
        self.assertNotEqual(lo2, None)
        self.assertEqual(lo2.oid, lo.oid)
        self.assertEqual(lo2.mode[0], "r")

    def test_open_for_write(self):
        lo = self.conn.lobject()
        lo2 = self.conn.lobject(lo.oid, "w")
        self.assertEqual(lo2.mode[0], "w")
        lo2.write(b"some data")

    def test_open_mode_n(self):
        # Openning an object in mode "n" gives us a closed lobject.
        lo = self.conn.lobject()
        lo.close()

        lo2 = self.conn.lobject(lo.oid, "n")
        self.assertEqual(lo2.oid, lo.oid)
        self.assertEqual(lo2.closed, True)

    def test_close_connection_gone(self):
        lo = self.conn.lobject()
        self.conn.close()
        lo.close()

    def test_create_with_oid(self):
        # Create and delete a large object to get an unused Oid.
        lo = self.conn.lobject()
        oid = lo.oid
        lo.unlink()

        lo = self.conn.lobject(0, "w", oid)
        self.assertEqual(lo.oid, oid)

    def test_create_with_existing_oid(self):
        lo = self.conn.lobject()
        lo.close()

        self.assertRaises(psycopg2.OperationalError,
                          self.conn.lobject, 0, "w", lo.oid)
        self.assert_(not self.conn.closed)

    def test_import(self):
        self.tmpdir = tempfile.mkdtemp()
        filename = os.path.join(self.tmpdir, "data.txt")
        fp = open(filename, "wb")
        fp.write(b"some data")
        fp.close()

        lo = self.conn.lobject(0, "r", 0, filename)
        self.assertEqual(lo.read(), "some data")

    def test_close(self):
        lo = self.conn.lobject()
        self.assertEqual(lo.closed, False)
        lo.close()
        self.assertEqual(lo.closed, True)

    def test_write(self):
        lo = self.conn.lobject()
        self.assertEqual(lo.write(b"some data"), len("some data"))

    def test_write_large(self):
        lo = self.conn.lobject()
        data = "data" * 1000000
        self.assertEqual(lo.write(data), len(data))

    def test_read(self):
        lo = self.conn.lobject()
        lo.write(b"some data")
        lo.close()

        lo = self.conn.lobject(lo.oid)
        x = lo.read(4)
        self.assertEqual(type(x), type(''))
        self.assertEqual(x, "some")
        self.assertEqual(lo.read(), " data")

    def test_read_binary(self):
        lo = self.conn.lobject()
        lo.write(b"some data")
        lo.close()

        lo = self.conn.lobject(lo.oid, "rb")
        x = lo.read(4)
        self.assertEqual(type(x), type(b''))
        self.assertEqual(x, b"some")
        self.assertEqual(lo.read(), b" data")

    def test_read_text(self):
        lo = self.conn.lobject()
        snowman = u"\u2603"
        lo.write(u"some data " + snowman)
        lo.close()

        lo = self.conn.lobject(lo.oid, "rt")
        x = lo.read(4)
        self.assertEqual(type(x), type(u''))
        self.assertEqual(x, u"some")
        self.assertEqual(lo.read(), u" data " + snowman)

    @slow
    def test_read_large(self):
        lo = self.conn.lobject()
        data = "data" * 1000000
        lo.write("some" + data)
        lo.close()

        lo = self.conn.lobject(lo.oid)
        self.assertEqual(lo.read(4), "some")
        data1 = lo.read()
        # avoid dumping megacraps in the console in case of error
        self.assert_(data == data1,
            "%r... != %r..." % (data[:100], data1[:100]))

    def test_seek_tell(self):
        lo = self.conn.lobject()
        length = lo.write(b"some data")
        self.assertEqual(lo.tell(), length)
        lo.close()
        lo = self.conn.lobject(lo.oid)

        self.assertEqual(lo.seek(5, 0), 5)
        self.assertEqual(lo.tell(), 5)
        self.assertEqual(lo.read(), "data")

        # SEEK_CUR: relative current location
        lo.seek(5)
        self.assertEqual(lo.seek(2, 1), 7)
        self.assertEqual(lo.tell(), 7)
        self.assertEqual(lo.read(), "ta")

        # SEEK_END: relative to end of file
        self.assertEqual(lo.seek(-2, 2), length - 2)
        self.assertEqual(lo.read(), "ta")

    def test_unlink(self):
        lo = self.conn.lobject()
        lo.unlink()

        # the object doesn't exist now, so we can't reopen it.
        self.assertRaises(psycopg2.OperationalError, self.conn.lobject, lo.oid)
        # And the object has been closed.
        self.assertEquals(lo.closed, True)

    def test_export(self):
        lo = self.conn.lobject()
        lo.write(b"some data")

        self.tmpdir = tempfile.mkdtemp()
        filename = os.path.join(self.tmpdir, "data.txt")
        lo.export(filename)
        self.assertTrue(os.path.exists(filename))
        f = open(filename, "rb")
        try:
            self.assertEqual(f.read(), b"some data")
        finally:
            f.close()

    def test_close_twice(self):
        lo = self.conn.lobject()
        lo.close()
        lo.close()

    def test_write_after_close(self):
        lo = self.conn.lobject()
        lo.close()
        self.assertRaises(psycopg2.InterfaceError, lo.write, b"some data")

    def test_read_after_close(self):
        lo = self.conn.lobject()
        lo.close()
        self.assertRaises(psycopg2.InterfaceError, lo.read, 5)

    def test_seek_after_close(self):
        lo = self.conn.lobject()
        lo.close()
        self.assertRaises(psycopg2.InterfaceError, lo.seek, 0)

    def test_tell_after_close(self):
        lo = self.conn.lobject()
        lo.close()
        self.assertRaises(psycopg2.InterfaceError, lo.tell)

    def test_unlink_after_close(self):
        lo = self.conn.lobject()
        lo.close()
        # Unlink works on closed files.
        lo.unlink()

    def test_export_after_close(self):
        lo = self.conn.lobject()
        lo.write(b"some data")
        lo.close()

        self.tmpdir = tempfile.mkdtemp()
        filename = os.path.join(self.tmpdir, "data.txt")
        lo.export(filename)
        self.assertTrue(os.path.exists(filename))
        f = open(filename, "rb")
        try:
            self.assertEqual(f.read(), b"some data")
        finally:
            f.close()

    def test_close_after_commit(self):
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.commit()

        # Closing outside of the transaction is okay.
        lo.close()

    def test_write_after_commit(self):
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.commit()

        self.assertRaises(psycopg2.ProgrammingError, lo.write, b"some data")

    def test_read_after_commit(self):
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.commit()

        self.assertRaises(psycopg2.ProgrammingError, lo.read, 5)

    def test_seek_after_commit(self):
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.commit()

        self.assertRaises(psycopg2.ProgrammingError, lo.seek, 0)

    def test_tell_after_commit(self):
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.commit()

        self.assertRaises(psycopg2.ProgrammingError, lo.tell)

    def test_unlink_after_commit(self):
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.commit()

        # Unlink of stale lobject is okay
        lo.unlink()

    def test_export_after_commit(self):
        lo = self.conn.lobject()
        lo.write(b"some data")
        self.conn.commit()

        self.tmpdir = tempfile.mkdtemp()
        filename = os.path.join(self.tmpdir, "data.txt")
        lo.export(filename)
        self.assertTrue(os.path.exists(filename))
        f = open(filename, "rb")
        try:
            self.assertEqual(f.read(), b"some data")
        finally:
            f.close()

    @skip_if_tpc_disabled
    def test_read_after_tpc_commit(self):
        self.conn.tpc_begin('test_lobject')
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.tpc_commit()

        self.assertRaises(psycopg2.ProgrammingError, lo.read, 5)

    @skip_if_tpc_disabled
    def test_read_after_tpc_prepare(self):
        self.conn.tpc_begin('test_lobject')
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.tpc_prepare()

        try:
            self.assertRaises(psycopg2.ProgrammingError, lo.read, 5)
        finally:
            self.conn.tpc_commit()

    def test_large_oid(self):
        # Test we don't overflow with an oid not fitting a signed int
        try:
            self.conn.lobject(0xFFFFFFFE)
        except psycopg2.OperationalError:
            pass

decorate_all_tests(LargeObjectTests, skip_if_no_lo, skip_lo_if_green)


def skip_if_no_truncate(f):
    @wraps(f)
    def skip_if_no_truncate_(self):
        if self.conn.server_version < 80300:
            return self.skipTest(
                "the server doesn't support large object truncate")

        if not hasattr(psycopg2.extensions.lobject, 'truncate'):
            return self.skipTest(
                "psycopg2 has been built against a libpq "
                "without large object truncate support.")

        return f(self)

    return skip_if_no_truncate_


class LargeObjectTruncateTests(LargeObjectTestCase):
    def test_truncate(self):
        lo = self.conn.lobject()
        lo.write("some data")
        lo.close()

        lo = self.conn.lobject(lo.oid, "w")
        lo.truncate(4)

        # seek position unchanged
        self.assertEqual(lo.tell(), 0)
        # data truncated
        self.assertEqual(lo.read(), "some")

        lo.truncate(6)
        lo.seek(0)
        # large object extended with zeroes
        self.assertEqual(lo.read(), "some\x00\x00")

        lo.truncate()
        lo.seek(0)
        # large object empty
        self.assertEqual(lo.read(), "")

    def test_truncate_after_close(self):
        lo = self.conn.lobject()
        lo.close()
        self.assertRaises(psycopg2.InterfaceError, lo.truncate)

    def test_truncate_after_commit(self):
        lo = self.conn.lobject()
        self.lo_oid = lo.oid
        self.conn.commit()

        self.assertRaises(psycopg2.ProgrammingError, lo.truncate)

decorate_all_tests(LargeObjectTruncateTests,
    skip_if_no_lo, skip_lo_if_green, skip_if_no_truncate)


def _has_lo64(conn):
    """Return (bool, msg) about the lo64 support"""
    if conn.server_version < 90300:
        return (False, "server version %s doesn't support the lo64 API"
                % conn.server_version)

    if 'lo64' not in psycopg2.__version__:
        return (False, "this psycopg build doesn't support the lo64 API")

    return (True, "this server and build support the lo64 API")


def skip_if_no_lo64(f):
    @wraps(f)
    def skip_if_no_lo64_(self):
        lo64, msg = _has_lo64(self.conn)
        if not lo64:
            return self.skipTest(msg)
        else:
            return f(self)

    return skip_if_no_lo64_


class LargeObject64Tests(LargeObjectTestCase):
    def test_seek_tell_truncate_greater_than_2gb(self):
        lo = self.conn.lobject()

        length = (1 << 31) + (1 << 30)  # 2gb + 1gb = 3gb
        lo.truncate(length)

        self.assertEqual(lo.seek(length, 0), length)
        self.assertEqual(lo.tell(), length)

decorate_all_tests(LargeObject64Tests,
    skip_if_no_lo, skip_lo_if_green, skip_if_no_truncate, skip_if_no_lo64)


def skip_if_lo64(f):
    @wraps(f)
    def skip_if_lo64_(self):
        lo64, msg = _has_lo64(self.conn)
        if lo64:
            return self.skipTest(msg)
        else:
            return f(self)

    return skip_if_lo64_


class LargeObjectNot64Tests(LargeObjectTestCase):
    def test_seek_larger_than_2gb(self):
        lo = self.conn.lobject()
        offset = 1 << 32  # 4gb
        self.assertRaises(
            (OverflowError, psycopg2.InterfaceError, psycopg2.NotSupportedError),
            lo.seek, offset, 0)

    def test_truncate_larger_than_2gb(self):
        lo = self.conn.lobject()
        length = 1 << 32  # 4gb
        self.assertRaises(
            (OverflowError, psycopg2.InterfaceError, psycopg2.NotSupportedError),
            lo.truncate, length)

decorate_all_tests(LargeObjectNot64Tests,
    skip_if_no_lo, skip_lo_if_green, skip_if_no_truncate, skip_if_lo64)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
