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

from typing import Any
from unittest.mock import patch

import pytest

from superset.mcp_service.chart.chart_utils import (
    configure_temporal_handling,
    create_metric_object,
    generate_chart_name,
    generate_explore_link,
    is_column_truly_temporal,
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
from superset.utils.core import GenericDataType


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

    def test_map_filter_operators_pattern_matching(self) -> None:
        """Test mapping of pattern matching operators"""
        assert map_filter_operator("LIKE") == "LIKE"
        assert map_filter_operator("ILIKE") == "ILIKE"
        assert map_filter_operator("NOT LIKE") == "NOT LIKE"

    def test_map_filter_operators_set(self) -> None:
        """Test mapping of set operators"""
        assert map_filter_operator("IN") == "IN"
        assert map_filter_operator("NOT IN") == "NOT IN"

    def test_map_filter_operator_unknown(self) -> None:
        """Test mapping of unknown operator returns original"""
        assert map_filter_operator("UNKNOWN") == "UNKNOWN"


class TestMapTableConfig:
    """Test map_table_config function"""

    def test_map_table_config_basic(self) -> None:
        """Test basic table config mapping with aggregated columns"""
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="product", aggregate="COUNT"),
                ColumnRef(name="revenue", aggregate="SUM"),
            ],
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
            chart_type="table",
            columns=[
                ColumnRef(name="product"),
                ColumnRef(name="category"),
            ],
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
            chart_type="table",
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

    def test_map_table_config_with_like_filter(self) -> None:
        """Test table config mapping with LIKE filter for pattern matching"""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="name")],
            filters=[FilterConfig(column="name", op="LIKE", value="%mario%")],
        )

        result = map_table_config(config)

        assert "adhoc_filters" in result
        assert len(result["adhoc_filters"]) == 1
        filter_obj = result["adhoc_filters"][0]
        assert filter_obj["subject"] == "name"
        assert filter_obj["operator"] == "LIKE"
        assert filter_obj["comparator"] == "%mario%"
        assert filter_obj["expressionType"] == "SIMPLE"

    def test_map_table_config_with_ilike_filter(self) -> None:
        """Test table config mapping with ILIKE filter for case-insensitive matching"""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="name")],
            filters=[FilterConfig(column="name", op="ILIKE", value="%mario%")],
        )

        result = map_table_config(config)

        assert "adhoc_filters" in result
        filter_obj = result["adhoc_filters"][0]
        assert filter_obj["operator"] == "ILIKE"
        assert filter_obj["comparator"] == "%mario%"

    def test_map_table_config_with_in_filter(self) -> None:
        """Test table config mapping with IN filter for list matching"""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="platform")],
            filters=[
                FilterConfig(
                    column="platform", op="IN", value=["Wii", "PS3", "Xbox360"]
                )
            ],
        )

        result = map_table_config(config)

        assert "adhoc_filters" in result
        filter_obj = result["adhoc_filters"][0]
        assert filter_obj["subject"] == "platform"
        assert filter_obj["operator"] == "IN"
        assert filter_obj["comparator"] == ["Wii", "PS3", "Xbox360"]

    def test_map_table_config_with_not_in_filter(self) -> None:
        """Test table config mapping with NOT IN filter"""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="status")],
            filters=[
                FilterConfig(
                    column="status", op="NOT IN", value=["archived", "deleted"]
                )
            ],
        )

        result = map_table_config(config)

        assert "adhoc_filters" in result
        filter_obj = result["adhoc_filters"][0]
        assert filter_obj["operator"] == "NOT IN"
        assert filter_obj["comparator"] == ["archived", "deleted"]

    def test_map_table_config_with_mixed_filters(self) -> None:
        """Test table config mapping with mixed filter operators"""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="name"), ColumnRef(name="sales")],
            filters=[
                FilterConfig(column="platform", op="=", value="Wii"),
                FilterConfig(column="name", op="ILIKE", value="%mario%"),
                FilterConfig(column="genre", op="IN", value=["Sports", "Racing"]),
            ],
        )

        result = map_table_config(config)

        assert len(result["adhoc_filters"]) == 3
        assert result["adhoc_filters"][0]["operator"] == "=="
        assert result["adhoc_filters"][1]["operator"] == "ILIKE"
        assert result["adhoc_filters"][1]["comparator"] == "%mario%"
        assert result["adhoc_filters"][2]["operator"] == "IN"
        assert result["adhoc_filters"][2]["comparator"] == ["Sports", "Racing"]

    def test_map_table_config_with_sort(self) -> None:
        """Test table config mapping with sort"""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="product")],
            sort_by=["product", "revenue"],
        )

        result = map_table_config(config)
        assert result["order_by_cols"] == ["product", "revenue"]

    def test_map_table_config_ag_grid_table(self) -> None:
        """Test table config mapping with AG Grid Interactive Table viz_type"""
        config = TableChartConfig(
            chart_type="table",
            viz_type="ag-grid-table",
            columns=[
                ColumnRef(name="product_line"),
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ],
        )

        result = map_table_config(config)

        # AG Grid tables use 'ag-grid-table' viz_type
        assert result["viz_type"] == "ag-grid-table"
        assert result["query_mode"] == "aggregate"
        assert len(result["metrics"]) == 1
        assert result["metrics"][0]["aggregate"] == "SUM"
        # Non-aggregated columns should be in groupby
        assert "groupby" in result
        assert "product_line" in result["groupby"]

    def test_map_table_config_ag_grid_raw_mode(self) -> None:
        """Test AG Grid table with raw columns (no aggregates)"""
        config = TableChartConfig(
            chart_type="table",
            viz_type="ag-grid-table",
            columns=[
                ColumnRef(name="product_line"),
                ColumnRef(name="category"),
                ColumnRef(name="region"),
            ],
        )

        result = map_table_config(config)

        assert result["viz_type"] == "ag-grid-table"
        assert result["query_mode"] == "raw"
        assert result["all_columns"] == ["product_line", "category", "region"]
        assert "metrics" not in result

    def test_map_table_config_default_viz_type(self) -> None:
        """Test that default viz_type is 'table' not 'ag-grid-table'"""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="product")],
        )

        result = map_table_config(config)

        assert result["viz_type"] == "table"


