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
# isort:skip_file
"""Unit tests for Superset Celery worker"""
import datetime
import json
from parameterized import parameterized
import subprocess
import time
import unittest
import unittest.mock as mock

import flask
from flask import current_app

from tests.test_app import app
from superset import db, sql_lab
from superset.result_set import SupersetResultSet
from superset.db_engine_specs.base import BaseEngineSpec
from superset.extensions import celery_app
from superset.models.helpers import QueryStatus
from superset.models.sql_lab import Query
from superset.sql_parse import ParsedQuery, CtasMethod
from superset.utils.core import get_example_database

from .base_tests import SupersetTestCase

CELERY_SHORT_SLEEP_TIME = 2
CELERY_SLEEP_TIME = 10
DROP_TABLE_SLEEP_TIME = 10


class TestUtilityFunction(SupersetTestCase):
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


class TestAppContext(SupersetTestCase):
    def test_in_app_context(self):
        @celery_app.task()
        def my_task():
            self.assertTrue(current_app)

        # Make sure we can call tasks with an app already setup
        my_task()

        # Make sure the app gets pushed onto the stack properly
        try:
            popped_app = flask._app_ctx_stack.pop()
            my_task()
        finally:
            flask._app_ctx_stack.push(popped_app)


CTAS_SCHEMA_NAME = "sqllab_test_db"


