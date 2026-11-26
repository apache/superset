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
"""The time range limits admin page, its Settings menu item and their
permissions."""

from __future__ import annotations

from typing import Any

import pytest
from flask import g
from flask_login import login_user

from superset import security_manager
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.views.base import menu_data
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.public_role import (  # noqa: F401
    public_role_like_gamma_scoped,
)
from tests.integration_tests.test_app import app

FLAG_ON = {FEATURE_FLAG: True}
FLAG_OFF = {FEATURE_FLAG: False}
PAGE_URL = "/timerangelimits/list/"
GLOBAL_URL = "/api/v1/time_range_limits/"


class TestTimeRangeLimitsPage(SupersetTestCase):
    def manage_menu(self, username: str) -> list[dict[str, Any]]:
        user = security_manager.find_user(username)
        with app.app_context(), app.test_request_context():
            login_user(user)
            g.user = user
            menu = menu_data(user)["menu"]
        return next((item["childs"] for item in menu if item["name"] == "Manage"), [])

    def assert_redirects_to_login(self, response: Any) -> None:
        assert response.status_code == 302
        assert "/login/" in response.headers["Location"]

    @with_feature_flags(**FLAG_ON)
    def test_admin_opens_the_page(self) -> None:
        self.login(ADMIN_USERNAME)
        response = self.client.get(PAGE_URL)

        assert response.status_code == 200

    @with_feature_flags(**FLAG_ON)
    def test_anonymous_is_sent_to_login_and_gamma_and_alpha_are_refused(
        self,
    ) -> None:
        self.assert_redirects_to_login(self.client.get(PAGE_URL))
        for username in (GAMMA_USERNAME, ALPHA_USERNAME):
            self.login(username)
            assert self.client.get(PAGE_URL).status_code == 403, username
            self.logout()

    @with_feature_flags(**FLAG_OFF)
    def test_page_answers_404_to_admin_with_the_flag_off(self) -> None:
        self.assert_redirects_to_login(self.client.get(PAGE_URL))
        self.login(ALPHA_USERNAME)
        assert self.client.get(PAGE_URL).status_code == 403
        self.logout()
        self.login(ADMIN_USERNAME)
        assert self.client.get(PAGE_URL).status_code == 404
        assert self.client.get(GLOBAL_URL).status_code == 404

    @with_feature_flags(**FLAG_ON)
    def test_menu_item_is_last_in_manage_for_admin(self) -> None:
        manage = self.manage_menu(ADMIN_USERNAME)
        assert "user" not in g

        assert manage[-1] == {
            "name": "TimeRangeLimits",
            "label": "Time range limits",
            "icon": "",
            "url": PAGE_URL,
        }

    @with_feature_flags(**FLAG_OFF)
    def test_no_menu_item_with_the_flag_off(self) -> None:
        manage = self.manage_menu(ADMIN_USERNAME)
        assert "user" not in g

        assert manage
        assert "TimeRangeLimits" not in [item["name"] for item in manage]

    @with_feature_flags(**FLAG_ON)
    def test_no_menu_item_for_alpha(self) -> None:
        manage = self.manage_menu(ALPHA_USERNAME)
        assert "user" not in g

        assert "TimeRangeLimits" not in [item["name"] for item in manage]

    def test_openapi_lists_the_display_labels_the_page_reads(self) -> None:
        self.login(ADMIN_USERNAME)
        schemas = self.client.get("/api/v1/_openapi").json["components"]["schemas"]

        assert schemas["TimeRangeLimitsResponseSchema"]["properties"][
            "display_labels"
        ] == {"$ref": "#/components/schemas/TimeRangeLimitsDisplayLabels"}
        labels = schemas["TimeRangeLimitsDisplayLabels"]["properties"]
        assert sorted(labels) == ["max_look_back", "max_look_forward", "max_span"]
        assert all(
            label["type"] == "string" and label["nullable"] for label in labels.values()
        )

    @pytest.mark.usefixtures("public_role_like_gamma_scoped")
    def test_page_and_menu_permissions_are_admin_only(self) -> None:
        security_manager.sync_role_definitions()

        def roles_with(permission: str) -> list[str]:
            pvm = security_manager.find_permission_view_menu(
                permission, "TimeRangeLimits"
            )
            assert pvm is not None, permission
            return [
                role.name
                for role in security_manager.get_all_roles()
                if pvm in role.permissions
            ]

        assert roles_with("can_read") == ["Admin"]
        assert roles_with("menu_access") == ["Admin"]
        for role in ("Alpha", "Gamma", "Public", "sql_lab"):
            perms = {
                (pvm.permission.name, pvm.view_menu.name)
                for pvm in security_manager.find_role(role).permissions
            }
            assert ("menu_access", "TimeRangeLimits") not in perms, role
            assert ("can_read", "TimeRangeLimits") not in perms, role
