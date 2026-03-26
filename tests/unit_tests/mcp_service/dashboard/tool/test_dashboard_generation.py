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
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.chart_utils import DatasetValidationResult
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.dashboard.tool.add_chart_to_existing_dashboard import (
    _add_chart_to_layout,
    _ensure_layout_structure,
    _find_next_row_position,
    _find_tab_insert_target,
)
from superset.mcp_service.dashboard.tool.generate_dashboard import (
    _generate_title_from_charts,
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


@pytest.fixture(autouse=True)
def mock_chart_access():
    """Mock chart dataset validation so tests don't hit real security manager."""
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


def _mock_chart(id: int = 1, slice_name: str = "Test Chart") -> Mock:
    """Create a mock chart object."""
    chart = Mock()
    chart.id = id
    chart.slice_name = slice_name
    chart.uuid = f"chart-uuid-{id}"
    chart.tags = []
    chart.owners = []
    chart.viz_type = "table"
    chart.datasource_name = None
    chart.datasource_type = None
    chart.description = None
    chart.cache_timeout = None
    chart.changed_by = None
    chart.changed_by_name = None
    chart.changed_on = None
    chart.changed_on_humanized = None
    chart.created_by = None
    chart.created_by_name = None
    chart.created_on = None
    chart.created_on_humanized = None
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
    dashboard.created_by_name = "test_user"
    dashboard.changed_by_name = "test_user"
    dashboard.uuid = f"dashboard-uuid-{id}"
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    return dashboard


def _setup_generate_dashboard_mocks(
    mock_db_session,
    mock_find_by_id,
    mock_dashboard_cls,
    charts,
    dashboard,
):
    """Set up common mocks for generate_dashboard tests.

    The tool creates dashboards directly via db.session (bypassing
    CreateDashboardCommand) and re-queries user/charts in the tool's
    own session.  The re-fetch uses DashboardDAO.find_by_id() with
    query_options for eager loading of slice relationships.
    """
    mock_user = Mock()
    mock_user.id = 1
    mock_user.username = "admin"
    mock_user.first_name = "Admin"
    mock_user.last_name = "User"
    mock_user.email = "admin@example.com"
    mock_user.active = True

    mock_query = MagicMock()
    mock_filter = MagicMock()
    mock_query.filter.return_value = mock_filter
    mock_query.filter_by.return_value = mock_filter
    mock_filter.order_by.return_value = mock_filter
    mock_filter.all.return_value = charts
    mock_filter.first.return_value = mock_user
    mock_db_session.query.return_value = mock_query

    mock_dashboard_cls.return_value = dashboard
    # DashboardDAO.find_by_id is used for the re-fetch with eager loading
    mock_find_by_id.return_value = dashboard


class TestGenerateDashboard:
    """Tests for generate_dashboard MCP tool."""

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_basic(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """Test basic dashboard generation with valid charts."""
        charts = [
            _mock_chart(id=1, slice_name="Sales Chart"),
            _mock_chart(id=2, slice_name="Revenue Chart"),
        ]
        mock_dashboard = _mock_dashboard(id=10, title="Analytics Dashboard")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, mock_dashboard
        )

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
        mock_filter.order_by.return_value = mock_filter
        mock_filter.all.return_value = [_mock_chart(id=1)]
        mock_db_session.query.return_value = mock_query

        request = {"chart_ids": [1, 2], "dashboard_title": "Test Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is not None
            assert "Charts not found: [2]" in result.structured_content["error"]
            assert result.structured_content["dashboard"] is None
            assert result.structured_content["dashboard_url"] is None

    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_inaccessible_charts(
        self, mock_db_session, mock_chart_access, mcp_server
    ):
        """Test error when user lacks access to some charts."""
        charts = [
            _mock_chart(id=1, slice_name="Accessible"),
            _mock_chart(id=2, slice_name="Restricted"),
            _mock_chart(id=3, slice_name="Also Restricted"),
        ]

        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_filter.order_by.return_value = mock_filter
        mock_filter.all.return_value = charts
        mock_db_session.query.return_value = mock_query

        # Override the autouse fixture: chart 2 has inaccessible dataset
        def mock_validate(chart, check_access=False):
            if chart.id == 2:
                return DatasetValidationResult(
                    is_valid=False,
                    dataset_id=10,
                    dataset_name="restricted_dataset",
                    warnings=[],
                    error=(
                        "Access denied to dataset 'restricted_dataset' "
                        "(ID: 10). You do not have permission to view "
                        "this dataset."
                    ),
                )
            return DatasetValidationResult(
                is_valid=True,
                dataset_id=chart.id,
                dataset_name=f"dataset_{chart.id}",
                warnings=[],
                error=None,
            )

        with patch(
            "superset.mcp_service.auth.check_chart_data_access",
            side_effect=mock_validate,
        ):
            request = {
                "chart_ids": [1, 2, 3],
                "dashboard_title": "Test Dashboard",
            }

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_dashboard", {"request": request}
                )

                assert result.structured_content["error"] is not None
                assert "not accessible" in result.structured_content["error"]
                assert "2" in result.structured_content["error"]
                assert result.structured_content["dashboard"] is None
                assert result.structured_content["dashboard_url"] is None

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_single_chart(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """Test dashboard generation with a single chart."""
        charts = [_mock_chart(id=5, slice_name="Single Chart")]
        mock_dashboard = _mock_dashboard(id=20, title="Single Chart Dashboard")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, mock_dashboard
        )

        request = {
            "chart_ids": [5],
            "dashboard_title": "Single Chart Dashboard",
            "published": False,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is None
            assert result.structured_content["dashboard"]["chart_count"] == 1
            assert result.structured_content["dashboard"]["published"] is False

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_many_charts(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """Test dashboard generation with many charts (grid layout)."""
        chart_ids = list(range(1, 7))
        charts = [_mock_chart(id=i, slice_name=f"Chart {i}") for i in chart_ids]
        mock_dashboard = _mock_dashboard(id=30, title="Multi Chart Dashboard")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, mock_dashboard
        )

        request = {"chart_ids": chart_ids, "dashboard_title": "Multi Chart Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is None
            assert result.structured_content["dashboard"]["chart_count"] == 6

            # Verify db.session.add and commit were called
            # (commit is called multiple times: once by tool + event_logger contexts)
            mock_db_session.add.assert_called_once()
            assert mock_db_session.commit.call_count >= 1

            # Verify layout was set on the dashboard object
            created_dashboard = mock_dashboard_cls.return_value
            position_json = json.loads(created_dashboard.position_json)
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

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_creation_failure(
        self, mock_db_session, mock_dashboard_cls, mcp_server
    ):
        """Test error handling when dashboard creation fails."""
        from sqlalchemy.exc import SQLAlchemyError

        mock_query = Mock()
        mock_filter = Mock()
        mock_query.filter.return_value = mock_filter
        mock_query.filter_by.return_value = mock_filter
        mock_filter.order_by.return_value = mock_filter
        mock_filter.all.return_value = [_mock_chart(id=1)]
        mock_filter.first.return_value = Mock(
            id=1,
            username="admin",
            first_name="Admin",
            last_name="User",
            email="admin@example.com",
            active=True,
        )
        mock_db_session.query.return_value = mock_query
        mock_db_session.commit.side_effect = SQLAlchemyError("Creation failed")

        mock_dashboard_cls.return_value = _mock_dashboard(id=99)

        request = {"chart_ids": [1], "dashboard_title": "Failed Dashboard"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is not None
            assert "Failed to create dashboard" in result.structured_content["error"]
            assert result.structured_content["dashboard"] is None
            # rollback called by tool + event_logger error handling
            assert mock_db_session.rollback.call_count >= 1

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_minimal_request(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """Test dashboard generation with minimal required parameters."""
        charts = [_mock_chart(id=3)]
        mock_dashboard = _mock_dashboard(id=40, title="Minimal Dashboard")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, mock_dashboard
        )

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

            # Verify dashboard was created with default published=True
            created = mock_dashboard_cls.return_value
            assert created.published is True

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_auto_title_from_charts(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """Test that omitting dashboard_title generates a title from chart names."""
        charts = [
            _mock_chart(id=1, slice_name="Sales Revenue"),
            _mock_chart(id=2, slice_name="Customer Count"),
        ]
        mock_dashboard = _mock_dashboard(id=50, title="Sales Revenue & Customer Count")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, mock_dashboard
        )

        # No dashboard_title provided
        request = {"chart_ids": [1, 2]}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is None

            # Verify auto-generated title was set on dashboard
            created = mock_dashboard_cls.return_value
            assert created.dashboard_title == "Sales Revenue & Customer Count"

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_empty_string_title_preserved(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """Test that an explicit empty-string title is NOT replaced by auto-gen."""
        charts = [_mock_chart(id=1, slice_name="Sales Revenue")]
        mock_dashboard = _mock_dashboard(id=60, title="")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, mock_dashboard
        )

        # Explicit empty string title
        request = {"chart_ids": [1], "dashboard_title": ""}

        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

            assert result.structured_content["error"] is None

            # Verify empty string title was preserved (not replaced by auto-gen)
            created = mock_dashboard_cls.return_value
            assert created.dashboard_title == ""


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
        mock_dashboard.slices = [_mock_chart(id=10), _mock_chart(id=20)]
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
        updated_dashboard = _mock_dashboard(id=1, title="Existing Dashboard")
        updated_dashboard.slices = [
            _mock_chart(id=10),
            _mock_chart(id=20),
            _mock_chart(id=30),
        ]
        mock_chart = _mock_chart(id=30, slice_name="New Chart")
        mock_db_session.get.return_value = mock_chart

        mock_update_command.return_value.run.return_value = updated_dashboard

        # First DAO call returns initial dashboard (validation),
        # second DAO call returns updated dashboard (re-fetch with eager loading)
        mock_find_dashboard.side_effect = [mock_dashboard, updated_dashboard]

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
    async def test_add_chart_dataset_not_accessible(
        self, mock_db_session, mock_find_dashboard, mcp_server
    ):
        """Test error when chart's dataset is not accessible."""
        mock_find_dashboard.return_value = _mock_dashboard()
        mock_chart = _mock_chart(id=7)
        mock_db_session.get.return_value = mock_chart

        # Override autouse fixture: chart 7 has inaccessible dataset
        with patch(
            "superset.mcp_service.auth.check_chart_data_access",
            return_value=DatasetValidationResult(
                is_valid=False,
                dataset_id=10,
                dataset_name="restricted_dataset",
                warnings=[],
                error=(
                    "Access denied to dataset 'restricted_dataset' "
                    "(ID: 10). You do not have permission to view "
                    "this dataset."
                ),
            ),
        ):
            request = {"dashboard_id": 1, "chart_id": 7}

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "add_chart_to_existing_dashboard", {"request": request}
                )
                assert result.structured_content["error"] is not None
                assert "not accessible" in result.structured_content["error"]
                assert "7" in result.structured_content["error"]
                assert result.structured_content["dashboard"] is None

    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_already_in_dashboard(
        self, mock_db_session, mock_find_dashboard, mcp_server
    ):
        """Test error when chart is already in dashboard."""
        mock_dashboard = _mock_dashboard()
        mock_dashboard.slices = [_mock_chart(id=5)]
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
        mock_chart = _mock_chart(id=15)
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=2)
        updated_dashboard.slices = [_mock_chart(id=15)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        # First DAO call returns initial dashboard (validation),
        # second returns updated dashboard (re-fetch)
        mock_find_dashboard.side_effect = [mock_dashboard, updated_dashboard]

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
        mock_dashboard.slices = [_mock_chart(id=10)]
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
        mock_chart = _mock_chart(id=25, slice_name="Tab Chart")
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=3, title="Tabbed Dashboard")
        updated_dashboard.slices = [_mock_chart(id=10), _mock_chart(id=25)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        # First DAO call returns initial dashboard (validation),
        # second returns updated dashboard (re-fetch)
        mock_find_dashboard.side_effect = [mock_dashboard, updated_dashboard]

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
    async def test_add_chart_to_specific_tab_by_name(
        self, mock_db_session, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding chart to a specific tab using target_tab name."""
        mock_dashboard = _mock_dashboard(id=3, title="Tabbed Dashboard")
        mock_dashboard.slices = [_mock_chart(id=10)]
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
                    "meta": {"text": "Activity Metrics"},
                    "parents": ["ROOT_ID", "GRID_ID", "TABS-abc123"],
                    "type": "TAB",
                },
                "TAB-tab2": {
                    "children": [],
                    "id": "TAB-tab2",
                    "meta": {"text": "Customers"},
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
        mock_chart = _mock_chart(id=30, slice_name="Customer Chart")
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=3, title="Tabbed Dashboard")
        updated_dashboard.slices = [_mock_chart(id=10), _mock_chart(id=30)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        # First DAO call returns initial dashboard (validation),
        # second returns updated dashboard (re-fetch)
        mock_find_dashboard.side_effect = [mock_dashboard, updated_dashboard]

        request = {"dashboard_id": 3, "chart_id": 30, "target_tab": "Customers"}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

            assert result.structured_content["error"] is None

            call_args = mock_update_command.call_args[0][1]
            layout = json.loads(call_args["position_json"])

            row_key = result.structured_content["position"]["row_key"]
            assert row_key in layout

            # Chart should be in TAB-tab2 (Customers), NOT TAB-tab1
            assert row_key in layout["TAB-tab2"]["children"]
            assert row_key not in layout["TAB-tab1"]["children"]

            # GRID_ID should still only have TABS, not the new row
            assert layout["GRID_ID"]["children"] == ["TABS-abc123"]

            # Verify correct parent chain includes TAB-tab2
            chart_parents = layout["CHART-30"]["parents"]
            assert "TABS-abc123" in chart_parents
            assert "TAB-tab2" in chart_parents
            assert "TAB-tab1" not in chart_parents

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_dashboard_with_nanoid_rows(
        self, mock_db_session, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """Test adding chart to dashboard that has nanoid-style ROW IDs."""
        mock_dashboard = _mock_dashboard(id=4, title="Nanoid Dashboard")
        mock_dashboard.slices = [_mock_chart(id=10)]
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
        mock_chart = _mock_chart(id=50, slice_name="New Nanoid Chart")
        mock_db_session.get.return_value = mock_chart

        updated_dashboard = _mock_dashboard(id=4, title="Nanoid Dashboard")
        updated_dashboard.slices = [_mock_chart(id=10), _mock_chart(id=50)]
        mock_update_command.return_value.run.return_value = updated_dashboard

        # First DAO call returns initial dashboard (validation),
        # second returns updated dashboard (re-fetch)
        mock_find_dashboard.side_effect = [mock_dashboard, updated_dashboard]

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


class TestGenerateTitleFromCharts:
    """Tests for _generate_title_from_charts helper."""

    def test_empty_list_returns_dashboard(self):
        assert _generate_title_from_charts([]) == "Dashboard"

    def test_single_chart(self):
        charts = [_mock_chart(id=1, slice_name="Revenue")]
        assert _generate_title_from_charts(charts) == "Revenue"

    def test_two_charts_joined_with_ampersand(self):
        charts = [
            _mock_chart(id=1, slice_name="Revenue"),
            _mock_chart(id=2, slice_name="Costs"),
        ]
        assert _generate_title_from_charts(charts) == "Revenue & Costs"

    def test_three_charts_joined_with_commas(self):
        charts = [
            _mock_chart(id=1, slice_name="Revenue"),
            _mock_chart(id=2, slice_name="Costs"),
            _mock_chart(id=3, slice_name="Profit"),
        ]
        assert _generate_title_from_charts(charts) == "Revenue, Costs, Profit"

    def test_four_charts_shows_plus_more(self):
        charts = [_mock_chart(id=i, slice_name=f"Chart {i}") for i in range(1, 5)]
        assert (
            _generate_title_from_charts(charts) == "Chart 1, Chart 2, Chart 3 + 1 more"
        )

    def test_many_charts_shows_plus_more(self):
        charts = [_mock_chart(id=i, slice_name=f"Chart {i}") for i in range(1, 8)]
        assert (
            _generate_title_from_charts(charts) == "Chart 1, Chart 2, Chart 3 + 4 more"
        )

    def test_charts_without_names_returns_dashboard(self):
        chart = Mock()
        chart.slice_name = None
        assert _generate_title_from_charts([chart]) == "Dashboard"

    def test_long_title_is_truncated(self):
        charts = [
            _mock_chart(id=1, slice_name="A" * 100),
            _mock_chart(id=2, slice_name="B" * 100),
        ]
        title = _generate_title_from_charts(charts)
        assert len(title) <= 150
        assert title.endswith("\u2026")


class TestDashboardSerializationEagerLoading:
    """Tests for eager loading fix in dashboard serialization paths.

    The re-fetch uses DashboardDAO.find_by_id() with query_options for
    eager loading.  A try/except around the DAO call handles "Can't
    reconnect until invalid transaction is rolled back" errors in
    multi-tenant environments by rolling back and falling back to the
    original dashboard object.
    """

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_refetches_via_dao(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """generate_dashboard re-fetches dashboard via DashboardDAO.find_by_id()
        with eager-loaded slice relationships before serialization."""
        charts = [_mock_chart(id=1, slice_name="Chart 1")]
        dashboard = _mock_dashboard(id=10, title="Refetch Test")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, dashboard
        )

        request = {"chart_ids": [1], "dashboard_title": "Refetch Test"}
        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

        assert result.structured_content["error"] is None
        # Verify DashboardDAO.find_by_id was called for re-fetch
        mock_find_by_id.assert_called()

    @patch("superset.models.dashboard.Dashboard")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_generate_dashboard_refetch_sqlalchemy_error_rollback(
        self, mock_db_session, mock_find_by_id, mock_dashboard_cls, mcp_server
    ):
        """When the DAO re-fetch raises SQLAlchemyError, the session is
        rolled back and a minimal response is returned with only scalar
        attributes (no owners/tags/charts that would trigger lazy-loading)."""
        from sqlalchemy.exc import SQLAlchemyError

        charts = [_mock_chart(id=1, slice_name="Chart 1")]
        dashboard = _mock_dashboard(id=10, title="Rollback Test")
        _setup_generate_dashboard_mocks(
            mock_db_session, mock_find_by_id, mock_dashboard_cls, charts, dashboard
        )
        # Make the DAO re-fetch raise SQLAlchemyError
        mock_find_by_id.side_effect = SQLAlchemyError("session error")

        request = {"chart_ids": [1], "dashboard_title": "Rollback Test"}
        async with Client(mcp_server) as client:
            result = await client.call_tool("generate_dashboard", {"request": request})

        data = result.structured_content
        assert data["error"] is None
        mock_db_session.rollback.assert_called()
        # Minimal response should have scalar fields
        dash = data["dashboard"]
        assert dash["id"] == 10
        assert dash["dashboard_title"] == "Rollback Test"
        assert "/superset/dashboard/10/" in data["dashboard_url"]
        # Relationship fields should be empty (defaults)
        assert dash["owners"] == []
        assert dash["tags"] == []
        assert dash["charts"] == []

    @patch("superset.commands.dashboard.update.UpdateDashboardCommand")
    @patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    @patch("superset.db.session")
    @pytest.mark.asyncio
    async def test_add_chart_refetch_sqlalchemy_error_rollback(
        self, mock_db_session, mock_find_dashboard, mock_update_command, mcp_server
    ):
        """When the DAO re-fetch raises SQLAlchemyError after adding a chart,
        the session is rolled back and a minimal response is returned with
        only scalar attributes and position info."""
        from sqlalchemy.exc import SQLAlchemyError

        mock_dashboard = _mock_dashboard(id=1, title="Dashboard")
        mock_dashboard.slices = []
        mock_dashboard.position_json = "{}"

        mock_chart = _mock_chart(id=15)
        mock_db_session.get.return_value = mock_chart

        updated = _mock_dashboard(id=1, title="Dashboard")
        updated.slices = [_mock_chart(id=15)]
        mock_update_command.return_value.run.return_value = updated

        # First call returns dashboard (validation), second raises (re-fetch)
        mock_find_dashboard.side_effect = [
            mock_dashboard,
            SQLAlchemyError("session error"),
        ]

        request = {"dashboard_id": 1, "chart_id": 15}
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "add_chart_to_existing_dashboard", {"request": request}
            )

        data = result.structured_content
        assert data["error"] is None
        mock_db_session.rollback.assert_called()
        # Minimal response should have scalar fields
        dash = data["dashboard"]
        assert dash["id"] == 1
        assert dash["dashboard_title"] == "Dashboard"
        assert "/superset/dashboard/1/" in data["dashboard_url"]
        # Position info should still be returned
        assert data["position"] is not None
        assert "chart_key" in data["position"]
        # Relationship fields should be empty (defaults)
        assert dash["owners"] == []
        assert dash["tags"] == []
        assert dash["charts"] == []
