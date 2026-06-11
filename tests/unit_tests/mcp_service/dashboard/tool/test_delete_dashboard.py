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

"""
Unit tests for the delete_dashboard MCP tool.

Covers:
- Successful delete (happy path)
- confirm=false refusal (safety gate)
- Dashboard not found
- Permission denied (user does not own the dashboard)
"""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp


@pytest.fixture
def mcp_server() -> object:
    """Return the FastMCP app instance for use in MCP client tests."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _mock_dashboard(id: int = 1, title: str = "Sales Dashboard") -> Mock:
    """Create a minimal mock Dashboard object."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = f"test-dashboard-{id}"
    return dashboard


@patch("superset.commands.dashboard.delete.DeleteDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_successful_delete(
    mock_find_by_id: Mock, mock_delete_cmd_cls: Mock, mcp_server: object
) -> None:
    """Happy path: dashboard deleted, summary echoed back."""
    mock_find_by_id.return_value = _mock_dashboard(id=1, title="Sales Dashboard")
    mock_delete_cmd = Mock()
    mock_delete_cmd.run.return_value = None
    mock_delete_cmd_cls.return_value = mock_delete_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard",
            {"request": {"dashboard_id": 1, "confirm": True}},
        )

    content = result.structured_content
    assert content["deleted"] is True
    assert content["error"] is None
    assert content["dashboard"]["id"] == 1
    assert "Sales Dashboard" in content["dashboard"]["dashboard_title"]
    assert "test-dashboard-1" in content["dashboard"]["slug"]
    mock_delete_cmd_cls.assert_called_once_with([1])
    mock_delete_cmd.run.assert_called_once()


@patch("superset.commands.dashboard.delete.DeleteDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_not_confirmed_refusal(
    mock_find_by_id: Mock, mock_delete_cmd_cls: Mock, mcp_server: object
) -> None:
    """confirm=false: the tool refuses and nothing is deleted."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard",
            {"request": {"dashboard_id": 1, "confirm": False}},
        )

    content = result.structured_content
    assert content["deleted"] is False
    assert content["dashboard"] is None
    assert "confirm" in (content["error"] or "").lower()
    mock_find_by_id.assert_not_called()
    mock_delete_cmd_cls.assert_not_called()


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_dashboard_not_found(mock_find_by_id: Mock, mcp_server: object) -> None:
    """Returns a clear error when the target dashboard does not exist."""
    mock_find_by_id.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard",
            {"request": {"dashboard_id": 999, "confirm": True}},
        )

    content = result.structured_content
    assert content["deleted"] is False
    assert content["dashboard"] is None
    assert "not found" in (content["error"] or "").lower()


@patch("superset.commands.dashboard.delete.DeleteDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_permission_denied(
    mock_find_by_id: Mock, mock_delete_cmd_cls: Mock, mcp_server: object
) -> None:
    """Returns a structured error when the user cannot delete the dashboard."""
    from superset.commands.dashboard.exceptions import DashboardForbiddenError

    mock_find_by_id.return_value = _mock_dashboard(id=1, title="Sales Dashboard")
    mock_delete_cmd = Mock()
    mock_delete_cmd.run.side_effect = DashboardForbiddenError()
    mock_delete_cmd_cls.return_value = mock_delete_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard",
            {"request": {"dashboard_id": 1, "confirm": True}},
        )

    content = result.structured_content
    assert content["deleted"] is False
    assert "permission" in (content["error"] or "").lower()
    assert content["dashboard"]["id"] == 1
