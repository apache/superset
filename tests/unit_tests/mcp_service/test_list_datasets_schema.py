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
Tests for the new list_datasets request schema
"""

from unittest.mock import Mock, patch

import fastmcp
import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.dataset_schemas import (
    DatasetFilter,
    DatasetList,
    ListDatasetsRequest,
)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture
def mock_dataset():
    """Create a mock dataset object."""
    dataset = Mock()
    dataset.id = 1
    dataset.table_name = "test_table"
    dataset.schema = "public"
    dataset.database = Mock()
    dataset.database.database_name = "test_db"
    dataset.description = "Test dataset"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.tags = []
    dataset.owners = []
    dataset.columns = []
    dataset.metrics = []
    return dataset


class TestListDatasetsRequestSchema:
    """Test the ListDatasetsRequest schema validation."""

    def test_default_request(self):
        """Test creating request with all defaults."""
        request = ListDatasetsRequest()

        assert request.filters == []
        assert len(request.select_columns) > 0  # Has default columns
        assert "id" in request.select_columns
        assert "table_name" in request.select_columns
        assert request.search is None
        assert request.order_column is None
        assert request.order_direction == "asc"
        assert request.page == 1
        assert request.page_size == 100

    def test_request_with_filters(self):
        """Test creating request with filters."""
        filters = [
            DatasetFilter(col="table_name", opr="sw", value="test"),
            DatasetFilter(col="schema", opr="eq", value="public"),
        ]

        request = ListDatasetsRequest(filters=filters)

        assert len(request.filters) == 2
        assert request.filters[0].col == "table_name"
        assert request.filters[0].opr.value == "sw"
        assert request.filters[0].value == "test"

    def test_request_with_custom_columns(self):
        """Test creating request with custom select columns."""
        columns = ["id", "table_name", "description"]

        request = ListDatasetsRequest(select_columns=columns)

        assert request.select_columns == columns

    def test_request_with_search_and_pagination(self):
        """Test creating request with search and pagination."""
        request = ListDatasetsRequest(
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
            ListDatasetsRequest(order_direction="invalid")

    def test_invalid_page_number(self):
        """Test that invalid page numbers raise validation errors."""
        with pytest.raises(ValueError, match="Input should be greater than 0"):
            ListDatasetsRequest(page=0)

        with pytest.raises(ValueError, match="Input should be greater than 0"):
            ListDatasetsRequest(page_size=0)

    def test_filter_validation(self):
        """Test that filter validation works correctly."""
        # Valid filter
        valid_filter = DatasetFilter(col="table_name", opr="sw", value="test")
        request = ListDatasetsRequest(filters=[valid_filter])
        assert len(request.filters) == 1

        # Invalid filter - missing required fields
        with pytest.raises(ValueError, match="Field required"):
            DatasetFilter(col="table_name")  # Missing opr and value

    def test_search_and_filters_conflict_validation(self):
        """Test that using both search and filters raises validation error."""
        with pytest.raises(
            ValueError,
            match="Cannot use both 'search' and 'filters' parameters simultaneously",
        ):
            ListDatasetsRequest(
                search="sample",
                filters=[DatasetFilter(col="table_name", opr="sw", value="test")],
            )

    def test_model_dump_serialization(self):
        """Test that the request serializes correctly for JSON."""
        request = ListDatasetsRequest(
            filters=[DatasetFilter(col="table_name", opr="sw", value="test")],
            select_columns=["id", "table_name"],
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
        assert data["filters"][0]["col"] == "table_name"
        assert data["select_columns"] == ["id", "table_name"]


class TestListDatasetsToolIntegration:
    """Test the list_datasets tool with the new schema."""

    @patch("superset.mcp_service.model_tools.ModelListTool.run")
    @pytest.mark.asyncio
    async def test_list_datasets_basic_request(
        self, mock_run, mock_dataset, mcp_server
    ):
        """Test list_datasets tool with basic request."""
        # Mock the tool response
        mock_run.return_value = DatasetList(
            datasets=[],
            count=0,
            total_count=0,
            page=0,
            page_size=100,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        request = ListDatasetsRequest()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_datasets", {"request": request.model_dump()}
            )

            assert result.data.datasets == []
            assert result.data.count == 0
            mock_run.assert_called_once()

    @patch("superset.mcp_service.model_tools.ModelListTool.run")
    @pytest.mark.asyncio
    async def test_list_datasets_with_filters(self, mock_run, mock_dataset, mcp_server):
        """Test list_datasets tool with filters."""
        # Mock the tool response
        mock_run.return_value = DatasetList(
            datasets=[],
            count=0,
            total_count=0,
            page=0,
            page_size=50,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        request = ListDatasetsRequest(
            filters=[DatasetFilter(col="table_name", opr="sw", value="test")],
            select_columns=["id", "table_name", "schema"],
            page=1,
            page_size=50,
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "list_datasets", {"request": request.model_dump()}
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

    @patch("superset.mcp_service.model_tools.ModelListTool.run")
    @pytest.mark.asyncio
    async def test_list_datasets_complex_filters(self, mock_run, mcp_server):
        """Test list_datasets with complex filter combinations."""
        mock_run.return_value = DatasetList(
            datasets=[],
            count=0,
            total_count=0,
            page=0,
            page_size=100,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        request = ListDatasetsRequest(
            filters=[
                DatasetFilter(col="table_name", opr="sw", value="sample"),
                DatasetFilter(col="schema", opr="eq", value="public"),
                DatasetFilter(col="owner", opr="in", value=[1, 2, 3]),
            ],
            order_column="created_on",
            order_direction="desc",
        )

        async with Client(mcp_server) as client:
            await client.call_tool(  # noqa: F841
                "list_datasets", {"request": request.model_dump()}
            )

            mock_run.assert_called_once()
            call_args = mock_run.call_args
            assert len(call_args.kwargs["filters"]) == 3
            assert call_args.kwargs["order_column"] == "created_on"
            assert call_args.kwargs["order_direction"] == "desc"

    @pytest.mark.asyncio
    async def test_list_datasets_invalid_request(self, mcp_server):
        """Test that invalid requests are properly rejected."""
        # Test with invalid filter structure
        invalid_request = {
            "filters": [{"col": "table_name"}],  # Missing required opr and value
            "select_columns": ["id"],
        }

        async with Client(mcp_server) as client:
            with pytest.raises(
                fastmcp.exceptions.ToolError, match="Input validation error"
            ):
                await client.call_tool("list_datasets", {"request": invalid_request})

    @patch("superset.mcp_service.model_tools.ModelListTool.run")
    @pytest.mark.asyncio
    async def test_list_datasets_edge_cases(self, mock_run, mcp_server):
        """Test edge cases for pagination and limits."""
        mock_run.return_value = DatasetList(
            datasets=[],
            count=0,
            total_count=0,
            page=0,
            page_size=1,
            total_pages=0,
            has_previous=False,
            has_next=False,
        )

        # Test minimum values
        request = ListDatasetsRequest(page=1, page_size=1)

        async with Client(mcp_server) as client:
            await client.call_tool(  # noqa: F841
                "list_datasets", {"request": request.model_dump()}
            )

            mock_run.assert_called_once()
            call_args = mock_run.call_args
            assert call_args.kwargs["page"] == 0  # Adjusted to 0-based
            assert call_args.kwargs["page_size"] == 1

    def test_backwards_compatibility_concerns(self):
        """Test that the new schema maintains expected behavior."""
        # Verify default columns include the most commonly used ones
        request = ListDatasetsRequest()
        default_columns = request.select_columns

        expected_columns = [
            "id",
            "table_name",
            "schema",
            "database_name",
            "changed_by_name",
            "changed_on",
            "created_by_name",
            "created_on",
        ]

        for col in expected_columns:
            assert col in default_columns, f"Expected column {col} not in defaults"

    def test_schema_documentation(self):
        """Test that schema has proper documentation."""
        schema = ListDatasetsRequest.model_json_schema()

        assert "properties" in schema
        assert "filters" in schema["properties"]
        assert "select_columns" in schema["properties"]

        # Check that descriptions are present
        filters_desc = schema["properties"]["filters"]["description"]
        assert "filter objects" in filters_desc.lower()

        columns_desc = schema["properties"]["select_columns"]["description"]
        assert "columns to select" in columns_desc.lower()
