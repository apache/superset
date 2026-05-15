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

from superset.commands.report.create import CreateReportScheduleCommand
from superset.commands.report.exceptions import ReportScheduleUserEmailNotFoundError
from superset.reports.models import (
    ReportCreationMethod,
    ReportRecipientType,
)


def test_populate_recipients_chart_creation_with_user_email() -> None:
    """Test that chart/dashboard creation methods use current user's email."""
    with patch("superset.commands.report.create.g") as mock_g:
        # Setup user with email
        mock_user = MagicMock()
        mock_user.email = "user@example.com"
        mock_g.user = mock_user

        # Create command instance
        command = CreateReportScheduleCommand({})
        command._properties = {
            "creation_method": ReportCreationMethod.CHARTS,
            "recipients": [
                {
                    "type": ReportRecipientType.EMAIL,
                    "recipient_config_json": {"target": "ignored@example.com"},
                }
            ],
        }

        exceptions: list[Exception] = []
        command._populate_recipients(exceptions)

        # Check that recipients were overridden
        assert len(command._properties["recipients"]) == 1
        assert command._properties["recipients"][0]["type"] == ReportRecipientType.EMAIL
        assert (
            command._properties["recipients"][0]["recipient_config_json"]["target"]
            == "user@example.com"
        )
        assert len(exceptions) == 0


def test_populate_recipients_dashboard_creation_with_user_email() -> None:
    """Test that dashboard creation uses current user's email."""
    with patch("superset.commands.report.create.g") as mock_g:
        # Setup user with email
        mock_user = MagicMock()
        mock_user.email = "dashboard_user@example.com"
        mock_g.user = mock_user

        # Create command instance
        command = CreateReportScheduleCommand({})
        command._properties = {
            "creation_method": ReportCreationMethod.DASHBOARDS,
            # No recipients provided initially
        }

        exceptions: list[Exception] = []
        command._populate_recipients(exceptions)

        # Check that recipients were set
        assert len(command._properties["recipients"]) == 1
        assert command._properties["recipients"][0]["type"] == ReportRecipientType.EMAIL
        assert (
            command._properties["recipients"][0]["recipient_config_json"]["target"]
            == "dashboard_user@example.com"
        )
        assert len(exceptions) == 0


def test_populate_recipients_alerts_reports_keeps_original() -> None:
    """Test that alerts_reports creation method preserves provided recipients."""
    command = CreateReportScheduleCommand({})
    original_recipients = [
        {
            "type": ReportRecipientType.EMAIL,
            "recipient_config_json": {"target": "admin@example.com"},
        },
        {
            "type": ReportRecipientType.SLACK,
            "recipient_config_json": {"target": "#alerts"},
        },
    ]
    command._properties = {
        "creation_method": ReportCreationMethod.ALERTS_REPORTS,
        "recipients": original_recipients,
    }

    exceptions: list[Exception] = []
    command._populate_recipients(exceptions)

    # Check that recipients were NOT changed
    assert command._properties["recipients"] == original_recipients
    assert len(exceptions) == 0


def test_populate_recipients_chart_creation_no_user_email() -> None:
    """Test that chart creation fails when user has no email."""
    with patch("superset.commands.report.create.g") as mock_g:
        # Setup user without email
        mock_user = MagicMock()
        mock_user.email = None
        mock_g.user = mock_user

        command = CreateReportScheduleCommand({})
        command._properties = {
            "creation_method": ReportCreationMethod.CHARTS,
        }

        exceptions: list[Exception] = []
        command._populate_recipients(exceptions)

        # Check that validation error was added
        assert len(exceptions) == 1
        assert isinstance(exceptions[0], ReportScheduleUserEmailNotFoundError)
        # Recipients should not be set
        assert (
            "recipients" not in command._properties
            or command._properties["recipients"] == []
        )


def test_populate_recipients_dashboard_creation_no_user() -> None:
    """Test that dashboard creation fails when there's no user."""
    with patch("superset.commands.report.create.g") as mock_g:
        # No user in context
        mock_g.user = None

        command = CreateReportScheduleCommand({})
        command._properties = {
            "creation_method": ReportCreationMethod.DASHBOARDS,
        }

        exceptions: list[Exception] = []
        command._populate_recipients(exceptions)

        # Check that validation error was added
        assert len(exceptions) == 1
        assert isinstance(exceptions[0], ReportScheduleUserEmailNotFoundError)


def test_populate_recipients_no_creation_method() -> None:
    """Test that recipients are unchanged when no creation_method is specified."""
    command = CreateReportScheduleCommand({})
    original_recipients = [
        {
            "type": ReportRecipientType.EMAIL,
            "recipient_config_json": {"target": "user@example.com"},
        }
    ]
    command._properties = {
        # No creation_method specified
        "recipients": original_recipients,
    }

    exceptions: list[Exception] = []
    command._populate_recipients(exceptions)

    # Check that recipients were NOT changed
    assert command._properties["recipients"] == original_recipients
    assert len(exceptions) == 0
