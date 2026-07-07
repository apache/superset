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

These tests verify subject-based dashboard, chart, and report access filters.
"""

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.subjects.types import SubjectType


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


def test_dashboard_access_filter_uses_viewers_path():
    """Dashboard filters always respect explicit viewers when present."""
    from superset.dashboards.filters import DashboardAccessFilter

    sm = _make_sm()
    with patch("superset.dashboards.filters.security_manager", sm):
        f = DashboardAccessFilter.__new__(DashboardAccessFilter)
        with patch.object(f, "_apply_viewers", return_value="viewers_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "viewers_result"
        m.assert_called_once()


# ---------------------------------------------------------------------------
# DashboardEditableFilter
# ---------------------------------------------------------------------------


def test_dashboard_editable_filter_admin_bypass():
    """Admin gets unfiltered query."""
    from superset.dashboards.filters import DashboardEditableFilter

    sm = _make_sm(is_admin=True)
    with patch("superset.subjects.filters.security_manager", sm):
        f = DashboardEditableFilter.__new__(DashboardEditableFilter)
        query = MagicMock()
        result = f.apply(query, None)
        assert result is query


def test_dashboard_editable_filter_anonymous():
    """Anonymous user gets empty result set."""
    from superset.dashboards.filters import DashboardEditableFilter

    sm = _make_sm()
    with (
        patch("superset.subjects.filters.security_manager", sm),
        patch("superset.subjects.filters.get_user_id", return_value=None),
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


def test_chart_filter_uses_viewers_path():
    """Chart filters always respect explicit viewers when present."""
    from superset.charts.filters import ChartFilter

    sm = _make_sm()
    with patch("superset.charts.filters.security_manager", sm):
        f = ChartFilter.__new__(ChartFilter)
        with patch.object(f, "_apply_viewers", return_value="viewers_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "viewers_result"
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


def test_report_filter_uses_editor_subjects():
    """Reports are filtered by editor Subjects."""
    from superset.reports.filters import ReportScheduleFilter

    sm = _make_sm()
    with patch("superset.reports.filters.security_manager", sm):
        f = ReportScheduleFilter.__new__(ReportScheduleFilter)
        with patch.object(f, "_apply_editors", return_value="editors_result") as m:
            result = f.apply(MagicMock(), None)
        assert result == "editors_result"
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


def _assert_subject_type_filter_values(
    query: MagicMock,
    expected: list[SubjectType],
) -> None:
    expression = query.filter.call_args.args[0]
    assert expression.right.value == expected


def test_subject_type_filter_both_none():
    """Both global and entity None -> no filter, query returned unchanged."""
    query, result = _apply_subject_type_filter()
    assert result is query
    query.filter.assert_not_called()


def test_subject_type_filter_config_default_user_and_group():
    """Default config exposes user and group subjects."""
    from superset.config import SUBJECTS_RELATED_TYPES

    assert SUBJECTS_RELATED_TYPES == [SubjectType.USER, SubjectType.GROUP]


def test_subject_type_filter_global_only():
    """Global set, entity None -> filters by global types."""
    query, result = _apply_subject_type_filter(
        global_types=[SubjectType.USER, SubjectType.GROUP]
    )
    query.filter.assert_called_once()
    _assert_subject_type_filter_values(query, [SubjectType.USER, SubjectType.GROUP])
    assert result is query.filter.return_value


def test_subject_type_filter_entity_only():
    """Global None, entity set -> filters by entity types."""
    query, result = _apply_subject_type_filter(entity_types=[SubjectType.GROUP])
    query.filter.assert_called_once()
    _assert_subject_type_filter_values(query, [SubjectType.GROUP])
    assert result is query.filter.return_value


def test_subject_type_filter_entity_overrides_global():
    """Entity-specific config replaces the global config."""
    query, result = _apply_subject_type_filter(
        global_types=[SubjectType.USER],
        entity_types=[SubjectType.GROUP],
    )
    query.filter.assert_called_once()
    _assert_subject_type_filter_values(query, [SubjectType.GROUP])
    assert result is query.filter.return_value


def test_subject_type_filter_rls_roles_override_user_global():
    """RLS can expose role subjects even when the global picker only exposes users."""
    query, result = _apply_subject_type_filter(
        global_types=[SubjectType.USER],
        entity_types=[SubjectType.ROLE],
        entity_key="SUBJECTS_RELATED_TYPES_RLS",
    )
    query.filter.assert_called_once()
    _assert_subject_type_filter_values(query, [SubjectType.ROLE])
    assert result is query.filter.return_value


def test_subject_type_filter_no_entity_key():
    """Factory with entity_config_key=None -> only global config used."""
    from superset.subjects.filters import subject_type_filter

    config = {"SUBJECTS_RELATED_TYPES": [SubjectType.USER, SubjectType.ROLE]}

    filter_cls = subject_type_filter(None)
    f = object.__new__(filter_cls)
    query = MagicMock()

    with patch("superset.subjects.filters.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: config.get(key, default)
        result = f.apply(query, None)

    query.filter.assert_called_once()
    _assert_subject_type_filter_values(query, [SubjectType.USER, SubjectType.ROLE])
    assert result is query.filter.return_value


@pytest.mark.parametrize(
    ("filter_key", "model_attr", "field_name", "filter_value", "table_name"),
    [
        ("user", "user_model", "username", "admin", "ab_user"),
        ("role", "role_model", "name", "Alpha", "ab_role"),
        ("group", "group_model", "name", "Engineering", "ab_group"),
    ],
)
def test_subject_type_filter_applies_extra_related_filter(
    app_context,
    filter_key: str,
    model_attr: str,
    field_name: str,
    filter_value: str,
    table_name: str,
):
    """Subject pickers respect user/role/group EXTRA_RELATED_QUERY_FILTERS."""
    from superset import db, security_manager
    from superset.subjects.filters import subject_type_filter
    from superset.subjects.models import Subject

    model = getattr(security_manager, model_attr)
    column = getattr(model, field_name)

    def related_filter(query):
        return query.filter(column == filter_value)

    config = {
        "SUBJECTS_RELATED_TYPES": None,
        "EXTRA_RELATED_QUERY_FILTERS": {filter_key: related_filter},
    }

    filter_cls = subject_type_filter(None)
    f = object.__new__(filter_cls)
    query = db.session.query(Subject)

    with patch("superset.subjects.filters.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: config.get(key, default)
        result = f.apply(query, None)

    sql = str(result.statement.compile(compile_kwargs={"literal_binds": True}))
    assert table_name in sql
    assert filter_value in sql
