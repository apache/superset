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
"""Time range limits on scheduled reports, against a real metadata database."""

from __future__ import annotations

import copy
from collections.abc import Iterator
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from freezegun import freeze_time

from superset import db
from superset.commands.report.exceptions import (
    ReportScheduleClientErrorsException,
)
from superset.commands.report.execute import AsyncExecuteReportScheduleCommand
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import feature_flag_manager
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import (
    ReportDataFormat,
    ReportExecutionLog,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from tests.fixtures.time_range_query_paths import BAD_GLOBAL
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.reports.utils import (
    cleanup_report_schedule,
    create_report_notification,
    DEFAULT_OWNER_EMAIL,
    SCREENSHOT_FILE,
    TEST_ID,
)
from tests.integration_tests.test_app import app, login

# resolved when each test starts: some modules replace app.config wholesale
APP_CONFIG = "tests.integration_tests.test_app.app.config"
GUARD = "Range can't be longer than 90 days. This one is 365 days."
UNCHECKED = "Time range limits could not be checked for this chart."
TARGET = "target@email.com"
GLOBAL_90_DAYS = {
    "TIME_RANGE_LIMITS_GLOBAL": {
        "schema_version": 1,
        "max_span": {"quantity": 90, "time_grain": "P1D"},
        "max_look_back": None,
        "max_look_forward": None,
    },
    "ALERT_REPORTS_NOTIFICATION_DRY_RUN": False,
}
FLAGS_ON = {FEATURE_FLAG: True}
STORED_LAST_YEAR = {
    "nativeFilters": [
        {
            "nativeFilterId": "NATIVE_FILTER-time",
            "filterType": "filter_time",
            "columnName": "ds",
            "filterValues": ["Last year"],
        }
    ]
}


@pytest.fixture(autouse=True)
def stable_report_clock() -> Iterator[None]:
    """Keep relative report ranges stable across leap and non-leap years."""
    with freeze_time("2026-10-21 12:00:00"):
        yield


def saved_chart(table: SqlaTable, name: str, time_range: str) -> Slice:
    form_data = {
        "datasource": f"{table.id}__table",
        "viz_type": "echarts_timeseries_line",
        "x_axis": "ds",
        "time_range": time_range,
        "metrics": ["count"],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": time_range,
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "ds",
            }
        ],
    }
    query_context = {
        "datasource": {"id": table.id, "type": "table"},
        "queries": [
            {
                "filters": [{"col": "ds", "op": "TEMPORAL_RANGE", "val": time_range}],
                "metrics": ["count"],
                "columns": [],
                "time_range": time_range,
            }
        ],
        "form_data": form_data,
        "result_type": "full",
        "result_format": "json",
    }
    return Slice(
        slice_name=name,
        viz_type="echarts_timeseries_line",
        datasource_type="table",
        datasource_id=table.id,
        params=json.dumps(form_data),
        query_context=json.dumps(query_context),
    )


@pytest.fixture
def report_dashboard(
    load_birth_names_dashboard_with_slices: Any,  # noqa: F811
) -> Iterator[Dashboard]:
    """
    Two charts saved with "Last year". A time range filter's default "Last 30
    days" applies to the first one only.
    """
    with app.app_context():
        table = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
        charts = [
            saved_chart(table, "Calls by day", "Last year"),
            saved_chart(table, "Calls by agent", "Last year"),
        ]
        db.session.add_all(charts)
        db.session.flush()
        position: dict[str, Any] = {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-1"]},
            "ROW-1": {
                "id": "ROW-1",
                "type": "ROW",
                "children": [f"CHART-{slc.id}" for slc in charts],
            },
        }
        for slc in charts:
            position[f"CHART-{slc.id}"] = {
                "id": f"CHART-{slc.id}",
                "type": "CHART",
                "children": [],
                "meta": {"chartId": slc.id},
            }
        native_filter = {
            "id": "NATIVE_FILTER-time",
            "type": "NATIVE_FILTER",
            "filterType": "filter_time",
            "targets": [{}],
            "scope": {"rootPath": ["ROOT_ID"], "excluded": [charts[1].id]},
            "defaultDataMask": {
                "filterState": {"value": "Last 30 days"},
                "extraFormData": {"time_range": "Last 30 days"},
            },
        }
        dashboard = Dashboard(
            dashboard_title="Time range limits reports",
            slug=f"time-range-limits-reports-{uuid4().hex[:8]}",
            slices=charts,
            position_json=json.dumps(position),
            json_metadata=json.dumps({"native_filter_configuration": [native_filter]}),
            published=True,
        )
        db.session.add(dashboard)
        db.session.commit()

        yield dashboard

        db.session.delete(dashboard)
        for slc in charts:
            db.session.delete(slc)
        db.session.commit()


