#!/usr/bin/env python

# test_cursor.py - unit test for cursor attributes
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

import time
import pickle
import psycopg2
import psycopg2.extensions
from testutils import (unittest, ConnectingTestCase, skip_before_postgres,
    skip_if_no_namedtuple, skip_if_no_getrefcount, slow)


class CursorTests(ConnectingTestCase):

    def test_close_idempotent(self):
        cur = self.conn.cursor()
        cur.close()
        cur.close()
        self.assert_(cur.closed)

    def test_empty_query(self):
        cur = self.conn.cursor()
        self.assertRaises(psycopg2.ProgrammingError, cur.execute, "")
        self.assertRaises(psycopg2.ProgrammingError, cur.execute, " ")
        self.assertRaises(psycopg2.ProgrammingError, cur.execute, ";")

    def test_executemany_propagate_exceptions(self):
        conn = self.conn
        cur = conn.cursor()
        cur.execute("create temp table test_exc (data int);")

        def buggygen():
            yield 1 // 0

        self.assertRaises(ZeroDivisionError,
            cur.executemany, "insert into test_exc values (%s)", buggygen())
        cur.close()

    def test_mogrify_unicode(self):
        conn = self.conn
        cur = conn.cursor()

        # test consistency between execute and mogrify.

        # unicode query containing only ascii data
        cur.execute(u"SELECT 'foo';")
        self.assertEqual('foo', cur.fetchone()[0])
        self.assertEqual(b"SELECT 'foo';", cur.mogrify(u"SELECT 'foo';"))

        conn.set_client_encoding('UTF8')
        snowman = u"\u2603"

        def b(s):
            if isinstance(s, unicode):
                return s.encode('utf8')
            else:
                return s

        # unicode query with non-ascii data
        cur.execute(u"SELECT '%s';" % snowman)
        self.assertEqual(snowman.encode('utf8'), b(cur.fetchone()[0]))
        self.assertQuotedEqual(("SELECT '%s';" % snowman).encode('utf8'),
            cur.mogrify(u"SELECT '%s';" % snowman))

        # unicode args
        cur.execute("SELECT %s;", (snowman,))
        self.assertEqual(snowman.encode("utf-8"), b(cur.fetchone()[0]))
        self.assertQuotedEqual(("SELECT '%s';" % snowman).encode('utf8'),
            cur.mogrify("SELECT %s;", (snowman,)))

        # unicode query and args
        cur.execute(u"SELECT %s;", (snowman,))
        self.assertEqual(snowman.encode("utf-8"), b(cur.fetchone()[0]))
        self.assertQuotedEqual(("SELECT '%s';" % snowman).encode('utf8'),
            cur.mogrify(u"SELECT %s;", (snowman,)))

    def test_mogrify_decimal_explodes(self):
        # issue #7: explodes on windows with python 2.5 and psycopg 2.2.2
        try:
            from decimal import Decimal
        except:
            return

        conn = self.conn
        cur = conn.cursor()
        self.assertEqual(b'SELECT 10.3;',
            cur.mogrify("SELECT %s;", (Decimal("10.3"),)))

    @skip_if_no_getrefcount
    def test_mogrify_leak_on_multiple_reference(self):
        # issue #81: reference leak when a parameter value is referenced
        # more than once from a dict.
        cur = self.conn.cursor()
        foo = (lambda x: x)('foo') * 10
        import sys
        nref1 = sys.getrefcount(foo)
        cur.mogrify("select %(foo)s, %(foo)s, %(foo)s", {'foo': foo})
        nref2 = sys.getrefcount(foo)
        self.assertEqual(nref1, nref2)

    def test_bad_placeholder(self):
        cur = self.conn.cursor()
        self.assertRaises(psycopg2.ProgrammingError,
            cur.mogrify, "select %(foo", {})
        self.assertRaises(psycopg2.ProgrammingError,
            cur.mogrify, "select %(foo", {'foo': 1})
        self.assertRaises(psycopg2.ProgrammingError,
            cur.mogrify, "select %(foo, %(bar)", {'foo': 1})
        self.assertRaises(psycopg2.ProgrammingError,
            cur.mogrify, "select %(foo, %(bar)", {'foo': 1, 'bar': 2})

    def test_cast(self):
        curs = self.conn.cursor()

        self.assertEqual(42, curs.cast(20, '42'))
        self.assertAlmostEqual(3.14, curs.cast(700, '3.14'))

        try:
            from decimal import Decimal
        except ImportError:
            self.assertAlmostEqual(123.45, curs.cast(1700, '123.45'))
        else:
            self.assertEqual(Decimal('123.45'), curs.cast(1700, '123.45'))

        from datetime import date
        self.assertEqual(date(2011, 1, 2), curs.cast(1082, '2011-01-02'))
        self.assertEqual("who am i?", curs.cast(705, 'who am i?'))  # unknown

    def test_cast_specificity(self):
        curs = self.conn.cursor()
        self.assertEqual("foo", curs.cast(705, 'foo'))

        D = psycopg2.extensions.new_type((705,), "DOUBLING", lambda v, c: v * 2)
        psycopg2.extensions.register_type(D, self.conn)
        self.assertEqual("foofoo", curs.cast(705, 'foo'))

        T = psycopg2.extensions.new_type((705,), "TREBLING", lambda v, c: v * 3)
        psycopg2.extensions.register_type(T, curs)
        self.assertEqual("foofoofoo", curs.cast(705, 'foo'))

        curs2 = self.conn.cursor()
        self.assertEqual("foofoo", curs2.cast(705, 'foo'))

    def test_weakref(self):
        from weakref import ref
        curs = self.conn.cursor()
        w = ref(curs)
        del curs
        import gc
        gc.collect()
        self.assert_(w() is None)

    def test_null_name(self):
        curs = self.conn.cursor(None)
        self.assertEqual(curs.name, None)

    def test_invalid_name(self):
        curs = self.conn.cursor()
        curs.execute("create temp table invname (data int);")
        for i in (10, 20, 30):
            curs.execute("insert into invname values (%s)", (i,))
        curs.close()

        curs = self.conn.cursor(r'1-2-3 \ "test"')
        curs.execute("select data from invname order by data")
        self.assertEqual(curs.fetchall(), [(10,), (20,), (30,)])

    def _create_withhold_table(self):
        curs = self.conn.cursor()
        try:
            curs.execute("drop table withhold")
        except psycopg2.ProgrammingError:
            self.conn.rollback()
        curs.execute("create table withhold (data int)")
        for i in (10, 20, 30):
            curs.execute("insert into withhold values (%s)", (i,))
        curs.close()

    def test_withhold(self):
        self.assertRaises(psycopg2.ProgrammingError, self.conn.cursor,
                          withhold=True)

        self._create_withhold_table()
        curs = self.conn.cursor("W")
        self.assertEqual(curs.withhold, False)
        curs.withhold = True
        self.assertEqual(curs.withhold, True)
        curs.execute("select data from withhold order by data")
        self.conn.commit()
        self.assertEqual(curs.fetchall(), [(10,), (20,), (30,)])
        curs.close()

        curs = self.conn.cursor("W", withhold=True)
        self.assertEqual(curs.withhold, True)
        curs.execute("select data from withhold order by data")
        self.conn.commit()
        self.assertEqual(curs.fetchall(), [(10,), (20,), (30,)])

        curs = self.conn.cursor()
        curs.execute("drop table withhold")
        self.conn.commit()

    def test_withhold_no_begin(self):
        self._create_withhold_table()
        curs = self.conn.cursor("w", withhold=True)
        curs.execute("select data from withhold order by data")
        self.assertEqual(curs.fetchone(), (10,))
        self.assertEqual(self.conn.status, psycopg2.extensions.STATUS_BEGIN)
        self.assertEqual(self.conn.get_transaction_status(),
                         psycopg2.extensions.TRANSACTION_STATUS_INTRANS)

        self.conn.commit()
        self.assertEqual(self.conn.status, psycopg2.extensions.STATUS_READY)
        self.assertEqual(self.conn.get_transaction_status(),
                         psycopg2.extensions.TRANSACTION_STATUS_IDLE)

        self.assertEqual(curs.fetchone(), (20,))
        self.assertEqual(self.conn.status, psycopg2.extensions.STATUS_READY)
        self.assertEqual(self.conn.get_transaction_status(),
                         psycopg2.extensions.TRANSACTION_STATUS_IDLE)

        curs.close()
        self.assertEqual(self.conn.status, psycopg2.extensions.STATUS_READY)
        self.assertEqual(self.conn.get_transaction_status(),
                         psycopg2.extensions.TRANSACTION_STATUS_IDLE)

    def test_withhold_autocommit(self):
        self._create_withhold_table()
        self.conn.commit()
        self.conn.autocommit = True
        curs = self.conn.cursor("w", withhold=True)
        curs.execute("select data from withhold order by data")

        self.assertEqual(curs.fetchone(), (10,))
        self.assertEqual(self.conn.status, psycopg2.extensions.STATUS_READY)
        self.assertEqual(self.conn.get_transaction_status(),
                         psycopg2.extensions.TRANSACTION_STATUS_IDLE)

        self.conn.commit()
        self.assertEqual(self.conn.status, psycopg2.extensions.STATUS_READY)
        self.assertEqual(self.conn.get_transaction_status(),
                         psycopg2.extensions.TRANSACTION_STATUS_IDLE)

        curs.close()
        self.assertEqual(self.conn.status, psycopg2.extensions.STATUS_READY)
        self.assertEqual(self.conn.get_transaction_status(),
                         psycopg2.extensions.TRANSACTION_STATUS_IDLE)

    def test_scrollable(self):
        self.assertRaises(psycopg2.ProgrammingError, self.conn.cursor,
                          scrollable=True)

        curs = self.conn.cursor()
        curs.execute("create table scrollable (data int)")
        curs.executemany("insert into scrollable values (%s)",
            [(i,) for i in range(100)])
        curs.close()

        for t in range(2):
            if not t:
                curs = self.conn.cursor("S")
                self.assertEqual(curs.scrollable, None)
                curs.scrollable = True
            else:
                curs = self.conn.cursor("S", scrollable=True)

            self.assertEqual(curs.scrollable, True)
            curs.itersize = 10

            # complex enough to make postgres cursors declare without
            # scroll/no scroll to fail
            curs.execute("""
                select x.data
                from scrollable x
                join scrollable y on x.data = y.data
                order by y.data""")
            for i, (n,) in enumerate(curs):
                self.assertEqual(i, n)

            curs.scroll(-1)
            for i in range(99, -1, -1):
                curs.scroll(-1)
                self.assertEqual(i, curs.fetchone()[0])
                curs.scroll(-1)

            curs.close()

    def test_not_scrollable(self):
        self.assertRaises(psycopg2.ProgrammingError, self.conn.cursor,
                          scrollable=False)

        curs = self.conn.cursor()
        curs.execute("create table scrollable (data int)")
        curs.executemany("insert into scrollable values (%s)",
            [(i,) for i in range(100)])
        curs.close()

        curs = self.conn.cursor("S")    # default scrollability
        curs.execute("select * from scrollable")
        self.assertEqual(curs.scrollable, None)
        curs.scroll(2)
        try:
            curs.scroll(-1)
        except psycopg2.OperationalError:
            return self.skipTest("can't evaluate non-scrollable cursor")
        curs.close()

        curs = self.conn.cursor("S", scrollable=False)
        self.assertEqual(curs.scrollable, False)
        curs.execute("select * from scrollable")
        curs.scroll(2)
        self.assertRaises(psycopg2.OperationalError, curs.scroll, -1)

    @slow
    @skip_before_postgres(8, 2)
    def test_iter_named_cursor_efficient(self):
        curs = self.conn.cursor('tmp')
        # if these records are fetched in the same roundtrip their
        # timestamp will not be influenced by the pause in Python world.
        curs.execute("""select clock_timestamp() from generate_series(1,2)""")
        i = iter(curs)
        t1 = (i.next())[0]  # the brackets work around a 2to3 bug
        time.sleep(0.2)
        t2 = (i.next())[0]
        self.assert_((t2 - t1).microseconds * 1e-6 < 0.1,
            "named cursor records fetched in 2 roundtrips (delta: %s)"
            % (t2 - t1))

    @skip_before_postgres(8, 0)
    def test_iter_named_cursor_default_itersize(self):
        curs = self.conn.cursor('tmp')
        curs.execute('select generate_series(1,50)')
        rv = [(r[0], curs.rownumber) for r in curs]
        # everything swallowed in one gulp
        self.assertEqual(rv, [(i, i) for i in range(1, 51)])

    @skip_before_postgres(8, 0)
    def test_iter_named_cursor_itersize(self):
        curs = self.conn.cursor('tmp')
        curs.itersize = 30
        curs.execute('select generate_series(1,50)')
        rv = [(r[0], curs.rownumber) for r in curs]
        # everything swallowed in two gulps
        self.assertEqual(rv, [(i, ((i - 1) % 30) + 1) for i in range(1, 51)])

    @skip_before_postgres(8, 0)
    def test_iter_named_cursor_rownumber(self):
        curs = self.conn.cursor('tmp')
        # note: this fails if itersize < dataset: internally we check
        # rownumber == rowcount to detect when to read anoter page, so we
        # would need an extra attribute to have a monotonic rownumber.
        curs.itersize = 20
        curs.execute('select generate_series(1,10)')
        for i, rec in enumerate(curs):
            self.assertEqual(i + 1, curs.rownumber)

    @skip_if_no_namedtuple
    def test_namedtuple_description(self):
        curs = self.conn.cursor()
        curs.execute("""select
            3.14::decimal(10,2) as pi,
            'hello'::text as hi,
            '2010-02-18'::date as now;
            """)
        self.assertEqual(len(curs.description), 3)
        for c in curs.description:
            self.assertEqual(len(c), 7)  # DBAPI happy
            for a in ('name', 'type_code', 'display_size', 'internal_size',
                    'precision', 'scale', 'null_ok'):
                self.assert_(hasattr(c, a), a)

        c = curs.description[0]
        self.assertEqual(c.name, 'pi')
        self.assert_(c.type_code in psycopg2.extensions.DECIMAL.values)
        self.assert_(c.internal_size > 0)
        self.assertEqual(c.precision, 10)
        self.assertEqual(c.scale, 2)

        c = curs.description[1]
        self.assertEqual(c.name, 'hi')
        self.assert_(c.type_code in psycopg2.STRING.values)
        self.assert_(c.internal_size < 0)
        self.assertEqual(c.precision, None)
        self.assertEqual(c.scale, None)

        c = curs.description[2]
        self.assertEqual(c.name, 'now')
        self.assert_(c.type_code in psycopg2.extensions.DATE.values)
        self.assert_(c.internal_size > 0)
        self.assertEqual(c.precision, None)
        self.assertEqual(c.scale, None)

    def test_pickle_description(self):
        curs = self.conn.cursor()
        curs.execute('SELECT 1 AS foo')
        description = curs.description

        pickled = pickle.dumps(description, pickle.HIGHEST_PROTOCOL)
        unpickled = pickle.loads(pickled)

        self.assertEqual(description, unpickled)

    @skip_before_postgres(8, 0)
    def test_named_cursor_stealing(self):
        # you can use a named cursor to iterate on a refcursor created
        # somewhere else
        cur1 = self.conn.cursor()
        cur1.execute("DECLARE test CURSOR WITHOUT HOLD "
            " FOR SELECT generate_series(1,7)")

        cur2 = self.conn.cursor('test')
        # can call fetch without execute
        self.assertEqual((1,), cur2.fetchone())
        self.assertEqual([(2,), (3,), (4,)], cur2.fetchmany(3))
        self.assertEqual([(5,), (6,), (7,)], cur2.fetchall())

    @skip_before_postgres(8, 0)
    def test_scroll(self):
        cur = self.conn.cursor()
        cur.execute("select generate_series(0,9)")
        cur.scroll(2)
        self.assertEqual(cur.fetchone(), (2,))
        cur.scroll(2)
        self.assertEqual(cur.fetchone(), (5,))
        cur.scroll(2, mode='relative')
        self.assertEqual(cur.fetchone(), (8,))
        cur.scroll(-1)
        self.assertEqual(cur.fetchone(), (8,))
        cur.scroll(-2)
        self.assertEqual(cur.fetchone(), (7,))
        cur.scroll(2, mode='absolute')
        self.assertEqual(cur.fetchone(), (2,))

        # on the boundary
        cur.scroll(0, mode='absolute')
        self.assertEqual(cur.fetchone(), (0,))
        self.assertRaises((IndexError, psycopg2.ProgrammingError),
            cur.scroll, -1, mode='absolute')
        cur.scroll(0, mode='absolute')
        self.assertRaises((IndexError, psycopg2.ProgrammingError),
            cur.scroll, -1)

        cur.scroll(9, mode='absolute')
        self.assertEqual(cur.fetchone(), (9,))
        self.assertRaises((IndexError, psycopg2.ProgrammingError),
            cur.scroll, 10, mode='absolute')
        cur.scroll(9, mode='absolute')
        self.assertRaises((IndexError, psycopg2.ProgrammingError),
            cur.scroll, 1)

    @skip_before_postgres(8, 0)
    def test_scroll_named(self):
        cur = self.conn.cursor('tmp', scrollable=True)
        cur.execute("select generate_series(0,9)")
        cur.scroll(2)
        self.assertEqual(cur.fetchone(), (2,))
        cur.scroll(2)
        self.assertEqual(cur.fetchone(), (5,))
        cur.scroll(2, mode='relative')
        self.assertEqual(cur.fetchone(), (8,))
        cur.scroll(9, mode='absolute')
        self.assertEqual(cur.fetchone(), (9,))

    def test_bad_subclass(self):
        # check that we get an error message instead of a segfault
        # for badly written subclasses.
        # see http://stackoverflow.com/questions/22019341/
        class StupidCursor(psycopg2.extensions.cursor):
            def __init__(self, *args, **kwargs):
                # I am stupid so not calling superclass init
                pass

        cur = StupidCursor()
        self.assertRaises(psycopg2.InterfaceError, cur.execute, 'select 1')
        self.assertRaises(psycopg2.InterfaceError, cur.executemany,
            'select 1', [])

    def test_callproc_badparam(self):
        cur = self.conn.cursor()
        self.assertRaises(TypeError, cur.callproc, 'lower', 42)

    # It would be inappropriate to test callproc's named parameters in the
    # DBAPI2.0 test section because they are a psycopg2 extension.
    @skip_before_postgres(9, 0)
    def test_callproc_dict(self):
        # This parameter name tests for injection and quote escaping
        paramname = '''
            Robert'); drop table "students" --
        '''.strip()
        escaped_paramname = '"%s"' % paramname.replace('"', '""')
        procname = 'pg_temp.randall'

        cur = self.conn.cursor()

        # Set up the temporary function
        cur.execute('''
            CREATE FUNCTION %s(%s INT)
            RETURNS INT AS
                'SELECT $1 * $1'
            LANGUAGE SQL
        ''' % (procname, escaped_paramname));

        # Make sure callproc works right
        cur.callproc(procname, { paramname: 2 })
        self.assertEquals(cur.fetchone()[0], 4)

        # Make sure callproc fails right
        failing_cases = [
            ({ paramname: 2, 'foo': 'bar' }, psycopg2.ProgrammingError),
            ({ paramname: '2' },             psycopg2.ProgrammingError),
            ({ paramname: 'two' },           psycopg2.ProgrammingError),
            ({ u'bj\xc3rn': 2 },             psycopg2.ProgrammingError),
            ({ 3: 2 },                       TypeError),
            ({ self: 2 },                    TypeError),
        ]
        for parameter_sequence, exception in failing_cases:
            self.assertRaises(exception, cur.callproc, procname, parameter_sequence)
            self.conn.rollback()

    def test_callproc_badparam(self):
        cur = self.conn.cursor()
        self.assertRaises(TypeError, cur.callproc, 'lower', 42)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
