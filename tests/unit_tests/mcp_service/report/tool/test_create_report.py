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

from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.report.schemas import CreateReportRequest, RecipientConfig
from superset.utils import json


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests in this module."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _make_mock_schedule(
    id: int = 1,
    name: str = "Weekly Report",
    schedule_type: str = "Report",
    crontab: str = "0 9 * * 1",
    active: bool = True,
) -> MagicMock:
    schedule = MagicMock()
    schedule.id = id
    schedule.name = name
    schedule.type = schedule_type
    schedule.crontab = crontab
    schedule.active = active
    return schedule


# --- Schema tests ---


def test_create_report_request_valid() -> None:
    req = CreateReportRequest(
        name="Weekly Dashboard",
        type="Report",
        crontab="0 9 * * 1",
        dashboard_id=1,
        recipients=[RecipientConfig(type="Email", target="user@example.com")],
    )
    assert req.name == "Weekly Dashboard"
    assert req.type == "Report"
    assert req.active is True
    assert req.dashboard_id == 1


def test_create_report_request_invalid_type() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="Invalid type"):
        CreateReportRequest(
            name="Test",
            type="Unknown",
            crontab="0 9 * * 1",
        )


def test_create_report_request_empty_name_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="name must not be empty"):
        CreateReportRequest(
            name="   ",
            type="Report",
            crontab="0 9 * * 1",
        )


def test_create_report_request_empty_crontab_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="crontab must not be empty"):
        CreateReportRequest(
            name="Test",
            type="Report",
            crontab="   ",
        )


def test_create_report_request_invalid_crontab_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="Invalid cron expression"):
        CreateReportRequest(
            name="Test",
            type="Report",
            crontab="not-a-valid-cron",
        )


def test_recipient_config_invalid_email() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="Invalid email address"):
        RecipientConfig(type="Email", target="not-an-email")


def test_recipient_config_valid_email() -> None:
    r = RecipientConfig(type="Email", target="user@example.com")
    assert r.target == "user@example.com"


def test_recipient_config_invalid_type() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="Invalid recipient type"):
        RecipientConfig(type="Telegram", target="@channel")


def test_recipient_config_empty_target_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="target must not be empty"):
        RecipientConfig(type="Email", target="   ")


# --- Tool logic tests ---


@pytest.mark.asyncio
async def test_create_report_success(mcp_server: object) -> None:
    """Happy path: report created, id and url returned."""
    mock_schedule = _make_mock_schedule(id=42, name="Weekly Report")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_schedule

    with (
        patch(
            "superset.commands.report.create.CreateReportScheduleCommand",
            return_value=mock_command,
        ),
        patch(
            "superset.mcp_service.utils.url_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        async with Client(mcp_server) as client:
            request = CreateReportRequest(
                name="Weekly Report",
                type="Report",
                crontab="0 9 * * 1",
                dashboard_id=1,
                recipients=[RecipientConfig(type="Email", target="user@example.com")],
            )
            result = await client.call_tool(
                "create_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["name"] == "Weekly Report"
    assert data["error"] is None
    assert data["url"] is not None
    assert "report/list" in data["url"]


@pytest.mark.asyncio
async def test_create_report_validation_error(mcp_server: object) -> None:
    """ReportScheduleInvalidError is caught and returned as an error response."""
    from marshmallow.exceptions import ValidationError as MarshmallowValidationError

    from superset.commands.report.exceptions import ReportScheduleInvalidError

    invalid_exc = ReportScheduleInvalidError()
    invalid_exc.append(
        MarshmallowValidationError({"name": ["A report with this name already exists"]})
    )
    mock_command = MagicMock()
    mock_command.run.side_effect = invalid_exc

    with patch(
        "superset.commands.report.create.CreateReportScheduleCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateReportRequest(
                name="Duplicate Report",
                type="Report",
                crontab="0 9 * * 1",
                dashboard_id=1,
                recipients=[RecipientConfig(type="Email", target="user@example.com")],
            )
            result = await client.call_tool(
                "create_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_create_report_create_failed_error(mcp_server: object) -> None:
    """ReportScheduleCreateFailedError is caught and returned as an error response."""
    from superset.commands.report.exceptions import ReportScheduleCreateFailedError

    mock_command = MagicMock()
    mock_command.run.side_effect = ReportScheduleCreateFailedError()

    with patch(
        "superset.commands.report.create.CreateReportScheduleCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateReportRequest(
                name="Test Report",
                type="Report",
                crontab="0 9 * * 1",
                dashboard_id=1,
                recipients=[RecipientConfig(type="Email", target="user@example.com")],
            )
            result = await client.call_tool(
                "create_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "Failed to create report schedule" in data["error"]


@pytest.mark.asyncio
async def test_create_report_alert_reports_flag_disabled(mcp_server: object) -> None:
    """When ALERT_REPORTS is disabled the tool returns an error."""
    with patch("superset.is_feature_enabled", return_value=False):
        async with Client(mcp_server) as client:
            request = CreateReportRequest(
                name="Test Report",
                type="Report",
                crontab="0 9 * * 1",
                dashboard_id=1,
                recipients=[RecipientConfig(type="Email", target="user@example.com")],
            )
            result = await client.call_tool(
                "create_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "ALERT_REPORTS" in data["error"]


@pytest.mark.asyncio
async def test_create_report_alert_type(mcp_server: object) -> None:
    """Alert type schedules are created with database_id and sql."""
    mock_schedule = _make_mock_schedule(
        id=7, name="High Revenue Alert", schedule_type="Alert"
    )
    mock_command = MagicMock()
    mock_command.run.return_value = mock_schedule

    with (
        patch(
            "superset.commands.report.create.CreateReportScheduleCommand",
            return_value=mock_command,
        ) as mock_cmd_cls,
        patch(
            "superset.mcp_service.utils.url_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        async with Client(mcp_server) as client:
            request = CreateReportRequest(
                name="High Revenue Alert",
                type="Alert",
                crontab="0 * * * *",
                chart_id=5,
                database_id=2,
                sql="SELECT SUM(revenue) FROM orders",
                recipients=[RecipientConfig(type="Slack", target="#alerts")],
            )
            result = await client.call_tool(
                "create_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 7
    assert data["error"] is None
    # Verify the command received the correct properties
    call_args = mock_cmd_cls.call_args[0][0]
    assert call_args["chart"] == 5
    assert call_args["database"] == 2
    assert call_args["sql"] == "SELECT SUM(revenue) FROM orders"
