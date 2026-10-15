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

"""
Guest user detection must not depend on the value of the token's username.

Every guest token produces a ``GuestUser`` regardless of the ``username`` claim
(including an empty string), so the guest-specific handling (dashboard access
rules, response field filtering, error sanitization) has to apply to all of them.
"""

# pylint: disable=redefined-outer-name

from typing import Any
from uuid import uuid4

import pytest
from flask import current_app, g, request
from flask_appbuilder.security.sqla.models import Role
from pytest_mock import MockerFixture

from superset import security_manager
from superset.commands.dashboard.exceptions import DashboardAccessDeniedError
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.schemas import DashboardGetResponseSchema
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.security.guest_token import GuestTokenResourceType, GuestUser
from superset.utils.error_sanitization import is_sanitization_required

USERNAMES = ["embedded_viewer", ""]
USERNAME_IDS = ["non-empty-username", "empty-username"]


@pytest.fixture
def embedded_feature_enabled(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda feature: feature == "EMBEDDED_SUPERSET",
    )


def _guest_user_from_token(mocker: MockerFixture, username: str) -> GuestUser:
    """
    Build the guest user the same way the request loader does: sign a token with
    the given ``user.username`` claim and parse it from the request headers.
    """
    mocker.patch.object(security_manager, "find_role", return_value=Role(name="Public"))
    mocker.patch.object(security_manager, "_is_guest_token_revoked", return_value=False)
    token = security_manager.create_guest_access_token(
        user={"username": username},
        resources=[{"type": GuestTokenResourceType.DASHBOARD, "id": str(uuid4())}],
        rls=[],
    )
    header_name = current_app.config["GUEST_TOKEN_HEADER_NAME"]
    with current_app.test_request_context(headers={header_name: token}):
        guest_user = security_manager.get_guest_user_from_request(request)
    assert isinstance(guest_user, GuestUser)
    assert guest_user.username == username
    return guest_user


@pytest.fixture
def guest_user_factory(mocker: MockerFixture, embedded_feature_enabled: None) -> Any:
    def _make(username: str) -> GuestUser:
        guest_user = _guest_user_from_token(mocker, username)
        g.user = guest_user
        return guest_user

    return _make


def _embedded_dashboard() -> Dashboard:
    """
    A published, chart-less dashboard with an embedded configuration that is not
    listed in the guest token's resources.
    """
    dashboard = Dashboard(
        id=42,
        dashboard_title="Embedded dashboard",
        published=True,
        slices=[],
    )
    dashboard.uuid = uuid4()
    return dashboard


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_is_guest_user_does_not_depend_on_username(
    guest_user_factory: Any, username: str
) -> None:
    guest_user_factory(username)

    assert security_manager.is_guest_user() is True
    assert security_manager.get_current_guest_user_if_guest() is not None


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_access_applies_guest_rules_for_any_username(
    guest_user_factory: Any, username: str
) -> None:
    """
    A guest whose token does not list the dashboard is denied, whatever the
    token's username claim is.
    """
    guest_user_factory(username)

    with pytest.raises(SupersetSecurityException):
        security_manager.raise_for_access(dashboard=_embedded_dashboard())


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_dao_uuid_lookup_applies_guest_rules_for_any_username(
    mocker: MockerFixture, guest_user_factory: Any, username: str
) -> None:
    guest_user_factory(username)
    dashboard = _embedded_dashboard()
    mocker.patch.object(Dashboard, "get", return_value=dashboard)

    with pytest.raises(DashboardAccessDeniedError):
        DashboardDAO.get_by_id_or_slug(str(dashboard.uuid))


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_response_schema_filters_fields_for_any_username(
    guest_user_factory: Any, username: str
) -> None:
    guest_user_factory(username)

    result = DashboardGetResponseSchema().dump(
        {
            "id": 1,
            "dashboard_title": "Dashboard",
            "changed_by_name": "Some User",
            "changed_by": {"first_name": "Some", "last_name": "User"},
            "editors": [{"id": 1, "label": "Some User", "type": 1}],
            "viewers": [{"id": 2, "label": "Other User", "type": 1}],
        }
    )

    assert result["dashboard_title"] == "Dashboard"
    for field in ("changed_by_name", "changed_by", "editors", "viewers"):
        assert field not in result


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_error_sanitization_applies_for_any_username(
    guest_user_factory: Any, username: str
) -> None:
    guest_user_factory(username)

    assert is_sanitization_required() is True
