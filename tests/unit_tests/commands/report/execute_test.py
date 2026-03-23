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

import json  # noqa: TID251
from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from pytest_mock import MockerFixture

from superset.app import SupersetApp
from superset.commands.exceptions import UpdateFailedError
from superset.commands.report.exceptions import (
    ReportScheduleAlertGracePeriodError,
    ReportScheduleCsvFailedError,
    ReportSchedulePreviousWorkingError,
    ReportScheduleScreenshotFailedError,
    ReportScheduleScreenshotTimeout,
    ReportScheduleStateNotFoundError,
    ReportScheduleUnexpectedError,
    ReportScheduleWorkingTimeoutError,
)
from superset.commands.report.execute import (
    BaseReportState,
    ReportNotTriggeredErrorState,
    ReportScheduleStateMachine,
    ReportSuccessState,
    ReportWorkingState,
)
from superset.daos.report import REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER
from superset.dashboards.permalink.types import DashboardPermalinkState
from superset.reports.models import (
    ReportDataFormat,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
    ReportSourceFormat,
    ReportState,
)
from superset.utils.core import HeaderDataType
from superset.utils.screenshots import ChartScreenshot
from tests.integration_tests.conftest import with_feature_flags


def test_log_data_with_chart(mocker: MockerFixture) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = True
    mock_report_schedule.chart_id = 123
    mock_report_schedule.dashboard_id = None
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: HeaderDataType = class_instance._get_log_data()

    expected_result: HeaderDataType = {
        "notification_type": "report_type",
        "notification_source": ReportSourceFormat.CHART,
        "notification_format": "report_format",
        "chart_id": 123,
        "dashboard_id": None,
        "owners": [1, 2],
        "slack_channels": None,
        "execution_id": "execution_id_example",
    }

    assert result == expected_result


def test_log_data_with_dashboard(mocker: MockerFixture) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: HeaderDataType = class_instance._get_log_data()

    expected_result: HeaderDataType = {
        "notification_type": "report_type",
        "notification_source": ReportSourceFormat.DASHBOARD,
        "notification_format": "report_format",
        "chart_id": None,
        "dashboard_id": 123,
        "owners": [1, 2],
        "slack_channels": None,
        "execution_id": "execution_id_example",
    }

    assert result == expected_result


def test_log_data_with_email_recipients(mocker: MockerFixture) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    mock_report_schedule.recipients = [
        mocker.Mock(type=ReportRecipientType.EMAIL, recipient_config_json="email_1"),
        mocker.Mock(type=ReportRecipientType.EMAIL, recipient_config_json="email_2"),
    ]

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: HeaderDataType = class_instance._get_log_data()

    expected_result: HeaderDataType = {
        "notification_type": "report_type",
        "notification_source": ReportSourceFormat.DASHBOARD,
        "notification_format": "report_format",
        "chart_id": None,
        "dashboard_id": 123,
        "owners": [1, 2],
        "slack_channels": [],
        "execution_id": "execution_id_example",
    }

    assert result == expected_result


def test_log_data_with_slack_recipients(mocker: MockerFixture) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    mock_report_schedule.recipients = [
        mocker.Mock(type=ReportRecipientType.SLACK, recipient_config_json="channel_1"),
        mocker.Mock(type=ReportRecipientType.SLACK, recipient_config_json="channel_2"),
    ]

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: HeaderDataType = class_instance._get_log_data()

    expected_result: HeaderDataType = {
        "notification_type": "report_type",
        "notification_source": ReportSourceFormat.DASHBOARD,
        "notification_format": "report_format",
        "chart_id": None,
        "dashboard_id": 123,
        "owners": [1, 2],
        "slack_channels": ["channel_1", "channel_2"],
        "execution_id": "execution_id_example",
    }

    assert result == expected_result


def test_log_data_no_owners(mocker: MockerFixture) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = []
    mock_report_schedule.recipients = [
        mocker.Mock(type=ReportRecipientType.SLACK, recipient_config_json="channel_1"),
        mocker.Mock(type=ReportRecipientType.SLACK, recipient_config_json="channel_2"),
    ]

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: HeaderDataType = class_instance._get_log_data()

    expected_result: HeaderDataType = {
        "notification_type": "report_type",
        "notification_source": ReportSourceFormat.DASHBOARD,
        "notification_format": "report_format",
        "chart_id": None,
        "dashboard_id": 123,
        "owners": [],
        "slack_channels": ["channel_1", "channel_2"],
        "execution_id": "execution_id_example",
    }

    assert result == expected_result


