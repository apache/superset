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
Tests for the list_charts request schema
"""

from unittest.mock import Mock, patch

import fastmcp
import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    ChartFilter,
    ChartList,
    ListChartsRequest,
)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture
def mock_chart():
    """Create a mock chart object."""
    chart = Mock()
    chart.id = 1
    chart.slice_name = "test_chart"
    chart.viz_type = "bar"
    chart.datasource_name = "test_dataset"
    chart.datasource_type = "table"
    chart.description = "Test chart"
    chart.url = "/chart/1"
    chart.changed_by_name = "admin"
    chart.changed_on = None
    chart.changed_on_humanized = "1 day ago"
    chart.created_by_name = "admin"
    chart.created_on = None
    chart.created_on_humanized = "2 days ago"
    chart.tags = []
    chart.owners = []
    chart.uuid = "test-uuid-123"
    chart.cache_timeout = None
    chart.form_data = {}
    chart.query_context = {}
    return chart


class TestListChartsRequestSchema:
    """Test the ListChartsRequest schema validation."""

    def test_default_request(self):
        """Test creating request with all defaults."""
        request = ListChartsRequest()

        assert request.filters == []
        assert len(request.select_columns) > 0  # Has default columns
        assert "id" in request.select_columns
        assert "slice_name" in request.select_columns
        assert request.search is None
        assert request.order_column is None
        assert request.order_direction == "asc"
        assert request.page == 1
        assert request.page_size == 10

    def test_request_with_filters(self):
        """Test creating request with filters."""
        filters = [
            ChartFilter(col="slice_name", opr="sw", value="test"),
            ChartFilter(col="viz_type", opr="eq", value="bar"),
        ]

        request = ListChartsRequest(filters=filters)

        assert len(request.filters) == 2
        assert request.filters[0].col == "slice_name"
        assert request.filters[0].opr.value == "sw"
        assert request.filters[0].value == "test"

    def test_request_with_custom_columns(self):
        """Test creating request with custom select columns."""
        columns = ["id", "slice_name", "description"]

        request = ListChartsRequest(select_columns=columns)

        assert request.select_columns == columns

    def test_request_with_search_and_pagination(self):
        """Test creating request with search and pagination."""
        request = ListChartsRequest(
            search="sample",
            order_column="created_on",
            order_direction="desc",
            page=2,
            page_size=50,
        )

        assert request.search == "sample"
        assert request.order_column == "created_on"
        assert request.order_direction == "desc"
        assert request.page == 2
        assert request.page_size == 50

    def test_invalid_order_direction(self):
        """Test that invalid order direction raises validation error."""
        with pytest.raises(ValueError, match="Input should be 'asc' or 'desc'"):
            ListChartsRequest(order_direction="invalid")

    def test_invalid_page_number(self):
        """Test that invalid page numbers raise validation errors."""
        with pytest.raises(ValueError, match="Input should be greater than 0"):
            ListChartsRequest(page=0)

        with pytest.raises(ValueError, match="Input should be greater than 0"):
            ListChartsRequest(page_size=0)

    def test_filter_validation(self):
        """Test that filter validation works correctly."""
        # Valid filter
        valid_filter = ChartFilter(col="slice_name", opr="sw", value="test")
        request = ListChartsRequest(filters=[valid_filter])
        assert len(request.filters) == 1

        # Invalid filter - missing required fields
        with pytest.raises(ValueError, match="Field required"):
            ChartFilter(col="slice_name")  # Missing opr and value

    def test_search_and_filters_conflict_validation(self):
        """Test that using both search and filters raises validation error."""
        with pytest.raises(
            ValueError,
            match="Cannot use both 'search' and 'filters' parameters simultaneously",
        ):
            ListChartsRequest(
                search="sample",
                filters=[ChartFilter(col="slice_name", opr="sw", value="test")],
            )

    def test_model_dump_serialization(self):
        """Test that the request serializes correctly for JSON."""
        request = ListChartsRequest(
            filters=[ChartFilter(col="slice_name", opr="sw", value="test")],
            select_columns=["id", "slice_name"],
            page=1,
            page_size=25,
        )

        data = request.model_dump()

        assert isinstance(data, dict)
        assert "filters" in data
        assert "select_columns" in data
        assert "search" in data
        assert "page" in data
        assert "page_size" in data
        assert data["filters"][0]["col"] == "slice_name"
        assert data["select_columns"] == ["id", "slice_name"]


class TestListChartsToolIntegration:
    """Test the list_charts tool with the new schema."""

    @patch("superset.mcp_service.mcp_core.ModelListCore.run_tool")
    @pytest.mark.asyncio
    async def test_list_charts_basic_request(self, mock_run, mock_chart, mcp_server):
        """Test list_charts tool with basic request."""
        # Mock the tool response
        mock_run.return_value = ChartList(
            charts=[],
            count=0,
            total_count=0,
            page=0,
            page_size=10,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        request = ListChartsRequest()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_charts", {"request": request.model_dump()}
            )

            assert result.data.charts == []
            assert result.data.count == 0
            mock_run.assert_called_once()

    @patch("superset.mcp_service.mcp_core.ModelListCore.run_tool")
    @pytest.mark.asyncio
    async def test_list_charts_with_filters(self, mock_run, mock_chart, mcp_server):
        """Test list_charts tool with filters."""
        # Mock the tool response
        mock_run.return_value = ChartList(
            charts=[],
            count=0,
            total_count=0,
            page=0,
            page_size=50,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        request = ListChartsRequest(
            filters=[ChartFilter(col="slice_name", opr="sw", value="test")],
            select_columns=["id", "slice_name", "viz_type"],
            page=1,
            page_size=50,
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_charts", {"request": request.model_dump()}
            )

            assert result.data.page_size == 50
            mock_run.assert_called_once()

            # Verify the tool was called with correct parameters
            call_args = mock_run.call_args
            assert call_args.kwargs["filters"] == request.filters
            assert call_args.kwargs["select_columns"] == request.select_columns
            assert call_args.kwargs["search"] == request.search
            assert call_args.kwargs["page"] == 0  # Tool adjusts page to 0-based
            assert call_args.kwargs["page_size"] == request.page_size

    @patch("superset.mcp_service.mcp_core.ModelListCore.run_tool")
    @pytest.mark.asyncio
    async def test_list_charts_complex_filters(self, mock_run, mcp_server):
        """Test list_charts with complex filter combinations."""
        mock_run.return_value = ChartList(
            charts=[],
            count=0,
            total_count=0,
            page=0,
            page_size=10,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        request = ListChartsRequest(
            filters=[
                ChartFilter(col="slice_name", opr="sw", value="sample"),
                ChartFilter(col="viz_type", opr="eq", value="bar"),
                ChartFilter(col="datasource_name", opr="in", value=["ds1", "ds2"]),
            ],
            order_column="created_on",
            order_direction="desc",
        )

        async with Client(mcp_server) as client:
            await client.call_tool(  # noqa: F841
                "list_charts", {"request": request.model_dump()}
            )

            mock_run.assert_called_once()
            call_args = mock_run.call_args
            assert len(call_args.kwargs["filters"]) == 3
            assert call_args.kwargs["order_column"] == "created_on"
            assert call_args.kwargs["order_direction"] == "desc"

    @pytest.mark.asyncio
    async def test_list_charts_invalid_request(self, mcp_server):
        """Test that invalid requests are properly rejected."""
        # Test with invalid filter structure
        invalid_request = {
            "filters": [{"col": "slice_name"}],  # Missing required opr and value
            "select_columns": ["id"],
        }

        async with Client(mcp_server) as client:
            with pytest.raises(
                fastmcp.exceptions.ToolError, match="Input validation error"
            ):
                await client.call_tool("list_charts", {"request": invalid_request})

    @patch("superset.mcp_service.mcp_core.ModelListCore.run_tool")
    @pytest.mark.asyncio
    async def test_list_charts_edge_cases(self, mock_run, mcp_server):
        """Test edge cases for pagination and limits."""
        mock_run.return_value = ChartList(
            charts=[],
            count=0,
            total_count=0,
            page=0,
            page_size=1,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        # Test minimum values
        request = ListChartsRequest(page=1, page_size=1)

        async with Client(mcp_server) as client:
            await client.call_tool(  # noqa: F841
                "list_charts", {"request": request.model_dump()}
            )

            mock_run.assert_called_once()
            call_args = mock_run.call_args
            assert call_args.kwargs["page"] == 0  # Adjusted to 0-based
            assert call_args.kwargs["page_size"] == 1

    def test_backwards_compatibility_concerns(self):
        """Test that the new schema maintains expected behavior."""
        # Verify default columns include the most commonly used ones
        request = ListChartsRequest()
        default_columns = request.select_columns

        expected_columns = [
            "id",
            "slice_name",
            "viz_type",
            "datasource_name",
            "changed_by_name",
            "changed_on",
            "created_by_name",
            "created_on",
        ]

        for col in expected_columns:
            assert col in default_columns, f"Expected column {col} not in defaults"

    def test_schema_documentation(self):
        """Test that schema has proper documentation."""
        schema = ListChartsRequest.model_json_schema()

        assert "properties" in schema
        assert "filters" in schema["properties"]
        assert "select_columns" in schema["properties"]

        # Check that descriptions are present
        filters_desc = schema["properties"]["filters"]["description"]
        assert "filter objects" in filters_desc.lower()

        columns_desc = schema["properties"]["select_columns"]["description"]
        assert "columns to select" in columns_desc.lower()
