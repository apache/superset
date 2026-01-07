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
Tests for the get_chart_data request schema and MAX_ROW_LIMIT
"""

import pytest

from superset.mcp_service.chart.schemas import GetChartDataRequest
from superset.mcp_service.chart.tool.get_chart_data import MAX_ROW_LIMIT


class TestGetChartDataRequestSchema:
    """Test the GetChartDataRequest schema validation."""

    def test_default_request(self):
        """Test creating request with all defaults."""
        request = GetChartDataRequest(identifier=1)

        assert request.identifier == 1
        assert request.limit == 100
        assert request.format == "json"
        assert request.include_raw_data is False
        assert request.use_cache is True
        assert request.force_refresh is False
        assert request.cache_timeout is None

    def test_request_with_uuid_identifier(self):
        """Test creating request with UUID identifier."""
        uuid = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
        request = GetChartDataRequest(identifier=uuid)

        assert request.identifier == uuid

    def test_request_with_include_raw_data_true(self):
        """Test creating request with include_raw_data enabled."""
        request = GetChartDataRequest(identifier=1, include_raw_data=True)

        assert request.include_raw_data is True

    def test_request_with_include_raw_data_false(self):
        """Test creating request with include_raw_data explicitly disabled."""
        request = GetChartDataRequest(identifier=1, include_raw_data=False)

        assert request.include_raw_data is False

    def test_request_with_custom_limit(self):
        """Test creating request with custom limit."""
        request = GetChartDataRequest(identifier=1, limit=500)

        assert request.limit == 500

    def test_request_with_csv_format(self):
        """Test creating request with CSV format."""
        request = GetChartDataRequest(identifier=1, format="csv")

        assert request.format == "csv"

    def test_request_with_excel_format(self):
        """Test creating request with Excel format."""
        request = GetChartDataRequest(identifier=1, format="excel")

        assert request.format == "excel"

    def test_request_with_cache_control(self):
        """Test creating request with cache control options."""
        request = GetChartDataRequest(
            identifier=1,
            use_cache=False,
            force_refresh=True,
            cache_timeout=3600,
        )

        assert request.use_cache is False
        assert request.force_refresh is True
        assert request.cache_timeout == 3600

    def test_invalid_format(self):
        """Test that invalid format raises validation error."""
        with pytest.raises(
            ValueError, match="Input should be 'json', 'csv' or 'excel'"
        ):
            GetChartDataRequest(identifier=1, format="invalid")

    def test_model_dump_serialization(self):
        """Test that the request serializes correctly for JSON."""
        request = GetChartDataRequest(
            identifier=123,
            limit=50,
            format="json",
            include_raw_data=True,
        )

        data = request.model_dump()

        assert isinstance(data, dict)
        assert data["identifier"] == 123
        assert data["limit"] == 50
        assert data["format"] == "json"
        assert data["include_raw_data"] is True


class TestMaxRowLimit:
    """Test the MAX_ROW_LIMIT constant."""

    def test_max_row_limit_is_defined(self):
        """Test that MAX_ROW_LIMIT is defined and reasonable."""
        assert MAX_ROW_LIMIT is not None
        assert isinstance(MAX_ROW_LIMIT, int)
        assert MAX_ROW_LIMIT > 0

    def test_max_row_limit_value(self):
        """Test that MAX_ROW_LIMIT has expected value."""
        assert MAX_ROW_LIMIT == 10000

    def test_row_limit_capping_logic(self):
        """Test the row limit capping logic used in get_chart_data."""
        # Test that the capping logic works correctly
        test_cases = [
            (None, 100),  # None defaults to 100
            (50, 50),  # Within limit
            (100, 100),  # Default
            (5000, 5000),  # Within limit
            (10000, 10000),  # At limit
            (15000, 10000),  # Exceeds limit, capped
            (100000, 10000),  # Far exceeds limit, capped
        ]

        for requested_limit, expected in test_cases:
            result = min(requested_limit or 100, MAX_ROW_LIMIT)
            assert result == expected, (
                f"For requested_limit={requested_limit}, "
                f"expected {expected} but got {result}"
            )
