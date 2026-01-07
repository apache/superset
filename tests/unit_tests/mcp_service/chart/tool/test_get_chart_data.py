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
Tests for the get_chart_data request schema
"""

import pytest

from superset.mcp_service.chart.schemas import GetChartDataRequest


class TestGetChartDataRequestSchema:
    """Test the GetChartDataRequest schema validation."""

    def test_default_request(self):
        """Test creating request with all defaults."""
        request = GetChartDataRequest(identifier=1)

        assert request.identifier == 1
        assert request.limit is None  # Uses chart's configured limit by default
        assert request.format == "json"
        assert request.use_cache is True
        assert request.force_refresh is False
        assert request.cache_timeout is None

    def test_request_with_uuid_identifier(self):
        """Test creating request with UUID identifier."""
        uuid = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
        request = GetChartDataRequest(identifier=uuid)

        assert request.identifier == uuid

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
        )

        data = request.model_dump()

        assert isinstance(data, dict)
        assert data["identifier"] == 123
        assert data["limit"] == 50
        assert data["format"] == "json"
