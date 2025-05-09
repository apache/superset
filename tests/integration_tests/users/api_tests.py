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

from superset import security_manager
from superset.utils import json, slack  # noqa: F401
from tests.conftest import with_config
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME

meUri = "/api/v1/me/"  # noqa: N816
AVATAR_URL = "/internal/avatar.png"


class TestCurrentUserApi(SupersetTestCase):
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
