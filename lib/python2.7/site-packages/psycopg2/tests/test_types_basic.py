#!/usr/bin/env python
#
# types_basic.py - tests for basic types conversions
#
# Copyright (C) 2004-2010 Federico Di Gregorio  <fog@debian.org>
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

import decimal

import sys
from functools import wraps
import testutils
from testutils import unittest, ConnectingTestCase, decorate_all_tests

import psycopg2


class TypesBasicTests(ConnectingTestCase):
    """Test that all type conversions are working."""

    def execute(self, *args):
        curs = self.conn.cursor()
        curs.execute(*args)
        return curs.fetchone()[0]

    def testQuoting(self):
        s = "Quote'this\\! ''ok?''"
        self.failUnless(self.execute("SELECT %s AS foo", (s,)) == s,
                        "wrong quoting: " + s)

    def testUnicode(self):
        s = u"Quote'this\\! ''ok?''"
        self.failUnless(self.execute("SELECT %s AS foo", (s,)) == s,
                        "wrong unicode quoting: " + s)

    def testNumber(self):
        s = self.execute("SELECT %s AS foo", (1971,))
        self.failUnless(s == 1971, "wrong integer quoting: " + str(s))
        s = self.execute("SELECT %s AS foo", (1971L,))
        self.failUnless(s == 1971L, "wrong integer quoting: " + str(s))

    def testBoolean(self):
        x = self.execute("SELECT %s as foo", (False,))
        self.assert_(x is False)
        x = self.execute("SELECT %s as foo", (True,))
        self.assert_(x is True)

    def testDecimal(self):
        s = self.execute("SELECT %s AS foo", (decimal.Decimal("19.10"),))
        self.failUnless(s - decimal.Decimal("19.10") == 0,
                        "wrong decimal quoting: " + str(s))
        s = self.execute("SELECT %s AS foo", (decimal.Decimal("NaN"),))
        self.failUnless(str(s) == "NaN", "wrong decimal quoting: " + str(s))
        self.failUnless(type(s) == decimal.Decimal,
                        "wrong decimal conversion: " + repr(s))
        s = self.execute("SELECT %s AS foo", (decimal.Decimal("infinity"),))
        self.failUnless(str(s) == "NaN", "wrong decimal quoting: " + str(s))
        self.failUnless(type(s) == decimal.Decimal,
                        "wrong decimal conversion: " + repr(s))
        s = self.execute("SELECT %s AS foo", (decimal.Decimal("-infinity"),))
        self.failUnless(str(s) == "NaN", "wrong decimal quoting: " + str(s))
        self.failUnless(type(s) == decimal.Decimal,
                        "wrong decimal conversion: " + repr(s))

    def testFloatNan(self):
        try:
            float("nan")
        except ValueError:
            return self.skipTest("nan not available on this platform")

        s = self.execute("SELECT %s AS foo", (float("nan"),))
        self.failUnless(str(s) == "nan", "wrong float quoting: " + str(s))
        self.failUnless(type(s) == float, "wrong float conversion: " + repr(s))

    def testFloatInf(self):
        try:
            self.execute("select 'inf'::float")
        except psycopg2.DataError:
            return self.skipTest("inf::float not available on the server")
        except ValueError:
            return self.skipTest("inf not available on this platform")
        s = self.execute("SELECT %s AS foo", (float("inf"),))
        self.failUnless(str(s) == "inf", "wrong float quoting: " + str(s))
        self.failUnless(type(s) == float, "wrong float conversion: " + repr(s))

        s = self.execute("SELECT %s AS foo", (float("-inf"),))
        self.failUnless(str(s) == "-inf", "wrong float quoting: " + str(s))

    def testBinary(self):
        if sys.version_info[0] < 3:
            s = ''.join([chr(x) for x in range(256)])
            b = psycopg2.Binary(s)
            buf = self.execute("SELECT %s::bytea AS foo", (b,))
            self.assertEqual(s, str(buf))
        else:
            s = bytes(range(256))
            b = psycopg2.Binary(s)
            buf = self.execute("SELECT %s::bytea AS foo", (b,))
            self.assertEqual(s, buf.tobytes())

    def testBinaryNone(self):
        b = psycopg2.Binary(None)
        buf = self.execute("SELECT %s::bytea AS foo", (b,))
        self.assertEqual(buf, None)

    def testBinaryEmptyString(self):
        # test to make sure an empty Binary is converted to an empty string
        if sys.version_info[0] < 3:
            b = psycopg2.Binary('')
            self.assertEqual(str(b), "''::bytea")
        else:
            b = psycopg2.Binary(bytes([]))
            self.assertEqual(str(b), "''::bytea")

    def testBinaryRoundTrip(self):
        # test to make sure buffers returned by psycopg2 are
        # understood by execute:
        if sys.version_info[0] < 3:
            s = ''.join([chr(x) for x in range(256)])
            buf = self.execute("SELECT %s::bytea AS foo", (psycopg2.Binary(s),))
            buf2 = self.execute("SELECT %s::bytea AS foo", (buf,))
            self.assertEqual(s, str(buf2))
        else:
            s = bytes(range(256))
            buf = self.execute("SELECT %s::bytea AS foo", (psycopg2.Binary(s),))
            buf2 = self.execute("SELECT %s::bytea AS foo", (buf,))
            self.assertEqual(s, buf2.tobytes())

    def testArray(self):
        s = self.execute("SELECT %s AS foo", ([[1, 2], [3, 4]],))
        self.failUnlessEqual(s, [[1, 2], [3, 4]])
        s = self.execute("SELECT %s AS foo", (['one', 'two', 'three'],))
        self.failUnlessEqual(s, ['one', 'two', 'three'])

    def testEmptyArrayRegression(self):
        # ticket #42
        import datetime
        curs = self.conn.cursor()
        curs.execute(
            "create table array_test "
            "(id integer, col timestamp without time zone[])")

        curs.execute("insert into array_test values (%s, %s)",
            (1, [datetime.date(2011, 2, 14)]))
        curs.execute("select col from array_test where id = 1")
        self.assertEqual(curs.fetchone()[0], [datetime.datetime(2011, 2, 14, 0, 0)])

        curs.execute("insert into array_test values (%s, %s)", (2, []))
        curs.execute("select col from array_test where id = 2")
        self.assertEqual(curs.fetchone()[0], [])

    def testEmptyArrayNoCast(self):
        s = self.execute("SELECT '{}' AS foo")
        self.assertEqual(s, '{}')
        s = self.execute("SELECT %s AS foo", ([],))
        self.assertEqual(s, '{}')

    def testEmptyArray(self):
        s = self.execute("SELECT '{}'::text[] AS foo")
        self.failUnlessEqual(s, [])
        s = self.execute("SELECT 1 != ALL(%s)", ([],))
        self.failUnlessEqual(s, True)
        # but don't break the strings :)
        s = self.execute("SELECT '{}'::text AS foo")
        self.failUnlessEqual(s, "{}")

    def testArrayEscape(self):
        ss = ['', '\\', '"', '\\\\', '\\"']
        for s in ss:
            r = self.execute("SELECT %s AS foo", (s,))
            self.failUnlessEqual(s, r)
            r = self.execute("SELECT %s AS foo", ([s],))
            self.failUnlessEqual([s], r)

        r = self.execute("SELECT %s AS foo", (ss,))
        self.failUnlessEqual(ss, r)

    def testArrayMalformed(self):
        curs = self.conn.cursor()
        ss = ['', '{', '{}}', '{' * 20 + '}' * 20]
        for s in ss:
            self.assertRaises(psycopg2.DataError,
                psycopg2.extensions.STRINGARRAY, s.encode('utf8'), curs)

    @testutils.skip_before_postgres(8, 2)
    def testArrayOfNulls(self):
        curs = self.conn.cursor()
        curs.execute("""
            create table na (
              texta text[],
              inta int[],
              boola boolean[],

              textaa text[][],
              intaa int[][],
              boolaa boolean[][]
            )""")

        curs.execute("insert into na (texta) values (%s)", ([None],))
        curs.execute("insert into na (texta) values (%s)", (['a', None],))
        curs.execute("insert into na (texta) values (%s)", ([None, None],))
        curs.execute("insert into na (inta) values (%s)", ([None],))
        curs.execute("insert into na (inta) values (%s)", ([42, None],))
        curs.execute("insert into na (inta) values (%s)", ([None, None],))
        curs.execute("insert into na (boola) values (%s)", ([None],))
        curs.execute("insert into na (boola) values (%s)", ([True, None],))
        curs.execute("insert into na (boola) values (%s)", ([None, None],))

        # TODO: array of array of nulls are not supported yet
        # curs.execute("insert into na (textaa) values (%s)", ([[None]],))
        curs.execute("insert into na (textaa) values (%s)", ([['a', None]],))
        # curs.execute("insert into na (textaa) values (%s)", ([[None, None]],))
        # curs.execute("insert into na (intaa) values (%s)",  ([[None]],))
        curs.execute("insert into na (intaa) values (%s)", ([[42, None]],))
        # curs.execute("insert into na (intaa) values (%s)",  ([[None, None]],))
        # curs.execute("insert into na (boolaa) values (%s)", ([[None]],))
        curs.execute("insert into na (boolaa) values (%s)", ([[True, None]],))
        # curs.execute("insert into na (boolaa) values (%s)", ([[None, None]],))

    @testutils.skip_from_python(3)
    def testTypeRoundtripBuffer(self):
        o1 = buffer("".join(map(chr, range(256))))
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(type(o1), type(o2))

        # Test with an empty buffer
        o1 = buffer("")
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(type(o1), type(o2))
        self.assertEqual(str(o1), str(o2))

    @testutils.skip_from_python(3)
    def testTypeRoundtripBufferArray(self):
        o1 = buffer("".join(map(chr, range(256))))
        o1 = [o1]
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(type(o1[0]), type(o2[0]))
        self.assertEqual(str(o1[0]), str(o2[0]))

    @testutils.skip_before_python(3)
    def testTypeRoundtripBytes(self):
        o1 = bytes(range(256))
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(memoryview, type(o2))

        # Test with an empty buffer
        o1 = bytes([])
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(memoryview, type(o2))

    @testutils.skip_before_python(3)
    def testTypeRoundtripBytesArray(self):
        o1 = bytes(range(256))
        o1 = [o1]
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(memoryview, type(o2[0]))

    @testutils.skip_before_python(2, 6)
    def testAdaptBytearray(self):
        o1 = bytearray(range(256))
        o2 = self.execute("select %s;", (o1,))

        if sys.version_info[0] < 3:
            self.assertEqual(buffer, type(o2))
        else:
            self.assertEqual(memoryview, type(o2))

        self.assertEqual(len(o1), len(o2))
        for c1, c2 in zip(o1, o2):
            self.assertEqual(c1, ord(c2))

        # Test with an empty buffer
        o1 = bytearray([])
        o2 = self.execute("select %s;", (o1,))

        self.assertEqual(len(o2), 0)
        if sys.version_info[0] < 3:
            self.assertEqual(buffer, type(o2))
        else:
            self.assertEqual(memoryview, type(o2))

    @testutils.skip_before_python(2, 7)
    def testAdaptMemoryview(self):
        o1 = memoryview(bytearray(range(256)))
        o2 = self.execute("select %s;", (o1,))
        if sys.version_info[0] < 3:
            self.assertEqual(buffer, type(o2))
        else:
            self.assertEqual(memoryview, type(o2))

        # Test with an empty buffer
        o1 = memoryview(bytearray([]))
        o2 = self.execute("select %s;", (o1,))
        if sys.version_info[0] < 3:
            self.assertEqual(buffer, type(o2))
        else:
            self.assertEqual(memoryview, type(o2))

    def testByteaHexCheckFalsePositive(self):
        # the check \x -> x to detect bad bytea decode
        # may be fooled if the first char is really an 'x'
        o1 = psycopg2.Binary(b'x')
        o2 = self.execute("SELECT %s::bytea AS foo", (o1,))
        self.assertEqual(b'x', o2[0])

    def testNegNumber(self):
        d1 = self.execute("select -%s;", (decimal.Decimal('-1.0'),))
        self.assertEqual(1, d1)
        f1 = self.execute("select -%s;", (-1.0,))
        self.assertEqual(1, f1)
        i1 = self.execute("select -%s;", (-1,))
        self.assertEqual(1, i1)
        l1 = self.execute("select -%s;", (-1L,))
        self.assertEqual(1, l1)

    def testGenericArray(self):
        a = self.execute("select '{1, 2, 3}'::int4[]")
        self.assertEqual(a, [1, 2, 3])
        a = self.execute("select array['a', 'b', '''']::text[]")
        self.assertEqual(a, ['a', 'b', "'"])

    @testutils.skip_before_postgres(8, 2)
    def testGenericArrayNull(self):
        def caster(s, cur):
            if s is None:
                return "nada"
            return int(s) * 2
        base = psycopg2.extensions.new_type((23,), "INT4", caster)
        array = psycopg2.extensions.new_array_type((1007,), "INT4ARRAY", base)

        psycopg2.extensions.register_type(array, self.conn)
        a = self.execute("select '{1, 2, 3}'::int4[]")
        self.assertEqual(a, [2, 4, 6])
        a = self.execute("select '{1, 2, NULL}'::int4[]")
        self.assertEqual(a, [2, 4, 'nada'])

    @testutils.skip_before_postgres(8, 2)
    def testNetworkArray(self):
        # we don't know these types, but we know their arrays
        a = self.execute("select '{192.168.0.1/24}'::inet[]")
        self.assertEqual(a, ['192.168.0.1/24'])
        a = self.execute("select '{192.168.0.0/24}'::cidr[]")
        self.assertEqual(a, ['192.168.0.0/24'])
        a = self.execute("select '{10:20:30:40:50:60}'::macaddr[]")
        self.assertEqual(a, ['10:20:30:40:50:60'])


