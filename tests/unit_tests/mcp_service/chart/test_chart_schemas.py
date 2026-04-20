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
Unit tests for MCP chart schema validation.
"""

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    GenerateChartRequest,
    parse_chart_config,
    TableChartConfig,
    XYChartConfig,
)


class TestTableChartConfig:
    """Test TableChartConfig validation."""

    def test_duplicate_labels_rejected(self) -> None:
        """Test that TableChartConfig rejects duplicate labels."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            TableChartConfig(
                chart_type="table",
                columns=[
                    ColumnRef(name="product_line", label="product_line"),
                    ColumnRef(name="sales", aggregate="SUM", label="product_line"),
                ],
            )

    def test_unique_labels_accepted(self) -> None:
        """Test that TableChartConfig accepts unique labels."""
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="product_line", label="Product Line"),
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ],
        )
        assert len(config.columns) == 2

    def test_default_viz_type_is_table(self) -> None:
        """Test that default viz_type is 'table'."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="product")],
        )
        assert config.viz_type == "table"

    def test_ag_grid_table_viz_type_accepted(self) -> None:
        """Test that viz_type='ag-grid-table' is accepted for AG Grid table."""
        config = TableChartConfig(
            chart_type="table",
            viz_type="ag-grid-table",
            columns=[
                ColumnRef(name="product_line"),
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ],
        )
        assert config.viz_type == "ag-grid-table"
        assert len(config.columns) == 2

    def test_ag_grid_table_with_all_options(self) -> None:
        """Test AG Grid table with filters and sorting."""
        from superset.mcp_service.chart.schemas import FilterConfig

        config = TableChartConfig(
            chart_type="table",
            viz_type="ag-grid-table",
            columns=[
                ColumnRef(name="product_line"),
                ColumnRef(name="quantity", aggregate="SUM", label="Total Quantity"),
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ],
            filters=[FilterConfig(column="status", op="=", value="active")],
            sort_by=["product_line"],
        )
        assert config.viz_type == "ag-grid-table"
        assert len(config.columns) == 3
        assert config.filters is not None
        assert len(config.filters) == 1
        assert config.sort_by == ["product_line"]

    def test_invalid_viz_type_rejected(self) -> None:
        """Test that invalid viz_type values are rejected."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TableChartConfig(
                chart_type="table",
                viz_type="invalid-type",
                columns=[ColumnRef(name="product")],
            )

    def test_explicit_raw_query_mode_accepted(self) -> None:
        """Test that TableChartConfig accepts explicit query_mode='raw'."""
        config = TableChartConfig(
            chart_type="table",
            query_mode="raw",
            columns=[ColumnRef(name="product"), ColumnRef(name="category")],
        )
        assert config.query_mode == "raw"
        assert len(config.columns) == 2

    def test_explicit_aggregate_query_mode_accepted(self) -> None:
        """Test that TableChartConfig accepts explicit query_mode='aggregate'."""
        config = TableChartConfig(
            chart_type="table",
            query_mode="aggregate",
            columns=[ColumnRef(name="sales", aggregate="SUM")],
        )
        assert config.query_mode == "aggregate"

    def test_default_query_mode_is_none(self) -> None:
        """Test that default query_mode is None (auto-detect)."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="product")],
        )
        assert config.query_mode is None

    def test_invalid_query_mode_rejected(self) -> None:
        """Test that invalid query_mode values are rejected."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TableChartConfig(
                chart_type="table",
                query_mode="invalid",
                columns=[ColumnRef(name="product")],
            )


