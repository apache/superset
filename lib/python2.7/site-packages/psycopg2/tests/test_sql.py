#!/usr/bin/env python

# test_sql.py - tests for the psycopg2.sql module
#
# Copyright (C) 2016 Daniele Varrazzo  <daniele.varrazzo@gmail.com>
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

import datetime as dt
from testutils import unittest, ConnectingTestCase, skip_before_python

import psycopg2
from psycopg2 import sql


class SqlFormatTests(ConnectingTestCase):
    @skip_before_python(2, 7)
    def test_pos(self):
        s = sql.SQL("select {} from {}").format(
            sql.Identifier('field'), sql.Identifier('table'))
        s1 = s.as_string(self.conn)
        self.assert_(isinstance(s1, str))
        self.assertEqual(s1, 'select "field" from "table"')

    def test_pos_spec(self):
        s = sql.SQL("select {0} from {1}").format(
            sql.Identifier('field'), sql.Identifier('table'))
        s1 = s.as_string(self.conn)
        self.assert_(isinstance(s1, str))
        self.assertEqual(s1, 'select "field" from "table"')

        s = sql.SQL("select {1} from {0}").format(
            sql.Identifier('table'), sql.Identifier('field'))
        s1 = s.as_string(self.conn)
        self.assert_(isinstance(s1, str))
        self.assertEqual(s1, 'select "field" from "table"')

    def test_dict(self):
        s = sql.SQL("select {f} from {t}").format(
            f=sql.Identifier('field'), t=sql.Identifier('table'))
        s1 = s.as_string(self.conn)
        self.assert_(isinstance(s1, str))
        self.assertEqual(s1, 'select "field" from "table"')

    def test_unicode(self):
        s = sql.SQL(u"select {0} from {1}").format(
            sql.Identifier(u'field'), sql.Identifier('table'))
        s1 = s.as_string(self.conn)
        self.assert_(isinstance(s1, unicode))
        self.assertEqual(s1, u'select "field" from "table"')

    def test_compose_literal(self):
        s = sql.SQL("select {0};").format(sql.Literal(dt.date(2016, 12, 31)))
        s1 = s.as_string(self.conn)
        self.assertEqual(s1, "select '2016-12-31'::date;")

    def test_compose_empty(self):
        s = sql.SQL("select foo;").format()
        s1 = s.as_string(self.conn)
        self.assertEqual(s1, "select foo;")

    def test_percent_escape(self):
        s = sql.SQL("42 % {0}").format(sql.Literal(7))
        s1 = s.as_string(self.conn)
        self.assertEqual(s1, "42 % 7")

    def test_braces_escape(self):
        s = sql.SQL("{{{0}}}").format(sql.Literal(7))
        self.assertEqual(s.as_string(self.conn), "{7}")
        s = sql.SQL("{{1,{0}}}").format(sql.Literal(7))
        self.assertEqual(s.as_string(self.conn), "{1,7}")

    def test_compose_badnargs(self):
        self.assertRaises(IndexError, sql.SQL("select {0};").format)

    @skip_before_python(2, 7)
    def test_compose_badnargs_auto(self):
        self.assertRaises(IndexError, sql.SQL("select {};").format)
        self.assertRaises(ValueError, sql.SQL("select {} {1};").format, 10, 20)
        self.assertRaises(ValueError, sql.SQL("select {0} {};").format, 10, 20)

    def test_compose_bad_args_type(self):
        self.assertRaises(IndexError, sql.SQL("select {0};").format, a=10)
        self.assertRaises(KeyError, sql.SQL("select {x};").format, 10)

    def test_must_be_composable(self):
        self.assertRaises(TypeError, sql.SQL("select {0};").format, 'foo')
        self.assertRaises(TypeError, sql.SQL("select {0};").format, 10)

    def test_no_modifiers(self):
        self.assertRaises(ValueError, sql.SQL("select {a!r};").format, a=10)
        self.assertRaises(ValueError, sql.SQL("select {a:<};").format, a=10)

    def test_must_be_adaptable(self):
        class Foo(object):
            pass

        self.assertRaises(psycopg2.ProgrammingError,
            sql.SQL("select {0};").format(sql.Literal(Foo())).as_string, self.conn)

    def test_execute(self):
        cur = self.conn.cursor()
        cur.execute("""
            create table test_compose (
                id serial primary key,
                foo text, bar text, "ba'z" text)
            """)
        cur.execute(
            sql.SQL("insert into {0} (id, {1}) values (%s, {2})").format(
                sql.Identifier('test_compose'),
                sql.SQL(', ').join(map(sql.Identifier, ['foo', 'bar', "ba'z"])),
                (sql.Placeholder() * 3).join(', ')),
            (10, 'a', 'b', 'c'))

        cur.execute("select * from test_compose")
        self.assertEqual(cur.fetchall(), [(10, 'a', 'b', 'c')])

    def test_executemany(self):
        cur = self.conn.cursor()
        cur.execute("""
            create table test_compose (
                id serial primary key,
                foo text, bar text, "ba'z" text)
            """)
        cur.executemany(
            sql.SQL("insert into {0} (id, {1}) values (%s, {2})").format(
                sql.Identifier('test_compose'),
                sql.SQL(', ').join(map(sql.Identifier, ['foo', 'bar', "ba'z"])),
                (sql.Placeholder() * 3).join(', ')),
            [(10, 'a', 'b', 'c'), (20, 'd', 'e', 'f')])

        cur.execute("select * from test_compose")
        self.assertEqual(cur.fetchall(),
            [(10, 'a', 'b', 'c'), (20, 'd', 'e', 'f')])


