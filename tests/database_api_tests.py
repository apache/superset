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
"""Unit tests for Superset"""
import json

from superset import db
from superset.models.core import Database
from superset.utils.core import get_example_database
from superset.views.database.api import get_table_schema_info

from .base_tests import SupersetTestCase


class DatabaseApiTests(SupersetTestCase):
    def test_get_table_metadata(self):
        """
            Database API: Test get table schema info
        """
        database = db.session.query(Database).first()
        schema = database.get_all_schema_names()[0]
        table = database.get_all_table_names_in_schema(schema)[0].table
        self.login(username="admin")
        uri = f"api/v1/database/{database.id}/table/{table}/{schema}/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = get_table_schema_info(database, table, schema)
        self.assertEqual(response, expected_response)

        # adapted from old API test
        example_db = get_example_database()
        data = self.get_json_resp(
            f"api/v1/database/{example_db.id}/table/birth_names/null/"
        )
        self.assertEqual(data["name"], "birth_names")
        self.assertTrue(len(data["columns"]) > 5)
        self.assertTrue(data.get("selectStar").startswith("SELECT"))

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