class TestXYChartConfig:
    """Test XYChartConfig validation."""

    def test_different_labels_accepted(self) -> None:
        """Test that different labels for x and y are accepted."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="product_line"),  # Label: "product_line"
            y=[
                ColumnRef(
                    name="product_line", aggregate="COUNT"
                ),  # Label: "COUNT(product_line)"
            ],
        )
        assert config.x.name == "product_line"
        assert config.y[0].aggregate == "COUNT"

    def test_explicit_duplicate_label_rejected(self) -> None:
        """Test that explicit duplicate labels are rejected."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="product_line"),
                y=[ColumnRef(name="sales", label="product_line")],
            )

    def test_duplicate_y_axis_labels_rejected(self) -> None:
        """Test that duplicate y-axis labels are rejected."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="date"),
                y=[
                    ColumnRef(name="sales", aggregate="SUM"),
                    ColumnRef(name="revenue", aggregate="SUM", label="SUM(sales)"),
                ],
            )

    def test_unique_labels_accepted(self) -> None:
        """Test that unique labels are accepted."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date", label="Order Date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="profit", aggregate="AVG", label="Average Profit"),
            ],
        )
        assert len(config.y) == 2

    def test_group_by_duplicate_label_with_x_rejected(self) -> None:
        """Test that group_by with a custom label conflicting with x is rejected."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="region"),
                y=[ColumnRef(name="sales", aggregate="SUM")],
                group_by=[ColumnRef(name="category", label="region")],
            )

    def test_group_by_same_column_as_x_allowed(self) -> None:
        """Test that group_by with the same column name as x is allowed.

        The mapping layer filters these out, so validation should not reject them.
        """
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
            group_by=[ColumnRef(name="date")],
        )
        assert config.group_by is not None
        assert config.group_by[0].name == "date"

    def test_realistic_chart_configurations(self) -> None:
        """Test realistic chart configurations."""
        # This should work - COUNT(product_line) != product_line
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="product_line"),
            y=[
                ColumnRef(name="product_line", aggregate="COUNT"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        )
        assert config.x.name == "product_line"
        assert len(config.y) == 2

    def test_time_series_chart_configuration(self) -> None:
        """Test time series chart configuration works."""
        # This should PASS now - the chart creation logic fixes duplicates
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="price_each", aggregate="AVG", label="Avg Price"),
            ],
            kind="line",
        )
        assert config.x.name == "order_date"
        assert config.kind == "line"

    def test_time_series_with_custom_x_axis_label(self) -> None:
        """Test time series chart with custom x-axis label."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date", label="Order Date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="price_each", aggregate="AVG", label="Avg Price"),
            ],
            kind="line",
        )
        assert config.x.label == "Order Date"

    def test_area_chart_configuration(self) -> None:
        """Test area chart configuration."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="category"),
            y=[ColumnRef(name="sales", aggregate="SUM", label="Total Sales")],
            kind="area",
        )
        assert config.kind == "area"

    def test_unknown_fields_raise_error(self) -> None:
        """Test that unknown fields raise ValueError with suggestions."""
        with pytest.raises(ValidationError, match="Unknown field"):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="territory"),
                y=[ColumnRef(name="sales", aggregate="SUM")],
                kind="bar",
                unknown_field="bad",
            )

    def test_series_alias_accepted(self) -> None:
        """Test that 'series' is accepted as alias for 'group_by'."""
        config = XYChartConfig.model_validate(
            {
                "chart_type": "xy",
                "x": {"name": "territory"},
                "y": [{"name": "sales", "aggregate": "SUM"}],
                "kind": "bar",
                "series": {"name": "year"},
            }
        )
        assert config.group_by is not None
        assert config.group_by[0].name == "year"

    def test_group_by_accepted(self) -> None:
        """Test that group_by accepts a single ColumnRef (auto-wrapped in list)."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="territory"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
            group_by=ColumnRef(name="year"),
        )
        assert config.group_by is not None
        assert len(config.group_by) == 1
        assert config.group_by[0].name == "year"

    def test_group_by_multiple(self) -> None:
        """Test that group_by accepts a list of ColumnRefs."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="territory"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
            group_by=[ColumnRef(name="year"), ColumnRef(name="region")],
        )
        assert config.group_by is not None
        assert len(config.group_by) == 2

    def test_group_by_bare_string(self) -> None:
        """Test that group_by accepts a bare string (auto-wrapped)."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="territory"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
            group_by="region",
        )
        assert config.group_by is not None
        assert len(config.group_by) == 1
        assert config.group_by[0].name == "region"

    def test_orientation_horizontal_accepted(self) -> None:
        """Test that orientation='horizontal' is accepted for bar charts."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="department"),
            y=[ColumnRef(name="headcount", aggregate="SUM")],
            kind="bar",
            orientation="horizontal",
        )
        assert config.orientation == "horizontal"

    def test_orientation_vertical_accepted(self) -> None:
        """Test that orientation='vertical' is accepted for bar charts."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="category"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
            orientation="vertical",
        )
        assert config.orientation == "vertical"

    def test_orientation_none_by_default(self) -> None:
        """Test that orientation defaults to None when not specified."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="category"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="bar",
        )
        assert config.orientation is None

    def test_orientation_invalid_value_rejected(self) -> None:
        """Test that invalid orientation values are rejected."""
        with pytest.raises(ValidationError):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="category"),
                y=[ColumnRef(name="sales", aggregate="SUM")],
                kind="bar",
                orientation="diagonal",
            )

    def test_orientation_with_non_bar_chart(self) -> None:
        """Test that orientation field is accepted on non-bar charts at schema level."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            kind="line",
            orientation="horizontal",
        )
        # Schema allows it; the chart_utils layer decides whether to apply it
        assert config.orientation == "horizontal"


