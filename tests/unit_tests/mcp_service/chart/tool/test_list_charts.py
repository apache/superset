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

import importlib
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    ChartFilter,
    ListChartsRequest,
)
from superset.mcp_service.constants import MAX_PAGE_SIZE
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    remove_chart_data_model_columns,
    request_uses_chart_data_model_filter,
    user_can_view_data_model_metadata,
)
from superset.utils import json

list_charts_module = importlib.import_module(
    "superset.mcp_service.chart.tool.list_charts"
)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for client-based tool tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


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
    chart.certified_by = None
    chart.certification_details = None
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
        minimal default columns (id, slice_name, viz_type, url,
        changed_on_humanized) in the tool.
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

    def test_page_size_exceeds_max(self):
        """Test that page_size over MAX_PAGE_SIZE raises validation error."""
        with pytest.raises(
            ValueError,
            match=f"Input should be less than or equal to {MAX_PAGE_SIZE}",
        ):
            ListChartsRequest(page_size=MAX_PAGE_SIZE + 1)

    def test_page_size_at_max(self):
        """Test that page_size at MAX_PAGE_SIZE is accepted."""
        request = ListChartsRequest(page_size=MAX_PAGE_SIZE)
        assert request.page_size == MAX_PAGE_SIZE

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

        assert set(CHART_DEFAULT_COLUMNS) == {
            "id",
            "slice_name",
            "viz_type",
            "description",
            "certified_by",
            "certification_details",
            "url",
            "changed_on",
            "changed_on_humanized",
        }

        # Heavy columns should NOT be in defaults
        assert "form_data" not in CHART_DEFAULT_COLUMNS
        assert "query_context" not in CHART_DEFAULT_COLUMNS
        assert "datasource_name" not in CHART_DEFAULT_COLUMNS
        assert "uuid" not in CHART_DEFAULT_COLUMNS

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


class TestChartDataModelMetadataPrivacy:
    """Test data-model field privacy helpers for chart listing."""

    def test_remove_data_model_columns(self):
        assert remove_chart_data_model_columns(
            ["id", "slice_name", "datasource_name", "form_data", "url"]
        ) == ["id", "slice_name", "url"]

    def test_uses_data_model_filter(self):
        request = ListChartsRequest(
            filters=[
                ChartFilter(
                    col="datasource_name",
                    opr="like",
                    value="Vehicle Sales",
                )
            ]
        )

        assert request_uses_chart_data_model_filter(request.filters) is True

    def test_user_can_view_data_model_metadata_uses_dataset_permission(self):
        with patch("superset.security_manager", new_callable=Mock) as security_manager:
            security_manager.can_access.side_effect = [False, True, False]

            assert user_can_view_data_model_metadata() is True

        security_manager.can_access.assert_any_call("can_get_drill_info", "Dataset")
        security_manager.can_access.assert_any_call(
            "can_get_or_create_dataset", "Dataset"
        )

    @pytest.mark.asyncio
    async def test_list_charts_returns_structured_privacy_error(self, mcp_server):
        request = ListChartsRequest(
            filters=[
                ChartFilter(
                    col="datasource_name",
                    opr="like",
                    value="Vehicle Sales",
                )
            ]
        )

        with patch.object(
            list_charts_module,
            "user_can_view_data_model_metadata",
            return_value=False,
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "list_charts",
                    {"request": request.model_dump()},
                )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == DATA_MODEL_METADATA_ERROR_TYPE


class TestListChartsCreatedByMe:
    """Tests for the created_by_me flag on ListChartsRequest."""

    def test_created_by_me_default_is_false(self):
        request = ListChartsRequest()
        assert request.created_by_me is False

    def test_created_by_me_true_accepted(self):
        request = ListChartsRequest(created_by_me=True)
        assert request.created_by_me is True

    def test_created_by_me_combined_with_filters(self):
        request = ListChartsRequest(
            created_by_me=True,
            filters=[ChartFilter(col="slice_name", opr="sw", value="My")],
        )
        assert request.created_by_me is True
        assert len(request.filters) == 1

    def test_created_by_me_with_search_raises(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="created_by_me"):
            ListChartsRequest(created_by_me=True, search="My charts")

    def test_chart_filter_rejects_created_by_fk(self):
        """created_by_fk is not a public filter column; use created_by_me instead."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            ChartFilter(col="created_by_fk", opr="eq", value=1)


class TestListChartsOwnedByMe:
    """Tests for the owned_by_me flag on ListChartsRequest."""

    def test_owned_by_me_default_is_false(self):
        request = ListChartsRequest()
        assert request.owned_by_me is False

    def test_owned_by_me_true_accepted(self):
        request = ListChartsRequest(owned_by_me=True)
        assert request.owned_by_me is True

    def test_owned_by_me_combined_with_filters(self):
        request = ListChartsRequest(
            owned_by_me=True,
            filters=[ChartFilter(col="slice_name", opr="sw", value="My")],
        )
        assert request.owned_by_me is True
        assert len(request.filters) == 1

    def test_owned_by_me_with_search_raises(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="owned_by_me"):
            ListChartsRequest(owned_by_me=True, search="My charts")

    def test_owned_by_me_with_created_by_me_raises(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="owned_by_me"):
            ListChartsRequest(owned_by_me=True, created_by_me=True)