def scope_to_every_chart(dashboard: Dashboard) -> None:
    metadata = json.loads(dashboard.json_metadata)
    metadata["native_filter_configuration"][0]["scope"]["excluded"] = []
    dashboard.json_metadata = json.dumps(metadata)
    db.session.commit()


@pytest.fixture
def chart_report(report_dashboard: Dashboard) -> Iterator[ReportSchedule]:
    report_schedule = create_report_notification(
        email_target=TARGET,
        chart=report_dashboard.slices[0],
        report_format=ReportDataFormat.CSV,
        name="Time range limits chart report",
        retry_on_failure=True,
        send_failed_reports=True,
        retry_notify_recipients=True,
    )
    yield report_schedule
    cleanup_report_schedule(report_schedule)


@pytest.fixture
def dashboard_report(report_dashboard: Dashboard) -> Iterator[ReportSchedule]:
    report_schedule = create_report_notification(
        email_target=TARGET,
        dashboard=report_dashboard,
        name="Time range limits dashboard report",
    )
    yield report_schedule
    cleanup_report_schedule(report_schedule)


@pytest.fixture
def alert(report_dashboard: Dashboard) -> Iterator[ReportSchedule]:
    table = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
    report_schedule = create_report_notification(
        email_target=TARGET,
        chart=report_dashboard.slices[0],
        report_type=ReportScheduleType.ALERT,
        database=table.database,
        sql="SELECT 1",
        validator_type="operator",
        validator_config_json='{"op": ">", "threshold": 0}',
        name="Time range limits alert",
    )
    yield report_schedule
    cleanup_report_schedule(report_schedule)


def execution_logs(report_schedule: ReportSchedule) -> list[tuple[str, str | None]]:
    db.session.commit()
    return [
        (log.state, log.error_message)
        for log in db.session.query(ReportExecutionLog)
        .filter(ReportExecutionLog.report_schedule_id == report_schedule.id)
        .order_by(ReportExecutionLog.id)
    ]


def run_report(report_schedule: ReportSchedule) -> None:
    AsyncExecuteReportScheduleCommand(
        TEST_ID, report_schedule.id, datetime.utcnow()
    ).run()


def assert_failed_and_editor_notified(
    report_schedule: ReportSchedule, message: str, email_mock: MagicMock
) -> None:
    assert execution_logs(report_schedule) == [
        (ReportState.ERROR, message),
        (ReportState.ERROR, "Notification sent with error"),
    ]
    assert email_mock.call_count == 1
    to, _subject, body = email_mock.call_args[0][:3]
    assert to == DEFAULT_OWNER_EMAIL
    assert message in body
    assert "SupersetError(" not in body


@pytest.mark.usefixtures("chart_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORTS_RETRY=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.commands.report.execute.BaseReportState._get_data")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
@patch.object(SqlaTable, "query", side_effect=AssertionError("SQL ran"))
def test_chart_report_fails_at_once_and_notifies_the_editor(
    query_mock: MagicMock,
    screenshot_mock: MagicMock,
    csv_mock: MagicMock,
    email_mock: MagicMock,
    chart_report: ReportSchedule,
) -> None:
    with pytest.raises(ReportScheduleClientErrorsException):
        run_report(chart_report)

    assert_failed_and_editor_notified(chart_report, GUARD, email_mock)
    assert all(call[0][0] != TARGET for call in email_mock.call_args_list)
    db.session.refresh(chart_report)
    assert chart_report.retry_attempt == 0
    screenshot_mock.assert_not_called()
    csv_mock.assert_not_called()
    query_mock.assert_not_called()


