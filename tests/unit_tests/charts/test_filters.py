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


def _compile(clause: Any) -> str:
    return str(
        clause.statement.compile(
            create_engine("sqlite://"),
            compile_kwargs={"literal_binds": True},
        )
    )


def _no_viewer_fallbacks(mocker: MockerFixture, perms: set[str]) -> Any:
    """Build the no-viewer fallback clauses for a non-admin user.

    Returns the fully-filtered Query so tests can compile and assert on the SQL.
    get_user_id() is mocked to None to keep the editor/viewer subqueries out.
    """
    from superset import db
    from superset.charts.filters import ChartFilter
    from superset.extensions import security_manager
    from superset.models.slice import Slice

    mocker.patch("superset.charts.filters.get_user_id", return_value=None)
    mocker.patch.object(
        security_manager, "get_accessible_databases", return_value=[1, 2, 3]
    )

    def _perms(perm_name: str) -> set[str]:
        return perms if perm_name == "datasource_access" else set()

    mocker.patch.object(security_manager, "user_view_menu_names", side_effect=_perms)

    filt: ChartFilter = ChartFilter.__new__(ChartFilter)
    filt.model = Slice
    return filt._apply_viewers(db.session.query(Slice))


def test_chart_filter_no_viewer_semantic_view_matches_by_perm(
    mocker: MockerFixture,
) -> None:
    """A semantic-view chart with no viewers is matched through the chart's own
    perm (the view's ``datasource_access`` perm), not through a numeric-id join
    to SqlaTable."""
    compiled = _compile(_no_viewer_fallbacks(mocker, perms={"[layer].[view](id:1)"}))

    assert "slices.datasource_type = 'semantic_view'" in compiled
    assert "'[layer].[view](id:1)'" in compiled
    # the table branch is still guarded by datasource_type so semantic-view
    # foreign ids can never ride along on the table/database join
    assert "slices.datasource_type = 'table'" in compiled
    assert "JOIN tables AS tables_1" in compiled


def test_chart_filter_no_viewer_semantic_view_excluded_without_perm(
    mocker: MockerFixture,
) -> None:
    """Without the view's datasource_access perm, the semantic-view branch
    carries no matching perm literal."""
    compiled = _compile(_no_viewer_fallbacks(mocker, perms=set()))

    assert "slices.datasource_type = 'semantic_view'" in compiled
    assert "'[layer].[view](id:1)'" not in compiled
    assert "slices.datasource_type = 'table'" in compiled


def test_chart_filter_no_viewer_table_matches_by_database_access(
    mocker: MockerFixture,
) -> None:
    """Table charts with no viewers keep the pre-existing database-access join:
    matched via the databases the user can access even without explicit perms."""
    compiled = _compile(_no_viewer_fallbacks(mocker, perms=set()))

    assert "slices.datasource_type = 'table'" in compiled
    assert "JOIN tables AS tables_1" in compiled
    assert "dbs.id IN (1, 2, 3)" in compiled
