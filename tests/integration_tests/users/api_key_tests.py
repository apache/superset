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
"""Integration tests for API key endpoints (now served by FAB)."""

from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

# API keys are now served by FAB's ApiKeyApi at this endpoint
API_KEYS_URI = "/api/v1/security/api_keys/"


class TestApiKeyApi(SupersetTestCase):
    """Integration tests for FAB API key management endpoints."""

    def test_create_api_key_success(self):
        """Test creating an API key via FAB endpoint."""
        self.login(ADMIN_USERNAME)

        payload = {"name": "Test API Key"}

        rv = self.client.post(API_KEYS_URI, json=payload)

        assert rv.status_code == 201
        response = json.loads(rv.data.decode("utf-8"))
        result = response["result"]

        assert "key" in result
        assert result["key"].startswith("sst_")
        assert result["name"] == "Test API Key"
        assert result["key_prefix"].startswith("sst_")
        assert "uuid" in result
        assert "created_on" in result

    def test_create_api_key_missing_name(self):
        """Test creating API key without name fails."""
        self.login(ADMIN_USERNAME)

        payload = {}

        rv = self.client.post(API_KEYS_URI, json=payload)

        assert rv.status_code == 400

    def test_list_api_keys(self):
        """Test listing API keys via FAB endpoint."""
        self.login(ADMIN_USERNAME)

        # Create a key first
        create_payload = {"name": "List Test Key"}
        self.client.post(API_KEYS_URI, json=create_payload)

        # List keys
        rv = self.client.get(API_KEYS_URI)

        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        result = response["result"]

        assert isinstance(result, list)
        assert len(result) > 0

        # Check structure of returned keys
        key = result[0]
        assert "uuid" in key
        assert "name" in key
        assert "key_prefix" in key
        assert "active" in key
        assert "created_on" in key

        # Plaintext key should NOT be in list response
        assert "key" not in key

    def test_get_api_key(self):
        """Test getting a single API key via FAB endpoint."""
        self.login(ADMIN_USERNAME)

        # Create a key first
        create_payload = {"name": "Get Test Key"}
        create_rv = self.client.post(API_KEYS_URI, json=create_payload)
        create_response = json.loads(create_rv.data.decode("utf-8"))
        key_uuid = create_response["result"]["uuid"]

        # Get the key
        rv = self.client.get(f"{API_KEYS_URI}{key_uuid}")

        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["result"]["name"] == "Get Test Key"
        # Plaintext key should NOT be returned on get
        assert "key" not in response["result"]

    def test_revoke_api_key(self):
        """Test revoking an API key via FAB endpoint."""
        self.login(ADMIN_USERNAME)

        # Create a key first
        create_payload = {"name": "Revoke Test Key"}
        create_rv = self.client.post(API_KEYS_URI, json=create_payload)
        create_response = json.loads(create_rv.data.decode("utf-8"))
        key_uuid = create_response["result"]["uuid"]

        # Revoke the key
        revoke_rv = self.client.delete(f"{API_KEYS_URI}{key_uuid}")

        assert revoke_rv.status_code == 200

    def test_revoke_api_key_not_found(self):
        """Test revoking non-existent API key."""
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"{API_KEYS_URI}nonexistent-uuid")

        assert rv.status_code == 404
