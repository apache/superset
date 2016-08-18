"""Unit tests for Caravel Celery worker"""
import imp
import json
import subprocess

import time

import os

import pandas as pd
import unittest

import caravel
from caravel import app, appbuilder, db, models, sql_lab, sql_lab_utils, utils


BASE_DIR = app.config.get('BASE_DIR')
cli = imp.load_source('cli', BASE_DIR + '/bin/caravel')


SQL_CELERY_DB_FILE_PATH = '/tmp/celerydb.sqlite'
SQL_CELERY_RESULTS_DB_FILE_PATH = '/tmp/celery_results.sqlite'


class CeleryConfig(object):
    BROKER_URL = 'sqla+sqlite:///' + SQL_CELERY_DB_FILE_PATH
    CELERY_IMPORTS = ('caravel.sql_lab', )
    CELERY_RESULT_BACKEND = 'db+sqlite:///' + SQL_CELERY_RESULTS_DB_FILE_PATH
    CELERY_ANNOTATIONS = {'sql_lab.add': {'rate_limit': '10/s'}}
    CONCURRENCY = 1
app.config['CELERY_CONFIG'] = CeleryConfig

# TODO(bkyryliuk): add ability to run this test separately.

class UtilityFunctionTests(unittest.TestCase):
    def test_create_table_as(self):
        select_query = "SELECT * FROM outer_space;"
        updated_select_query = sql_lab_utils.create_table_as(
            select_query, "tmp")
        self.assertEqual(
            "CREATE TABLE tmp AS SELECT * FROM outer_space;",
            updated_select_query)

        updated_select_query_with_drop = sql_lab_utils.create_table_as(
            select_query, "tmp", override=True)
        self.assertEqual(
            "DROP TABLE IF EXISTS tmp;\n"
            "CREATE TABLE tmp AS SELECT * FROM outer_space;",
            updated_select_query_with_drop)

        select_query_no_semicolon = "SELECT * FROM outer_space"
        updated_select_query_no_semicolon = sql_lab_utils.create_table_as(
            select_query_no_semicolon, "tmp")
        self.assertEqual(
            "CREATE TABLE tmp AS SELECT * FROM outer_space",
            updated_select_query_no_semicolon)

        incorrect_query = "SMTH WRONG SELECT * FROM outer_space"
        updated_incorrect_query = sql_lab_utils.create_table_as(
            incorrect_query, "tmp")
        self.assertEqual(incorrect_query, updated_incorrect_query)

        insert_query = "INSERT INTO stomach VALUES (beer, chips);"
        updated_insert_query = sql_lab_utils.create_table_as(
            insert_query, "tmp")
        self.assertEqual(insert_query, updated_insert_query)

        multi_line_query = (
            "SELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader';")
        updated_multi_line_query = sql_lab_utils.create_table_as(
            multi_line_query, "tmp")
        expected_updated_multi_line_query = (
            "CREATE TABLE tmp AS SELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader';")
        self.assertEqual(
            expected_updated_multi_line_query,
            updated_multi_line_query)

        updated_multi_line_query_with_drop = sql_lab_utils.create_table_as(
            multi_line_query, "tmp", override=True)
        expected_updated_multi_line_query_with_drop = (
            "DROP TABLE IF EXISTS tmp;\n"
            "CREATE TABLE tmp AS SELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader';")
        self.assertEqual(
            expected_updated_multi_line_query_with_drop,
            updated_multi_line_query_with_drop)

        delete_query = "DELETE FROM planet WHERE name = 'Earth'"
        updated_delete_query = sql_lab_utils.create_table_as(delete_query, "tmp")
        self.assertEqual(delete_query, updated_delete_query)

        create_table_as = (
            "CREATE TABLE pleasure AS SELECT chocolate FROM lindt_store;\n")
        updated_create_table_as = sql_lab_utils.create_table_as(
            create_table_as, "tmp")
        self.assertEqual(create_table_as, updated_create_table_as)

        sql_procedure = (
            "CREATE PROCEDURE MyMarriage\n                "
            "BrideGroom Male (25) ,\n                "
            "Bride Female(20) AS\n                "
            "BEGIN\n                "
            "SELECT Bride FROM ukraine_ Brides\n                "
            "WHERE\n                  "
            "FatherInLaw = 'Millionaire' AND Count(Car) > 20\n"
            "                  AND HouseStatus ='ThreeStoreyed'\n"
            "                  AND BrideEduStatus IN "
            "(B.TECH ,BE ,Degree ,MCA ,MiBA)\n                  "
            "AND Having Brothers= Null AND Sisters =Null"
        )
        updated_sql_procedure = sql_lab_utils.create_table_as(sql_procedure, "tmp")
        self.assertEqual(sql_procedure, updated_sql_procedure)

        multiple_statements = """
          DROP HUSBAND;
          SELECT * FROM politicians WHERE clue > 0;
          INSERT INTO MyCarShed VALUES('BUGATTI');
          SELECT standard_disclaimer, witty_remark FROM company_requirements;
          select count(*) from developer_brain;
        """
        updated_multiple_statements = sql_lab_utils.create_table_as(
            multiple_statements, "tmp")
        self.assertEqual(multiple_statements, updated_multiple_statements)