class TestMapXYConfig:
    """Test map_xy_config function"""

    def test_map_xy_config_line_chart(self) -> None:
        """Test XY config mapping for line chart"""
        config = XYChartConfig(
            chart_type="xy",
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
            chart_type="xy",
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
            chart_type="xy",
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
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue")],
            kind="scatter",
            legend=LegendConfig(show=False, position="top"),
        )

        result = map_xy_config(config)

        assert result["viz_type"] == "echarts_timeseries_scatter"
        assert result["show_legend"] is False
        assert result["legend_orientation"] == "top"

    def test_map_xy_config_with_time_grain_month(self) -> None:
        """Test XY config mapping with monthly time grain"""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            kind="bar",
            time_grain="P1M",
        )

        result = map_xy_config(config)

        assert result["viz_type"] == "echarts_timeseries_bar"
        assert result["x_axis"] == "order_date"
        assert result["time_grain_sqla"] == "P1M"

    def test_map_xy_config_with_time_grain_day(self) -> None:
        """Test XY config mapping with daily time grain"""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="created_at"),
            y=[ColumnRef(name="count", aggregate="COUNT")],
            kind="line",
            time_grain="P1D",
        )

        result = map_xy_config(config)

        assert result["viz_type"] == "echarts_timeseries_line"
        assert result["x_axis"] == "created_at"
        assert result["time_grain_sqla"] == "P1D"

    def test_map_xy_config_with_time_grain_hour(self) -> None:
        """Test XY config mapping with hourly time grain"""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="timestamp"),
            y=[ColumnRef(name="requests", aggregate="SUM")],
            kind="area",
            time_grain="PT1H",
        )

        result = map_xy_config(config)

        assert result["time_grain_sqla"] == "PT1H"

    def test_map_xy_config_without_time_grain(self) -> None:
        """Test XY config mapping without time grain (should not set time_grain_sqla)"""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue")],
            kind="line",
        )

        result = map_xy_config(config)

        assert "time_grain_sqla" not in result

    def test_map_xy_config_with_time_grain_and_groupby(self) -> None:
        """Test XY config mapping with time grain and group by"""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            kind="line",
            time_grain="P1W",
            group_by=ColumnRef(name="category"),
        )

        result = map_xy_config(config)

        assert result["time_grain_sqla"] == "P1W"
        assert result["groupby"] == ["category"]
        assert result["x_axis"] == "order_date"


