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
from typing import Optional

import pytest
import prison
from sqlalchemy.sql import func, asc

import tests.test_app
from superset import db, security_manager
from superset.models.core import Database
from superset.models.sql_lab import SavedQuery
from superset.utils.core import get_example_database

from tests.base_tests import SupersetTestCase


class TestSavedQueryApi(SupersetTestCase):
    def insert_saved_query(
        self,
        label: str,
        sql: str,
        db_id: Optional[int] = None,
        user_id: Optional[int] = None,
        schema: Optional[str] = "",
    ) -> SavedQuery:
        database = None
        user = None
        if db_id:
            database = db.session.query(Database).get(db_id)
        if user_id:
            user = db.session.query(security_manager.user_model).get(user_id)
        query = SavedQuery(
            database=database, user=user, sql=sql, label=label, schema=schema
        )
        db.session.add(query)
        db.session.commit()
        return query

    def insert_default_saved_query(
        self, label: str = "saved1", schema: str = "schema1",
    ) -> SavedQuery:
        admin = self.get_user("admin")
        example_db = get_example_database()
        return self.insert_saved_query(
            label,
            "SELECT col1, col2 from table1",
            db_id=example_db.id,
            user_id=admin.id,
            schema=schema,
        )

    @pytest.fixture()
    def create_saved_queries(self):
        with self.create_app().app_context():
            num_saved_queries = 5
            saved_queries = []
            for cx in range(num_saved_queries):
                saved_queries.append(
                    self.insert_default_saved_query(
                        label=f"label{cx}", schema=f"schema{cx}"
                    )
                )
            yield saved_queries

            # rollback changes
            for saved_query in saved_queries:
                db.session.delete(saved_query)
            db.session.commit()

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_saved_query(self):
        """
        Saved Query API: Test get list saved query
        """
        queries = db.session.query(SavedQuery).all()

        self.login(username="admin")
        uri = f"api/v1/saved_query/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(queries)
        expected_columns = [
            "user_id",
            "db_id",
            "schema",
            "label",
            "description",
            "sql",
            "user",
            "database",
        ]
        for expected_column in expected_columns:
            assert expected_column in data["result"][0]

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_sort_saved_query(self):
        """
        Saved Query API: Test get list and sort saved query
        """
        all_queries = (
            db.session.query(SavedQuery).order_by(asc(SavedQuery.schema)).all()
        )
        self.login(username="admin")
        query_string = {"order_column": "schema", "order_direction": "asc"}
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_queries)
        for i, query in enumerate(all_queries):
            assert query.schema == data["result"][i]["schema"]

        query_string = {
            "order_column": "database.database_name",
            "order_direction": "asc",
        }
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200

        query_string = {"order_column": "user.first_name", "order_direction": "asc"}
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_filter_saved_query(self):
        """
        Saved Query API: Test get list and filter saved query
        """
        all_queries = (
            db.session.query(SavedQuery).filter(SavedQuery.label.ilike("%2%")).all()
        )
        self.login(username="admin")
        query_string = {
            "filters": [{"col": "label", "opr": "ct", "value": "2"}],
        }
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_queries)

    def test_info_saved_query(self):
        """
        SavedQuery API: Test info
        """
        self.login(username="admin")
        uri = f"api/v1/saved_query/_info"
        rv = self.get_assert_metric(uri, "info")
        assert rv.status_code == 200

    def test_related_saved_query(self):
        """
        SavedQuery API: Test related databases
        """
        self.login(username="admin")
        databases = db.session.query(Database).all()
        expected_result = {
            "count": len(databases),
            "result": [
                {"text": str(database), "value": database.id} for database in databases
            ],
        }

        uri = f"api/v1/saved_query/related/database"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data == expected_result

    def test_related_saved_query_not_found(self):
        """
        SavedQuery API: Test related user not found
        """
        self.login(username="admin")
        uri = f"api/v1/saved_query/related/user"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_saved_queries")
    def test_distinct_saved_query(self):
        """
        SavedQuery API: Test distinct schemas
        """
        self.login(username="admin")
        uri = f"api/v1/saved_query/distinct/schema"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "count": 5,
            "result": [{"text": f"schema{i}", "value": f"schema{i}"} for i in range(5)],
        }
        assert data == expected_response

    def test_get_saved_query_not_allowed(self):
        """
        SavedQuery API: Test related user not allowed
        """
        self.login(username="admin")
        uri = f"api/v1/saved_query/wrong"
        rv = self.client.get(uri)
        assert rv.status_code == 405

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_saved_query(self):
        """
        Saved Query API: Test get saved query
        """
        query = (
            db.session.query(SavedQuery).filter(SavedQuery.label == "label1").all()[0]
        )
        self.login(username="admin")
        uri = f"api/v1/saved_query/{query.id}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200

        expected_result = {
            "id": query.id,
            "database": {"id": query.database.id, "database_name": "examples"},
            "description": None,
            "user": {"first_name": "admin", "id": query.user_id, "last_name": "user"},
            "sql": "SELECT col1, col2 from table1",
            "schema": "schema1",
            "label": "label1",
        }
        data = json.loads(rv.data.decode("utf-8"))
        for key, value in data["result"].items():
            assert value == expected_result[key]

    def test_get_saved_query_not_found(self):
        """
        Saved Query API: Test get saved query not found
        """
        query = self.insert_default_saved_query()
        max_id = db.session.query(func.max(SavedQuery.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/saved_query/{max_id + 1}"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_create_saved_query(self):
        """
        Saved Query API: Test create
        """
        admin = self.get_user("admin")
        example_db = get_example_database()

        post_data = {
            "schema": "schema1",
            "label": "label1",
            "description": "some description",
            "sql": "SELECT col1, col2 from table1",
            "user_id": admin.id,
            "db_id": example_db.id,
        }

        self.login(username="admin")
        uri = f"api/v1/saved_query/"
        rv = self.client.post(uri, json=post_data)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 201

        saved_query_id = data.get("id")
        model = db.session.query(SavedQuery).get(saved_query_id)
        for key in post_data:
            assert getattr(model, key) == data["result"][key]

        # Rollback changes
        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("create_saved_queries")
    def test_update_saved_query(self):
        """
        Saved Query API: Test update
        """
        saved_query = (
            db.session.query(SavedQuery).filter(SavedQuery.label == "label1").all()[0]
        )

        put_data = {
            "schema": "schema_changed",
            "label": "label_changed",
        }

        self.login(username="admin")
        uri = f"api/v1/saved_query/{saved_query.id}"
        rv = self.client.put(uri, json=put_data)
        assert rv.status_code == 200

        model = db.session.query(SavedQuery).get(saved_query.id)
        assert model.label == "label_changed"
        assert model.schema == "schema_changed"

    @pytest.mark.usefixtures("create_saved_queries")
    def test_update_saved_query_not_found(self):
        """
        Saved Query API: Test update not found
        """
        max_id = db.session.query(func.max(SavedQuery.id)).scalar()
        self.login(username="admin")

        put_data = {
            "schema": "schema_changed",
            "label": "label_changed",
        }

        uri = f"api/v1/saved_query/{max_id + 1}"
        rv = self.client.put(uri, json=put_data)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_saved_queries")
    def test_delete_saved_query(self):
        """
        Saved Query API: Test delete
        """
        saved_query = (
            db.session.query(SavedQuery).filter(SavedQuery.label == "label1").all()[0]
        )

        self.login(username="admin")
        uri = f"api/v1/saved_query/{saved_query.id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200

        model = db.session.query(SavedQuery).get(saved_query.id)
        assert model is None

    @pytest.mark.usefixtures("create_saved_queries")
    def test_delete_saved_query_not_found(self):
        """
        Saved Query API: Test delete not found
        """
        max_id = db.session.query(func.max(SavedQuery.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/saved_query/{max_id + 1}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404
