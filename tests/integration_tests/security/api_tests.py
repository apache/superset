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
"""Tests for security api methods"""
import json

import jwt

from tests.integration_tests.base_tests import SupersetTestCase
from flask_wtf.csrf import generate_csrf
from superset.utils.urls import get_url_host


class TestSecurityCsrfApi(SupersetTestCase):
    resource_name = "security"

    def _assert_get_csrf_token(self):
        uri = f"api/v1/{self.resource_name}/csrf_token/"
        response = self.client.get(uri)
        self.assert200(response)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual(generate_csrf(), data["result"])

    def test_get_csrf_token(self):
        """
        Security API: Test get CSRF token
        """
        self.login(username="admin")
        self._assert_get_csrf_token()

    def test_get_csrf_token_gamma(self):
        """
        Security API: Test get CSRF token by gamma
        """
        self.login(username="gamma")
        self._assert_get_csrf_token()

    def test_get_csrf_unauthorized(self):
        """
        Security API: Test get CSRF no login
        """
        self.logout()
        uri = f"api/v1/{self.resource_name}/csrf_token/"
        response = self.client.get(uri)
        self.assert401(response)


class TestSecurityGuestTokenApi(SupersetTestCase):
    uri = f"api/v1/security/guest_token/"

    def test_post_guest_token_unauthenticated(self):
        """
        Security API: Cannot create a guest token without authentication
        """
        self.logout()
        response = self.client.post(self.uri)
        self.assert401(response)

    def test_post_guest_token_unauthorized(self):
        """
        Security API: Cannot create a guest token without authorization
        """
        self.login(username="gamma")
        response = self.client.post(self.uri)
        self.assert403(response)

    def test_post_guest_token_authorized(self):
        self.login(username="admin")
        user = {"username": "bob", "first_name": "Bob", "last_name": "Also Bob"}
        resource = {"type": "dashboard", "id": "blah"}
        rls_rule = {"dataset": 1, "clause": "1=1"}
        params = {"user": user, "resources": [resource], "rls": [rls_rule]}

        response = self.client.post(
            self.uri, data=json.dumps(params), content_type="application/json"
        )

        self.assert200(response)
        token = json.loads(response.data)["token"]
        decoded_token = jwt.decode(
            token, self.app.config["GUEST_TOKEN_JWT_SECRET"], audience=get_url_host()
        )
        self.assertEqual(user, decoded_token["user"])
        self.assertEqual(resource, decoded_token["resources"][0])
