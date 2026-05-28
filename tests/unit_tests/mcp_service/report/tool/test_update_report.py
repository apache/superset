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
from superset.mcp_service.report.schemas import (
    RecipientConfig,
    UpdateReportRequest,
    UpdateReportResponse,
)
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


def test_update_report_request_valid_id_only() -> None:
    req = UpdateReportRequest(id=5)
    assert req.id == 5
    assert req.name is None
    assert req.type is None
    assert req.crontab is None
    assert req.active is None
    assert req.recipients is None


def test_update_report_request_with_all_fields() -> None:
    req = UpdateReportRequest(
        id=5,
        name="Updated Report",
        type="Report",
        crontab="0 10 * * 2",
        active=False,
        recipients=[RecipientConfig(type="Email", target="new@example.com")],
        dashboard_id=3,
    )
    assert req.id == 5
    assert req.name == "Updated Report"
    assert req.active is False
    assert req.dashboard_id == 3
    assert len(req.recipients) == 1  # type: ignore[arg-type]


def test_update_report_request_invalid_type() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="Invalid type"):
        UpdateReportRequest(id=1, type="Unknown")


def test_update_report_request_empty_name_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="name must not be empty"):
        UpdateReportRequest(id=1, name="   ")


def test_update_report_request_empty_crontab_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="crontab must not be empty"):
        UpdateReportRequest(id=1, crontab="   ")


def test_update_report_response_defaults() -> None:
    resp = UpdateReportResponse()
    assert resp.id is None
    assert resp.error is None


# --- Tool logic tests ---


@pytest.mark.asyncio
async def test_update_report_success(mcp_server: object) -> None:
    """Happy path: schedule updated, id and url returned."""
    mock_schedule = _make_mock_schedule(id=42, name="Updated Report")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_schedule

    with (
        patch(
            "superset.commands.report.update.UpdateReportScheduleCommand",
            return_value=mock_command,
        ),
        patch(
            "superset.mcp_service.utils.url_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        async with Client(mcp_server) as client:
            request = UpdateReportRequest(id=42, name="Updated Report", active=False)
            result = await client.call_tool(
                "update_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["name"] == "Updated Report"
    assert data["error"] is None
    assert data["url"] is not None
    assert "report/list" in data["url"]


@pytest.mark.asyncio
async def test_update_report_not_found(mcp_server: object) -> None:
    """ReportScheduleNotFoundError is caught and returned as error response."""
    from superset.commands.report.exceptions import ReportScheduleNotFoundError

    mock_command = MagicMock()
    mock_command.run.side_effect = ReportScheduleNotFoundError()

    with patch(
        "superset.commands.report.update.UpdateReportScheduleCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateReportRequest(id=999)
            result = await client.call_tool(
                "update_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "999" in data["error"]


@pytest.mark.asyncio
async def test_update_report_validation_error(mcp_server: object) -> None:
    """ReportScheduleInvalidError is caught and returned as error response."""
    from marshmallow.exceptions import ValidationError as MarshmallowValidationError

    from superset.commands.report.exceptions import ReportScheduleInvalidError

    invalid_exc = ReportScheduleInvalidError()
    invalid_exc.append(
        MarshmallowValidationError({"name": ["A report with this name already exists"]})
    )
    mock_command = MagicMock()
    mock_command.run.side_effect = invalid_exc

    with patch(
        "superset.commands.report.update.UpdateReportScheduleCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateReportRequest(id=1, name="Duplicate Name")
            result = await client.call_tool(
                "update_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_update_report_update_failed_error(mcp_server: object) -> None:
    """ReportScheduleUpdateFailedError is caught and returned as error response."""
    from superset.commands.report.exceptions import ReportScheduleUpdateFailedError

    mock_command = MagicMock()
    mock_command.run.side_effect = ReportScheduleUpdateFailedError()

    with patch(
        "superset.commands.report.update.UpdateReportScheduleCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateReportRequest(id=1, crontab="0 9 * * 1")
            result = await client.call_tool(
                "update_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "Failed to update report schedule" in data["error"]


@pytest.mark.asyncio
async def test_update_report_partial_fields_only_sends_provided(
    mcp_server: object,
) -> None:
    """Only the fields that are provided are passed to the command."""
    mock_schedule = _make_mock_schedule(id=10, name="My Report", crontab="0 8 * * 5")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_schedule

    with (
        patch(
            "superset.commands.report.update.UpdateReportScheduleCommand",
            return_value=mock_command,
        ) as mock_cmd_cls,
        patch(
            "superset.mcp_service.utils.url_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        async with Client(mcp_server) as client:
            # Only updating crontab; name/type/etc. all omitted
            request = UpdateReportRequest(id=10, crontab="0 8 * * 5")
            result = await client.call_tool(
                "update_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 10
    # Verify properties dict passed to command only has crontab (no None values)
    call_props = mock_cmd_cls.call_args[0][1]
    assert "crontab" in call_props
    assert "name" not in call_props
    assert "type" not in call_props
    assert "dashboard" not in call_props


@pytest.mark.asyncio
async def test_update_report_recipients_replaced(mcp_server: object) -> None:
    """When recipients are provided, they are included in the properties."""
    mock_schedule = _make_mock_schedule(id=5, name="Alert")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_schedule

    with (
        patch(
            "superset.commands.report.update.UpdateReportScheduleCommand",
            return_value=mock_command,
        ) as mock_cmd_cls,
        patch(
            "superset.mcp_service.utils.url_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        async with Client(mcp_server) as client:
            request = UpdateReportRequest(
                id=5,
                recipients=[RecipientConfig(type="Slack", target="#new-channel")],
            )
            result = await client.call_tool(
                "update_report", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 5
    call_props = mock_cmd_cls.call_args[0][1]
    assert "recipients" in call_props
    assert len(call_props["recipients"]) == 1
