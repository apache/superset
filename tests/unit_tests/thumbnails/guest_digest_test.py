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
Thumbnail digests of embedded guests must reflect the guest's row level rules,
whatever the token's username claim is (including an empty one).

The guests are built through the request loader from signed tokens; only the
datasource, whose rules are resolved from the guest, is stubbed.
"""

# pylint: disable=redefined-outer-name

from typing import Any
from unittest.mock import MagicMock, PropertyMock

import pytest
from flask import current_app, g, request
from flask_appbuilder.security.sqla.models import Role
from pytest_mock import MockerFixture
from sqlalchemy import text

from superset import security_manager
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.security.guest_token import GuestTokenResourceType, GuestTokenRlsRule
from superset.thumbnails.digest import get_chart_digest, get_dashboard_digest

USERNAMES = ["embedded_viewer", ""]
USERNAME_IDS = ["non-empty-username", "empty-username"]

DATASET_ID = 3


@pytest.fixture(autouse=True)
def embedded_guests(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda feature: feature == "EMBEDDED_SUPERSET",
    )
    mocker.patch.object(security_manager, "find_role", return_value=Role(name="Public"))
    mocker.patch.object(security_manager, "_is_guest_token_revoked", return_value=False)
    mocker.patch.object(security_manager, "prefetch_rls_filters", return_value=None)


@pytest.fixture
def datasource(mocker: MockerFixture) -> MagicMock:
    """A datasource that applies the current guest's rules, as a table would."""
    ds = MagicMock(id=DATASET_ID, is_rls_supported=True)
    ds.get_sqla_row_level_filters.side_effect = lambda: [
        text(rule["clause"]) for rule in security_manager.get_guest_rls_filters(ds)
    ]
    mocker.patch.object(
        Dashboard, "datasources", new_callable=PropertyMock, return_value={ds}
    )
    mocker.patch.object(Slice, "table", new_callable=PropertyMock, return_value=ds)
    return ds


def _become_guest(username: str, clause: str) -> None:
    rls: list[GuestTokenRlsRule] = [{"dataset": str(DATASET_ID), "clause": clause}]
    token = security_manager.create_guest_access_token(
        user={"username": username},
        resources=[{"type": GuestTokenResourceType.DASHBOARD, "id": "embedded-uuid"}],
        rls=rls,
    )
    header_name = current_app.config["GUEST_TOKEN_HEADER_NAME"]
    with current_app.test_request_context(headers={header_name: token}):
        guest_user: Any = security_manager.get_guest_user_from_request(request)
    assert guest_user is not None
    g.pop("_login_user", None)
    g.user = guest_user


def _dashboard() -> Dashboard:
    return Dashboard(
        id=7,
        dashboard_title="Embedded dashboard",
        slices=[],
        position_json="{}",
        css="",
        json_metadata="{}",
    )


def _chart() -> Slice:
    return Slice(id=5, slice_name="Chart", params="{}")


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_dashboard_digest_reflects_guest_rls(
    datasource: MagicMock, username: str
) -> None:
    _become_guest(username, "tenant = 'A'")
    first = get_dashboard_digest(_dashboard())
    again = get_dashboard_digest(_dashboard())
    _become_guest(username, "tenant = 'B'")
    second = get_dashboard_digest(_dashboard())

    assert first is not None
    assert first == again
    assert second is not None
    assert first != second


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_chart_digest_reflects_guest_rls(datasource: MagicMock, username: str) -> None:
    _become_guest(username, "tenant = 'A'")
    first = get_chart_digest(_chart())
    again = get_chart_digest(_chart())
    _become_guest(username, "tenant = 'B'")
    second = get_chart_digest(_chart())

    assert first is not None
    assert first == again
    assert second is not None
    assert first != second