@pytest.mark.usefixtures("chart_report")
@with_feature_flags(**{FEATURE_FLAG: False})
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.commands.report.execute.BaseReportState._get_data")
@patch("superset.commands.report.execute.check_chart_date_ranges")
def test_chart_report_flag_off_is_sent_unchecked(
    check_mock: MagicMock,
    csv_mock: MagicMock,
    email_mock: MagicMock,
    chart_report: ReportSchedule,
) -> None:
    csv_mock.return_value = b"a,b\n1,2\n"

    run_report(chart_report)

    assert execution_logs(chart_report) == [(ReportState.SUCCESS, None)]
    assert email_mock.call_args[0][0] == TARGET
    check_mock.assert_not_called()


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
@patch.object(SqlaTable, "query", side_effect=AssertionError("SQL ran"))
def test_dashboard_report_fails_on_one_chart(
    query_mock: MagicMock,
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    with pytest.raises(ReportScheduleClientErrorsException) as info:
        run_report(dashboard_report)

    second = dashboard_report.dashboard.slices[1]
    assert [error.extra["chart_id"] for error in info.value.errors] == [second.id]
    assert_failed_and_editor_notified(
        dashboard_report, f"Calls by agent: {GUARD}", email_mock
    )
    screenshot_mock.assert_not_called()
    query_mock.assert_not_called()


@pytest.mark.usefixtures("dashboard_report")
@pytest.mark.parametrize("tabs_flag", [True, False], ids=["tabs-on", "tabs-off"])
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
@patch.object(SqlaTable, "query", side_effect=AssertionError("SQL ran"))
def test_dashboard_report_stored_filter_over_the_limits_fails(
    query_mock: MagicMock,
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
    tabs_flag: bool,
) -> None:
    """A stored "Last year" never reaches the page (its quotes don't decode), so
    the page renders the "Last 30 days" default; the stored value is checked on
    its own and fails."""
    dashboard_report.extra_json = json.dumps({"dashboard": STORED_LAST_YEAR})
    db.session.commit()
    scope_to_every_chart(dashboard_report.dashboard)

    with patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={
            **(feature_flag_manager._feature_flags or {}),
            FEATURE_FLAG: True,
            "ALERT_REPORT_TABS": tabs_flag,
        },
    ):
        with pytest.raises(ReportScheduleClientErrorsException):
            run_report(dashboard_report)

    assert_failed_and_editor_notified(
        dashboard_report, f"Calls by day: {GUARD};Calls by agent: {GUARD}", email_mock
    )
    screenshot_mock.assert_not_called()
    query_mock.assert_not_called()


JSON = {"Accept": "application/json"}


def report_payload(dashboard: Dashboard, name: str) -> dict[str, Any]:
    return {
        "type": ReportScheduleType.REPORT,
        "name": name,
        "description": "description",
        "creation_method": "alerts_reports",
        "crontab": "0 9 * * *",
        "working_timeout": 3600,
        "dashboard": dashboard.id,
        "extra": {"dashboard": copy.deepcopy(STORED_LAST_YEAR)},
    }


def delete_reports(*names: str) -> None:
    db.session.rollback()
    for report_schedule in db.session.query(ReportSchedule).filter(
        ReportSchedule.name.in_(names)
    ):
        cleanup_report_schedule(report_schedule)


@pytest.fixture
def admin_client(report_dashboard: Dashboard) -> Iterator[Any]:
    """A client logged in as admin, in the app context of the report fixtures."""
    with app.test_client() as client:
        login(client)
        yield client


def assert_unavailable(response: Any) -> None:
    assert response.status_code == 503, response.json
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert error["extra"]["reason_code"] == "POLICY_UNAVAILABLE"
    assert error["extra"]["source"] == "global"
    assert "value" not in error["extra"]


@with_feature_flags(**FLAGS_ON)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
def test_report_create_refuses_an_over_limit_stored_range(
    report_dashboard: Dashboard, admin_client: Any
) -> None:
    scope_to_every_chart(report_dashboard)
    names = (
        f"Over the limits {uuid4().hex[:8]}",
        f"Inside the limits {uuid4().hex[:8]}",
    )
    try:
        refused = admin_client.post(
            "/api/v1/report/",
            json=report_payload(report_dashboard, names[0]),
            headers=JSON,
        )
        inside = report_payload(report_dashboard, names[1])
        inside["extra"]["dashboard"]["nativeFilters"] = [
            {**STORED_LAST_YEAR["nativeFilters"][0], "filterValues": ["Last 30 days"]}
        ]
        created = admin_client.post("/api/v1/report/", json=inside, headers=JSON)

        assert refused.status_code == 422, refused.json
        assert refused.json["message"]["extra"] == [
            f"Calls by day: {GUARD}",
            f"Calls by agent: {GUARD}",
        ]
        assert created.status_code == 201, created.json
        assert not db.session.query(ReportSchedule).filter_by(name=names[0]).count()
    finally:
        delete_reports(*names)


