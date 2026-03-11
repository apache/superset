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

from unittest.mock import Mock

import pytest

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    ChartFilter,
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
        """Test creating request with all defaults.

        Note: select_columns defaults to empty list, which triggers
        minimal default columns (id, slice_name, viz_type, uuid) in the tool.
        """
        request = ListChartsRequest()

        assert request.filters == []
        # select_columns is empty by default - tool applies minimal defaults
        assert request.select_columns == []
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


class TestChartDefaultColumnFiltering:
    """Test default column filtering behavior for charts."""

    def test_minimal_default_columns_constant(self):
        """Test that minimal default columns are properly defined."""
        from superset.mcp_service.common.schema_discovery import CHART_DEFAULT_COLUMNS

        # Required minimal columns must be present
        required_columns = {"id", "slice_name", "viz_type", "uuid"}
        assert required_columns.issubset(set(CHART_DEFAULT_COLUMNS))

        # Heavy columns should NOT be in defaults
        assert "form_data" not in CHART_DEFAULT_COLUMNS
        assert "query_context" not in CHART_DEFAULT_COLUMNS
        assert "description" not in CHART_DEFAULT_COLUMNS
        assert "datasource_name" not in CHART_DEFAULT_COLUMNS

    def test_empty_select_columns_default(self):
        """Test that select_columns defaults to empty list which triggers
        minimal defaults in tool."""
        request = ListChartsRequest()
        assert request.select_columns == []

    def test_explicit_select_columns(self):
        """Test that explicit select_columns can include non-default columns."""
        request = ListChartsRequest(
            select_columns=["id", "slice_name", "description", "cache_timeout"]
        )
        # Verify exact columns are present - explicit request should match exactly
        assert set(request.select_columns) == {
            "id",
            "slice_name",
            "description",
            "cache_timeout",
        }
