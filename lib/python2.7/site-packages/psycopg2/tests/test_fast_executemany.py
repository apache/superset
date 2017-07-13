#!/usr/bin/env python
#
# test_fast_executemany.py - tests for fast executemany implementations
#
# Copyright (C) 2017 Daniele Varrazzo  <daniele.varrazzo@gmail.com>
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

from datetime import date

import testutils
from testutils import unittest

import psycopg2
import psycopg2.extras
import psycopg2.extensions as ext


class TestPaginate(unittest.TestCase):
    def test_paginate(self):
        def pag(seq):
            return psycopg2.extras._paginate(seq, 100)

        self.assertEqual(list(pag([])), [])
        self.assertEqual(list(pag([1])), [[1]])
        self.assertEqual(list(pag(range(99))), [list(range(99))])
        self.assertEqual(list(pag(range(100))), [list(range(100))])
        self.assertEqual(list(pag(range(101))), [list(range(100)), [100]])
        self.assertEqual(
            list(pag(range(200))), [list(range(100)), list(range(100, 200))])
        self.assertEqual(
            list(pag(range(1000))),
            [list(range(i * 100, (i + 1) * 100)) for i in range(10)])


class FastExecuteTestMixin(object):
    def setUp(self):
        super(FastExecuteTestMixin, self).setUp()
        cur = self.conn.cursor()
        cur.execute("""create table testfast (
            id serial primary key, date date, val int, data text)""")


class TestExecuteBatch(FastExecuteTestMixin, testutils.ConnectingTestCase):
    def test_empty(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, val) values (%s, %s)",
            [])
        cur.execute("select * from testfast order by id")
        self.assertEqual(cur.fetchall(), [])

    def test_one(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, val) values (%s, %s)",
            iter([(1, 10)]))
        cur.execute("select id, val from testfast order by id")
        self.assertEqual(cur.fetchall(), [(1, 10)])

    def test_tuples(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, date, val) values (%s, %s, %s)",
            ((i, date(2017, 1, i + 1), i * 10) for i in range(10)))
        cur.execute("select id, date, val from testfast order by id")
        self.assertEqual(cur.fetchall(),
            [(i, date(2017, 1, i + 1), i * 10) for i in range(10)])

    def test_many(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, val) values (%s, %s)",
            ((i, i * 10) for i in range(1000)))
        cur.execute("select id, val from testfast order by id")
        self.assertEqual(cur.fetchall(), [(i, i * 10) for i in range(1000)])

    def test_pages(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, val) values (%s, %s)",
            ((i, i * 10) for i in range(25)),
            page_size=10)

        # last command was 5 statements
        self.assertEqual(sum(c == u';' for c in cur.query.decode('ascii')), 4)

        cur.execute("select id, val from testfast order by id")
        self.assertEqual(cur.fetchall(), [(i, i * 10) for i in range(25)])

    @testutils.skip_before_postgres(8, 0)
    def test_unicode(self):
        cur = self.conn.cursor()
        ext.register_type(ext.UNICODE, cur)
        snowman = u"\u2603"

        # unicode in statement
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, data) values (%%s, %%s) -- %s" % snowman,
            [(1, 'x')])
        cur.execute("select id, data from testfast where id = 1")
        self.assertEqual(cur.fetchone(), (1, 'x'))

        # unicode in data
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, data) values (%s, %s)",
            [(2, snowman)])
        cur.execute("select id, data from testfast where id = 2")
        self.assertEqual(cur.fetchone(), (2, snowman))

        # unicode in both
        psycopg2.extras.execute_batch(cur,
            "insert into testfast (id, data) values (%%s, %%s) -- %s" % snowman,
            [(3, snowman)])
        cur.execute("select id, data from testfast where id = 3")
        self.assertEqual(cur.fetchone(), (3, snowman))


class TestExecuteValues(FastExecuteTestMixin, testutils.ConnectingTestCase):
    def test_empty(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, val) values %s",
            [])
        cur.execute("select * from testfast order by id")
        self.assertEqual(cur.fetchall(), [])

    def test_one(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, val) values %s",
            iter([(1, 10)]))
        cur.execute("select id, val from testfast order by id")
        self.assertEqual(cur.fetchall(), [(1, 10)])

    def test_tuples(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, date, val) values %s",
            ((i, date(2017, 1, i + 1), i * 10) for i in range(10)))
        cur.execute("select id, date, val from testfast order by id")
        self.assertEqual(cur.fetchall(),
            [(i, date(2017, 1, i + 1), i * 10) for i in range(10)])

    def test_dicts(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, date, val) values %s",
            (dict(id=i, date=date(2017, 1, i + 1), val=i * 10, foo="bar")
                for i in range(10)),
            template='(%(id)s, %(date)s, %(val)s)')
        cur.execute("select id, date, val from testfast order by id")
        self.assertEqual(cur.fetchall(),
            [(i, date(2017, 1, i + 1), i * 10) for i in range(10)])

    def test_many(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, val) values %s",
            ((i, i * 10) for i in range(1000)))
        cur.execute("select id, val from testfast order by id")
        self.assertEqual(cur.fetchall(), [(i, i * 10) for i in range(1000)])

    def test_pages(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, val) values %s",
            ((i, i * 10) for i in range(25)),
            page_size=10)

        # last statement was 5 tuples (one parens is for the fields list)
        self.assertEqual(sum(c == '(' for c in cur.query.decode('ascii')), 6)

        cur.execute("select id, val from testfast order by id")
        self.assertEqual(cur.fetchall(), [(i, i * 10) for i in range(25)])

    def test_unicode(self):
        cur = self.conn.cursor()
        ext.register_type(ext.UNICODE, cur)
        snowman = u"\u2603"

        # unicode in statement
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, data) values %%s -- %s" % snowman,
            [(1, 'x')])
        cur.execute("select id, data from testfast where id = 1")
        self.assertEqual(cur.fetchone(), (1, 'x'))

        # unicode in data
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, data) values %s",
            [(2, snowman)])
        cur.execute("select id, data from testfast where id = 2")
        self.assertEqual(cur.fetchone(), (2, snowman))

        # unicode in both
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, data) values %%s -- %s" % snowman,
            [(3, snowman)])
        cur.execute("select id, data from testfast where id = 3")
        self.assertEqual(cur.fetchone(), (3, snowman))

    def test_invalid_sql(self):
        cur = self.conn.cursor()
        self.assertRaises(ValueError, psycopg2.extras.execute_values, cur,
            "insert", [])
        self.assertRaises(ValueError, psycopg2.extras.execute_values, cur,
            "insert %s and %s", [])
        self.assertRaises(ValueError, psycopg2.extras.execute_values, cur,
            "insert %f", [])
        self.assertRaises(ValueError, psycopg2.extras.execute_values, cur,
            "insert %f %s", [])

    def test_percent_escape(self):
        cur = self.conn.cursor()
        psycopg2.extras.execute_values(cur,
            "insert into testfast (id, data) values %s -- a%%b",
            [(1, 'hi')])
        self.assert_(b'a%%b' not in cur.query)
        self.assert_(b'a%b' in cur.query)

        cur.execute("select id, data from testfast")
        self.assertEqual(cur.fetchall(), [(1, 'hi')])


testutils.decorate_all_tests(TestExecuteValues,
    testutils.skip_before_postgres(8, 2))


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
