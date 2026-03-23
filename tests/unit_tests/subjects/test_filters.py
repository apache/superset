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

"""Tests for subject-based access filters (Phase 4).

These tests verify that DashboardAccessFilter, DashboardEditableFilter,
ChartFilter, and ReportScheduleFilter properly branch on ENABLE_VIEWERS.
"""

from typing import Any
from unittest.mock import MagicMock, patch


def _make_sm(*, is_admin: bool = False, can_access_all: bool = False) -> MagicMock:
    """Build a mock security_manager with explicit return_value settings."""
    sm = MagicMock()
    sm.is_admin = MagicMock(return_value=is_admin)
    sm.can_access_all_datasources = MagicMock(return_value=can_access_all)
    sm.is_guest_user = MagicMock(return_value=False)
    sm.user_model = MagicMock()
    sm.user_model.id = 1
    sm.get_user_roles = MagicMock(return_value=[])
    return sm


# ---------------------------------------------------------------------------
# DashboardAccessFilter
# ---------------------------------------------------------------------------


def test_dashboard_access_filter_admin_bypass():
    """Admin gets unfiltered query."""
    from superset.dashboards.filters import DashboardAccessFilter

    sm = _make_sm(is_admin=True)
    with patch("superset.dashboards.filters.security_manager", sm):
        f = DashboardAccessFilter.__new__(DashboardAccessFilter)
        query = MagicMock()
        result = f.apply(query, None)
        assert result is query
        query.filter.assert_not_called()