class TestCelery(SupersetTestCase):
    def get_query_by_name(self, sql):
        query = db.session.query(Query).filter_by(sql=sql).first()
        db.session.close()
        return query

    def get_query_by_id(self, id):
        query = db.session.query(Query).filter_by(id=id).first()
        db.session.close()
        return query

    @classmethod
    def setUpClass(cls):
        with app.app_context():
            db.session.query(Query).delete()
            db.session.commit()

    def run_sql(
        self,
        db_id,
        sql,
        client_id=None,
        cta=False,
        tmp_table="tmp",
        async_=False,
        ctas_method=CtasMethod.TABLE,
    ):
        self.login()
        resp = self.client.post(
            "/superset/sql_json/",
            json=dict(
                database_id=db_id,
                sql=sql,
                runAsync=async_,
                select_as_cta=cta,
                tmp_table_name=tmp_table,
                client_id=client_id,
                ctas_method=ctas_method,
            ),
        )
        self.logout()
        return json.loads(resp.data)

    @parameterized.expand(
        [CtasMethod.TABLE,]
    )
    def test_run_sync_query_dont_exist(self, ctas_method):
        main_db = get_example_database()
        db_id = main_db.id
        sql_dont_exist = "SELECT name FROM table_dont_exist"
        result = self.run_sql(
            db_id, sql_dont_exist, f"1_{ctas_method}", cta=True, ctas_method=ctas_method
        )
        if (
            get_example_database().backend != "sqlite"
            and ctas_method == CtasMethod.VIEW
        ):
            self.assertEqual(QueryStatus.SUCCESS, result["status"], msg=result)
        else:
            self.assertEqual(QueryStatus.FAILED, result["status"], msg=result)

    @parameterized.expand([CtasMethod.TABLE, CtasMethod.VIEW])
    def test_run_sync_query_cta(self, ctas_method):
        main_db = get_example_database()
        db_id = main_db.id
        tmp_table_name = f"tmp_sync_23_{ctas_method.lower()}"
        self.drop_table_if_exists(tmp_table_name, main_db)
        name = "James"
        sql_where = f"SELECT name FROM birth_names WHERE name='{name}' LIMIT 1"
        result = self.run_sql(
            db_id,
            sql_where,
            f"2_{ctas_method}",
            tmp_table=tmp_table_name,
            cta=True,
            ctas_method=ctas_method,
        )
        # provide better error message
        self.assertEqual(QueryStatus.SUCCESS, result["query"]["state"], msg=result)
        self.assertEqual([], result["data"])
        self.assertEqual([], result["columns"])
        query2 = self.get_query_by_id(result["query"]["serverId"])

        # Check the data in the tmp table.
        results = self.run_sql(db_id, query2.select_sql, f"7_{ctas_method}")
        self.assertEqual(QueryStatus.SUCCESS, results["status"], msg=results)
        self.assertGreater(len(results["data"]), 0)

        # cleanup tmp table
        self.drop_table_if_exists(tmp_table_name, get_example_database())

    def test_run_sync_query_cta_no_data(self):
        main_db = get_example_database()
        db_id = main_db.id
        sql_empty_result = "SELECT * FROM birth_names WHERE name='random'"
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

    @parameterized.expand([CtasMethod.TABLE, CtasMethod.VIEW])
    def test_run_sync_query_cta_config(self, ctas_method):
        with mock.patch(
            "superset.views.core.get_cta_schema_name",
            lambda d, u, s, sql: CTAS_SCHEMA_NAME,
        ):
            main_db = get_example_database()
            db_id = main_db.id
            if main_db.backend == "sqlite":
                # sqlite doesn't support schemas
                return
            tmp_table_name = f"tmp_async_22_{ctas_method.lower()}"
            quote = (
                main_db.inspector.engine.dialect.identifier_preparer.quote_identifier
            )
            expected_full_table_name = f"{CTAS_SCHEMA_NAME}.{quote(tmp_table_name)}"
            self.drop_table_if_exists(expected_full_table_name, main_db)
            name = "James"
            sql_where = f"SELECT name FROM birth_names WHERE name='{name}'"
            result = self.run_sql(
                db_id,
                sql_where,
                f"3_{ctas_method}",
                tmp_table=tmp_table_name,
                cta=True,
                ctas_method=ctas_method,
            )

            self.assertEqual(QueryStatus.SUCCESS, result["query"]["state"], msg=result)
            self.assertEqual([], result["data"])
            self.assertEqual([], result["columns"])
            query = self.get_query_by_id(result["query"]["serverId"])
            self.assertEqual(
                f"CREATE {ctas_method} {CTAS_SCHEMA_NAME}.{tmp_table_name} AS \n"
                "SELECT name FROM birth_names "
                "WHERE name='James'",
                query.executed_sql,
            )
            self.assertEqual(
                "SELECT *\n" f"FROM {CTAS_SCHEMA_NAME}.{tmp_table_name}",
                query.select_sql,
            )
            time.sleep(CELERY_SHORT_SLEEP_TIME)
            results = self.run_sql(db_id, query.select_sql)
            self.assertEqual(QueryStatus.SUCCESS, results["status"], msg=result)
            self.drop_table_if_exists(expected_full_table_name, get_example_database())

    @parameterized.expand([CtasMethod.TABLE, CtasMethod.VIEW])
    def test_run_async_query_cta_config(self, ctas_method):
        with mock.patch(
            "superset.views.core.get_cta_schema_name",
            lambda d, u, s, sql: CTAS_SCHEMA_NAME,
        ):
            main_db = get_example_database()
            db_id = main_db.id
            if main_db.backend == "sqlite":
                # sqlite doesn't support schemas
                return
            tmp_table_name = f"sqllab_test_table_async_1_{ctas_method}"
            quote = (
                main_db.inspector.engine.dialect.identifier_preparer.quote_identifier
            )
            expected_full_table_name = f"{CTAS_SCHEMA_NAME}.{quote(tmp_table_name)}"
            self.drop_table_if_exists(expected_full_table_name, main_db)
            sql_where = "SELECT name FROM birth_names WHERE name='James' LIMIT 10"
            result = self.run_sql(
                db_id,
                sql_where,
                f"4_{ctas_method}",
                async_=True,
                tmp_table=tmp_table_name,
                cta=True,
                ctas_method=ctas_method,
            )
            db.session.close()
            time.sleep(CELERY_SLEEP_TIME)

            query = self.get_query_by_id(result["query"]["serverId"])
            self.assertEqual(QueryStatus.SUCCESS, query.status)
            self.assertIn(expected_full_table_name, query.select_sql)
            self.assertEqual(
                f"CREATE {ctas_method} {CTAS_SCHEMA_NAME}.{tmp_table_name} AS \n"
                "SELECT name FROM birth_names "
                "WHERE name='James' "
                "LIMIT 10",
                query.executed_sql,
            )
            self.drop_table_if_exists(expected_full_table_name, get_example_database())

    @parameterized.expand([CtasMethod.TABLE, CtasMethod.VIEW])
    def test_run_async_cta_query(self, ctas_method):
        main_db = get_example_database()
        db_id = main_db.id

        table_name = f"tmp_async_4_{ctas_method}"
        self.drop_table_if_exists(table_name, main_db)
        time.sleep(DROP_TABLE_SLEEP_TIME)

        sql_where = "SELECT name FROM birth_names WHERE name='James' LIMIT 10"
        result = self.run_sql(
            db_id,
            sql_where,
            f"5_{ctas_method}",
            async_=True,
            tmp_table=table_name,
            cta=True,
            ctas_method=ctas_method,
        )
        db.session.close()
        assert result["query"]["state"] in (
            QueryStatus.PENDING,
            QueryStatus.RUNNING,
            QueryStatus.SUCCESS,
        )

        time.sleep(CELERY_SLEEP_TIME)

        query = self.get_query_by_id(result["query"]["serverId"])
        self.assertEqual(QueryStatus.SUCCESS, query.status)

        self.assertIn(table_name, query.select_sql)

        self.assertEqual(
            f"CREATE {ctas_method} {table_name} AS \n"
            "SELECT name FROM birth_names "
            "WHERE name='James' "
            "LIMIT 10",
            query.executed_sql,
        )
        self.assertEqual(sql_where, query.sql)
        self.assertEqual(0, query.rows)
        self.assertEqual(True, query.select_as_cta)
        self.assertEqual(True, query.select_as_cta_used)

    @parameterized.expand([CtasMethod.TABLE, CtasMethod.VIEW])
    def test_run_async_cta_query_with_lower_limit(self, ctas_method):
        main_db = get_example_database()
        db_id = main_db.id
        tmp_table = f"tmp_async_2_{ctas_method}"
        self.drop_table_if_exists(tmp_table, main_db)

        sql_where = "SELECT name FROM birth_names LIMIT 1"
        result = self.run_sql(
            db_id,
            sql_where,
            f"6_{ctas_method}",
            async_=True,
            tmp_table=tmp_table,
            cta=True,
            ctas_method=ctas_method,
        )
        db.session.close()
        assert result["query"]["state"] in (
            QueryStatus.PENDING,
            QueryStatus.RUNNING,
            QueryStatus.SUCCESS,
        )

        time.sleep(CELERY_SLEEP_TIME)

        query = self.get_query_by_id(result["query"]["serverId"])
        self.assertEqual(QueryStatus.SUCCESS, query.status)

        self.assertIn(tmp_table, query.select_sql)
        self.assertEqual(
            f"CREATE {ctas_method} {tmp_table} AS \n"
            "SELECT name FROM birth_names LIMIT 1",
            query.executed_sql,
        )
        self.assertEqual(sql_where, query.sql)
        self.assertEqual(0, query.rows)
        self.assertEqual(None, query.limit)
        self.assertEqual(True, query.select_as_cta)
        self.assertEqual(True, query.select_as_cta_used)

    def test_default_data_serialization(self):
        data = [("a", 4, 4.0, datetime.datetime(2019, 8, 18, 16, 39, 16, 660000))]
        cursor_descr = (
            ("a", "string"),
            ("b", "int"),
            ("c", "float"),
            ("d", "datetime"),
        )
        db_engine_spec = BaseEngineSpec()
        results = SupersetResultSet(data, cursor_descr, db_engine_spec)

        with mock.patch.object(
            db_engine_spec, "expand_data", wraps=db_engine_spec.expand_data
        ) as expand_data:
            (
                data,
                selected_columns,
                all_columns,
                expanded_columns,
            ) = sql_lab._serialize_and_expand_data(results, db_engine_spec, False, True)
            expand_data.assert_called_once()

        self.assertIsInstance(data, list)

    def test_new_data_serialization(self):
        data = [("a", 4, 4.0, datetime.datetime(2019, 8, 18, 16, 39, 16, 660000))]
        cursor_descr = (
            ("a", "string"),
            ("b", "int"),
            ("c", "float"),
            ("d", "datetime"),
        )
        db_engine_spec = BaseEngineSpec()
        results = SupersetResultSet(data, cursor_descr, db_engine_spec)

        with mock.patch.object(
            db_engine_spec, "expand_data", wraps=db_engine_spec.expand_data
        ) as expand_data:
            (
                data,
                selected_columns,
                all_columns,
                expanded_columns,
            ) = sql_lab._serialize_and_expand_data(results, db_engine_spec, True)
            expand_data.assert_not_called()

        self.assertIsInstance(data, bytes)

    def test_default_payload_serialization(self):
        use_new_deserialization = False
        data = [("a", 4, 4.0, datetime.datetime(2019, 8, 18, 16, 39, 16, 660000))]
        cursor_descr = (
            ("a", "string"),
            ("b", "int"),
            ("c", "float"),
            ("d", "datetime"),
        )
        db_engine_spec = BaseEngineSpec()
        results = SupersetResultSet(data, cursor_descr, db_engine_spec)
        query = {
            "database_id": 1,
            "sql": "SELECT * FROM birth_names LIMIT 100",
            "status": QueryStatus.PENDING,
        }
        (
            serialized_data,
            selected_columns,
            all_columns,
            expanded_columns,
        ) = sql_lab._serialize_and_expand_data(
            results, db_engine_spec, use_new_deserialization
        )
        payload = {
            "query_id": 1,
            "status": QueryStatus.SUCCESS,
            "state": QueryStatus.SUCCESS,
            "data": serialized_data,
            "columns": all_columns,
            "selected_columns": selected_columns,
            "expanded_columns": expanded_columns,
            "query": query,
        }

        serialized = sql_lab._serialize_payload(payload, use_new_deserialization)
        self.assertIsInstance(serialized, str)

    def test_msgpack_payload_serialization(self):
        use_new_deserialization = True
        data = [("a", 4, 4.0, datetime.datetime(2019, 8, 18, 16, 39, 16, 660000))]
        cursor_descr = (
            ("a", "string"),
            ("b", "int"),
            ("c", "float"),
            ("d", "datetime"),
        )
        db_engine_spec = BaseEngineSpec()
        results = SupersetResultSet(data, cursor_descr, db_engine_spec)
        query = {
            "database_id": 1,
            "sql": "SELECT * FROM birth_names LIMIT 100",
            "status": QueryStatus.PENDING,
        }
        (
            serialized_data,
            selected_columns,
            all_columns,
            expanded_columns,
        ) = sql_lab._serialize_and_expand_data(
            results, db_engine_spec, use_new_deserialization
        )
        payload = {
            "query_id": 1,
            "status": QueryStatus.SUCCESS,
            "state": QueryStatus.SUCCESS,
            "data": serialized_data,
            "columns": all_columns,
            "selected_columns": selected_columns,
            "expanded_columns": expanded_columns,
            "query": query,
        }

        serialized = sql_lab._serialize_payload(payload, use_new_deserialization)
        self.assertIsInstance(serialized, bytes)

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
