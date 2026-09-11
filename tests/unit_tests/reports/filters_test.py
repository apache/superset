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
from unittest.mock import MagicMock, patch


@patch("superset.reports.filters.security_manager", new_callable=MagicMock)
def test_report_schedule_filter_admin_sees_all(mock_sm: MagicMock) -> None:
    from superset.reports.filters import ReportScheduleFilter

    mock_sm.can_access_all_datasources.return_value = True
    query = MagicMock()
    f = ReportScheduleFilter("id", MagicMock())
    result = f.apply(query, None)
    assert result is query
    query.filter.assert_not_called()


@patch("superset.reports.filters.security_manager", new_callable=MagicMock)
@patch("superset.reports.filters.db")
def test_report_schedule_filter_non_admin_filtered(
    mock_db: MagicMock, mock_sm: MagicMock
) -> None:
    from superset.reports.filters import ReportScheduleFilter

    mock_sm.can_access_all_datasources.return_value = False
    mock_sm.user_model.get_user_id.return_value = 1
    mock_sm.user_model.id = 1
    query = MagicMock()
    f = ReportScheduleFilter("id", MagicMock())
    f.apply(query, None)
    query.filter.assert_called_once()


def test_report_schedule_all_text_filter_empty_noop() -> None:
    from superset.reports.filters import ReportScheduleAllTextFilter

    query = MagicMock()
    f = ReportScheduleAllTextFilter("name", MagicMock())
    result = f.apply(query, "")
    assert result is query
    query.filter.assert_not_called()


def test_report_schedule_all_text_filter_applies_ilike() -> None:
    from superset.reports.filters import ReportScheduleAllTextFilter

    query = MagicMock()
    f = ReportScheduleAllTextFilter("name", MagicMock())
    f.apply(query, "test")
    query.filter.assert_called_once()


@patch("superset.reports.filters.or_")
@patch("superset.reports.filters.ReportSchedule")
def test_report_schedule_all_text_filter_escapes_wildcards(
    mock_report_schedule: MagicMock, mock_or: MagicMock
) -> None:
    """User-supplied wildcards must be escaped so they match literally."""
    from superset.reports.filters import ReportScheduleAllTextFilter

    query = MagicMock()
    f = ReportScheduleAllTextFilter("name", MagicMock())
    # raw input contains every LIKE special character plus a backslash
    f.apply(query, "50%_off\\promo")

    # %, _ and \ are all escaped, and the literal is wrapped for a "contains" match
    expected = "%50\\%\\_off\\\\promo%"
    for column in (
        mock_report_schedule.name,
        mock_report_schedule.description,
        mock_report_schedule.sql,
    ):
        column.ilike.assert_called_once_with(expected, escape="\\")


@patch("superset.reports.filters.or_")
@patch("superset.reports.filters.ReportSchedule")
def test_report_schedule_all_text_filter_coerces_non_string(
    mock_report_schedule: MagicMock, mock_or: MagicMock
) -> None:
    """A non-string value (e.g. an int) must not raise when escaping."""
    from superset.reports.filters import ReportScheduleAllTextFilter

    query = MagicMock()
    f = ReportScheduleAllTextFilter("name", MagicMock())
    f.apply(query, 50)

    expected = "%50%"
    for column in (
        mock_report_schedule.name,
        mock_report_schedule.description,
        mock_report_schedule.sql,
    ):
        column.ilike.assert_called_once_with(expected, escape="\\")


@patch("superset.reports.filters.security_manager", new_callable=MagicMock)
def test_report_execution_log_filter_admin_sees_all(mock_sm: MagicMock) -> None:
    """
    Regression test: ``ReportExecutionLogRestApi`` had no base filter at all,
    so any role with generic ReportSchedule read could iterate every
    schedule's logs by pk. An admin (can_access_all_queries) must still
    see everything unfiltered.
    """
    from superset.reports.filters import ReportExecutionLogFilter

    mock_sm.can_access_all_queries.return_value = True
    query = MagicMock()
    f = ReportExecutionLogFilter("id", MagicMock())
    result = f.apply(query, None)
    assert result is query
    query.filter.assert_not_called()


@patch("superset.reports.filters.security_manager", new_callable=MagicMock)
def test_report_execution_log_filter_stock_alpha_is_scoped(
    mock_sm: MagicMock,
) -> None:
    """
    Regression test: the unrestricted bypass used to key off
    ``can_access_all_datasources``, which is also granted to stock Alpha
    (see ``SupersetSecurityManager.ALPHA_ONLY_PERMISSIONS``), letting a
    non-editor Alpha user read every other schedule's evaluated alert
    values and database errors. The bypass must require
    ``can_access_all_queries`` (admin-only) instead, matching the
    equivalent per-execution SQL Lab query history filter
    (``superset.queries.filters.QueryFilter``).
    """
    from superset.reports.filters import ReportExecutionLogFilter

    mock_sm.can_access_all_datasources.return_value = True
    mock_sm.can_access_all_queries.return_value = False
    query = MagicMock()
    f = ReportExecutionLogFilter("id", MagicMock())
    f.apply(query, None)
    query.filter.assert_called_once()


@patch("superset.reports.filters.security_manager", new_callable=MagicMock)
@patch("superset.reports.filters.db")
def test_report_execution_log_filter_non_admin_scoped_to_log_fk(
    mock_db: MagicMock, mock_sm: MagicMock
) -> None:
    """
    A non-admin must be scoped by ``ReportExecutionLog.report_schedule_id``
    directly (not by an unjoined filter on ``ReportSchedule.id``, which would
    pass for any log row as long as the caller edits at least one schedule).
    """
    from superset.reports.filters import ReportExecutionLogFilter
    from superset.reports.models import ReportExecutionLog

    mock_sm.can_access_all_queries.return_value = False
    query = MagicMock()
    f = ReportExecutionLogFilter("id", MagicMock())
    f.apply(query, None)

    query.filter.assert_called_once()
    (filter_expr,) = query.filter.call_args[0]
    assert filter_expr.left.table is ReportExecutionLog.__table__
    assert filter_expr.left.name == "report_schedule_id"
