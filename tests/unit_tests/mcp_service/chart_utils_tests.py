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
from superset.mcp_service.pydantic_schemas.chart_schemas import (
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
        """Test basic table config mapping"""
        config = TableChartConfig(
            columns=[
                ColumnRef(name="product", aggregate="COUNT"),
                ColumnRef(name="revenue", aggregate="SUM"),
            ]
        )

        result = map_table_config(config)

        assert result["viz_type"] == "table"
        assert result["all_columns"] == ["product", "revenue"]
        assert len(result["metrics"]) == 2
        assert result["metrics"][0]["aggregate"] == "COUNT"
        assert result["metrics"][1]["aggregate"] == "SUM"

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

    def test_generate_explore_link_always_returns_url(self) -> None:
        """Test that generate_explore_link returns a URL"""
        form_data = {"viz_type": "table", "metrics": ["count"]}
        result = generate_explore_link("123", form_data)

        # Should always return a URL string
        assert isinstance(result, str)
        assert "/explore/?" in result
        assert "datasource_id=123" in result
