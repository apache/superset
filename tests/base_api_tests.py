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
import json

from flask_appbuilder.models.sqla.interface import SQLAInterface
import prison

import tests.test_app
from superset import db, security_manager
from superset.extensions import appbuilder
from superset.models.dashboard import Dashboard
from superset.views.base_api import BaseSupersetModelRestApi

from .base_tests import SupersetTestCase


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

        self.login(username="admin")
        uri = "api/v1/_openapi"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        validate_spec(response)


class TestBaseModelRestApi(SupersetTestCase):
    def test_default_missing_declaration_get(self):
        """
        API: Test default missing declaration on get

        We want to make sure that not declared list_columns will
        not render all columns by default but just the model's pk
        """
        # Check get list response
        self.login(username="admin")
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
        self.login(username="admin")
        uri = "api/v1/_openapi"
        rv = self.client.get(uri)
        # dashboard model accepts all fields are null
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_mutation_spec = {
            "properties": {"id": {"format": "int32", "type": "integer"}},
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
        self.login(username="admin")
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

    def test_default_missing_declaration_put(self):
        """
        API: Test default missing declaration on put

        We want to make sure that not declared edit_columns will
        not accept all columns by default
        """
        dashboard = db.session.query(Dashboard).first()
        dashboard_data = {"dashboard_title": "CHANGED", "slug": "CHANGED"}
        self.login(username="admin")
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
        self.login(username="admin")
        uri = f"api/v1/{self.resource_name}/related/owners"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        users = db.session.query(security_manager.user_model).all()
        expected_users = [str(user) for user in users]
        self.assertEqual(response["count"], len(users))
        # This needs to be implemented like this, because ordering varies between
        # postgres and mysql
        response_users = [result["text"] for result in response["result"]]
        for expected_user in expected_users:
            self.assertIn(expected_user, response_users)

    def test_get_filter_related_owners(self):
        """
            API: Test get filter related owners
        """
        self.login(username="admin")
        argument = {"filter": "gamma"}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(3, response["count"])
        sorted_results = sorted(response["result"], key=lambda value: value["text"])
        expected_results = [
            {"text": "gamma user", "value": 2},
            {"text": "gamma2 user", "value": 3},
            {"text": "gamma_sqllab user", "value": 4},
        ]
        self.assertEqual(expected_results, sorted_results)

    def test_get_related_fail(self):
        """
            API: Test get related fail
        """
        self.login(username="admin")
        uri = f"api/v1/{self.resource_name}/related/owner"

        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
