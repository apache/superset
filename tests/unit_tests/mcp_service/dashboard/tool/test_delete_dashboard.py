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

"""Unit tests for the delete_dashboard MCP tool.

Run through the async MCP Client; auth is mocked via the autouse mock_auth
fixture, matching the other dashboard tool test files.
"""

from collections.abc import Iterator
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp

_FIND = (
    "superset.mcp_service.dashboard.tool.delete_dashboard._find_dashboard_by_identifier"
)
_RUN = "superset.commands.dashboard.delete.DeleteDashboardCommand.run"
_FLAG = "superset.mcp_service.dashboard.tool.delete_dashboard.is_feature_enabled"


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


def _mock_dashboard(dashboard_id: int = 1, title: str = "Sales Dashboard") -> Mock:
    """Build a minimal dashboard stand-in with the attributes the tool reads."""
    dashboard = Mock()
    dashboard.id = dashboard_id
    dashboard.dashboard_title = title
    return dashboard


@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_not_found(mock_find: Mock, mcp_server: object) -> None:
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": 999}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "999" in (content["error"] or "")


@patch(_RUN)
@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_success(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_run.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["deleted_id"] == 1
    assert "Sales Dashboard" in content["deleted_name"]
    assert content["permission_denied"] is False
    assert "Its charts were not deleted" in (content["message"] or "")
    mock_run.assert_called_once()


@patch(_FLAG)
@patch(_RUN)
@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_soft_delete_reports_restorable(
    mock_find: Mock, mock_run: Mock, mock_flag: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_run.return_value = None
    mock_flag.side_effect = lambda flag: flag == "SOFT_DELETE"

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["soft_deleted"] is True
    assert "restor" in (content["message"] or "").lower()
    assert "charts were not deleted" in (content["message"] or "")


@patch(_FLAG)
@patch(_RUN)
@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_hard_delete_reports_permanent(
    mock_find: Mock, mock_run: Mock, mock_flag: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_run.return_value = None
    mock_flag.return_value = False

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["soft_deleted"] is False
    assert "permanent" in (content["message"] or "").lower()


@patch(_RUN)
@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_permission_denied(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    from superset.commands.dashboard.exceptions import DashboardForbiddenError

    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_run.side_effect = DashboardForbiddenError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert "Sales Dashboard" in (content["error"] or "")
    assert "permission" in (content["error"] or "").lower()


@patch(_RUN)
@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_blocked_by_reports(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    from superset.commands.dashboard.exceptions import (
        DashboardDeleteFailedReportsExistError,
    )

    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_run.side_effect = DashboardDeleteFailedReportsExistError(
        "There are associated alerts or reports: R1"
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is False
    assert "report" in (content["error"] or "").lower()


@patch(_RUN)
@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_sqlalchemy_error_is_generic(
    mock_find: Mock, mock_run: Mock, mcp_server: object
) -> None:
    """Raw SQLAlchemy text (SQL, connection details) must not reach the client."""
    from sqlalchemy.exc import OperationalError

    mock_find.return_value = _mock_dashboard(1, "Sales Dashboard")
    mock_run.side_effect = OperationalError(
        "DELETE FROM dashboards WHERE id = 1", {}, Exception("secret-host refused")
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": 1}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error"] == "Dashboard delete failed due to a database error."
    assert "secret-host" not in (content["error"] or "")


@pytest.mark.asyncio
async def test_delete_dashboard_rejects_boolean_identifier(
    mcp_server: object,
) -> None:
    """bool subclasses int; identifier=true must not coerce to dashboard ID 1."""
    from fastmcp.exceptions import ToolError

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool(
                "delete_dashboard", {"request": {"identifier": True}}
            )


@patch(_FIND)
@pytest.mark.asyncio
async def test_delete_dashboard_access_denied_on_lookup(
    mock_find: Mock, mcp_server: object
) -> None:
    """Slug/UUID resolution re-checks view access; access-denied surfaces as
    a structured permission_denied response, not an unhandled error."""
    from superset.commands.dashboard.exceptions import DashboardAccessDeniedError

    mock_find.side_effect = DashboardAccessDeniedError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dashboard", {"request": {"identifier": "exec-kpis"}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