def test_log_data_with_missing_values(mocker: MockerFixture) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = None
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = None
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = [
        mocker.Mock(type=ReportRecipientType.SLACK, recipient_config_json="channel_1"),
        mocker.Mock(
            type=ReportRecipientType.SLACKV2, recipient_config_json="channel_2"
        ),
    ]

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: HeaderDataType = class_instance._get_log_data()

    expected_result: HeaderDataType = {
        "notification_type": "report_type",
        "notification_source": ReportSourceFormat.DASHBOARD,
        "notification_format": "report_format",
        "chart_id": None,
        "dashboard_id": None,
        "owners": [1, 2],
        "slack_channels": ["channel_1", "channel_2"],
        "execution_id": "execution_id_example",
    }

    assert result == expected_result


@pytest.mark.parametrize(
    "anchors, permalink_side_effect, expected_paths",
    [
        # Test user select multiple tabs to export in a dashboard report
        (
            ["mock_tab_anchor_1", "mock_tab_anchor_2"],
            ["url1", "url2"],
            [
                "superset/dashboard/p/url1/",
                "superset/dashboard/p/url2/",
            ],
        ),
        # Test user select one tab to export in a dashboard report
        (
            "mock_tab_anchor_1",
            ["url1"],
            ["superset/dashboard/p/url1/"],
        ),
    ],
)
@patch(
    "superset.commands.dashboard.permalink.create.CreateDashboardPermalinkCommand.run"
)
@with_feature_flags(ALERT_REPORT_TABS=True)
def test_get_dashboard_urls_with_multiple_tabs(
    mock_run, mocker: MockerFixture, anchors, permalink_side_effect, expected_paths, app
) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    mock_report_schedule.extra = {
        "dashboard": {
            "anchor": json.dumps(anchors) if isinstance(anchors, list) else anchors,
            "dataMask": None,
            "activeTabs": None,
            "urlParams": None,
        }
    }

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule
    mock_run.side_effect = permalink_side_effect

    result: list[str] = class_instance.get_dashboard_urls()

    # Build expected URIs using the app's configured WEBDRIVER_BASEURL
    # Use urljoin to handle proper URL joining (handles double slashes)
    import urllib.parse

    base_url = app.config.get("WEBDRIVER_BASEURL", "http://0.0.0.0:8080/")
    expected_uris = [urllib.parse.urljoin(base_url, path) for path in expected_paths]
    assert result == expected_uris


@patch(
    "superset.commands.dashboard.permalink.create.CreateDashboardPermalinkCommand.run"
)
@with_feature_flags(ALERT_REPORT_TABS=True)
def test_get_dashboard_urls_with_exporting_dashboard_only(
    mock_run,
    mocker: MockerFixture,
    app,
) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    mock_report_schedule.extra = {
        "dashboard": {
            "anchor": "",
            "dataMask": None,
            "activeTabs": None,
            "urlParams": None,
        }
    }
    mock_run.return_value = "url1"

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: list[str] = class_instance.get_dashboard_urls()

    import urllib.parse

    base_url = app.config.get("WEBDRIVER_BASEURL", "http://0.0.0.0:8080/")
    expected_url = urllib.parse.urljoin(base_url, "superset/dashboard/p/url1/")
    assert expected_url == result[0]


@patch("superset.commands.report.execute.CreateDashboardPermalinkCommand")
@with_feature_flags(ALERT_REPORT_TABS=True)
def test_get_dashboard_urls_with_filters_and_tabs(
    mock_permalink_cls,
    mocker: MockerFixture,
    app,
) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    native_filter_rison = "(NATIVE_FILTER-1:(filterType:filter_select))"
    mock_report_schedule.extra = {
        "dashboard": {
            "anchor": json.dumps(["TAB-1", "TAB-2"]),
            "dataMask": {"NATIVE_FILTER-1": {"filterState": {"value": ["Sales"]}}},
            "activeTabs": ["TAB-1", "TAB-2"],
            "urlParams": None,
            "nativeFilters": [  # type: ignore[typeddict-unknown-key]
                {
                    "nativeFilterId": "NATIVE_FILTER-1",
                    "filterType": "filter_select",
                    "columnName": "department",
                    "filterValues": ["Sales"],
                }
            ],
        }
    }
    mock_report_schedule.get_native_filters_params.return_value = native_filter_rison  # type: ignore[attr-defined]
    mock_permalink_cls.return_value.run.side_effect = ["key1", "key2"]

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: list[str] = class_instance.get_dashboard_urls()

    import urllib.parse

    base_url = app.config.get("WEBDRIVER_BASEURL", "http://0.0.0.0:8080/")
    assert result == [
        urllib.parse.urljoin(base_url, "superset/dashboard/p/key1/"),
        urllib.parse.urljoin(base_url, "superset/dashboard/p/key2/"),
    ]
    mock_report_schedule.get_native_filters_params.assert_called_once()  # type: ignore[attr-defined]
    assert mock_permalink_cls.call_count == 2
    for call in mock_permalink_cls.call_args_list:
        state = call.kwargs["state"]
        assert state["urlParams"] == [["native_filters", native_filter_rison]]
    assert mock_permalink_cls.call_args_list[0].kwargs["state"]["anchor"] == "TAB-1"
    assert mock_permalink_cls.call_args_list[1].kwargs["state"]["anchor"] == "TAB-2"


