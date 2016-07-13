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
from caravel import app, utils, appbuilder, tasks


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
        worker_command = BASE_DIR + "/bin/caravel worker"
        subprocess.Popen(
            worker_command, shell=True, stdout=subprocess.PIPE)
        cli.load_examples(load_test_data=True)


    @classmethod
    def tearDownClass(cls):
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
        celery_task = tasks.get_sql_results.delay(0, "SELECT * FROM dontexist")
        self.assertRaises(AttributeError, celery_task.get)

        result1 = tasks.get_sql_results.delay(
            1, "SELECT * FROM dontexist").get()
        expected_result1 = (
            '{"msg": "(sqlite3.OperationalError) no such table: dontexist"}')
        self.assertEqual(expected_result1, result1)

        result2 = tasks.get_sql_results.delay(
            1, "SELECT * FROM ab_permission WHERE name='can_select_star'").get()
        expected_result2 = (
            '{"data": [{"id": 20, "name": "can_select_star"}], "columns":'
            ' ["id", "name"]}')
        self.assertEqual(expected_result2, result2)

        result3 = tasks.get_sql_results.delay(
            1, "SELECT * FROM ab_permission WHERE id=666").get()
        expected_result3 = '{"data": [], "columns": ["id", "name"]}'
        self.assertEqual(expected_result3, result3)

    def test_run_async_query_delay(self):
        celery_task1 = tasks.get_sql_results.delay(0, "SELECT * FROM dontexist")
        celery_task2 = tasks.get_sql_results.delay(
            1, "SELECT * FROM dontexist")
        celery_task3 = tasks.get_sql_results.delay(
            1, "SELECT * FROM ab_permission WHERE name='can_select_star'")
        celery_task4 = tasks.get_sql_results.delay(
            1, "SELECT * FROM ab_permission WHERE id=666")

        time.sleep(1)

        # DB #0 doesn't exist.
        self.assertRaises(AttributeError, celery_task1.get)

        expected_result2 = (
            '{"msg": "(sqlite3.OperationalError) no such table: dontexist"}')
        self.assertEqual(expected_result2, celery_task2.get())

        expected_result3 = (
            '{"data": [{"id": 20, "name": "can_select_star"}], "columns":'
            ' ["id", "name"]}')
        self.assertEqual(expected_result3, celery_task3.get())

        expected_result4 = '{"data": [], "columns": ["id", "name"]}'
        self.assertEqual(expected_result4, celery_task4.get())


if __name__ == '__main__':
    unittest.main()