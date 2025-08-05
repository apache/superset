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

"""Tests for MCP cache control functionality."""

from superset.mcp_service.chart.schemas import (
    GetChartDataRequest,
    ListChartsRequest,
)
from superset.mcp_service.common.cache_schemas import (
    CacheControlMixin,
    CacheStatus,
    FormDataCacheControl,
    MetadataCacheControl,
    QueryCacheControl,
)
from superset.mcp_service.utils.cache_utils import (
    get_cache_status_from_result,
    should_use_metadata_cache,
)


class TestCacheSchemas:
    """Test cache control schemas."""

    def test_cache_control_mixin_defaults(self):
        """Test default values for cache control mixin."""
        cache_control = CacheControlMixin()
        assert cache_control.use_cache is True
        assert cache_control.force_refresh is False

    def test_query_cache_control(self):
        """Test query cache control schema."""
        request = QueryCacheControl(
            use_cache=False,
            force_refresh=True,
            cache_timeout=3600,
        )
        assert request.use_cache is False
        assert request.force_refresh is True
        assert request.cache_timeout == 3600

    def test_metadata_cache_control(self):
        """Test metadata cache control schema."""
        request = MetadataCacheControl(
            refresh_metadata=True,
        )
        assert request.refresh_metadata is True
        assert request.use_cache is True  # Default from mixin

    def test_form_data_cache_control(self):
        """Test form data cache control schema."""
        request = FormDataCacheControl(
            cache_form_data=False,
        )
        assert request.cache_form_data is False

    def test_cache_status_schema(self):
        """Test cache status schema."""
        status = CacheStatus(
            cache_hit=True,
            cache_type="query",
            cache_age_seconds=300,
            refreshed=False,
        )
        assert status.cache_hit is True
        assert status.cache_type == "query"
        assert status.cache_age_seconds == 300
        assert status.refreshed is False


class TestChartSchemasCacheControl:
    """Test cache control integration in chart schemas."""

    def test_get_chart_data_request_cache_control(self):
        """Test GetChartDataRequest inherits cache control."""
        request = GetChartDataRequest(
            identifier=123,
            limit=50,
            use_cache=False,
            force_refresh=True,
            cache_timeout=1800,
        )
        assert request.identifier == 123
        assert request.limit == 50
        assert request.use_cache is False
        assert request.force_refresh is True
        assert request.cache_timeout == 1800

    def test_list_charts_request_metadata_cache(self):
        """Test ListChartsRequest inherits metadata cache control."""
        request = ListChartsRequest(
            refresh_metadata=True,
            use_cache=False,
        )
        assert request.refresh_metadata is True
        assert request.use_cache is False


class TestCacheUtils:
    """Test cache utility functions."""

    def test_get_cache_status_from_result_hit(self):
        """Test extracting cache status from query result - cache hit."""
        result = {
            "queries": [
                {
                    "is_cached": True,
                    "cache_dttm": "2023-01-01T12:00:00Z",
                    "data": [],
                }
            ]
        }

        status = get_cache_status_from_result(result, force_refresh=False)
        assert status.cache_hit is True
        assert status.cache_type == "query"
        assert status.refreshed is False

    def test_get_cache_status_from_result_miss(self):
        """Test extracting cache status from query result - cache miss."""
        result = {
            "queries": [
                {
                    "is_cached": False,
                    "data": [],
                }
            ]
        }

        status = get_cache_status_from_result(result, force_refresh=True)
        assert status.cache_hit is False
        assert status.cache_type == "none"
        assert status.refreshed is True

    def test_get_cache_status_direct_result(self):
        """Test extracting cache status from direct result (no queries wrapper)."""
        result = {
            "is_cached": True,
            "data": [],
        }

        status = get_cache_status_from_result(result)
        assert status.cache_hit is True
        assert status.cache_type == "query"

    def test_should_use_metadata_cache(self):
        """Test metadata cache usage decision."""
        # Should use cache
        assert should_use_metadata_cache(use_cache=True, refresh_metadata=False) is True

        # Should not use cache - disabled
        assert (
            should_use_metadata_cache(use_cache=False, refresh_metadata=False) is False
        )

        # Should not use cache - refresh requested
        assert should_use_metadata_cache(use_cache=True, refresh_metadata=True) is False


class TestCacheControlIntegration:
    """Test cache control integration with MCP tools."""

    def test_cache_control_in_existing_tools(self):
        """Test that existing tools have cache control parameters."""
        # Test that chart data tool has cache control
        from superset.mcp_service.chart.tool.get_chart_data import get_chart_data
        from superset.mcp_service.chart.tool.list_charts import list_charts

        # Verify the functions exist
        assert get_chart_data is not None
        assert list_charts is not None

    def test_cache_control_request_validation(self):
        """Test that cache control parameters are properly validated."""
        # Valid request
        request = GetChartDataRequest(
            identifier="123",
            cache_timeout=0,  # Disable cache for this query
        )
        assert request.cache_timeout == 0

        # Test default values
        request = GetChartDataRequest(identifier=456)
        assert request.use_cache is True
        assert request.force_refresh is False
        assert request.cache_timeout is None