class AdaptSubclassTest(unittest.TestCase):
    def test_adapt_subtype(self):
        from psycopg2.extensions import adapt

        class Sub(str):
            pass
        s1 = "hel'lo"
        s2 = Sub(s1)
        self.assertEqual(adapt(s1).getquoted(), adapt(s2).getquoted())

    def test_adapt_most_specific(self):
        from psycopg2.extensions import adapt, register_adapter, AsIs

        class A(object):
            pass

        class B(A):
            pass

        class C(B):
            pass

        register_adapter(A, lambda a: AsIs("a"))
        register_adapter(B, lambda b: AsIs("b"))
        try:
            self.assertEqual(b'b', adapt(C()).getquoted())
        finally:
            del psycopg2.extensions.adapters[A, psycopg2.extensions.ISQLQuote]
            del psycopg2.extensions.adapters[B, psycopg2.extensions.ISQLQuote]

    @testutils.skip_from_python(3)
    def test_no_mro_no_joy(self):
        from psycopg2.extensions import adapt, register_adapter, AsIs

        class A:
            pass

        class B(A):
            pass

        register_adapter(A, lambda a: AsIs("a"))
        try:
            self.assertRaises(psycopg2.ProgrammingError, adapt, B())
        finally:
            del psycopg2.extensions.adapters[A, psycopg2.extensions.ISQLQuote]

    @testutils.skip_before_python(3)
    def test_adapt_subtype_3(self):
        from psycopg2.extensions import adapt, register_adapter, AsIs

        class A:
            pass

        class B(A):
            pass

        register_adapter(A, lambda a: AsIs("a"))
        try:
            self.assertEqual(b"a", adapt(B()).getquoted())
        finally:
            del psycopg2.extensions.adapters[A, psycopg2.extensions.ISQLQuote]

    def test_conform_subclass_precedence(self):

        import psycopg2.extensions as ext

        class foo(tuple):
            def __conform__(self, proto):
                return self

            def getquoted(self):
                return 'bar'

        self.assertEqual(ext.adapt(foo((1, 2, 3))).getquoted(), 'bar')


