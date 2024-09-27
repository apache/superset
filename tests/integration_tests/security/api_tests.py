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

import jwt
import pytest

from flask_wtf.csrf import generate_csrf
from superset import db
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.models.dashboard import Dashboard
from superset.utils.urls import get_url_host
from superset.utils import json
from tests.integration_tests.conftest import with_config
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)


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
        self.login(ADMIN_USERNAME)
        self._assert_get_csrf_token()

    def test_get_csrf_token_gamma(self):
        """
        Security API: Test get CSRF token by gamma
        """
        self.login(GAMMA_USERNAME)
        self._assert_get_csrf_token()

    def test_get_csrf_unauthorized(self):
        """
        Security API: Test get CSRF no login
        """
        uri = f"api/v1/{self.resource_name}/csrf_token/"
        response = self.client.get(uri)
        self.assert401(response)

    def test_login(self):
        """
        Security API: Test get login
        """
        uri = f"api/v1/{self.resource_name}/login"
        response = self.client.post(
            uri,
            json={"username": ADMIN_USERNAME, "password": "general", "provider": "db"},
        )
        assert response.status_code == 200
        assert "access_token" in response.json


class TestSecurityGuestTokenApi(SupersetTestCase):
    uri = "api/v1/security/guest_token/"

    def test_post_guest_token_unauthenticated(self):
        """
        Security API: Cannot create a guest token without authentication
        """
        response = self.client.post(self.uri)
        self.assert401(response)

    def test_post_guest_token_unauthorized(self):
        """
        Security API: Cannot create a guest token without authorization
        """
        self.login(GAMMA_USERNAME)
        response = self.client.post(self.uri)
        self.assert403(response)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_post_guest_token_authorized(self):
        self.dash = db.session.query(Dashboard).filter_by(slug="births").first()
        self.embedded = EmbeddedDashboardDAO.upsert(self.dash, [])
        self.login(ADMIN_USERNAME)
        user = {"username": "bob", "first_name": "Bob", "last_name": "Also Bob"}
        resource = {"type": "dashboard", "id": str(self.embedded.uuid)}
        rls_rule = {"dataset": 1, "clause": "1=1"}
        params = {"user": user, "resources": [resource], "rls": [rls_rule]}

        response = self.client.post(
            self.uri, data=json.dumps(params), content_type="application/json"
        )

        self.assert200(response)
        token = json.loads(response.data)["token"]
        decoded_token = jwt.decode(
            token,
            self.app.config["GUEST_TOKEN_JWT_SECRET"],
            audience=get_url_host(),
            algorithms=["HS256"],
        )
        self.assertEqual(user, decoded_token["user"])
        self.assertEqual(resource, decoded_token["resources"][0])

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_post_guest_token_bad_resources(self):
        self.login(ADMIN_USERNAME)
        user = {"username": "bob", "first_name": "Bob", "last_name": "Also Bob"}
        resource = {"type": "dashboard", "id": "bad-id"}
        rls_rule = {"dataset": 1, "clause": "1=1"}
        params = {"user": user, "resources": [resource], "rls": [rls_rule]}

        response = self.client.post(
            self.uri, data=json.dumps(params), content_type="application/json"
        )

        self.assert400(response)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", scope="class")
