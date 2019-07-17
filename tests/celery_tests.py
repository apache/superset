# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Unit tests for Superset Celery worker"""
import json
import subprocess
import time
import unittest

from superset import app, db
from superset.models.helpers import QueryStatus
from superset.models.sql_lab import Query
from superset.sql_parse import ParsedQuery
from superset.utils.core import get_main_database
from .base_tests import SupersetTestCase


BASE_DIR = app.config.get("BASE_DIR")
CELERY_SLEEP_TIME = 5


class CeleryConfig(object):
    BROKER_URL = app.config.get("CELERY_RESULT_BACKEND")
    CELERY_IMPORTS = ("superset.sql_lab",)
    CELERY_ANNOTATIONS = {"sql_lab.add": {"rate_limit": "10/s"}}
    CONCURRENCY = 1


app.config["CELERY_CONFIG"] = CeleryConfig


class UtilityFunctionTests(SupersetTestCase):

    # TODO(bkyryliuk): support more cases in CTA function.
    def test_create_table_as(self):
        q = ParsedQuery("SELECT * FROM outer_space;")

        self.assertEqual(
            "CREATE TABLE tmp AS \nSELECT * FROM outer_space", q.as_create_table("tmp")
        )

        self.assertEqual(
            "DROP TABLE IF EXISTS tmp;\n"
            "CREATE TABLE tmp AS \nSELECT * FROM outer_space",
            q.as_create_table("tmp", overwrite=True),
        )

        # now without a semicolon
        q = ParsedQuery("SELECT * FROM outer_space")
        self.assertEqual(
            "CREATE TABLE tmp AS \nSELECT * FROM outer_space", q.as_create_table("tmp")
        )

        # now a multi-line query
        multi_line_query = "SELECT * FROM planets WHERE\n" "Luke_Father = 'Darth Vader'"
        q = ParsedQuery(multi_line_query)
        self.assertEqual(
            "CREATE TABLE tmp AS \nSELECT * FROM planets WHERE\n"
            "Luke_Father = 'Darth Vader'",
            q.as_create_table("tmp"),
        )