class ByteaParserTest(unittest.TestCase):
    """Unit test for our bytea format parser."""
    def setUp(self):
        try:
            self._cast = self._import_cast()
        except Exception, e:
            self._cast = None
            self._exc = e

    def _import_cast(self):
        """Use ctypes to access the C function.

        Raise any sort of error: we just support this where ctypes works as
        expected.
        """
        import ctypes
        lib = ctypes.pydll.LoadLibrary(psycopg2._psycopg.__file__)
        cast = lib.typecast_BINARY_cast
        cast.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.py_object]
        cast.restype = ctypes.py_object
        return cast

    def cast(self, buffer):
        """Cast a buffer from the output format"""
        l = buffer and len(buffer) or 0
        rv = self._cast(buffer, l, None)

        if rv is None:
            return None

        if sys.version_info[0] < 3:
            return str(rv)
        else:
            return rv.tobytes()

    def test_null(self):
        rv = self.cast(None)
        self.assertEqual(rv, None)

    def test_blank(self):
        rv = self.cast(b'')
        self.assertEqual(rv, b'')

    def test_blank_hex(self):
        # Reported as problematic in ticket #48
        rv = self.cast(b'\\x')
        self.assertEqual(rv, b'')

    def test_full_hex(self, upper=False):
        buf = ''.join(("%02x" % i) for i in range(256))
        if upper:
            buf = buf.upper()
        buf = '\\x' + buf
        rv = self.cast(buf.encode('utf8'))
        if sys.version_info[0] < 3:
            self.assertEqual(rv, ''.join(map(chr, range(256))))
        else:
            self.assertEqual(rv, bytes(range(256)))

    def test_full_hex_upper(self):
        return self.test_full_hex(upper=True)

    def test_full_escaped_octal(self):
        buf = ''.join(("\\%03o" % i) for i in range(256))
        rv = self.cast(buf.encode('utf8'))
        if sys.version_info[0] < 3:
            self.assertEqual(rv, ''.join(map(chr, range(256))))
        else:
            self.assertEqual(rv, bytes(range(256)))

    def test_escaped_mixed(self):
        import string
        buf = ''.join(("\\%03o" % i) for i in range(32))
        buf += string.ascii_letters
        buf += ''.join('\\' + c for c in string.ascii_letters)
        buf += '\\\\'
        rv = self.cast(buf.encode('utf8'))
        if sys.version_info[0] < 3:
            tgt = ''.join(map(chr, range(32))) \
                + string.ascii_letters * 2 + '\\'
        else:
            tgt = bytes(range(32)) + \
                (string.ascii_letters * 2 + '\\').encode('ascii')

        self.assertEqual(rv, tgt)


def skip_if_cant_cast(f):
    @wraps(f)
    def skip_if_cant_cast_(self, *args, **kwargs):
        if self._cast is None:
            return self.skipTest("can't test bytea parser: %s - %s"
                % (self._exc.__class__.__name__, self._exc))

        return f(self, *args, **kwargs)

    return skip_if_cant_cast_

decorate_all_tests(ByteaParserTest, skip_if_cant_cast)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