def test_dashboard_access_filter_viewers_branch():
    """When ENABLE_VIEWERS is on, _apply_viewers is called."""
    from superset.dashboards.filters import DashboardAccessFilter

    sm = _make_sm()
    with (
        patch("superset.dashboards.filters.security_manager", sm),
        patch("superset.dashboards.filters.is_feature_enabled", return_value=True),
    ):
        f = DashboardAccessFilter.__new__(DashboardAccessFilter)
        with patch.object(f, "_apply_viewers", return_value="viewers_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "viewers_result"
        m.assert_called_once()


def test_dashboard_access_filter_legacy_branch():
    """When ENABLE_VIEWERS is off, _apply_legacy is called."""
    from superset.dashboards.filters import DashboardAccessFilter

    sm = _make_sm()
    with (
        patch("superset.dashboards.filters.security_manager", sm),
        patch("superset.dashboards.filters.is_feature_enabled", return_value=False),
    ):
        f = DashboardAccessFilter.__new__(DashboardAccessFilter)
        with patch.object(f, "_apply_legacy", return_value="legacy_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "legacy_result"
        m.assert_called_once()


# ---------------------------------------------------------------------------
# DashboardEditableFilter
# ---------------------------------------------------------------------------


def test_dashboard_editable_filter_admin_bypass():
    """Admin gets unfiltered query."""
    from superset.dashboards.filters import DashboardEditableFilter

    sm = _make_sm(is_admin=True)
    with patch("superset.dashboards.filters.security_manager", sm):
        f = DashboardEditableFilter.__new__(DashboardEditableFilter)
        query = MagicMock()
        result = f.apply(query, None)
        assert result is query


def test_dashboard_editable_filter_anonymous():
    """Anonymous user gets empty result set."""
    from superset.dashboards.filters import DashboardEditableFilter

    sm = _make_sm()
    with (
        patch("superset.dashboards.filters.security_manager", sm),
        patch("superset.dashboards.filters.is_feature_enabled", return_value=True),
        patch("superset.dashboards.filters.get_user_id", return_value=None),
    ):
        f = DashboardEditableFilter.__new__(DashboardEditableFilter)
        query = MagicMock()
        f.apply(query, None)
        query.filter.assert_called_once()


# ---------------------------------------------------------------------------
# ChartFilter
# ---------------------------------------------------------------------------


def test_chart_filter_admin_bypass():
    """can_access_all_datasources → unfiltered."""
    from superset.charts.filters import ChartFilter

    sm = _make_sm(can_access_all=True)
    with patch("superset.charts.filters.security_manager", sm):
        f = ChartFilter.__new__(ChartFilter)
        query = MagicMock()
        result = f.apply(query, None)
        assert result is query


def test_chart_filter_viewers_branch():
    """When ENABLE_VIEWERS is on, _apply_viewers is called."""
    from superset.charts.filters import ChartFilter

    sm = _make_sm()
    with (
        patch("superset.charts.filters.security_manager", sm),
        patch("superset.charts.filters.is_feature_enabled", return_value=True),
    ):
        f = ChartFilter.__new__(ChartFilter)
        with patch.object(f, "_apply_viewers", return_value="viewers_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "viewers_result"
        m.assert_called_once()


def test_chart_filter_legacy_branch():
    """When ENABLE_VIEWERS is off, _apply_legacy is called."""
    from superset.charts.filters import ChartFilter

    sm = _make_sm()
    with (
        patch("superset.charts.filters.security_manager", sm),
        patch("superset.charts.filters.is_feature_enabled", return_value=False),
    ):
        f = ChartFilter.__new__(ChartFilter)
        with patch.object(f, "_apply_legacy", return_value="legacy_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "legacy_result"
        m.assert_called_once()


# ---------------------------------------------------------------------------
# ReportScheduleFilter
# ---------------------------------------------------------------------------


def test_report_filter_admin_bypass():
    """can_access_all_datasources → unfiltered."""
    from superset.reports.filters import ReportScheduleFilter

    sm = _make_sm(can_access_all=True)
    with patch("superset.reports.filters.security_manager", sm):
        f = ReportScheduleFilter.__new__(ReportScheduleFilter)
        query = MagicMock()
        result = f.apply(query, None)
        assert result is query


def test_report_filter_viewers_branch():
    """When ENABLE_VIEWERS is on, _apply_viewers is called."""
    from superset.reports.filters import ReportScheduleFilter

    sm = _make_sm()
    with (
        patch("superset.reports.filters.security_manager", sm),
        patch("superset.reports.filters.is_feature_enabled", return_value=True),
    ):
        f = ReportScheduleFilter.__new__(ReportScheduleFilter)
        with patch.object(f, "_apply_viewers", return_value="viewers_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "viewers_result"
        m.assert_called_once()


def test_report_filter_legacy_branch():
    """When ENABLE_VIEWERS is off, _apply_legacy is called."""
    from superset.reports.filters import ReportScheduleFilter

    sm = _make_sm()
    with (
        patch("superset.reports.filters.security_manager", sm),
        patch("superset.reports.filters.is_feature_enabled", return_value=False),
    ):
        f = ReportScheduleFilter.__new__(ReportScheduleFilter)
        with patch.object(f, "_apply_legacy", return_value="legacy_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "legacy_result"
        m.assert_called_once()


# ---------------------------------------------------------------------------
# subject_type_filter factory
# ---------------------------------------------------------------------------


def _apply_subject_type_filter(
    *,
    global_types: list[int] | None = None,
    entity_types: list[int] | None = None,
    entity_key: str | None = "SUBJECTS_RELATED_TYPES_DASHBOARDS",
) -> tuple[MagicMock, Any]:
    """Helper: instantiate a factory-produced filter and call apply()."""
    from superset.subjects.filters import subject_type_filter

    config: dict[str, list[int] | None] = {}
    if global_types is not None:
        config["SUBJECTS_RELATED_TYPES"] = global_types
    if entity_types is not None and entity_key:
        config[entity_key] = entity_types

    filter_cls = subject_type_filter(entity_key)
    f = object.__new__(filter_cls)
    query = MagicMock()

    with patch("superset.subjects.filters.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: config.get(key, default)
        result = f.apply(query, None)

    return query, result


def test_subject_type_filter_both_none():
    """Both global and entity None -> no filter, query returned unchanged."""
    query, result = _apply_subject_type_filter()
    assert result is query
    query.filter.assert_not_called()


def test_subject_type_filter_global_only():
    """Global set, entity None -> filters by global types."""
    query, result = _apply_subject_type_filter(global_types=[1, 3])
    query.filter.assert_called_once()
    assert result is query.filter.return_value


def test_subject_type_filter_entity_only():
    """Global None, entity set -> filters by entity types."""
    query, result = _apply_subject_type_filter(entity_types=[3])
    query.filter.assert_called_once()
    assert result is query.filter.return_value


def test_subject_type_filter_intersection():
    """Both set -> intersection applied."""
    query, result = _apply_subject_type_filter(global_types=[1, 3], entity_types=[3])
    query.filter.assert_called_once()
    assert result is query.filter.return_value


def test_subject_type_filter_disjoint():
    """Disjoint sets -> empty intersection, still calls filter (with empty set)."""
    query, result = _apply_subject_type_filter(global_types=[1, 3], entity_types=[2])
    query.filter.assert_called_once()
    assert result is query.filter.return_value


def test_subject_type_filter_no_entity_key():
    """Factory with entity_config_key=None -> only global config used."""
    from superset.subjects.filters import subject_type_filter

    config = {"SUBJECTS_RELATED_TYPES": [1, 2]}

    filter_cls = subject_type_filter(None)
    f = object.__new__(filter_cls)
    query = MagicMock()

    with patch("superset.subjects.filters.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: config.get(key, default)
        result = f.apply(query, None)

    query.filter.assert_called_once()
    assert result is query.filter.return_value
