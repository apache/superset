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
import json
import uuid
import random
import string

import prison
from sqlalchemy.sql import func

import tests.test_app
from superset import db, security_manager
from superset.models.core import Database
from superset.utils.core import get_example_database
from superset.models.sql_lab import Query

from tests.base_tests import SupersetTestCase


class QueryApiTests(SupersetTestCase):
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
        )
        db.session.add(query)
        db.session.commit()
        return query

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
        query = self.insert_query(
            get_example_database().id,
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
        self.insert_query(get_example_database().id, admin.id, client_id)
        max_id = db.session.query(func.max(Query.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/query/{max_id + 1}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_query_no_data_access(self):
        """
            Query API: Test get dashboard without data access
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

    def test_get_query_filter(self):
        """
            Query API: Test get queries filter
        """
        admin = self.get_user("admin")
        client_id = self.get_random_string()
        query = self.insert_query(
            get_example_database().id,
            admin.id,
            client_id,
            sql="SELECT col1, col2 from table1",
        )

        self.login(username="admin")
        arguments = {"filters": [{"col": "sql", "opr": "sw", "value": "SELECT col1"}]}
        uri = f"api/v1/query/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 1)

        # rollback changes
        db.session.delete(query)
        db.session.commit()

    def test_get_queries_no_data_access(self):
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
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

        # rollback changes
        db.session.delete(query)
        db.session.commit()