@pytest.mark.xfail(
    reason="BUG: {urlParams: [...], **dashboard_state} overwrites native_filters. "
    "Will pass when execute.py:281-291 is fixed.",
    strict=False,
)
@patch("superset.commands.report.execute.CreateDashboardPermalinkCommand")
@with_feature_flags(ALERT_REPORT_TABS=True)
def test_get_dashboard_urls_with_filters_no_tabs(
    mock_permalink_cls,
    mocker: MockerFixture,
    app,
) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    native_filter_rison = "(NATIVE_FILTER-1:(filterType:filter_select))"
    mock_report_schedule.extra = {
        "dashboard": {
            "anchor": "",
            "dataMask": {"NATIVE_FILTER-1": {"filterState": {"value": ["Sales"]}}},
            "activeTabs": None,
            "urlParams": None,
            "nativeFilters": [  # type: ignore[typeddict-unknown-key]
                {
                    "nativeFilterId": "NATIVE_FILTER-1",
                    "filterType": "filter_select",
                    "columnName": "department",
                    "filterValues": ["Sales"],
                }
            ],
        }
    }
    mock_report_schedule.get_native_filters_params.return_value = native_filter_rison  # type: ignore[attr-defined]
    mock_permalink_cls.return_value.run.return_value = "key1"

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    result: list[str] = class_instance.get_dashboard_urls()

    import urllib.parse

    base_url = app.config.get("WEBDRIVER_BASEURL", "http://0.0.0.0:8080/")
    assert result == [
        urllib.parse.urljoin(base_url, "superset/dashboard/p/key1/"),
    ]
    mock_report_schedule.get_native_filters_params.assert_called_once()  # type: ignore[attr-defined]
    assert mock_permalink_cls.call_count == 1
    state = mock_permalink_cls.call_args_list[0].kwargs["state"]
    assert state["urlParams"] == [["native_filters", native_filter_rison]]


@pytest.mark.xfail(
    reason="BUG: {urlParams: [...], **dashboard_state} overwrites native_filters "
    "and drops existing urlParams. Will pass when execute.py:281-291 is fixed.",
    strict=False,
)
@patch("superset.commands.report.execute.CreateDashboardPermalinkCommand")
@with_feature_flags(ALERT_REPORT_TABS=True)
def test_get_dashboard_urls_preserves_existing_url_params(
    mock_permalink_cls,
    mocker: MockerFixture,
    app,
) -> None:
    """Existing urlParams (e.g. standalone) must survive native_filters merge."""
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    native_filter_rison = "(NATIVE_FILTER-1:(filterType:filter_select))"
    mock_report_schedule.extra = {
        "dashboard": {
            "anchor": "",
            "dataMask": {},
            "activeTabs": None,
            "urlParams": [("standalone", "true"), ("show_filters", "0")],
            "nativeFilters": [  # type: ignore[typeddict-unknown-key]
                {
                    "nativeFilterId": "NATIVE_FILTER-1",
                    "filterType": "filter_select",
                    "columnName": "dept",
                    "filterValues": ["Sales"],
                }
            ],
        }
    }
    mock_report_schedule.get_native_filters_params.return_value = native_filter_rison  # type: ignore[attr-defined]
    mock_permalink_cls.return_value.run.return_value = "key1"

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    class_instance.get_dashboard_urls()

    state = mock_permalink_cls.call_args_list[0].kwargs["state"]
    assert state["urlParams"] == [
        ["standalone", "true"],
        ["show_filters", "0"],
        ["native_filters", native_filter_rison],
    ]


@pytest.mark.xfail(
    reason="BUG: {urlParams: [...], **dashboard_state} overwrites native_filters "
    "and drops existing urlParams. Will pass when execute.py:281-291 is fixed.",
    strict=False,
)
@patch("superset.commands.report.execute.CreateDashboardPermalinkCommand")
@with_feature_flags(ALERT_REPORT_TABS=True)
def test_get_dashboard_urls_deduplicates_stale_native_filters(
    mock_permalink_cls,
    mocker: MockerFixture,
    app,
) -> None:
    """A stale native_filters entry in urlParams is replaced, not duplicated."""
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.chart_id = None
    mock_report_schedule.dashboard_id = 123
    mock_report_schedule.type = "report_type"
    mock_report_schedule.report_format = "report_format"
    mock_report_schedule.owners = [1, 2]
    mock_report_schedule.recipients = []
    native_filter_rison = "(NATIVE_FILTER-1:(new:value))"
    mock_report_schedule.extra = {
        "dashboard": {
            "anchor": "",
            "dataMask": {},
            "activeTabs": None,
            "urlParams": [
                ("standalone", "true"),
                ("native_filters", "(old:stale_value)"),
            ],
            "nativeFilters": [],  # type: ignore[typeddict-unknown-key]
        }
    }
    mock_report_schedule.get_native_filters_params.return_value = native_filter_rison  # type: ignore[attr-defined]
    mock_permalink_cls.return_value.run.return_value = "key1"

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule

    class_instance.get_dashboard_urls()

    state = mock_permalink_cls.call_args_list[0].kwargs["state"]
    assert state["urlParams"] == [
        ["standalone", "true"],
        ["native_filters", native_filter_rison],
    ]