class IdentifierTests(ConnectingTestCase):
    def test_class(self):
        self.assert_(issubclass(sql.Identifier, sql.Composable))

    def test_init(self):
        self.assert_(isinstance(sql.Identifier('foo'), sql.Identifier))
        self.assert_(isinstance(sql.Identifier(u'foo'), sql.Identifier))
        self.assertRaises(TypeError, sql.Identifier, 10)
        self.assertRaises(TypeError, sql.Identifier, dt.date(2016, 12, 31))

    def test_string(self):
        self.assertEqual(sql.Identifier('foo').string, 'foo')

    def test_repr(self):
        obj = sql.Identifier("fo'o")
        self.assertEqual(repr(obj), 'Identifier("fo\'o")')
        self.assertEqual(repr(obj), str(obj))

    def test_eq(self):
        self.assert_(sql.Identifier('foo') == sql.Identifier('foo'))
        self.assert_(sql.Identifier('foo') != sql.Identifier('bar'))
        self.assert_(sql.Identifier('foo') != 'foo')
        self.assert_(sql.Identifier('foo') != sql.SQL('foo'))

    def test_as_str(self):
        self.assertEqual(sql.Identifier('foo').as_string(self.conn), '"foo"')
        self.assertEqual(sql.Identifier("fo'o").as_string(self.conn), '"fo\'o"')

    def test_join(self):
        self.assert_(not hasattr(sql.Identifier('foo'), 'join'))


