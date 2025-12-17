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
"""Integration tests for Datasource Analyzer API"""

from unittest.mock import patch

from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


class TestDatasourceAnalyzerApi(SupersetTestCase):
    """Test cases for POST /api/v1/datasource_analyzer/"""

    def test_post_success_returns_run_id(self):
        """Test that a successful POST returns a run_id"""
        self.login(ADMIN_USERNAME)
        example_db = get_example_database()

        # Mock get_all_schema_names to return a list containing "main"
        with patch.object(
            example_db.__class__,
            "get_all_schema_names",
            return_value=["main", "public"],
        ):
            payload = {
                "database_id": example_db.id,
                "schema_name": "main",
            }
            response = self.client.post(
                "/api/v1/datasource_analyzer/",
                json=payload,
            )

            self.assertEqual(response.status_code, 200)
            data = response.json
            self.assertIn("result", data)
            self.assertIn("run_id", data["result"])
            # Verify run_id is a valid UUID format
            run_id = data["result"]["run_id"]
            self.assertIsInstance(run_id, str)
            self.assertEqual(len(run_id), 36)  # UUID format

    def test_post_with_catalog_returns_run_id(self):
        """Test that a POST with catalog returns a run_id"""
        self.login(ADMIN_USERNAME)
        example_db = get_example_database()

        with patch.object(
            example_db.__class__,
            "get_all_schema_names",
            return_value=["main", "public"],
        ):
            payload = {
                "database_id": example_db.id,
                "schema_name": "main",
                "catalog_name": "test_catalog",
            }
            response = self.client.post(
                "/api/v1/datasource_analyzer/",
                json=payload,
            )

            self.assertEqual(response.status_code, 200)
            data = response.json
            self.assertIn("result", data)
            self.assertIn("run_id", data["result"])

    def test_post_missing_database_id_returns_400(self):
        """Test that missing database_id returns 400"""
        self.login(ADMIN_USERNAME)

        payload = {
            "schema_name": "main",
        }
        response = self.client.post(
            "/api/v1/datasource_analyzer/",
            json=payload,
        )

        self.assertEqual(response.status_code, 400)

    def test_post_missing_schema_name_returns_400(self):
        """Test that missing schema_name returns 400"""
        self.login(ADMIN_USERNAME)
        example_db = get_example_database()

        payload = {
            "database_id": example_db.id,
        }
        response = self.client.post(
            "/api/v1/datasource_analyzer/",
            json=payload,
        )

        self.assertEqual(response.status_code, 400)

    def test_post_invalid_database_id_returns_404(self):
        """Test that an invalid database_id returns 404"""
        self.login(ADMIN_USERNAME)

        payload = {
            "database_id": 99999,  # Non-existent database
            "schema_name": "main",
        }
        response = self.client.post(
            "/api/v1/datasource_analyzer/",
            json=payload,
        )

        self.assertEqual(response.status_code, 404)

    def test_post_invalid_schema_returns_404(self):
        """Test that a non-existent schema returns 404"""
        self.login(ADMIN_USERNAME)
        example_db = get_example_database()

        with patch.object(
            example_db.__class__,
            "get_all_schema_names",
            return_value=["main", "public"],
        ):
            payload = {
                "database_id": example_db.id,
                "schema_name": "nonexistent_schema",
            }
            response = self.client.post(
                "/api/v1/datasource_analyzer/",
                json=payload,
            )

            self.assertEqual(response.status_code, 404)

    def test_post_no_access_returns_403(self):
        """Test that a user without database access gets 403"""
        self.login(ADMIN_USERNAME)
        example_db = get_example_database()

        # Mock security_manager.can_access_database to return False
        with patch(
            "superset.datasource_analyzer.commands.initiate.security_manager"
        ) as mock_sm:
            mock_sm.can_access_database.return_value = False

            payload = {
                "database_id": example_db.id,
                "schema_name": "main",
            }
            response = self.client.post(
                "/api/v1/datasource_analyzer/",
                json=payload,
            )

            self.assertEqual(response.status_code, 403)

    def test_post_unauthenticated_returns_401(self):
        """Test that unauthenticated requests return 401"""
        example_db = get_example_database()

        payload = {
            "database_id": example_db.id,
            "schema_name": "main",
        }
        response = self.client.post(
            "/api/v1/datasource_analyzer/",
            json=payload,
        )

        # Should redirect to login or return 401
        self.assertIn(response.status_code, [401, 302])

    def test_post_empty_payload_returns_400(self):
        """Test that an empty payload returns 400"""
        self.login(ADMIN_USERNAME)

        response = self.client.post(
            "/api/v1/datasource_analyzer/",
            json={},
        )

        self.assertEqual(response.status_code, 400)