@patch(
    "superset.commands.dashboard.permalink.create.CreateDashboardPermalinkCommand.run"
)
def test_get_tab_urls(
    mock_run,
    mocker: MockerFixture,
    app,
) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.dashboard_id = 123

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule
    mock_run.side_effect = ["uri1", "uri2"]
    tab_anchors = ["1", "2"]
    result: list[str] = class_instance._get_tabs_urls(tab_anchors)
    import urllib.parse

    base_url = app.config.get("WEBDRIVER_BASEURL", "http://0.0.0.0:8080/")
    assert result == [
        urllib.parse.urljoin(base_url, "superset/dashboard/p/uri1/"),
        urllib.parse.urljoin(base_url, "superset/dashboard/p/uri2/"),
    ]


@patch(
    "superset.commands.dashboard.permalink.create.CreateDashboardPermalinkCommand.run"
)
def test_get_tab_url(
    mock_run,
    mocker: MockerFixture,
    app,
) -> None:
    mock_report_schedule: ReportSchedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.dashboard_id = 123

    class_instance: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    class_instance._report_schedule = mock_report_schedule
    mock_run.return_value = "uri"
    dashboard_state = DashboardPermalinkState(
        anchor="1",
        dataMask=None,
        activeTabs=None,
        urlParams=None,
    )
    result: str = class_instance._get_tab_url(dashboard_state)
    import urllib.parse

    base_url = app.config.get("WEBDRIVER_BASEURL", "http://0.0.0.0:8080/")
    assert result == urllib.parse.urljoin(base_url, "superset/dashboard/p/uri/")


def create_report_schedule(
    mocker: MockerFixture,
    custom_width: int | None = None,
    custom_height: int | None = None,
) -> ReportSchedule:
    """Helper function to create a ReportSchedule instance with specified dimensions."""
    schedule = ReportSchedule()
    schedule.type = ReportScheduleType.REPORT
    schedule.name = "Test Report"
    schedule.description = "Test Description"
    schedule.chart = mocker.MagicMock()
    schedule.chart.id = 1
    schedule.dashboard = None
    schedule.database = None
    schedule.custom_width = custom_width
    schedule.custom_height = custom_height
    return schedule


@pytest.mark.parametrize(
    "test_id,custom_width,max_width,window_width,expected_width",
    [
        # Test when custom width exceeds max width
        ("exceeds_max", 2000, 1600, 800, 1600),
        # Test when custom width is less than max width
        ("under_max", 1200, 1600, 800, 1200),
        # Test when custom width is None (should use window width)
        ("no_custom", None, 1600, 800, 800),
        # Test when custom width equals max width
        ("equals_max", 1600, 1600, 800, 1600),
    ],
)
def test_screenshot_width_calculation(
    app: SupersetApp,
    mocker: MockerFixture,
    test_id: str,
    custom_width: int | None,
    max_width: int,
    window_width: int,
    expected_width: int,
) -> None:
    """
    Test that screenshot width is correctly calculated.

    The width should be:
    - Limited by max_width when custom_width exceeds it
    - Equal to custom_width when it's less than max_width
    - Equal to window_width when custom_width is None
    """
    from superset.commands.report.execute import BaseReportState

    # Mock configuration
    app.config.update(
        {
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": max_width,
            "WEBDRIVER_WINDOW": {
                "slice": (window_width, 600),
                "dashboard": (window_width, 600),
            },
            "ALERT_REPORTS_EXECUTORS": {},
        }
    )

    # Create report schedule with specified custom width
    report_schedule = create_report_schedule(mocker, custom_width=custom_width)

    # Initialize BaseReportState
    report_state = BaseReportState(
        report_schedule=report_schedule,
        scheduled_dttm=datetime.now(),
        execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
    )

    # Mock security manager and screenshot
    with (
        patch(
            "superset.commands.report.execute.security_manager"
        ) as mock_security_manager,
        patch(
            "superset.utils.screenshots.ChartScreenshot.get_screenshot"
        ) as mock_get_screenshot,
    ):
        # Mock user
        mock_user = mocker.MagicMock()
        mock_security_manager.find_user.return_value = mock_user
        mock_get_screenshot.return_value = b"screenshot bytes"

        # Mock get_executor to avoid database lookups
        with patch(
            "superset.commands.report.execute.get_executor"
        ) as mock_get_executor:
            mock_get_executor.return_value = ("executor", "username")

            # Capture the ChartScreenshot instantiation
            with patch(
                "superset.commands.report.execute.ChartScreenshot",
                wraps=ChartScreenshot,
            ) as mock_chart_screenshot:
                # Call the method that triggers screenshot creation
                report_state._get_screenshots()

                # Verify ChartScreenshot was created with correct window_size
                mock_chart_screenshot.assert_called_once()
                _, kwargs = mock_chart_screenshot.call_args
                assert kwargs["window_size"][0] == expected_width, (
                    f"Test {test_id}: Expected width {expected_width}, "
                    f"but got {kwargs['window_size'][0]}"
                )


