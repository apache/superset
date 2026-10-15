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
from superset.models.embedded_dashboard import EmbeddedDashboard
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


def _guest_user_from_token(
    mocker: MockerFixture, username: str, resource_ids: list[str]
) -> GuestUser:
    """
    Build the guest user the same way the request loader does: sign a token with
    the given ``user.username`` claim and dashboard resources, and parse it from
    the request headers.
    """
    mocker.patch.object(security_manager, "find_role", return_value=Role(name="Public"))
    mocker.patch.object(security_manager, "_is_guest_token_revoked", return_value=False)
    token = security_manager.create_guest_access_token(
        user={"username": username},
        resources=[
            {"type": GuestTokenResourceType.DASHBOARD, "id": resource_id}
            for resource_id in resource_ids
        ],
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
    def _make(username: str, resource_ids: list[str] | None = None) -> GuestUser:
        guest_user = _guest_user_from_token(
            mocker, username, resource_ids if resource_ids is not None else []
        )
        g.user = guest_user
        return guest_user

    return _make


def _embedded_dashboard() -> Dashboard:
    """
    A published, chart-less dashboard with an embedded configuration, so that
    guest access depends only on whether the token lists the embedded UUID.
    """
    dashboard = Dashboard(
        id=42,
        dashboard_title="Embedded dashboard",
        published=True,
        slices=[],
    )
    dashboard.uuid = uuid4()
    dashboard.embedded = [EmbeddedDashboard(uuid=uuid4(), allow_domain_list="")]
    return dashboard


def _unlisted_resource_ids() -> list[str]:
    """Resource ids that do not match the embedded dashboard under test."""
    return [str(uuid4())]


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_is_guest_user_does_not_depend_on_username(
    guest_user_factory: Any, username: str
) -> None:
    guest_user_factory(username)

    assert security_manager.is_guest_user() is True
    assert security_manager.get_current_guest_user_if_guest() is not None


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_access_denied_when_embedded_uuid_not_in_token(
    guest_user_factory: Any, username: str
) -> None:
    """
    A guest whose token does not list the embedded dashboard is denied, whatever
    the token's username claim is.
    """
    dashboard = _embedded_dashboard()
    guest_user_factory(username, _unlisted_resource_ids())

    assert dashboard.embedded
    assert security_manager.has_guest_access(dashboard) is False
    with pytest.raises(SupersetSecurityException):
        security_manager.raise_for_access(dashboard=dashboard)


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_access_allowed_when_embedded_uuid_in_token(
    guest_user_factory: Any, username: str
) -> None:
    dashboard = _embedded_dashboard()
    guest_user_factory(username, [str(dashboard.embedded[0].uuid)])

    assert security_manager.has_guest_access(dashboard) is True
    security_manager.raise_for_access(dashboard=dashboard)


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_dao_uuid_lookup_denied_when_embedded_uuid_not_in_token(
    mocker: MockerFixture, guest_user_factory: Any, username: str
) -> None:
    dashboard = _embedded_dashboard()
    guest_user_factory(username, _unlisted_resource_ids())
    mocker.patch.object(Dashboard, "get", return_value=dashboard)

    with pytest.raises(DashboardAccessDeniedError):
        DashboardDAO.get_by_id_or_slug(str(dashboard.uuid))


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_dao_uuid_lookup_allowed_when_embedded_uuid_in_token(
    mocker: MockerFixture, guest_user_factory: Any, username: str
) -> None:
    dashboard = _embedded_dashboard()
    guest_user_factory(username, [str(dashboard.embedded[0].uuid)])
    mocker.patch.object(Dashboard, "get", return_value=dashboard)

    assert DashboardDAO.get_by_id_or_slug(str(dashboard.uuid)) is dashboard


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