class TestMapConfigToFormData:
    """Test map_config_to_form_data function"""

    def test_map_table_config_type(self) -> None:
        """Test mapping table config type"""
        config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="test")])
        result = map_config_to_form_data(config)
        assert result["viz_type"] == "table"

    def test_map_xy_config_type(self) -> None:
        """Test mapping XY config type"""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue")],
            kind="line",
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
            chart_type="table",
            columns=[
                ColumnRef(name="product"),
                ColumnRef(name="revenue"),
            ],
        )

        result = generate_chart_name(config)
        assert result == "Table Chart - product, revenue"

    def test_generate_xy_chart_name(self) -> None:
        """Test generating name for XY chart"""
        config = XYChartConfig(
            chart_type="xy",
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
        from urllib.parse import urlparse

        mock_get_base_url.return_value = "https://superset.example.com"
        form_data = {"viz_type": "table", "metrics": ["count"]}

        # Mock dataset not found to trigger fallback URL
        with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None):
            result = generate_explore_link("123", form_data)

        # Should use the configured base URL - use urlparse to avoid CodeQL warning
        parsed_url = urlparse(result)
        expected_netloc = "superset.example.com"
        assert parsed_url.scheme == "https"
        assert parsed_url.netloc == expected_netloc
        assert "/explore/" in parsed_url.path
        assert "datasource_id=123" in result

    @patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
    def test_generate_explore_link_fallback_url(self, mock_get_base_url) -> None:
        """Test generate_explore_link returns fallback URL when dataset not found"""
        mock_get_base_url.return_value = "http://localhost:9001"
        form_data = {"viz_type": "table"}

        # Mock dataset not found scenario
        with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None):
            result = generate_explore_link("999", form_data)

        assert (
            result
            == "http://localhost:9001/explore/?datasource_type=table&datasource_id=999"
        )

    @patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
    @patch("superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand")
    def test_generate_explore_link_with_form_data_key(
        self, mock_command, mock_get_base_url
    ) -> None:
        """Test generate_explore_link creates form_data_key when dataset exists"""
        mock_get_base_url.return_value = "http://localhost:9001"
        mock_command.return_value.run.return_value = "test_form_data_key"

        # Mock dataset exists
        mock_dataset = type("Dataset", (), {"id": 123})()
        with patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_dataset
        ):
            result = generate_explore_link(123, {"viz_type": "table"})

        assert (
            result == "http://localhost:9001/explore/?form_data_key=test_form_data_key"
        )
        mock_command.assert_called_once()

    @patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
    def test_generate_explore_link_exception_handling(self, mock_get_base_url) -> None:
        """Test generate_explore_link handles SQLAlchemy exceptions gracefully"""
        from sqlalchemy.exc import SQLAlchemyError

        mock_get_base_url.return_value = "http://localhost:9001"

        # Mock SQLAlchemy exception during dataset lookup
        with patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            side_effect=SQLAlchemyError("DB error"),
        ):
            result = generate_explore_link("123", {"viz_type": "table"})

        # Should fallback to basic URL
        assert (
            result
            == "http://localhost:9001/explore/?datasource_type=table&datasource_id=123"
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


class TestIsColumnTrulyTemporal:
    """Test is_column_truly_temporal function using db_engine_spec"""

    def _create_mock_dataset(
        self,
        column_name: str,
        column_type: str,
        generic_type: GenericDataType,
    ):
        """Helper to create a mock dataset with proper db_engine_spec"""
        from unittest.mock import MagicMock

        from superset.utils.core import ColumnSpec

        mock_column = MagicMock()
        mock_column.column_name = column_name
        mock_column.type = column_type

        mock_db_engine_spec = MagicMock()
        mock_column_spec = ColumnSpec(
            sqla_type=MagicMock(), generic_type=generic_type, is_dttm=False
        )
        mock_db_engine_spec.get_column_spec.return_value = mock_column_spec

        mock_database = MagicMock()
        mock_database.db_engine_spec = mock_db_engine_spec

        mock_dataset = MagicMock()
        mock_dataset.columns = [mock_column]
        mock_dataset.database = mock_database

        return mock_dataset

    def test_returns_true_when_no_dataset_id(self) -> None:
        """Test returns True (default) when dataset_id is None"""
        result = is_column_truly_temporal("year", None)
        assert result is True

    @patch("superset.daos.dataset.DatasetDAO")
    def test_returns_true_when_dataset_not_found(self, mock_dao) -> None:
        """Test returns True when dataset is not found"""
        mock_dao.find_by_id.return_value = None
        result = is_column_truly_temporal("year", 123)
        assert result is True

    @patch("superset.daos.dataset.DatasetDAO")
    def test_returns_false_for_numeric_column(self, mock_dao) -> None:
        """Test returns False for NUMERIC generic type (e.g., BIGINT)"""
        mock_dataset = self._create_mock_dataset(
            "year", "BIGINT", GenericDataType.NUMERIC
        )
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("year", 123)
        assert result is False

    @patch("superset.daos.dataset.DatasetDAO")
    def test_returns_false_for_integer_column(self, mock_dao) -> None:
        """Test returns False for INTEGER column (NUMERIC generic type)"""
        mock_dataset = self._create_mock_dataset(
            "month", "INTEGER", GenericDataType.NUMERIC
        )
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("month", 123)
        assert result is False

    @patch("superset.daos.dataset.DatasetDAO")
    def test_returns_true_for_temporal_column(self, mock_dao) -> None:
        """Test returns True for TEMPORAL generic type (e.g., TIMESTAMP)"""
        mock_dataset = self._create_mock_dataset(
            "created_at", "TIMESTAMP", GenericDataType.TEMPORAL
        )
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("created_at", 123)
        assert result is True

    @patch("superset.daos.dataset.DatasetDAO")
    def test_returns_true_for_date_column(self, mock_dao) -> None:
        """Test returns True for DATE column (TEMPORAL generic type)"""
        mock_dataset = self._create_mock_dataset(
            "order_date", "DATE", GenericDataType.TEMPORAL
        )
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("order_date", 123)
        assert result is True

    @patch("superset.daos.dataset.DatasetDAO")
    def test_case_insensitive_column_name_lookup(self, mock_dao) -> None:
        """Test column name lookup is case insensitive"""
        mock_dataset = self._create_mock_dataset(
            "Year", "BIGINT", GenericDataType.NUMERIC
        )
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("year", 123)
        assert result is False

    @patch("superset.daos.dataset.DatasetDAO")
    def test_returns_true_on_value_error(self, mock_dao) -> None:
        """Test returns True (default) when ValueError occurs"""
        mock_dao.find_by_id.side_effect = ValueError("Invalid ID")
        result = is_column_truly_temporal("year", 123)
        assert result is True

    @patch("superset.daos.dataset.DatasetDAO")
    def test_returns_true_on_attribute_error(self, mock_dao) -> None:
        """Test returns True (default) when AttributeError occurs"""
        mock_dao.find_by_id.side_effect = AttributeError("Missing attribute")
        result = is_column_truly_temporal("year", 123)
        assert result is True

    @patch("superset.daos.dataset.DatasetDAO")
    def test_handles_uuid_dataset_id(self, mock_dao) -> None:
        """Test handles UUID string as dataset_id"""
        mock_dataset = self._create_mock_dataset(
            "year", "BIGINT", GenericDataType.NUMERIC
        )
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("year", "abc-123-uuid")
        assert result is False
        mock_dao.find_by_id.assert_called_with("abc-123-uuid", id_column="uuid")

    @patch("superset.daos.dataset.DatasetDAO")
    def test_falls_back_to_is_dttm_when_no_column_spec(self, mock_dao) -> None:
        """Test falls back to is_dttm flag when get_column_spec returns None"""
        from unittest.mock import MagicMock

        mock_column = MagicMock()
        mock_column.column_name = "year"
        mock_column.type = "UNKNOWN_TYPE"
        mock_column.is_dttm = False

        mock_db_engine_spec = MagicMock()
        mock_db_engine_spec.get_column_spec.return_value = None

        mock_database = MagicMock()
        mock_database.db_engine_spec = mock_db_engine_spec

        mock_dataset = MagicMock()
        mock_dataset.columns = [mock_column]
        mock_dataset.database = mock_database
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("year", 123)
        assert result is False

    @patch("superset.daos.dataset.DatasetDAO")
    def test_falls_back_to_is_dttm_when_no_type(self, mock_dao) -> None:
        """Test falls back to is_dttm flag when column has no type"""
        from unittest.mock import MagicMock

        mock_column = MagicMock()
        mock_column.column_name = "year"
        mock_column.type = None
        mock_column.is_dttm = True

        mock_dataset = MagicMock()
        mock_dataset.columns = [mock_column]
        mock_dao.find_by_id.return_value = mock_dataset

        result = is_column_truly_temporal("year", 123)
        assert result is True


class TestConfigureTemporalHandling:
    """Test configure_temporal_handling function"""

    def test_temporal_column_with_time_grain(self) -> None:
        """Test temporal column sets time_grain_sqla"""
        form_data: dict[str, Any] = {}
        configure_temporal_handling(form_data, x_is_temporal=True, time_grain="P1M")
        assert form_data["time_grain_sqla"] == "P1M"

    def test_temporal_column_without_time_grain(self) -> None:
        """Test temporal column without time_grain doesn't set time_grain_sqla"""
        form_data: dict[str, Any] = {}
        configure_temporal_handling(form_data, x_is_temporal=True, time_grain=None)
        assert "time_grain_sqla" not in form_data

    def test_non_temporal_column_sets_categorical_config(self) -> None:
        """Test non-temporal column sets categorical configuration"""
        form_data: dict[str, Any] = {}
        configure_temporal_handling(form_data, x_is_temporal=False, time_grain=None)

        assert form_data["x_axis_sort_series_type"] == "name"
        assert form_data["x_axis_sort_series_ascending"] is True
        assert form_data["time_grain_sqla"] is None
        assert form_data["granularity_sqla"] is None

    def test_non_temporal_column_ignores_time_grain(self) -> None:
        """Test non-temporal column ignores time_grain parameter"""
        form_data: dict[str, Any] = {}
        configure_temporal_handling(form_data, x_is_temporal=False, time_grain="P1M")

        # Should still set categorical config, not time_grain
        assert form_data["time_grain_sqla"] is None
        assert form_data["x_axis_sort_series_type"] == "name"


class TestMapXYConfigWithNonTemporalColumn:
    """Test map_xy_config with non-temporal columns (DATE_TRUNC fix)"""

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_non_temporal_column_disables_time_grain(self, mock_is_temporal) -> None:
        """Test non-temporal column sets categorical config"""
        mock_is_temporal.return_value = False

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="year"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
        )

        result = map_xy_config(config, dataset_id=123)

        assert result["x_axis"] == "year"
        assert result["x_axis_sort_series_type"] == "name"
        assert result["x_axis_sort_series_ascending"] is True
        assert result["time_grain_sqla"] is None
        assert result["granularity_sqla"] is None

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_temporal_column_allows_time_grain(self, mock_is_temporal) -> None:
        """Test temporal column allows time_grain to be set"""
        mock_is_temporal.return_value = True

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="created_at"),
            y=[ColumnRef(name="count", aggregate="COUNT")],
            kind="line",
            time_grain="P1W",
        )

        result = map_xy_config(config, dataset_id=123)

        assert result["x_axis"] == "created_at"
        assert result["time_grain_sqla"] == "P1W"
        assert "x_axis_sort_series_type" not in result

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_non_temporal_ignores_time_grain_param(self, mock_is_temporal) -> None:
        """Test non-temporal column ignores time_grain even if specified"""
        mock_is_temporal.return_value = False

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="year"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
            time_grain="P1M",  # This should be ignored for non-temporal
        )

        result = map_xy_config(config, dataset_id=123)

        # time_grain_sqla should be None, not P1M
        assert result["time_grain_sqla"] is None
        assert result["x_axis_sort_series_type"] == "name"