class LiteralTests(ConnectingTestCase):
    def test_class(self):
        self.assert_(issubclass(sql.Literal, sql.Composable))

    def test_init(self):
        self.assert_(isinstance(sql.Literal('foo'), sql.Literal))
        self.assert_(isinstance(sql.Literal(u'foo'), sql.Literal))
        self.assert_(isinstance(sql.Literal(b'foo'), sql.Literal))
        self.assert_(isinstance(sql.Literal(42), sql.Literal))
        self.assert_(isinstance(
            sql.Literal(dt.date(2016, 12, 31)), sql.Literal))

    def test_wrapped(self):
        self.assertEqual(sql.Literal('foo').wrapped, 'foo')

    def test_repr(self):
        self.assertEqual(repr(sql.Literal("foo")), "Literal('foo')")
        self.assertEqual(str(sql.Literal("foo")), "Literal('foo')")
        self.assertQuotedEqual(sql.Literal("foo").as_string(self.conn), "'foo'")
        self.assertEqual(sql.Literal(42).as_string(self.conn), "42")
        self.assertEqual(
            sql.Literal(dt.date(2017, 1, 1)).as_string(self.conn),
            "'2017-01-01'::date")

    def test_eq(self):
        self.assert_(sql.Literal('foo') == sql.Literal('foo'))
        self.assert_(sql.Literal('foo') != sql.Literal('bar'))
        self.assert_(sql.Literal('foo') != 'foo')
        self.assert_(sql.Literal('foo') != sql.SQL('foo'))

    def test_must_be_adaptable(self):
        class Foo(object):
            pass

        self.assertRaises(psycopg2.ProgrammingError,
            sql.Literal(Foo()).as_string, self.conn)


class SQLTests(ConnectingTestCase):
    def test_class(self):
        self.assert_(issubclass(sql.SQL, sql.Composable))

    def test_init(self):
        self.assert_(isinstance(sql.SQL('foo'), sql.SQL))
        self.assert_(isinstance(sql.SQL(u'foo'), sql.SQL))
        self.assertRaises(TypeError, sql.SQL, 10)
        self.assertRaises(TypeError, sql.SQL, dt.date(2016, 12, 31))

    def test_string(self):
        self.assertEqual(sql.SQL('foo').string, 'foo')

    def test_repr(self):
        self.assertEqual(repr(sql.SQL("foo")), "SQL('foo')")
        self.assertEqual(str(sql.SQL("foo")), "SQL('foo')")
        self.assertEqual(sql.SQL("foo").as_string(self.conn), "foo")

    def test_eq(self):
        self.assert_(sql.SQL('foo') == sql.SQL('foo'))
        self.assert_(sql.SQL('foo') != sql.SQL('bar'))
        self.assert_(sql.SQL('foo') != 'foo')
        self.assert_(sql.SQL('foo') != sql.Literal('foo'))

    def test_sum(self):
        obj = sql.SQL("foo") + sql.SQL("bar")
        self.assert_(isinstance(obj, sql.Composed))
        self.assertEqual(obj.as_string(self.conn), "foobar")

    def test_sum_inplace(self):
        obj = sql.SQL("foo")
        obj += sql.SQL("bar")
        self.assert_(isinstance(obj, sql.Composed))
        self.assertEqual(obj.as_string(self.conn), "foobar")

    def test_multiply(self):
        obj = sql.SQL("foo") * 3
        self.assert_(isinstance(obj, sql.Composed))
        self.assertEqual(obj.as_string(self.conn), "foofoofoo")

    def test_join(self):
        obj = sql.SQL(", ").join(
            [sql.Identifier('foo'), sql.SQL('bar'), sql.Literal(42)])
        self.assert_(isinstance(obj, sql.Composed))
        self.assertEqual(obj.as_string(self.conn), '"foo", bar, 42')

        obj = sql.SQL(", ").join(
            sql.Composed([sql.Identifier('foo'), sql.SQL('bar'), sql.Literal(42)]))
        self.assert_(isinstance(obj, sql.Composed))
        self.assertEqual(obj.as_string(self.conn), '"foo", bar, 42')

        obj = sql.SQL(", ").join([])
        self.assertEqual(obj, sql.Composed([]))


