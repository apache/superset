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

from superset.mcp_service.app import mcp
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.dashboard.tool.add_chart_to_existing_dashboard import (
    _add_chart_to_layout,
    _ensure_layout_structure,
    _find_next_row_position,
    _find_tab_insert_target,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
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
    dashboard.owners = []
    dashboard.tags = []
    return dashboard


class TestGenerateDashboard:
    """Tests for generate_dashboard MCP tool."""

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_basic(
        self, mock_db_session, mock_create_command, mcp_server
    ):
        """Test basic dashboard generation with valid charts."""
        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [
            _mock_chart(id=1, slice_name="Sales Chart"),
            _mock_chart(id=2, slice_name="Revenue Chart"),
        ]
        mock_db_session.query.return_value = mock_query

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

            assert result.structured_content["error"] is None
            assert result.structured_content["dashboard"] is not None
            assert result.structured_content["dashboard"]["id"] == 10
            assert (
                result.structured_content["dashboard"]["dashboard_title"]
                == "Analytics Dashboard"
            )
            assert result.structured_content["dashboard"]["chart_count"] == 2
            assert (
                "/superset/dashboard/10/" in result.structured_content["dashboard_url"]
            )

    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_missing_charts(self, mock_db_session, mcp_server):
        """Test error handling when some charts don't exist."""
        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [_mock_chart(id=1)]
        mock_db_session.query.return_value = mock_query

        request = {"chart_ids": [1, 2], "dashboard_title": "Test Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is not None
            assert "Charts not found: [2]" in result.structured_content["error"]
            assert result.structured_content["dashboard"] is None
            assert result.structured_content["dashboard_url"] is None

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_single_chart(
        self, mock_db_session, mock_create_command, mcp_server
    ):
        """Test dashboard generation with a single chart."""
        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [_mock_chart(id=5, slice_name="Single Chart")]
        mock_db_session.query.return_value = mock_query

        mock_dashboard = _mock_dashboard(id=20, title="Single Chart Dashboard")
        mock_create_command.return_value.run.return_value = mock_dashboard

        request = {
            "chart_ids": [5],
            "dashboard_title": "Single Chart Dashboard",
            "published": False,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is None
            assert result.structured_content["dashboard"]["chart_count"] == 1
            assert result.structured_content["dashboard"]["published"] is True

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_many_charts(
        self, mock_db_session, mock_create_command, mcp_server
    ):
        """Test dashboard generation with many charts (grid layout)."""
        chart_ids = list(range(1, 7))
        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [
            _mock_chart(id=i, slice_name=f"Chart {i}") for i in chart_ids
        ]
        mock_db_session.query.return_value = mock_query

        mock_dashboard = _mock_dashboard(id=30, title="Multi Chart Dashboard")
        mock_create_command.return_value.run.return_value = mock_dashboard

        request = {"chart_ids": chart_ids, "dashboard_title": "Multi Chart Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is None
            assert result.structured_content["dashboard"]["chart_count"] == 6

            mock_create_command.assert_called_once()
            call_args = mock_create_command.call_args[0][0]

            position_json = json.loads(call_args["position_json"])
            assert "ROOT_ID" in position_json
            assert "GRID_ID" in position_json
            assert "DASHBOARD_VERSION_KEY" in position_json
            assert position_json["DASHBOARD_VERSION_KEY"] == "v2"

            assert position_json["ROOT_ID"]["children"] == ["GRID_ID"]

            grid_children = position_json["GRID_ID"]["children"]
            assert len(grid_children) == 3

            for row_id in grid_children:
                assert row_id.startswith("ROW-")

            for chart_id in chart_ids:
                chart_key = f"CHART-{chart_id}"

                assert chart_key in position_json
                chart_data = position_json[chart_key]
                assert chart_data["type"] == "CHART"
                assert "meta" in chart_data
                assert chart_data["meta"]["chartId"] == chart_id
                assert chart_data["meta"]["width"] == 4

                chart_parents = chart_data["parents"]
                column_key = chart_parents[-1]
                assert column_key.startswith("COLUMN-")
                assert column_key in position_json
                column_data = position_json[column_key]
                assert column_data["type"] == "COLUMN"
                assert chart_key in column_data["children"]

                column_parents = column_data["parents"]
                row_key = column_parents[-1]
                assert row_key.startswith("ROW-")
                assert row_key in position_json
                row_data = position_json[row_key]
                assert row_data["type"] == "ROW"
                assert column_key in row_data["children"]

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_creation_failure(
        self, mock_db_session, mock_create_command, mcp_server
    ):
        """Test error handling when dashboard creation fails."""
        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [_mock_chart(id=1)]
        mock_db_session.query.return_value = mock_query
        mock_create_command.return_value.run.side_effect = Exception("Creation failed")

        request = {"chart_ids": [1], "dashboard_title": "Failed Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is not None
            assert "Failed to create dashboard" in result.structured_content["error"]
            assert result.structured_content["dashboard"] is None

    @patch("superset.commands.dashboard.create.CreateDashboardCommand")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_minimal_request(
        self, mock_db_session, mock_create_command, mcp_server
    ):
        """Test dashboard generation with minimal required parameters."""
        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [_mock_chart(id=3)]
        mock_db_session.query.return_value = mock_query

        mock_dashboard = _mock_dashboard(id=40, title="Minimal Dashboard")
        mock_create_command.return_value.run.return_value = mock_dashboard

        request = {
            "chart_ids": [3],
            "dashboard_title": "Minimal Dashboard",
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is None
            assert (
                result.structured_content["dashboard"]["dashboard_title"]
                == "Minimal Dashboard"
            )

            call_args = mock_create_command.call_args[0][0]
            assert call_args["published"] is True
            assert (
                "description" not in call_args or call_args.get("description") is None
            )


class TestAddChartToExistingDashboard:
    """Tests for add_chart_to_existing_dashboard MCP tool."""

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_to_dashboard_basic(
        self, mock_db_session, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding a chart to an existing dashboard."""
        mock_dashboard = _mock_dashboard(id=1, title="Existing Dashboard")
        mock_dashboard.slices = [Mock(id=10), Mock(id=20)]
        mock_dashboard.position_json = json.dumps(
            {
                "ROOT_ID": {
                    "children": ["GRID_ID"],
                    "id": "ROOT_ID",
                    "type": "ROOT",
                },
                "GRID_ID": {
                    "children": ["ROW-abc123"],
                    "id": "GRID_ID",
                    "parents": ["ROOT_ID"],
                    "type": "GRID",
                },
                "ROW-abc123": {
                    "children": ["CHART-10", "CHART-20"],
                    "id": "ROW-abc123",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "parents": ["ROOT_ID", "GRID_ID"],
                    "type": "ROW",
                },
                "CHART-10": {
                    "id": "CHART-10",
                    "type": "CHART",
                    "parents": ["ROOT_ID", "GRID_ID", "ROW-abc123"],
                },
                "CHART-20": {
                    "id": "CHART-20",
                    "type": "CHART",
                    "parents": ["ROOT_ID", "GRID_ID", "ROW-abc123"],
                },
                "DASHBOARD_VERSION_KEY": "v2",
            }
        )
        mock_find_dashboard.return_value = mock_dashboard

        mock_chart = _mock_chart(id=30, slice_name="New Chart")
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=1, title="Existing Dashboard")
        updated_dashboard.slices = [Mock(id=10), Mock(id=20), Mock(id=30)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        request = {"dashboard_id": 1, "chart_id": 30}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.structured_content["error"] is None
            assert result.structured_content["dashboard"] is not None
            assert result.structured_content["dashboard"]["chart_count"] == 3
            assert result.structured_content["position"] is not None
            assert "row" in result.structured_content["position"]
            assert "chart_key" in result.structured_content["position"]
            row_key = result.structured_content["position"]["row_key"]
            assert row_key.startswith("ROW-")
            assert (
                "/superset/dashboard/1/" in result.structured_content["dashboard_url"]
            )

            call_args = mock_update_command.call_args[0][1]
            layout = json.loads(call_args["position_json"])
            assert "CHART-30" in layout
            chart_data = layout["CHART-30"]
            assert chart_data["type"] == "CHART"
            chart_parents = chart_data["parents"]
            column_key = chart_parents[-1]
            assert column_key.startswith("COLUMN-")
            assert column_key in layout
            assert layout[column_key]["type"] == "COLUMN"

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
            assert result.structured_content["error"] is not None
            assert (
                "Dashboard with ID 999 not found" in result.structured_content["error"]
            )

    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_chart_not_found(
        self, mock_db_session, mock_find_dashboard, mcp_server
    ):
        """Test error when chart doesn't exist."""
        mock_find_dashboard.return_value = _mock_dashboard()
        mock_db_session.get.return_value = None
        request = {"dashboard_id": 1, "chart_id": 999}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )
            assert result.structured_content["error"] is not None
            assert "Chart with ID 999 not found" in result.structured_content["error"]

    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_already_in_dashboard(
        self, mock_db_session, mock_find_dashboard, mcp_server
    ):
        """Test error when chart is already in dashboard."""
        mock_dashboard = _mock_dashboard()
        mock_dashboard.slices = [Mock(id=5)]
        mock_find_dashboard.return_value = mock_dashboard
        mock_db_session.get.return_value = _mock_chart(id=5)
        request = {"dashboard_id": 1, "chart_id": 5}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )
            assert result.structured_content["error"] is not None
            assert (
                "Chart 5 is already in dashboard 1"
                in result.structured_content["error"]
            )

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_empty_dashboard(
        self, mock_db_session, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding chart to dashboard with no existing layout."""
        mock_dashboard = _mock_dashboard(id=2)
        mock_dashboard.slices = []
        mock_dashboard.position_json = "{}"
        mock_find_dashboard.return_value = mock_dashboard

        mock_chart = _mock_chart(id=15)
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=2)
        updated_dashboard.slices = [Mock(id=15)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        request = {"dashboard_id": 2, "chart_id": 15}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.structured_content["error"] is None
            assert "row" in result.structured_content["position"]
            row_key = result.structured_content["position"]["row"]
            assert isinstance(row_key, str)
            assert row_key.startswith("ROW-")

            call_args = mock_update_command.call_args[0][1]
            layout = json.loads(call_args["position_json"])
            assert "ROOT_ID" in layout
            assert "GRID_ID" in layout
            assert "CHART-15" in layout

            assert row_key in layout
            row_data = layout[row_key]
            assert row_data["type"] == "ROW"
            assert len(row_data["children"]) == 1

            column_key = row_data["children"][0]
            assert column_key.startswith("COLUMN-")
            assert column_key in layout
            column_data = layout[column_key]
            assert column_data["type"] == "COLUMN"
            assert "CHART-15" in column_data["children"]

            # Verify ROOT_ID is in parents chain even for empty layouts
            chart_parents = layout["CHART-15"]["parents"]
            assert "ROOT_ID" in chart_parents
            assert "GRID_ID" in chart_parents

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_to_tabbed_dashboard(
        self, mock_db_session, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding chart to a dashboard that uses tabs."""
        mock_dashboard = _mock_dashboard(id=3, title="Tabbed Dashboard")
        mock_dashboard.slices = [Mock(id=10)]
        mock_dashboard.position_json = json.dumps(
            {
                "ROOT_ID": {
                    "children": ["GRID_ID"],
                    "id": "ROOT_ID",
                    "type": "ROOT",
                },
                "GRID_ID": {
                    "children": ["TABS-abc123"],
                    "id": "GRID_ID",
                    "parents": ["ROOT_ID"],
                    "type": "GRID",
                },
                "TABS-abc123": {
                    "children": ["TAB-tab1", "TAB-tab2"],
                    "id": "TABS-abc123",
                    "parents": ["ROOT_ID", "GRID_ID"],
                    "type": "TABS",
                },
                "TAB-tab1": {
                    "children": ["ROW-existing"],
                    "id": "TAB-tab1",
                    "meta": {"text": "Tab 1"},
                    "parents": ["ROOT_ID", "GRID_ID", "TABS-abc123"],
                    "type": "TAB",
                },
                "TAB-tab2": {
                    "children": [],
                    "id": "TAB-tab2",
                    "meta": {"text": "Tab 2"},
                    "parents": ["ROOT_ID", "GRID_ID", "TABS-abc123"],
                    "type": "TAB",
                },
                "ROW-existing": {
                    "children": ["CHART-10"],
                    "id": "ROW-existing",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "parents": ["ROOT_ID", "GRID_ID", "TABS-abc123", "TAB-tab1"],
                    "type": "ROW",
                },
                "CHART-10": {
                    "id": "CHART-10",
                    "type": "CHART",
                    "parents": [
                        "ROOT_ID",
                        "GRID_ID",
                        "TABS-abc123",
                        "TAB-tab1",
                        "ROW-existing",
                    ],
                },
                "DASHBOARD_VERSION_KEY": "v2",
            }
        )
        mock_find_dashboard.return_value = mock_dashboard

        mock_chart = _mock_chart(id=25, slice_name="Tab Chart")
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=3, title="Tabbed Dashboard")
        updated_dashboard.slices = [Mock(id=10), Mock(id=25)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        request = {"dashboard_id": 3, "chart_id": 25}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.structured_content["error"] is None

            call_args = mock_update_command.call_args[0][1]
            layout = json.loads(call_args["position_json"])

            row_key = result.structured_content["position"]["row_key"]
            assert row_key in layout
            assert row_key in layout["TAB-tab1"]["children"]
            assert layout["GRID_ID"]["children"] == ["TABS-abc123"]

            row_data = layout[row_key]
            assert row_data["type"] == "ROW"
            column_key = row_data["children"][0]
            assert layout[column_key]["type"] == "COLUMN"
            assert "CHART-25" in layout[column_key]["children"]

            chart_parents = layout["CHART-25"]["parents"]
            assert "TABS-abc123" in chart_parents
            assert "TAB-tab1" in chart_parents

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_dashboard_with_nanoid_rows(
        self, mock_db_session, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding chart to dashboard that has nanoid-style ROW IDs."""
        mock_dashboard = _mock_dashboard(id=4, title="Nanoid Dashboard")
        mock_dashboard.slices = [Mock(id=10)]
        mock_dashboard.position_json = json.dumps(
            {
                "ROOT_ID": {
                    "children": ["GRID_ID"],
                    "id": "ROOT_ID",
                    "type": "ROOT",
                },
                "GRID_ID": {
                    "children": ["ROW-46632bc2"],
                    "id": "GRID_ID",
                    "parents": ["ROOT_ID"],
                    "type": "GRID",
                },
                "ROW-46632bc2": {
                    "children": ["CHART-10"],
                    "id": "ROW-46632bc2",
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                    "parents": ["ROOT_ID", "GRID_ID"],
                    "type": "ROW",
                },
                "CHART-10": {
                    "id": "CHART-10",
                    "type": "CHART",
                    "parents": ["ROOT_ID", "GRID_ID", "ROW-46632bc2"],
                },
                "DASHBOARD_VERSION_KEY": "v2",
            }
        )
        mock_find_dashboard.return_value = mock_dashboard

        mock_chart = _mock_chart(id=50, slice_name="New Nanoid Chart")
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=4, title="Nanoid Dashboard")
        updated_dashboard.slices = [Mock(id=10), Mock(id=50)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        request = {"dashboard_id": 4, "chart_id": 50}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.structured_content["error"] is None

            call_args = mock_update_command.call_args[0][1]
            layout = json.loads(call_args["position_json"])

            row_key = result.structured_content["position"]["row_key"]
            assert row_key != "ROW-46632bc2"
            assert row_key.startswith("ROW-")
            assert row_key in layout


class TestLayoutHelpers:
    """Tests for layout helper functions."""

    def test_generate_id_format(self):
        """Test that _generate_id produces correct format."""
        row_id = generate_id("ROW")
        assert row_id.startswith("ROW-")
        assert len(row_id) == 12

        col_id = generate_id("COLUMN")
        assert col_id.startswith("COLUMN-")
        assert len(col_id) == 15

    def test_generate_id_uniqueness(self):
        """Test that _generate_id produces unique IDs."""
        ids = {generate_id("ROW") for _ in range(100)}
        assert len(ids) == 100

    def test_find_next_row_position_empty_layout(self):
        """Test _find_next_row_position with empty layout."""
        result = _find_next_row_position({})
        assert isinstance(result, str)
        assert result.startswith("ROW-")

    def test_find_tab_insert_target_no_tabs(self):
        """Test _find_tab_insert_target with no tabs."""
        layout = {"GRID_ID": {"children": ["ROW-1"], "type": "GRID"}}
        assert _find_tab_insert_target(layout) is None

    def test_find_tab_insert_target_with_tabs(self):
        """Test _find_tab_insert_target with tabbed dashboard."""
        layout = {
            "GRID_ID": {"children": ["TABS-main"], "type": "GRID"},
            "TABS-main": {"children": ["TAB-first", "TAB-second"], "type": "TABS"},
            "TAB-first": {"children": [], "type": "TAB"},
            "TAB-second": {"children": [], "type": "TAB"},
        }
        assert _find_tab_insert_target(layout) == "TAB-first"

    def test_find_tab_insert_target_no_grid(self):
        """Test _find_tab_insert_target with missing GRID_ID."""
        assert _find_tab_insert_target({"ROOT_ID": {"type": "ROOT"}}) is None

    def test_add_chart_to_layout_creates_column(self):
        """Test that _add_chart_to_layout creates ROW > COLUMN > CHART."""
        layout = {
            "GRID_ID": {"children": [], "parents": ["ROOT_ID"], "type": "GRID"},
        }
        chart = Mock()
        chart.slice_name = "Test Chart"
        chart.uuid = "test-uuid"

        chart_key, column_key, row_key = _add_chart_to_layout(
            layout, chart, 42, "ROW-test123", "GRID_ID"
        )

        assert chart_key == "CHART-42"
        assert column_key.startswith("COLUMN-")
        assert row_key == "ROW-test123"

        assert layout[row_key]["type"] == "ROW"
        assert layout[row_key]["children"] == [column_key]
        assert layout[column_key]["type"] == "COLUMN"
        assert layout[column_key]["children"] == [chart_key]
        assert layout[column_key]["meta"]["width"] == 12
        assert layout[chart_key]["type"] == "CHART"
        assert layout[chart_key]["meta"]["width"] == 4
        assert layout[chart_key]["meta"]["chartId"] == 42

    def test_ensure_layout_structure_creates_missing(self):
        """Test _ensure_layout_structure creates GRID and ROOT if missing."""
        layout: dict = {}
        _ensure_layout_structure(layout, "ROW-test", "GRID_ID")

        assert "ROOT_ID" in layout
        assert "GRID_ID" in layout
        assert "GRID_ID" in layout["ROOT_ID"]["children"]
        assert "ROW-test" in layout["GRID_ID"]["children"]
        assert layout["DASHBOARD_VERSION_KEY"] == "v2"

    def test_ensure_layout_structure_adds_to_tab(self):
        """Test _ensure_layout_structure adds row to tab parent."""
        layout = {
            "ROOT_ID": {"children": ["GRID_ID"], "type": "ROOT"},
            "GRID_ID": {
                "children": ["TABS-main"],
                "parents": ["ROOT_ID"],
                "type": "GRID",
            },
            "TAB-first": {"children": ["ROW-existing"], "type": "TAB"},
        }
        _ensure_layout_structure(layout, "ROW-new", "TAB-first")

        assert "ROW-new" in layout["TAB-first"]["children"]
        assert "ROW-new" not in layout["GRID_ID"]["children"]