class TestRowLimit:
    """Test row_limit field on chart configs."""

    def test_xy_chart_default_row_limit(self) -> None:
        """Test that XYChartConfig has default row_limit of 10000."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
        )
        assert config.row_limit == 10000

    def test_xy_chart_custom_row_limit(self) -> None:
        """Test that XYChartConfig accepts custom row_limit."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            row_limit=100,
        )
        assert config.row_limit == 100

    def test_xy_chart_row_limit_validation(self) -> None:
        """Test that XYChartConfig rejects invalid row_limit."""
        with pytest.raises(ValidationError):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="date"),
                y=[ColumnRef(name="revenue", aggregate="SUM")],
                row_limit=0,
            )
        with pytest.raises(ValidationError):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="date"),
                y=[ColumnRef(name="revenue", aggregate="SUM")],
                row_limit=100000,
            )

    def test_table_chart_default_row_limit(self) -> None:
        """Test that TableChartConfig has default row_limit of 1000."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="product")],
        )
        assert config.row_limit == 1000

    def test_table_chart_custom_row_limit(self) -> None:
        """Test that TableChartConfig accepts custom row_limit."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="product")],
            row_limit=500,
        )
        assert config.row_limit == 500

    def test_table_chart_row_limit_validation(self) -> None:
        """Test that TableChartConfig rejects invalid row_limit."""
        with pytest.raises(ValidationError):
            TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="product")],
                row_limit=0,
            )
        with pytest.raises(ValidationError):
            TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="product")],
                row_limit=100000,
            )


class TestTableChartConfigExtraFields:
    """Test TableChartConfig rejects unknown fields."""

    def test_unknown_fields_raise_error(self) -> None:
        """Test that unknown fields raise ValueError with valid field list."""
        with pytest.raises(ValidationError, match="Unknown field 'foo'"):
            TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="product")],
                foo="bar",
            )


