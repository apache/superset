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
#  type: ignore
"""Unit tests for Superset"""

from unittest.mock import patch

from flask import Flask
from flask_appbuilder.const import AUTH_OAUTH

from superset import security_manager
from superset.extensions import db
from superset.utils import json, slack  # noqa: F401
from superset.utils.auth_db_password import get_public_auth_db_password_policy
from superset.utils.auth_db_password_hash import hash_auth_db_password
from tests.conftest import with_config
from tests.integration_tests.base_tests import DEFAULT_PASSWORD, SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.test_app import app as superset_integration_app, login

meUri = "/api/v1/me/"  # noqa: N816
mePasswordUri = "/api/v1/me/password"  # noqa: N816
AVATAR_URL = "/internal/avatar.png"


class TestCurrentUserApi(SupersetTestCase):
    def _restore_admin_default_password(self, app: Flask | None = None) -> None:
        """Reset the admin user's password after password-change API tests."""
        app = app or superset_integration_app
        user = security_manager.find_user(username=ADMIN_USERNAME)
        user.password = hash_auth_db_password(DEFAULT_PASSWORD)
        db.session.commit()

    def test_get_me_logged_in(self):
        self.login(ADMIN_USERNAME)

        rv = self.client.get(meUri)

        assert 200 == rv.status_code
        response = json.loads(rv.data.decode("utf-8"))
        assert "admin" == response["result"]["username"]
        assert True is response["result"]["is_active"]
        assert False is response["result"]["is_anonymous"]

    def test_get_me_with_roles(self):
        self.login(ADMIN_USERNAME)

        rv = self.client.get(meUri + "roles/")
        assert 200 == rv.status_code
        response = json.loads(rv.data.decode("utf-8"))
        roles = list(response["result"]["roles"].keys())
        assert "Admin" == roles.pop()
        assert "groups" in response["result"]
        assert isinstance(response["result"]["groups"], list)

    @patch("superset.security.manager.g")
    def test_get_my_roles_anonymous(self, mock_g):
        mock_g.user = security_manager.get_anonymous_user
        rv = self.client.get(meUri + "roles/")
        assert 401 == rv.status_code

    def test_get_me_unauthorized(self):
        rv = self.client.get(meUri)
        assert 401 == rv.status_code

    @patch("superset.security.manager.g")
    def test_get_me_anonymous(self, mock_g):
        mock_g.user = security_manager.get_anonymous_user
        rv = self.client.get(meUri)
        assert 401 == rv.status_code

    def test_update_me_success(self):
        self.login(ADMIN_USERNAME)

        payload = {
            "first_name": "UpdatedFirst",
            "last_name": "UpdatedLast",
        }

        rv = self.client.put("/api/v1/me/", json=payload)
        assert rv.status_code == 200

        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"]["first_name"] == "UpdatedFirst"
        assert data["result"]["last_name"] == "UpdatedLast"

    def test_update_me_unauthenticated(self):
        rv = self.client.put("/api/v1/me/", json={"first_name": "Hacker"})
        assert rv.status_code == 401

    def test_update_me_invalid_payload(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.put("/api/v1/me/", json={"first_name": 123})
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert "first_name" in data["message"]

    def test_update_me_empty_payload(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.put("/api/v1/me/", json={})
        assert rv.status_code == 400

    def test_update_me_rejects_password_when_auth_db(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.put(meUri, json={"password": "ignored"})
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert "AUTH_TYPE is AUTH_DB" in data["message"]

    def test_put_my_password_wrong_current(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            mePasswordUri,
            json={
                "current_password": "not-the-admin-password",
                "new_password": "AnotherStr0ng!Pass",
                "confirm_password": "AnotherStr0ng!Pass",
            },
        )
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert data["message"] == "Incorrect current password."

    def test_put_my_password_weak_new(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            mePasswordUri,
            json={
                "current_password": DEFAULT_PASSWORD,
                "new_password": "short",
                "confirm_password": "short",
            },
        )
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert "new_password" in data["message"]

    def test_put_my_password_success(self) -> None:
        self.login(ADMIN_USERNAME)
        new_password = "AnotherStr0ng!Pass"  # noqa: S105
        try:
            rv = self.client.put(
                mePasswordUri,
                json={
                    "current_password": DEFAULT_PASSWORD,
                    "new_password": new_password,
                    "confirm_password": new_password,
                },
            )
            assert rv.status_code == 200

            rv2 = self.client.put(
                mePasswordUri,
                json={
                    "current_password": new_password,
                    "new_password": "YetAnotherStr0ng!Pw",
                    "confirm_password": "YetAnotherStr0ng!Pw",
                },
            )
            assert rv2.status_code == 200
        finally:
            self._restore_admin_default_password()

    def test_put_my_password_invalidates_cloned_session_client(self) -> None:
        """
        Rotating the session stamp on password change logs out other clients that
        still present the pre-change signed session cookie.
        """
        from flask.testing import FlaskClient

        app = superset_integration_app
        client_a: FlaskClient = app.test_client()
        login(client_a, ADMIN_USERNAME)

        session_cookie = client_a.get_cookie("session")
        assert session_cookie is not None

        client_b: FlaskClient = app.test_client()
        client_b.set_cookie(
            key="session",
            value=session_cookie.value,
            domain=session_cookie.domain or "localhost",
            path=session_cookie.path or "/",
        )

        new_password = "AnotherStr0ng!PassClone"  # noqa: S105
        try:
            rv = client_a.put(
                mePasswordUri,
                json={
                    "current_password": DEFAULT_PASSWORD,
                    "new_password": new_password,
                    "confirm_password": new_password,
                },
            )
            assert rv.status_code == 200

            assert client_b.get(meUri).status_code == 401
        finally:
            self._restore_admin_default_password(app)

    def test_put_my_password_clears_remember_cookie(self) -> None:
        """
        Password change schedules Flask-Login remember-me cookie deletion.

        Superset does not expose remember-me in the React login UI; this is defensive
        hardening for FAB / Flask-Login persistent cookies.
        """
        app = superset_integration_app
        remember_name = app.config.get("REMEMBER_COOKIE_NAME", "remember_token")
        self.login(ADMIN_USERNAME)
        self.client.set_cookie(remember_name, "stale-remember-token")

        new_password = "AnotherStr0ng!PassRemember"  # noqa: S105
        try:
            rv = self.client.put(
                mePasswordUri,
                json={
                    "current_password": DEFAULT_PASSWORD,
                    "new_password": new_password,
                    "confirm_password": new_password,
                },
            )
            assert rv.status_code == 200

            set_cookies = rv.headers.getlist("Set-Cookie")
            cleared = any(
                remember_name in header
                and ("=;" in header or "Max-Age=0" in header or "1970" in header)
                for header in set_cookies
            )
            assert cleared, f"Expected remember cookie clear in {set_cookies}"
        finally:
            self._restore_admin_default_password(app)

    def test_put_my_password_invalid_hash_algorithm(self) -> None:
        self.login(ADMIN_USERNAME)
        original_auth_db_config = superset_integration_app.config.get(
            "AUTH_DB_CONFIG", {}
        )
        try:
            superset_integration_app.config["AUTH_DB_CONFIG"] = {
                **original_auth_db_config,
                "password_hash_algorithm": "invalid",
            }
            rv = self.client.put(
                mePasswordUri,
                json={
                    "current_password": DEFAULT_PASSWORD,
                    "new_password": "AnotherStr0ng!Pass",
                    "confirm_password": "AnotherStr0ng!Pass",
                },
            )
        finally:
            superset_integration_app.config["AUTH_DB_CONFIG"] = original_auth_db_config

        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert "password_hash_algorithm" in data["message"]

    def test_put_my_password_unavailable_when_not_auth_db(self) -> None:
        self.login(ADMIN_USERNAME)
        original_auth = superset_integration_app.config["AUTH_TYPE"]
        try:
            superset_integration_app.config["AUTH_TYPE"] = AUTH_OAUTH
            rv = self.client.put(
                mePasswordUri,
                json={
                    "current_password": DEFAULT_PASSWORD,
                    "new_password": "AnotherStr0ng!Pass",
                    "confirm_password": "AnotherStr0ng!Pass",
                },
            )
        finally:
            superset_integration_app.config["AUTH_TYPE"] = original_auth
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert "AUTH_TYPE is AUTH_DB" in data["message"]

    def test_get_my_password_policy_success(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/api/v1/me/password/policy")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"] == get_public_auth_db_password_policy()

    def test_get_my_password_policy_unavailable_when_not_auth_db(self) -> None:
        self.login(ADMIN_USERNAME)
        original_auth = superset_integration_app.config["AUTH_TYPE"]
        try:
            superset_integration_app.config["AUTH_TYPE"] = AUTH_OAUTH
            rv = self.client.get("/api/v1/me/password/policy")
        finally:
            superset_integration_app.config["AUTH_TYPE"] = original_auth
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert "AUTH_TYPE is AUTH_DB" in data["message"]

    def test_put_my_password_confirmation_mismatch(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            mePasswordUri,
            json={
                "current_password": DEFAULT_PASSWORD,
                "new_password": "AnotherStr0ng!Pass",
                "confirm_password": "AnotherStr0ng!PassMismatch",
            },
        )
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert "confirm_password" in data["message"]


class TestUserApi(SupersetTestCase):
    def test_avatar_with_invalid_user(self):
        self.login(ADMIN_USERNAME)
        response = self.client.get("/api/v1/user/NOT_A_USER/avatar.png")
        assert response.status_code == 404  # Assuming no user found leads to 404
        response = self.client.get("/api/v1/user/999/avatar.png")
        assert response.status_code == 404  # Assuming no user found leads to 404

    def test_avatar_valid_user_no_avatar(self):
        self.login(ADMIN_USERNAME)

        response = self.client.get("/api/v1/user/1/avatar.png", follow_redirects=False)
        assert response.status_code == 204

    @with_config({"SLACK_API_TOKEN": "dummy"})
    @with_feature_flags(SLACK_ENABLE_AVATARS=True)
    @patch("superset.views.users.api.get_user_avatar", return_value=AVATAR_URL)
    def test_avatar_with_valid_user(self, mock):
        self.login(ADMIN_USERNAME)
        response = self.client.get("/api/v1/user/1/avatar.png", follow_redirects=False)
        mock.assert_called_once_with("admin@fab.org")
        assert response.status_code == 301
        assert response.headers["Location"] == AVATAR_URL
