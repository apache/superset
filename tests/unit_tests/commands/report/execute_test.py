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

from pytest_mock import MockerFixture

from superset.commands.report.execute import BaseReportState
from superset.reports.models import (
    ReportRecipientType,
    ReportSchedule,
    ReportSourceFormat,
)
from superset.utils.core import HeaderDataType


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
    }

    assert result == expected_result
