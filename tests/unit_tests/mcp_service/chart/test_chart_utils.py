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

"""Tests for chart utilities module"""

from unittest.mock import patch

import pytest

from superset.mcp_service.chart.chart_utils import (
    create_metric_object,
    generate_chart_name,
    generate_explore_link,
    map_config_to_form_data,
    map_filter_operator,
    map_table_config,
    map_xy_config,
)
from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    LegendConfig,
    TableChartConfig,
    XYChartConfig,
)


class TestCreateMetricObject:
    """Test create_metric_object function"""

    def test_create_metric_object_with_aggregate(self) -> None:
        """Test creating metric object with specified aggregate"""
        col = ColumnRef(name="revenue", aggregate="SUM", label="Total Revenue")
        result = create_metric_object(col)

        assert result["aggregate"] == "SUM"
        assert result["column"]["column_name"] == "revenue"
        assert result["label"] == "Total Revenue"
        assert result["optionName"] == "metric_revenue"
        assert result["expressionType"] == "SIMPLE"

    def test_create_metric_object_default_aggregate(self) -> None:
        """Test creating metric object with default aggregate"""
        col = ColumnRef(name="orders")
        result = create_metric_object(col)

        assert result["aggregate"] == "SUM"
        assert result["column"]["column_name"] == "orders"
        assert result["label"] == "SUM(orders)"
        assert result["optionName"] == "metric_orders"


class TestMapFilterOperator:
    """Test map_filter_operator function"""

    def test_map_filter_operators(self) -> None:
        """Test mapping of various filter operators"""
        assert map_filter_operator("=") == "=="
        assert map_filter_operator(">") == ">"
        assert map_filter_operator("<") == "<"
        assert map_filter_operator(">=") == ">="
        assert map_filter_operator("<=") == "<="
        assert map_filter_operator("!=") == "!="

    def test_map_filter_operator_unknown(self) -> None:
        """Test mapping of unknown operator returns original"""
        assert map_filter_operator("UNKNOWN") == "UNKNOWN"


class TestMapTableConfig:
    """Test map_table_config function"""

    def test_map_table_config_basic(self) -> None:
        """Test basic table config mapping with aggregated columns"""
        config = TableChartConfig(
            columns=[
                ColumnRef(name="product", aggregate="COUNT"),
                ColumnRef(name="revenue", aggregate="SUM"),
            ]
        )

        result = map_table_config(config)

        assert result["viz_type"] == "table"
        assert result["query_mode"] == "aggregate"
        # Aggregated columns should be in metrics, not all_columns
        assert "all_columns" not in result
        assert len(result["metrics"]) == 2
        assert result["metrics"][0]["aggregate"] == "COUNT"
        assert result["metrics"][1]["aggregate"] == "SUM"

    def test_map_table_config_raw_columns(self) -> None:
        """Test table config mapping with raw columns (no aggregates)"""
        config = TableChartConfig(
            columns=[
                ColumnRef(name="product"),
                ColumnRef(name="category"),
            ]
        )

        result = map_table_config(config)

        assert result["viz_type"] == "table"
        assert result["query_mode"] == "raw"
        # Raw columns should be in all_columns
        assert result["all_columns"] == ["product", "category"]
        assert "metrics" not in result

    def test_map_table_config_with_filters(self) -> None:
        """Test table config mapping with filters"""
        config = TableChartConfig(
            columns=[ColumnRef(name="product")],
            filters=[FilterConfig(column="status", op="=", value="active")],
        )

        result = map_table_config(config)

        assert "adhoc_filters" in result
        assert len(result["adhoc_filters"]) == 1
        filter_obj = result["adhoc_filters"][0]
        assert filter_obj["subject"] == "status"
        assert filter_obj["operator"] == "=="
        assert filter_obj["comparator"] == "active"
        assert filter_obj["expressionType"] == "SIMPLE"

    def test_map_table_config_with_sort(self) -> None:
        """Test table config mapping with sort"""
        config = TableChartConfig(
            columns=[ColumnRef(name="product")], sort_by=["product", "revenue"]
        )

        result = map_table_config(config)
        assert result["order_by_cols"] == ["product", "revenue"]


class TestMapXYConfig:
    """Test map_xy_config function"""

    def test_map_xy_config_line_chart(self) -> None:
        """Test XY config mapping for line chart"""
        config = XYChartConfig(
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            kind="line",
        )

        result = map_xy_config(config)

        assert result["viz_type"] == "echarts_timeseries_line"
        assert result["x_axis"] == "date"
        assert len(result["metrics"]) == 1
        assert result["metrics"][0]["aggregate"] == "SUM"

    def test_map_xy_config_with_groupby(self) -> None:
        """Test XY config mapping with group by"""
        config = XYChartConfig(
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue")],
            kind="bar",
            group_by=ColumnRef(name="region"),
        )

        result = map_xy_config(config)

        assert result["viz_type"] == "echarts_timeseries_bar"
        assert result["groupby"] == ["region"]

    def test_map_xy_config_with_axes(self) -> None:
        """Test XY config mapping with axis configurations"""
        config = XYChartConfig(
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue")],
            kind="area",
            x_axis=AxisConfig(title="Date", format="%Y-%m-%d"),
            y_axis=AxisConfig(title="Revenue", scale="log", format="$,.2f"),
        )

        result = map_xy_config(config)

        assert result["viz_type"] == "echarts_area"
        assert result["x_axis_title"] == "Date"
        assert result["x_axis_format"] == "%Y-%m-%d"
        assert result["y_axis_title"] == "Revenue"
        assert result["y_axis_format"] == "$,.2f"
        assert result["y_axis_scale"] == "log"

    def test_map_xy_config_with_legend(self) -> None:
        """Test XY config mapping with legend configuration"""
        config = XYChartConfig(
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue")],
            kind="scatter",
            legend=LegendConfig(show=False, position="top"),
        )

        result = map_xy_config(config)

        assert result["viz_type"] == "echarts_timeseries_scatter"
        assert result["show_legend"] is False
        assert result["legend_orientation"] == "top"


