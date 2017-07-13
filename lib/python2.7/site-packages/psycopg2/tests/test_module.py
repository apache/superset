#!/usr/bin/env python

# test_module.py - unit test for the module interface
#
# Copyright (C) 2011 Daniele Varrazzo <daniele.varrazzo@gmail.com>
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
import sys
from subprocess import Popen

from testutils import (unittest, skip_before_python, skip_before_postgres,
    ConnectingTestCase, skip_copy_if_green, script_to_py3, slow)

import psycopg2


class ConnectTestCase(unittest.TestCase):
    def setUp(self):
        self.args = None

        def connect_stub(dsn, connection_factory=None, async_=False):
            self.args = (dsn, connection_factory, async_)

        self._connect_orig = psycopg2._connect
        psycopg2._connect = connect_stub

    def tearDown(self):
        psycopg2._connect = self._connect_orig

    def test_there_has_to_be_something(self):
        self.assertRaises(TypeError, psycopg2.connect)
        self.assertRaises(TypeError, psycopg2.connect,
            connection_factory=lambda dsn, async_=False: None)
        self.assertRaises(TypeError, psycopg2.connect,
            async_=True)

    def test_no_keywords(self):
        psycopg2.connect('')
        self.assertEqual(self.args[0], '')
        self.assertEqual(self.args[1], None)
        self.assertEqual(self.args[2], False)

    def test_dsn(self):
        psycopg2.connect('dbname=blah host=y')
        self.assertEqual(self.args[0], 'dbname=blah host=y')
        self.assertEqual(self.args[1], None)
        self.assertEqual(self.args[2], False)

    def test_supported_keywords(self):
        psycopg2.connect(database='foo')
        self.assertEqual(self.args[0], 'dbname=foo')
        psycopg2.connect(user='postgres')
        self.assertEqual(self.args[0], 'user=postgres')
        psycopg2.connect(password='secret')
        self.assertEqual(self.args[0], 'password=secret')
        psycopg2.connect(port=5432)
        self.assertEqual(self.args[0], 'port=5432')
        psycopg2.connect(sslmode='require')
        self.assertEqual(self.args[0], 'sslmode=require')

        psycopg2.connect(database='foo',
            user='postgres', password='secret', port=5432)
        self.assert_('dbname=foo' in self.args[0])
        self.assert_('user=postgres' in self.args[0])
        self.assert_('password=secret' in self.args[0])
        self.assert_('port=5432' in self.args[0])
        self.assertEqual(len(self.args[0].split()), 4)

    def test_generic_keywords(self):
        psycopg2.connect(options='stuff')
        self.assertEqual(self.args[0], 'options=stuff')

    def test_factory(self):
        def f(dsn, async_=False):
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
        psycopg2.connect(database='foo', host='baz', async_=1)
        self.assertDsnEqual(self.args[0], 'dbname=foo host=baz')
        self.assertEqual(self.args[1], None)
        self.assert_(self.args[2])

        psycopg2.connect("dbname=foo host=baz", async_=True)
        self.assertDsnEqual(self.args[0], 'dbname=foo host=baz')
        self.assertEqual(self.args[1], None)
        self.assert_(self.args[2])

    def test_int_port_param(self):
        psycopg2.connect(database='sony', port=6543)
        dsn = " %s " % self.args[0]
        self.assert_(" dbname=sony " in dsn, dsn)
        self.assert_(" port=6543 " in dsn, dsn)

    def test_empty_param(self):
        psycopg2.connect(database='sony', password='')
        self.assertDsnEqual(self.args[0], "dbname=sony password=''")

    def test_escape(self):
        psycopg2.connect(database='hello world')
        self.assertEqual(self.args[0], "dbname='hello world'")

        psycopg2.connect(database=r'back\slash')
        self.assertEqual(self.args[0], r"dbname=back\\slash")

        psycopg2.connect(database="quo'te")
        self.assertEqual(self.args[0], r"dbname=quo\'te")

        psycopg2.connect(database="with\ttab")
        self.assertEqual(self.args[0], "dbname='with\ttab'")

        psycopg2.connect(database=r"\every thing'")
        self.assertEqual(self.args[0], r"dbname='\\every thing\''")

    def test_params_merging(self):
        psycopg2.connect('dbname=foo', database='bar')
        self.assertEqual(self.args[0], 'dbname=bar')

        psycopg2.connect('dbname=foo', user='postgres')
        self.assertDsnEqual(self.args[0], 'dbname=foo user=postgres')


