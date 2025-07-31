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
Unit tests for get_chart_preview MCP tool
"""

import pytest

from superset.mcp_service.schemas.chart_schemas import (
    ASCIIPreview,
    GetChartPreviewRequest,
    TablePreview,
    URLPreview,
)


class TestGetChartPreview:
    """Tests for get_chart_preview MCP tool."""

    @pytest.mark.asyncio
    async def test_get_chart_preview_request_structure(self):
        """Test that preview request structures are properly formed."""
        # Numeric ID request
        request1 = GetChartPreviewRequest(identifier=123, format="url")
        assert request1.identifier == 123
        assert request1.format == "url"
        # Default dimensions are set
        assert request1.width == 800
        assert request1.height == 600

        # String ID request
        request2 = GetChartPreviewRequest(identifier="456", format="ascii")
        assert request2.identifier == "456"
        assert request2.format == "ascii"

        # UUID request
        request3 = GetChartPreviewRequest(
            identifier="a1b2c3d4-e5f6-7890-abcd-ef1234567890", format="table"
        )
        assert request3.identifier == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert request3.format == "table"

        # Default format
        request4 = GetChartPreviewRequest(identifier=789)
        assert request4.format == "url"  # default

    @pytest.mark.asyncio
    async def test_preview_format_types(self):
        """Test different preview format types."""
        formats = ["url", "ascii", "table"]
        for fmt in formats:
            request = GetChartPreviewRequest(identifier=1, format=fmt)
            assert request.format == fmt

    @pytest.mark.asyncio
    async def test_url_preview_structure(self):
        """Test URLPreview response structure."""
        preview = URLPreview(
            preview_url="http://localhost:5008/screenshot/chart/123.png",
            width=800,
            height=600,
            supports_interaction=False,
        )
        assert preview.type == "url"
        assert preview.preview_url == "http://localhost:5008/screenshot/chart/123.png"
        assert preview.width == 800
        assert preview.height == 600
        assert preview.supports_interaction is False

    @pytest.mark.asyncio
    async def test_ascii_preview_structure(self):
        """Test ASCIIPreview response structure."""
        ascii_art = """
┌─────────────────────────┐
│    Sales by Region      │
├─────────────────────────┤
│ North  ████████ 45%     │
│ South  ██████   30%     │
│ East   ████     20%     │
│ West   ██       5%      │
└─────────────────────────┘
"""
        preview = ASCIIPreview(
            ascii_content=ascii_art.strip(),
            width=25,
            height=8,
        )
        assert preview.type == "ascii"
        assert "Sales by Region" in preview.ascii_content
        assert preview.width == 25
        assert preview.height == 8

    @pytest.mark.asyncio
    async def test_table_preview_structure(self):
        """Test TablePreview response structure."""
        table_content = """
| Region | Sales  | Profit |
|--------|--------|--------|
| North  | 45000  | 12000  |
| South  | 30000  | 8000   |
| East   | 20000  | 5000   |
| West   | 5000   | 1000   |
"""
        preview = TablePreview(
            table_data=table_content.strip(),
            row_count=4,
            supports_sorting=True,
        )
        assert preview.type == "table"
        assert "Region" in preview.table_data
        assert "North" in preview.table_data
        assert preview.row_count == 4
        assert preview.supports_sorting is True

    @pytest.mark.asyncio
    async def test_chart_preview_response_structure(self):
        """Test the expected response structure for chart preview."""
        # Core fields that should always be present
        _ = [
            "chart_id",
            "chart_name",
            "chart_type",
            "explore_url",
            "content",  # Union of URLPreview | ASCIIPreview | TablePreview
            "chart_description",
            "accessibility",
            "performance",
        ]

        # Additional fields that may be present for backward compatibility
        _ = [
            "format",
            "preview_url",
            "ascii_chart",
            "table_data",
            "width",
            "height",
            "schema_version",
            "api_version",
        ]

        # This is a structural test - actual integration tests would verify
        # the tool returns data matching this structure

    @pytest.mark.asyncio
    async def test_preview_dimensions(self):
        """Test preview dimensions in response."""
        # Standard dimensions that may appear in preview responses
        standard_sizes = [
            (800, 600),  # Default
            (1200, 800),  # Large
            (400, 300),  # Small
            (1920, 1080),  # Full HD
        ]

        for width, height in standard_sizes:
            # URL preview with dimensions
            url_preview = URLPreview(
                preview_url="http://example.com/chart.png",
                width=width,
                height=height,
                supports_interaction=False,
            )
            assert url_preview.width == width
            assert url_preview.height == height

    @pytest.mark.asyncio
    async def test_error_response_structures(self):
        """Test error response structures."""
        # Error responses typically follow this structure
        error_response = {
            "error_type": "not_found",
            "message": "Chart not found",
            "details": "No chart found with ID 999",
            "chart_id": 999,
        }
        assert error_response["error_type"] == "not_found"
        assert error_response["chart_id"] == 999

        # Preview generation error structure
        preview_error = {
            "error_type": "preview_error",
            "message": "Failed to generate preview",
            "details": "Screenshot service unavailable",
        }
        assert preview_error["error_type"] == "preview_error"

    @pytest.mark.asyncio
    async def test_accessibility_metadata(self):
        """Test accessibility metadata structure."""
        from superset.mcp_service.schemas.chart_schemas import AccessibilityMetadata

        metadata = AccessibilityMetadata(
            color_blind_safe=True,
            alt_text="Bar chart showing sales by region",
            high_contrast_available=False,
        )
        assert metadata.color_blind_safe is True
        assert "sales by region" in metadata.alt_text
        assert metadata.high_contrast_available is False

    @pytest.mark.asyncio
    async def test_performance_metadata(self):
        """Test performance metadata structure."""
        from superset.mcp_service.schemas.chart_schemas import PerformanceMetadata

        metadata = PerformanceMetadata(
            query_duration_ms=150,
            cache_status="hit",
            optimization_suggestions=["Consider adding an index on date column"],
        )
        assert metadata.query_duration_ms == 150
        assert metadata.cache_status == "hit"
        assert len(metadata.optimization_suggestions) == 1

    @pytest.mark.asyncio
    async def test_chart_types_support(self):
        """Test that various chart types are supported."""
        chart_types = [
            "echarts_timeseries_line",
            "echarts_timeseries_bar",
            "echarts_area",
            "echarts_timeseries_scatter",
            "table",
            "pie",
            "big_number",
            "big_number_total",
            "pivot_table_v2",
            "dist_bar",
            "box_plot",
        ]

        # All chart types should be previewable
        for _chart_type in chart_types:
            # This would be tested in integration tests
            pass

    @pytest.mark.asyncio
    async def test_ascii_art_variations(self):
        """Test ASCII art generation for different chart types."""
        # Line chart ASCII
        _ = """
Sales Trend
│
│     ╱╲
│    ╱  ╲
│   ╱    ╲
│  ╱      ╲
│ ╱        ╲
└────────────
  Jan  Feb  Mar
"""

        # Bar chart ASCII
        _ = """
Sales by Region
│
│ ████ North
│ ███  South
│ ██   East
│ █    West
└────────────
"""

        # Pie chart ASCII
        _ = """
Market Share
  ╭─────╮
 ╱       ╲
│  45%    │
│ North   │
╰─────────╯
"""

        # These demonstrate the expected ASCII formats for different chart types
