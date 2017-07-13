#!/usr/bin/env python
#
# extras_dictcursor - test if DictCursor extension class works
#
# Copyright (C) 2004-2010 Federico Di Gregorio  <fog@debian.org>
#
# psycopg2 is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# psycopg2 is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public
# License for more details.

import time
from datetime import timedelta
import psycopg2
import psycopg2.extras
from testutils import unittest, ConnectingTestCase, skip_before_postgres
from testutils import skip_if_no_namedtuple


class ExtrasDictCursorTests(ConnectingTestCase):
    """Test if DictCursor extension class works."""

    def setUp(self):
        ConnectingTestCase.setUp(self)
        curs = self.conn.cursor()
        curs.execute("CREATE TEMPORARY TABLE ExtrasDictCursorTests (foo text)")
        curs.execute("INSERT INTO ExtrasDictCursorTests VALUES ('bar')")
        self.conn.commit()

    def testDictConnCursorArgs(self):
        self.conn.close()
        self.conn = self.connect(connection_factory=psycopg2.extras.DictConnection)
        cur = self.conn.cursor()
        self.assert_(isinstance(cur, psycopg2.extras.DictCursor))
        self.assertEqual(cur.name, None)
        # overridable
        cur = self.conn.cursor('foo',
            cursor_factory=psycopg2.extras.NamedTupleCursor)
        self.assertEqual(cur.name, 'foo')
        self.assert_(isinstance(cur, psycopg2.extras.NamedTupleCursor))

    def testDictCursorWithPlainCursorFetchOne(self):
        self._testWithPlainCursor(lambda curs: curs.fetchone())

    def testDictCursorWithPlainCursorFetchMany(self):
        self._testWithPlainCursor(lambda curs: curs.fetchmany(100)[0])

    def testDictCursorWithPlainCursorFetchManyNoarg(self):
        self._testWithPlainCursor(lambda curs: curs.fetchmany()[0])

    def testDictCursorWithPlainCursorFetchAll(self):
        self._testWithPlainCursor(lambda curs: curs.fetchall()[0])

    def testDictCursorWithPlainCursorIter(self):
        def getter(curs):
            for row in curs:
                return row
        self._testWithPlainCursor(getter)

    def testUpdateRow(self):
        row = self._testWithPlainCursor(lambda curs: curs.fetchone())
        row['foo'] = 'qux'
        self.failUnless(row['foo'] == 'qux')
        self.failUnless(row[0] == 'qux')

    @skip_before_postgres(8, 0)
    def testDictCursorWithPlainCursorIterRowNumber(self):
        curs = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        self._testIterRowNumber(curs)

    def _testWithPlainCursor(self, getter):
        curs = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        curs.execute("SELECT * FROM ExtrasDictCursorTests")
        row = getter(curs)
        self.failUnless(row['foo'] == 'bar')
        self.failUnless(row[0] == 'bar')
        return row

    def testDictCursorWithPlainCursorRealFetchOne(self):
        self._testWithPlainCursorReal(lambda curs: curs.fetchone())

    def testDictCursorWithPlainCursorRealFetchMany(self):
        self._testWithPlainCursorReal(lambda curs: curs.fetchmany(100)[0])

    def testDictCursorWithPlainCursorRealFetchManyNoarg(self):
        self._testWithPlainCursorReal(lambda curs: curs.fetchmany()[0])

    def testDictCursorWithPlainCursorRealFetchAll(self):
        self._testWithPlainCursorReal(lambda curs: curs.fetchall()[0])

    def testDictCursorWithPlainCursorRealIter(self):
        def getter(curs):
            for row in curs:
                return row
        self._testWithPlainCursorReal(getter)

    @skip_before_postgres(8, 0)
    def testDictCursorWithPlainCursorRealIterRowNumber(self):
        curs = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        self._testIterRowNumber(curs)

    def _testWithPlainCursorReal(self, getter):
        curs = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        curs.execute("SELECT * FROM ExtrasDictCursorTests")
        row = getter(curs)
        self.failUnless(row['foo'] == 'bar')

    def testDictCursorWithNamedCursorFetchOne(self):
        self._testWithNamedCursor(lambda curs: curs.fetchone())

    def testDictCursorWithNamedCursorFetchMany(self):
        self._testWithNamedCursor(lambda curs: curs.fetchmany(100)[0])

    def testDictCursorWithNamedCursorFetchManyNoarg(self):
        self._testWithNamedCursor(lambda curs: curs.fetchmany()[0])

    def testDictCursorWithNamedCursorFetchAll(self):
        self._testWithNamedCursor(lambda curs: curs.fetchall()[0])

    def testDictCursorWithNamedCursorIter(self):
        def getter(curs):
            for row in curs:
                return row
        self._testWithNamedCursor(getter)

    @skip_before_postgres(8, 2)
    def testDictCursorWithNamedCursorNotGreedy(self):
        curs = self.conn.cursor('tmp', cursor_factory=psycopg2.extras.DictCursor)
        self._testNamedCursorNotGreedy(curs)

    @skip_before_postgres(8, 0)
    def testDictCursorWithNamedCursorIterRowNumber(self):
        curs = self.conn.cursor('tmp', cursor_factory=psycopg2.extras.DictCursor)
        self._testIterRowNumber(curs)

    def _testWithNamedCursor(self, getter):
        curs = self.conn.cursor('aname', cursor_factory=psycopg2.extras.DictCursor)
        curs.execute("SELECT * FROM ExtrasDictCursorTests")
        row = getter(curs)
        self.failUnless(row['foo'] == 'bar')
        self.failUnless(row[0] == 'bar')

    def testDictCursorRealWithNamedCursorFetchOne(self):
        self._testWithNamedCursorReal(lambda curs: curs.fetchone())

    def testDictCursorRealWithNamedCursorFetchMany(self):
        self._testWithNamedCursorReal(lambda curs: curs.fetchmany(100)[0])

    def testDictCursorRealWithNamedCursorFetchManyNoarg(self):
        self._testWithNamedCursorReal(lambda curs: curs.fetchmany()[0])

    def testDictCursorRealWithNamedCursorFetchAll(self):
        self._testWithNamedCursorReal(lambda curs: curs.fetchall()[0])

    def testDictCursorRealWithNamedCursorIter(self):
        def getter(curs):
            for row in curs:
                return row
        self._testWithNamedCursorReal(getter)

    @skip_before_postgres(8, 2)
    def testDictCursorRealWithNamedCursorNotGreedy(self):
        curs = self.conn.cursor('tmp', cursor_factory=psycopg2.extras.RealDictCursor)
        self._testNamedCursorNotGreedy(curs)

    @skip_before_postgres(8, 0)
    def testDictCursorRealWithNamedCursorIterRowNumber(self):
        curs = self.conn.cursor('tmp', cursor_factory=psycopg2.extras.RealDictCursor)
        self._testIterRowNumber(curs)

    def _testWithNamedCursorReal(self, getter):
        curs = self.conn.cursor('aname',
            cursor_factory=psycopg2.extras.RealDictCursor)
        curs.execute("SELECT * FROM ExtrasDictCursorTests")
        row = getter(curs)
        self.failUnless(row['foo'] == 'bar')

    def _testNamedCursorNotGreedy(self, curs):
        curs.itersize = 2
        curs.execute("""select clock_timestamp() as ts from generate_series(1,3)""")
        recs = []
        for t in curs:
            time.sleep(0.01)
            recs.append(t)

        # check that the dataset was not fetched in a single gulp
        self.assert_(recs[1]['ts'] - recs[0]['ts'] < timedelta(seconds=0.005))
        self.assert_(recs[2]['ts'] - recs[1]['ts'] > timedelta(seconds=0.0099))

    def _testIterRowNumber(self, curs):
        # Only checking for dataset < itersize:
        # see CursorTests.test_iter_named_cursor_rownumber
        curs.itersize = 20
        curs.execute("""select * from generate_series(1,10)""")
        for i, r in enumerate(curs):
            self.assertEqual(i + 1, curs.rownumber)

    def testPickleDictRow(self):
        import pickle
        curs = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        curs.execute("select 10 as a, 20 as b")
        r = curs.fetchone()
        d = pickle.dumps(r)
        r1 = pickle.loads(d)
        self.assertEqual(r, r1)
        self.assertEqual(r[0], r1[0])
        self.assertEqual(r[1], r1[1])
        self.assertEqual(r['a'], r1['a'])
        self.assertEqual(r['b'], r1['b'])
        self.assertEqual(r._index, r1._index)

    def testPickleRealDictRow(self):
        import pickle
        curs = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        curs.execute("select 10 as a, 20 as b")
        r = curs.fetchone()
        d = pickle.dumps(r)
        r1 = pickle.loads(d)
        self.assertEqual(r, r1)
        self.assertEqual(r['a'], r1['a'])
        self.assertEqual(r['b'], r1['b'])
        self.assertEqual(r._column_mapping, r1._column_mapping)


