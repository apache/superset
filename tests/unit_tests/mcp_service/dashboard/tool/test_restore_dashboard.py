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
Unit tests for the restore_dashboard MCP tool.

Covers:
- Successful restore (happy path)
- Dashboard not found
- Dashboard exists but is not soft-deleted
- Permission denied (user does not own the dashboard)
- Slug conflict with an active dashboard
- Generic restore failure (e.g. database error during commit)
"""

from collections.abc import Iterator
from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp


@pytest.fixture
def mcp_server() -> object:
    """Return the FastMCP app instance for use in MCP client tests."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _mock_dashboard(
    id: int = 1,
    title: str = "Sales Dashboard",
    deleted: bool = True,
) -> Mock:
    """Create a minimal mock Dashboard object, soft-deleted by default."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = f"test-dashboard-{id}"
    dashboard.uuid = f"dashboard-uuid-{id}"
    dashboard.deleted_at = datetime(2026, 1, 1) if deleted else None
    return dashboard


@patch("superset.commands.dashboard.restore.RestoreDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_successful_restore(
    mock_find_by_id: Mock, mock_restore_cmd_cls: Mock, mcp_server: object
) -> None:
    """Happy path: soft-deleted dashboard restored, summary echoed back."""
    mock_find_by_id.return_value = _mock_dashboard(id=1, title="Sales Dashboard")
    mock_restore_cmd = Mock()
    mock_restore_cmd.run.return_value = None
    mock_restore_cmd_cls.return_value = mock_restore_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard",
            {"request": {"dashboard_id": 1}},
        )

    content = result.structured_content
    assert content["restored"] is True
    assert content["error"] is None
    assert content["dashboard"]["id"] == 1
    assert "Sales Dashboard" in content["dashboard"]["dashboard_title"]
    assert content["dashboard"]["uuid"] == "dashboard-uuid-1"
    mock_find_by_id.assert_called_once_with(
        1, skip_base_filter=True, skip_visibility_filter=True
    )
    mock_restore_cmd_cls.assert_called_once_with("dashboard-uuid-1")
    mock_restore_cmd.run.assert_called_once()


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_dashboard_not_found(mock_find_by_id: Mock, mcp_server: object) -> None:
    """Returns a clear error when the dashboard row does not exist at all."""
    mock_find_by_id.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard",
            {"request": {"dashboard_id": 999}},
        )

    content = result.structured_content
    assert content["restored"] is False
    assert content["dashboard"] is None
    assert "not found" in (content["error"] or "").lower()


@patch("superset.commands.dashboard.restore.RestoreDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_dashboard_not_deleted(
    mock_find_by_id: Mock, mock_restore_cmd_cls: Mock, mcp_server: object
) -> None:
    """Returns an error when the dashboard exists but is not soft-deleted."""
    mock_find_by_id.return_value = _mock_dashboard(id=1, deleted=False)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard",
            {"request": {"dashboard_id": 1}},
        )

    content = result.structured_content
    assert content["restored"] is False
    assert content["dashboard"]["id"] == 1
    assert "not" in (content["error"] or "").lower()
    assert "restore" in (content["error"] or "").lower()
    mock_restore_cmd_cls.assert_not_called()


@patch("superset.commands.dashboard.restore.RestoreDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_permission_denied(
    mock_find_by_id: Mock, mock_restore_cmd_cls: Mock, mcp_server: object
) -> None:
    """Returns a structured error when the user cannot restore the dashboard."""
    from superset.commands.dashboard.exceptions import DashboardForbiddenError

    mock_find_by_id.return_value = _mock_dashboard(id=1)
    mock_restore_cmd = Mock()
    mock_restore_cmd.run.side_effect = DashboardForbiddenError()
    mock_restore_cmd_cls.return_value = mock_restore_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard",
            {"request": {"dashboard_id": 1}},
        )

    content = result.structured_content
    assert content["restored"] is False
    assert "permission" in (content["error"] or "").lower()
    assert content["dashboard"]["id"] == 1


@patch("superset.commands.dashboard.restore.RestoreDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_slug_conflict(
    mock_find_by_id: Mock, mock_restore_cmd_cls: Mock, mcp_server: object
) -> None:
    """Returns an actionable error when an active dashboard claimed the slug."""
    from superset.commands.dashboard.exceptions import DashboardSlugConflictError

    mock_find_by_id.return_value = _mock_dashboard(id=1)
    mock_restore_cmd = Mock()
    mock_restore_cmd.run.side_effect = DashboardSlugConflictError()
    mock_restore_cmd_cls.return_value = mock_restore_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard",
            {"request": {"dashboard_id": 1}},
        )

    content = result.structured_content
    assert content["restored"] is False
    assert "slug" in (content["error"] or "").lower()
    assert content["dashboard"]["id"] == 1


@patch("superset.commands.dashboard.restore.RestoreDashboardCommand")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_restore_failed(
    mock_find_by_id: Mock, mock_restore_cmd_cls: Mock, mcp_server: object
) -> None:
    """Returns a structured error when the restore command fails, e.g. due to
    a database error during commit."""
    from superset.commands.dashboard.exceptions import DashboardRestoreFailedError

    mock_find_by_id.return_value = _mock_dashboard(id=1)
    mock_restore_cmd = Mock()
    mock_restore_cmd.run.side_effect = DashboardRestoreFailedError()
    mock_restore_cmd_cls.return_value = mock_restore_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard",
            {"request": {"dashboard_id": 1}},
        )

    content = result.structured_content
    assert content["restored"] is False
    assert "failed to restore" in (content["error"] or "").lower()
    assert content["dashboard"]["id"] == 1