class ExceptionsTestCase(ConnectingTestCase):
    def test_attributes(self):
        cur = self.conn.cursor()
        try:
            cur.execute("select * from nonexist")
        except psycopg2.Error, exc:
            e = exc

        self.assertEqual(e.pgcode, '42P01')
        self.assert_(e.pgerror)
        self.assert_(e.cursor is cur)

    def test_diagnostics_attributes(self):
        cur = self.conn.cursor()
        try:
            cur.execute("select * from nonexist")
        except psycopg2.Error, exc:
            e = exc

        diag = e.diag
        self.assert_(isinstance(diag, psycopg2.extensions.Diagnostics))
        for attr in [
                'column_name', 'constraint_name', 'context', 'datatype_name',
                'internal_position', 'internal_query', 'message_detail',
                'message_hint', 'message_primary', 'schema_name', 'severity',
                'source_file', 'source_function', 'source_line', 'sqlstate',
                'statement_position', 'table_name', ]:
            v = getattr(diag, attr)
            if v is not None:
                self.assert_(isinstance(v, str))

    def test_diagnostics_values(self):
        cur = self.conn.cursor()
        try:
            cur.execute("select * from nonexist")
        except psycopg2.Error, exc:
            e = exc

        self.assertEqual(e.diag.sqlstate, '42P01')
        self.assertEqual(e.diag.severity, 'ERROR')

    def test_diagnostics_life(self):
        import gc
        from weakref import ref

        def tmp():
            cur = self.conn.cursor()
            try:
                cur.execute("select * from nonexist")
            except psycopg2.Error, exc:
                return cur, exc

        cur, e = tmp()
        diag = e.diag
        w = ref(cur)

        del e, cur
        gc.collect()
        assert(w() is not None)

        self.assertEqual(diag.sqlstate, '42P01')

        del diag
        gc.collect()
        gc.collect()
        assert(w() is None)

    @skip_copy_if_green
    def test_diagnostics_copy(self):
        from StringIO import StringIO
        f = StringIO()
        cur = self.conn.cursor()
        try:
            cur.copy_to(f, 'nonexist')
        except psycopg2.Error, exc:
            diag = exc.diag

        self.assertEqual(diag.sqlstate, '42P01')

    def test_diagnostics_independent(self):
        cur = self.conn.cursor()
        try:
            cur.execute("l'acqua e' poca e 'a papera nun galleggia")
        except Exception, exc:
            diag1 = exc.diag

        self.conn.rollback()

        try:
            cur.execute("select level from water where ducks > 1")
        except psycopg2.Error, exc:
            diag2 = exc.diag

        self.assertEqual(diag1.sqlstate, '42601')
        self.assertEqual(diag2.sqlstate, '42P01')

    def test_diagnostics_from_commit(self):
        cur = self.conn.cursor()
        cur.execute("""
            create temp table test_deferred (
               data int primary key,
               ref int references test_deferred (data)
                   deferrable initially deferred)
        """)
        cur.execute("insert into test_deferred values (1,2)")
        try:
            self.conn.commit()
        except psycopg2.Error, exc:
            e = exc
        self.assertEqual(e.diag.sqlstate, '23503')

    @skip_before_postgres(9, 3)
    def test_9_3_diagnostics(self):
        cur = self.conn.cursor()
        cur.execute("""
            create temp table test_exc (
                data int constraint chk_eq1 check (data = 1)
            )""")
        try:
            cur.execute("insert into test_exc values(2)")
        except psycopg2.Error, exc:
            e = exc
        self.assertEqual(e.pgcode, '23514')
        self.assertEqual(e.diag.schema_name[:7], "pg_temp")
        self.assertEqual(e.diag.table_name, "test_exc")
        self.assertEqual(e.diag.column_name, None)
        self.assertEqual(e.diag.constraint_name, "chk_eq1")
        self.assertEqual(e.diag.datatype_name, None)

    @skip_before_python(2, 5)
    def test_pickle(self):
        import pickle
        cur = self.conn.cursor()
        try:
            cur.execute("select * from nonexist")
        except psycopg2.Error, exc:
            e = exc

        e1 = pickle.loads(pickle.dumps(e))

        self.assertEqual(e.pgerror, e1.pgerror)
        self.assertEqual(e.pgcode, e1.pgcode)
        self.assert_(e1.cursor is None)

    @skip_before_python(2, 5)
    def test_pickle_connection_error(self):
        # segfaults on psycopg 2.5.1 - see ticket #170
        import pickle
        try:
            psycopg2.connect('dbname=nosuchdatabasemate')
        except psycopg2.Error, exc:
            e = exc

        e1 = pickle.loads(pickle.dumps(e))

        self.assertEqual(e.pgerror, e1.pgerror)
        self.assertEqual(e.pgcode, e1.pgcode)
        self.assert_(e1.cursor is None)


class TestExtensionModule(unittest.TestCase):
    @slow
    def test_import_internal(self):
        # check that the internal package can be imported "naked"
        # we may break this property if there is a compelling reason to do so,
        # however having it allows for some import juggling such as the one
        # required in ticket #201.
        pkgdir = os.path.dirname(psycopg2.__file__)
        pardir = os.path.dirname(pkgdir)
        self.assert_(pardir in sys.path)
        script = ("""
import sys
sys.path.remove(%r)
sys.path.insert(0, %r)
import _psycopg
""" % (pardir, pkgdir))

        proc = Popen([sys.executable, '-c', script_to_py3(script)])
        proc.communicate()
        self.assertEqual(0, proc.returncode)


class TestVersionDiscovery(unittest.TestCase):
    def test_libpq_version(self):
        self.assertTrue(type(psycopg2.__libpq_version__) is int)
        try:
            self.assertTrue(type(psycopg2.extensions.libpq_version()) is int)
        except psycopg2.NotSupportedError:
            self.assertTrue(psycopg2.__libpq_version__ < 90100)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
