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
"""Unit tests for Superset"""
from datetime import datetime, timedelta
import json
import random
import string

import pytest
import prison
from sqlalchemy.sql import func

import tests.integration_tests.test_app
from superset import db, security_manager
from superset.common.db_query_status import QueryStatus
from superset.models.core import Database
from superset.utils.database import get_example_database, get_main_database
from superset.models.sql_lab import Query

from tests.integration_tests.base_tests import SupersetTestCase

QUERIES_FIXTURE_COUNT = 10


class TestQueryApi(SupersetTestCase):
    def insert_query(
        self,
        database_id: int,
        user_id: int,
        client_id: str,
        sql: str = "",
        select_sql: str = "",
        executed_sql: str = "",
        limit: int = 100,
        progress: int = 100,
        rows: int = 100,
        tab_name: str = "",
        status: str = "success",
    ) -> Query:
        database = db.session.query(Database).get(database_id)
        user = db.session.query(security_manager.user_model).get(user_id)
        query = Query(
            database=database,
            user=user,
            client_id=client_id,
            sql=sql,
            select_sql=select_sql,
            executed_sql=executed_sql,
            limit=limit,
            progress=progress,
            rows=rows,
            tab_name=tab_name,
            status=status,
            changed_on=datetime(2020, 1, 1),
        )
        db.session.add(query)
        db.session.commit()
        return query

    @pytest.fixture()
    def create_queries(self):
        with self.create_app().app_context():
            queries = []
            admin_id = self.get_user("admin").id
            alpha_id = self.get_user("alpha").id
            example_database_id = get_example_database().id
            main_database_id = get_main_database().id
            for cx in range(QUERIES_FIXTURE_COUNT - 1):
                queries.append(
                    self.insert_query(
                        example_database_id,
                        admin_id,
                        self.get_random_string(),
                        sql=f"SELECT col1, col2 from table{cx}",
                        rows=cx,
                        status=QueryStatus.SUCCESS
                        if (cx % 2) == 0
                        else QueryStatus.RUNNING,
                    )
                )
            queries.append(
                self.insert_query(
                    main_database_id,
                    alpha_id,
                    self.get_random_string(),
                    sql=f"SELECT col1, col2 from table{QUERIES_FIXTURE_COUNT}",
                    rows=QUERIES_FIXTURE_COUNT,
                    status=QueryStatus.SUCCESS,
                )
            )

            yield queries

            # rollback changes
            for query in queries:
                db.session.delete(query)
            db.session.commit()

    @staticmethod
    def get_random_string(length: int = 10):
        letters = string.ascii_letters
        return "".join(random.choice(letters) for i in range(length))

    def test_get_query(self):
        """
        Query API: Test get query
        """
        admin = self.get_user("admin")
        client_id = self.get_random_string()
        example_db = get_example_database()
        query = self.insert_query(
            example_db.id,
            admin.id,
            client_id,
            sql="SELECT col1, col2 from table1",
            select_sql="SELECT col1, col2 from table1",
            executed_sql="SELECT col1, col2 from table1 LIMIT 100",
        )
        self.login(username="admin")
        uri = f"api/v1/query/{query.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

        expected_result = {
            "database": {"id": example_db.id},
            "client_id": client_id,
            "end_result_backend_time": None,
            "error_message": None,
            "executed_sql": "SELECT col1, col2 from table1 LIMIT 100",
            "limit": 100,
            "progress": 100,
            "results_key": None,
            "rows": 100,
            "schema": None,
            "select_as_cta": None,
            "select_as_cta_used": False,
            "select_sql": "SELECT col1, col2 from table1",
            "sql": "SELECT col1, col2 from table1",
            "sql_editor_id": None,
            "status": "success",
            "tab_name": "",
            "tmp_schema_name": None,
            "tmp_table_name": None,
            "tracking_url": None,
        }
        data = json.loads(rv.data.decode("utf-8"))
        self.assertIn("changed_on", data["result"])
        for key, value in data["result"].items():
            # We can't assert timestamp
            if key not in (
                "changed_on",
                "end_time",
                "start_running_time",
                "start_time",
                "id",
            ):
                self.assertEqual(value, expected_result[key])
        # rollback changes
        db.session.delete(query)
        db.session.commit()

    def test_get_query_not_found(self):
        """
        Query API: Test get query not found
        """
        admin = self.get_user("admin")
        client_id = self.get_random_string()
        query = self.insert_query(get_example_database().id, admin.id, client_id)
        max_id = db.session.query(func.max(Query.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/query/{max_id + 1}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

        db.session.delete(query)
        db.session.commit()

    def test_get_query_no_data_access(self):
        """
        Query API: Test get query without data access
        """
        gamma1 = self.create_user(
            "gamma_1", "password", "Gamma", email="gamma1@superset.org"
        )
        gamma2 = self.create_user(
            "gamma_2", "password", "Gamma", email="gamma2@superset.org"
        )

        gamma1_client_id = self.get_random_string()
        gamma2_client_id = self.get_random_string()
        query_gamma1 = self.insert_query(
            get_example_database().id, gamma1.id, gamma1_client_id
        )
        query_gamma2 = self.insert_query(
            get_example_database().id, gamma2.id, gamma2_client_id
        )

        # Gamma1 user, only sees his own queries
        self.login(username="gamma_1", password="password")
        uri = f"api/v1/query/{query_gamma2.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
        uri = f"api/v1/query/{query_gamma1.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

        # Gamma2 user, only sees his own queries
        self.logout()
        self.login(username="gamma_2", password="password")
        uri = f"api/v1/query/{query_gamma1.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
        uri = f"api/v1/query/{query_gamma2.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

        # Admin's have the "all query access" permission
        self.logout()
        self.login(username="admin")
        uri = f"api/v1/query/{query_gamma1.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        uri = f"api/v1/query/{query_gamma2.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

        # rollback changes
        db.session.delete(query_gamma1)
        db.session.delete(query_gamma2)
        db.session.delete(gamma1)
        db.session.delete(gamma2)
        db.session.commit()

    @pytest.mark.usefixtures("create_queries")
    def test_get_list_query(self):
        """
        Query API: Test get list query
        """
        self.login(username="admin")
        uri = "api/v1/query/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == QUERIES_FIXTURE_COUNT
        # check expected columns
        assert sorted(list(data["result"][0].keys())) == [
            "changed_on",
            "database",
            "end_time",
            "executed_sql",
            "id",
            "rows",
            "schema",
            "sql",
            "sql_tables",
            "start_time",
            "status",
            "tab_name",
            "tmp_table_name",
            "tracking_url",
            "user",
        ]
        assert sorted(list(data["result"][0]["user"].keys())) == [
            "first_name",
            "id",
            "last_name",
            "username",
        ]
        assert list(data["result"][0]["database"].keys()) == [
            "database_name",
        ]

    @pytest.mark.usefixtures("create_queries")
    def test_get_list_query_filter_sql(self):
        """
        Query API: Test get list query filter
        """
        self.login(username="admin")
        arguments = {"filters": [{"col": "sql", "opr": "ct", "value": "table2"}]}
        uri = f"api/v1/query/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1

    @pytest.mark.usefixtures("create_queries")
    def test_get_list_query_filter_database(self):
        """
        Query API: Test get list query filter database
        """
        self.login(username="admin")
        database_id = get_main_database().id
        arguments = {
            "filters": [{"col": "database", "opr": "rel_o_m", "value": database_id}]
        }
        uri = f"api/v1/query/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1

    @pytest.mark.usefixtures("create_queries")
    def test_get_list_query_filter_user(self):
        """
        Query API: Test get list query filter user
        """
        self.login(username="admin")
        alpha_id = self.get_user("alpha").id
        arguments = {"filters": [{"col": "user", "opr": "rel_o_m", "value": alpha_id}]}
        uri = f"api/v1/query/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1

    @pytest.mark.usefixtures("create_queries")
    def test_get_list_query_filter_changed_on(self):
        """
        Query API: Test get list query filter changed_on
        """
        self.login(username="admin")
        arguments = {
            "filters": [
                {"col": "changed_on", "opr": "lt", "value": "2020-02-01T00:00:00Z"},
                {"col": "changed_on", "opr": "gt", "value": "2019-12-30T00:00:00Z"},
            ]
        }
        uri = f"api/v1/query/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == QUERIES_FIXTURE_COUNT

    @pytest.mark.usefixtures("create_queries")
    def test_get_list_query_order(self):
        """
        Query API: Test get list query filter changed_on
        """
        self.login(username="admin")
        order_columns = [
            "changed_on",
            "database.database_name",
            "rows",
            "schema",
            "sql",
            "tab_name",
            "user.first_name",
        ]

        for order_column in order_columns:
            arguments = {"order_column": order_column, "order_direction": "asc"}
            uri = f"api/v1/query/?q={prison.dumps(arguments)}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

    def test_get_list_query_no_data_access(self):
        """
        Query API: Test get queries no data access
        """
        admin = self.get_user("admin")
        client_id = self.get_random_string()
        query = self.insert_query(
            get_example_database().id,
            admin.id,
            client_id,
            sql="SELECT col1, col2 from table1",
        )

        self.login(username="gamma")
        arguments = {"filters": [{"col": "sql", "opr": "sw", "value": "SELECT col1"}]}
        uri = f"api/v1/query/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 0

        # rollback changes
        db.session.delete(query)
        db.session.commit()
