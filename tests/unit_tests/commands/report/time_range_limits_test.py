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
"""Time range limits on scheduled reports: the pre-check before any render."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, cast
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pandas as pd
import pytest
import rison
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.extensions import feature_flag_manager
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from tests.fixtures.time_range_query_paths import (
    as_user,
    BAD_GLOBAL,
    layout,
    NOW,
    policy,
    saved_chart,
    set_global,
    time_filter,
    use_dashboards,
)

GUARD = "Range can't be longer than 90 days. This one is 365 days."
UNAVAILABLE = "Time range limits could not be verified. Retry the request."
UNCHECKED = "Time range limits could not be checked for this chart."
EDITOR = "owner@x.com"
NAMES = {11: "Calls by day", 12: "Calls by agent", 13: "Queue sizes", 14: "SLA"}


@pytest.fixture
def sql_runs(warm: list[str]) -> list[str]:  # noqa: F811
    """Every SQL query that runs, with the charts' dataset and an Alpha user."""
    return warm


@contextmanager
def flags(limits: bool = True, **others: bool) -> Iterator[None]:
    base = feature_flag_manager._feature_flags or {}
    with patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={
            **base,
            FEATURE_FLAG: limits,
            "ALERT_REPORT_TABS": False,
            "ALERT_REPORTS_RETRY": False,
            **others,
        },
    ):
        yield


def chart(
    chart_id: int,
    time_range: str = "Last year",
    name: str | None = None,
    **form_data: Any,
) -> Any:
    found = saved_chart(chart_id, time_range, **form_data)
    found.slice_name = NAMES.get(chart_id) if name is None else name
    return found


def dashboard(
    *charts: Any,
    limits: dict[str, Any] | None = None,
    native_filters: list[dict[str, Any]] | None = None,
    position: dict[str, Any] | str | None = None,
) -> Any:
    from superset.models.dashboard import Dashboard

    metadata: dict[str, Any] = {"native_filter_configuration": native_filters or []}
    if limits is not None:
        metadata["time_range_limits"] = limits
    if position is None:
        position = layout(*(slc.id for slc in charts))
    return Dashboard(
        id=3,
        uuid=uuid4(),
        dashboard_title="Contact center",
        json_metadata=json.dumps(metadata),
        position_json=position if isinstance(position, str) else json.dumps(position),
        slices=list(charts),
    )


def report(
    source: Any,
    report_format: str = "PNG",
    last_state: Any = None,
    report_type: str = "Report",
    extra: dict[str, Any] | None = None,
    **fields: Any,
) -> Any:
    from flask_appbuilder.security.sqla.models import User

    from superset.models.dashboard import Dashboard
    from superset.reports.models import (
        ReportRecipients,
        ReportRecipientType,
        ReportSchedule,
    )
    from superset.subjects.models import Subject
    from superset.subjects.types import SubjectType

    editor = User(id=1, email=EDITOR, first_name="O", last_name="W")
    return ReportSchedule(
        id=1,
        name="Weekly",
        type=report_type,
        report_format=report_format,
        last_state=last_state,
        grace_period=14400,
        working_timeout=3600,
        editors=[Subject(type=SubjectType.USER, label="O W", user=editor)],
        recipients=[
            ReportRecipients(
                type=ReportRecipientType.EMAIL,
                recipient_config_json=json.dumps({"target": "boss@x.com"}),
            ),
            ReportRecipients(
                type=ReportRecipientType.SLACKV2,
                recipient_config_json=json.dumps({"target": "C123"}),
            ),
        ],
        extra_json=json.dumps(extra or {}),
        **(
            {"dashboard": source, "dashboard_id": source.id}
            if isinstance(source, Dashboard)
            else {"chart": source, "chart_id": source.id}
        ),
        **fields,
    )


def stored_time_filter(value: str, **dashboard_state: Any) -> dict[str, Any]:
    return {
        "dashboard": {
            "nativeFilters": [
                {
                    "nativeFilterId": "NATIVE_FILTER-time",
                    "filterType": "filter_time",
                    "columnName": "ds",
                    "filterValues": [value],
                }
            ],
            **dashboard_state,
        }
    }


@dataclass
class Run:
    logs: list[tuple[str, str | None]] = field(default_factory=list)
    sent: list[tuple[str, str]] = field(default_factory=list)
    bodies: list[str] = field(default_factory=list)
    renders: list[str] = field(default_factory=list)
    error: Any = None

    @property
    def state(self) -> str:
        return self.logs[-1][0]


def run(
    mocker: MockerFixture,
    schedule: Any,
    *,
    error_notice_at: datetime | None = None,
    screenshot_error: Exception | None = None,
    executor: Any = "active",
    real_url: bool = False,
) -> Run:
    """Run the report's state as the scheduler does, recording each log row,
    notification and render. Nothing renders or sends for real."""
    from superset.commands.report import execute
    from superset.reports.models import ReportRecipientType, ReportState
    from superset.reports.notifications.email import EmailNotification

    result = Run()
    mocker.patch.object(
        execute.BaseReportState,
        "create_log",
        lambda self, error_message=None, **kwargs: result.logs.append(
            (self._report_schedule.last_state.value, error_message)
        ),
    )
    if not real_url:
        mocker.patch.object(
            execute.BaseReportState, "_get_url", return_value="http://s/r"
        )
    mocker.patch.object(
        execute.BaseReportState, "_get_log_data", return_value=cast(Any, {})
    )

    def screenshots(**kwargs: Any) -> list[bytes]:
        result.renders.append("screenshot")
        if screenshot_error is not None:
            raise screenshot_error
        return [b"png"]

    mocker.patch.object(
        execute.BaseReportState, "_get_screenshots", side_effect=screenshots
    )

    def csv_data(*args: Any, **kwargs: Any) -> bytes:
        result.renders.append("csv")
        return b"a\n1\n"

    def embedded(*args: Any, **kwargs: Any) -> pd.DataFrame:
        result.renders.append("dataframe")
        return pd.DataFrame({"a": [1]})

    mocker.patch.object(execute.BaseReportState, "_get_data", side_effect=csv_data)
    mocker.patch.object(
        execute.BaseReportState, "_get_embedded_data", side_effect=embedded
    )
    mocker.patch.object(execute, "build_pdf_from_screenshots", return_value=b"pdf")
    mocker.patch.object(execute.BaseReportState, "_assert_rendered_delivery_allowed")
    user = MagicMock(is_active=True, username="admin") if executor == "active" else None
    mocker.patch.object(execute, "get_executor_user", return_value=(user, "admin"))
    mocker.patch.object(execute, "machine_auth_provider_factory")
    mocker.patch.object(
        execute.ReportConfigDAO, "get_effective_value", return_value=None
    )
    notice = MagicMock(end_dttm=error_notice_at) if error_notice_at else None
    mocker.patch.object(
        execute.ReportScheduleDAO, "find_last_error_notification", return_value=notice
    )

    def create_notification(recipient: Any, content: Any) -> Any:
        target = json.loads(recipient.recipient_config_json)["target"]
        result.sent.append((recipient.type, target))
        if recipient.type == ReportRecipientType.EMAIL and content.text:
            result.bodies.append(
                EmailNotification(recipient, content)._get_content().body
            )
        return MagicMock()

    mocker.patch.object(execute, "create_notification", side_effect=create_notification)

    state_class = (
        execute.ReportSuccessState
        if schedule.last_state == ReportState.SUCCESS
        else execute.ReportNotTriggeredErrorState
    )
    try:
        state_class(schedule, datetime.utcnow(), uuid4()).next()
    except Exception as ex:  # pylint: disable=broad-except
        result.error = ex
    return result


def assert_failed(
    result: Run,
    message: str,
    *,
    reason: str | None = "MAX_SPAN_EXCEEDED",
    system: bool = False,
) -> None:
    """ERROR with ``message`` in the log row and in the editor's email only."""
    from superset.commands.report.exceptions import (
        ReportScheduleClientErrorsException,
        ReportScheduleSystemErrorsException,
    )

    expected = (
        ReportScheduleSystemErrorsException
        if system
        else ReportScheduleClientErrorsException
    )
    assert isinstance(result.error, expected), result
    assert result.logs == [
        ("Working", None),
        ("Error", message),
        ("Error", "Notification sent with error"),
    ]
    assert result.sent == [("Email", EDITOR)]
    (body,) = result.bodies
    assert "SupersetError(" not in body
    assert result.renders == []
    assert str(result.error) == message
    assert result.error.message == message
    if reason is not None:
        assert {error.extra["reason_code"] for error in result.error.errors} == {reason}


def assert_rendered(result: Run, renders: list[str]) -> None:
    assert result.error is None, result
    assert result.logs[-1] == ("Success", None)
    assert result.renders == renders
    assert result.sent == [("Email", "boss@x.com"), ("SlackV2", "C123")]


# Flag off, or no limits: the report runs as before


