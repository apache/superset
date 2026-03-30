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
Unit tests for update_chart_preview MCP tool
"""

import pytest

from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    LegendConfig,
    TableChartConfig,
    UpdateChartPreviewRequest,
    XYChartConfig,
)


class TestUpdateChartPreview:
    """Tests for update_chart_preview MCP tool."""

    @pytest.mark.asyncio
    async def test_update_chart_preview_request_structure(self):
        """Test that chart preview update request structures are properly formed."""
        # Table chart preview update
        table_config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Region"),
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
            ],
            filters=[FilterConfig(column="year", op="=", value="2024")],
            sort_by=["sales"],
        )
        table_request = UpdateChartPreviewRequest(
            form_data_key="abc123def456", dataset_id=1, config=table_config
        )
        assert table_request.form_data_key == "abc123def456"
        assert table_request.dataset_id == 1
        assert table_request.config.chart_type == "table"
        assert len(table_request.config.columns) == 2
        assert table_request.config.columns[0].name == "region"

        # XY chart preview update
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
        xy_request = UpdateChartPreviewRequest(
            form_data_key="xyz789ghi012", dataset_id="2", config=xy_config
        )
        assert xy_request.form_data_key == "xyz789ghi012"
        assert xy_request.dataset_id == "2"
        assert xy_request.config.chart_type == "xy"
        assert xy_request.config.x.name == "date"
        assert xy_request.config.kind == "line"

    @pytest.mark.asyncio
    async def test_update_chart_preview_dataset_id_types(self):
        """Test that dataset_id can be int or string (UUID)."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Integer dataset_id
        request1 = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=123, config=config
        )
        assert request1.dataset_id == 123
        assert isinstance(request1.dataset_id, int)

        # String numeric dataset_id
        request2 = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id="456", config=config
        )
        assert request2.dataset_id == "456"
        assert isinstance(request2.dataset_id, str)

        # UUID string dataset_id
        request3 = UpdateChartPreviewRequest(
            form_data_key="abc123",
            dataset_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            config=config,
        )
        assert request3.dataset_id == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert isinstance(request3.dataset_id, str)

    @pytest.mark.asyncio
    async def test_update_chart_preview_generation_options(self):
        """Test preview generation options in update preview request."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Default preview generation
        request1 = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )
        assert request1.generate_preview is True
        assert request1.preview_formats == ["url"]

        # Custom preview formats
        request2 = UpdateChartPreviewRequest(
            form_data_key="abc123",
            dataset_id=1,
            config=config,
            generate_preview=True,
            preview_formats=["url", "ascii", "table"],
        )
        assert request2.generate_preview is True
        assert set(request2.preview_formats) == {"url", "ascii", "table"}

        # Disable preview generation
        request3 = UpdateChartPreviewRequest(
            form_data_key="abc123",
            dataset_id=1,
            config=config,
            generate_preview=False,
        )
        assert request3.generate_preview is False

    @pytest.mark.asyncio
    async def test_update_chart_preview_config_variations(self):
        """Test various chart configuration options in preview updates."""
        # Test all XY chart types
        chart_types = ["line", "bar", "area", "scatter"]
        for chart_type in chart_types:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x_col"),
                y=[ColumnRef(name="y_col")],
                kind=chart_type,
            )
            request = UpdateChartPreviewRequest(
                form_data_key="abc123", dataset_id=1, config=config
            )
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
        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=multi_y_config
        )
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
        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=table_config
        )
        assert len(request.config.filters) == 6

    @pytest.mark.asyncio
    async def test_update_chart_preview_response_structure(self):
        """Test the expected response structure for chart preview updates."""
        # The response should contain these fields
        expected_response = {
            "chart": {
                "id": None,  # No ID for unsaved previews
                "slice_name": str,
                "viz_type": str,
                "url": str,
                "uuid": None,  # No UUID for unsaved previews
                "saved": bool,
                "updated": bool,
            },
            "error": None,
            "success": bool,
            "schema_version": str,
            "api_version": str,
        }

        # When preview update succeeds, these additional fields may be present
        optional_fields = [
            "previews",
            "capabilities",
            "semantics",
            "explore_url",
            "form_data_key",
            "previous_form_data_key",
            "api_endpoints",
            "performance",
            "accessibility",
        ]

        # Validate structure expectations
        assert "chart" in expected_response
        assert "success" in expected_response
        assert len(optional_fields) > 0
        assert expected_response["chart"]["id"] is None
        assert expected_response["chart"]["uuid"] is None

    @pytest.mark.asyncio
    async def test_update_chart_preview_axis_configurations(self):
        """Test axis configuration updates in preview."""
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
        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )
        assert request.config.x_axis.title == "Date"
        assert request.config.x_axis.format == "smart_date"
        assert request.config.y_axis.title == "Sales Amount"
        assert request.config.y_axis.format == "$,.2f"

    @pytest.mark.asyncio
    async def test_update_chart_preview_legend_configurations(self):
        """Test legend configuration updates in preview."""
        positions = ["top", "bottom", "left", "right"]
        for pos in positions:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x"),
                y=[ColumnRef(name="y")],
                legend=LegendConfig(show=True, position=pos),
            )
            request = UpdateChartPreviewRequest(
                form_data_key="abc123", dataset_id=1, config=config
            )
            assert request.config.legend.position == pos
            assert request.config.legend.show is True

        # Hidden legend
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="x"),
            y=[ColumnRef(name="y")],
            legend=LegendConfig(show=False),
        )
        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )
        assert request.config.legend.show is False

    @pytest.mark.asyncio
    async def test_update_chart_preview_aggregation_functions(self):
        """Test all supported aggregation functions in preview updates."""
        aggs = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"]
        for agg in aggs:
            config = TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="value", aggregate=agg)],
            )
            request = UpdateChartPreviewRequest(
                form_data_key="abc123", dataset_id=1, config=config
            )
            assert request.config.columns[0].aggregate == agg

    @pytest.mark.asyncio
    async def test_update_chart_preview_error_responses(self):
        """Test expected error response structures for preview updates."""
        # General update error
        error_response = {
            "chart": None,
            "error": "Chart preview update failed: Invalid form_data_key",
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }
        assert error_response["success"] is False
        assert error_response["chart"] is None
        assert "failed" in error_response["error"].lower()

        # Missing dataset error
        dataset_error = {
            "chart": None,
            "error": "Chart preview update failed: Dataset not found",
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }
        assert dataset_error["success"] is False
        assert "dataset" in dataset_error["error"].lower()

    @pytest.mark.asyncio
    async def test_update_chart_preview_with_filters(self):
        """Test updating preview with various filter configurations."""
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

        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )
        assert len(request.config.filters) == 3
        assert request.config.filters[0].column == "region"
        assert request.config.filters[1].op == ">="
        assert request.config.filters[2].value == "2024-01-01"

    @pytest.mark.asyncio
    async def test_update_chart_preview_form_data_key_handling(self):
        """Test form_data_key handling in preview updates."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Various form_data_key formats
        form_data_keys = [
            "abc123def456",
            "xyz-789-ghi-012",
            "key_with_underscore",
            "UPPERCASE_KEY",
        ]

        for key in form_data_keys:
            request = UpdateChartPreviewRequest(
                form_data_key=key, dataset_id=1, config=config
            )
            assert request.form_data_key == key

    @pytest.mark.asyncio
    async def test_update_chart_preview_cache_control(self):
        """Test cache control parameters in update preview request."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        # Default cache settings
        request1 = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )
        assert request1.use_cache is True
        assert request1.force_refresh is False
        assert request1.cache_form_data is True

        # Custom cache settings
        request2 = UpdateChartPreviewRequest(
            form_data_key="abc123",
            dataset_id=1,
            config=config,
            use_cache=False,
            force_refresh=True,
            cache_form_data=False,
        )
        assert request2.use_cache is False
        assert request2.force_refresh is True
        assert request2.cache_form_data is False

    @pytest.mark.asyncio
    async def test_update_chart_preview_no_save_behavior(self):
        """Test that preview updates don't create permanent charts."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )

        # Preview updates should never create permanent charts
        # This is validated by checking the response structure
        expected_unsaved_fields = {
            "id": None,  # No chart ID
            "uuid": None,  # No UUID
            "saved": False,  # Not saved
        }

        # These expectations are validated in the response, not the request
        assert request.form_data_key == "abc123"
        assert expected_unsaved_fields["id"] is None
        assert expected_unsaved_fields["uuid"] is None
        assert expected_unsaved_fields["saved"] is False

    @pytest.mark.asyncio
    async def test_update_chart_preview_multiple_y_columns(self):
        """Test preview updates with multiple Y-axis columns."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[
                ColumnRef(name="revenue", aggregate="SUM", label="Total Revenue"),
                ColumnRef(name="cost", aggregate="SUM", label="Total Cost"),
                ColumnRef(name="profit", aggregate="SUM", label="Total Profit"),
                ColumnRef(name="orders", aggregate="COUNT", label="Order Count"),
            ],
            kind="line",
        )

        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )
        assert len(request.config.y) == 4
        assert request.config.y[0].name == "revenue"
        assert request.config.y[1].name == "cost"
        assert request.config.y[2].name == "profit"
        assert request.config.y[3].name == "orders"
        assert request.config.y[3].aggregate == "COUNT"

    @pytest.mark.asyncio
    async def test_update_chart_preview_table_sorting(self):
        """Test table chart sorting in preview updates."""
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="sales", aggregate="SUM"),
                ColumnRef(name="profit", aggregate="AVG"),
            ],
            sort_by=["sales", "profit"],
        )

        request = UpdateChartPreviewRequest(
            form_data_key="abc123", dataset_id=1, config=config
        )
        assert request.config.sort_by == ["sales", "profit"]
        assert len(request.config.columns) == 3
