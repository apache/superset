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
"""Tests for embedded-guest access to a dashboard's member charts.

An embedded guest holds no standalone datasource grant, so the chart branch of
``raise_for_access`` must recognise dashboard-level guest access when serving a
member chart's definition. Without it the dashboard payload drops the guest's
charts (and strips their ``form_data``) and the embedded dashboard cannot render.
The grant stays bounded by the token's optional dataset allowlist.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from superset.exceptions import SupersetSecurityException
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestUser,
)
from superset.security.manager import SupersetSecurityManager


def _make_chart(dashboards: list[object], datasource_id: int = 1) -> MagicMock:
    """A member chart with no viewers and a datasource the guest cannot access
    through a standalone grant."""
    chart = MagicMock()
    chart.viewers = []
    chart.datasource = MagicMock()
    chart.datasource.id = datasource_id
    chart.dashboards = dashboards
    return chart


def _sm_for_chart_access(is_guest: bool) -> MagicMock:
    """Security-manager mock where every non-guest path to the chart is closed,
    so only the embedded-guest branch can grant access. The dataset allowlist
    helper defaults to permissive; tests tighten it where relevant."""
    sm = MagicMock(spec=SupersetSecurityManager)
    sm.is_admin.return_value = False
    sm.is_editor.return_value = False
    sm.is_viewer.return_value = False
    sm.can_access_datasource.return_value = False
    sm.is_guest_user.return_value = is_guest
    sm._guest_token_allows_dataset.return_value = True
    return sm


# ---------------------------------------------------------------------------
# raise_for_access — chart branch
# ---------------------------------------------------------------------------


def test_guest_can_access_member_chart_of_granted_dashboard() -> None:
    """A guest whose token grants a chart's dashboard may access that chart."""
    granted_dashboard = MagicMock()
    chart = _make_chart([granted_dashboard])
    sm = _sm_for_chart_access(is_guest=True)
    sm.has_guest_access.side_effect = lambda dash: dash is granted_dashboard

    with patch("superset.is_feature_enabled", return_value=True):
        SupersetSecurityManager.raise_for_access(sm, chart=chart)  # no exception


def test_guest_cannot_access_chart_outside_granted_dashboards() -> None:
    """A guest whose token grants none of a chart's dashboards is denied."""
    chart = _make_chart([MagicMock(), MagicMock()])
    sm = _sm_for_chart_access(is_guest=True)
    sm.has_guest_access.return_value = False

    with patch("superset.is_feature_enabled", return_value=True):
        with pytest.raises(SupersetSecurityException):
            SupersetSecurityManager.raise_for_access(sm, chart=chart)


def test_guest_denied_member_chart_outside_dataset_allowlist() -> None:
    """Even on a granted dashboard, a chart whose dataset the token's allowlist
    excludes stays inaccessible."""
    granted_dashboard = MagicMock()
    chart = _make_chart([granted_dashboard])
    sm = _sm_for_chart_access(is_guest=True)
    sm.has_guest_access.return_value = True
    sm._guest_token_allows_dataset.return_value = False

    with patch("superset.is_feature_enabled", return_value=True):
        with pytest.raises(SupersetSecurityException):
            SupersetSecurityManager.raise_for_access(sm, chart=chart)


def test_guest_chart_access_requires_embedded_feature_flag() -> None:
    """The guest grant is gated on EMBEDDED_SUPERSET; disabled means denied."""
    granted_dashboard = MagicMock()
    chart = _make_chart([granted_dashboard])
    sm = _sm_for_chart_access(is_guest=True)
    sm.has_guest_access.return_value = True

    with patch("superset.is_feature_enabled", return_value=False):
        with pytest.raises(SupersetSecurityException):
            SupersetSecurityManager.raise_for_access(sm, chart=chart)


def test_non_guest_denied_without_consulting_dashboard_membership() -> None:
    """A non-guest with no chart access is still denied, and the guest branch
    (dashboard membership) is never evaluated for them."""
    chart = _make_chart([MagicMock()])
    sm = _sm_for_chart_access(is_guest=False)

    with patch("superset.is_feature_enabled", return_value=True):
        with pytest.raises(SupersetSecurityException):
            SupersetSecurityManager.raise_for_access(sm, chart=chart)

    sm.has_guest_access.assert_not_called()


# ---------------------------------------------------------------------------
# _guest_token_allows_dataset — allowlist helper
# ---------------------------------------------------------------------------


def _guest_with_datasets(datasets: list[int] | None) -> GuestUser:
    token: GuestToken = {
        "user": {},
        "resources": [{"type": GuestTokenResourceType.DASHBOARD, "id": "dash-uuid"}],
        "rls_rules": [],
        "iat": 0,
        "exp": 9999999999,
    }
    if datasets is not None:
        token["datasets"] = datasets
    return GuestUser(token=token, roles=[])


def _sm_with_guest(guest_user: GuestUser | None) -> MagicMock:
    sm = MagicMock(spec=SupersetSecurityManager)
    sm.get_current_guest_user_if_guest.return_value = guest_user
    return sm


def test_allows_dataset_non_guest_always_true() -> None:
    sm = _sm_with_guest(None)
    assert SupersetSecurityManager._guest_token_allows_dataset(sm, 99) is True


def test_allows_dataset_no_allowlist_claim_is_true() -> None:
    sm = _sm_with_guest(_guest_with_datasets(None))
    assert SupersetSecurityManager._guest_token_allows_dataset(sm, 99) is True


def test_allows_dataset_listed_id_is_true() -> None:
    sm = _sm_with_guest(_guest_with_datasets([7, 8]))
    assert SupersetSecurityManager._guest_token_allows_dataset(sm, 7) is True


def test_allows_dataset_unlisted_id_is_false() -> None:
    sm = _sm_with_guest(_guest_with_datasets([7, 8]))
    assert SupersetSecurityManager._guest_token_allows_dataset(sm, 99) is False


def test_allows_dataset_empty_allowlist_blocks_all() -> None:
    sm = _sm_with_guest(_guest_with_datasets([]))
    assert SupersetSecurityManager._guest_token_allows_dataset(sm, 7) is False


def test_allows_dataset_malformed_allowlist_blocks() -> None:
    guest_user = _guest_with_datasets(None)
    guest_user.guest_token["datasets"] = ["7", "8"]  # type: ignore[list-item]
    sm = _sm_with_guest(guest_user)
    assert SupersetSecurityManager._guest_token_allows_dataset(sm, 7) is False