class NamedTupleCursorTest(ConnectingTestCase):
    def setUp(self):
        ConnectingTestCase.setUp(self)
        from psycopg2.extras import NamedTupleConnection

        try:
            from collections import namedtuple      # noqa
        except ImportError:
            return

        self.conn = self.connect(connection_factory=NamedTupleConnection)
        curs = self.conn.cursor()
        curs.execute("CREATE TEMPORARY TABLE nttest (i int, s text)")
        curs.execute("INSERT INTO nttest VALUES (1, 'foo')")
        curs.execute("INSERT INTO nttest VALUES (2, 'bar')")
        curs.execute("INSERT INTO nttest VALUES (3, 'baz')")
        self.conn.commit()

    @skip_if_no_namedtuple
    def test_cursor_args(self):
        cur = self.conn.cursor('foo', cursor_factory=psycopg2.extras.DictCursor)
        self.assertEqual(cur.name, 'foo')
        self.assert_(isinstance(cur, psycopg2.extras.DictCursor))

    @skip_if_no_namedtuple
    def test_fetchone(self):
        curs = self.conn.cursor()
        curs.execute("select * from nttest order by 1")
        t = curs.fetchone()
        self.assertEqual(t[0], 1)
        self.assertEqual(t.i, 1)
        self.assertEqual(t[1], 'foo')
        self.assertEqual(t.s, 'foo')
        self.assertEqual(curs.rownumber, 1)
        self.assertEqual(curs.rowcount, 3)

    @skip_if_no_namedtuple
    def test_fetchmany_noarg(self):
        curs = self.conn.cursor()
        curs.arraysize = 2
        curs.execute("select * from nttest order by 1")
        res = curs.fetchmany()
        self.assertEqual(2, len(res))
        self.assertEqual(res[0].i, 1)
        self.assertEqual(res[0].s, 'foo')
        self.assertEqual(res[1].i, 2)
        self.assertEqual(res[1].s, 'bar')
        self.assertEqual(curs.rownumber, 2)
        self.assertEqual(curs.rowcount, 3)

    @skip_if_no_namedtuple
    def test_fetchmany(self):
        curs = self.conn.cursor()
        curs.execute("select * from nttest order by 1")
        res = curs.fetchmany(2)
        self.assertEqual(2, len(res))
        self.assertEqual(res[0].i, 1)
        self.assertEqual(res[0].s, 'foo')
        self.assertEqual(res[1].i, 2)
        self.assertEqual(res[1].s, 'bar')
        self.assertEqual(curs.rownumber, 2)
        self.assertEqual(curs.rowcount, 3)

    @skip_if_no_namedtuple
    def test_fetchall(self):
        curs = self.conn.cursor()
        curs.execute("select * from nttest order by 1")
        res = curs.fetchall()
        self.assertEqual(3, len(res))
        self.assertEqual(res[0].i, 1)
        self.assertEqual(res[0].s, 'foo')
        self.assertEqual(res[1].i, 2)
        self.assertEqual(res[1].s, 'bar')
        self.assertEqual(res[2].i, 3)
        self.assertEqual(res[2].s, 'baz')
        self.assertEqual(curs.rownumber, 3)
        self.assertEqual(curs.rowcount, 3)

    @skip_if_no_namedtuple
    def test_executemany(self):
        curs = self.conn.cursor()
        curs.executemany("delete from nttest where i = %s",
            [(1,), (2,)])
        curs.execute("select * from nttest order by 1")
        res = curs.fetchall()
        self.assertEqual(1, len(res))
        self.assertEqual(res[0].i, 3)
        self.assertEqual(res[0].s, 'baz')

    @skip_if_no_namedtuple
    def test_iter(self):
        curs = self.conn.cursor()
        curs.execute("select * from nttest order by 1")
        i = iter(curs)
        self.assertEqual(curs.rownumber, 0)

        t = i.next()
        self.assertEqual(t.i, 1)
        self.assertEqual(t.s, 'foo')
        self.assertEqual(curs.rownumber, 1)
        self.assertEqual(curs.rowcount, 3)

        t = i.next()
        self.assertEqual(t.i, 2)
        self.assertEqual(t.s, 'bar')
        self.assertEqual(curs.rownumber, 2)
        self.assertEqual(curs.rowcount, 3)

        t = i.next()
        self.assertEqual(t.i, 3)
        self.assertEqual(t.s, 'baz')
        self.assertRaises(StopIteration, i.next)
        self.assertEqual(curs.rownumber, 3)
        self.assertEqual(curs.rowcount, 3)

    def test_error_message(self):
        try:
            from collections import namedtuple          # noqa
        except ImportError:
            # an import error somewhere
            from psycopg2.extras import NamedTupleConnection
            try:
                self.conn = self.connect(
                    connection_factory=NamedTupleConnection)
                curs = self.conn.cursor()
                curs.execute("select 1")
                curs.fetchone()
            except ImportError:
                pass
            else:
                self.fail("expecting ImportError")
        else:
            return self.skipTest("namedtuple available")

    @skip_if_no_namedtuple
    def test_record_updated(self):
        curs = self.conn.cursor()
        curs.execute("select 1 as foo;")
        r = curs.fetchone()
        self.assertEqual(r.foo, 1)

        curs.execute("select 2 as bar;")
        r = curs.fetchone()
        self.assertEqual(r.bar, 2)
        self.assertRaises(AttributeError, getattr, r, 'foo')

    @skip_if_no_namedtuple
    def test_no_result_no_surprise(self):
        curs = self.conn.cursor()
        curs.execute("update nttest set s = s")
        self.assertRaises(psycopg2.ProgrammingError, curs.fetchone)

        curs.execute("update nttest set s = s")
        self.assertRaises(psycopg2.ProgrammingError, curs.fetchall)

    @skip_if_no_namedtuple
    def test_minimal_generation(self):
        # Instrument the class to verify it gets called the minimum number of times.
        from psycopg2.extras import NamedTupleCursor
        f_orig = NamedTupleCursor._make_nt
        calls = [0]

        def f_patched(self_):
            calls[0] += 1
            return f_orig(self_)

        NamedTupleCursor._make_nt = f_patched

        try:
            curs = self.conn.cursor()
            curs.execute("select * from nttest order by 1")
            curs.fetchone()
            curs.fetchone()
            curs.fetchone()
            self.assertEqual(1, calls[0])

            curs.execute("select * from nttest order by 1")
            curs.fetchone()
            curs.fetchall()
            self.assertEqual(2, calls[0])

            curs.execute("select * from nttest order by 1")
            curs.fetchone()
            curs.fetchmany(1)
            self.assertEqual(3, calls[0])

        finally:
            NamedTupleCursor._make_nt = f_orig

    @skip_if_no_namedtuple
    @skip_before_postgres(8, 0)
    def test_named(self):
        curs = self.conn.cursor('tmp')
        curs.execute("""select i from generate_series(0,9) i""")
        recs = []
        recs.extend(curs.fetchmany(5))
        recs.append(curs.fetchone())
        recs.extend(curs.fetchall())
        self.assertEqual(range(10), [t.i for t in recs])

    @skip_if_no_namedtuple
    def test_named_fetchone(self):
        curs = self.conn.cursor('tmp')
        curs.execute("""select 42 as i""")
        t = curs.fetchone()
        self.assertEqual(t.i, 42)

    @skip_if_no_namedtuple
    def test_named_fetchmany(self):
        curs = self.conn.cursor('tmp')
        curs.execute("""select 42 as i""")
        recs = curs.fetchmany(10)
        self.assertEqual(recs[0].i, 42)

    @skip_if_no_namedtuple
    def test_named_fetchall(self):
        curs = self.conn.cursor('tmp')
        curs.execute("""select 42 as i""")
        recs = curs.fetchall()
        self.assertEqual(recs[0].i, 42)

    @skip_if_no_namedtuple
    @skip_before_postgres(8, 2)
    def test_not_greedy(self):
        curs = self.conn.cursor('tmp')
        curs.itersize = 2
        curs.execute("""select clock_timestamp() as ts from generate_series(1,3)""")
        recs = []
        for t in curs:
            time.sleep(0.01)
            recs.append(t)

        # check that the dataset was not fetched in a single gulp
        self.assert_(recs[1].ts - recs[0].ts < timedelta(seconds=0.005))
        self.assert_(recs[2].ts - recs[1].ts > timedelta(seconds=0.0099))

    @skip_if_no_namedtuple
    @skip_before_postgres(8, 0)
    def test_named_rownumber(self):
        curs = self.conn.cursor('tmp')
        # Only checking for dataset < itersize:
        # see CursorTests.test_iter_named_cursor_rownumber
        curs.itersize = 4
        curs.execute("""select * from generate_series(1,3)""")
        for i, t in enumerate(curs):
            self.assertEqual(i + 1, curs.rownumber)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