class TestSecurityGuestTokenApiTokenValidator(SupersetTestCase):
    uri = "api/v1/security/guest_token/"

    def _get_guest_token_with_rls(self, rls_rule):
        dash = db.session.query(Dashboard).filter_by(slug="births").first()
        self.embedded = EmbeddedDashboardDAO.upsert(dash, [])
        self.login(ADMIN_USERNAME)
        user = {"username": "bob", "first_name": "Bob", "last_name": "Also Bob"}
        resource = {"type": "dashboard", "id": str(self.embedded.uuid)}
        params = {"user": user, "resources": [resource], "rls": [rls_rule]}
        return self.client.post(
            self.uri, data=json.dumps(params), content_type="application/json"
        )

    @with_config({"GUEST_TOKEN_VALIDATOR_HOOK": lambda x: False})
    def test_guest_token_validator_hook_denied(self):
        """
        Security API: Test False case from validator - should be 400
        """
        rls_rule = {"dataset": 1, "clause": "tenant_id=123"}
        self.assert400(self._get_guest_token_with_rls(rls_rule))

    @with_config({"GUEST_TOKEN_VALIDATOR_HOOK": lambda x: True})
    def test_guest_token_validator_hook_denied_allowed(self):
        """
        Security API: Test True case from validator - should be 200
        """
        rls_rule = {"dataset": 1, "clause": "tenant_id=123"}
        self.assert200(self._get_guest_token_with_rls(rls_rule))

    @with_config({"GUEST_TOKEN_VALIDATOR_HOOK": 123})
    def test_guest_validator_hook_not_callable(self):
        """
        Security API: Test validator throws exception when isn't callable
         should be 500
        """
        rls_rule = {"dataset": 1, "clause": "tenant_id=123"}
        self.assert500(self._get_guest_token_with_rls(rls_rule))

    @with_config({"GUEST_TOKEN_VALIDATOR_HOOK": lambda x: [][0]})
    def test_guest_validator_hook_throws_exception(self):
        """
        Security API: Test validator throws exception - should be 500
        """
        rls_rule = {"dataset": 1, "clause": "tenant_id=123"}
        self.assert500(self._get_guest_token_with_rls(rls_rule))

    @with_config(
        {
            "GUEST_TOKEN_VALIDATOR_HOOK": lambda x: len(x["rls"]) == 1
            and "tenant_id=" in x["rls"][0]["clause"]
        }
    )
    def test_guest_validator_hook_real_world_example_positive(self):
        """
        Security API: Test validator real world example, check tenant_id is in clause
            Positive case
        """
        # Test validator real world example, check tenant_id is in clause
        # Should be 200.
        rls_rule = {"dataset": 1, "clause": "tenant_id=123"}
        self.assert200(self._get_guest_token_with_rls(rls_rule))

    @with_config(
        {
            "GUEST_TOKEN_VALIDATOR_HOOK": lambda x: len(x["rls"]) == 1
            and "tenant_id=" in x["rls"][0]["clause"]
        }
    )
    def test_guest_validator_hook_real_world_example_negative(self):
        """
        Security API: Test validator real world example, check tenant_id is in clause
            Negative case
        """
        rls_rule = {}
        self.assert400(self._get_guest_token_with_rls(rls_rule))


class TestSecurityRolesApi(SupersetTestCase):
    uri = "api/v1/security/roles/"  # noqa: F541

    @with_config({"FAB_ADD_SECURITY_API": True})
    def test_get_security_roles_admin(self):
        """
        Security API: Admin should be able to get roles
        """
        self.login(ADMIN_USERNAME)
        response = self.client.get(self.uri)
        self.assert200(response)

    @with_config({"FAB_ADD_SECURITY_API": True})
    def test_get_security_roles_gamma(self):
        """
        Security API: Gamma should not be able to get roles
        """
        self.login(GAMMA_USERNAME)
        response = self.client.get(self.uri)
        self.assert403(response)

    @with_config({"FAB_ADD_SECURITY_API": True})
    def test_post_security_roles_gamma(self):
        """
        Security API: Gamma should not be able to create roles
        """
        self.login(GAMMA_USERNAME)
        response = self.client.post(
            self.uri,
            data=json.dumps({"name": "new_role"}),
            content_type="application/json",
        )
        self.assert403(response)

    @with_config({"FAB_ADD_SECURITY_API": True})
    def test_put_security_roles_gamma(self):
        """
        Security API: Gamma shouldnt be able to update roles
        """
        self.login(GAMMA_USERNAME)
        response = self.client.put(
            f"{self.uri}1",
            data=json.dumps({"name": "new_role"}),
            content_type="application/json",
        )
        self.assert403(response)

    @with_config({"FAB_ADD_SECURITY_API": True})
    def test_delete_security_roles_gamma(self):
        """
        Security API: Gamma shouldnt be able to delete roles
        """
        self.login(GAMMA_USERNAME)
        response = self.client.delete(
            f"{self.uri}1",
            data=json.dumps({"name": "new_role"}),
            content_type="application/json",
        )
        self.assert403(response)
