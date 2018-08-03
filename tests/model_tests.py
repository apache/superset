# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import textwrap

from sqlalchemy.engine.url import make_url

from superset import app, db
from superset.models.core import Database
from .base_tests import SupersetTestCase


class DatabaseModelTestCase(SupersetTestCase):

    def test_database_schema_presto(self):
        sqlalchemy_uri = 'presto://presto.airbnb.io:8080/hive/default'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('hive/default', db)

        db = make_url(model.get_sqla_engine(schema='core_db').url).database
        self.assertEquals('hive/core_db', db)

        sqlalchemy_uri = 'presto://presto.airbnb.io:8080/hive'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('hive', db)

        db = make_url(model.get_sqla_engine(schema='core_db').url).database
        self.assertEquals('hive/core_db', db)

    def test_database_schema_postgres(self):
        sqlalchemy_uri = 'postgresql+psycopg2://postgres.airbnb.io:5439/prod'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('prod', db)

        db = make_url(model.get_sqla_engine(schema='foo').url).database
        self.assertEquals('prod', db)

    def test_database_schema_hive(self):
        sqlalchemy_uri = 'hive://hive@hive.airbnb.io:10000/default?auth=NOSASL'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)
        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('default', db)

        db = make_url(model.get_sqla_engine(schema='core_db').url).database
        self.assertEquals('core_db', db)

    def test_database_schema_mysql(self):
        sqlalchemy_uri = 'mysql://root@localhost/superset'
        model = Database(sqlalchemy_uri=sqlalchemy_uri)

        db = make_url(model.get_sqla_engine().url).database
        self.assertEquals('superset', db)

        db = make_url(model.get_sqla_engine(schema='staging').url).database
        self.assertEquals('staging', db)

    def test_database_impersonate_user(self):
        uri = 'mysql://root@localhost'
        example_user = 'giuseppe'
        model = Database(sqlalchemy_uri=uri)

        model.impersonate_user = True
        user_name = make_url(model.get_sqla_engine(user_name=example_user).url).username
        self.assertEquals(example_user, user_name)

        model.impersonate_user = False
        user_name = make_url(model.get_sqla_engine(user_name=example_user).url).username
        self.assertNotEquals(example_user, user_name)

    def test_select_star(self):
        main_db = self.get_main_database(db.session)
        table_name = 'bart_lines'
        sql = main_db.select_star(
            table_name, show_cols=False, latest_partition=False)
        expected = textwrap.dedent("""\
        SELECT *
        FROM {table_name}
        LIMIT 100""".format(**locals()))
        assert sql.startswith(expected)

        sql = main_db.select_star(
            table_name, show_cols=True, latest_partition=False)
        expected = textwrap.dedent("""\
        SELECT color,
               name,
               path_json,
               polyline
        FROM bart_lines
        LIMIT 100""".format(**locals()))
        assert sql.startswith(expected)

    def test_grains_dict(self):
        uri = 'mysql://root@localhost'
        database = Database(sqlalchemy_uri=uri)
        d = database.grains_dict()
        self.assertEquals(d.get('day').function, 'DATE({col})')
        self.assertEquals(d.get('P1D').function, 'DATE({col})')
        self.assertEquals(d.get('Time Column').function, '{col}')

    def test_single_statement(self):
        main_db = self.get_main_database(db.session)

        if main_db.backend == 'mysql':
            df = main_db.get_df('SELECT 1', None)
            self.assertEquals(df.iat[0, 0], 1)

            df = main_db.get_df('SELECT 1;', None)
            self.assertEquals(df.iat[0, 0], 1)

    def test_multi_statement(self):
        main_db = self.get_main_database(db.session)

        if main_db.backend == 'mysql':
            df = main_db.get_df('USE superset; SELECT 1', None)
            self.assertEquals(df.iat[0, 0], 1)

            df = main_db.get_df("USE superset; SELECT ';';", None)
            self.assertEquals(df.iat[0, 0], ';')


class SqlaTableModelTestCase(SupersetTestCase):

    def test_get_timestamp_expression(self):
        tbl = self.get_table_by_name('birth_names')
        ds_col = tbl.get_column('ds')
        sqla_literal = ds_col.get_timestamp_expression(None)
        self.assertEquals(str(sqla_literal.compile()), 'ds')

        sqla_literal = ds_col.get_timestamp_expression('P1D')
        compiled = '{}'.format(sqla_literal.compile())
        if tbl.database.backend == 'mysql':
            self.assertEquals(compiled, 'DATE(ds)')

        ds_col.expression = 'DATE_ADD(ds, 1)'
        sqla_literal = ds_col.get_timestamp_expression('P1D')
        compiled = '{}'.format(sqla_literal.compile())
        if tbl.database.backend == 'mysql':
            self.assertEquals(compiled, 'DATE(DATE_ADD(ds, 1))')

    def test_get_timestamp_expression_epoch(self):
        tbl = self.get_table_by_name('birth_names')
        ds_col = tbl.get_column('ds')

        ds_col.expression = None
        ds_col.python_date_format = 'epoch_s'
        sqla_literal = ds_col.get_timestamp_expression(None)
        compiled = '{}'.format(sqla_literal.compile())
        if tbl.database.backend == 'mysql':
            self.assertEquals(compiled, 'from_unixtime(ds)')

        ds_col.python_date_format = 'epoch_s'
        sqla_literal = ds_col.get_timestamp_expression('P1D')
        compiled = '{}'.format(sqla_literal.compile())
        if tbl.database.backend == 'mysql':
            self.assertEquals(compiled, 'DATE(from_unixtime(ds))')

        ds_col.expression = 'DATE_ADD(ds, 1)'
        sqla_literal = ds_col.get_timestamp_expression('P1D')
        compiled = '{}'.format(sqla_literal.compile())
        if tbl.database.backend == 'mysql':
            self.assertEquals(compiled, 'DATE(from_unixtime(DATE_ADD(ds, 1)))')

    def test_get_timestamp_expression_backward(self):
        tbl = self.get_table_by_name('birth_names')
        ds_col = tbl.get_column('ds')

        ds_col.expression = None
        ds_col.python_date_format = None
        sqla_literal = ds_col.get_timestamp_expression('day')
        compiled = '{}'.format(sqla_literal.compile())
        if tbl.database.backend == 'mysql':
            self.assertEquals(compiled, 'DATE(ds)')

        ds_col.expression = None
        ds_col.python_date_format = None
        sqla_literal = ds_col.get_timestamp_expression('Time Column')
        compiled = '{}'.format(sqla_literal.compile())
        if tbl.database.backend == 'mysql':
            self.assertEquals(compiled, 'ds')

    def test_sql_mutator(self):
        tbl = self.get_table_by_name('birth_names')
        query_obj = dict(
            groupby=[],
            metrics=[],
            filter=[],
            is_timeseries=False,
            columns=['name'],
            granularity=None,
            from_dttm=None, to_dttm=None,
            is_prequery=False,
            extras={},
        )
        sql = tbl.get_query_str(query_obj)
        self.assertNotIn('--COMMENT', sql)

        def mutator(*args):
            return '--COMMENT\n' + args[0]
        app.config['SQL_QUERY_MUTATOR'] = mutator
        sql = tbl.get_query_str(query_obj)
        self.assertIn('--COMMENT', sql)

        app.config['SQL_QUERY_MUTATOR'] = None