class CeleryTestCase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CeleryTestCase, self).__init__(*args, **kwargs)
        self.client = app.test_client()

    def get_query_by_name(self, sql):
        session = db.create_scoped_session()
        query = session.query(models.Query).filter_by(sql=sql).first()
        session.close()
        return query

    def get_query_by_id(self, id):
        session = db.create_scoped_session()
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

        utils.init(caravel)

        worker_command = BASE_DIR + '/bin/caravel worker'
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
            "ps auxww | grep 'caravel worker' | awk '{print $2}' | "
            "xargs kill -9",
            shell=True
        )

    def setUp(self):
        pass

    def tearDown(self):
        pass

    def login(self, username='admin', password='general'):
        resp = self.client.post(
            '/login/',
            data=dict(username=username, password=password),
            follow_redirects=True)
        assert 'Welcome' in resp.data.decode('utf-8')

    def logout(self):
        self.client.get('/logout/', follow_redirects=True)

    def run_sql(self, dbid, sql, cta='False', tmp_table='tmp',
                async='False'):
        self.login()
        resp = self.client.post(
            '/caravel/sql_json/',
            data=dict(
                database_id=dbid,
                sql=sql,
                async=async,
                select_as_cta=cta,
                tmp_table_name=tmp_table,
            ),
        )
        self.logout()
        return json.loads(resp.data.decode('utf-8'))

    def test_add_limit_to_the_query(self):
        query_session = sql_lab_utils.create_scoped_session()
        db_to_query = query_session.query(models.Database).filter_by(
            id=1).first()
        eng = db_to_query.get_sqla_engine()

        select_query = "SELECT * FROM outer_space;"
        updated_select_query = sql_lab_utils.add_limit_to_the_sql(
            select_query, 100, eng)
        # Different DB engines have their own spacing while compiling
        # the queries, that's why ' '.join(query.split()) is used.
        # In addition some of the engines do not include OFFSET 0.
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM outer_space;) AS inner_qry "
            "LIMIT 100" in ' '.join(updated_select_query.split())
        )

        select_query_no_semicolon = "SELECT * FROM outer_space"
        updated_select_query_no_semicolon = sql_lab_utils.add_limit_to_the_sql(
            select_query_no_semicolon, 100, eng)
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM outer_space) AS inner_qry "
            "LIMIT 100" in
            ' '.join(updated_select_query_no_semicolon.split())
        )

        incorrect_query = "SMTH WRONG SELECT * FROM outer_space"
        updated_incorrect_query = sql_lab_utils.add_limit_to_the_sql(
            incorrect_query, 100, eng)
        self.assertEqual(incorrect_query, updated_incorrect_query)

        insert_query = "INSERT INTO stomach VALUES (beer, chips);"
        updated_insert_query = sql_lab_utils.add_limit_to_the_sql(
            insert_query, 100, eng)
        self.assertEqual(insert_query, updated_insert_query)

        multi_line_query = (
            "SELECT * FROM planets WHERE\n Luke_Father = 'Darth Vader';"
        )
        updated_multi_line_query = sql_lab_utils.add_limit_to_the_sql(
            multi_line_query, 100, eng)
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM planets WHERE "
            "Luke_Father = 'Darth Vader';) AS inner_qry LIMIT 100" in
            ' '.join(updated_multi_line_query.split())
        )

        delete_query = "DELETE FROM planet WHERE name = 'Earth'"
        updated_delete_query = sql_lab_utils.add_limit_to_the_sql(
            delete_query, 100, eng)
        self.assertEqual(delete_query, updated_delete_query)

        create_table_as = (
            "CREATE TABLE pleasure AS SELECT chocolate FROM lindt_store;\n")
        updated_create_table_as = sql_lab_utils.add_limit_to_the_sql(
            create_table_as, 100, eng)
        self.assertEqual(create_table_as, updated_create_table_as)

        sql_procedure = (
            "CREATE PROCEDURE MyMarriage\n                "
            "BrideGroom Male (25) ,\n                "
            "Bride Female(20) AS\n                "
            "BEGIN\n                "
            "SELECT Bride FROM ukraine_ Brides\n                "
            "WHERE\n                  "
            "FatherInLaw = 'Millionaire' AND Count(Car) > 20\n"
            "                  AND HouseStatus ='ThreeStoreyed'\n"
            "                  AND BrideEduStatus IN "
            "(B.TECH ,BE ,Degree ,MCA ,MiBA)\n                  "
            "AND Having Brothers= Null AND Sisters = Null"
        )
        updated_sql_procedure = sql_lab_utils.add_limit_to_the_sql(
            sql_procedure, 100, eng)
        self.assertEqual(sql_procedure, updated_sql_procedure)

    def test_run_sync_query(self):
        main_db = db.session.query(models.Database).filter_by(
            database_name="main").first()
        eng = main_db.get_sqla_engine()

        # Case 1.
        # DB #0 doesn't exist.
        sql_dont_exist = 'SELECT * FROM dontexist'
        result1 = self.run_sql(0, sql_dont_exist, cta='True')
        self.assertEqual(models.QueryStatus.FAILED, result1[u'status'])
        self.assertFalse(u'query_id' in result1)
        self.assertEqual('Database with id 0 is missing.', result1['error'])
        self.assertIsNone(self.get_query_by_name(sql_dont_exist))

        # Case 2.
        # Table doesn't exist.
        result2 = self.run_sql(1, sql_dont_exist, cta='True', )
        self.assertTrue('error' in result2)
        self.assertEqual(models.QueryStatus.FAILED, result1[u'status'])
        query2 = self.get_query_by_id(result2[u'query_id'])
        self.assertEqual(models.QueryStatus.FAILED, query2.status)

        # Case 3.
        # Table and DB exists, CTA call to the backend.
        sql_where = "SELECT name FROM ab_permission WHERE name='can_sql'"
        result3 = self.run_sql(
            1, sql_where, tmp_table='tmp_table_3', cta='True')
        self.assertEqual(models.QueryStatus.FINISHED, result3[u'status'])
        self.assertIsNone(result3[u'data'])
        self.assertIsNone(result3[u'columns'])
        query3 = self.get_query_by_id(result3[u'query_id'])

        # Check the data in the tmp table.
        df3 = pd.read_sql_query(sql=query3.select_sql, con=eng)
        data3 = df3.to_dict(orient='records')
        self.assertEqual([{'name': 'can_sql'}], data3)

        # Case 4.
        # Table and DB exists, CTA call to the backend, no data.
        sql_empty_result = 'SELECT * FROM ab_user WHERE id=666'
        result4 = self.run_sql(
            1, sql_empty_result, tmp_table='tmp_table_4', cta='True',)
        self.assertEqual(models.QueryStatus.FINISHED, result4[u'status'])
        self.assertIsNone(result4[u'data'])
        self.assertIsNone(result4[u'columns'])

        query4 = self.get_query_by_id(result4[u'query_id'])
        self.assertEqual(models.QueryStatus.FINISHED, query4.status)
        self.assertTrue("SELECT * \nFROM tmp_table_4" in query4.select_sql)
        self.assertTrue("LIMIT 666" in query4.select_sql)
        self.assertEqual(
            "CREATE TABLE tmp_table_4 AS SELECT * FROM ab_user WHERE id=666",
            query4.executed_sql)
        self.assertEqual("SELECT * FROM ab_user WHERE id=666", query4.sql)
        if eng.name != 'sqlite':
            self.assertEqual(0, query4.rows)
        self.assertEqual(666, query4.limit)
        self.assertEqual(False, query4.limit_used)
        self.assertEqual(True, query4.select_as_cta)
        self.assertEqual(True, query4.select_as_cta_used)

        # Check the data in the tmp table.
        df4 = pd.read_sql_query(sql=query4.select_sql, con=eng)
        data4 = df4.to_dict(orient='records')
        self.assertEqual([], data4)

        # Case 5.
        # Table and DB exists, select without CTA.
        result5 = self.run_sql(1, sql_where, tmp_table='tmp_table_5')
        self.assertEqual(models.QueryStatus.FINISHED, result5[u'status'])
        self.assertEqual([u'name'], result5[u'columns'])
        self.assertEqual([{u'name': u'can_sql'}], result5[u'data'])

        query5 = self.get_query_by_id(result5[u'query_id'])
        self.assertEqual(sql_where, query5.sql)
        if eng.name != 'sqlite':
            self.assertEqual(1, query5.rows)
        self.assertEqual(666, query5.limit)
        self.assertEqual(True, query5.limit_used)
        self.assertEqual(False, query5.select_as_cta)
        self.assertEqual(False, query5.select_as_cta_used)

    def test_run_async_query(self):
        main_db = db.session.query(models.Database).filter_by(
            database_name="main").first()
        eng = main_db.get_sqla_engine()

        # Schedule queries

        # Case 1.
        # Table and DB exists, async CTA call to the backend.
        sql_where = "SELECT name FROM ab_role WHERE name='Admin'"
        result1 = self.run_sql(
            1, sql_where, async='True', tmp_table='tmp_async_1', cta='True')
        self.assertEqual(models.QueryStatus.SCHEDULED, result1[u'status'])

        # Case 2.
        # Table and DB exists, async insert query, no CTAs.
        insert_query = "INSERT INTO ab_role VALUES (9, 'fake_role')"
        result2 = self.run_sql(1, insert_query, async='True')
        self.assertEqual(models.QueryStatus.SCHEDULED, result2[u'status'])

        time.sleep(2)

        # Case 1.
        query1 = self.get_query_by_id(result1[u'query_id'])
        df1 = pd.read_sql_query(query1.select_sql, con=eng)
        self.assertEqual(models.QueryStatus.FINISHED, query1.status)
        self.assertEqual([{'name': 'Admin'}], df1.to_dict(orient='records'))
        self.assertEqual(models.QueryStatus.FINISHED, query1.status)
        self.assertTrue("SELECT * \nFROM tmp_async_1" in query1.select_sql)
        self.assertTrue("LIMIT 666" in query1.select_sql)
        self.assertEqual(
            "CREATE TABLE tmp_async_1 AS SELECT name FROM ab_role "
            "WHERE name='Admin'", query1.executed_sql)
        self.assertEqual(sql_where, query1.sql)
        if eng.name != 'sqlite':
            self.assertEqual(1, query1.rows)
        self.assertEqual(666, query1.limit)
        self.assertEqual(False, query1.limit_used)
        self.assertEqual(True, query1.select_as_cta)
        self.assertEqual(True, query1.select_as_cta_used)

        # Case 2.
        query2 = self.get_query_by_id(result2[u'query_id'])
        self.assertEqual(models.QueryStatus.FINISHED, query2.status)
        self.assertIsNone(query2.select_sql)
        self.assertEqual(insert_query, query2.executed_sql)
        self.assertEqual(insert_query, query2.sql)
        if eng.name != 'sqlite':
            self.assertEqual(1, query2.rows)
        self.assertEqual(666, query2.limit)
        self.assertEqual(False, query2.limit_used)
        self.assertEqual(False, query2.select_as_cta)
        self.assertEqual(False, query2.select_as_cta_used)


if __name__ == '__main__':
    unittest.main()
