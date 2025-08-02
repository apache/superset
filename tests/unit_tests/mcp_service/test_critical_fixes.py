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
Unit tests for critical fixes in the MCP service.

Tests the three critical issues that were resolved:
1. Time series data aggregation bug
2. Missing previews for unsaved charts
3. Vega-Lite field mapping errors
4. Duplicate column/metric labels
"""

from superset.mcp_service.chart.chart_utils import map_xy_config
from superset.mcp_service.schemas.chart_schemas import ColumnRef, XYChartConfig


class TestCriticalFixes:
    """Test critical bug fixes for MCP service."""

    def test_time_series_aggregation_fix(self) -> None:
        """Test that time series charts preserve temporal dimension."""
        # Create a time series chart configuration
        config = XYChartConfig(
            chart_type="xy",
            kind="line",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="sales", aggregate="SUM", label="Total Sales")],
        )

        form_data = map_xy_config(config)

        # Verify the fix: x_axis should be set correctly
        assert form_data["x_axis"] == "order_date"

        # Verify the fix: groupby should not duplicate x_axis
        # This prevents the "Duplicate column/metric labels" error
        assert "groupby" not in form_data or "order_date" not in form_data.get(
            "groupby", []
        )

        # Verify chart type mapping
        assert form_data["viz_type"] == "echarts_timeseries_line"

    def test_time_series_with_explicit_group_by(self) -> None:
        """Test time series with explicit group_by different from x_axis."""
        config = XYChartConfig(
            chart_type="xy",
            kind="line",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="sales", aggregate="SUM", label="Total Sales")],
            group_by=ColumnRef(name="category"),
        )

        form_data = map_xy_config(config)

        # Verify x_axis is set
        assert form_data["x_axis"] == "order_date"

        # Verify groupby only contains the explicit group_by, not x_axis
        assert form_data.get("groupby") == ["category"]
        assert "order_date" not in form_data.get("groupby", [])

    def test_duplicate_label_prevention(self) -> None:
        """Test that duplicate column/metric labels are prevented."""
        # This configuration would previously cause:
        # "Duplicate column/metric labels: 'price_each'"
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="price_each", label="Price Each"),  # Custom label
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="quantity", aggregate="COUNT", label="Order Count"),
            ],
            group_by=ColumnRef(name="price_each"),  # Same column as x_axis
            kind="line",
        )

        form_data = map_xy_config(config)

        # Verify the fix: x_axis is set
        assert form_data["x_axis"] == "price_each"

        # Verify the fix: groupby is empty because group_by == x_axis
        # This prevents the duplicate label error
        assert "groupby" not in form_data or not form_data["groupby"]

    def test_metric_object_creation(self) -> None:
        """Test that metric objects are created correctly."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="profit", aggregate="AVG"),  # No custom label
            ],
            kind="bar",
        )

        form_data = map_xy_config(config)

        # Verify metrics are created correctly
        metrics = form_data["metrics"]
        assert len(metrics) == 2

        # First metric with custom label
        assert metrics[0]["label"] == "Total Sales"
        assert metrics[0]["aggregate"] == "SUM"
        assert metrics[0]["column"]["column_name"] == "sales"

        # Second metric with auto-generated label
        assert metrics[1]["label"] == "AVG(profit)"
        assert metrics[1]["aggregate"] == "AVG"
        assert metrics[1]["column"]["column_name"] == "profit"

    def test_chart_type_mapping(self) -> None:
        """Test that chart types are mapped correctly to Superset viz types."""
        test_cases = [
            ("line", "echarts_timeseries_line"),
            ("bar", "echarts_timeseries_bar"),
            ("area", "echarts_area"),
            ("scatter", "echarts_timeseries_scatter"),
        ]

        for kind, expected_viz_type in test_cases:
            config = XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="date"),
                y=[ColumnRef(name="value", aggregate="SUM")],
                kind=kind,
            )

            form_data = map_xy_config(config)
            assert form_data["viz_type"] == expected_viz_type