def test_update_recipient_to_slack_v2(mocker: MockerFixture):
    """
    Test converting a Slack recipient to Slack v2 format.
    """
    mocker.patch(
        "superset.commands.report.execute.get_channels_with_search",
        return_value=[
            {
                "id": "abc124f",
                "name": "channel-1",
                "is_member": True,
                "is_private": False,
            },
            {
                "id": "blah_!channel_2",
                "name": "Channel_2",
                "is_member": True,
                "is_private": False,
            },
        ],
    )
    mock_report_schedule = ReportSchedule(
        recipients=[
            ReportRecipients(
                type=ReportRecipientType.SLACK,
                recipient_config_json=json.dumps({"target": "Channel-1, Channel_2"}),
            ),
        ],
    )

    mock_cmmd: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    mock_cmmd.update_report_schedule_slack_v2()

    assert (
        mock_cmmd._report_schedule.recipients[0].recipient_config_json
        == '{"target": "abc124f,blah_!channel_2"}'
    )
    assert mock_cmmd._report_schedule.recipients[0].type == ReportRecipientType.SLACKV2


def test_update_recipient_to_slack_v2_missing_channels(mocker: MockerFixture):
    """
    Test converting a Slack recipient to Slack v2 format raises an error
    in case it can't find all channels.
    """
    mocker.patch(
        "superset.commands.report.execute.get_channels_with_search",
        return_value=[
            {
                "id": "blah_!channel_2",
                "name": "Channel 2",
                "is_member": True,
                "is_private": False,
            },
        ],
    )
    mock_report_schedule = ReportSchedule(
        name="Test Report",
        recipients=[
            ReportRecipients(
                type=ReportRecipientType.SLACK,
                recipient_config_json=json.dumps({"target": "Channel 1, Channel 2"}),
            ),
        ],
    )

    mock_cmmd: BaseReportState = BaseReportState(
        mock_report_schedule, "January 1, 2021", "execution_id_example"
    )
    with pytest.raises(UpdateFailedError):
        mock_cmmd.update_report_schedule_slack_v2()


# ---------------------------------------------------------------------------
# Tier 1: _update_query_context + create_log
# ---------------------------------------------------------------------------


def test_update_query_context_wraps_screenshot_failure(mocker: MockerFixture) -> None:
    """_update_query_context wraps ScreenshotFailedError as CsvFailedError."""
    schedule = mocker.Mock(spec=ReportSchedule)
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    state._report_schedule = schedule
    mocker.patch.object(
        state,
        "_get_screenshots",
        side_effect=ReportScheduleScreenshotFailedError("boom"),
    )
    with pytest.raises(ReportScheduleCsvFailedError, match="query context"):
        state._update_query_context()


def test_update_query_context_wraps_screenshot_timeout(mocker: MockerFixture) -> None:
    """_update_query_context wraps ScreenshotTimeout as CsvFailedError."""
    schedule = mocker.Mock(spec=ReportSchedule)
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    state._report_schedule = schedule
    mocker.patch.object(
        state,
        "_get_screenshots",
        side_effect=ReportScheduleScreenshotTimeout(),
    )
    with pytest.raises(ReportScheduleCsvFailedError, match="query context"):
        state._update_query_context()


def test_create_log_stale_data_raises_unexpected_error(mocker: MockerFixture) -> None:
    """StaleDataError during create_log should rollback and raise UnexpectedError."""
    from sqlalchemy.orm.exc import StaleDataError

    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.last_value = None
    schedule.last_value_row_json = None
    schedule.last_state = ReportState.WORKING

    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    state._report_schedule = schedule

    mock_db = mocker.patch("superset.commands.report.execute.db")
    mock_db.session.commit.side_effect = StaleDataError("stale")
    # Prevent SQLAlchemy from inspecting the mock schedule during log creation
    mocker.patch(
        "superset.commands.report.execute.ReportExecutionLog",
        return_value=mocker.Mock(),
    )

    with pytest.raises(ReportScheduleUnexpectedError):
        state.create_log()
    mock_db.session.rollback.assert_called_once()


# ---------------------------------------------------------------------------
# Tier 2: _get_notification_content branches
# ---------------------------------------------------------------------------


