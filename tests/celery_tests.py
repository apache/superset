"""Unit tests for Caravel Celery worker"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
import imp
import subprocess
import os
os.environ['CARAVEL_CONFIG'] = 'tests.caravel_test_config'

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

BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/caravel")


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

        worker_command = BASE_DIR + "/bin/caravel worker"
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

    def test_run_async_query_delay_get(self):
        # DB #0 doesn't exist.
        result1 = tasks.get_sql_results.delay(
            0, "SELECT * FROM dontexist", 1).get()
        expected_result1 = (
            '{"msg": "Database with id 0 is missing."}')
        self.assertEqual(expected_result1, result1)
        session1 = db.create_scoped_session()
        query1 = session1.query(models.Query).filter_by(
            query_text="SELECT * FROM dontexist").first()
        session1.close()
        self.assertIsNone(query1)

        session2 = db.create_scoped_session()
        query2 = session2.query(models.Query).filter_by(
            query_text="SELECT * FROM dontexist1").first()
        self.assertEqual(models.QueryStatus.FAILED, query2.query_status)
        session2.close()

        result2 = tasks.get_sql_results.delay(
            1, "SELECT * FROM dontexist1", 1).get()
        print("blabla")
        print(result2)
        expected_result2 = (
            '{"msg": "(sqlite3.OperationalError) no such table: dontexist1"}')
        self.assertEqual(expected_result2, result2)
        session2 = db.create_scoped_session()
        query2 = session2.query(models.Query).filter_by(
            query_text="SELECT * FROM dontexist1").first()
        self.assertEqual(models.QueryStatus.FAILED, query2.query_status)
        session2.close()

        result3 = tasks.get_sql_results.delay(
            1, "SELECT name FROM ab_permission WHERE name='can_select_star'",
            1).get()
        expected_result3 = (
            '{"data": [{"name": "can_select_star"}], "columns": ["name"]}')
        self.assertEqual(expected_result3, result3)
        session3 = db.create_scoped_session()
        query3 = session3.query(models.Query).filter_by(
            query_text=
            "SELECT name FROM ab_permission WHERE name='can_select_star'").first()
        self.assertEqual(models.QueryStatus.FINISHED, query3.query_status)
        session3.close()

        result4 = tasks.get_sql_results.delay(
            1, "SELECT * FROM ab_permission WHERE id=666", 1).get()
        expected_result4 = '{"data": [], "columns": ["id", "name"]}'
        self.assertEqual(expected_result4, result4)
        session4 = db.create_scoped_session()
        query4 = session4.query(models.Query).filter_by(
            query_text="SELECT * FROM ab_permission WHERE id=666").first()
        self.assertEqual(models.QueryStatus.FINISHED, query4.query_status)
        session4.close()

    def test_run_async_query_delay(self):
        celery_task1 = tasks.get_sql_results.delay(
            0, "SELECT * FROM dontexist", 1)
        celery_task2 = tasks.get_sql_results.delay(
            1, "SELECT * FROM dontexist1", 1)
        celery_task3 = tasks.get_sql_results.delay(
            1, "SELECT name FROM ab_permission WHERE name='can_select_star'", 1)
        celery_task4 = tasks.get_sql_results.delay(
            1, "SELECT * FROM ab_permission WHERE id=666", 1)

        time.sleep(2)

        # DB #0 doesn't exist.
        expected_result1 = (
            '{"msg": "Database with id 0 is missing."}')
        self.assertEqual(expected_result1, celery_task1.get())
        session2 = db.create_scoped_session()
        query2 = session2.query(models.Query).filter_by(
            query_text="SELECT * FROM dontexist1").first()
        self.assertEqual(models.QueryStatus.FAILED, query2.query_status)
        expected_result2 = (
            '{"msg": "(sqlite3.OperationalError) no such table: dontexist1"}')
        self.assertEqual(expected_result2, celery_task2.get())
        expected_result3 = (
            '{"data": [{"name": "can_select_star"}], "columns": ["name"]}')
        self.assertEqual(expected_result3, celery_task3.get())
        expected_result4 = '{"data": [], "columns": ["id", "name"]}'
        self.assertEqual(expected_result4, celery_task4.get())

        session = db.create_scoped_session()
        query1 = session.query(models.Query).filter_by(
            query_text="SELECT * FROM dontexist").first()
        self.assertIsNone(query1)
        query2 = session.query(models.Query).filter_by(
            query_text="SELECT * FROM dontexist1").first()
        self.assertEqual(models.QueryStatus.FAILED, query2.query_status)
        query3 = session.query(models.Query).filter_by(
            query_text=
            "SELECT name FROM ab_permission WHERE name='can_select_star'").first()
        self.assertEqual(models.QueryStatus.FINISHED, query3.query_status)
        query4 = session.query(models.Query).filter_by(
            query_text="SELECT * FROM ab_permission WHERE id=666").first()
        self.assertEqual(models.QueryStatus.FINISHED, query4.query_status)
        session.close()


if __name__ == '__main__':
    unittest.main()