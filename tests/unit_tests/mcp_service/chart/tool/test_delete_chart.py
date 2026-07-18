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

"""Unit tests for the delete_chart MCP tool.

Run through the async MCP Client (not direct calls); auth is mocked via the
autouse mock_auth fixture, matching the other chart tool test files.
"""

from collections.abc import Iterator
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp


@pytest.fixture
def mcp_server() -> object:
    """Provide the FastMCP app instance under test."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Authenticate every tool call as a mock admin user."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _mock_chart(chart_id: int = 10, slice_name: str = "Test Chart") -> Mock:
    """Build a minimal chart stand-in with the attributes the tool reads."""
    chart = Mock()
    chart.id = chart_id
    chart.slice_name = slice_name
    return chart


@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_not_found(mock_find: Mock, mcp_server: object) -> None:
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_chart", {"request": {"identifier": 999}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "999" in (content["error"] or "")


@patch("superset.commands.chart.delete.DeleteChartCommand.run")
@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_success(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_run.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool("delete_chart", {"request": {"identifier": 10}})

    content = result.structured_content
    assert content["success"] is True
    assert content["deleted_id"] == 10
    assert "Sales" in content["deleted_name"]
    assert content["permission_denied"] is False
    mock_run.assert_called_once()


@patch("superset.mcp_service.chart.tool.delete_chart.is_feature_enabled")
@patch("superset.commands.chart.delete.DeleteChartCommand.run")
@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_soft_delete_reports_restorable(
    mock_find: Mock, mock_run: Mock, mock_flag: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_run.return_value = None
    mock_flag.side_effect = lambda flag: flag == "SOFT_DELETE"

    async with Client(mcp_server) as client:
        result = await client.call_tool("delete_chart", {"request": {"identifier": 10}})

    content = result.structured_content
    assert content["success"] is True
    assert content["soft_deleted"] is True
    assert "restor" in (content["message"] or "").lower()


@patch("superset.mcp_service.chart.tool.delete_chart.is_feature_enabled")
@patch("superset.commands.chart.delete.DeleteChartCommand.run")
@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_hard_delete_reports_permanent(
    mock_find: Mock, mock_run: Mock, mock_flag: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_run.return_value = None
    mock_flag.return_value = False

    async with Client(mcp_server) as client:
        result = await client.call_tool("delete_chart", {"request": {"identifier": 10}})

    content = result.structured_content
    assert content["success"] is True
    assert content["soft_deleted"] is False
    assert "permanent" in (content["message"] or "").lower()


@patch("superset.commands.chart.delete.DeleteChartCommand.run")
@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_permission_denied(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    from superset.commands.chart.exceptions import ChartForbiddenError

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_run.side_effect = ChartForbiddenError()

    async with Client(mcp_server) as client:
        result = await client.call_tool("delete_chart", {"request": {"identifier": 10}})

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert "permission" in (content["error"] or "").lower()


@patch("superset.commands.chart.delete.DeleteChartCommand.run")
@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_blocked_by_reports(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    from superset.commands.chart.exceptions import (
        ChartDeleteFailedReportsExistError,
    )

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_run.side_effect = ChartDeleteFailedReportsExistError(
        "There are associated alerts or reports: R1"
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool("delete_chart", {"request": {"identifier": 10}})

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is False
    assert "report" in (content["error"] or "").lower()


@patch("superset.commands.chart.delete.DeleteChartCommand.run")
@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_generic_command_error(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    """CommandException messages are user-facing and pass through."""
    from superset.commands.exceptions import CommandException

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_run.side_effect = CommandException("Delete failed for domain reasons")

    async with Client(mcp_server) as client:
        result = await client.call_tool("delete_chart", {"request": {"identifier": 10}})

    content = result.structured_content
    assert content["success"] is False
    assert "Delete failed for domain reasons" in (content["error"] or "")
    assert content["error_type"] == "CommandException"


@patch("superset.commands.chart.delete.DeleteChartCommand.run")
@patch("superset.mcp_service.chart.tool.delete_chart.find_chart_by_identifier")
@pytest.mark.asyncio
async def test_delete_chart_sqlalchemy_error_is_generic(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    """Raw SQLAlchemy text (SQL, connection details) must not reach the client."""
    from sqlalchemy.exc import OperationalError

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_run.side_effect = OperationalError(
        "DELETE FROM slices WHERE id = 10", {}, Exception("secret-host refused")
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool("delete_chart", {"request": {"identifier": 10}})

    content = result.structured_content
    assert content["success"] is False
    assert content["error"] == "Chart delete failed due to a database error."
    assert "secret-host" not in (content["error"] or "")


@pytest.mark.asyncio
async def test_delete_chart_rejects_boolean_identifier(mcp_server: object) -> None:
    """bool subclasses int; identifier=true must not coerce to chart ID 1."""
    from fastmcp.exceptions import ToolError

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool("delete_chart", {"request": {"identifier": True}})