class TestMapConfigToFormData:
    """Test map_config_to_form_data function"""

    def test_map_table_config_type(self) -> None:
        """Test mapping table config type"""
        config = TableChartConfig(columns=[ColumnRef(name="test")])
        result = map_config_to_form_data(config)
        assert result["viz_type"] == "table"

    def test_map_xy_config_type(self) -> None:
        """Test mapping XY config type"""
        config = XYChartConfig(
            x=ColumnRef(name="date"), y=[ColumnRef(name="revenue")], kind="line"
        )
        result = map_config_to_form_data(config)
        assert result["viz_type"] == "echarts_timeseries_line"

    def test_map_unsupported_config_type(self) -> None:
        """Test mapping unsupported config type raises error"""
        with pytest.raises(ValueError, match="Unsupported config type"):
            map_config_to_form_data("invalid_config")  # type: ignore


class TestGenerateChartName:
    """Test generate_chart_name function"""

    def test_generate_table_chart_name(self) -> None:
        """Test generating name for table chart"""
        config = TableChartConfig(
            columns=[
                ColumnRef(name="product"),
                ColumnRef(name="revenue"),
            ]
        )

        result = generate_chart_name(config)
        assert result == "Table Chart - product, revenue"

    def test_generate_xy_chart_name(self) -> None:
        """Test generating name for XY chart"""
        config = XYChartConfig(
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue"), ColumnRef(name="orders")],
            kind="line",
        )

        result = generate_chart_name(config)
        assert result == "Line Chart - date vs revenue, orders"

    def test_generate_chart_name_unsupported(self) -> None:
        """Test generating name for unsupported config type"""
        result = generate_chart_name("invalid_config")  # type: ignore
        assert result == "Chart"


class TestGenerateExploreLink:
    """Test generate_explore_link function"""

    @patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
    def test_generate_explore_link_uses_base_url(self, mock_get_base_url) -> None:
        """Test that generate_explore_link uses the configured base URL"""
        mock_get_base_url.return_value = "https://superset.example.com"
        form_data = {"viz_type": "table", "metrics": ["count"]}

        result = generate_explore_link("123", form_data)

        # Should use the configured base URL
        assert result.startswith("https://superset.example.com")
        assert "/explore/?" in result
        assert "datasource_id=123" in result

    @patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
    def test_generate_explore_link_fallback_url(self, mock_get_base_url) -> None:
        """Test generate_explore_link returns fallback URL when dataset not found"""
        mock_get_base_url.return_value = "http://localhost:8088"
        form_data = {"viz_type": "table"}

        # Mock dataset not found scenario
        with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None):
            result = generate_explore_link("999", form_data)

        assert (
            result
            == "http://localhost:8088/explore/?datasource_type=table&datasource_id=999"
        )

    @patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
    @patch("superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand")
    def test_generate_explore_link_with_form_data_key(
        self, mock_command, mock_get_base_url
    ) -> None:
        """Test generate_explore_link creates form_data_key when dataset exists"""
        mock_get_base_url.return_value = "http://localhost:8088"
        mock_command.return_value.run.return_value = "test_form_data_key"

        # Mock dataset exists
        mock_dataset = type("Dataset", (), {"id": 123})()
        with patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_dataset
        ):
            result = generate_explore_link(123, {"viz_type": "table"})

        assert (
            result == "http://localhost:8088/explore/?form_data_key=test_form_data_key"
        )
        mock_command.assert_called_once()

    @patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
    def test_generate_explore_link_exception_handling(self, mock_get_base_url) -> None:
        """Test generate_explore_link handles exceptions gracefully"""
        mock_get_base_url.return_value = "http://localhost:8088"

        # Mock exception during form_data creation
        with patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            side_effect=Exception("DB error"),
        ):
            result = generate_explore_link("123", {"viz_type": "table"})

        # Should fallback to basic URL
        assert (
            result
            == "http://localhost:8088/explore/?datasource_type=table&datasource_id=123"
        )


class TestCriticalBugFixes:
    """Test critical bug fixes for chart utilities."""

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

    def test_metric_object_creation_with_labels(self) -> None:
        """Test that metric objects are created correctly with proper labels."""
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

    def test_chart_type_mapping_comprehensive(self) -> None:
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
