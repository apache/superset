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

"""Tests for the embedded-guest data-query authorization helpers."""

from types import SimpleNamespace
from typing import Any

from pytest_mock import MockerFixture

from superset.extensions import security_manager
from superset.mcp_service import guest_scope


def test_is_guest_read_true_for_guest(mocker: MockerFixture) -> None:
    """The skip predicate is True for an embedded guest."""
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    assert guest_scope.is_guest_read() is True


def test_is_guest_read_false_for_non_guest(mocker: MockerFixture) -> None:
    """The skip predicate is False for a regular user."""
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    assert guest_scope.is_guest_read() is False


def test_guest_dashboard_id_non_guest_short_circuits(mocker: MockerFixture) -> None:
    """Non-guests return None without ever inspecting the chart's dashboards."""
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    has_access = mocker.patch.object(security_manager, "has_guest_access")

    chart = SimpleNamespace(dashboards=[SimpleNamespace(id=7)])

    assert guest_scope.guest_dashboard_id(chart) is None
    has_access.assert_not_called()


def test_guest_dashboard_id_returns_accessible_dashboard(
    mocker: MockerFixture,
) -> None:
    """A guest gets the id of the first dashboard it may access."""

    def _has_access(dashboard: Any) -> bool:
        return bool(dashboard.id == 7)

    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    mocker.patch.object(security_manager, "has_guest_access", side_effect=_has_access)

    chart = SimpleNamespace(dashboards=[SimpleNamespace(id=5), SimpleNamespace(id=7)])

    assert guest_scope.guest_dashboard_id(chart) == 7


def test_guest_dashboard_id_out_of_scope_returns_none(mocker: MockerFixture) -> None:
    """A guest with no access to any of the chart's dashboards gets None."""
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    mocker.patch.object(security_manager, "has_guest_access", return_value=False)

    chart = SimpleNamespace(dashboards=[SimpleNamespace(id=5)])

    assert guest_scope.guest_dashboard_id(chart) is None


def test_guest_dashboard_id_chart_without_dashboards(mocker: MockerFixture) -> None:
    """A chart with no dashboards (e.g. transient) yields None for a guest."""
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)

    assert guest_scope.guest_dashboard_id(SimpleNamespace(dashboards=None)) is None


def test_authorize_query_merges_into_dict_form_data() -> None:
    """dashboardId/slice_id are added without dropping existing form_data."""
    query_context = SimpleNamespace(slice_=object(), form_data={"existing": 1})
    chart = SimpleNamespace(id=42)

    guest_scope.authorize_query(query_context, 7, chart)

    assert query_context.form_data == {"existing": 1, "dashboardId": 7, "slice_id": 42}


def test_authorize_query_pins_slice_when_unset() -> None:
    """slice_ is pinned to the resolved chart so the tamper-guard can compare."""
    query_context = SimpleNamespace(slice_=None, form_data={})
    chart = SimpleNamespace(id=42)

    guest_scope.authorize_query(query_context, 7, chart)

    assert query_context.slice_ is chart


def test_authorize_query_keeps_existing_slice() -> None:
    """An already-resolved slice_ is not overwritten."""
    existing = object()
    query_context = SimpleNamespace(slice_=existing, form_data={})

    guest_scope.authorize_query(query_context, 7, SimpleNamespace(id=42))

    assert query_context.slice_ is existing


def test_authorize_query_replaces_non_dict_form_data() -> None:
    """When form_data is not a dict, it is set to a fresh context dict."""
    query_context = SimpleNamespace(slice_=object(), form_data=None)

    guest_scope.authorize_query(query_context, 7, SimpleNamespace(id=42))

    assert query_context.form_data == {"dashboardId": 7, "slice_id": 42}
