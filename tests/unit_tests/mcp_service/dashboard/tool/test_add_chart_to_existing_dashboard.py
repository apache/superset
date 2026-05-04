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
Unit tests for add_chart_to_existing_dashboard MCP tool.

Follows the same pattern used in test_dashboard_generation.py:
- Tests run through the async MCP Client (not direct function calls)
- Patches applied at source locations (superset.daos.dashboard.*, superset.db.*, etc.)
- auth is mocked via the autouse mock_auth fixture (same as other tool test files)

Covers:
- Dashboard not found
- Permission denied (user does not own the dashboard) -> permission_denied=True
- Chart not found
- Chart already in dashboard
- Successful add (happy path)
"""

import logging
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.chart_utils import DatasetValidationResult

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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


@pytest.fixture(autouse=True)
def mock_chart_access():
    """Allow chart data access by default so tests focus on dashboard logic."""
    with patch(
        "superset.mcp_service.auth.check_chart_data_access",
        return_value=DatasetValidationResult(
            is_valid=True,
            dataset_id=1,
            dataset_name="test_dataset",
            warnings=[],
            error=None,
        ),
    ):
        yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_chart(id: int = 10, slice_name: str = "Test Chart") -> Mock:
    """Create a minimal mock Slice object with the given ID and name."""
    chart = Mock()
    chart.id = id
    chart.slice_name = slice_name
    chart.uuid = f"chart-uuid-{id}"
    chart.tags = []
    chart.owners = []
    chart.viz_type = "table"
    chart.datasource_name = None
    chart.description = None
    return chart


def _mock_dashboard(
    id: int = 1,
    title: str = "Sales Dashboard",
    slices: list[Mock] | None = None,
) -> Mock:
    """Create a minimal mock Dashboard object with the given ID, title and slices."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = f"test-dashboard-{id}"
    dashboard.description = None
    dashboard.published = True
    dashboard.created_on = None
    dashboard.changed_on = None
    dashboard.created_by_name = "test_user"
    dashboard.changed_by_name = "test_user"
    dashboard.uuid = f"dashboard-uuid-{id}"
    dashboard.slices = slices or []
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []
    dashboard.position_json = "{}"
    dashboard.json_metadata = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    return dashboard


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_dashboard_not_found(mock_find_by_id: Mock, mcp_server: object) -> None:
    """Returns a clear error when the target dashboard does not exist."""
    mock_find_by_id.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "add_chart_to_existing_dashboard",
            {"request": {"dashboard_id": 999, "chart_id": 10}},
        )

    assert result.structured_content["dashboard"] is None
    assert result.structured_content["dashboard_url"] is None
    assert result.structured_content["permission_denied"] is False
    assert "not found" in (result.structured_content["error"] or "").lower()


@patch("superset.security_manager.raise_for_ownership")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_permission_denied(
    mock_find_by_id: Mock, mock_raise_for_ownership: Mock, mcp_server: object
) -> None:
    """Returns permission_denied=True and an actionable error when the user
    cannot edit the dashboard.

    This is the core regression test for the bug fix: before the fix the tool
    returned a generic error that caused the LLM to silently call
    generate_dashboard instead.  After the fix it returns permission_denied=True
    with a message that explicitly tells the LLM to ask the user first.
    """
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    dashboard = _mock_dashboard(id=1, title="Sales Dashboard")
    mock_find_by_id.return_value = dashboard
    mock_raise_for_ownership.side_effect = SupersetSecurityException(
        SupersetError(
            message="Changing this Dashboard is forbidden",
            error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
            level=ErrorLevel.ERROR,
        )
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "add_chart_to_existing_dashboard",
            {"request": {"dashboard_id": 1, "chart_id": 10}},
        )

    content = result.structured_content
    assert content["dashboard"] is None
    assert content["permission_denied"] is True, (
        "Expected permission_denied=True so the LLM knows to ask the user "
        "before creating a new dashboard — this is the fix for the bug"
    )
    assert content["error"] is not None
    assert "Sales Dashboard" in content["error"]
    assert "permission" in content["error"].lower()
    assert "new dashboard" in content["error"].lower()


@patch("superset.db.session.get")
@patch("superset.security_manager.raise_for_ownership")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_chart_not_found(
    mock_find_by_id: Mock,
    mock_raise_for_ownership: Mock,
    mock_session_get: Mock,
    mcp_server: object,
) -> None:
    """Returns an error when the requested chart does not exist."""
    dashboard = _mock_dashboard()
    mock_find_by_id.return_value = dashboard
    mock_raise_for_ownership.return_value = None
    mock_session_get.return_value = None  # chart not found

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "add_chart_to_existing_dashboard",
            {"request": {"dashboard_id": 1, "chart_id": 99}},
        )

    content = result.structured_content
    assert content["dashboard"] is None
    assert content["permission_denied"] is False
    assert "99" in (content["error"] or "")


@patch("superset.db.session.get")
@patch("superset.security_manager.raise_for_ownership")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_chart_already_in_dashboard(
    mock_find_by_id: Mock,
    mock_raise_for_ownership: Mock,
    mock_session_get: Mock,
    mcp_server: object,
) -> None:
    """Returns an error when the chart is already present on the dashboard."""
    chart = _mock_chart(id=10)
    dashboard = _mock_dashboard(slices=[chart])
    mock_find_by_id.return_value = dashboard
    mock_raise_for_ownership.return_value = None
    mock_session_get.return_value = chart

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "add_chart_to_existing_dashboard",
            {"request": {"dashboard_id": 1, "chart_id": 10}},
        )

    content = result.structured_content
    assert content["dashboard"] is None
    assert content["permission_denied"] is False
    assert "already" in (content["error"] or "").lower()


@patch("superset.commands.dashboard.update.UpdateDashboardCommand")
@patch("superset.db.session.get")
@patch("superset.security_manager.raise_for_ownership")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_successful_add(
    mock_find_by_id: Mock,
    mock_raise_for_ownership: Mock,
    mock_session_get: Mock,
    mock_update_cmd_cls: Mock,
    mcp_server: object,
) -> None:
    """Happy path: chart added, permission_denied=False, URL and position returned."""
    chart = _mock_chart(id=10)
    dashboard = _mock_dashboard(id=1)
    updated_dashboard = _mock_dashboard(id=1, slices=[chart])

    mock_find_by_id.side_effect = [dashboard, updated_dashboard]
    mock_raise_for_ownership.return_value = None
    mock_session_get.return_value = chart

    mock_update_cmd = Mock()
    mock_update_cmd.run.return_value = updated_dashboard
    mock_update_cmd_cls.return_value = mock_update_cmd

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "add_chart_to_existing_dashboard",
            {"request": {"dashboard_id": 1, "chart_id": 10}},
        )

    content = result.structured_content
    assert content["error"] is None
    assert content["permission_denied"] is False
    assert content["dashboard_url"] is not None
    assert "/superset/dashboard/1/" in content["dashboard_url"]
    assert content["position"] is not None
    assert "chart_key" in content["position"]