class TestAliasChoices:
    """Test that common Superset form_data aliases are accepted."""

    def test_xy_stack_alias_for_stacked(self) -> None:
        """Test that 'stack' is accepted as alias for 'stacked'."""
        config = XYChartConfig.model_validate(
            {
                "chart_type": "xy",
                "x": {"name": "category"},
                "y": [{"name": "sales", "aggregate": "SUM"}],
                "stack": True,
            }
        )
        assert config.stacked is True

    def test_xy_stacked_still_works(self) -> None:
        """Test that 'stacked' still works as primary field name."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="category"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            stacked=True,
        )
        assert config.stacked is True

    def test_xy_time_grain_sqla_alias(self) -> None:
        """Test that 'time_grain_sqla' is accepted as alias for 'time_grain'."""
        config = XYChartConfig.model_validate(
            {
                "chart_type": "xy",
                "x": {"name": "order_date"},
                "y": [{"name": "sales", "aggregate": "SUM"}],
                "time_grain_sqla": "P1D",
            }
        )
        assert config.time_grain is not None

    def test_table_order_by_alias_for_sort_by(self) -> None:
        """Test that 'order_by' is accepted as alias for 'sort_by'."""
        config = TableChartConfig.model_validate(
            {
                "chart_type": "table",
                "columns": [{"name": "product"}],
                "order_by": ["product"],
            }
        )
        assert config.sort_by == ["product"]

    def test_mixed_timeseries_time_grain_sqla_alias(self) -> None:
        """Test that 'time_grain_sqla' works for MixedTimeseriesChartConfig."""
        from superset.mcp_service.chart.schemas import MixedTimeseriesChartConfig

        config = MixedTimeseriesChartConfig.model_validate(
            {
                "chart_type": "mixed_timeseries",
                "x": {"name": "order_date"},
                "y": [{"name": "sales", "aggregate": "SUM"}],
                "y_secondary": [{"name": "profit", "aggregate": "SUM"}],
                "time_grain_sqla": "P1M",
            }
        )
        assert config.time_grain is not None


class TestUnknownFieldDetection:
    """Test that unknown fields produce helpful error messages."""

    def test_near_miss_suggests_correct_field(self) -> None:
        """Test that a near-miss field name produces 'did you mean?' suggestion."""
        with pytest.raises(ValidationError, match="did you mean"):
            XYChartConfig.model_validate(
                {
                    "chart_type": "xy",
                    "x": {"name": "category"},
                    "y": [{"name": "sales", "aggregate": "SUM"}],
                    "stacks": True,
                }
            )

    def test_completely_unknown_field_lists_valid_fields(self) -> None:
        """Test that a completely unknown field lists valid fields."""
        with pytest.raises(ValidationError, match="Valid fields:"):
            XYChartConfig.model_validate(
                {
                    "chart_type": "xy",
                    "x": {"name": "category"},
                    "y": [{"name": "sales", "aggregate": "SUM"}],
                    "zzz_nonexistent": True,
                }
            )

    def test_pie_chart_unknown_field(self) -> None:
        """Test unknown field detection on PieChartConfig."""
        from superset.mcp_service.chart.schemas import PieChartConfig

        with pytest.raises(ValidationError, match="Unknown field"):
            PieChartConfig.model_validate(
                {
                    "chart_type": "pie",
                    "dimension": {"name": "category"},
                    "metric": {"name": "sales", "aggregate": "SUM"},
                    "bad_field": True,
                }
            )

    def test_table_chart_unknown_field(self) -> None:
        """Test unknown field detection on TableChartConfig."""
        with pytest.raises(ValidationError, match="Unknown field"):
            TableChartConfig.model_validate(
                {
                    "chart_type": "table",
                    "columns": [{"name": "product"}],
                    "invalid_param": "test",
                }
            )

    def test_known_aliases_not_flagged_as_unknown(self) -> None:
        """Test that known aliases pass validation without errors."""
        config = XYChartConfig.model_validate(
            {
                "chart_type": "xy",
                "x_axis": {"name": "category"},
                "metrics": [{"name": "sales", "aggregate": "SUM"}],
                "groupby": [{"name": "region"}],
                "stack": True,
                "time_grain_sqla": "P1D",
            }
        )
        assert config.stacked is True
        assert config.row_limit == 10000
        assert config.group_by is not None


class TestColumnRefSavedMetric:
    """Test ColumnRef saved_metric support."""

    def test_saved_metric_defaults_to_false(self) -> None:
        col = ColumnRef(name="revenue", aggregate="SUM")
        assert col.saved_metric is False

    def test_saved_metric_flag_accepted(self) -> None:
        col = ColumnRef(name="total_revenue", saved_metric=True)
        assert col.saved_metric is True
        assert col.name == "total_revenue"

    def test_saved_metric_clears_aggregate(self) -> None:
        col = ColumnRef(name="total_revenue", saved_metric=True, aggregate="SUM")
        assert col.saved_metric is True
        assert col.aggregate is None

    def test_saved_metric_preserves_label(self) -> None:
        col = ColumnRef(name="total_revenue", saved_metric=True, label="Revenue")
        assert col.label == "Revenue"

    def test_saved_metric_in_table_config_unique_labels(self) -> None:
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="product_line"),
                ColumnRef(name="total_revenue", saved_metric=True),
            ],
        )
        assert len(config.columns) == 2

    def test_saved_metric_in_xy_config_unique_labels(self) -> None:
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="total_revenue", saved_metric=True)],
        )
        assert len(config.y) == 1

    def test_saved_metric_duplicate_label_rejected(self) -> None:
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="order_date"),
                y=[
                    ColumnRef(name="total_revenue", saved_metric=True),
                    ColumnRef(
                        name="other_metric",
                        saved_metric=True,
                        label="total_revenue",
                    ),
                ],
            )


class TestParseChartConfig:
    """Tests for parse_chart_config and config coercion."""

    def test_parse_valid_xy_config(self) -> None:
        config = parse_chart_config(
            {"chart_type": "xy", "x": {"name": "date"}, "y": [{"name": "v"}]}
        )
        assert config.chart_type == "xy"
        assert config.x.name == "date"
        assert len(config.y) == 1
        assert config.y[0].name == "v"

    def test_parse_valid_table_config(self) -> None:
        config = parse_chart_config(
            {"chart_type": "table", "columns": [{"name": "col1"}]}
        )
        assert config.chart_type == "table"
        assert len(config.columns) == 1
        assert config.columns[0].name == "col1"

    def test_parse_missing_chart_type_raises(self) -> None:
        with pytest.raises(ValueError, match="chart://configs"):
            parse_chart_config({"x": {"name": "date"}, "y": [{"name": "v"}]})

    def test_parse_unknown_chart_type_raises(self) -> None:
        with pytest.raises(ValueError, match="chart://configs"):
            parse_chart_config({"chart_type": "nonexistent", "x": {"name": "d"}})

    def test_coerce_json_string_config(self) -> None:
        raw = '{"chart_type": "table", "columns": [{"name": "c"}]}'
        req = GenerateChartRequest(dataset_id=1, config=raw)
        assert isinstance(req.config, dict)
        assert req.config["chart_type"] == "table"

    def test_coerce_typed_config_object(self) -> None:
        typed = TableChartConfig(chart_type="table", columns=[ColumnRef(name="c")])
        req = GenerateChartRequest(dataset_id=1, config=typed)
        assert isinstance(req.config, dict)
        assert req.config["chart_type"] == "table"

    def test_coerce_invalid_json_string_raises(self) -> None:
        with pytest.raises(ValidationError):
            GenerateChartRequest(dataset_id=1, config="not valid json")


class TestGenerateChartRequestChartNameSanitization:
    """XSS / sanitization behavior for the chart_name field."""

    def _config(self) -> dict[str, object]:
        return {
            "chart_type": "table",
            "columns": [{"name": "a"}],
        }

    def test_plain_chart_name_passes_without_warning(self) -> None:
        req = GenerateChartRequest(
            dataset_id=1, config=self._config(), chart_name="Sales Report"
        )
        assert req.chart_name == "Sales Report"
        assert req.sanitization_warnings == []

    def test_chart_name_script_only_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="removed entirely by sanitization"):
            GenerateChartRequest(
                dataset_id=1,
                config=self._config(),
                chart_name="<script>alert(1)</script>",
            )

    def test_chart_name_partial_strip_emits_warning(self) -> None:
        req = GenerateChartRequest(
            dataset_id=1,
            config=self._config(),
            chart_name="Q1 <b>Report</b>",
        )
        assert req.chart_name == "Q1 Report"
        assert len(req.sanitization_warnings) == 1
        assert "chart_name" in req.sanitization_warnings[0]

    def test_chart_name_omitted_does_not_warn(self) -> None:
        req = GenerateChartRequest(dataset_id=1, config=self._config())
        assert req.chart_name is None
        assert req.sanitization_warnings == []
