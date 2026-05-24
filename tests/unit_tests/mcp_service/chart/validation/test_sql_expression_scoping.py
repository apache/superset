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

"""Tests that ``sql_expression`` on a ``ColumnRef`` is only valid in metric
positions.

The ``ColumnRef`` schema is shared across config fields — it shows up as
x_axis (XYChartConfig.x), dimensions (PieChartConfig.dimension),
group-bys (XYChartConfig.group_by), pivot rows, table columns, and as
the actual metric. ``sql_expression`` is only meaningful in the last of
those — an x_axis carrying a SQL fragment doesn't compile to anything
useful.

The dataset validator distinguishes by collecting metric-slot
``id(ref)`` values and only skipping column-existence checks for those.
A sql_expression in a non-metric slot is reported as an invalid column
at Tier-1, instead of silently passing through and failing later with
a generic DB error.
"""

from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    ColumnRef,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    DatasetValidator,
)


class TestGetMetricRefIds:
    """``_get_metric_ref_ids`` returns ``id(ref)`` values for refs that
    occupy a metric slot in a given config. Used by the dataset validator
    to scope the sql_expression skip to metric positions only."""

    def test_xy_config_y_is_metric_x_is_not(self) -> None:
        """In an XY chart, the y-axis refs are metrics; the x-axis ref isn't."""
        x_ref = ColumnRef(name="order_date")
        y_ref = ColumnRef(name="sales", aggregate="SUM")
        config = XYChartConfig(chart_type="xy", x=x_ref, y=[y_ref])
        ids = DatasetValidator._get_metric_ref_ids(config)
        assert id(y_ref) in ids
        assert id(x_ref) not in ids

    def test_pie_metric_is_metric_dimension_is_not(self) -> None:
        """Pie chart's dimension is categorical, not a metric."""
        dim_ref = ColumnRef(name="category")
        metric_ref = ColumnRef(name="sales", aggregate="SUM")
        config = PieChartConfig(
            chart_type="pie", dimension=dim_ref, metric=metric_ref
        )
        ids = DatasetValidator._get_metric_ref_ids(config)
        assert id(metric_ref) in ids
        assert id(dim_ref) not in ids

    def test_big_number_metric_is_metric(self) -> None:
        """The single metric ref on a BigNumber config is identified."""
        metric_ref = ColumnRef(name="sales", aggregate="SUM")
        config = BigNumberChartConfig(chart_type="big_number", metric=metric_ref)
        ids = DatasetValidator._get_metric_ref_ids(config)
        assert id(metric_ref) in ids

    def test_pivot_metrics_only(self) -> None:
        """In a pivot table, rows and columns are dimensions; metrics are
        the only metric-position refs."""
        row_ref = ColumnRef(name="region")
        col_ref = ColumnRef(name="category")
        m_ref = ColumnRef(name="sales", aggregate="SUM")
        config = PivotTableChartConfig(
            chart_type="pivot_table",
            rows=[row_ref],
            columns=[col_ref],
            metrics=[m_ref],
        )
        ids = DatasetValidator._get_metric_ref_ids(config)
        assert id(m_ref) in ids
        assert id(row_ref) not in ids
        assert id(col_ref) not in ids

    def test_mixed_timeseries_both_y_lists(self) -> None:
        """MixedTimeseries has y AND y_secondary; both are metric positions."""
        x = ColumnRef(name="ds")
        y1 = ColumnRef(name="sales", aggregate="SUM")
        y2 = ColumnRef(name="profit", aggregate="SUM")
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries", x=x, y=[y1], y_secondary=[y2]
        )
        ids = DatasetValidator._get_metric_ref_ids(config)
        assert id(y1) in ids
        assert id(y2) in ids
        assert id(x) not in ids

    def test_table_aggregated_columns_are_metrics(self) -> None:
        """In a table, any column with an aggregate (or saved_metric, or
        sql_expression) is acting as a metric."""
        dim_ref = ColumnRef(name="category")
        agg_ref = ColumnRef(name="sales", aggregate="SUM")
        sql_ref = ColumnRef(
            name="margin", sql_expression="SUM(profit)/SUM(sales)"
        )
        config = TableChartConfig(
            chart_type="table", columns=[dim_ref, agg_ref, sql_ref]
        )
        ids = DatasetValidator._get_metric_ref_ids(config)
        assert id(agg_ref) in ids
        assert id(sql_ref) in ids
        assert id(dim_ref) not in ids


class TestSqlExpressionInNonMetricPositionRejected:
    """A ColumnRef with sql_expression in a non-metric slot is reported
    as invalid by ``_validate_columns_exist`` instead of being silently
    skipped."""

    def _ctx(self, columns: list[str], metrics: list[str] | None = None):
        """Build a minimal DatasetContext with given column + metric names."""
        from superset.mcp_service.common.error_schemas import DatasetContext

        return DatasetContext(
            id=1,
            table_name="test_table",
            database_name="test_db",
            available_columns=[
                {"name": c, "type_generic": "STRING"} for c in columns
            ],
            available_metrics=[{"name": m} for m in (metrics or [])],
        )

    def test_sql_expression_in_metric_slot_passes(self) -> None:
        """A sql_expression on the y-axis of an XY chart is valid."""
        ref = ColumnRef(
            name="margin",
            sql_expression="SUM(profit) / NULLIF(SUM(sales), 0)",
            label="Margin",
        )
        config = XYChartConfig(
            chart_type="xy", x=ColumnRef(name="ds"), y=[ref]
        )
        ctx = self._ctx(["ds"])
        metric_ids = DatasetValidator._get_metric_ref_ids(config)
        # When the validator runs, all extracted refs are passed in.
        all_refs = DatasetValidator._extract_column_references(config)
        err = DatasetValidator._validate_columns_exist(
            all_refs, ctx, metric_ids
        )
        assert err is None

    def test_sql_expression_in_x_axis_slot_flagged(self) -> None:
        """A sql_expression on x_axis is invalid — x_axis needs a real
        column name. Validator reports it as an invalid column."""
        bad_ref = ColumnRef(
            name="not_a_real_column",
            sql_expression="SUM(profit)",  # nonsensical here
        )
        config = XYChartConfig(
            chart_type="xy",
            x=bad_ref,
            y=[ColumnRef(name="sales", aggregate="SUM")],
        )
        ctx = self._ctx(["sales"])  # x_axis "not_a_real_column" doesn't exist
        metric_ids = DatasetValidator._get_metric_ref_ids(config)
        all_refs = DatasetValidator._extract_column_references(config)
        err = DatasetValidator._validate_columns_exist(
            all_refs, ctx, metric_ids
        )
        # The validator should report an invalid-column error rather than
        # silently passing through.
        assert err is not None
