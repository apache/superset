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
"""Integration tests asserting the password-complexity policy is wired into
Flask-AppBuilder's User REST API (not just the validator function itself)."""

from superset import db, security_manager
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

USERS_API_URI = "/api/v1/security/users/"


class TestPasswordComplexityUserApi(SupersetTestCase):
    """Exercise the real FAB ``/api/v1/security/users/`` path so that a future
    Flask-AppBuilder bump that drops enforcement fails these tests."""

    def _user_payload(self, password: str) -> dict[str, object]:
        """Build a valid user-creation payload with the given password."""
        gamma_role = security_manager.find_role("Gamma")
        return {
            "active": True,
            "email": "pw_complexity_test@example.com",
            "first_name": "Password",
            "last_name": "Complexity",
            "username": "pw_complexity_test_user",
            "roles": [gamma_role.id],
            "password": password,
        }

    def test_create_user_rejects_short_password(self):
        """A too-short password is rejected by the User REST API with a 400."""
        self.login(ADMIN_USERNAME)
        rv = self.client.post(USERS_API_URI, json=self._user_payload("Ab1!"))
        assert rv.status_code == 400
        assert b"at least" in rv.data
        assert security_manager.find_user(username="pw_complexity_test_user") is None

    def test_create_user_rejects_common_password(self):
        """A blocklisted common password is rejected by the User REST API."""
        self.login(ADMIN_USERNAME)
        rv = self.client.post(USERS_API_URI, json=self._user_payload("password123"))
        assert rv.status_code == 400
        assert b"too common" in rv.data
        assert security_manager.find_user(username="pw_complexity_test_user") is None

    def test_create_user_accepts_compliant_password(self):
        """A password satisfying the policy is accepted by the User REST API."""
        self.login(ADMIN_USERNAME)
        rv = self.client.post(
            USERS_API_URI, json=self._user_payload("correct-horse-battery")
        )
        assert rv.status_code == 201
        user = security_manager.find_user(username="pw_complexity_test_user")
        assert user is not None
        db.session.delete(user)
        db.session.commit()