@freeze_time(NOW)
@pytest.mark.parametrize("source", ["chart", "dashboard"])
def test_flag_off_report_runs_as_before(
    sql_runs: list[str], mocker: MockerFixture, source: str
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(
        chart(11), limits=policy(30), native_filters=[time_filter("Last year")]
    )
    find = use_dashboards(mocker, board)
    extras = mocker.patch(
        "superset.time_range_limits.enforcement.dashboard_time_extras"
    )
    executor = mocker.spy(
        __import__("superset.commands.report.execute", fromlist=["x"]),
        "resolve_executor_user",
    )
    schedule = report(chart(11) if source == "chart" else board)

    with flags(limits=False):
        result = run(mocker, schedule)

    assert_rendered(result, ["screenshot"])
    assert result.logs == [("Working", None), ("Success", None)]
    find.assert_not_called()
    extras.assert_not_called()
    executor.assert_not_called()
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize(
    "source,report_format",
    [("chart", "PNG"), ("chart", "CSV"), ("chart", "TEXT"), ("dashboard", "PNG")],
)
def test_no_limits_report_runs_as_before(
    sql_runs: list[str], mocker: MockerFixture, source: str, report_format: str
) -> None:
    set_global(mocker, None)

    def one_run(limits: bool) -> Run:
        saved = chart(11)
        board = dashboard(saved, native_filters=[time_filter("Last year")])
        use_dashboards(mocker, board)
        schedule = report(saved if source == "chart" else board, report_format)
        with flags(limits=limits):
            return run(mocker, schedule)

    before, after = one_run(False), one_run(True)

    assert after.error is None
    assert after.logs == before.logs
    assert after.renders == before.renders
    assert after.sent == before.sent
    assert after.logs[-1] == ("Success", None)
    assert sql_runs == []


# A chart report that breaks the limits


@freeze_time(NOW)
@pytest.mark.parametrize("report_format", ["CSV", "PNG", "TEXT"])
def test_chart_report_breaking_the_limits_fails(
    sql_runs: list[str], mocker: MockerFixture, report_format: str
) -> None:
    from superset.commands.report.exceptions import ReportScheduleTimeRangeLimitError

    set_global(mocker, policy(90))

    with flags():
        result = run(mocker, report(chart(11), report_format))

    assert_failed(result, GUARD)
    assert isinstance(result.error, ReportScheduleTimeRangeLimitError)
    assert result.error.status == 400
    assert GUARD in result.bodies[0]
    extra = result.error.errors[0].extra or {}
    assert extra["dashboard_id"] is None
    assert "chart_id" not in extra
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize("on_dashboard", [True, False], ids=["on", "off"])
def test_chart_report_saved_dashboard_limits(
    sql_runs: list[str], mocker: MockerFixture, on_dashboard: bool
) -> None:
    set_global(mocker, policy(90))
    saved = chart(11, time_range="Last 60 days", dashboardId=3)
    other = chart(12)
    board = dashboard(saved if on_dashboard else other, limits=policy(30))
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(saved, "CSV"))

    if on_dashboard:
        assert_failed(
            result, "Range can't be longer than 30 days. This one is 60 days."
        )
        assert result.error.errors[0].extra["dashboard_id"] == 3
    else:
        assert_rendered(result, ["csv"])
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize("on_dashboard", [True, False], ids=["on", "off"])
def test_chart_report_names_its_chart_for_the_saved_dashboard(
    sql_runs: list[str], mocker: MockerFixture, on_dashboard: bool
) -> None:
    set_global(mocker, policy(90))
    saved = chart(11, time_range="Last 60 days", dashboardId=3)
    query_context = json.loads(cast(str, saved.query_context))
    del query_context["form_data"]["slice_id"]
    saved.query_context = json.dumps(query_context)
    on_board = [saved] if on_dashboard else []
    board = dashboard(*on_board, chart(12), limits=policy(30))
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(saved, "CSV"))

    if on_dashboard:
        assert_failed(
            result, "Range can't be longer than 30 days. This one is 60 days."
        )
    else:
        assert_rendered(result, ["csv"])
    assert sql_runs == []


# Dashboard reports: defaults, chart names


