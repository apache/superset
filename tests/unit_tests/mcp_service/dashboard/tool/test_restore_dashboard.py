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

"""Unit tests for the restore_dashboard MCP tool.

Run through the async MCP Client (not direct calls); auth is mocked via the
autouse mock_auth fixture, matching the other dashboard tool test files.
"""

from collections.abc import Iterator
from datetime import datetime
from unittest.mock import Mock, patch
from uuid import UUID

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp

_FIND = "superset.daos.dashboard.DashboardDAO.find_by_id_or_uuid"
_COMMAND = "superset.commands.dashboard.restore.RestoreDashboardCommand"

_UUID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _mock_dashboard(
    dashboard_id: int = 1,
    title: str = "Sales Dashboard",
    deleted: bool = True,
) -> Mock:
    dashboard = Mock()
    dashboard.id = dashboard_id
    dashboard.dashboard_title = title
    dashboard.uuid = _UUID
    dashboard.deleted_at = datetime(2026, 7, 1) if deleted else None
    return dashboard


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_not_found(mock_find: Mock, mcp_server: object) -> None:
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": 999}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "999" in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_not_in_trash(
    mock_find: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dashboard(deleted=False)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotDeleted"
    assert "not in trash" in (content["error"] or "").lower()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_success_by_numeric_id(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["restored_id"] == 1
    assert "Sales Dashboard" in content["restored_name"]
    assert content["permission_denied"] is False
    mock_command.assert_called_once_with(str(_UUID))
    mock_command.return_value.run.assert_called_once()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_success_by_uuid(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": str(_UUID)}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["restored_id"] == 1
    mock_find.assert_called_once_with(
        str(_UUID), skip_base_filter=True, skip_visibility_filter=True
    )
    mock_command.assert_called_once_with(str(_UUID))


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_permission_denied(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    from superset.commands.dashboard.exceptions import DashboardForbiddenError

    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_command.return_value.run.side_effect = DashboardForbiddenError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert "permission" in (content["error"] or "").lower()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_restore_failed(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    from superset.commands.dashboard.exceptions import DashboardRestoreFailedError

    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_command.return_value.run.side_effect = DashboardRestoreFailedError("boom")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is False
    assert content["error_type"] == "DashboardRestoreFailedError"


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_sqlalchemy_error_is_generic(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    """Raw SQLAlchemy text (SQL, connection details) must not reach the client."""
    from sqlalchemy.exc import OperationalError

    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_command.return_value.run.side_effect = OperationalError(
        "UPDATE dashboards SET deleted_at = NULL", {}, Exception("secret-host")
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error"] == "Dashboard restore failed due to a database error."
    assert "secret-host" not in (content["error"] or "")


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dashboard_slug_conflict(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    """The dashboard-specific slug-conflict rule surfaces its user-facing
    message and error type so the agent can explain the rename requirement."""
    from superset.commands.dashboard.exceptions import DashboardSlugConflictError

    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_command.return_value.run.side_effect = DashboardSlugConflictError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "DashboardSlugConflictError"
    assert "slug" in (content["error"] or "").lower()


@pytest.mark.asyncio
async def test_restore_dashboard_rejects_boolean_identifier(
    mcp_server: object,
) -> None:
    """bool subclasses int; identifier=true must not coerce to dashboard ID 1."""
    from fastmcp.exceptions import ToolError

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool(
                "restore_dashboard", {"request": {"identifier": True}}
            )