class TestFilterConfigValidation:
    """Test FilterConfig validation for new operators"""

    def test_like_operator_with_wildcard(self) -> None:
        """Test LIKE operator accepts string with % wildcards"""
        f = FilterConfig(column="name", op="LIKE", value="%mario%")
        assert f.op == "LIKE"
        assert f.value == "%mario%"

    def test_ilike_operator(self) -> None:
        """Test ILIKE operator accepts string value"""
        f = FilterConfig(column="name", op="ILIKE", value="%Mario%")
        assert f.op == "ILIKE"
        assert f.value == "%Mario%"

    def test_not_like_operator(self) -> None:
        """Test NOT LIKE operator accepts string value"""
        f = FilterConfig(column="name", op="NOT LIKE", value="%test%")
        assert f.op == "NOT LIKE"

    def test_in_operator_with_list(self) -> None:
        """Test IN operator accepts list of values"""
        f = FilterConfig(column="platform", op="IN", value=["Wii", "PS3", "Xbox360"])
        assert f.op == "IN"
        assert f.value == ["Wii", "PS3", "Xbox360"]

    def test_not_in_operator_with_list(self) -> None:
        """Test NOT IN operator accepts list of values"""
        f = FilterConfig(column="status", op="NOT IN", value=["archived", "deleted"])
        assert f.op == "NOT IN"
        assert f.value == ["archived", "deleted"]

    def test_in_operator_rejects_scalar_value(self) -> None:
        """Test IN operator rejects non-list value"""
        with pytest.raises(ValueError, match="requires a list of values"):
            FilterConfig(column="platform", op="IN", value="Wii")

    def test_not_in_operator_rejects_scalar_value(self) -> None:
        """Test NOT IN operator rejects non-list value"""
        with pytest.raises(ValueError, match="requires a list of values"):
            FilterConfig(column="status", op="NOT IN", value="active")

    def test_equals_operator_rejects_list_value(self) -> None:
        """Test = operator rejects list value"""
        with pytest.raises(ValueError, match="requires a single value, not a list"):
            FilterConfig(column="name", op="=", value=["a", "b"])

    def test_like_operator_rejects_list_value(self) -> None:
        """Test LIKE operator rejects list value"""
        with pytest.raises(ValueError, match="requires a single value, not a list"):
            FilterConfig(column="name", op="LIKE", value=["%a%", "%b%"])

    def test_in_operator_with_numeric_list(self) -> None:
        """Test IN operator with numeric values"""
        f = FilterConfig(column="year", op="IN", value=[2020, 2021, 2022])
        assert f.value == [2020, 2021, 2022]

    def test_in_operator_with_empty_list(self) -> None:
        """Test IN operator with empty list"""
        f = FilterConfig(column="platform", op="IN", value=[])
        assert f.value == []
