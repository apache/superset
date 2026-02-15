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
Tests for the get_schema unified schema discovery tool.
"""

from unittest.mock import patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.common.schema_discovery import (
    CHART_DEFAULT_COLUMNS,
    CHART_SEARCH_COLUMNS,
    CHART_SORTABLE_COLUMNS,
    DASHBOARD_DEFAULT_COLUMNS,
    DASHBOARD_SEARCH_COLUMNS,
    DASHBOARD_SORTABLE_COLUMNS,
    DATASET_DEFAULT_COLUMNS,
    DATASET_SEARCH_COLUMNS,
    DATASET_SORTABLE_COLUMNS,
    GetSchemaRequest,
    ModelSchemaInfo,
)
from superset.utils import json


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    from unittest.mock import Mock

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


class TestGetSchemaRequest:
    """Test the GetSchemaRequest schema validation."""

    def test_chart_model_type(self):
        """Test creating request for chart model type."""
        request = GetSchemaRequest(model_type="chart")
        assert request.model_type == "chart"

    def test_dataset_model_type(self):
        """Test creating request for dataset model type."""
        request = GetSchemaRequest(model_type="dataset")
        assert request.model_type == "dataset"

    def test_dashboard_model_type(self):
        """Test creating request for dashboard model type."""
        request = GetSchemaRequest(model_type="dashboard")
        assert request.model_type == "dashboard"

    def test_invalid_model_type(self):
        """Test that invalid model types raise validation error."""
        with pytest.raises(ValueError, match="Input should be"):
            GetSchemaRequest(model_type="invalid")


class TestModelSchemaInfo:
    """Test the ModelSchemaInfo response structure."""

    def test_chart_schema_info(self):
        """Test chart schema info structure."""
        from superset.mcp_service.common.schema_discovery import (
            ColumnMetadata,
        )

        # Use minimal test columns instead of dynamic extraction
        test_columns = [
            ColumnMetadata(
                name="id", description="Chart ID", type="int", is_default=True
            ),
            ColumnMetadata(
                name="slice_name", description="Chart name", type="str", is_default=True
            ),
        ]

        info = ModelSchemaInfo(
            model_type="chart",
            select_columns=test_columns,
            filter_columns={"slice_name": ["eq", "sw"]},
            sortable_columns=CHART_SORTABLE_COLUMNS,
            default_select=CHART_DEFAULT_COLUMNS,
            default_sort="changed_on",
            default_sort_direction="desc",
            search_columns=CHART_SEARCH_COLUMNS,
        )

        assert info.model_type == "chart"
        assert len(info.select_columns) > 0
        # Check default columns include required minimal set
        required_columns = {"id", "slice_name", "viz_type", "uuid"}
        assert required_columns.issubset(set(info.default_select))
        assert "slice_name" in info.filter_columns
        assert info.default_sort == "changed_on"

    def test_dataset_default_columns(self):
        """Test dataset default columns include required minimal set."""
        required_columns = {"id", "table_name", "schema", "uuid"}
        assert required_columns.issubset(set(DATASET_DEFAULT_COLUMNS))
        # These should NOT be in defaults
        assert "columns" not in DATASET_DEFAULT_COLUMNS
        assert "metrics" not in DATASET_DEFAULT_COLUMNS

    def test_dashboard_default_columns(self):
        """Test dashboard default columns include required minimal set."""
        required_columns = {"id", "dashboard_title", "slug", "uuid"}
        assert required_columns.issubset(set(DASHBOARD_DEFAULT_COLUMNS))
        # These should NOT be in defaults
        assert "published" not in DASHBOARD_DEFAULT_COLUMNS
        assert "charts" not in DASHBOARD_DEFAULT_COLUMNS

    def test_chart_default_columns(self):
        """Test chart default columns include required minimal set."""
        required_columns = {"id", "slice_name", "viz_type", "uuid"}
        assert required_columns.issubset(set(CHART_DEFAULT_COLUMNS))
        # These should NOT be in defaults
        assert "description" not in CHART_DEFAULT_COLUMNS
        assert "form_data" not in CHART_DEFAULT_COLUMNS


class TestGetSchemaToolViaClient:
    """Test the get_schema tool via MCP client."""

    @patch("superset.daos.chart.ChartDAO.get_filterable_columns_and_operators")
    @pytest.mark.asyncio
    async def test_get_schema_chart(self, mock_filters, mcp_server):
        """Test get_schema for chart model type."""
        mock_filters.return_value = {
            "slice_name": ["eq", "sw", "ilike"],
            "viz_type": ["eq", "in"],
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_schema", {"request": {"model_type": "chart"}}
            )

            assert result.content is not None
            data = json.loads(result.content[0].text)

            # Check structure
            assert "schema_info" in data
            info = data["schema_info"]
            assert info["model_type"] == "chart"
            assert "select_columns" in info
            assert "filter_columns" in info
            assert "sortable_columns" in info
            assert "default_select" in info
            assert "search_columns" in info

            # Check default columns include required minimal set
            required_columns = {"id", "slice_name", "viz_type", "uuid"}
            assert required_columns.issubset(set(info["default_select"]))

    @patch("superset.daos.dataset.DatasetDAO.get_filterable_columns_and_operators")
    @pytest.mark.asyncio
    async def test_get_schema_dataset(self, mock_filters, mcp_server):
        """Test get_schema for dataset model type."""
        mock_filters.return_value = {
            "table_name": ["eq", "sw"],
            "schema": ["eq"],
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_schema", {"request": {"model_type": "dataset"}}
            )

            assert result.content is not None
            data = json.loads(result.content[0].text)

            info = data["schema_info"]
            assert info["model_type"] == "dataset"

            # Check default columns include required minimal set
            required_columns = {"id", "table_name", "schema", "uuid"}
            assert required_columns.issubset(set(info["default_select"]))

            # Check search columns
            assert "table_name" in info["search_columns"]
            assert "description" in info["search_columns"]

    @patch("superset.daos.dashboard.DashboardDAO.get_filterable_columns_and_operators")
    @pytest.mark.asyncio
    async def test_get_schema_dashboard(self, mock_filters, mcp_server):
        """Test get_schema for dashboard model type."""
        mock_filters.return_value = {
            "dashboard_title": ["eq", "ilike"],
            "published": ["eq"],
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_schema", {"request": {"model_type": "dashboard"}}
            )

            assert result.content is not None
            data = json.loads(result.content[0].text)

            info = data["schema_info"]
            assert info["model_type"] == "dashboard"

            # Check default columns include required minimal set
            required_columns = {"id", "dashboard_title", "slug", "uuid"}
            assert required_columns.issubset(set(info["default_select"]))

            # Check sortable columns include expected values
            assert "dashboard_title" in info["sortable_columns"]
            assert "changed_on" in info["sortable_columns"]

    @patch(
        "superset.mcp_service.utils.schema_utils._is_parse_request_enabled",
        return_value=True,
    )
    @patch("superset.daos.chart.ChartDAO.get_filterable_columns_and_operators")
    @pytest.mark.asyncio
    async def test_get_schema_with_json_string_request(
        self, mock_filters, mock_parse_enabled, mcp_server
    ):
        """Test get_schema accepts JSON string request (Claude Code compatibility)."""
        mock_filters.return_value = {"slice_name": ["eq"]}

        async with Client(mcp_server) as client:
            # Send request as JSON string (Claude Code bug workaround)
            result = await client.call_tool(
                "get_schema", {"request": '{"model_type": "chart"}'}
            )

            assert result.content is not None
            data = json.loads(result.content[0].text)
            assert data["schema_info"]["model_type"] == "chart"

    @patch("superset.daos.chart.ChartDAO.get_filterable_columns_and_operators")
    @pytest.mark.asyncio
    async def test_get_schema_select_columns_have_metadata(
        self, mock_filters, mcp_server
    ):
        """Test that select_columns include metadata (name, type, is_default)."""
        mock_filters.return_value = {}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_schema", {"request": {"model_type": "chart"}}
            )

            data = json.loads(result.content[0].text)
            select_cols = data["schema_info"]["select_columns"]

            # Find the id column - dynamically extracted from model
            id_col = next((c for c in select_cols if c["name"] == "id"), None)
            assert id_col is not None
            assert id_col["type"] == "int"
            assert id_col["is_default"] is True

            # Find a non-default column (description is on the model)
            desc_col = next(
                (c for c in select_cols if c["name"] == "description"), None
            )
            assert desc_col is not None
            assert desc_col["is_default"] is False


class TestGetSchemaEdgeCases:
    """Test edge cases for get_schema tool."""

    @patch("superset.daos.chart.ChartDAO.get_filterable_columns_and_operators")
    @pytest.mark.asyncio
    async def test_get_schema_dao_exception_returns_empty_filters(
        self, mock_filters, mcp_server
    ):
        """Test DAO exception results in empty filter_columns (graceful degradation)."""
        mock_filters.side_effect = Exception("Database error")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_schema", {"request": {"model_type": "chart"}}
            )

            assert result.content is not None
            data = json.loads(result.content[0].text)
            info = data["schema_info"]

            # Should succeed with empty filter_columns
            assert info["model_type"] == "chart"
            assert info["filter_columns"] == {}
            # Other fields should still be populated
            assert len(info["select_columns"]) > 0
            assert len(info["sortable_columns"]) > 0

    @patch("superset.daos.dataset.DatasetDAO.get_filterable_columns_and_operators")
    @pytest.mark.asyncio
    async def test_get_schema_default_sort_values(self, mock_filters, mcp_server):
        """Test that default sort values are returned correctly."""
        mock_filters.return_value = {}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_schema", {"request": {"model_type": "dataset"}}
            )

            data = json.loads(result.content[0].text)
            info = data["schema_info"]

            # Verify default sort configuration
            assert info["default_sort"] == "changed_on"
            assert info["default_sort_direction"] == "desc"


class TestSchemaDiscoveryConstants:
    """Test schema discovery constant definitions."""

    def test_chart_sortable_columns(self):
        """Test chart sortable columns are defined correctly."""
        assert "id" in CHART_SORTABLE_COLUMNS
        assert "slice_name" in CHART_SORTABLE_COLUMNS
        assert "viz_type" in CHART_SORTABLE_COLUMNS
        assert "changed_on" in CHART_SORTABLE_COLUMNS
        assert "created_on" in CHART_SORTABLE_COLUMNS

    def test_dataset_sortable_columns(self):
        """Test dataset sortable columns are defined correctly."""
        assert "id" in DATASET_SORTABLE_COLUMNS
        assert "table_name" in DATASET_SORTABLE_COLUMNS
        assert "schema" in DATASET_SORTABLE_COLUMNS
        assert "changed_on" in DATASET_SORTABLE_COLUMNS
        assert "created_on" in DATASET_SORTABLE_COLUMNS

    def test_dashboard_sortable_columns(self):
        """Test dashboard sortable columns are defined correctly."""
        assert "id" in DASHBOARD_SORTABLE_COLUMNS
        assert "dashboard_title" in DASHBOARD_SORTABLE_COLUMNS
        assert "slug" in DASHBOARD_SORTABLE_COLUMNS
        assert "published" in DASHBOARD_SORTABLE_COLUMNS
        assert "changed_on" in DASHBOARD_SORTABLE_COLUMNS
        assert "created_on" in DASHBOARD_SORTABLE_COLUMNS

    def test_search_columns_defined(self):
        """Test search columns are defined for each model type."""
        assert len(CHART_SEARCH_COLUMNS) >= 1
        assert len(DATASET_SEARCH_COLUMNS) >= 1
        assert len(DASHBOARD_SEARCH_COLUMNS) >= 1

        # Verify key columns are searchable
        assert "slice_name" in CHART_SEARCH_COLUMNS
        assert "table_name" in DATASET_SEARCH_COLUMNS
        assert "dashboard_title" in DASHBOARD_SEARCH_COLUMNS
