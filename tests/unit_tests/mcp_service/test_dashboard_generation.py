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
Unit tests for dashboard generation MCP tools
"""

import logging
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


def _mock_chart(id: int = 1, slice_name: str = "Test Chart") -> Mock:
    """Create a mock chart object."""
    chart = Mock()
    chart.id = id
    chart.slice_name = slice_name
    chart.uuid = f"chart-uuid-{id}"
    return chart


def _mock_dashboard(id: int = 1, title: str = "Test Dashboard") -> Mock:
    """Create a mock dashboard object."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = f"test-dashboard-{id}"
    dashboard.description = "Test dashboard description"
    dashboard.published = True
    dashboard.created_on = "2024-01-01"
    dashboard.changed_on = "2024-01-01"
    dashboard.created_by = Mock()
    dashboard.created_by.username = "test_user"
    dashboard.changed_by = Mock()
    dashboard.changed_by.username = "test_user"
    dashboard.uuid = f"dashboard-uuid-{id}"
    dashboard.slices = []
    dashboard.owners = []  # Add missing owners attribute
    dashboard.tags = []  # Add missing tags attribute
    return dashboard


class TestGenerateDashboard:
    """Tests for generate_dashboard MCP tool."""

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_dashboard_basic(
        self, mock_find_chart, mock_create_command, mcp_server
    ):
        """Test basic dashboard generation with valid charts."""
        # Mock charts exist
        mock_find_chart.side_effect = [
            _mock_chart(id=1, slice_name="Sales Chart"),
            _mock_chart(id=2, slice_name="Revenue Chart"),
        ]

        # Mock dashboard creation
        mock_dashboard = _mock_dashboard(id=10, title="Analytics Dashboard")
        mock_create_command.return_value.run.return_value = mock_dashboard

        request = {
            "chart_ids": [1, 2],
            "dashboard_title": "Analytics Dashboard",
            "description": "Dashboard for analytics",
            "published": True,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.data.error is None
            assert result.data.dashboard is not None
            assert result.data.dashboard.id == 10
            assert result.data.dashboard.dashboard_title == "Analytics Dashboard"
            assert result.data.dashboard.chart_count == 2
            assert "/superset/dashboard/10/" in result.data.dashboard_url

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_dashboard_missing_charts(self, mock_find_chart, mcp_server):
        """Test error handling when some charts don't exist."""
        # First chart exists, second doesn't
        mock_find_chart.side_effect = [
            _mock_chart(id=1),
            None,  # Chart 2 doesn't exist
        ]

        request = {"chart_ids": [1, 2], "dashboard_title": "Test Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.data.error is not None
            assert "Charts not found: [2]" in result.data.error
            assert result.data.dashboard is None
            assert result.data.dashboard_url is None

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_dashboard_single_chart(
        self, mock_find_chart, mock_create_command, mcp_server
    ):
        """Test dashboard generation with a single chart."""
        mock_find_chart.return_value = _mock_chart(id=5, slice_name="Single Chart")

        mock_dashboard = _mock_dashboard(id=20, title="Single Chart Dashboard")
        mock_create_command.return_value.run.return_value = mock_dashboard

        request = {
            "chart_ids": [5],
            "dashboard_title": "Single Chart Dashboard",
            "published": False,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.data.error is None
            assert result.data.dashboard.chart_count == 1
            assert result.data.dashboard.published is True  # From mock

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_dashboard_many_charts(
        self, mock_find_chart, mock_create_command, mcp_server
    ):
        """Test dashboard generation with many charts (grid layout)."""
        # Mock 6 charts
        chart_ids = list(range(1, 7))
        mock_find_chart.side_effect = [
            _mock_chart(id=i, slice_name=f"Chart {i}") for i in chart_ids
        ]

        mock_dashboard = _mock_dashboard(id=30, title="Multi Chart Dashboard")
        mock_create_command.return_value.run.return_value = mock_dashboard

        request = {"chart_ids": chart_ids, "dashboard_title": "Multi Chart Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.data.error is None
            assert result.data.dashboard.chart_count == 6

            # Verify CreateDashboardCommand was called with proper layout
            mock_create_command.assert_called_once()
            call_args = mock_create_command.call_args[0][0]

            # Check position_json contains proper layout
            position_json = json.loads(call_args["position_json"])
            assert "ROOT_ID" in position_json
            assert len(position_json["ROOT_ID"]["children"]) == 6

            # Check each chart has position embedded in meta
            for i in chart_ids:
                chart_key = f"CHART-{i}"
                assert chart_key in position_json
                chart_data = position_json[chart_key]
                assert "meta" in chart_data
                assert "h" in chart_data["meta"]  # Height
                assert "w" in chart_data["meta"]  # Width
                assert "x" in chart_data["meta"]  # X position
                assert "y" in chart_data["meta"]  # Y position

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_dashboard_creation_failure(
        self, mock_find_chart, mock_create_command, mcp_server
    ):
        """Test error handling when dashboard creation fails."""
        mock_find_chart.return_value = _mock_chart(id=1)
        mock_create_command.return_value.run.side_effect = Exception("Creation failed")

        request = {"chart_ids": [1], "dashboard_title": "Failed Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.data.error is not None
            assert "Failed to create dashboard" in result.data.error
            assert result.data.dashboard is None

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_dashboard_minimal_request(
        self, mock_find_chart, mock_create_command, mcp_server
    ):
        """Test dashboard generation with minimal required parameters."""
        mock_find_chart.return_value = _mock_chart(id=3)

        mock_dashboard = _mock_dashboard(id=40, title="Minimal Dashboard")
        mock_create_command.return_value.run.return_value = mock_dashboard

        request = {
            "chart_ids": [3],
            "dashboard_title": "Minimal Dashboard",
            # No description, published defaults to True
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.data.error is None
            assert result.data.dashboard.dashboard_title == "Minimal Dashboard"

            # Check that description was not included in call
            call_args = mock_create_command.call_args[0][0]
            assert call_args["published"] is True  # Default value
            assert (
                "description" not in call_args or call_args.get("description") is None
            )


class TestAddChartToExistingDashboard:
    """Tests for add_chart_to_existing_dashboard MCP tool."""

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_add_chart_to_dashboard_basic(
        self, mock_find_chart, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding a chart to an existing dashboard."""
        # Mock existing dashboard with some charts
        mock_dashboard = _mock_dashboard(id=1, title="Existing Dashboard")
        mock_dashboard.slices = [Mock(id=10), Mock(id=20)]  # Existing charts
        mock_dashboard.position_json = json.dumps(
            {
                "ROOT_ID": {
                    "children": ["CHART-10", "CHART-20"],
                    "id": "ROOT_ID",
                    "type": "ROOT",
                },
                "CHART-10": {"id": "CHART-10", "type": "CHART", "parents": ["ROOT_ID"]},
                "CHART-10_POSITION": {"h": 16, "w": 24, "x": 0, "y": 0},
                "CHART-20": {"id": "CHART-20", "type": "CHART", "parents": ["ROOT_ID"]},
                "CHART-20_POSITION": {"h": 16, "w": 24, "x": 24, "y": 0},
            }
        )
        mock_find_dashboard.return_value = mock_dashboard

        # Mock chart to add
        mock_chart = _mock_chart(id=30, slice_name="New Chart")
        mock_find_chart.return_value = mock_chart

        # Mock updated dashboard
        updated_dashboard = _mock_dashboard(id=1, title="Existing Dashboard")
        updated_dashboard.slices = [Mock(id=10), Mock(id=20), Mock(id=30)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        request = {"dashboard_id": 1, "chart_id": 30}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.data.error is None
            assert result.data.dashboard is not None
            assert result.data.dashboard.chart_count == 3
            assert result.data.position is not None
            assert result.data.position.get("x") == 0  # Should be positioned at (0, 16)
            assert result.data.position.get("y") == 16
            assert "/superset/dashboard/1/" in result.data.dashboard_url

    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_add_chart_dashboard_not_found(self, mock_find_dashboard, mcp_server):
        """Test error when dashboard doesn't exist."""
        mock_find_dashboard.return_value = None

        request = {"dashboard_id": 999, "chart_id": 1}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.data.error is not None
            assert "Dashboard with ID 999 not found" in result.data.error

    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_add_chart_chart_not_found(
        self, mock_find_chart, mock_find_dashboard, mcp_server
    ):
        """Test error when chart doesn't exist."""
        mock_find_dashboard.return_value = _mock_dashboard()
        mock_find_chart.return_value = None

        request = {"dashboard_id": 1, "chart_id": 999}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.data.error is not None
            assert "Chart with ID 999 not found" in result.data.error

    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_add_chart_already_in_dashboard(
        self, mock_find_chart, mock_find_dashboard, mcp_server
    ):
        """Test error when chart is already in dashboard."""
        mock_dashboard = _mock_dashboard()
        mock_dashboard.slices = [Mock(id=5)]  # Chart 5 already exists
        mock_find_dashboard.return_value = mock_dashboard

        mock_find_chart.return_value = _mock_chart(id=5)

        request = {"dashboard_id": 1, "chart_id": 5}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.data.error is not None
            assert "Chart 5 is already in dashboard 1" in result.data.error

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_add_chart_empty_dashboard(
        self, mock_find_chart, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding chart to dashboard with no existing layout."""
        mock_dashboard = _mock_dashboard(id=2)
        mock_dashboard.slices = []
        mock_dashboard.position_json = "{}"  # Empty layout
        mock_find_dashboard.return_value = mock_dashboard

        mock_chart = _mock_chart(id=15)
        mock_find_chart.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=2)
        updated_dashboard.slices = [Mock(id=15)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        request = {"dashboard_id": 2, "chart_id": 15}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.data.error is None
            assert result.data.position.get("x") == 0  # Should start at (0, 0)
            assert result.data.position.get("y") == 0

            # Verify update was called with ROOT_ID created
            call_args = mock_update_command.call_args[0][1]
            layout = json.loads(call_args["position_json"])
            assert "ROOT_ID" in layout
            assert layout["ROOT_ID"]["children"] == ["CHART-15"]
