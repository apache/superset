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

import prison
from sqlalchemy.sql import func

import tests.test_app
from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils.core import get_example_database

from .base_tests import SupersetTestCase


class DatabaseApiTests(SupersetTestCase):
    def test_get_items(self):
        """
            Database API: Test get items
        """
        self.login(username="admin")
        uri = "api/v1/database/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_columns = [
            "allow_csv_upload",
            "allow_ctas",
            "allow_dml",
            "allow_multi_schema_metadata_fetch",
            "allow_run_async",
            "allows_cost_estimate",
            "allows_subquery",
            "backend",
            "database_name",
            "expose_in_sqllab",
            "force_ctas_schema",
            "function_names",
            "id",
        ]
        self.assertEqual(response["count"], 2)
        self.assertEqual(list(response["result"][0].keys()), expected_columns)

    def test_get_items_filter(self):
        fake_db = (
            db.session.query(Database).filter_by(database_name="fake_db_100").one()
        )
        old_expose_in_sqllab = fake_db.expose_in_sqllab
        fake_db.expose_in_sqllab = False
        db.session.commit()
        self.login(username="admin")
        arguments = {
            "keys": ["none"],
            "filters": [{"col": "expose_in_sqllab", "opr": "eq", "value": True}],
            "order_columns": "database_name",
            "order_direction": "asc",
            "page": 0,
            "page_size": -1,
        }
        uri = f"api/v1/database/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(response["count"], 1)

        fake_db = (
            db.session.query(Database).filter_by(database_name="fake_db_100").one()
        )
        fake_db.expose_in_sqllab = old_expose_in_sqllab
        db.session.commit()

    def test_get_items_not_allowed(self):
        """
            Database API: Test get items not allowed
        """
        self.login(username="gamma")
        uri = f"api/v1/database/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["count"], 0)

    def test_get_table_metadata(self):
        """
            Database API: Test get table metadata info
        """
        example_db = get_example_database()
        self.login(username="admin")
        uri = f"api/v1/database/{example_db.id}/table/birth_names/null/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["name"], "birth_names")
        self.assertTrue(len(response["columns"]) > 5)
        self.assertTrue(response.get("selectStar").startswith("SELECT"))

    def test_get_invalid_database_table_metadata(self):
        """
            Database API: Test get invalid database from table metadata
        """
        database_id = 1000
        self.login(username="admin")
        uri = f"api/v1/database/{database_id}/table/some_table/some_schema/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

        uri = f"api/v1/database/some_database/table/some_table/some_schema/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_invalid_table_table_metadata(self):
        """
            Database API: Test get invalid table from table metadata
        """
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/wrong_table/null/"
        self.login(username="admin")
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_table_metadata_no_db_permission(self):
        """
            Database API: Test get table metadata from not permitted db
        """
        self.login(username="gamma")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/birth_names/null/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_select_star(self):
        """
            Database API: Test get select star
        """
        self.login(username="admin")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/select_star/birth_names/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertIn("gender", response["result"])

    def test_get_select_star_not_allowed(self):
        """
            Database API: Test get select star not allowed
        """
        self.login(username="gamma")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/select_star/birth_names/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_select_star_datasource_access(self):
        """
            Database API: Test get select star with datasource access
        """
        session = db.session
        table = SqlaTable(
            schema="main", table_name="ab_permission", database=get_example_database()
        )
        session.add(table)
        session.commit()

        tmp_table_perm = security_manager.find_permission_view_menu(
            "datasource_access", table.get_perm()
        )
        gamma_role = security_manager.find_role("Gamma")
        security_manager.add_permission_role(gamma_role, tmp_table_perm)

        self.login(username="gamma")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/select_star/ab_permission/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

        # rollback changes
        security_manager.del_permission_role(gamma_role, tmp_table_perm)
        db.session.delete(table)
        db.session.commit()

    def test_get_select_star_not_found_database(self):
        """
            Database API: Test get select star not found database
        """
        self.login(username="admin")
        max_id = db.session.query(func.max(Database.id)).scalar()
        uri = f"api/v1/database/{max_id + 1}/select_star/birth_names/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_select_star_not_found_table(self):
        """
            Database API: Test get select star not found database
        """
        self.login(username="admin")
        example_db = get_example_database()
        # sqllite will not raise a NoSuchTableError
        if example_db.backend == "sqlite":
            return
        uri = f"api/v1/database/{example_db.id}/select_star/table_does_not_exist/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
