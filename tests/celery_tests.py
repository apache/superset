"""Unit tests for Superset Celery worker"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import os
import subprocess
import time
import unittest

import pandas as pd

from superset import app, appbuilder, cli, db, models, dataframe
from superset.security import sync_role_definitions
from superset.sql_parse import SupersetQuery

from .base_tests import SupersetTestCase

QueryStatus = models.QueryStatus

BASE_DIR = app.config.get('BASE_DIR')


class CeleryConfig(object):
    BROKER_URL = 'sqla+sqlite:///' + app.config.get('SQL_CELERY_DB_FILE_PATH')
    CELERY_IMPORTS = ('superset.sql_lab', )
    CELERY_RESULT_BACKEND = 'db+sqlite:///' + app.config.get('SQL_CELERY_RESULTS_DB_FILE_PATH')
    CELERY_ANNOTATIONS = {'sql_lab.add': {'rate_limit': '10/s'}}
    CONCURRENCY = 1
app.config['CELERY_CONFIG'] = CeleryConfig


class UtilityFunctionTests(SupersetTestCase):

    # TODO(bkyryliuk): support more cases in CTA function.
    def test_create_table_as(self):
        q = SupersetQuery("SELECT * FROM outer_space;")

        self.assertEqual(
            "CREATE TABLE tmp AS \nSELECT * FROM outer_space",
            q.as_create_table("tmp"))

        self.assertEqual(
            "DROP TABLE IF EXISTS tmp;\n"
            "CREATE TABLE tmp AS \nSELECT * FROM outer_space",
            q.as_create_table("tmp", overwrite=True))

        # now without a semicolon
        q = SupersetQuery("SELECT * FROM outer_space")
        self.assertEqual(
            "CREATE TABLE tmp AS \nSELECT * FROM outer_space",
            q.as_create_table("tmp"))

        # now a multi-line query
        multi_line_query = (
            "SELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader'")
        q = SupersetQuery(multi_line_query)
        self.assertEqual(
            "CREATE TABLE tmp AS \nSELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader'",
            q.as_create_table("tmp")
        )


class CeleryTestCase(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(CeleryTestCase, self).__init__(*args, **kwargs)
        self.client = app.test_client()

    def get_query_by_name(self, sql):
        session = db.session
        query = session.query(models.Query).filter_by(sql=sql).first()
        session.close()
        return query

    def get_query_by_id(self, id):
        session = db.session
        query = session.query(models.Query).filter_by(id=id).first()
        session.close()
        return query

    @classmethod
    def setUpClass(cls):
        try:
            os.remove(app.config.get('SQL_CELERY_DB_FILE_PATH'))
        except OSError as e:
            app.logger.warn(str(e))
        try:
            os.remove(app.config.get('SQL_CELERY_RESULTS_DB_FILE_PATH'))
        except OSError as e:
            app.logger.warn(str(e))

        sync_role_definitions()

        worker_command = BASE_DIR + '/bin/superset worker'
        subprocess.Popen(
            worker_command, shell=True, stdout=subprocess.PIPE)

        admin = appbuilder.sm.find_user('admin')
        if not admin:
            appbuilder.sm.add_user(
                'admin', 'admin', ' user', 'admin@fab.org',
                appbuilder.sm.find_role('Admin'),
                password='general')
        cli.load_examples(load_test_data=True)

    @classmethod
    def tearDownClass(cls):
        subprocess.call(
            "ps auxww | grep 'celeryd' | awk '{print $2}' | xargs kill -9",
            shell=True
        )
        subprocess.call(
            "ps auxww | grep 'superset worker' | awk '{print $2}' | "
            "xargs kill -9",
            shell=True
        )

    def run_sql(self, db_id, sql, client_id, cta='false', tmp_table='tmp',
                async='false'):
        self.login()
        resp = self.client.post(
            '/superset/sql_json/',
            data=dict(
                database_id=db_id,
                sql=sql,
                async=async,
                select_as_cta=cta,
                tmp_table_name=tmp_table,
                client_id=client_id,
            ),
        )
        self.logout()
        return json.loads(resp.data.decode('utf-8'))

    def test_add_limit_to_the_query(self):
        session = db.session
        main_db = self.get_main_database(db.session)
        eng = main_db.get_sqla_engine()

        select_query = "SELECT * FROM outer_space;"
        updated_select_query = main_db.wrap_sql_limit(select_query, 100)
        # Different DB engines have their own spacing while compiling
        # the queries, that's why ' '.join(query.split()) is used.
        # In addition some of the engines do not include OFFSET 0.
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM outer_space;) AS inner_qry "
            "LIMIT 100" in ' '.join(updated_select_query.split())
        )

        select_query_no_semicolon = "SELECT * FROM outer_space"
        updated_select_query_no_semicolon = main_db.wrap_sql_limit(
            select_query_no_semicolon, 100)
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM outer_space) AS inner_qry "
            "LIMIT 100" in
            ' '.join(updated_select_query_no_semicolon.split())
        )

        multi_line_query = (
            "SELECT * FROM planets WHERE\n Luke_Father = 'Darth Vader';"
        )
        updated_multi_line_query = main_db.wrap_sql_limit(multi_line_query, 100)
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM planets WHERE "
            "Luke_Father = 'Darth Vader';) AS inner_qry LIMIT 100" in
            ' '.join(updated_multi_line_query.split())
        )

    def test_run_sync_query_dont_exist(self):
        main_db = self.get_main_database(db.session)
        db_id = main_db.id
        sql_dont_exist = 'SELECT name FROM table_dont_exist'
        result1 = self.run_sql(db_id, sql_dont_exist, "1", cta='true')
        self.assertTrue('error' in result1)

    def test_run_sync_query_cta(self):
        main_db = self.get_main_database(db.session)
        db_id = main_db.id
        eng = main_db.get_sqla_engine()
        perm_name = 'can_sql_json'
        sql_where = (
            "SELECT name FROM ab_permission WHERE name='{}'".format(perm_name))
        result2 = self.run_sql(
            db_id, sql_where, "2", tmp_table='tmp_table_2', cta='true')
        self.assertEqual(QueryStatus.SUCCESS, result2['query']['state'])
        self.assertEqual([], result2['data'])
        self.assertEqual({}, result2['columns'])
        query2 = self.get_query_by_id(result2['query']['serverId'])

        # Check the data in the tmp table.
        df2 = pd.read_sql_query(sql=query2.select_sql, con=eng)
        data2 = df2.to_dict(orient='records')
        self.assertEqual([{'name': perm_name}], data2)

    def test_run_sync_query_cta_no_data(self):
        main_db = self.get_main_database(db.session)
        db_id = main_db.id
        sql_empty_result = 'SELECT * FROM ab_user WHERE id=666'
        result3 = self.run_sql(
            db_id, sql_empty_result, "3", tmp_table='tmp_table_3', cta='true')
        self.assertEqual(QueryStatus.SUCCESS, result3['query']['state'])
        self.assertEqual([], result3['data'])
        self.assertEqual({}, result3['columns'])

        query3 = self.get_query_by_id(result3['query']['serverId'])
        self.assertEqual(QueryStatus.SUCCESS, query3.status)

    def test_run_async_query(self):
        main_db = self.get_main_database(db.session)
        eng = main_db.get_sqla_engine()
        sql_where = "SELECT name FROM ab_role WHERE name='Admin'"
        result = self.run_sql(
            main_db.id, sql_where, "4", async='true', tmp_table='tmp_async_1',
            cta='true')
        assert result['query']['state'] in (
            QueryStatus.PENDING, QueryStatus.RUNNING, QueryStatus.SUCCESS)

        time.sleep(1)

        query = self.get_query_by_id(result['query']['serverId'])
        df = pd.read_sql_query(query.select_sql, con=eng)
        self.assertEqual(QueryStatus.SUCCESS, query.status)
        self.assertEqual([{'name': 'Admin'}], df.to_dict(orient='records'))
        self.assertEqual(QueryStatus.SUCCESS, query.status)
        self.assertTrue("FROM tmp_async_1" in query.select_sql)
        self.assertTrue("LIMIT 666" in query.select_sql)
        self.assertEqual(
            "CREATE TABLE tmp_async_1 AS \nSELECT name FROM ab_role "
            "WHERE name='Admin'", query.executed_sql)
        self.assertEqual(sql_where, query.sql)
        self.assertEqual(0, query.rows)
        self.assertEqual(666, query.limit)
        self.assertEqual(False, query.limit_used)
        self.assertEqual(True, query.select_as_cta)
        self.assertEqual(True, query.select_as_cta_used)

    def test_get_columns_dict(self):
        main_db = self.get_main_database(db.session)
        df = main_db.get_df("SELECT * FROM multiformat_time_series", None)
        cdf = dataframe.SupersetDataFrame(df)
        if main_db.sqlalchemy_uri.startswith('sqlite'):
            self.assertEqual(
                [{'is_date': True, 'type': 'datetime_string', 'name': 'ds',
                  'is_dim': False},
                 {'is_date': True, 'type': 'datetime_string', 'name': 'ds2',
                  'is_dim': False},
                 {'agg': 'sum', 'is_date': False, 'type': 'int64',
                  'name': 'epoch_ms', 'is_dim': False},
                 {'agg': 'sum', 'is_date': False, 'type': 'int64',
                  'name': 'epoch_s', 'is_dim': False},
                 {'is_date': True, 'type': 'datetime_string', 'name': 'string0',
                  'is_dim': False},
                 {'is_date': False, 'type': 'object',
                  'name': 'string1', 'is_dim': True},
                 {'is_date': True, 'type': 'datetime_string', 'name': 'string2',
                  'is_dim': False},
                 {'is_date': False, 'type': 'object',
                  'name': 'string3', 'is_dim': True}]
                , cdf.columns_dict
            )
        else:
            self.assertEqual(
                [{'is_date': True, 'type': 'datetime_string', 'name': 'ds',
                  'is_dim': False},
                 {'is_date': True, 'type': 'datetime64[ns]',
                  'name': 'ds2', 'is_dim': False},
                 {'agg': 'sum', 'is_date': False, 'type': 'int64',
                  'name': 'epoch_ms', 'is_dim': False},
                 {'agg': 'sum', 'is_date': False, 'type': 'int64',
                  'name': 'epoch_s', 'is_dim': False},
                 {'is_date': True, 'type': 'datetime_string', 'name': 'string0',
                  'is_dim': False},
                 {'is_date': False, 'type': 'object',
                  'name': 'string1', 'is_dim': True},
                 {'is_date': True, 'type': 'datetime_string', 'name': 'string2',
                  'is_dim': False},
                 {'is_date': False, 'type': 'object',
                  'name': 'string3', 'is_dim': True}]
                , cdf.columns_dict
            )


if __name__ == '__main__':
    unittest.main()