def _make_notification_state(
    mocker: MockerFixture,
    *,
    report_format: ReportDataFormat = ReportDataFormat.PNG,
    schedule_type: ReportScheduleType = ReportScheduleType.REPORT,
    has_chart: bool = True,
    email_subject: str | None = None,
    chart_name: str = "My Chart",
    dashboard_title: str = "My Dashboard",
) -> BaseReportState:
    """Build a BaseReportState with a mock schedule for notification tests."""
    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.type = schedule_type
    schedule.report_format = report_format
    schedule.name = "Test Schedule"
    schedule.description = "desc"
    schedule.email_subject = email_subject
    schedule.force_screenshot = False
    schedule.recipients = []
    schedule.owners = []

    if has_chart:
        schedule.chart = mocker.Mock()
        schedule.chart.slice_name = chart_name
        schedule.dashboard = None
    else:
        schedule.chart = None
        schedule.dashboard = mocker.Mock()
        schedule.dashboard.dashboard_title = dashboard_title
        schedule.dashboard.uuid = "dash-uuid"
        schedule.dashboard.id = 1

    schedule.extra = {}

    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    state._report_schedule = schedule

    # Stub helpers that _get_notification_content calls
    mocker.patch.object(state, "_get_log_data", return_value={})
    mocker.patch.object(state, "_get_url", return_value="http://example.com")

    return state


@patch("superset.commands.report.execute.feature_flag_manager")
def test_get_notification_content_png_screenshot(
    mock_ff, mocker: MockerFixture
) -> None:
    mock_ff.is_feature_enabled.return_value = False
    state = _make_notification_state(mocker, report_format=ReportDataFormat.PNG)
    mocker.patch.object(state, "_get_screenshots", return_value=[b"img1", b"img2"])

    content = state._get_notification_content()
    assert content.screenshots == [b"img1", b"img2"]
    assert content.text is None


@patch("superset.commands.report.execute.feature_flag_manager")
def test_get_notification_content_png_empty_returns_error(
    mock_ff, mocker: MockerFixture
) -> None:
    mock_ff.is_feature_enabled.return_value = False
    state = _make_notification_state(mocker, report_format=ReportDataFormat.PNG)
    mocker.patch.object(state, "_get_screenshots", return_value=[])

    content = state._get_notification_content()
    assert content.text == "Unexpected missing screenshot"


@patch("superset.commands.report.execute.feature_flag_manager")
def test_get_notification_content_csv_format(mock_ff, mocker: MockerFixture) -> None:
    mock_ff.is_feature_enabled.return_value = False
    state = _make_notification_state(
        mocker, report_format=ReportDataFormat.CSV, has_chart=True
    )
    mocker.patch.object(state, "_get_csv_data", return_value=b"col1,col2\n1,2")

    content = state._get_notification_content()
    assert content.csv == b"col1,col2\n1,2"


@patch("superset.commands.report.execute.feature_flag_manager")
def test_get_notification_content_text_format(mock_ff, mocker: MockerFixture) -> None:
    import pandas as pd

    mock_ff.is_feature_enabled.return_value = False
    state = _make_notification_state(
        mocker, report_format=ReportDataFormat.TEXT, has_chart=True
    )
    df = pd.DataFrame({"a": [1]})
    mocker.patch.object(state, "_get_embedded_data", return_value=df)

    content = state._get_notification_content()
    assert content.embedded_data is not None
    assert list(content.embedded_data.columns) == ["a"]


@pytest.mark.parametrize(
    "email_subject,has_chart,expected_name",
    [
        ("Custom Subject", True, "Custom Subject"),
        (None, True, "Test Schedule: My Chart"),
        (None, False, "Test Schedule: My Dashboard"),
    ],
    ids=["email_subject", "chart_name", "dashboard_name"],
)
@patch("superset.commands.report.execute.feature_flag_manager")
def test_get_notification_content_name(
    mock_ff,
    mocker: MockerFixture,
    email_subject: str | None,
    has_chart: bool,
    expected_name: str,
) -> None:
    """Notification name comes from email_subject, chart, or dashboard."""
    mock_ff.is_feature_enabled.return_value = False
    state = _make_notification_state(
        mocker,
        report_format=ReportDataFormat.PNG,
        email_subject=email_subject,
        has_chart=has_chart,
    )
    mocker.patch.object(state, "_get_screenshots", return_value=[b"img"])

    content = state._get_notification_content()
    assert content.name == expected_name


# ---------------------------------------------------------------------------
# Tier 3: State machine top-level branches
# ---------------------------------------------------------------------------


def _make_state_instance(
    mocker: MockerFixture,
    cls: type,
    *,
    schedule_type: ReportScheduleType = ReportScheduleType.ALERT,
    last_state: ReportState = ReportState.NOOP,
    grace_period: int = 3600,
    working_timeout: int = 3600,
) -> BaseReportState:
    """Create a state-machine state instance with a mocked schedule."""
    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.type = schedule_type
    schedule.last_state = last_state
    schedule.grace_period = grace_period
    schedule.working_timeout = working_timeout
    schedule.last_eval_dttm = datetime.utcnow()
    schedule.name = "Test"
    schedule.owners = []
    schedule.recipients = []
    schedule.force_screenshot = False
    schedule.extra = {}

    instance = cls(schedule, datetime.utcnow(), uuid4())
    instance._report_schedule = schedule
    return instance


