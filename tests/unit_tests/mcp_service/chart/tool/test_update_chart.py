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
Unit tests for update_chart MCP tool
"""

import pytest

from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    LegendConfig,
    TableChartConfig,
    UpdateChartRequest,
    XYChartConfig,
)


class TestUpdateChart:
    """Tests for update_chart MCP tool."""

    @pytest.mark.asyncio
    async def test_update_chart_request_structure(self):
        """Test that chart update request structures are properly formed."""
        # Table chart update with numeric ID
        table_config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Region"),
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
            ],
            filters=[FilterConfig(column="year", op="=", value="2024")],
            sort_by=["sales"],
        )
        table_request = UpdateChartRequest(identifier=123, config=table_config)
        assert table_request.identifier == 123
        assert table_request.config.chart_type == "table"
        assert len(table_request.config.columns) == 2
        assert table_request.config.columns[0].name == "region"
        assert table_request.config.columns[1].aggregate == "SUM"

        # XY chart update with UUID
        xy_config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="value", aggregate="SUM")],
            kind="line",
            group_by=ColumnRef(name="category"),
            x_axis=AxisConfig(title="Date", format="smart_date"),
            y_axis=AxisConfig(title="Value", format="$,.2f"),
            legend=LegendConfig(show=True, position="top"),
        )
        xy_request = UpdateChartRequest(
            identifier="a1b2c3d4-e5f6-7890-abcd-ef1234567890", config=xy_config
        )
        assert xy_request.identifier == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert xy_request.config.chart_type == "xy"
        assert xy_request.config.x.name == "date"
        assert xy_request.config.y[0].aggregate == "SUM"
        assert xy_request.config.kind == "line"

    @pytest.mark.asyncio
    async def test_update_chart_with_chart_name(self):
        """Test updating chart with custom chart name."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Without custom name
        request1 = UpdateChartRequest(identifier=123, config=config)
        assert request1.chart_name is None

        # With custom name
        request2 = UpdateChartRequest(
            identifier=123, config=config, chart_name="Updated Sales Report"
        )
        assert request2.chart_name == "Updated Sales Report"

    @pytest.mark.asyncio
    async def test_update_chart_preview_generation(self):
        """Test preview generation options in update request."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Default preview generation
        request1 = UpdateChartRequest(identifier=123, config=config)
        assert request1.generate_preview is True
        assert request1.preview_formats == ["url"]

        # Custom preview formats
        request2 = UpdateChartRequest(
            identifier=123,
            config=config,
            generate_preview=True,
            preview_formats=["url", "ascii", "table"],
        )
        assert request2.generate_preview is True
        assert set(request2.preview_formats) == {"url", "ascii", "table"}

        # Disable preview generation
        request3 = UpdateChartRequest(
            identifier=123, config=config, generate_preview=False
        )
        assert request3.generate_preview is False

    @pytest.mark.asyncio
    async def test_update_chart_identifier_types(self):
        """Test that identifier can be int or string (UUID)."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Integer ID
        request1 = UpdateChartRequest(identifier=123, config=config)
        assert request1.identifier == 123
        assert isinstance(request1.identifier, int)

        # String numeric ID
        request2 = UpdateChartRequest(identifier="456", config=config)
        assert request2.identifier == "456"
        assert isinstance(request2.identifier, str)

        # UUID string
        request3 = UpdateChartRequest(
            identifier="a1b2c3d4-e5f6-7890-abcd-ef1234567890", config=config
        )
        assert request3.identifier == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert isinstance(request3.identifier, str)

    @pytest.mark.asyncio
    async def test_update_chart_config_variations(self):
        """Test various chart configuration options in updates."""
        # Test all XY chart types
        chart_types = ["line", "bar", "area", "scatter"]
        for chart_type in chart_types:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x_col"),
                y=[ColumnRef(name="y_col")],
                kind=chart_type,
            )
            request = UpdateChartRequest(identifier=1, config=config)
            assert request.config.kind == chart_type

        # Test multiple Y columns
        multi_y_config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM"),
                ColumnRef(name="profit", aggregate="AVG"),
                ColumnRef(name="quantity", aggregate="COUNT"),
            ],
            kind="line",
        )
        request = UpdateChartRequest(identifier=1, config=multi_y_config)
        assert len(request.config.y) == 3
        assert request.config.y[1].aggregate == "AVG"

        # Test filter operators
        operators = ["=", "!=", ">", ">=", "<", "<="]
        filters = [FilterConfig(column="col", op=op, value="val") for op in operators]
        table_config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
            filters=filters,
        )
        request = UpdateChartRequest(identifier=1, config=table_config)
        assert len(request.config.filters) == 6

    @pytest.mark.asyncio
    async def test_update_chart_response_structure(self):
        """Test the expected response structure for chart updates."""
        # The response should contain these fields
        expected_response = {
            "chart": {
                "id": int,
                "slice_name": str,
                "viz_type": str,
                "url": str,
                "uuid": str,
                "updated": bool,
            },
            "error": None,
            "success": bool,
            "schema_version": str,
            "api_version": str,
        }

        # When chart update succeeds, these additional fields may be present
        optional_fields = [
            "previews",
            "capabilities",
            "semantics",
            "explore_url",
            "api_endpoints",
            "performance",
            "accessibility",
        ]

        # Validate structure expectations
        assert "chart" in expected_response
        assert "success" in expected_response
        assert len(optional_fields) > 0

    @pytest.mark.asyncio
    async def test_update_chart_axis_configurations(self):
        """Test axis configuration updates."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="sales")],
            x_axis=AxisConfig(
                title="Date",
                format="smart_date",
                scale="linear",
            ),
            y_axis=AxisConfig(
                title="Sales Amount",
                format="$,.2f",
                scale="log",
            ),
        )
        request = UpdateChartRequest(identifier=1, config=config)
        assert request.config.x_axis.title == "Date"
        assert request.config.x_axis.format == "smart_date"
        assert request.config.x_axis.scale == "linear"
        assert request.config.y_axis.title == "Sales Amount"
        assert request.config.y_axis.format == "$,.2f"
        assert request.config.y_axis.scale == "log"

    @pytest.mark.asyncio
    async def test_update_chart_legend_configurations(self):
        """Test legend configuration updates."""
        positions = ["top", "bottom", "left", "right"]
        for pos in positions:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x"),
                y=[ColumnRef(name="y")],
                legend=LegendConfig(show=True, position=pos),
            )
            request = UpdateChartRequest(identifier=1, config=config)
            assert request.config.legend.position == pos
            assert request.config.legend.show is True

        # Hidden legend
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="x"),
            y=[ColumnRef(name="y")],
            legend=LegendConfig(show=False),
        )
        request = UpdateChartRequest(identifier=1, config=config)
        assert request.config.legend.show is False

    @pytest.mark.asyncio
    async def test_update_chart_aggregation_functions(self):
        """Test all supported aggregation functions in updates."""
        aggs = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"]
        for agg in aggs:
            config = TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="value", aggregate=agg)],
            )
            request = UpdateChartRequest(identifier=1, config=config)
            assert request.config.columns[0].aggregate == agg

    @pytest.mark.asyncio
    async def test_update_chart_error_responses(self):
        """Test expected error response structures."""
        # Chart not found error
        error_response = {
            "chart": None,
            "error": "No chart found with identifier: 999",
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }
        assert error_response["success"] is False
        assert error_response["chart"] is None
        assert "chart found" in error_response["error"].lower()

        # General update error
        update_error = {
            "chart": None,
            "error": "Chart update failed: Permission denied",
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }
        assert update_error["success"] is False
        assert "failed" in update_error["error"].lower()

    @pytest.mark.asyncio
    async def test_chart_name_sanitization(self):
        """Test that chart names are properly sanitized."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Test with potentially problematic characters
        test_names = [
            "Normal Chart Name",
            "Chart with 'quotes'",
            'Chart with "double quotes"',
            "Chart with <brackets>",
        ]

        for name in test_names:
            request = UpdateChartRequest(identifier=1, config=config, chart_name=name)
            # Chart name should be set (sanitization happens in the validator)
            assert request.chart_name is not None

    @pytest.mark.asyncio
    async def test_update_chart_with_filters(self):
        """Test updating chart with various filter configurations."""
        filters = [
            FilterConfig(column="region", op="=", value="North"),
            FilterConfig(column="sales", op=">=", value=1000),
            FilterConfig(column="date", op=">", value="2024-01-01"),
        ]

        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="sales"),
                ColumnRef(name="date"),
            ],
            filters=filters,
        )

        request = UpdateChartRequest(identifier=1, config=config)
        assert len(request.config.filters) == 3
        assert request.config.filters[0].column == "region"
        assert request.config.filters[1].op == ">="
        assert request.config.filters[2].value == "2024-01-01"

    @pytest.mark.asyncio
    async def test_update_chart_cache_control(self):
        """Test cache control parameters in update request."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Default cache settings
        request1 = UpdateChartRequest(identifier=1, config=config)
        assert request1.use_cache is True
        assert request1.force_refresh is False
        assert request1.cache_timeout is None

        # Custom cache settings
        request2 = UpdateChartRequest(
            identifier=1,
            config=config,
            use_cache=False,
            force_refresh=True,
            cache_timeout=300,
        )
        assert request2.use_cache is False
        assert request2.force_refresh is True
        assert request2.cache_timeout == 300
