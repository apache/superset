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
"""Integration tests for API key endpoints."""

from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

API_KEYS_URI = "/api/v1/me/api_keys/"


class TestApiKeyApi(SupersetTestCase):
    """Integration tests for API key management endpoints."""

    def test_create_api_key_success(self):
        """Test creating an API key."""
        self.login(ADMIN_USERNAME)

        payload = {
            "name": "Test API Key",
            "workspace_name": "default",
        }

        rv = self.client.post(API_KEYS_URI, json=payload)

        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        result = response["result"]

        assert "api_key" in result
        assert result["api_key"].startswith("pst_")
        assert result["name"] == "Test API Key"
        assert result["workspace_name"] == "default"
        assert result["key_prefix"].startswith("pst_")
        assert "created_on" in result

    def test_create_api_key_missing_name(self):
        """Test creating API key without name fails."""
        self.login(ADMIN_USERNAME)

        payload = {
            "workspace_name": "default",
        }

        rv = self.client.post(API_KEYS_URI, json=payload)

        assert rv.status_code == 400
        response = json.loads(rv.data.decode("utf-8"))
        assert "name" in response["message"]

    def test_create_api_key_missing_workspace_uses_default(self):
        """Test creating API key without workspace uses default."""
        self.login(ADMIN_USERNAME)

        payload = {
            "name": "Test Key Without Workspace",
        }

        rv = self.client.post(API_KEYS_URI, json=payload)

        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["result"]["workspace_name"] == "default"

    def test_create_api_key_unauthenticated(self):
        """Test creating API key without authentication fails."""
        payload = {
            "name": "Test Key",
            "workspace_name": "default",
        }

        rv = self.client.post(API_KEYS_URI, json=payload)

        assert rv.status_code == 401

    def test_list_api_keys(self):
        """Test listing API keys."""
        self.login(ADMIN_USERNAME)

        # Create a key first
        create_payload = {
            "name": "List Test Key",
            "workspace_name": "default",
        }
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
        assert "id" in key
        assert "name" in key
        assert "key_prefix" in key
        assert "workspace_name" in key
        assert "created_on" in key

        # Plaintext key should NOT be in list response
        assert "api_key" not in key

    def test_list_api_keys_unauthenticated(self):
        """Test listing API keys without authentication fails."""
        rv = self.client.get(API_KEYS_URI)

        assert rv.status_code == 401

    def test_revoke_api_key(self):
        """Test revoking an API key."""
        self.login(ADMIN_USERNAME)

        # Create a key first
        create_payload = {
            "name": "Revoke Test Key",
            "workspace_name": "default",
        }
        create_rv = self.client.post(API_KEYS_URI, json=create_payload)
        create_response = json.loads(create_rv.data.decode("utf-8"))
        api_key_id = create_response["result"]["id"]

        # Revoke the key
        revoke_rv = self.client.delete(f"{API_KEYS_URI}{api_key_id}")

        assert revoke_rv.status_code == 200
        revoke_response = json.loads(revoke_rv.data.decode("utf-8"))
        assert "revoked successfully" in revoke_response["message"]

        # List keys and verify it's revoked
        list_rv = self.client.get(API_KEYS_URI)
        list_response = json.loads(list_rv.data.decode("utf-8"))
        revoked_key = next(
            (k for k in list_response["result"] if k["id"] == api_key_id), None
        )

        assert revoked_key is not None
        assert revoked_key["revoked_on"] is not None

    def test_revoke_api_key_not_found(self):
        """Test revoking non-existent API key."""
        self.login(ADMIN_USERNAME)

        rv = self.client.delete(f"{API_KEYS_URI}99999")

        assert rv.status_code == 404

    def test_revoke_api_key_unauthenticated(self):
        """Test revoking API key without authentication fails."""
        rv = self.client.delete(f"{API_KEYS_URI}1")

        assert rv.status_code == 401