@with_feature_flags(**FLAGS_ON)
@patch.dict(APP_CONFIG, {"TIME_RANGE_LIMITS_GLOBAL": BAD_GLOBAL})
def test_report_create_answers_503_under_a_bad_global(
    report_dashboard: Dashboard, admin_client: Any
) -> None:
    name = f"Bad global {uuid4().hex[:8]}"
    try:
        response = admin_client.post(
            "/api/v1/report/", json=report_payload(report_dashboard, name), headers=JSON
        )

        assert_unavailable(response)
        assert not db.session.query(ReportSchedule).filter_by(name=name).count()
    finally:
        delete_reports(name)


@with_feature_flags(**FLAGS_ON)
@patch.dict(APP_CONFIG, {"TIME_RANGE_LIMITS_GLOBAL": BAD_GLOBAL})
def test_report_update_answers_503_under_a_bad_global(
    dashboard_report: ReportSchedule, admin_client: Any
) -> None:
    report_id = dashboard_report.id

    response = admin_client.put(
        f"/api/v1/report/{report_id}",
        json={"extra": {"dashboard": STORED_LAST_YEAR}},
        headers=JSON,
    )

    assert_unavailable(response)
    db.session.expire_all()
    stored = admin_client.get(f"/api/v1/report/{report_id}", headers=JSON)
    assert stored.status_code == 200
    assert "nativeFilters" not in (stored.json["result"]["extra"] or {}).get(
        "dashboard", {}
    )


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORT_TABS=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
@patch.object(SqlaTable, "query", side_effect=AssertionError("SQL ran"))
def test_dashboard_report_own_value_replaces_a_good_stored_data_mask(
    query_mock: MagicMock,
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    """The page renders the report's own stored "Last year" in place of the
    permalink's "Last 30 days", so the report is refused."""
    scope_to_every_chart(dashboard_report.dashboard)
    dashboard_report.extra_json = json.dumps(
        {
            "dashboard": {
                **STORED_LAST_YEAR,
                "urlParams": [["standalone", "true"]],
                "dataMask": {
                    "NATIVE_FILTER-time": {
                        "extraFormData": {"time_range": "Last 30 days"},
                        "filterState": {"value": "Last 30 days"},
                    }
                },
            }
        }
    )
    db.session.commit()

    with pytest.raises(ReportScheduleClientErrorsException):
        run_report(dashboard_report)

    assert_failed_and_editor_notified(
        dashboard_report, f"Calls by day: {GUARD};Calls by agent: {GUARD}", email_mock
    )
    screenshot_mock.assert_not_called()
    query_mock.assert_not_called()


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORT_TABS=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_dashboard_report_unmodelled_url_param_fails_closed(
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    scope_to_every_chart(dashboard_report.dashboard)
    dashboard_report.extra_json = json.dumps(
        {"dashboard": {"urlParams": [["region", "EU"]]}}
    )
    db.session.commit()

    with pytest.raises(ReportScheduleClientErrorsException):
        run_report(dashboard_report)

    assert_failed_and_editor_notified(
        dashboard_report,
        f"Calls by day: {UNCHECKED};Calls by agent: {UNCHECKED}",
        email_mock,
    )
    screenshot_mock.assert_not_called()


def stored_select_filter(value: str) -> dict[str, Any]:
    return {
        "nativeFilters": [
            {
                "nativeFilterId": "NATIVE_FILTER-name",
                "filterType": "filter_select",
                "columnName": "name",
                "filterValues": [value],
            }
        ]
    }


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORT_TABS=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_dashboard_report_own_filter_value_replaces_the_stored_data_mask(
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    """The page decodes the report's own value and renders it in place of the
    stored "Last year" data mask, so the "Last 30 days" default gets checked."""
    screenshot_mock.return_value = SCREENSHOT_FILE
    scope_to_every_chart(dashboard_report.dashboard)
    dashboard_report.extra_json = json.dumps(
        {
            "dashboard": {
                **stored_select_filter("abc"),
                "urlParams": [["standalone", "true"]],
                "dataMask": {
                    "NATIVE_FILTER-time": {
                        "extraFormData": {"time_range": "Last year"},
                        "filterState": {"value": "Last year"},
                    }
                },
            }
        }
    )
    db.session.commit()

    run_report(dashboard_report)

    assert execution_logs(dashboard_report) == [(ReportState.SUCCESS, None)]
    screenshot_mock.assert_called_once()
    assert email_mock.call_args[0][0] == TARGET


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORT_TABS=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_dashboard_report_own_value_this_decoder_cant_read_fails_closed(
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    """A line break in one stored value fails this decoder while the page's
    rison.js reads it, so the page's data mask is unknown."""
    scope_to_every_chart(dashboard_report.dashboard)
    stored = stored_select_filter("a\nb")
    stored["nativeFilters"].append(
        {
            **stored["nativeFilters"][0],
            "nativeFilterId": "NATIVE_FILTER-more",
            "filterValues": ["North America"],
        }
    )
    dashboard_report.extra_json = json.dumps(
        {
            "dashboard": {
                **stored,
                "dataMask": {
                    "NATIVE_FILTER-time": {
                        "extraFormData": {"time_range": "Last 30 days"},
                        "filterState": {"value": "Last 30 days"},
                    }
                },
            }
        }
    )
    db.session.commit()

    with pytest.raises(ReportScheduleClientErrorsException):
        run_report(dashboard_report)

    assert_failed_and_editor_notified(
        dashboard_report,
        f"Calls by day: {UNCHECKED};Calls by agent: {UNCHECKED}",
        email_mock,
    )
    screenshot_mock.assert_not_called()


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORT_TABS=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_dashboard_report_own_quoted_value_decodes_and_sends(
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    """A stored value rison quotes decodes on the page and here alike."""
    screenshot_mock.return_value = SCREENSHOT_FILE
    scope_to_every_chart(dashboard_report.dashboard)
    dashboard_report.extra_json = json.dumps({"dashboard": stored_select_filter("a<b")})
    db.session.commit()

    run_report(dashboard_report)

    assert execution_logs(dashboard_report) == [(ReportState.SUCCESS, None)]
    screenshot_mock.assert_called_once()


def use_two_tabs(dashboard: Dashboard) -> None:
    """``TAB-A`` holds the first chart, ``TAB-B`` the second."""
    first, second = (f"CHART-{slc.id}" for slc in dashboard.slices)
    position = json.loads(dashboard.position_json)
    position.pop("ROW-1")
    position["ROOT_ID"]["children"] = ["TABS-1"]
    position["TABS-1"] = {
        "id": "TABS-1",
        "type": "TABS",
        "children": ["TAB-A", "TAB-B"],
    }
    position["TAB-A"] = {"id": "TAB-A", "type": "TAB", "children": [first]}
    position["TAB-B"] = {"id": "TAB-B", "type": "TAB", "children": [second]}
    dashboard.position_json = json.dumps(position)
    db.session.commit()


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORT_TABS=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
@patch.object(SqlaTable, "query", side_effect=AssertionError("SQL ran"))
def test_dashboard_report_stored_hash_picks_the_tab(
    query_mock: MagicMock,
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    """The permalink redirect opens the stored ``hash`` tab when there's no
    ``anchor``, so the out-of-scope chart on ``TAB-B`` gets checked."""
    use_two_tabs(dashboard_report.dashboard)
    dashboard_report.extra_json = json.dumps(
        {"dashboard": {"hash": "TAB-B", "urlParams": [["show_filters", "0"]]}}
    )
    db.session.commit()

    with pytest.raises(ReportScheduleClientErrorsException):
        run_report(dashboard_report)

    assert_failed_and_editor_notified(
        dashboard_report, f"Calls by agent: {GUARD}", email_mock
    )
    screenshot_mock.assert_not_called()
    query_mock.assert_not_called()


@pytest.mark.usefixtures("dashboard_report")
@with_feature_flags(**FLAGS_ON, ALERT_REPORT_TABS=True)
@patch.dict(APP_CONFIG, GLOBAL_90_DAYS)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_dashboard_report_unmodelled_state_key_fails_closed(
    screenshot_mock: MagicMock,
    email_mock: MagicMock,
    dashboard_report: ReportSchedule,
) -> None:
    scope_to_every_chart(dashboard_report.dashboard)
    dashboard_report.extra_json = json.dumps(
        {"dashboard": {"urlParams": [["standalone", "true"]], "region": "EU"}}
    )
    db.session.commit()

    with pytest.raises(ReportScheduleClientErrorsException):
        run_report(dashboard_report)

    assert_failed_and_editor_notified(
        dashboard_report,
        f"Calls by day: {UNCHECKED};Calls by agent: {UNCHECKED}",
        email_mock,
    )
    screenshot_mock.assert_not_called()
