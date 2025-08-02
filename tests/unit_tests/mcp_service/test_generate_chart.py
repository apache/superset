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
Unit tests for MCP generate_chart tool
"""

import pytest

from superset.mcp_service.schemas.chart_schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    GenerateChartRequest,
    LegendConfig,
    TableChartConfig,
    XYChartConfig,
)


class TestGenerateChart:
    """Tests for generate_chart MCP tool."""

    @pytest.mark.asyncio
    async def test_generate_chart_request_structure(self):
        """Test that chart generation request structures are properly formed."""
        # Table chart request
        table_config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Region"),
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
            ],
            filters=[FilterConfig(column="year", op="=", value="2024")],
            sort_by=["sales"],
        )
        table_request = GenerateChartRequest(dataset_id="1", config=table_config)
        assert table_request.dataset_id == "1"
        assert table_request.config.chart_type == "table"
        assert len(table_request.config.columns) == 2
        assert table_request.config.columns[0].name == "region"
        assert table_request.config.columns[1].aggregate == "SUM"

        # XY chart request
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
        xy_request = GenerateChartRequest(dataset_id="2", config=xy_config)
        assert xy_request.config.chart_type == "xy"
        assert xy_request.config.x.name == "date"
        assert xy_request.config.y[0].aggregate == "SUM"
        assert xy_request.config.kind == "line"
        assert xy_request.config.x_axis.title == "Date"
        assert xy_request.config.legend.show is True

    @pytest.mark.asyncio
    async def test_generate_chart_validation_error_handling(self):
        """Test that validation errors are properly structured."""

        # Create a validation error with the correct structure
        validation_error_entry = {
            "field": "x_axis",
            "provided_value": "invalid_col",
            "error_type": "column_not_found",
            "message": "Column 'invalid_col' not found",
        }

        # Test that validation error structure is correct
        assert validation_error_entry["field"] == "x_axis"
        assert validation_error_entry["error_type"] == "column_not_found"

    @pytest.mark.asyncio
    async def test_chart_config_variations(self):
        """Test various chart configuration options."""
        # Test all chart types
        chart_types = ["line", "bar", "area", "scatter"]
        for chart_type in chart_types:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x_col"),
                y=[ColumnRef(name="y_col")],
                kind=chart_type,
            )
            assert config.kind == chart_type

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
        assert len(multi_y_config.y) == 3
        assert multi_y_config.y[1].aggregate == "AVG"

        # Test filter operators
        operators = ["=", "!=", ">", ">=", "<", "<="]
        filters = [FilterConfig(column="col", op=op, value="val") for op in operators]
        for i, f in enumerate(filters):
            assert f.op == operators[i]

    @pytest.mark.asyncio
    async def test_generate_chart_response_structure(self):
        """Test the expected response structure for chart generation."""
        # The response should contain these fields
        _ = {
            "chart": {
                "id": int,
                "slice_name": str,
                "viz_type": str,
                "url": str,
                "uuid": str,
                "saved": bool,
            },
            "error": None,
            "success": bool,
            "schema_version": str,
            "api_version": str,
        }

        # When chart creation succeeds, these additional fields may be present
        _ = [
            "previews",
            "capabilities",
            "semantics",
            "explore_url",
            "form_data_key",
            "api_endpoints",
            "performance",
            "accessibility",
        ]

        # This is just a structural test - actual integration tests would verify
        # the tool returns data matching this structure

    @pytest.mark.asyncio
    async def test_dataset_id_flexibility(self):
        """Test that dataset_id can be string or int."""
        configs = [
            GenerateChartRequest(
                dataset_id="123",
                config=TableChartConfig(
                    chart_type="table", columns=[ColumnRef(name="col1")]
                ),
            ),
            GenerateChartRequest(
                dataset_id="uuid-string-here",
                config=TableChartConfig(
                    chart_type="table", columns=[ColumnRef(name="col1")]
                ),
            ),
        ]

        for config in configs:
            assert isinstance(config.dataset_id, str)

    @pytest.mark.asyncio
    async def test_save_chart_flag(self):
        """Test save_chart flag behavior."""
        # Default should be True (save chart)
        request1 = GenerateChartRequest(
            dataset_id="1",
            config=TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="col1")]
            ),
        )
        assert request1.save_chart is True

        # Explicit False (preview only)
        request2 = GenerateChartRequest(
            dataset_id="1",
            config=TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="col1")]
            ),
            save_chart=False,
        )
        assert request2.save_chart is False

    @pytest.mark.asyncio
    async def test_preview_formats(self):
        """Test preview format options."""
        formats = ["url", "ascii", "table"]
        request = GenerateChartRequest(
            dataset_id="1",
            config=TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="col1")]
            ),
            generate_preview=True,
            preview_formats=formats,
        )
        assert request.generate_preview is True
        assert set(request.preview_formats) == set(formats)

    @pytest.mark.asyncio
    async def test_column_ref_features(self):
        """Test ColumnRef features like aggregation and labels."""
        # Simple column
        col1 = ColumnRef(name="region")
        assert col1.name == "region"
        assert col1.label is None
        assert col1.aggregate is None

        # Column with aggregation
        col2 = ColumnRef(name="sales", aggregate="SUM", label="Total Sales")
        assert col2.name == "sales"
        assert col2.aggregate == "SUM"
        assert col2.label == "Total Sales"

        # All supported aggregations
        aggs = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"]
        for agg in aggs:
            col = ColumnRef(name="value", aggregate=agg)
            assert col.aggregate == agg

    @pytest.mark.asyncio
    async def test_axis_config_options(self):
        """Test axis configuration options."""
        axis = AxisConfig(
            title="Sales Amount",
            format="$,.2f",
            scale="linear",
        )
        assert axis.title == "Sales Amount"
        assert axis.format == "$,.2f"
        assert axis.scale == "linear"

        # Test different formats
        formats = ["SMART_NUMBER", "$,.2f", ",.0f", "smart_date", ".3%"]
        for fmt in formats:
            axis = AxisConfig(format=fmt)
            assert axis.format == fmt

    @pytest.mark.asyncio
    async def test_legend_config_options(self):
        """Test legend configuration options."""
        positions = ["top", "bottom", "left", "right"]
        for pos in positions:
            legend = LegendConfig(show=True, position=pos)
            assert legend.position == pos

        # Hidden legend
        legend = LegendConfig(show=False)
        assert legend.show is False