@freeze_time(NOW)
def test_dashboard_report_uses_default_dates_and_limits(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(
        chart(11),
        chart(12),
        native_filters=[time_filter("Last 30 days", excluded=[12])],
    )
    use_dashboards(mocker, board)

    with flags():
        by_default = run(mocker, report(board))

    assert_failed(by_default, f"Calls by agent: {GUARD}")
    (error,) = by_default.error.errors
    assert error.extra["chart_id"] == 12
    assert error.extra["dashboard_id"] == 3
    assert error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"

    board = dashboard(
        chart(11), limits=policy(30), native_filters=[time_filter("Last 60 days")]
    )
    use_dashboards(mocker, board)

    with flags():
        by_limit = run(mocker, report(board))

    assert_failed(
        by_limit,
        "Calls by day: Range can't be longer than 30 days. This one is 60 days.",
    )
    assert by_limit.error.errors[0].extra["chart_id"] == 11
    assert sql_runs == []


@freeze_time(NOW)
def test_dashboard_report_lists_every_bad_chart(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(chart(11), chart(12), chart(13, time_range="Last 30 days"))
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    message = f"Calls by day: {GUARD};Calls by agent: {GUARD}"
    assert_failed(result, message)
    assert [error.extra["chart_id"] for error in result.error.errors] == [11, 12]
    assert message in result.bodies[0]
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize("name", ["empty", "none"])
def test_dashboard_report_unnamed_chart_named_by_id(
    sql_runs: list[str], mocker: MockerFixture, name: str
) -> None:
    set_global(mocker, policy(90))
    unnamed = chart(11)
    unnamed.slice_name = "" if name == "empty" else None
    board = dashboard(unnamed)
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    assert_failed(result, f"Chart 11: {GUARD}")


# The stored dashboard state, read as the report's page renders it

BAD, GOOD = "Last year", "Last 30 days"


def time_mask(value: str, filter_id: str = "NATIVE_FILTER-time") -> dict[str, Any]:
    return {
        filter_id: {
            "id": filter_id,
            "extraFormData": {"time_range": value},
            "filterState": {"value": value},
            "ownState": {},
        }
    }


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


def stored_state_case(case: str) -> tuple[dict[str, Any], str, bool, str]:
    """The stored ``extra.dashboard``, the dashboard default, ``ALERT_REPORT_TABS``,
    and the outcome."""
    own_bad = stored_time_filter(BAD)["dashboard"]
    own_good = stored_time_filter(GOOD)["dashboard"]
    standalone = [["standalone", "true"]]
    cases: dict[str, tuple[dict[str, Any], str, bool, str]] = {
        # A quoted value never decodes on the page: it renders the defaults
        "own_quoted_bad_tabs_off": (own_bad, GOOD, False, "pass"),
        "own_quoted_good_bad_default_tabs_off": (own_good, BAD, False, "guard"),
        "own_quoted_bad_tabs_on": (own_bad, GOOD, True, "pass"),
        "own_quoted_good_bad_default_tabs_on": (own_good, BAD, True, "guard"),
        # ... or the permalink's stored dataMask, when it carries one
        "own_quoted_mask_bad": (
            {**own_good, "urlParams": standalone, "dataMask": time_mask(BAD)},
            GOOD,
            True,
            "guard",
        ),
        "own_quoted_mask_good": (
            {**own_bad, "urlParams": standalone, "dataMask": time_mask(GOOD)},
            BAD,
            True,
            "pass",
        ),
        "own_quoted_mask_tabs_off": (
            {**own_good, "urlParams": standalone, "dataMask": time_mask(BAD)},
            GOOD,
            False,
            "pass",
        ),
        "own_quoted_mask_anchor_list": (
            {**own_good, "anchor": '["TAB-A"]', "dataMask": time_mask(BAD)},
            GOOD,
            True,
            "pass",
        ),
        # A value the page's decoder may read while this one can't fails closed
        "own_select_page_may_decode": (
            stored_select_filter("a<b"),
            GOOD,
            True,
            "unchecked",
        ),
        "own_select_page_may_decode_tabs_off": (
            stored_select_filter("a<b"),
            GOOD,
            False,
            "unchecked",
        ),
        "own_select_with_space_page_cant_decode": (
            stored_select_filter("a<b c"),
            BAD,
            True,
            "guard",
        ),
        "own_select_quote_page_cant_decode": (
            stored_select_filter("O'Brien"),
            BAD,
            True,
            "guard",
        ),
        # The report's own value always wins: an empty one decodes to defaults
        "own_empty_over_mask": (
            {"urlParams": standalone, "dataMask": time_mask(BAD)},
            GOOD,
            True,
            "pass",
        ),
        "own_empty_over_stored_native_filters": (
            {"urlParams": [["native_filters", rison.dumps(time_mask(BAD))]]},
            GOOD,
            True,
            "pass",
        ),
        "own_empty_over_stored_native_filters_bad_default": (
            {"urlParams": [["native_filters", rison.dumps(time_mask(GOOD))]]},
            BAD,
            True,
            "guard",
        ),
        # A state with nothing to encode gets the plain URL
        "mask_only_plain_url": ({"dataMask": time_mask(BAD)}, GOOD, True, "pass"),
        # The stored keys the page reads
        "show_filters": (
            {**own_good, "urlParams": [["show_filters", "0"]]},
            GOOD,
            True,
            "pass",
        ),
        "force_stripped": (
            {**own_good, "urlParams": [["force", "true"]]},
            GOOD,
            True,
            "pass",
        ),
        "standalone_with_active_tabs": (
            {"urlParams": standalone, "activeTabs": ["TAB-B"]},
            GOOD,
            True,
            "unchecked",
        ),
        "f": ({**own_good, "urlParams": [["f", "(x:1)"]]}, GOOD, True, "unchecked"),
        "focused_chart": (
            {**own_good, "urlParams": [["focused_chart", "11"]]},
            GOOD,
            True,
            "unchecked",
        ),
        "edit": (
            {**own_good, "urlParams": [["edit", "true"]]},
            GOOD,
            True,
            "unchecked",
        ),
        "native_filters_key": (
            {**own_good, "urlParams": [["native_filters_key", "k"]]},
            GOOD,
            True,
            "unchecked",
        ),
        "unknown_key": (
            {**own_good, "urlParams": [["region", "EU"]]},
            GOOD,
            True,
            "unchecked",
        ),
        "unknown_key_tabs_off": (
            {**own_good, "urlParams": [["region", "EU"]]},
            GOOD,
            False,
            "unchecked",
        ),
        "unknown_key_plain_url_tabs_off": (
            {"urlParams": [["region", "EU"]]},
            GOOD,
            False,
            "pass",
        ),
        "unknown_state_key": (
            {**own_good, "urlParams": standalone, "region": "EU"},
            GOOD,
            True,
            "unchecked",
        ),
        "unknown_state_key_mask_only": (
            {"anchor": "TAB-A", "dataMask": time_mask(GOOD), "theme": 2},
            GOOD,
            True,
            "unchecked",
        ),
        "unknown_state_key_anchor_list": (
            {**own_good, "anchor": '["TAB-A"]', "region": "EU"},
            GOOD,
            True,
            "pass",
        ),
        "unknown_state_key_plain_url": ({"region": "EU"}, GOOD, True, "pass"),
        "unknown_state_key_tabs_off": (
            {**own_good, "region": "EU"},
            GOOD,
            False,
            "pass",
        ),
        "chart_states": (
            {**own_good, "chartStates": {"11": {"state": {}}}},
            GOOD,
            True,
            "unchecked",
        ),
        "chart_states_anchor_list": (
            {**own_good, "anchor": '["TAB-A"]', "chartStates": {"11": {}}},
            GOOD,
            True,
            "pass",
        ),
        "url_params_not_pairs": (
            {**own_good, "urlParams": [["standalone"]]},
            GOOD,
            True,
            "unchecked",
        ),
        "url_params_not_a_list": (
            {**own_good, "urlParams": {"standalone": "true"}},
            GOOD,
            True,
            "unchecked",
        ),
        "data_mask_not_a_dict": (
            {**own_good, "urlParams": standalone, "dataMask": "junk"},
            GOOD,
            True,
            "unchecked",
        ),
        # The narrow rule on whichever data mask the page uses
        "mask_deleted_native_filter_skipped": (
            {
                **own_good,
                "urlParams": standalone,
                "dataMask": {**time_mask(GOOD), **time_mask(BAD, "NATIVE_FILTER-x")},
            },
            GOOD,
            True,
            "pass",
        ),
        "mask_other_entry_strict": (
            {
                **own_good,
                "urlParams": standalone,
                "dataMask": {**time_mask(GOOD), "chart-11": {"extraFormData": 5}},
            },
            GOOD,
            True,
            "unchecked",
        ),
        "mask_time_filter_without_state": (
            {
                **own_good,
                "urlParams": standalone,
                "dataMask": {
                    "NATIVE_FILTER-time": {"extraFormData": {"time_range": GOOD}}
                },
            },
            GOOD,
            True,
            "unchecked",
        ),
    }
    return cases[case]


STORED_STATE_CASES = [
    "own_quoted_bad_tabs_off",
    "own_quoted_good_bad_default_tabs_off",
    "own_quoted_bad_tabs_on",
    "own_quoted_good_bad_default_tabs_on",
    "own_quoted_mask_bad",
    "own_quoted_mask_good",
    "own_quoted_mask_tabs_off",
    "own_quoted_mask_anchor_list",
    "own_select_page_may_decode",
    "own_select_page_may_decode_tabs_off",
    "own_select_with_space_page_cant_decode",
    "own_select_quote_page_cant_decode",
    "own_empty_over_mask",
    "own_empty_over_stored_native_filters",
    "own_empty_over_stored_native_filters_bad_default",
    "mask_only_plain_url",
    "show_filters",
    "force_stripped",
    "standalone_with_active_tabs",
    "f",
    "focused_chart",
    "edit",
    "native_filters_key",
    "unknown_key",
    "unknown_key_tabs_off",
    "unknown_key_plain_url_tabs_off",
    "unknown_state_key",
    "unknown_state_key_mask_only",
    "unknown_state_key_anchor_list",
    "unknown_state_key_plain_url",
    "unknown_state_key_tabs_off",
    "chart_states",
    "chart_states_anchor_list",
    "url_params_not_pairs",
    "url_params_not_a_list",
    "data_mask_not_a_dict",
    "mask_deleted_native_filter_skipped",
    "mask_other_entry_strict",
    "mask_time_filter_without_state",
]


@freeze_time(NOW)
@pytest.mark.parametrize("case", STORED_STATE_CASES)
def test_dashboard_report_stored_state_as_the_page_renders_it(
    sql_runs: list[str], mocker: MockerFixture, case: str
) -> None:
    stored, default, tabs_flag, outcome = stored_state_case(case)
    set_global(mocker, policy(90))
    board = dashboard(chart(11), native_filters=[time_filter(default)])
    use_dashboards(mocker, board)

    with flags(ALERT_REPORT_TABS=tabs_flag):
        result = run(mocker, report(board, extra={"dashboard": stored}))

    if outcome == "guard":
        assert_failed(result, f"Calls by day: {GUARD}")
    elif outcome == "unchecked":
        assert_failed(result, f"Calls by day: {UNCHECKED}", reason="POLICY_UNAVAILABLE")
    else:
        assert_rendered(result, ["screenshot"])
    assert sql_runs == []


def test_quoted_stored_value_never_decodes_on_the_page() -> None:
    """The report's own ``native_filters`` for a stored time range has the
    quotes the page can't read, so it renders the permalink's data mask or the
    defaults."""
    schedule = report(dashboard(chart(11)), extra=stored_time_filter(GOOD))
    native_filters, _warnings = schedule.get_native_filters_params()

    assert "%27Last 30 days%27" in native_filters
    with pytest.raises(Exception, match="missing"):  # noqa: B017
        rison.loads(native_filters)


@freeze_time(NOW)
@pytest.mark.parametrize("tabs_flag", [True, False], ids=["tabs-on", "tabs-off"])
def test_dashboard_report_checks_the_own_value_the_page_decodes(
    sql_runs: list[str], mocker: MockerFixture, tabs_flag: bool
) -> None:
    from superset.commands.report import execute

    set_global(mocker, policy(90))
    grain = {
        **time_filter("P1D", filter_id="NATIVE_FILTER-grain"),
        "filterType": "filter_timegrain",
    }
    board = dashboard(chart(11, time_range=GOOD), native_filters=[grain])
    use_dashboards(mocker, board)
    check = mocker.spy(execute, "check_chart_date_ranges")
    stored = {
        "nativeFilters": [
            {
                "nativeFilterId": "NATIVE_FILTER-grain",
                "filterType": "filter_timegrain",
                "columnName": "ds",
                "filterValues": ["P1W"],
            }
        ],
        "dataMask": time_mask(BAD),
    }

    with flags(ALERT_REPORT_TABS=tabs_flag):
        result = run(mocker, report(board, extra={"dashboard": stored}))

    assert_rendered(result, ["screenshot"])
    assert check.call_args.kwargs["data_mask"] == {
        "NATIVE_FILTER-grain": {
            "extraFormData": {"time_grain_sqla": "P1W"},
            "filterState": {"value": ["P1W"]},
            "id": "NATIVE_FILTER-grain",
            "ownState": {},
        }
    }
    assert sql_runs == []


# Only the tabs the report renders


def nested_layout() -> dict[str, Any]:
    """
    ``ROOT → TABS-top [TAB-1, TAB-2]``; ``TAB-1 → CHART-11, TABS-in [TAB-1a →
    CHART-12, TAB-1b → CHART-13]``; ``TAB-2 → CHART-14``.
    """
    position: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["TABS-top"]},
        "TABS-top": {"id": "TABS-top", "type": "TABS", "children": ["TAB-1", "TAB-2"]},
        "TAB-1": {"id": "TAB-1", "type": "TAB", "children": ["CHART-11", "TABS-in"]},
        "TAB-2": {"id": "TAB-2", "type": "TAB", "children": ["CHART-14"]},
        "TABS-in": {"id": "TABS-in", "type": "TABS", "children": ["TAB-1a", "TAB-1b"]},
        "TAB-1a": {"id": "TAB-1a", "type": "TAB", "children": ["CHART-12"]},
        "TAB-1b": {"id": "TAB-1b", "type": "TAB", "children": ["CHART-13"]},
    }
    for chart_id in (11, 12, 13, 14):
        position[f"CHART-{chart_id}"] = {
            "id": f"CHART-{chart_id}",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": chart_id},
        }
    return position