def test_working_state_timeout_raises_timeout_error(mocker: MockerFixture) -> None:
    """Working state past timeout should raise WorkingTimeoutError and log ERROR."""
    state = _make_state_instance(mocker, ReportWorkingState)
    mocker.patch.object(state, "is_on_working_timeout", return_value=True)

    mock_log = mocker.Mock()
    mock_log.end_dttm = datetime.utcnow() - timedelta(hours=2)
    mocker.patch(
        "superset.commands.report.execute.ReportScheduleDAO.find_last_entered_working_log",
        return_value=mock_log,
    )
    mocker.patch.object(state, "update_report_schedule_and_log")

    with pytest.raises(ReportScheduleWorkingTimeoutError):
        state.next()

    state.update_report_schedule_and_log.assert_called_once_with(  # type: ignore[attr-defined]
        ReportState.ERROR,
        error_message=str(ReportScheduleWorkingTimeoutError()),
    )


def test_working_state_still_working_raises_previous_working(
    mocker: MockerFixture,
) -> None:
    """Working state not yet timed out should raise PreviousWorkingError."""
    state = _make_state_instance(mocker, ReportWorkingState)
    mocker.patch.object(state, "is_on_working_timeout", return_value=False)
    mocker.patch.object(state, "update_report_schedule_and_log")

    with pytest.raises(ReportSchedulePreviousWorkingError):
        state.next()

    state.update_report_schedule_and_log.assert_called_once_with(  # type: ignore[attr-defined]
        ReportState.WORKING,
        error_message=str(ReportSchedulePreviousWorkingError()),
    )


def test_success_state_grace_period_returns_without_sending(
    mocker: MockerFixture,
) -> None:
    """Alert in grace period should set GRACE state and not send."""
    state = _make_state_instance(
        mocker,
        ReportSuccessState,
        schedule_type=ReportScheduleType.ALERT,
    )
    mocker.patch.object(state, "is_in_grace_period", return_value=True)
    mocker.patch.object(state, "update_report_schedule_and_log")
    mock_send = mocker.patch.object(state, "send")

    state.next()

    mock_send.assert_not_called()
    state.update_report_schedule_and_log.assert_called_once_with(  # type: ignore[attr-defined]
        ReportState.GRACE,
        error_message=str(ReportScheduleAlertGracePeriodError()),
    )


def test_not_triggered_error_state_send_failure_logs_error_and_reraises(
    mocker: MockerFixture,
) -> None:
    """When send() fails in NOOP/ERROR state, error should be logged and re-raised."""
    state = _make_state_instance(
        mocker,
        ReportNotTriggeredErrorState,
        schedule_type=ReportScheduleType.REPORT,
    )
    send_error = RuntimeError("send failed")
    mocker.patch.object(state, "send", side_effect=send_error)
    mocker.patch.object(state, "update_report_schedule_and_log")
    mocker.patch.object(state, "is_in_error_grace_period", return_value=True)

    with pytest.raises(RuntimeError, match="send failed"):
        state.next()

    # Should have logged WORKING, then ERROR
    calls = state.update_report_schedule_and_log.call_args_list  # type: ignore[attr-defined]
    assert calls[0].args[0] == ReportState.WORKING
    assert calls[1].args[0] == ReportState.ERROR
    error_msg = calls[1].kwargs.get("error_message") or (
        calls[1].args[1] if len(calls[1].args) > 1 else ""
    )
    assert "send failed" in error_msg


# ---------------------------------------------------------------------------
# Phase 1 remaining gaps
# ---------------------------------------------------------------------------