class ComposedTest(ConnectingTestCase):
    def test_class(self):
        self.assert_(issubclass(sql.Composed, sql.Composable))

    def test_repr(self):
        obj = sql.Composed([sql.Literal("foo"), sql.Identifier("b'ar")])
        self.assertEqual(repr(obj),
            """Composed([Literal('foo'), Identifier("b'ar")])""")
        self.assertEqual(str(obj), repr(obj))

    def test_seq(self):
        l = [sql.SQL('foo'), sql.Literal('bar'), sql.Identifier('baz')]
        self.assertEqual(sql.Composed(l).seq, l)

    def test_eq(self):
        l = [sql.Literal("foo"), sql.Identifier("b'ar")]
        l2 = [sql.Literal("foo"), sql.Literal("b'ar")]
        self.assert_(sql.Composed(l) == sql.Composed(list(l)))
        self.assert_(sql.Composed(l) != l)
        self.assert_(sql.Composed(l) != sql.Composed(l2))

    def test_join(self):
        obj = sql.Composed([sql.Literal("foo"), sql.Identifier("b'ar")])
        obj = obj.join(", ")
        self.assert_(isinstance(obj, sql.Composed))
        self.assertQuotedEqual(obj.as_string(self.conn), "'foo', \"b'ar\"")

    def test_sum(self):
        obj = sql.Composed([sql.SQL("foo ")])
        obj = obj + sql.Literal("bar")
        self.assert_(isinstance(obj, sql.Composed))
        self.assertQuotedEqual(obj.as_string(self.conn), "foo 'bar'")

    def test_sum_inplace(self):
        obj = sql.Composed([sql.SQL("foo ")])
        obj += sql.Literal("bar")
        self.assert_(isinstance(obj, sql.Composed))
        self.assertQuotedEqual(obj.as_string(self.conn), "foo 'bar'")

        obj = sql.Composed([sql.SQL("foo ")])
        obj += sql.Composed([sql.Literal("bar")])
        self.assert_(isinstance(obj, sql.Composed))
        self.assertQuotedEqual(obj.as_string(self.conn), "foo 'bar'")

    def test_iter(self):
        obj = sql.Composed([sql.SQL("foo"), sql.SQL('bar')])
        it = iter(obj)
        i = it.next()
        self.assertEqual(i, sql.SQL('foo'))
        i = it.next()
        self.assertEqual(i, sql.SQL('bar'))
        self.assertRaises(StopIteration, it.next)


class PlaceholderTest(ConnectingTestCase):
    def test_class(self):
        self.assert_(issubclass(sql.Placeholder, sql.Composable))

    def test_name(self):
        self.assertEqual(sql.Placeholder().name, None)
        self.assertEqual(sql.Placeholder('foo').name, 'foo')

    def test_repr(self):
        self.assert_(str(sql.Placeholder()), 'Placeholder()')
        self.assert_(repr(sql.Placeholder()), 'Placeholder()')
        self.assert_(sql.Placeholder().as_string(self.conn), '%s')

    def test_repr_name(self):
        self.assert_(str(sql.Placeholder('foo')), "Placeholder('foo')")
        self.assert_(repr(sql.Placeholder('foo')), "Placeholder('foo')")
        self.assert_(sql.Placeholder('foo').as_string(self.conn), '%(foo)s')

    def test_bad_name(self):
        self.assertRaises(ValueError, sql.Placeholder, ')')

    def test_eq(self):
        self.assert_(sql.Placeholder('foo') == sql.Placeholder('foo'))
        self.assert_(sql.Placeholder('foo') != sql.Placeholder('bar'))
        self.assert_(sql.Placeholder('foo') != 'foo')
        self.assert_(sql.Placeholder() == sql.Placeholder())
        self.assert_(sql.Placeholder('foo') != sql.Placeholder())
        self.assert_(sql.Placeholder('foo') != sql.Literal('foo'))


class ValuesTest(ConnectingTestCase):
    def test_null(self):
        self.assert_(isinstance(sql.NULL, sql.SQL))
        self.assertEqual(sql.NULL.as_string(self.conn), "NULL")

    def test_default(self):
        self.assert_(isinstance(sql.DEFAULT, sql.SQL))
        self.assertEqual(sql.DEFAULT.as_string(self.conn), "DEFAULT")


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
