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

from unittest.mock import patch

import prison

from superset import db
from superset.subjects.models import Subject
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


class TestOpenApiSpec(SupersetTestCase):
    def test_open_api_spec(self):
        """
        API: Test validate open api spec
        """
        from openapi_spec_validator import validate

        self.login(ADMIN_USERNAME)
        uri = "api/v1/_openapi"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        validate(response)

    def test_info_endpoint(self):
        """
        API: Test info endpoint
        """
        self.login(ADMIN_USERNAME)
        uri = "api/v1/chart/_info"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        # Must have add_columns, edit_columns, filters, permissions
        assert "add_columns" in response
        assert "edit_columns" in response
        assert "filters" in response
        assert "permissions" in response
        expected_permissions = ["can_read", "can_write"]
        for perm in expected_permissions:
            assert perm in response["permissions"]
        # Verify no unexpected top-level keys beyond the known set
        known_keys = {
            "add_columns",
            "add_title",
            "edit_columns",
            "edit_title",
            "filters",
            "permissions",
        }
        assert set(response.keys()) <= known_keys


class ApiOwnersTestCaseMixin:
    """
    Implements shared tests for the editors related field endpoint.

    Previously tested the ``/related/owners`` endpoint; updated to use
    ``/related/editors`` since ``owners`` is now a computed property.
    """

    resource_name: str = ""

    def test_get_related_editors(self):
        """
        API: Test get related editors
        """
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/related/editors"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        subjects = db.session.query(Subject).all()
        assert response["count"] == len(subjects)
        assert len(response["result"]) == len(subjects)

    def test_get_related_editors_paginated(self):
        """
        API: Test get related editors with pagination
        """
        self.login(ADMIN_USERNAME)
        page_size = 1
        argument = {"page_size": page_size}
        uri = f"api/v1/{self.resource_name}/related/editors?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        subjects = db.session.query(Subject).all()
        assert response["count"] == len(subjects)
        assert len(response["result"]) == min(page_size, len(subjects))

    def test_get_ids_related_editors_paginated(self):
        """
        API: Test get related editors with pagination and include_ids returns 422
        """
        self.login(ADMIN_USERNAME)
        argument = {"page": 1, "page_size": 1, "include_ids": [2]}
        uri = f"api/v1/{self.resource_name}/related/editors?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 422

    def test_get_filter_related_editors(self):
        """
        API: Test get filter related editors
        """
        self.login(ADMIN_USERNAME)
        argument = {"filter": "gamma"}
        uri = f"api/v1/{self.resource_name}/related/editors?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] > 0
        for result in response["result"]:
            assert "gamma" in result["text"].lower()

    def test_get_base_filter_related_editors(self):
        """
        API: Test get related editors endpoint returns 200
        """
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/related/editors"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] > 0

    @patch(
        "superset.security.SupersetSecurityManager.get_exclude_users_from_lists",
        return_value=["gamma"],
    )
    def test_get_base_filter_related_editors_on_sm(
        self, mock_get_exclude_users_from_list
    ):
        """
        API: Test get related editors endpoint returns 200
        """
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/related/editors"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] > 0

    def test_get_ids_related_editors(self):
        """
        API: Test get related editors with filter and include_ids
        """
        self.login(ADMIN_USERNAME)
        # Get a subject to use as include_id
        subject = db.session.query(Subject).first()
        argument = {"filter": "", "include_ids": [subject.id]}
        uri = f"api/v1/{self.resource_name}/related/editors?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] > 0

    def test_get_repeated_ids_related_editors(self):
        """
        API: Test get related editors with repeated include_ids
        """
        self.login(ADMIN_USERNAME)
        subjects = db.session.query(Subject).limit(2).all()
        argument = {"filter": "", "include_ids": [s.id for s in subjects]}
        uri = f"api/v1/{self.resource_name}/related/editors?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] > 0
