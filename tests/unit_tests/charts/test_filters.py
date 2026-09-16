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

"""Tests for the ``ChartFilter`` embedded-guest scoping branch."""

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine


def test_chart_filter_scopes_guest_to_token_dashboards(mocker: MockerFixture) -> None:
    """A guest's chart list is scoped to the dashboards in its token."""
    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    mocker.patch(
        "superset.charts.filters.guest_embedded_dashboard_filter",
        return_value=Dashboard.id.in_([1, 2]),
    )

    captured: dict[str, Any] = {}
    query: MagicMock = MagicMock()

    def _capture_filter(clause: object) -> MagicMock:
        captured["clause"] = clause
        return query

    query.filter.side_effect = _capture_filter

    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice
    result = filt.apply(query, None)

    assert result is query
    query.filter.assert_called_once()
    # Guest branch returns early: it must NOT take the datasource-access join path.
    query.join.assert_not_called()

    compiled: str = str(
        captured["clause"].compile(
            create_engine("sqlite://"),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "EXISTS" in compiled  # scoped via the m2m dashboards relationship
    assert "IN (1, 2)" in compiled


def test_chart_filter_non_guest_skips_guest_branch(mocker: MockerFixture) -> None:
    """With no embedded guest, ChartFilter does not take the guest branch (it
    proceeds to the normal viewer-access path instead of filtering on dashboards)."""
    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.slice import Slice

    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    guest_filter: MagicMock = mocker.patch(
        "superset.charts.filters.guest_embedded_dashboard_filter", return_value=None
    )
    # Stop apply right after the guest check — reaching the viewer-access path
    # proves the guest branch was skipped.
    sentinel: RuntimeError = RuntimeError("reached viewer-access path")
    mocker.patch.object(ChartFilter, "_apply_viewers", side_effect=sentinel)
    query: MagicMock = MagicMock()

    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice

    with pytest.raises(RuntimeError, match="viewer-access path"):
        filt.apply(query, None)

    guest_filter.assert_called_once()
    query.filter.assert_not_called()  # guest branch (query.filter) was NOT taken


def test_chart_filter_admin_bypasses_all_scoping(mocker: MockerFixture) -> None:
    """A non-guest who can access all datasources gets the query back untouched.

    The guest scope check runs first but returns None for a non-guest, so the
    all-datasources bypass still applies.
    """
    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.slice import Slice

    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    guest_filter: MagicMock = mocker.patch(
        "superset.charts.filters.guest_embedded_dashboard_filter", return_value=None
    )

    query: MagicMock = MagicMock()
    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice

    assert filt.apply(query, None) is query
    query.filter.assert_not_called()
    guest_filter.assert_called_once()


def test_chart_filter_guest_scoped_even_with_all_datasource_access(
    mocker: MockerFixture,
) -> None:
    """A guest is scoped to its token's dashboards even when its role can access
    all datasources: the guest branch runs before the all-datasources bypass."""
    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    can_access = mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    mocker.patch(
        "superset.charts.filters.guest_embedded_dashboard_filter",
        return_value=Dashboard.id.in_([1, 2]),
    )
    query: MagicMock = MagicMock()
    query.filter.return_value = query
    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice

    assert filt.apply(query, None) is query
    # Scoped via the guest branch — NOT returned untouched by the all-access path.
    query.filter.assert_called_once()
    can_access.assert_not_called()


def test_chart_filter_guest_no_resources_denied(mocker: MockerFixture) -> None:
    """A guest whose token has no dashboards is denied all charts: the filter
    returns a deny-all clause (not None), so apply scopes rather than falling
    through to role-based access."""
    from sqlalchemy import false

    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.slice import Slice

    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    mocker.patch(
        "superset.charts.filters.guest_embedded_dashboard_filter",
        return_value=false(),
    )
    viewers = mocker.patch.object(
        ChartFilter, "_apply_viewers", side_effect=AssertionError("role path")
    )
    query: MagicMock = MagicMock()
    query.filter.return_value = query
    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice

    assert filt.apply(query, None) is query
    query.filter.assert_called_once()  # scoped (to nothing), not role-based
    viewers.assert_not_called()


def _guest_with_resources(mocker: MockerFixture, resources: list[dict[str, Any]]):
    """Point the security manager at a guest user carrying ``resources``."""
    from superset.extensions import security_manager

    guest: MagicMock = MagicMock()
    guest.resources = resources
    return mocker.patch.object(
        security_manager, "get_current_guest_user_if_guest", return_value=guest
    )


def test_guest_embedded_chart_filter_matches_token_charts(
    mocker: MockerFixture,
) -> None:
    """A token's chart resources become an EXISTS over the chart's embed rows."""
    from superset.charts.filters import guest_embedded_chart_filter

    _guest_with_resources(
        mocker,
        [
            {"type": "chart", "id": "11111111-1111-1111-1111-111111111111"},
            {"type": "dashboard", "id": "22222222-2222-2222-2222-222222222222"},
        ],
    )

    clause = guest_embedded_chart_filter()
    assert clause is not None
    compiled: str = str(clause.compile(create_engine("sqlite://")))
    assert "EXISTS" in compiled
    # Scoped through the chart's own embed config, not through dashboards.
    assert "embedded_charts" in compiled


def test_guest_embedded_chart_filter_none_without_chart_resources(
    mocker: MockerFixture,
) -> None:
    """A dashboard-only token contributes nothing to the chart scope, so the
    dashboard branch alone decides what the guest sees."""
    from superset.charts.filters import guest_embedded_chart_filter

    _guest_with_resources(mocker, [{"type": "dashboard", "id": "abc"}])

    assert guest_embedded_chart_filter() is None


def test_guest_embedded_chart_filter_none_for_non_guest(mocker: MockerFixture) -> None:
    from superset.charts.filters import guest_embedded_chart_filter
    from superset.extensions import security_manager

    mocker.patch.object(
        security_manager, "get_current_guest_user_if_guest", return_value=None
    )

    assert guest_embedded_chart_filter() is None


def test_chart_filter_scopes_guest_to_token_charts(mocker: MockerFixture) -> None:
    """A token issued for a standalone embedded chart resolves that chart.

    Without the chart branch the dashboard scope is a deny-all clause, so the
    chart the token was minted for is filtered out of the Chart API entirely.
    """
    from sqlalchemy import false

    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.slice import Slice

    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    mocker.patch(
        "superset.charts.filters.guest_embedded_dashboard_filter",
        return_value=false(),
    )
    _guest_with_resources(
        mocker, [{"type": "chart", "id": "11111111-1111-1111-1111-111111111111"}]
    )

    captured: dict[str, Any] = {}
    query: MagicMock = MagicMock()

    def _capture_filter(clause: object) -> MagicMock:
        captured["clause"] = clause
        return query

    query.filter.side_effect = _capture_filter

    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice
    assert filt.apply(query, None) is query
    query.filter.assert_called_once()
    query.join.assert_not_called()

    compiled: str = str(captured["clause"].compile(create_engine("sqlite://")))
    assert "embedded_charts" in compiled


def test_chart_filter_guest_scope_unions_dashboards_and_charts(
    mocker: MockerFixture,
) -> None:
    """A token holding both resource kinds resolves both, and nothing else."""
    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    mocker.patch(
        "superset.charts.filters.guest_embedded_dashboard_filter",
        return_value=Dashboard.id.in_([1, 2]),
    )
    _guest_with_resources(
        mocker,
        [
            {"type": "dashboard", "id": "1"},
            {"type": "chart", "id": "11111111-1111-1111-1111-111111111111"},
        ],
    )

    captured: dict[str, Any] = {}
    query: MagicMock = MagicMock()

    def _capture_filter(clause: object) -> MagicMock:
        captured["clause"] = clause
        return query

    query.filter.side_effect = _capture_filter

    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice
    filt.apply(query, None)

    compiled: str = str(captured["clause"].compile(create_engine("sqlite://")))
    assert "dashboard_slices" in compiled
    assert "embedded_charts" in compiled
    assert " OR " in compiled
