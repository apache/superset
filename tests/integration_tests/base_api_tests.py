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
from unittest.mock import patch

from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)

import pytest
from flask_appbuilder.models.sqla.interface import SQLAInterface
import prison

import tests.integration_tests.test_app  # noqa: F401
from superset import db, security_manager
from superset.extensions import appbuilder
from superset.models.dashboard import Dashboard
from superset.views.base_api import BaseSupersetModelRestApi, requires_json  # noqa: F401
from superset.utils import json

from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_config
from tests.integration_tests.constants import ADMIN_USERNAME


class Model1Api(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Dashboard)
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "get_list": "read",
        "get": "read",
        "export": "read",
        "post": "write",
        "put": "write",
        "delete": "write",
        "bulk_delete": "write",
        "info": "read",
        "related": "read",
    }


appbuilder.add_api(Model1Api)


class TestOpenApiSpec(SupersetTestCase):
    def test_open_api_spec(self):
        """
        API: Test validate OpenAPI spec
        :return:
        """
        from openapi_spec_validator import validate_spec

        self.login(ADMIN_USERNAME)
        uri = "api/v1/_openapi"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        validate_spec(response)


class TestBaseModelRestApi(SupersetTestCase):
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_default_missing_declaration_get(self):
        """
        API: Test default missing declaration on get

        We want to make sure that not declared list_columns will
        not render all columns by default but just the model's pk
        """
        # Check get list response
        self.login(ADMIN_USERNAME)
        uri = "api/v1/model1api/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["list_columns"], ["id"])
        for result in response["result"]:
            self.assertEqual(list(result.keys()), ["id"])

        # Check get response
        dashboard = db.session.query(Dashboard).first()
        uri = f"api/v1/model1api/{dashboard.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["show_columns"], ["id"])
        self.assertEqual(list(response["result"].keys()), ["id"])

    def test_default_missing_declaration_put_spec(self):
        """
        API: Test default missing declaration on put openapi spec

        We want to make sure that not declared edit_columns will
        not render all columns by default but just the model's pk
        """
        self.login(ADMIN_USERNAME)
        uri = "api/v1/_openapi"
        rv = self.client.get(uri)
        # dashboard model accepts all fields are null
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_mutation_spec = {
            "properties": {"id": {"type": "integer"}},
            "type": "object",
        }
        self.assertEqual(
            response["components"]["schemas"]["Model1Api.post"], expected_mutation_spec
        )
        self.assertEqual(
            response["components"]["schemas"]["Model1Api.put"], expected_mutation_spec
        )

    def test_default_missing_declaration_post(self):
        """
        API: Test default missing declaration on post

        We want to make sure that not declared add_columns will
        not accept all columns by default
        """
        dashboard_data = {
            "dashboard_title": "title1",
            "slug": "slug1",
            "position_json": '{"a": "A"}',
            "css": "css",
            "json_metadata": '{"b": "B"}',
            "published": True,
        }
        self.login(ADMIN_USERNAME)
        uri = "api/v1/model1api/"
        rv = self.client.post(uri, json=dashboard_data)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": {
                "css": ["Unknown field."],
                "dashboard_title": ["Unknown field."],
                "json_metadata": ["Unknown field."],
                "position_json": ["Unknown field."],
                "published": ["Unknown field."],
                "slug": ["Unknown field."],
            }
        }
        self.assertEqual(response, expected_response)

    def test_refuse_invalid_format_request(self):
        """
        API: Test invalid format of request

        We want to make sure that non-JSON request are refused
        """
        self.login(ADMIN_USERNAME)
        uri = "api/v1/report/"  # endpoint decorated with @requires_json
        rv = self.client.post(
            uri, data="a: value\nb: 1\n", content_type="application/yaml"
        )
        self.assertEqual(rv.status_code, 400)

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_default_missing_declaration_put(self):
        """
        API: Test default missing declaration on put

        We want to make sure that not declared edit_columns will
        not accept all columns by default
        """
        dashboard = db.session.query(Dashboard).first()
        dashboard_data = {"dashboard_title": "CHANGED", "slug": "CHANGED"}
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/model1api/{dashboard.id}"
        rv = self.client.put(uri, json=dashboard_data)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": {
                "dashboard_title": ["Unknown field."],
                "slug": ["Unknown field."],
            }
        }
        self.assertEqual(response, expected_response)


