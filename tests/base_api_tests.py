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
    class_permission_name = "DashboardModelView"
    method_permission_name = {
        "get_list": "list",
        "get": "show",
        "export": "mulexport",
        "post": "add",
        "put": "edit",
        "delete": "delete",
        "bulk_delete": "delete",
        "info": "list",
        "related": "list",
    }


appbuilder.add_api(Model1Api)


class BaseModelRestApiTests(SupersetTestCase):
    def test_default_missing_declaration_get(self):
        """
            API: Test default missing declaration on get
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
        # dashboard model accepts all fields are null
        self.assertEqual(rv.status_code, 201)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(list(response["result"].keys()), ["id"])
        model = db.session.query(Dashboard).get(response["id"])
        self.assertEqual(model.dashboard_title, None)
        self.assertEqual(model.slug, None)
        self.assertEqual(model.position_json, None)
        self.assertEqual(model.json_metadata, None)
        db.session.delete(model)
        db.session.commit()

    def test_default_missing_declaration_put(self):
        dashboard = db.session.query(Dashboard).first()
        dashboard_data = {"dashboard_title": "CHANGED", "slug": "CHANGED"}
        self.login(username="admin")
        uri = f"api/v1/model1api/{dashboard.id}"
        rv = self.client.put(uri, json=dashboard_data)
        # dashboard model accepts all fields are null
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        changed_dashboard = db.session.query(Dashboard).get(dashboard.id)
        self.assertNotEqual(changed_dashboard.dashboard_title, "CHANGED")
        self.assertNotEqual(changed_dashboard.slug, "CHANGED")


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
        argument = {"filter": "a"}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "count": 2,
            "result": [
                {"text": "admin user", "value": 1},
                {"text": "alpha user", "value": 5},
            ],
        }
        self.assertEqual(response, expected_response)

    def test_get_related_fail(self):
        """
            API: Test get related fail
        """
        self.login(username="admin")
        uri = f"api/v1/{self.resource_name}/related/owner"

        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
