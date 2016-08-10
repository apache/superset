"""Unit tests for Caravel Celery worker"""
import datetime
import imp
import subprocess
import os
import pandas as pd
import time
import unittest

import caravel
from caravel import app, appbuilder, db, models, tasks, utils


class CeleryConfig(object):
    BROKER_URL = 'sqla+sqlite:////tmp/celerydb.sqlite'
    CELERY_IMPORTS = ('caravel.tasks',)
    CELERY_RESULT_BACKEND = 'db+sqlite:////tmp/celery_results.sqlite'
    CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
app.config['CELERY_CONFIG'] = CeleryConfig

BASE_DIR = app.config.get('BASE_DIR')
cli = imp.load_source('cli', BASE_DIR + '/bin/caravel')


class UtilityFunctionTests(unittest.TestCase):
    def test_create_table_as(self):
        select_query = "SELECT * FROM outer_space;"
        updated_select_query = tasks.create_table_as(select_query, "tmp")
        self.assertEqual(
            "CREATE TABLE tmp AS SELECT * FROM outer_space;",
            updated_select_query)

        updated_select_query_with_drop = tasks.create_table_as(
            select_query, "tmp", override=True)
        self.assertEqual(
            "DROP TABLE IF EXISTS tmp;\n"
            "CREATE TABLE tmp AS SELECT * FROM outer_space;",
            updated_select_query_with_drop)

        select_query_no_semicolon = "SELECT * FROM outer_space"
        updated_select_query_no_semicolon = tasks.create_table_as(
            select_query_no_semicolon, "tmp")
        self.assertEqual(
            "CREATE TABLE tmp AS SELECT * FROM outer_space",
            updated_select_query_no_semicolon)

        incorrect_query = "SMTH WRONG SELECT * FROM outer_space"
        updated_incorrect_query = tasks.create_table_as(incorrect_query, "tmp")
        self.assertEqual(incorrect_query, updated_incorrect_query)

        insert_query = "INSERT INTO stomach VALUES (beer, chips);"
        updated_insert_query = tasks.create_table_as(insert_query, "tmp")
        self.assertEqual(insert_query, updated_insert_query)

        multi_line_query = (
            "SELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader';")
        updated_multi_line_query = tasks.create_table_as(
            multi_line_query, "tmp")
        expected_updated_multi_line_query = (
            "CREATE TABLE tmp AS SELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader';")
        self.assertEqual(
            expected_updated_multi_line_query,
            updated_multi_line_query)

        updated_multi_line_query_with_drop = tasks.create_table_as(
            multi_line_query, "tmp", override=True)
        expected_updated_multi_line_query_with_drop = (
            "DROP TABLE IF EXISTS tmp;\n"
            "CREATE TABLE tmp AS SELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader';")
        self.assertEqual(
            expected_updated_multi_line_query_with_drop,
            updated_multi_line_query_with_drop)

        delete_query = "DELETE FROM planet WHERE name = 'Earth'"
        updated_delete_query = tasks.create_table_as(delete_query, "tmp")
        self.assertEqual(delete_query, updated_delete_query)

        create_table_as = (
            "CREATE TABLE pleasure AS SELECT chocolate FROM lindt_store;\n")
        updated_create_table_as = tasks.create_table_as(
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
        updated_sql_procedure = tasks.create_table_as(sql_procedure, "tmp")
        self.assertEqual(sql_procedure, updated_sql_procedure)

        multiple_statements = """
          DROP HUSBAND;
          SELECT * FROM politicians WHERE clue > 0;
          INSERT INTO MyCarShed VALUES('BUGATTI');
          SELECT standard_disclaimer, witty_remark FROM company_requirements;
          select count(*) from developer_brain;
        """
        updated_multiple_statements = tasks.create_table_as(
            multiple_statements, "tmp")
        self.assertEqual(multiple_statements, updated_multiple_statements)


class CeleryTestCase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CeleryTestCase, self).__init__(*args, **kwargs)
        self.client = app.test_client()
        utils.init(caravel)
        admin = appbuilder.sm.find_user('admin')
        if not admin:
            appbuilder.sm.add_user(
                'admin', 'admin', ' user', 'admin@fab.org',
                appbuilder.sm.find_role('Admin'),
                password='general')
        utils.init(caravel)

    @classmethod
    def setUpClass(cls):
        try:
            os.remove(app.config.get('SQL_CELERY_DB_FILE_PATH'))
        except OSError:
            pass
        try:
            os.remove(app.config.get('SQL_CELERY_RESULTS_DB_FILE_PATH'))
        except OSError:
            pass

        worker_command = BASE_DIR + '/bin/caravel worker'
        subprocess.Popen(
            worker_command, shell=True, stdout=subprocess.PIPE)
        cli.load_examples(load_test_data=True)

    @classmethod
    def tearDownClass(cls):
        subprocess.call(
            "ps auxww | grep 'celeryd' | awk '{print $2}' | "
            "xargs kill -9",
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

    def test_add_limit_to_the_query(self):
        query_session = tasks.get_session()
        db_to_query = query_session.query(models.Database).filter_by(
            id=1).first()
        eng = db_to_query.get_sqla_engine()

        select_query = "SELECT * FROM outer_space;"
        updated_select_query = tasks.add_limit_to_the_query(
            select_query, 100, eng)
        # Different DB engines have their own spacing while compiling
        # the queries, that's why ' '.join(query.split()) is used.
        # In addition some of the engines do not include OFFSET 0.
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM outer_space;) AS inner_qry "
            "LIMIT 100" in ' '.join(updated_select_query.split())
        )

        select_query_no_semicolon = "SELECT * FROM outer_space"
        updated_select_query_no_semicolon = tasks.add_limit_to_the_query(
            select_query_no_semicolon, 100, eng)
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM outer_space) AS inner_qry "
            "LIMIT 100" in
            ' '.join(updated_select_query_no_semicolon.split())
        )

        incorrect_query = "SMTH WRONG SELECT * FROM outer_space"
        updated_incorrect_query = tasks.add_limit_to_the_query(
            incorrect_query, 100, eng)
        self.assertEqual(incorrect_query, updated_incorrect_query)

        insert_query = "INSERT INTO stomach VALUES (beer, chips);"
        updated_insert_query = tasks.add_limit_to_the_query(
            insert_query, 100, eng)
        self.assertEqual(insert_query, updated_insert_query)

        multi_line_query = (
            "SELECT * FROM planets WHERE\n Luke_Father = 'Darth Vader';"
        )
        updated_multi_line_query = tasks.add_limit_to_the_query(
            multi_line_query, 100, eng)
        self.assertTrue(
            "SELECT * FROM (SELECT * FROM planets WHERE "
            "Luke_Father = 'Darth Vader';) AS inner_qry LIMIT 100" in
            ' '.join(updated_multi_line_query.split())
        )

        delete_query = "DELETE FROM planet WHERE name = 'Earth'"
        updated_delete_query = tasks.add_limit_to_the_query(
            delete_query, 100, eng)
        self.assertEqual(delete_query, updated_delete_query)

        create_table_as = (
            "CREATE TABLE pleasure AS SELECT chocolate FROM lindt_store;\n")
        updated_create_table_as = tasks.add_limit_to_the_query(
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
        updated_sql_procedure = tasks.add_limit_to_the_query(
            sql_procedure, 100, eng)
        self.assertEqual(sql_procedure, updated_sql_procedure)

    def test_run_async_query_delay_get(self):
        main_db = db.session.query(models.Database).filter_by(
            database_name="main").first()
        eng = main_db.get_sqla_engine()

        # Case 1.
        # DB #0 doesn't exist.
        result1 = tasks.get_sql_results.delay(
            0, 'SELECT * FROM dontexist', 1, tmp_table_name='tmp_1_1').get()
        expected_result1 = {
            'error': 'Database with id 0 is missing.',
            'success': False
        }
        self.assertEqual(
            sorted(expected_result1.items()),
            sorted(result1.items())
        )
        session1 = db.create_scoped_session()
        query1 = session1.query(models.Query).filter_by(
            sql='SELECT * FROM dontexist').first()
        session1.close()
        self.assertIsNone(query1)

        # Case 2.
        session2 = db.create_scoped_session()
        query2 = session2.query(models.Query).filter_by(
            sql='SELECT * FROM dontexist1').first()
        self.assertEqual(models.QueryStatus.FAILED, query2.status)
        session2.close()

        result2 = tasks.get_sql_results.delay(
            1, 'SELECT * FROM dontexist1', 1, tmp_table_name='tmp_2_1').get()
        self.assertTrue('error' in result2)
        session2 = db.create_scoped_session()
        query2 = session2.query(models.Query).filter_by(
            sql='SELECT * FROM dontexist1').first()
        self.assertEqual(models.QueryStatus.FAILED, query2.status)
        session2.close()

        # Case 3.
        where_query = (
            "SELECT name FROM ab_permission WHERE name='can_select_star'")
        result3 = tasks.get_sql_results.delay(
            1, where_query, 1, tmp_table_name='tmp_3_1').get()
        expected_result3 = {
            'tmp_table': 'tmp_3_1',
            'success': True
        }
        self.assertEqual(
            sorted(expected_result3.items()),
            sorted(result3.items())
        )
        session3 = db.create_scoped_session()
        query3 = session3.query(models.Query).filter_by(
            sql=where_query).first()
        session3.close()
        df3 = pd.read_sql_query(sql="SELECT * FROM tmp_3_1", con=eng)
        data3 = df3.to_dict(orient='records')
        self.assertEqual(models.QueryStatus.FINISHED, query3.status)
        self.assertEqual([{'name': 'can_select_star'}], data3)

        # Case 4.
        result4 = tasks.get_sql_results.delay(
            1, 'SELECT * FROM ab_permission WHERE id=666', 1,
            tmp_table_name='tmp_4_1').get()
        expected_result4 = {
            'tmp_table': 'tmp_4_1',
            'success': True
        }
        self.assertEqual(
            sorted(expected_result4.items()),
            sorted(result4.items())
        )
        session4 = db.create_scoped_session()
        query4 = session4.query(models.Query).filter_by(
            sql='SELECT * FROM ab_permission WHERE id=666').first()
        session4.close()
        df4 = pd.read_sql_query(sql="SELECT * FROM tmp_4_1", con=eng)
        data4 = df4.to_dict(orient='records')
        self.assertEqual(models.QueryStatus.FINISHED, query4.status)
        self.assertEqual([], data4)

        # Case 5.
        # Return the data directly if DB select_as_create_table_as is False.
        main_db.select_as_create_table_as = False
        db.session.commit()
        result5 = tasks.get_sql_results.delay(
            1, where_query, 1, tmp_table_name='tmp_5_1').get()
        expected_result5 = {
            'columns': ['name'],
            'data': [{'name': 'can_select_star'}],
            'success': True
        }
        self.assertEqual(
            sorted(expected_result5.items()),
            sorted(result5.items())
        )

    def test_run_async_query_delay(self):
        celery_task1 = tasks.get_sql_results.delay(
            0, 'SELECT * FROM dontexist', 1, tmp_table_name='tmp_1_2')
        celery_task2 = tasks.get_sql_results.delay(
            1, 'SELECT * FROM dontexist1', 1, tmp_table_name='tmp_2_2')
        where_query = (
            "SELECT name FROM ab_permission WHERE name='can_select_star'")
        celery_task3 = tasks.get_sql_results.delay(
            1, where_query, 1, tmp_table_name='tmp_3_2')
        celery_task4 = tasks.get_sql_results.delay(
            1, 'SELECT * FROM ab_permission WHERE id=666', 1,
            tmp_table_name='tmp_4_2')

        time.sleep(1)

        # DB #0 doesn't exist.
        expected_result1 = {
            'error': 'Database with id 0 is missing.',
            'success': False
        }
        self.assertEqual(
            sorted(expected_result1.items()),
            sorted(celery_task1.get().items())
        )
        session2 = db.create_scoped_session()
        query2 = session2.query(models.Query).filter_by(
            sql='SELECT * FROM dontexist1').first()
        self.assertEqual(models.QueryStatus.FAILED, query2.status)
        self.assertTrue('error' in celery_task2.get())
        expected_result3 = {
            'tmp_table': 'tmp_3_2',
            'success': True
        }
        self.assertEqual(
            sorted(expected_result3.items()),
            sorted(celery_task3.get().items())
        )
        expected_result4 = {
            'tmp_table': 'tmp_4_2',
            'success': True
        }
        self.assertEqual(
            sorted(expected_result4.items()),
            sorted(celery_task4.get().items())
        )

        session = db.create_scoped_session()
        query1 = session.query(models.Query).filter_by(
            sql='SELECT * FROM dontexist').first()
        self.assertIsNone(query1)
        query2 = session.query(models.Query).filter_by(
            sql='SELECT * FROM dontexist1').first()
        self.assertEqual(models.QueryStatus.FAILED, query2.status)
        query3 = session.query(models.Query).filter_by(
            sql=where_query).first()
        self.assertEqual(models.QueryStatus.FINISHED, query3.status)
        query4 = session.query(models.Query).filter_by(
            sql='SELECT * FROM ab_permission WHERE id=666').first()
        self.assertEqual(models.QueryStatus.FINISHED, query4.status)
        session.close()


if __name__ == '__main__':
    unittest.main()