class ApiOwnersTestCaseMixin:
    """
    Implements shared tests for owners related field
    """

    resource_name: str = ""

    def test_get_related_owners(self):
        """
        API: Test get related owners
        """
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/related/owners"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        users = db.session.query(security_manager.user_model).all()
        expected_users = [str(user) for user in users]
        assert response["count"] == len(users)
        # This needs to be implemented like this, because ordering varies between
        # postgres and mysql
        response_users = [result["text"] for result in response["result"]]
        for expected_user in expected_users:
            assert expected_user in response_users

    def test_get_related_owners_with_extra_filters(self):
        """
        API: Test get related owners with extra related query filters
        """
        self.login(ADMIN_USERNAME)

        def _base_filter(query):
            return query.filter_by(username="alpha")

        with patch.dict(
            "superset.views.filters.current_app.config",
            {"EXTRA_RELATED_QUERY_FILTERS": {"user": _base_filter}},
        ):
            uri = f"api/v1/{self.resource_name}/related/owners"
            rv = self.client.get(uri)
            assert rv.status_code == 200
            response = json.loads(rv.data.decode("utf-8"))
            response_users = [result["text"] for result in response["result"]]
            assert response_users == ["alpha user"]

    def test_get_related_owners_paginated(self):
        """
        API: Test get related owners with pagination
        """
        self.login(ADMIN_USERNAME)
        page_size = 1
        argument = {"page_size": page_size}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        users = db.session.query(security_manager.user_model).all()

        # the count should correspond with the total number of users
        assert response["count"] == len(users)

        # the length of the result should be at most equal to the page size
        assert len(response["result"]) == min(page_size, len(users))

        # make sure all received users are included in the full set of users
        all_users = [str(user) for user in users]
        for received_user in [result["text"] for result in response["result"]]:
            assert received_user in all_users

    def test_get_ids_related_owners_paginated(self):
        """
        API: Test get related owners with pagination returns 422
        """
        self.login(ADMIN_USERNAME)
        argument = {"page": 1, "page_size": 1, "include_ids": [2]}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 422

    def test_get_filter_related_owners(self):
        """
        API: Test get filter related owners
        """
        self.login(ADMIN_USERNAME)
        argument = {"filter": "gamma"}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert 4 == response["count"]
        sorted_results = sorted(response["result"], key=lambda value: value["text"])
        expected_results = [
            {
                "extra": {"active": True, "email": "gamma@fab.org"},
                "text": "gamma user",
                "value": 2,
            },
            {
                "extra": {"active": True, "email": "gamma2@fab.org"},
                "text": "gamma2 user",
                "value": 3,
            },
            {
                "extra": {"active": True, "email": "gamma_no_csv@fab.org"},
                "text": "gamma_no_csv user",
                "value": 6,
            },
            {
                "extra": {"active": True, "email": "gamma_sqllab@fab.org"},
                "text": "gamma_sqllab user",
                "value": 4,
            },
        ]
        # TODO Check me
        assert expected_results == sorted_results

    @with_config({"EXCLUDE_USERS_FROM_LISTS": ["gamma"]})
    def test_get_base_filter_related_owners(self):
        """
        API: Test get base filter related owners
        """
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/related/owners"
        gamma_user = (
            db.session.query(security_manager.user_model)
            .filter(security_manager.user_model.username == "gamma")
            .one_or_none()
        )
        assert gamma_user is not None
        users = db.session.query(security_manager.user_model).all()

        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] == len(users) - 1
        response_users = [result["text"] for result in response["result"]]
        assert "gamma user" not in response_users

    @patch(
        "superset.security.SupersetSecurityManager.get_exclude_users_from_lists",
        return_value=["gamma"],
    )
    def test_get_base_filter_related_owners_on_sm(
        self, mock_get_exclude_users_from_list
    ):
        """
        API: Test get base filter related owners using security manager
        """
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/related/owners"
        gamma_user = (
            db.session.query(security_manager.user_model)
            .filter(security_manager.user_model.username == "gamma")
            .one_or_none()
        )
        assert gamma_user is not None
        users = db.session.query(security_manager.user_model).all()

        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] == len(users) - 1
        response_users = [result["text"] for result in response["result"]]
        assert "gamma user" not in response_users

    def test_get_ids_related_owners(self):
        """
        API: Test get filter related owners
        """
        self.login(ADMIN_USERNAME)
        argument = {"filter": "gamma_sqllab", "include_ids": [2]}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert 2 == response["count"]
        sorted_results = sorted(response["result"], key=lambda value: value["text"])
        expected_results = [
            {
                "extra": {"active": True, "email": "gamma@fab.org"},
                "text": "gamma user",
                "value": 2,
            },
            {
                "extra": {"active": True, "email": "gamma_sqllab@fab.org"},
                "text": "gamma_sqllab user",
                "value": 4,
            },
        ]
        assert expected_results == sorted_results

    def test_get_repeated_ids_related_owners(self):
        """
        API: Test get filter related owners
        """
        self.login(ADMIN_USERNAME)
        argument = {"filter": "gamma_sqllab", "include_ids": [2, 4]}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert 2 == response["count"]
        sorted_results = sorted(response["result"], key=lambda value: value["text"])
        expected_results = [
            {
                "extra": {"active": True, "email": "gamma@fab.org"},
                "text": "gamma user",
                "value": 2,
            },
            {
                "extra": {"active": True, "email": "gamma_sqllab@fab.org"},
                "text": "gamma_sqllab user",
                "value": 4,
            },
        ]
        assert expected_results == sorted_results

    def test_get_related_fail(self):
        """
        API: Test get related fail
        """
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/{self.resource_name}/related/owner"

        rv = self.client.get(uri)
        assert rv.status_code == 404