def test_get_dashboard_urls_no_state_fallback(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """No dashboard state in extra -> standard dashboard URL, not permalink."""
    mock_report_schedule = mocker.Mock(spec=ReportSchedule)
    mock_report_schedule.chart = False
    mock_report_schedule.force_screenshot = False
    mock_report_schedule.extra = {}  # no dashboard state
    mock_report_schedule.dashboard = mocker.Mock()
    mock_report_schedule.dashboard.uuid = "dash-uuid-123"
    mock_report_schedule.dashboard.id = 42
    mock_report_schedule.recipients = []

    state = BaseReportState(mock_report_schedule, "Jan 1", "exec_id")
    state._report_schedule = mock_report_schedule

    result = state.get_dashboard_urls()

    assert len(result) == 1
    assert "superset/dashboard/" in result[0]
    assert "dashboard/p/" not in result[0]  # not a permalink


def test_success_state_alert_command_error_sends_error_and_reraises(
    mocker: MockerFixture,
) -> None:
    """AlertCommand exception -> send_error + ERROR state with marker."""
    state = _make_state_instance(
        mocker, ReportSuccessState, schedule_type=ReportScheduleType.ALERT
    )
    mocker.patch.object(state, "is_in_grace_period", return_value=False)
    mocker.patch.object(state, "update_report_schedule_and_log")
    mocker.patch.object(state, "send_error")
    mocker.patch(
        "superset.commands.report.execute.AlertCommand"
    ).return_value.run.side_effect = RuntimeError("alert boom")

    with pytest.raises(RuntimeError, match="alert boom"):
        state.next()

    state.send_error.assert_called_once()  # type: ignore[attr-defined]
    calls = state.update_report_schedule_and_log.call_args_list  # type: ignore[attr-defined]
    # First call: WORKING, second call: ERROR with marker
    assert calls[0].args[0] == ReportState.WORKING
    assert calls[1].args[0] == ReportState.ERROR
    assert (
        calls[1].kwargs.get("error_message")
        == REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER
    )


def test_success_state_send_error_logs_and_reraises(
    mocker: MockerFixture,
) -> None:
    """send() exception for REPORT type -> ERROR state + re-raise."""
    state = _make_state_instance(
        mocker, ReportSuccessState, schedule_type=ReportScheduleType.REPORT
    )
    mocker.patch.object(state, "send", side_effect=RuntimeError("send boom"))
    mocker.patch.object(state, "update_report_schedule_and_log")

    with pytest.raises(RuntimeError, match="send boom"):
        state.next()

    calls = state.update_report_schedule_and_log.call_args_list  # type: ignore[attr-defined]
    assert calls[-1].args[0] == ReportState.ERROR


@patch("superset.commands.report.execute.feature_flag_manager")
def test_get_notification_content_pdf_format(mock_ff, mocker: MockerFixture) -> None:
    """PDF report format branch produces pdf content."""
    mock_ff.is_feature_enabled.return_value = False
    state = _make_notification_state(mocker, report_format=ReportDataFormat.PDF)
    mocker.patch.object(state, "_get_pdf", return_value=b"%PDF-fake")

    content = state._get_notification_content()
    assert content.pdf == b"%PDF-fake"
    assert content.text is None


# ---------------------------------------------------------------------------
# Phase 1 gap closure: state machine, feature flag, create_log, success path
# ---------------------------------------------------------------------------


def test_state_machine_unknown_state_raises_not_found(
    mocker: MockerFixture,
) -> None:
    """State machine raises StateNotFoundError when last_state matches no class."""
    schedule = mocker.Mock(spec=ReportSchedule)
    # Use a string that isn't in any state class's current_states
    schedule.last_state = "NONEXISTENT_STATE"

    sm = ReportScheduleStateMachine(uuid4(), schedule, datetime.utcnow())
    with pytest.raises(ReportScheduleStateNotFoundError):
        sm.run()


@patch("superset.commands.report.execute.feature_flag_manager")
def test_get_notification_content_alert_no_flag_skips_attachment(
    mock_ff, mocker: MockerFixture
) -> None:
    """Alert with ALERTS_ATTACH_REPORTS=False skips screenshot/pdf/csv attachment."""
    mock_ff.is_feature_enabled.return_value = False
    state = _make_notification_state(
        mocker,
        report_format=ReportDataFormat.PNG,
        schedule_type=ReportScheduleType.ALERT,
        has_chart=True,
    )
    mock_screenshots = mocker.patch.object(state, "_get_screenshots")

    content = state._get_notification_content()

    # _get_screenshots should NOT be called — the attachment block is skipped
    mock_screenshots.assert_not_called()
    assert content.screenshots == []
    assert content.text is None


def test_create_log_success_commits(mocker: MockerFixture) -> None:
    """Successful create_log creates a log entry and commits."""
    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.last_value = "42"
    schedule.last_value_row_json = '{"col": 42}'
    schedule.last_state = ReportState.SUCCESS

    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    state._report_schedule = schedule

    mock_db = mocker.patch("superset.commands.report.execute.db")
    mock_log_cls = mocker.patch(
        "superset.commands.report.execute.ReportExecutionLog",
        return_value=mocker.Mock(),
    )

    state.create_log(error_message=None)

    mock_log_cls.assert_called_once()
    mock_db.session.add.assert_called_once()
    mock_db.session.commit.assert_called_once()
    mock_db.session.rollback.assert_not_called()


def test_success_state_report_sends_and_logs_success(
    mocker: MockerFixture,
) -> None:
    """REPORT type success path: send() + update state to SUCCESS."""
    state = _make_state_instance(
        mocker,
        ReportSuccessState,
        schedule_type=ReportScheduleType.REPORT,
    )
    mock_send = mocker.patch.object(state, "send")
    mocker.patch.object(state, "update_report_schedule_and_log")

    state.next()

    mock_send.assert_called_once()
    state.update_report_schedule_and_log.assert_called_once_with(  # type: ignore[attr-defined]
        ReportState.SUCCESS,
    )