def grid_and_tabs_layout() -> dict[str, Any]:
    """``ROOT → GRID → [ROW-1 → CHART-11, TABS-g [TAB-x → CHART-12, TAB-y →
    CHART-13]]``."""
    position: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-1", "TABS-g"]},
        "ROW-1": {"id": "ROW-1", "type": "ROW", "children": ["CHART-11"]},
        "TABS-g": {"id": "TABS-g", "type": "TABS", "children": ["TAB-x", "TAB-y"]},
        "TAB-x": {"id": "TAB-x", "type": "TAB", "children": ["CHART-12"]},
        "TAB-y": {"id": "TAB-y", "type": "TAB", "children": ["CHART-13"]},
    }
    for chart_id in (11, 12, 13):
        position[f"CHART-{chart_id}"] = {
            "id": f"CHART-{chart_id}",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": chart_id},
        }
    return position


def two_tab_layout() -> dict[str, Any]:
    """``ROOT → TABS [TAB-A → CHART-11, TAB-B → CHART-12]``."""
    return {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["TABS"]},
        "TABS": {"id": "TABS", "type": "TABS", "children": ["TAB-A", "TAB-B"]},
        "TAB-A": {"id": "TAB-A", "type": "TAB", "children": ["CHART-11"]},
        "TAB-B": {"id": "TAB-B", "type": "TAB", "children": ["CHART-12"]},
        "CHART-11": {"id": "CHART-11", "type": "CHART", "meta": {"chartId": 11}},
        "CHART-12": {"id": "CHART-12", "type": "CHART", "meta": {"chartId": 12}},
    }


def two_groups_layout() -> dict[str, Any]:
    """``ROOT → GRID → [TABS-g1 [x1 → CHART-41, y1 → CHART-42], TABS-g2 [x2 →
    CHART-43, y2 → CHART-44, z2 → CHART-45]]``."""
    position: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "children": ["TABS-g1", "TABS-g2"],
        },
        "TABS-g1": {"id": "TABS-g1", "type": "TABS", "children": ["x1", "y1"]},
        "TABS-g2": {"id": "TABS-g2", "type": "TABS", "children": ["x2", "y2", "z2"]},
    }
    for tab, chart_id in (("x1", 41), ("y1", 42), ("x2", 43), ("y2", 44), ("z2", 45)):
        position[tab] = {"id": tab, "type": "TAB", "children": [f"CHART-{chart_id}"]}
        position[f"CHART-{chart_id}"] = {
            "id": f"CHART-{chart_id}",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": chart_id},
        }
    return position


