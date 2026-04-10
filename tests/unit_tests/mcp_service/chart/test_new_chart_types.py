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
Unit tests for new MCP chart types: pie, pivot_table, mixed_timeseries.

Tests cover schema validation, form_data mapping, chart name generation,
and schema validator pre-validation for all three new chart types.
"""

from typing import Any
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.chart_utils import (
    generate_chart_name,
    map_config_to_form_data,
    map_mixed_timeseries_config,
    map_pie_config,
    map_pivot_table_config,
)
from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
)
from superset.mcp_service.chart.validation.schema_validator import SchemaValidator

# ============================================================
# Pie Chart Schema Tests
# ============================================================


class TestPieChartConfigSchema:
    """Test PieChartConfig Pydantic schema validation."""

    def test_basic_pie_config(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="product"),
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        assert config.chart_type == "pie"
        assert config.dimension.name == "product"
        assert config.metric.aggregate == "SUM"
        assert config.donut is False
        assert config.show_labels is True
        assert config.label_type == "key_value_percent"

    def test_donut_chart_config(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="category"),
            metric=ColumnRef(name="count", aggregate="COUNT"),
            donut=True,
            inner_radius=40,
            outer_radius=80,
        )
        assert config.donut is True
        assert config.inner_radius == 40
        assert config.outer_radius == 80

    def test_pie_config_with_all_options(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="region"),
            metric=ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            donut=True,
            show_labels=False,
            label_type="percent",
            sort_by_metric=False,
            show_legend=False,
            row_limit=50,
            number_format="$,.2f",
            show_total=True,
            labels_outside=False,
            outer_radius=90,
            inner_radius=50,
            filters=[FilterConfig(column="status", op="=", value="active")],
        )
        assert config.show_labels is False
        assert config.label_type == "percent"
        assert config.row_limit == 50
        assert config.show_total is True
        assert config.filters is not None
        assert len(config.filters) == 1

    def test_pie_config_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError, match="Unknown field"):
            PieChartConfig(
                chart_type="pie",
                dimension=ColumnRef(name="product"),
                metric=ColumnRef(name="revenue", aggregate="SUM"),
                unknown_field="bad",
            )

    def test_pie_config_missing_dimension(self) -> None:
        with pytest.raises(ValidationError):
            PieChartConfig(
                chart_type="pie",
                metric=ColumnRef(name="revenue", aggregate="SUM"),
            )

    def test_pie_config_missing_metric(self) -> None:
        with pytest.raises(ValidationError):
            PieChartConfig(
                chart_type="pie",
                dimension=ColumnRef(name="product"),
            )

    def test_pie_config_row_limit_bounds(self) -> None:
        with pytest.raises(ValidationError):
            PieChartConfig(
                chart_type="pie",
                dimension=ColumnRef(name="product"),
                metric=ColumnRef(name="revenue", aggregate="SUM"),
                row_limit=0,
            )

    def test_pie_config_valid_label_types(self) -> None:
        for label_type in [
            "key",
            "value",
            "percent",
            "key_value",
            "key_percent",
            "key_value_percent",
            "value_percent",
        ]:
            config = PieChartConfig(
                chart_type="pie",
                dimension=ColumnRef(name="product"),
                metric=ColumnRef(name="revenue", aggregate="SUM"),
                label_type=label_type,
            )
            assert config.label_type == label_type


# ============================================================
# Pie Chart Form Data Mapping Tests
# ============================================================


class TestMapPieConfig:
    """Test map_pie_config form_data generation."""

    def test_basic_pie_form_data(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="product"),
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        result = map_pie_config(config)

        assert result["viz_type"] == "pie"
        assert result["groupby"] == ["product"]
        assert result["metric"]["aggregate"] == "SUM"
        assert result["metric"]["column"]["column_name"] == "revenue"
        assert result["show_labels"] is True
        assert result["show_legend"] is True
        assert result["label_type"] == "key_value_percent"
        assert result["sort_by_metric"] is True
        assert result["row_limit"] == 100
        assert result["donut"] is False
        assert result["color_scheme"] == "supersetColors"

    def test_donut_form_data(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="category"),
            metric=ColumnRef(name="count", aggregate="COUNT"),
            donut=True,
            inner_radius=40,
            outer_radius=80,
        )
        result = map_pie_config(config)

        assert result["donut"] is True
        assert result["innerRadius"] == 40
        assert result["outerRadius"] == 80

    def test_pie_form_data_with_filters(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="product"),
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            filters=[FilterConfig(column="region", op="=", value="US")],
        )
        result = map_pie_config(config)

        assert "adhoc_filters" in result
        assert len(result["adhoc_filters"]) == 1
        assert result["adhoc_filters"][0]["subject"] == "region"
        assert result["adhoc_filters"][0]["operator"] == "=="
        assert result["adhoc_filters"][0]["comparator"] == "US"

    def test_pie_form_data_custom_options(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="status"),
            metric=ColumnRef(name="count", aggregate="COUNT"),
            show_labels=False,
            label_type="percent",
            show_legend=False,
            number_format="$,.2f",
            show_total=True,
            labels_outside=False,
        )
        result = map_pie_config(config)

        assert result["show_labels"] is False
        assert result["label_type"] == "percent"
        assert result["show_legend"] is False
        assert result["number_format"] == "$,.2f"
        assert result["show_total"] is True
        assert result["labels_outside"] is False

    def test_pie_form_data_custom_metric_label(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="product"),
            metric=ColumnRef(name="revenue", aggregate="SUM", label="Total Revenue"),
        )
        result = map_pie_config(config)

        assert result["metric"]["label"] == "Total Revenue"
        assert result["metric"]["hasCustomLabel"] is True


# ============================================================
# Pivot Table Schema Tests
# ============================================================


class TestPivotTableChartConfigSchema:
    """Test PivotTableChartConfig Pydantic schema validation."""

    def test_basic_pivot_table_config(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
        )
        assert config.chart_type == "pivot_table"
        assert len(config.rows) == 1
        assert len(config.metrics) == 1
        assert config.aggregate_function == "Sum"
        assert config.show_row_totals is True
        assert config.show_column_totals is True

    def test_pivot_table_with_columns(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            columns=[ColumnRef(name="region")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
        )
        assert config.columns is not None
        assert len(config.columns) == 1
        assert config.columns[0].name == "region"

    def test_pivot_table_with_all_options(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product"), ColumnRef(name="category")],
            columns=[ColumnRef(name="region")],
            metrics=[
                ColumnRef(name="revenue", aggregate="SUM"),
                ColumnRef(name="orders", aggregate="COUNT"),
            ],
            aggregate_function="Average",
            show_row_totals=False,
            show_column_totals=False,
            transpose=True,
            combine_metric=True,
            row_limit=5000,
            value_format="$,.2f",
            filters=[FilterConfig(column="year", op="=", value=2024)],
        )
        assert config.aggregate_function == "Average"
        assert config.show_row_totals is False
        assert config.transpose is True
        assert config.combine_metric is True
        assert config.row_limit == 5000

    def test_pivot_table_missing_rows(self) -> None:
        with pytest.raises(ValidationError):
            PivotTableChartConfig(
                chart_type="pivot_table",
                metrics=[ColumnRef(name="revenue", aggregate="SUM")],
            )

    def test_pivot_table_missing_metrics(self) -> None:
        with pytest.raises(ValidationError):
            PivotTableChartConfig(
                chart_type="pivot_table",
                rows=[ColumnRef(name="product")],
            )

    def test_pivot_table_empty_rows(self) -> None:
        with pytest.raises(ValidationError):
            PivotTableChartConfig(
                chart_type="pivot_table",
                rows=[],
                metrics=[ColumnRef(name="revenue", aggregate="SUM")],
            )

    def test_pivot_table_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError, match="Unknown field"):
            PivotTableChartConfig(
                chart_type="pivot_table",
                rows=[ColumnRef(name="product")],
                metrics=[ColumnRef(name="revenue", aggregate="SUM")],
                unknown_field="bad",
            )

    def test_pivot_table_valid_aggregate_functions(self) -> None:
        for agg in ["Sum", "Average", "Median", "Count", "Minimum", "Maximum"]:
            config = PivotTableChartConfig(
                chart_type="pivot_table",
                rows=[ColumnRef(name="product")],
                metrics=[ColumnRef(name="revenue", aggregate="SUM")],
                aggregate_function=agg,
            )
            assert config.aggregate_function == agg


# ============================================================
# Pivot Table Form Data Mapping Tests
# ============================================================


class TestMapPivotTableConfig:
    """Test map_pivot_table_config form_data generation."""

    def test_basic_pivot_form_data(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
        )
        result = map_pivot_table_config(config)

        assert result["viz_type"] == "pivot_table_v2"
        assert result["groupbyRows"] == ["product"]
        assert result["groupbyColumns"] == []
        assert len(result["metrics"]) == 1
        assert result["metrics"][0]["aggregate"] == "SUM"
        assert result["aggregateFunction"] == "Sum"
        assert result["rowTotals"] is True
        assert result["colTotals"] is True
        assert result["metricsLayout"] == "COLUMNS"

    def test_pivot_form_data_with_columns(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            columns=[ColumnRef(name="region"), ColumnRef(name="quarter")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
        )
        result = map_pivot_table_config(config)

        assert result["groupbyRows"] == ["product"]
        assert result["groupbyColumns"] == ["region", "quarter"]

    def test_pivot_form_data_with_filters(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
            filters=[FilterConfig(column="year", op="=", value=2024)],
        )
        result = map_pivot_table_config(config)

        assert "adhoc_filters" in result
        assert len(result["adhoc_filters"]) == 1
        assert result["adhoc_filters"][0]["subject"] == "year"

    def test_pivot_form_data_custom_options(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
            aggregate_function="Average",
            show_row_totals=False,
            show_column_totals=False,
            transpose=True,
            combine_metric=True,
            value_format="$,.2f",
        )
        result = map_pivot_table_config(config)

        assert result["aggregateFunction"] == "Average"
        assert result["rowTotals"] is False
        assert result["colTotals"] is False
        assert result["transposePivot"] is True
        assert result["combineMetric"] is True
        assert result["valueFormat"] == "$,.2f"

    def test_pivot_form_data_multiple_metrics(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            metrics=[
                ColumnRef(name="revenue", aggregate="SUM", label="Total Revenue"),
                ColumnRef(name="orders", aggregate="COUNT", label="Order Count"),
            ],
        )
        result = map_pivot_table_config(config)

        assert len(result["metrics"]) == 2
        assert result["metrics"][0]["label"] == "Total Revenue"
        assert result["metrics"][1]["label"] == "Order Count"


# ============================================================
# Mixed Timeseries Schema Tests
# ============================================================


class TestMixedTimeseriesChartConfigSchema:
    """Test MixedTimeseriesChartConfig Pydantic schema validation."""

    def test_basic_mixed_timeseries_config(self) -> None:
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        assert config.chart_type == "mixed_timeseries"
        assert config.x.name == "order_date"
        assert config.primary_kind == "line"
        assert config.secondary_kind == "bar"
        assert config.show_legend is True

    def test_mixed_timeseries_with_all_options(self) -> None:
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            time_grain="P1M",
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            primary_kind="area",
            group_by=[ColumnRef(name="region")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            secondary_kind="scatter",
            group_by_secondary=[ColumnRef(name="channel")],
            show_legend=False,
            x_axis=AxisConfig(title="Date"),
            y_axis=AxisConfig(title="Revenue", format="$,.2f"),
            y_axis_secondary=AxisConfig(title="Orders", scale="log"),
            filters=[FilterConfig(column="status", op="=", value="complete")],
        )
        assert config.primary_kind == "area"
        assert config.secondary_kind == "scatter"
        assert config.time_grain == "P1M"
        assert config.group_by is not None
        assert config.group_by[0].name == "region"
        assert config.group_by_secondary is not None
        assert config.group_by_secondary[0].name == "channel"

    def test_mixed_timeseries_missing_y(self) -> None:
        with pytest.raises(ValidationError):
            MixedTimeseriesChartConfig(
                chart_type="mixed_timeseries",
                x=ColumnRef(name="date"),
                y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            )

    def test_mixed_timeseries_missing_y_secondary(self) -> None:
        with pytest.raises(ValidationError):
            MixedTimeseriesChartConfig(
                chart_type="mixed_timeseries",
                x=ColumnRef(name="date"),
                y=[ColumnRef(name="revenue", aggregate="SUM")],
            )

    def test_mixed_timeseries_empty_y(self) -> None:
        with pytest.raises(ValidationError):
            MixedTimeseriesChartConfig(
                chart_type="mixed_timeseries",
                x=ColumnRef(name="date"),
                y=[],
                y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            )

    def test_mixed_timeseries_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError, match="Unknown field"):
            MixedTimeseriesChartConfig(
                chart_type="mixed_timeseries",
                x=ColumnRef(name="date"),
                y=[ColumnRef(name="revenue", aggregate="SUM")],
                y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
                unknown_field="bad",
            )

    def test_mixed_timeseries_default_row_limit(self) -> None:
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        assert config.row_limit == 10000

    def test_mixed_timeseries_custom_row_limit(self) -> None:
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            row_limit=500,
        )
        assert config.row_limit == 500


# ============================================================
# Mixed Timeseries Form Data Mapping Tests
# ============================================================


class TestMapMixedTimeseriesConfig:
    """Test map_mixed_timeseries_config form_data generation."""

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_basic_mixed_form_data(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["viz_type"] == "mixed_timeseries"
        assert result["x_axis"] == "order_date"
        assert len(result["metrics"]) == 1
        assert result["metrics"][0]["aggregate"] == "SUM"
        assert len(result["metrics_b"]) == 1
        assert result["metrics_b"][0]["aggregate"] == "COUNT"
        assert result["seriesType"] == "line"
        assert result["seriesTypeB"] == "bar"
        assert result["yAxisIndex"] == 0
        assert result["yAxisIndexB"] == 1
        assert result["show_legend"] is True

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_with_time_grain(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            time_grain="P1W",
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["time_grain_sqla"] == "P1W"

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_area_series(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            primary_kind="area",
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            secondary_kind="area",
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["seriesType"] == "line"
        assert result["area"] is True
        assert result["seriesTypeB"] == "line"
        assert result["areaB"] is True

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_with_groupby(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            group_by=[ColumnRef(name="region")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            group_by_secondary=[ColumnRef(name="channel")],
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["groupby"] == ["region"]
        assert result["groupby_b"] == ["channel"]

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_groupby_same_as_x_ignored(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            group_by=[ColumnRef(name="date")],  # same as x
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            group_by_secondary=[ColumnRef(name="date")],  # same as x
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert "groupby" not in result
        assert "groupby_b" not in result

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_with_axis_config(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            x_axis=AxisConfig(title="Date"),
            y_axis=AxisConfig(title="Revenue", format="$,.2f", scale="log"),
            y_axis_secondary=AxisConfig(title="Orders", format=",d", scale="log"),
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["xAxisTitle"] == "Date"
        assert result["yAxisTitle"] == "Revenue"
        assert result["y_axis_format"] == "$,.2f"
        assert result["logAxis"] is True
        assert result["yAxisTitleSecondary"] == "Orders"
        assert result["y_axis_format_secondary"] == ",d"
        assert result["logAxisSecondary"] is True

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_row_limit(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            row_limit=300,
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["row_limit"] == 300

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_default_row_limit(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["row_limit"] == 10000

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_with_filters(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            filters=[FilterConfig(column="status", op="=", value="complete")],
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert "adhoc_filters" in result
        assert len(result["adhoc_filters"]) == 1

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_mixed_form_data_non_temporal_x(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = False

        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="year"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        result = map_mixed_timeseries_config(config, dataset_id=1)

        assert result["time_grain_sqla"] is None
        assert result["granularity_sqla"] is None
        assert result["x_axis_sort_series_type"] == "name"


# ============================================================
# map_config_to_form_data Dispatch Tests
# ============================================================


class TestMapConfigToFormDataDispatch:
    """Test map_config_to_form_data dispatches to correct mapping function."""

    def test_dispatches_pie_config(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="product"),
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        result = map_config_to_form_data(config)
        assert result["viz_type"] == "pie"

    def test_dispatches_pivot_table_config(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
        )
        result = map_config_to_form_data(config)
        assert result["viz_type"] == "pivot_table_v2"

    @patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
    def test_dispatches_mixed_timeseries_config(self, mock_is_temporal) -> None:
        mock_is_temporal.return_value = True
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        result = map_config_to_form_data(config, dataset_id=1)
        assert result["viz_type"] == "mixed_timeseries"


# ============================================================
# Chart Name Generation Tests
# ============================================================


class TestGenerateChartNameNewTypes:
    """Test generate_chart_name for new chart types."""

    def test_pie_chart_name(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="product"),
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        result = generate_chart_name(config)
        assert result == "product by revenue"

    def test_pie_chart_name_with_custom_label(self) -> None:
        config = PieChartConfig(
            chart_type="pie",
            dimension=ColumnRef(name="product"),
            metric=ColumnRef(name="revenue", aggregate="SUM", label="Total Revenue"),
        )
        result = generate_chart_name(config)
        assert result == "product by Total Revenue"

    def test_pivot_table_chart_name(self) -> None:
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[ColumnRef(name="product"), ColumnRef(name="region")],
            metrics=[ColumnRef(name="revenue", aggregate="SUM")],
        )
        result = generate_chart_name(config)
        assert result == "Pivot Table \u2013 product, region"

    def test_mixed_timeseries_chart_name(self) -> None:
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        )
        result = generate_chart_name(config)
        assert result == "revenue + orders"


# ============================================================
# Schema Validator Pre-Validation Tests
# ============================================================


class TestSchemaValidatorNewTypes:
    """Test SchemaValidator pre-validation for new chart types."""

    def test_pie_chart_type_accepted(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "pie",
                "dimension": {"name": "product"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert error is None

    def test_pivot_table_chart_type_accepted(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "pivot_table",
                "rows": [{"name": "product"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert error is None

    def test_mixed_timeseries_chart_type_accepted(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "mixed_timeseries",
                "x": {"name": "date"},
                "y": [{"name": "revenue", "aggregate": "SUM"}],
                "y_secondary": [{"name": "orders", "aggregate": "COUNT"}],
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert error is None

    def test_pie_missing_dimension_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "pie",
                "metric": {"name": "revenue", "aggregate": "SUM"},
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert (
            "dimension" in error.message.lower()
            or "dimension" in (error.details or "").lower()
        )

    def test_pie_missing_metric_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "pie",
                "dimension": {"name": "product"},
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None

    def test_pivot_table_missing_rows_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "pivot_table",
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert (
            "rows" in error.message.lower() or "rows" in (error.details or "").lower()
        )

    def test_pivot_table_missing_metrics_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "pivot_table",
                "rows": [{"name": "product"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None

    def test_mixed_timeseries_missing_y_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "mixed_timeseries",
                "x": {"name": "date"},
                "y_secondary": [{"name": "orders", "aggregate": "COUNT"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None

    def test_mixed_timeseries_missing_y_secondary_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "mixed_timeseries",
                "x": {"name": "date"},
                "y": [{"name": "revenue", "aggregate": "SUM"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None

    def test_mixed_timeseries_missing_x_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "mixed_timeseries",
                "y": [{"name": "revenue", "aggregate": "SUM"}],
                "y_secondary": [{"name": "orders", "aggregate": "COUNT"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None

    def test_invalid_chart_type_lists_all_options(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "invalid_type",
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert "pie" in (error.details or "").lower()
        assert "pivot_table" in (error.details or "").lower()
        assert "mixed_timeseries" in (error.details or "").lower()

    @pytest.mark.parametrize(
        "bad_chart_type",
        [["xy"], {"type": "xy"}, 123, True],
    )
    def test_non_string_chart_type_rejected_gracefully(
        self, bad_chart_type: object
    ) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": bad_chart_type,
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_CHART_TYPE"


# ============================================================
# adhoc_filters detection tests  (sc-103356)
# ============================================================


class TestAdhocFiltersDetection:
    """Tests for sc-103356: generate_chart should surface a clear error when
    adhoc_filters is passed in the config instead of silently dropping it."""

    @pytest.mark.parametrize(
        "chart_type,extra_fields",
        [
            (
                "xy",
                {"x": {"name": "date"}, "y": [{"name": "rev", "aggregate": "SUM"}]},
            ),
            (
                "table",
                {"columns": [{"name": "product"}]},
            ),
            (
                "pie",
                {
                    "dimension": {"name": "region"},
                    "metric": {"name": "rev", "aggregate": "SUM"},
                },
            ),
            (
                "pivot_table",
                {
                    "rows": [{"name": "region"}],
                    "metrics": [{"name": "rev", "aggregate": "SUM"}],
                },
            ),
            (
                "mixed_timeseries",
                {
                    "x": {"name": "date"},
                    "y": [{"name": "rev", "aggregate": "SUM"}],
                    "y_secondary": [{"name": "cnt", "aggregate": "COUNT"}],
                },
            ),
        ],
    )
    def test_adhoc_filters_in_config_returns_clear_error(
        self, chart_type: str, extra_fields: dict[str, Any]
    ) -> None:
        """adhoc_filters in config must be rejected with UNSUPPORTED_ADHOC_FILTERS."""
        config = {
            "chart_type": chart_type,
            **extra_fields,
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "region",
                    "operator": "==",
                    "comparator": "US",
                    "clause": "WHERE",
                }
            ],
        }
        data = {"dataset_id": 1, "config": config}
        is_valid, _, error = SchemaValidator.validate_request(data)

        assert is_valid is False
        assert error is not None
        assert error.error_code == "UNSUPPORTED_ADHOC_FILTERS"
        assert "adhoc_filters" in error.message
        assert "filters" in (error.details or "")
        # Suggestions must guide callers towards the correct field
        assert error.suggestions is not None
        assert any("filters" in s for s in error.suggestions)

    def test_adhoc_filters_empty_list_still_rejected(self) -> None:
        """An empty adhoc_filters list should also be rejected."""
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "xy",
                "x": {"name": "date"},
                "y": [{"name": "rev", "aggregate": "SUM"}],
                "adhoc_filters": [],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)

        assert is_valid is False
        assert error is not None
        assert error.error_code == "UNSUPPORTED_ADHOC_FILTERS"

    def test_filters_field_still_accepted(self) -> None:
        """The proper 'filters' field must continue to work after the fix."""
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "xy",
                "x": {"name": "date"},
                "y": [{"name": "rev", "aggregate": "SUM"}],
                "filters": [{"column": "region", "op": "=", "value": "US"}],
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)

        assert is_valid is True
        assert error is None
        assert request is not None
        # config is stored as a raw dict in GenerateChartRequest
        assert isinstance(request.config, dict)
        assert request.config.get("filters") is not None
        assert len(request.config["filters"]) == 1
        assert request.config["filters"][0]["column"] == "region"