class CeleryTestCase(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(CeleryTestCase, self).__init__(*args, **kwargs)
        self.client = app.test_client()

    def get_query_by_name(self, sql):
        session = db.session
        query = session.query(Query).filter_by(sql=sql).first()
        session.close()
        return query

    def get_query_by_id(self, id):
        session = db.session
        query = session.query(Query).filter_by(id=id).first()
        session.close()
        return query

    @classmethod
    def setUpClass(cls):
        db.session.query(Query).delete()
        db.session.commit()

        worker_command = BASE_DIR + "/bin/superset worker -w 2"
        subprocess.Popen(worker_command, shell=True, stdout=subprocess.PIPE)

    @classmethod
    def tearDownClass(cls):
        subprocess.call(
            "ps auxww | grep 'celeryd' | awk '{print $2}' | xargs kill -9", shell=True
        )
        subprocess.call(
            "ps auxww | grep 'superset worker' | awk '{print $2}' | xargs kill -9",
            shell=True,
        )

    def run_sql(
        self, db_id, sql, client_id=None, cta="false", tmp_table="tmp", async_="false"
    ):
        self.login()
        resp = self.client.post(
            "/superset/sql_json/",
            data=dict(
                database_id=db_id,
                sql=sql,
                runAsync=async_,
                select_as_cta=cta,
                tmp_table_name=tmp_table,
                client_id=client_id,
            ),
        )
        self.logout()
        return json.loads(resp.data)

    def test_run_sync_query_dont_exist(self):
        main_db = get_main_database()
        db_id = main_db.id
        sql_dont_exist = "SELECT name FROM table_dont_exist"
        result1 = self.run_sql(db_id, sql_dont_exist, "1", cta="true")
        self.assertTrue("error" in result1)

    def test_run_sync_query_cta(self):
        main_db = get_main_database()
        backend = main_db.backend
        db_id = main_db.id
        tmp_table_name = "tmp_async_22"
        self.drop_table_if_exists(tmp_table_name, main_db)
        perm_name = "can_sql_json"
        sql_where = "SELECT name FROM ab_permission WHERE name='{}'".format(perm_name)
        result = self.run_sql(
            db_id, sql_where, "2", tmp_table=tmp_table_name, cta="true"
        )
        self.assertEqual(QueryStatus.SUCCESS, result["query"]["state"])
        self.assertEqual([], result["data"])
        self.assertEqual([], result["columns"])
        query2 = self.get_query_by_id(result["query"]["serverId"])

        # Check the data in the tmp table.
        if backend != "postgresql":
            # TODO This test won't work in Postgres
            results = self.run_sql(db_id, query2.select_sql, "sdf2134")
            self.assertEquals(results["status"], "success")
            self.assertGreater(len(results["data"]), 0)

    def test_run_sync_query_cta_no_data(self):
        main_db = get_main_database()
        db_id = main_db.id
        sql_empty_result = "SELECT * FROM ab_user WHERE id=666"
        result3 = self.run_sql(db_id, sql_empty_result, "3")
        self.assertEqual(QueryStatus.SUCCESS, result3["query"]["state"])
        self.assertEqual([], result3["data"])
        self.assertEqual([], result3["columns"])

        query3 = self.get_query_by_id(result3["query"]["serverId"])
        self.assertEqual(QueryStatus.SUCCESS, query3.status)

    def drop_table_if_exists(self, table_name, database=None):
        """Drop table if it exists, works on any DB"""
        sql = "DROP TABLE {}".format(table_name)
        db_id = database.id
        if database:
            database.allow_dml = True
            db.session.flush()
        return self.run_sql(db_id, sql)

    def test_run_async_query(self):
        main_db = get_main_database()
        db_id = main_db.id

        self.drop_table_if_exists("tmp_async_1", main_db)

        sql_where = "SELECT name FROM ab_role WHERE name='Admin'"
        result = self.run_sql(
            db_id, sql_where, "4", async_="true", tmp_table="tmp_async_1", cta="true"
        )
        assert result["query"]["state"] in (
            QueryStatus.PENDING,
            QueryStatus.RUNNING,
            QueryStatus.SUCCESS,
        )

        time.sleep(CELERY_SLEEP_TIME)

        query = self.get_query_by_id(result["query"]["serverId"])
        self.assertEqual(QueryStatus.SUCCESS, query.status)
        self.assertTrue("FROM tmp_async_1" in query.select_sql)
        self.assertEqual(
            "CREATE TABLE tmp_async_1 AS \n"
            "SELECT name FROM ab_role "
            "WHERE name='Admin'\n"
            "LIMIT 666",
            query.executed_sql,
        )
        self.assertEqual(sql_where, query.sql)
        self.assertEqual(0, query.rows)
        self.assertEqual(True, query.select_as_cta)
        self.assertEqual(True, query.select_as_cta_used)

    def test_run_async_query_with_lower_limit(self):
        main_db = get_main_database()
        db_id = main_db.id
        self.drop_table_if_exists("tmp_async_2", main_db)

        sql_where = "SELECT name FROM ab_role WHERE name='Alpha' LIMIT 1"
        result = self.run_sql(
            db_id, sql_where, "5", async_="true", tmp_table="tmp_async_2", cta="true"
        )
        assert result["query"]["state"] in (
            QueryStatus.PENDING,
            QueryStatus.RUNNING,
            QueryStatus.SUCCESS,
        )

        time.sleep(CELERY_SLEEP_TIME)

        query = self.get_query_by_id(result["query"]["serverId"])
        self.assertEqual(QueryStatus.SUCCESS, query.status)
        self.assertTrue("FROM tmp_async_2" in query.select_sql)
        self.assertEqual(
            "CREATE TABLE tmp_async_2 AS \nSELECT name FROM ab_role "
            "WHERE name='Alpha' LIMIT 1",
            query.executed_sql,
        )
        self.assertEqual(sql_where, query.sql)
        self.assertEqual(0, query.rows)
        self.assertEqual(1, query.limit)
        self.assertEqual(True, query.select_as_cta)
        self.assertEqual(True, query.select_as_cta_used)

    @staticmethod
    def de_unicode_dict(d):
        def str_if_basestring(o):
            if isinstance(o, str):
                return str(o)
            return o

        return {str_if_basestring(k): str_if_basestring(d[k]) for k in d}

    @classmethod
    def dictify_list_of_dicts(cls, l, k):
        return {str(o[k]): cls.de_unicode_dict(o) for o in l}


if __name__ == "__main__":
    unittest.main()
