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


SAVED_QUERIES_FIXTURE_COUNT = 5


class TestSavedQueryApi(SupersetTestCase):
    def insert_saved_query(
        self,
        label: str,
        sql: str,
        db_id: Optional[int] = None,
        created_by=None,
        schema: Optional[str] = "",
        description: Optional[str] = "",
    ) -> SavedQuery:
        database = None
        if db_id:
            database = db.session.query(Database).get(db_id)
        query = SavedQuery(
            database=database,
            created_by=created_by,
            sql=sql,
            label=label,
            schema=schema,
            description=description,
        )
        db.session.add(query)
        db.session.commit()
        return query

    def insert_default_saved_query(
        self, label: str = "saved1", schema: str = "schema1", username: str = "admin"
    ) -> SavedQuery:
        admin = self.get_user(username)
        example_db = get_example_database()
        return self.insert_saved_query(
            label,
            "SELECT col1, col2 from table1",
            db_id=example_db.id,
            created_by=admin,
            schema=schema,
            description="cool description",
        )

    @pytest.fixture()
    def create_saved_queries(self):
        with self.create_app().app_context():
            saved_queries = []
            for cx in range(SAVED_QUERIES_FIXTURE_COUNT - 1):
                saved_queries.append(
                    self.insert_default_saved_query(
                        label=f"label{cx}", schema=f"schema{cx}"
                    )
                )
            saved_queries.append(
                self.insert_default_saved_query(
                    label=f"label{SAVED_QUERIES_FIXTURE_COUNT}",
                    schema=f"schema{SAVED_QUERIES_FIXTURE_COUNT}",
                    username="gamma",
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
        admin = self.get_user("admin")
        saved_queries = (
            db.session.query(SavedQuery).filter(SavedQuery.created_by == admin).all()
        )

        self.login(username="admin")
        uri = f"api/v1/saved_query/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(saved_queries)
        expected_columns = [
            "created_by",
            "database",
            "db_id",
            "description",
            "label",
            "schema",
            "sql",
            "sql_tables",
        ]
        for expected_column in expected_columns:
            assert expected_column in data["result"][0]

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_saved_query_gamma(self):
        """
        Saved Query API: Test get list saved query
        """
        gamma = self.get_user("gamma")
        saved_queries = (
            db.session.query(SavedQuery).filter(SavedQuery.created_by == gamma).all()
        )

        self.login(username="gamma")
        uri = f"api/v1/saved_query/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(saved_queries)

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_sort_saved_query(self):
        """
        Saved Query API: Test get list and sort saved query
        """
        admin = self.get_user("admin")
        saved_queries = (
            db.session.query(SavedQuery).filter(SavedQuery.created_by == admin).all()
        )
        self.login(username="admin")
        query_string = {"order_column": "schema", "order_direction": "asc"}
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(saved_queries)
        for i, query in enumerate(saved_queries):
            assert query.schema == data["result"][i]["schema"]

        query_string = {
            "order_column": "database.database_name",
            "order_direction": "asc",
        }
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200

        query_string = {
            "order_column": "created_by.first_name",
            "order_direction": "asc",
        }
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

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_custom_filter_schema_saved_query(self):
        """
        Saved Query API: Test get list and custom filter (schema) saved query
        """
        self.login(username="admin")
        admin = self.get_user("admin")

        all_queries = (
            db.session.query(SavedQuery)
            .filter(SavedQuery.created_by == admin)
            .filter(SavedQuery.schema.ilike("%2%"))
            .all()
        )
        query_string = {
            "filters": [{"col": "label", "opr": "all_text", "value": "schema2"}],
        }
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_queries)

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_custom_filter_label_saved_query(self):
        """
        Saved Query API: Test get list and custom filter (label) saved query
        """
        self.login(username="admin")
        admin = self.get_user("admin")
        all_queries = (
            db.session.query(SavedQuery)
            .filter(SavedQuery.created_by == admin)
            .filter(SavedQuery.label.ilike("%3%"))
            .all()
        )
        query_string = {
            "filters": [{"col": "label", "opr": "all_text", "value": "label3"}],
        }
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_queries)

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_custom_filter_sql_saved_query(self):
        """
        Saved Query API: Test get list and custom filter (sql) saved query
        """
        self.login(username="admin")
        admin = self.get_user("admin")
        all_queries = (
            db.session.query(SavedQuery)
            .filter(SavedQuery.created_by == admin)
            .filter(SavedQuery.sql.ilike("%table%"))
            .all()
        )
        query_string = {
            "filters": [{"col": "label", "opr": "all_text", "value": "table"}],
        }
        uri = f"api/v1/saved_query/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_queries)

    @pytest.mark.usefixtures("create_saved_queries")
    def test_get_list_custom_filter_description_saved_query(self):
        """
        Saved Query API: Test get list and custom filter (description) saved query
        """
        self.login(username="admin")
        admin = self.get_user("admin")
        all_queries = (
            db.session.query(SavedQuery)
            .filter(SavedQuery.created_by == admin)
            .filter(SavedQuery.description.ilike("%cool%"))
            .all()
        )
        query_string = {
            "filters": [{"col": "label", "opr": "all_text", "value": "cool"}],
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
        admin = self.get_user("admin")
        saved_queries = (
            db.session.query(SavedQuery).filter(SavedQuery.created_by == admin).all()
        )

        self.login(username="admin")
        uri = f"api/v1/saved_query/distinct/schema"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "count": len(saved_queries),
            "result": [
                {"text": f"schema{i}", "value": f"schema{i}"}
                for i in range(len(saved_queries))
            ],
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
        saved_query = (
            db.session.query(SavedQuery).filter(SavedQuery.label == "label1").all()[0]
        )
        self.login(username="admin")
        uri = f"api/v1/saved_query/{saved_query.id}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200

        expected_result = {
            "id": saved_query.id,
            "database": {"id": saved_query.database.id, "database_name": "examples"},
            "description": "cool description",
            "created_by": {
                "first_name": saved_query.created_by.first_name,
                "id": saved_query.created_by.id,
                "last_name": saved_query.created_by.last_name,
            },
            "sql": "SELECT col1, col2 from table1",
            "sql_tables": [{"catalog": None, "schema": None, "table": "table1"}],
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

    @pytest.mark.usefixtures("create_saved_queries")
    def test_delete_bulk_saved_queries(self):
        """
        Saved Query API: Test delete bulk
        """
        admin = self.get_user("admin")
        saved_queries = (
            db.session.query(SavedQuery).filter(SavedQuery.created_by == admin).all()
        )
        saved_query_ids = [saved_query.id for saved_query in saved_queries]

        self.login(username="admin")
        uri = f"api/v1/saved_query/?q={prison.dumps(saved_query_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {len(saved_query_ids)} saved queries"}
        assert response == expected_response
        saved_queries = (
            db.session.query(SavedQuery).filter(SavedQuery.created_by == admin).all()
        )
        assert saved_queries == []

    @pytest.mark.usefixtures("create_saved_queries")
    def test_delete_one_bulk_saved_queries(self):
        """
        Saved Query API: Test delete one in bulk
        """
        saved_query = db.session.query(SavedQuery).first()
        saved_query_ids = [saved_query.id]

        self.login(username="admin")
        uri = f"api/v1/saved_query/?q={prison.dumps(saved_query_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {len(saved_query_ids)} saved query"}
        assert response == expected_response
        saved_query_ = db.session.query(SavedQuery).get(saved_query_ids[0])
        assert saved_query_ is None

    def test_delete_bulk_saved_query_bad_request(self):
        """
        Saved Query API: Test delete bulk bad request
        """
        saved_query_ids = [1, "a"]
        self.login(username="admin")
        uri = f"api/v1/saved_query/?q={prison.dumps(saved_query_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 400

    @pytest.mark.usefixtures("create_saved_queries")
    def test_delete_bulk_saved_query_not_found(self):
        """
        Saved Query API: Test delete bulk not found
        """
        max_id = db.session.query(func.max(SavedQuery.id)).scalar()

        saved_query_ids = [max_id + 1, max_id + 2]
        self.login(username="admin")
        uri = f"api/v1/saved_query/?q={prison.dumps(saved_query_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 404