@freeze_time(NOW)
@pytest.mark.parametrize(
    "layout_of,charts,anchor,checked",
    [
        (nested_layout, (11, 12, 13, 14), None, [11, 12]),
        (nested_layout, (11, 12, 13, 14), "TAB-1b", [11, 13]),
        (nested_layout, (11, 12, 13, 14), "TAB-2", [14]),
        (nested_layout, (11, 12, 13, 14), '["TAB-1b", "TAB-2"]', [11, 13, 14]),
        (nested_layout, (11, 12, 13, 14), "CHART-13", [11, 13]),
        (nested_layout, (11, 12, 13, 14), "TAB-zz", [11, 12]),
        (nested_layout, (11, 12, 13, 14), '["TAB-zz", "TAB-2"]', [11, 12, 14]),
        (nested_layout, (11, 12, 13, 14, 15), None, [11, 12, 15]),
        (nested_layout, (11, 12, 13, 14, 15), "TAB-2", [14]),
        (nested_layout, (11, 12, 13, 14, 15), "TAB-1b", [11, 13, 15]),
        (grid_and_tabs_layout, (11, 12, 13), None, [11, 12]),
        (grid_and_tabs_layout, (11, 12, 13), "TAB-y", [11, 13]),
        (grid_and_tabs_layout, (11, 12, 13, 15), "TAB-y", [11, 13, 15]),
        (grid_and_tabs_layout, (11, 12, 13, 15), "TAB-zz", [11, 12, 15]),
    ],
    ids=[
        "nested-no-anchor",
        "nested-inner-tab",
        "nested-outer-tab",
        "nested-two-anchors",
        "nested-chart-anchor",
        "nested-missing-anchor",
        "nested-missing-and-outer-anchor",
        "nested-missing-chart-no-anchor",
        "nested-missing-chart-other-tab",
        "nested-missing-chart-inner-tab",
        "grid-no-anchor",
        "grid-tab-anchor",
        "grid-missing-chart",
        "grid-missing-chart-missing-anchor",
    ],
)
def test_report_dashboard_charts_follow_rendered_tabs(
    sql_runs: list[str],
    mocker: MockerFixture,
    layout_of: Any,
    charts: tuple[int, ...],
    anchor: str | None,
    checked: list[int],
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(
        *(chart(chart_id, name=f"C{chart_id}") for chart_id in charts),
        position=layout_of(),
    )
    use_dashboards(mocker, board)
    extra = {"dashboard": {"anchor": anchor}} if anchor else {}

    with flags(ALERT_REPORT_TABS=True):
        result = run(mocker, report(board, extra=extra))

    assert [error.extra["chart_id"] for error in result.error.errors] == checked
    assert result.renders == []
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize(
    "tabs_flag,anchor,fails",
    [
        (True, "TAB-A", False),
        (True, "TAB-B", True),
        (True, None, False),
        (True, '["TAB-A", "TAB-B"]', True),
        (False, "TAB-B", False),
        (False, '["TAB-A", "TAB-B"]', False),
    ],
)
def test_report_tab_anchor_decides_what_is_checked(
    sql_runs: list[str],
    mocker: MockerFixture,
    tabs_flag: bool,
    anchor: str | None,
    fails: bool,
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(
        chart(11, time_range="Last 30 days"), chart(12), position=two_tab_layout()
    )
    use_dashboards(mocker, board)
    extra = {"dashboard": {"anchor": anchor}} if anchor else {}

    with flags(ALERT_REPORT_TABS=tabs_flag):
        result = run(mocker, report(board, extra=extra))

    if fails:
        assert_failed(result, f"Calls by agent: {GUARD}")
    else:
        assert_rendered(result, ["screenshot"])
    assert sql_runs == []


SHOW_FILTERS = {"urlParams": [["show_filters", "0"]]}


@freeze_time(NOW)
@pytest.mark.parametrize(
    "tabs_flag,state,fails",
    [
        (True, {"hash": "TAB-B", **SHOW_FILTERS}, True),
        (True, {"hash": "TAB-A", **SHOW_FILTERS}, False),
        (True, {"anchor": "TAB-A", "hash": "TAB-B", **SHOW_FILTERS}, False),
        (True, {"anchor": "TAB-B", "hash": "TAB-A", **SHOW_FILTERS}, True),
        (True, {"anchor": "TAB-A", "hash": "TAB-B"}, False),
        (True, {"anchor": None, "hash": "TAB-B", **SHOW_FILTERS}, False),
        (True, {"hash": "TAB-B"}, False),
        (False, {"hash": "TAB-B", **SHOW_FILTERS}, False),
    ],
    ids=[
        "hash",
        "hash-first-tab",
        "anchor-over-hash",
        "anchor-over-first-tab-hash",
        "anchor-over-hash-without-params",
        "null-anchor-over-hash",
        "hash-alone-plain-url",
        "tabs-off",
    ],
)
def test_report_tab_follows_the_permalink_fragment(
    sql_runs: list[str],
    mocker: MockerFixture,
    tabs_flag: bool,
    state: dict[str, Any],
    fails: bool,
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(
        chart(11, time_range="Last 30 days"), chart(12), position=two_tab_layout()
    )
    use_dashboards(mocker, board)

    with flags(ALERT_REPORT_TABS=tabs_flag):
        result = run(mocker, report(board, extra={"dashboard": state}))

    if fails:
        assert_failed(result, f"Calls by agent: {GUARD}")
    else:
        assert_rendered(result, ["screenshot"])
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize(
    "layout_of,charts,state,checked",
    [
        (two_tab_layout, (11, 12), {"activeTabs": ["TAB-B"]}, [11]),
        (
            two_tab_layout,
            (11, 12),
            {"anchor": "TAB-A", "activeTabs": ["TAB-B"]},
            [11],
        ),
        (nested_layout, (11, 12, 13, 14), {"activeTabs": ["TAB-1b"]}, [11, 13]),
        (nested_layout, (11, 12, 13, 14), {"activeTabs": ["TAB-2"]}, [11, 12]),
        (
            nested_layout,
            (11, 12, 13, 14),
            {"activeTabs": ["TAB-2", "TAB-1b"]},
            [11, 13],
        ),
        (
            nested_layout,
            (11, 12, 13, 14),
            {"anchor": "TAB-1a", "activeTabs": ["TAB-1b"]},
            [11, 13],
        ),
        (
            nested_layout,
            (11, 12, 13, 14),
            {"anchor": "TAB-1b", "activeTabs": ["TAB-1a"]},
            [11, 13],
        ),
        (
            nested_layout,
            (11, 12, 13, 14),
            {"anchor": "TAB-1b", "activeTabs": ["TAB-2"]},
            [11, 13],
        ),
        (
            nested_layout,
            (11, 12, 13, 14),
            {"anchor": "TAB-zz", "activeTabs": ["TAB-1b"]},
            [11, 13],
        ),
        (
            nested_layout,
            (11, 12, 13, 14, 15),
            {"activeTabs": ["TAB-1b"]},
            [11, 13, 15],
        ),
        (
            nested_layout,
            (11, 12, 13, 14),
            {"anchor": '["TAB-1a"]', "activeTabs": ["TAB-1b"]},
            [11, 12],
        ),
        (grid_and_tabs_layout, (11, 12, 13), {"activeTabs": ["TAB-y"]}, [11, 13]),
        (
            grid_and_tabs_layout,
            (11, 12, 13, 15),
            {"activeTabs": ["TAB-y"]},
            [11, 13, 15],
        ),
        (
            grid_and_tabs_layout,
            (11, 12, 13),
            {"anchor": "TAB-x", "activeTabs": ["TAB-y"]},
            [11, 13],
        ),
        (
            grid_and_tabs_layout,
            (11, 12, 13),
            {"anchor": '["TAB-x"]', "activeTabs": ["TAB-y"]},
            [11, 12],
        ),
        (grid_and_tabs_layout, (11, 12, 13), {"activeTabs": "TAB-y"}, [11, 12]),
        (grid_and_tabs_layout, (11, 12, 13), {"activeTabs": ["TAB-y", 5]}, [11, 12]),
        (
            grid_and_tabs_layout,
            (11, 12, 13),
            {"activeTabs": ["TAB-x", "TAB-y"]},
            [11, 13],
        ),
        (
            two_groups_layout,
            (41, 42, 43, 44, 45),
            {"activeTabs": ["x2", "z2"]},
            [41, 45],
        ),
        (
            two_groups_layout,
            (41, 42, 43, 44, 45),
            {"activeTabs": ["z2", "y2"]},
            [41, 44],
        ),
        (
            nested_layout,
            (11, 12, 13, 14),
            {"activeTabs": ["TAB-1a", "TAB-1b"]},
            [11, 13],
        ),
        (
            two_groups_layout,
            (41, 42, 43, 44, 45),
            {"anchor": "y2", "activeTabs": ["z2"]},
            [41, 44],
        ),
    ],
    ids=[
        "two-tab",
        "two-tab-anchor",
        "nested",
        "nested-outer-tab",
        "nested-outer-and-inner-tab",
        "nested-first-inner-anchor",
        "nested-inner-anchor",
        "nested-inner-anchor-outer-tab",
        "nested-missing-anchor",
        "nested-missing-chart",
        "nested-anchor-list",
        "grid",
        "grid-missing-chart",
        "grid-first-tab-anchor",
        "grid-anchor-list",
        "grid-string",
        "grid-non-string-item",
        "grid-first-and-second-tab",
        "three-tabs-first-and-third-tab",
        "three-tabs-third-and-second-tab",
        "nested-first-and-second-tab",
        "three-tabs-anchor-second-active-third",
    ],
)
def test_report_dashboard_charts_follow_active_tabs(
    sql_runs: list[str],
    mocker: MockerFixture,
    layout_of: Any,
    charts: tuple[int, ...],
    state: dict[str, Any],
    checked: list[int],
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(
        *(chart(chart_id, name=f"C{chart_id}") for chart_id in charts),
        position=layout_of(),
    )
    use_dashboards(mocker, board)

    with flags(ALERT_REPORT_TABS=True):
        result = run(
            mocker, report(board, extra={"dashboard": {**SHOW_FILTERS, **state}})
        )

    assert [error.extra["chart_id"] for error in result.error.errors] == checked
    assert result.renders == []
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize(
    "tabs_flag,state,fails",
    [
        (True, SHOW_FILTERS, True),
        (False, SHOW_FILTERS, False),
        (True, {}, False),
    ],
    ids=["permalink", "tabs-off", "plain-url"],
)
def test_report_active_tabs_decide_what_is_checked(
    sql_runs: list[str],
    mocker: MockerFixture,
    tabs_flag: bool,
    state: dict[str, Any],
    fails: bool,
) -> None:
    set_global(mocker, policy(90))
    board = dashboard(
        chart(11, time_range="Last 30 days"),
        chart(12, time_range="Last 30 days"),
        chart(13),
        position=grid_and_tabs_layout(),
    )
    use_dashboards(mocker, board)
    extra = {"dashboard": {**state, "activeTabs": ["TAB-y"]}}

    with flags(ALERT_REPORT_TABS=tabs_flag):
        result = run(mocker, report(board, extra=extra))

    if fails:
        assert_failed(result, f"Queue sizes: {GUARD}")
    else:
        assert_rendered(result, ["screenshot"])
    assert sql_runs == []


@pytest.mark.parametrize(
    "position",
    [
        "{junk",
        "[]",
        json.dumps({"ROOT_ID": {"children": ["A"]}, "A": {"children": ["ROOT_ID"]}}),
    ],
    ids=["junk", "not-a-dict", "cycle"],
)
def test_report_dashboard_charts_unreadable_layout_gives_every_chart(
    position: str,
) -> None:
    from superset.time_range_limits.enforcement import report_dashboard_charts

    board = dashboard(chart(11), chart(12), position=position)

    assert [slc.id for slc in report_dashboard_charts(board, ["TAB-A"])] == [11, 12]


@pytest.mark.parametrize(
    "anchor,shown",
    [("TAB-A", [12]), ("TAB-B", [11])],
)
def test_a_duplicated_chart_keeps_the_place_the_walk_pops_first(
    anchor: str, shown: list[int]
) -> None:
    """``CHART-11`` in ``TAB-A`` and ``CHART-11b`` in ``TAB-B`` share chart 11; the
    walk pops ``TAB-B`` first, so chart 11 counts as on ``TAB-B``."""
    from superset.time_range_limits.enforcement import report_dashboard_charts

    position = two_tab_layout()
    position["TAB-A"]["children"] = ["CHART-11", "CHART-12"]
    position["TAB-B"]["children"] = ["CHART-11b"]
    position["CHART-11b"] = {
        "id": "CHART-11b",
        "type": "CHART",
        "meta": {"chartId": 11},
    }
    board = dashboard(chart(11), chart(12), position=json.dumps(position))

    assert [slc.id for slc in report_dashboard_charts(board, [anchor])] == shown


@pytest.mark.parametrize(
    "root_children,shown",
    [([], [11]), (["TABS-empty"], [11])],
    ids=["no-root-child", "tab-group-without-tabs"],
)
def test_a_chart_missing_from_the_layout_falls_back_to_the_grid(
    root_children: list[str], shown: list[int]
) -> None:
    from superset.time_range_limits.enforcement import report_dashboard_charts

    position: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": root_children},
        "TABS-empty": {"id": "TABS-empty", "type": "TABS", "children": []},
    }
    board = dashboard(chart(11), position=json.dumps(position))

    assert [slc.id for slc in report_dashboard_charts(board, None)] == shown


# A required Time Range filter with no default


@freeze_time(NOW)
def test_dashboard_report_required_filter_without_default(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    required = {**time_filter(None), "controlValues": {"enableEmptyFilter": True}}
    board = dashboard(chart(11, time_range="No filter"), native_filters=[required])
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    assert_failed(
        result,
        "Calls by day: This chart requires a bounded time range. Ask a dashboard "
        "editor to add or scope a time range filter.",
        reason="UNBOUNDED_RANGE",
    )
    assert sql_runs == []


# No saved query context, and charts that can't be built


@freeze_time(NOW)
@pytest.mark.parametrize("case", ["range", "time_compare"])
def test_chart_without_query_context_checked_from_form_data(
    sql_runs: list[str], mocker: MockerFixture, case: str
) -> None:
    if case == "range":
        set_global(mocker, policy(90))
        saved = chart(11)
        message, reason = GUARD, "MAX_SPAN_EXCEEDED"
    else:
        set_global(mocker, policy(back=90))
        saved = chart(11, time_range="Last 30 days", time_compare=["1 year ago"])
        message = (
            'Time comparison "1 year ago": Start can\'t be earlier than '
            "Jul 23, 2026 (90 days ago)."
        )
        reason = "MAX_LOOK_BACK_EXCEEDED"
    saved.query_context = None
    params = saved.params

    with flags():
        result = run(mocker, report(saved, "CSV"))

    assert_failed(result, message, reason=reason)
    assert saved.params == params
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize(
    "saved_range,default_range,fails",
    [("Last 30 days", "Last year", True), ("Last year", "Last 30 days", False)],
    ids=["bad_default", "good_default"],
)
def test_dashboard_report_chart_without_query_context_uses_dashboard_dates(
    sql_runs: list[str],
    mocker: MockerFixture,
    saved_range: str,
    default_range: str,
    fails: bool,
) -> None:
    set_global(mocker, policy(90))
    saved = chart(11, time_range=saved_range)
    saved.query_context = None
    board = dashboard(saved, native_filters=[time_filter(default_range)])
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    if fails:
        assert_failed(result, f"Calls by day: {GUARD}")
    else:
        assert_rendered(result, ["screenshot"])
    assert sql_runs == []


@freeze_time(NOW)
def test_chart_without_query_context_keeps_only_time_filters(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    saved = chart(
        11,
        adhoc_filters=[
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "ds",
                "operator": "TEMPORAL_RANGE",
                "comparator": "Last year",
            },
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "name",
                "operator": "IN",
                "comparator": ["a"],
            },
            {
                "expressionType": "SQL",
                "clause": "WHERE",
                "sqlExpression": "name = 'a'; DROP TABLE t",
            },
        ],
    )
    saved.query_context = None

    with flags():
        result = run(mocker, report(saved, "CSV"))

    assert_failed(result, GUARD)
    assert sql_runs == []


@freeze_time(NOW)
def test_unreadable_query_context_fails_closed(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    saved = chart(11, time_range="Last 30 days")
    saved.query_context = "{junk"

    with flags():
        result = run(mocker, report(saved, "CSV"))

    assert_failed(result, f"Calls by day: {UNCHECKED}", reason="POLICY_UNAVAILABLE")
    assert sql_runs == []


@freeze_time(NOW)
def test_unbuildable_chart_fails_closed_with_only_a_dashboard_limit(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, None)
    broken = chart(11)
    broken.query_context = json.dumps({"datasource": {"type": "table", "id": 7}})
    board = dashboard(broken, chart(12, time_range="Last 7 days"), limits=policy(30))
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    assert_failed(result, f"Calls by day: {UNCHECKED}", reason="POLICY_UNAVAILABLE")
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize(
    "case", ["limits", "no_limits", "broken_policy", "stored_state", "no_dataset"]
)
def test_unbuildable_chart_fails_closed(
    sql_runs: list[str], mocker: MockerFixture, case: str
) -> None:
    from superset.models.slice import Slice
    from superset.reports.models import ReportSchedule

    set_global(
        mocker,
        {"no_limits": None, "broken_policy": BAD_GLOBAL}.get(case, policy(90)),
    )
    broken = chart(11)
    broken.query_context = json.dumps({"datasource": {"type": "table", "id": 7}})
    if case == "stored_state":
        board = dashboard(chart(11), chart(12, time_range="Last 30 days"))
        use_dashboards(mocker, board)
        mocker.patch.object(
            ReportSchedule,
            "get_native_filters_params",
            side_effect=ValueError("junk"),
        )
        schedule = report(board, extra=stored_time_filter("Last 30 days"))
    else:
        schedule = report(broken, "PNG")
    if case == "no_dataset":
        mocker.patch.object(Slice, "datasource", new=None)
        mocker.patch.object(Slice, "resolved_datasource", new=None)
    warning = mocker.patch("superset.commands.report.execute.logger.warning")

    with flags():
        result = run(mocker, schedule)

    if case == "no_limits":
        assert_rendered(result, ["screenshot"])
        assert result.logs == [("Working", None), ("Success", None)]
        warning.assert_not_called()
    elif case == "broken_policy":
        assert_failed(result, UNAVAILABLE, reason="POLICY_UNAVAILABLE", system=True)
    elif case == "stored_state":
        assert_failed(
            result,
            f"Calls by day: {UNCHECKED};Calls by agent: {UNCHECKED}",
            reason="POLICY_UNAVAILABLE",
        )
        assert [error.extra["chart_id"] for error in result.error.errors] == [11, 12]
        warning.assert_called_once()
    else:
        assert_failed(result, f"Calls by day: {UNCHECKED}", reason="POLICY_UNAVAILABLE")
        assert result.error.errors[0].extra["chart_id"] == 11
        warning.assert_called_once()
    assert sql_runs == []


UNBUILDABLE = {
    "no_queries": json.dumps({"datasource": {"type": "table", "id": 7}}),
    "junk": "{junk",
}


def unbuildable_chart(how: str = "no_queries", **form_data: Any) -> Any:
    broken = chart(11, **form_data)
    broken.query_context = UNBUILDABLE[how]
    return broken


@freeze_time(NOW)
@pytest.mark.parametrize("how", ["no_queries", "junk"])
@pytest.mark.parametrize("report_format", ["PNG", "CSV"])
def test_unbuildable_chart_report_fails_closed_with_only_its_dashboard_limit(
    sql_runs: list[str], mocker: MockerFixture, how: str, report_format: str
) -> None:
    set_global(mocker, None)
    broken = unbuildable_chart(how, dashboardId=3)
    board = dashboard(broken, chart(12, time_range="Last 7 days"), limits=policy(30))
    use_dashboards(mocker, board)
    warning = mocker.patch("superset.commands.report.execute.logger.warning")

    with flags():
        result = run(mocker, report(broken, report_format))

    assert_failed(result, f"Calls by day: {UNCHECKED}", reason="POLICY_UNAVAILABLE")
    assert result.error.errors[0].extra["chart_id"] == 11
    warning.assert_called_once()
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize("case", ["off_dashboard", "no_dashboard_id", "flag_off"])
def test_unbuildable_chart_report_skips_a_dashboard_limit_the_check_skips(
    sql_runs: list[str], mocker: MockerFixture, case: str
) -> None:
    set_global(mocker, None)
    saved: dict[str, Any] = {} if case == "no_dashboard_id" else {"dashboardId": 3}
    broken = unbuildable_chart("no_queries", **saved)
    on_board = [chart(12)] if case == "off_dashboard" else [broken]
    use_dashboards(mocker, dashboard(*on_board, limits=policy(30)))
    as_user(mocker, "alpha")

    with flags(limits=case != "flag_off"):
        result = run(mocker, report(broken, "PNG"))

    assert_rendered(result, ["screenshot"])
    assert sql_runs == []


@freeze_time(NOW)
def test_unbuildable_chart_report_off_its_dashboard_fails_closed_without_dataset_access(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, None)
    broken = unbuildable_chart(dashboardId=3)
    use_dashboards(mocker, dashboard(chart(12), limits=policy(30)))
    as_user(mocker, "rbac")

    with flags():
        result = run(mocker, report(broken, "PNG"))

    assert_failed(result, f"Calls by day: {UNCHECKED}", reason="POLICY_UNAVAILABLE")
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize("value", ["5.0", "abc", True, [3]])
@pytest.mark.parametrize("user", ["alpha", "rbac"])
def test_unbuildable_chart_report_with_an_unreadable_dashboard_id(
    sql_runs: list[str], mocker: MockerFixture, value: Any, user: str
) -> None:
    from superset.commands.report.exceptions import (
        ReportScheduleTimeRangeLimitsUnavailableError,
    )

    set_global(mocker, None)
    broken = unbuildable_chart(dashboardId=value)
    use_dashboards(mocker, dashboard(broken, limits=policy(30)))
    as_user(mocker, user)

    with flags():
        result = run(mocker, report(broken, "PNG"))

    if user == "rbac":
        assert isinstance(result.error, ReportScheduleTimeRangeLimitsUnavailableError)
        assert_failed(result, UNAVAILABLE, reason="POLICY_UNAVAILABLE", system=True)
    else:
        assert_rendered(result, ["screenshot"])
    assert sql_runs == []


@freeze_time(NOW)
def test_unbuildable_chart_report_without_a_dataset_has_no_dashboard(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.models.slice import Slice

    set_global(mocker, None)
    broken = unbuildable_chart(dashboardId=3)
    use_dashboards(mocker, dashboard(broken, limits=policy(30)))
    mocker.patch.object(Slice, "datasource", new=None)
    mocker.patch.object(Slice, "resolved_datasource", new=None)

    with flags():
        result = run(mocker, report(broken, "PNG"))

    assert_rendered(result, ["screenshot"])
    assert sql_runs == []


# The failure path: execution log, the editors' email, retries


@freeze_time(NOW)
def test_limits_unavailable_fails_report(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.commands.report.exceptions import (
        ReportScheduleTimeRangeLimitsUnavailableError,
    )

    set_global(mocker, BAD_GLOBAL)

    with flags():
        result = run(mocker, report(chart(11, time_range="Last 30 days")))

    assert_failed(result, UNAVAILABLE, reason="POLICY_UNAVAILABLE", system=True)
    assert isinstance(result.error, ReportScheduleTimeRangeLimitsUnavailableError)
    assert result.error.status == 500
    assert UNAVAILABLE in result.bodies[0]
    assert sql_runs == []


@freeze_time(NOW)
def test_failure_after_success_emails_the_editors_at_once(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.reports.models import ReportState

    set_global(mocker, policy(90))

    with flags():
        result = run(mocker, report(chart(11), last_state=ReportState.SUCCESS))

    assert result.logs == [
        ("Working", None),
        ("Error", GUARD),
        ("Error", "Notification sent with error"),
    ]
    assert result.sent == [("Email", EDITOR)]
    assert GUARD in result.bodies[0]
    assert result.renders == []
    assert sql_runs == []


@freeze_time(NOW)
def test_error_grace_holds_back_second_email(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from datetime import timedelta

    from superset.reports.models import ReportState

    set_global(mocker, policy(90))

    with flags():
        result = run(
            mocker,
            report(chart(11), last_state=ReportState.ERROR),
            error_notice_at=datetime.utcnow() - timedelta(hours=1),
        )

    assert result.logs == [("Working", None), ("Error", GUARD)]
    assert result.sent == []
    assert result.renders == []
    assert sql_runs == []


def retrying_report(source: Any) -> Any:
    return report(
        source,
        retry_on_failure=True,
        retry_attempt=0,
        retry_max_attempts=3,
        retry_notify_recipients=True,
        send_failed_reports=True,
    )


@freeze_time(NOW)
def test_a_limit_refusal_is_not_retried(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.commands.report import execute

    set_global(mocker, policy(90))
    retry = mocker.patch.object(execute.BaseReportState, "_schedule_retry")
    reset = mocker.patch.object(execute.BaseReportState, "_reset_retry_counter")

    with flags(ALERT_REPORTS_RETRY=True):
        result = run(mocker, retrying_report(chart(11)))

    assert_failed(result, GUARD)
    retry.assert_not_called()
    reset.assert_called_once()
    assert sql_runs == []


@freeze_time(NOW)
def test_limits_unavailable_stays_retryable(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.commands.report import execute

    set_global(mocker, BAD_GLOBAL)
    retry = mocker.patch.object(execute.BaseReportState, "_schedule_retry")
    mocker.patch.object(
        execute.BaseReportState, "_is_retry_window_stale", return_value=False
    )

    with flags(ALERT_REPORTS_RETRY=True):
        result = run(mocker, retrying_report(chart(11, time_range="Last 30 days")))

    assert result.error is None
    assert result.logs == [("Working", None), ("Retrying", UNAVAILABLE)]
    retry.assert_called_once()
    assert result.renders == []
    assert sql_runs == []


@freeze_time(NOW)
def test_alert_attachment_not_prechecked(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    mocker.patch(
        "superset.commands.report.execute.AlertCommand.run", return_value=(True, "")
    )
    mocker.patch(
        "superset.commands.report.execute.alerts_attach_reports_enabled",
        return_value=True,
    )
    check = mocker.patch(
        "superset.commands.report.execute.check_chart_date_ranges",
    )
    executor = mocker.spy(
        __import__("superset.commands.report.execute", fromlist=["x"]),
        "resolve_executor_user",
    )

    with flags():
        result = run(mocker, report(chart(11), report_type="Alert"))

    assert_rendered(result, ["screenshot"])
    check.assert_not_called()
    executor.assert_not_called()


# The report's own target and executor errors come first


@freeze_time(NOW)
def test_recipient_policy_refusal_comes_first(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.commands.report import execute
    from superset.commands.report.exceptions import (
        ReportScheduleRecipientsNotAllowedError,
    )

    set_global(mocker, policy(90))
    check = mocker.spy(execute.BaseReportState, "_check_date_ranges")
    mocker.patch.object(
        execute.BaseReportState,
        "_validate_recipients_policy",
        side_effect=ReportScheduleRecipientsNotAllowedError(["boss@x.com"]),
    )

    with flags():
        result = run(mocker, report(chart(11)))

    assert isinstance(result.error, ReportScheduleRecipientsNotAllowedError)
    check.assert_not_called()
    assert sql_runs == []


@freeze_time(NOW)
def test_deleted_chart_gives_its_own_error(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.commands.report import execute
    from superset.commands.report.exceptions import (
        ReportScheduleTargetChartDeletedError,
    )

    set_global(mocker, policy(90))
    schedule = report(chart(11))
    schedule.chart = None
    resolve = mocker.spy(execute, "resolve_executor_user")
    check = mocker.spy(execute, "check_chart_date_ranges")

    with flags():
        result = run(mocker, schedule, real_url=True)

    assert isinstance(result.error, ReportScheduleTargetChartDeletedError)
    assert result.logs[1] == ("Error", str(ReportScheduleTargetChartDeletedError()))
    resolve.assert_not_called()
    check.assert_not_called()
    assert sql_runs == []


@freeze_time(NOW)
def test_missing_executor_gives_its_own_error(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.commands.report import execute
    from superset.commands.report.exceptions import (
        ReportScheduleExecutorNotFoundError,
    )

    set_global(mocker, policy(90))
    check = mocker.spy(execute, "check_chart_date_ranges")

    with flags():
        result = run(mocker, report(chart(11)), executor=None)

    assert isinstance(result.error, ReportScheduleExecutorNotFoundError)
    assert result.logs[1][0] == "Error"
    assert "admin" in (result.logs[1][1] or "")
    check.assert_not_called()
    assert sql_runs == []


@freeze_time(NOW)
def test_executor_without_dashboard_access_gives_its_own_error(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    from superset.commands.report import execute
    from superset.commands.report.exceptions import (
        ReportScheduleExecutorAccessDeniedError,
    )

    set_global(mocker, policy(90))
    board = dashboard(chart(11))
    use_dashboards(mocker, board)
    check = mocker.spy(execute, "check_chart_date_ranges")
    deny_access(mocker)
    mocker.patch.object(
        execute, "get_user", return_value=MagicMock(is_anonymous=False, username="m")
    )

    with flags():
        result = run(mocker, report(board))

    assert isinstance(result.error, ReportScheduleExecutorAccessDeniedError)
    check.assert_not_called()
    assert sql_runs == []


# The counter and log line of a report


@pytest.fixture
def telemetry(mocker: MockerFixture, caplog: pytest.LogCaptureFixture) -> Any:
    """The keys counted and the lines logged."""
    import logging

    caplog.set_level(logging.INFO, logger="superset.time_range_limits")
    incr = mocker.patch(
        "superset.time_range_limits.telemetry.stats_logger_manager"
    ).instance.incr

    def recorded() -> tuple[list[str], list[dict[str, Any]]]:
        return (
            [call.args[0] for call in incr.call_args_list],
            [
                record.time_range_limit
                for record in caplog.records
                if record.name == "superset.time_range_limits"
            ],
        )

    return recorded


@freeze_time(NOW)
def test_report_unchecked_is_not_an_outage(
    sql_runs: list[str], mocker: MockerFixture, telemetry: Any
) -> None:
    set_global(mocker, policy(90))
    saved = chart(11, time_range="Last 30 days")
    saved.query_context = "{junk"

    with flags():
        result = run(mocker, report(saved, "CSV"))

    assert_failed(result, f"Calls by day: {UNCHECKED}", reason="POLICY_UNAVAILABLE")
    keys, lines = telemetry()
    assert keys == ["time_range_limit.unchecked.report"]
    (line,) = lines
    assert (line["path"], line["chart_id"], line["dashboard_id"]) == (
        "report",
        11,
        "none",
    )


@freeze_time(NOW)
@pytest.mark.parametrize("bad", ["limit", "unchecked"])
def test_report_counts_each_bad_chart(
    sql_runs: list[str], mocker: MockerFixture, telemetry: Any, bad: str
) -> None:
    from superset.reports.models import ReportSchedule

    set_global(mocker, policy(90))
    board = dashboard(chart(11), chart(12), chart(13, time_range="Last 30 days"))
    use_dashboards(mocker, board)
    schedule = report(board)
    if bad == "unchecked":
        board = dashboard(chart(11), chart(12, time_range="Last 30 days"))
        use_dashboards(mocker, board)
        mocker.patch.object(
            ReportSchedule,
            "get_native_filters_params",
            side_effect=ValueError("junk"),
        )
        schedule = report(board, extra=stored_time_filter("Last 30 days"))

    with flags():
        run(mocker, schedule)

    keys, lines = telemetry()
    key = (
        "time_range_limit.rejected.report.max_span.global"
        if bad == "limit"
        else "time_range_limit.unchecked.report"
    )
    assert keys == [key, key]
    assert [(line["chart_id"], line["dashboard_id"]) for line in lines] == [
        (11, 3),
        (12, 3),
    ]
    assert sql_runs == []


@freeze_time(NOW)
def test_limits_could_apply_names_the_level(
    sql_runs: list[str],
    mocker: MockerFixture,
    dataset: Any,  # noqa: F811
    telemetry: Any,
) -> None:
    set_global(mocker, None)
    dataset.extra = json.dumps(
        {"time_range_limits": {**cast(dict[str, Any], policy(30)), "max_span": "x"}}
    )
    broken = chart(11)
    broken.query_context = json.dumps({"datasource": {"type": "table", "id": 7}})
    board = dashboard(broken, chart(12, time_range="Last 7 days"))
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    assert_failed(result, UNAVAILABLE, reason="POLICY_UNAVAILABLE", system=True)
    (error,) = result.error.errors
    assert {key: error.extra[key] for key in ("source", "field", "dataset_id")} == {
        "source": "dataset",
        "field": "max_span",
        "dataset_id": 7,
    }
    assert "value" not in error.extra
    keys, lines = telemetry()
    assert keys == ["time_range_limit.unavailable.report.dataset"]
    (line,) = lines
    assert (line["chart_id"], line["dataset_id"], line["dashboard_id"]) == (11, 7, 3)
    assert line["field"] == "max_span"


# The charts behind a chart's line and table annotation layers

LAYER_GUARD = "Range can't be longer than 45 days. This one is 60 days."
ANN = 22


def annotation_layer(
    value: int, source_type: str = "line", **extra: Any
) -> dict[str, Any]:
    return {
        "name": f"Layer {value}",
        "annotationType": "EVENT" if source_type == "table" else "TIME_SERIES",
        "sourceType": source_type,
        "value": value,
        "overrides": {},
        "show": True,
        **extra,
    }


def layer_charts(mocker: MockerFixture, *charts: Any) -> Any:
    """``ANN`` saved with ``Last 60 days``, plus ``charts``; a ``None`` in
    ``charts`` is a missing ``ANN``."""
    by_id: dict[int, Any] = {ANN: chart(ANN, "Last 60 days")}
    for found in charts:
        if found is None:
            by_id[ANN] = None
        else:
            by_id[found.id] = found
    return mocker.patch(
        "superset.daos.chart.ChartDAO.find_by_id",
        side_effect=lambda model_id, **kwargs: by_id.get(model_id),
    )


def chart_with_layers(
    chart_id: int,
    layers: list[Any],
    time_range: str = "Last 30 days",
    **form_data: Any,
) -> Any:
    found = chart(chart_id, time_range, annotation_layers=layers, **form_data)
    if found.query_context:
        saved = json.loads(found.query_context)
        saved["queries"][0]["annotation_layers"] = layers
        found.query_context = json.dumps(saved)
    return found


def deny_access(mocker: MockerFixture) -> None:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException
    from superset.extensions import security_manager

    mocker.patch.object(
        security_manager,
        "raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        ),
    )


def spy_limits_could_apply(mocker: MockerFixture) -> Any:
    from superset.commands.report import execute

    return mocker.spy(execute.BaseReportState, "_limits_could_apply")


@freeze_time(NOW)
@pytest.mark.parametrize(
    "source_type,report_format",
    [("line", "PNG"), ("table", "PNG"), ("line", "CSV"), ("table", "TEXT")],
    ids=["line-png", "table-png", "line-csv", "table-text"],
)
def test_chart_report_annotation_layer_breaking_the_limits_fails(
    sql_runs: list[str], mocker: MockerFixture, source_type: str, report_format: str
) -> None:
    from superset.commands.report.exceptions import ReportScheduleTimeRangeLimitError

    set_global(mocker, policy(45))
    layer_charts(mocker)
    saved = chart_with_layers(11, [annotation_layer(ANN, source_type)])

    with flags():
        result = run(mocker, report(saved, report_format))

    assert_failed(result, LAYER_GUARD)
    assert isinstance(result.error, ReportScheduleTimeRangeLimitError)
    assert result.error.errors[0].error_type == "TIME_RANGE_LIMIT_ERROR"
    assert sql_runs == []


@freeze_time(NOW)
def test_dashboard_report_names_the_chart_of_a_bad_annotation_layer(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(45))
    layer_charts(mocker)
    board = dashboard(
        chart(11),
        chart_with_layers(12, [annotation_layer(ANN)]),
        chart(13, time_range="Last 30 days"),
    )
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    message = (
        "Calls by day: Range can't be longer than 45 days. This one is 365 days.;"
        f"Calls by agent: {LAYER_GUARD}"
    )
    assert_failed(result, message)
    assert [error.extra["chart_id"] for error in result.error.errors] == [11, 12]
    assert sql_runs == []


@freeze_time(NOW)
def test_chart_without_query_context_checks_its_annotation_layers(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(45))
    layer_charts(mocker)
    saved = chart_with_layers(11, [annotation_layer(ANN)])
    saved.query_context = None
    params = saved.params

    with flags():
        result = run(mocker, report(saved, "CSV"))

    assert_failed(result, LAYER_GUARD)
    assert saved.params == params
    assert sql_runs == []


@freeze_time(NOW)
def test_annotation_layer_rejection_logged_in_the_layer_scope(
    sql_runs: list[str], mocker: MockerFixture, telemetry: Any
) -> None:
    set_global(mocker, policy(45))
    layer_charts(mocker)
    board = dashboard(chart_with_layers(12, [annotation_layer(ANN)]))
    use_dashboards(mocker, board)

    with flags():
        result = run(mocker, report(board))

    assert_failed(result, f"Calls by agent: {LAYER_GUARD}")
    assert [error.extra["chart_id"] for error in result.error.errors] == [12]
    keys, lines = telemetry()
    assert keys == ["time_range_limit.rejected.report.max_span.global"]
    (line,) = lines
    assert (line["path"], line["chart_id"], line["dashboard_id"]) == (
        "report",
        ANN,
        board.id,
    )
    assert sql_runs == []


@freeze_time(NOW)
def test_annotation_layer_within_the_limits_sent(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    layer_charts(mocker)
    saved = chart_with_layers(11, [annotation_layer(ANN)])

    with flags():
        result = run(mocker, report(saved))

    assert_rendered(result, ["screenshot"])
    assert sql_runs == []


@freeze_time(NOW)
@pytest.mark.parametrize("case", ["missing", "broken"])
def test_unbuildable_annotation_layer_goes_on(
    sql_runs: list[str], mocker: MockerFixture, case: str
) -> None:
    set_global(mocker, policy(45))
    broken = chart(ANN, "Last 60 days")
    broken.query_context = "{junk"
    layer_charts(mocker, None if case == "missing" else broken)
    could_apply = spy_limits_could_apply(mocker)
    saved = chart_with_layers(11, [annotation_layer(ANN)])

    with flags():
        result = run(mocker, report(saved))

    assert_rendered(result, ["screenshot"])
    could_apply.assert_not_called()
    assert sql_runs == []


@freeze_time(NOW)
def test_annotation_layer_the_executor_cannot_access_goes_on(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(45))
    layer_charts(mocker)
    deny_access(mocker)
    could_apply = spy_limits_could_apply(mocker)
    saved = chart_with_layers(11, [annotation_layer(ANN)])

    with flags():
        result = run(mocker, report(saved))

    assert_rendered(result, ["screenshot"])
    could_apply.assert_not_called()
    assert sql_runs == []


@freeze_time(NOW)
def test_annotation_layers_flag_off_and_no_limits_run_as_before(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    find_chart = layer_charts(mocker)
    set_global(mocker, policy(45))

    def one_run(limits: bool) -> Run:
        saved = chart_with_layers(11, [annotation_layer(ANN)])
        with flags(limits=limits):
            return run(mocker, report(saved))

    before = one_run(False)
    assert_rendered(before, ["screenshot"])
    find_chart.assert_not_called()

    set_global(mocker, None)
    after = one_run(True)
    assert after.logs == before.logs
    assert after.renders == before.renders
    assert after.sent == before.sent
    assert sql_runs == []


@freeze_time(NOW)
def test_formula_and_native_annotation_layers_not_checked(
    sql_runs: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(45))
    find_chart = layer_charts(mocker)
    saved = chart_with_layers(
        11,
        [
            annotation_layer(ANN, "NATIVE"),
            {**annotation_layer(ANN, ""), "annotationType": "FORMULA"},
        ],
    )

    with flags():
        result = run(mocker, report(saved))

    assert_rendered(result, ["screenshot"])
    find_chart.assert_not_called()
    assert sql_runs == []
