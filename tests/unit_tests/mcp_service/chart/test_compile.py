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
Integration-style tests for ``validate_and_compile``.

These tests exercise the real ``DatasetValidator.validate_against_dataset``
path so fast-path tools (``generate_explore_link``, ``update_chart_preview``)
that only use Tier-1 validation are exercised end-to-end.
"""

from typing import Any, cast
from unittest.mock import Mock, patch

import pandas as pd
import pytest

from superset.mcp_service.chart.compile import (
    CompileResult,
    validate_and_compile,
)
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    ColumnRef,
    FilterConfig,
    PieChartConfig,
    PivotTableChartConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    build_dataset_context_from_orm,
)


def _orm_dataset(
    *,
    column_names: list[str] | None = None,
    metric_names: list[str] | None = None,
    has_database: bool = True,
) -> Mock:
    """Build a Mock dataset that satisfies build_dataset_context_from_orm."""
    columns = []
    for name in column_names or ["ds", "gender", "name", "num"]:
        col = Mock()
        col.column_name = name
        col.type = "TEXT"
        col.is_temporal = name == "ds"
        col.is_numeric = name == "num"
        columns.append(col)

    metrics = []
    for name in metric_names or ["sum_boys", "sum_girls"]:
        m = Mock()
        m.metric_name = name
        m.expression = f"SUM({name})"
        m.description = None
        metrics.append(m)

    dataset = Mock()
    dataset.id = 3
    dataset.table_name = "birth_names"
    dataset.schema = None
    dataset.columns = columns
    dataset.metrics = metrics
    if has_database:
        db = Mock()
        db.database_name = "examples"
        dataset.database = db
    else:
        dataset.database = None
    return dataset


class TestBuildDatasetContextFromOrm:
    """Cover the helper that converts ORM dataset → DatasetContext."""

    def test_handles_missing_database_relationship(self):
        """``database_name`` defaults to '' when ``dataset.database`` is None
        so Pydantic validation doesn't blow up."""
        ds = _orm_dataset(has_database=False)
        ctx = build_dataset_context_from_orm(ds)
        assert ctx is not None
        assert ctx.database_name == ""
        assert ctx.id == 3
        assert {c["name"] for c in ctx.available_columns} == {
            "ds",
            "gender",
            "name",
            "num",
        }
        assert {m["name"] for m in ctx.available_metrics} == {
            "sum_boys",
            "sum_girls",
        }

    def test_returns_none_for_none_input(self):
        assert build_dataset_context_from_orm(None) is None


class TestValidateAndCompileChartTypeCoverage:
    """Tier-1 validation must catch bad column refs in every supported
    chart-config variant — not just XY and table."""

    def test_xy_bad_metric_column_rejected(self):
        ds = _orm_dataset()
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="ds"),
            y=[ColumnRef(name="num_boys", aggregate="SUM")],
            kind="line",
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success
        assert result.tier == "validation"
        assert result.error_obj is not None
        assert any("sum_boys" in s for s in (result.error_obj.suggestions or []))

    def test_pie_bad_metric_column_rejected(self):
        ds = _orm_dataset()
        config = PieChartConfig(
            dimension=ColumnRef(name="gender"),
            metric=ColumnRef(name="num_boys", aggregate="SUM"),
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success, "Pie chart with bad metric column should fail"
        assert result.tier == "validation"
        assert result.error_obj is not None
        assert any("sum_boys" in s for s in (result.error_obj.suggestions or []))

    def test_pie_valid_dimension_and_saved_metric_passes(self):
        ds = _orm_dataset()
        config = PieChartConfig(
            dimension=ColumnRef(name="gender"),
            metric=ColumnRef(name="sum_boys", saved_metric=True),
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert result.success, result.error

    def test_pivot_table_bad_row_rejected(self):
        ds = _orm_dataset()
        config = PivotTableChartConfig(
            rows=[ColumnRef(name="bogus_dim")],
            metrics=[ColumnRef(name="sum_boys", saved_metric=True)],
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success
        assert result.error_obj is not None

    def test_big_number_bad_temporal_column_rejected(self):
        ds = _orm_dataset()
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="sum_boys", saved_metric=True),
            temporal_column="not_a_real_temporal",
            show_trendline=True,
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success, "BigNumber temporal_column must be validated"
        assert result.error_obj is not None
        assert "not_a_real_temporal" in (result.error_obj.message or "")

    def test_pie_with_sum_on_non_numeric_column_rejected(self):
        """Tier-1 aggregation compatibility now runs for non-Table/XY too —
        a pie ``metric={"name": "gender", "aggregate": "SUM"}`` would emit
        ``SUM(gender)`` which the DB rejects, so the validator must catch it
        before we hand back an explore URL."""
        ds = _orm_dataset()
        config = PieChartConfig(
            dimension=ColumnRef(name="name"),
            metric=ColumnRef(name="gender", aggregate="SUM"),
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success, "SUM on a TEXT column must reject"
        assert result.error_obj is not None
        assert result.error_obj.error_code == "INVALID_AGGREGATION"

    def test_pivot_table_sum_on_non_numeric_column_rejected(self):
        ds = _orm_dataset()
        config = PivotTableChartConfig(
            rows=[ColumnRef(name="gender")],
            metrics=[ColumnRef(name="name", aggregate="SUM")],
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success
        assert result.error_obj is not None
        assert result.error_obj.error_code == "INVALID_AGGREGATION"

    def test_pivot_table_min_on_non_numeric_column_passes(self):
        """MIN and MAX are not numeric-only (valid on dates/text in SQL).

        They are left to the Tier-2 compile check rather than being rejected
        by Tier-1 schema validation.
        """
        ds = _orm_dataset()
        config = PivotTableChartConfig(
            rows=[ColumnRef(name="gender")],
            metrics=[ColumnRef(name="name", aggregate="MIN")],
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert result.success, (
            "MIN on a text column should not be rejected by Tier-1 validation"
        )

    def test_table_with_invalid_filter_column_rejected(self):
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="gender")],
            filters=[FilterConfig(column="bogus", op="=", value="x")],
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success
        assert result.error_obj is not None

    def test_inert_stale_filter_column_is_ignored(self):
        """A No filter placeholder produces no predicate and cannot block edits."""
        ds = _orm_dataset()
        config = TableChartConfig(columns=[ColumnRef(name="gender")])
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "dropped_column",
                    "operator": "TEMPORAL_RANGE",
                    "comparator": "No filter",
                }
            ]
        }

        result = validate_and_compile(config, form_data, ds, run_compile_check=False)

        assert result.success

    def test_no_filter_literal_with_non_temporal_operator_is_validated(self):
        """A literal value of No filter is not generally an inert predicate."""
        ds = _orm_dataset()
        config = TableChartConfig(columns=[ColumnRef(name="gender")])
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "dropped_column",
                    "operator": "==",
                    "comparator": "No filter",
                }
            ]
        }

        result = validate_and_compile(config, form_data, ds, run_compile_check=False)

        assert not result.success
        assert result.error_obj is not None
        assert result.error_obj.error_type == "invalid_column"


class TestSavedMetricNotMarked:
    """A non-saved-metric ColumnRef whose name matches a saved metric is a
    common LLM mistake (forgetting to set ``saved_metric=true``). The
    validator should surface a tailored hint instead of letting the bad SQL
    through."""

    def test_table_metric_name_without_saved_metric_flag_rejected(self):
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="gender"),
                # ``sum_boys`` is a saved metric on the dataset, but
                # saved_metric=False (default) would render as
                # ``SUM(sum_boys)`` ad-hoc SQL — broken.
                ColumnRef(name="sum_boys", aggregate="SUM"),
            ],
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success, (
            "ref.name matches a saved metric but saved_metric=False -> reject"
        )
        assert result.error_obj is not None
        assert result.error_obj.error_code == "SAVED_METRIC_NOT_MARKED"
        # Suggestion should point the LLM at the right correction.
        suggestions_text = " ".join(result.error_obj.suggestions or [])
        assert "saved_metric" in suggestions_text
        assert "sum_boys" in suggestions_text

    def test_pie_metric_name_without_saved_metric_flag_rejected(self):
        ds = _orm_dataset()
        config = PieChartConfig(
            dimension=ColumnRef(name="gender"),
            metric=ColumnRef(name="sum_boys", aggregate="SUM"),
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert not result.success
        assert result.error_obj is not None
        assert result.error_obj.error_code == "SAVED_METRIC_NOT_MARKED"

    def test_explicit_saved_metric_passes(self):
        ds = _orm_dataset()
        config = PieChartConfig(
            dimension=ColumnRef(name="gender"),
            metric=ColumnRef(name="sum_boys", saved_metric=True),
        )
        result = validate_and_compile(config, {}, ds, run_compile_check=False)
        assert result.success, result.error


class TestAdhocFiltersFromFormData:
    """Filters merged into form_data (not present on the typed config) must
    also be validated. Without this hook, ``update_chart_preview`` could
    smuggle bad column refs through preserved adhoc filters."""

    def test_unknown_adhoc_filter_subject_rejected(self):
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "removed_column",
                    "operator": "==",
                    "comparator": "x",
                }
            ]
        }
        result = validate_and_compile(config, form_data, ds, run_compile_check=False)
        assert not result.success
        assert result.error_obj is not None
        assert "removed_column" in (result.error_obj.message or "")

    def test_known_adhoc_filter_subject_passes(self):
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "gender",
                    "operator": "==",
                    "comparator": "boy",
                }
            ]
        }
        result = validate_and_compile(config, form_data, ds, run_compile_check=False)
        assert result.success, result.error

    def test_sql_expression_filter_skipped(self):
        """SQL-expression filters carry a free-form ``sqlExpression`` we can't
        safely parse, so they should pass Tier-1 untouched."""
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SQL",
                    "clause": "WHERE",
                    "sqlExpression": "1 = 1",
                }
            ]
        }
        result = validate_and_compile(config, form_data, ds, run_compile_check=False)
        assert result.success

    def test_where_filter_with_metric_name_rejected(self):
        """A saved-metric name used as a WHERE filter subject must be rejected.

        WHERE filters need a physical column; metric names are only valid in
        HAVING clauses where Superset can resolve them.
        """
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "sum_boys",  # saved metric, not a physical column
                    "operator": ">",
                    "comparator": "0",
                }
            ]
        }
        result = validate_and_compile(config, form_data, ds, run_compile_check=False)
        assert not result.success, (
            "A saved-metric name used in a WHERE filter must not pass Tier-1"
        )
        assert result.error_obj is not None
        assert "sum_boys" in (result.error_obj.message or "")

    def test_having_filter_with_metric_name_passes(self):
        """A saved-metric name used in a HAVING filter must be accepted.

        HAVING filters are aggregate-level conditions; Superset resolves metric
        names there so they are valid references.
        """
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "HAVING",
                    "subject": "sum_boys",  # saved metric — valid in HAVING
                    "operator": ">",
                    "comparator": "0",
                }
            ]
        }
        result = validate_and_compile(config, form_data, ds, run_compile_check=False)
        assert result.success, (
            "A saved-metric name in a HAVING filter should pass Tier-1 validation"
        )


class TestValidateAndCompileTier2:
    """When ``run_compile_check=True`` and Tier-1 passes, the helper must
    invoke ``_compile_chart`` and surface its outcome."""

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_tier2_runs_when_tier1_passes(self, mock_compile):
        mock_compile.return_value = CompileResult(success=True)
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        result = validate_and_compile(
            config, {"adhoc_filters": []}, ds, run_compile_check=True
        )
        assert result.success
        mock_compile.assert_called_once()

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_tier2_skipped_on_tier1_failure(self, mock_compile):
        ds = _orm_dataset()
        config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="bogus")])
        result = validate_and_compile(config, {}, ds, run_compile_check=True)
        assert not result.success
        assert result.tier == "validation"
        mock_compile.assert_not_called()

    def test_dataset_none_returns_dataset_not_found(self):
        result = validate_and_compile(None, {}, None, run_compile_check=True)
        assert not result.success
        assert result.error_code == "DATASET_NOT_FOUND"

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_dataset_only_native_rebind_validates_and_compiles(self, mock_compile):
        mock_compile.return_value = CompileResult(success=True)
        ds = _orm_dataset()
        form_data = {
            "viz_type": "table",
            "query_mode": "aggregate",
            "groupby": ["gender"],
            "metrics": ["sum_boys"],
            "datasource": "3__table",
        }

        result = validate_and_compile(None, form_data, ds, run_compile_check=True)

        assert result.success
        mock_compile.assert_called_once_with(form_data, 3)

    @pytest.mark.parametrize(
        "form_data",
        [
            {
                "viz_type": "table",
                "query_mode": "raw",
                "all_columns": ["missing_column"],
            },
            {
                "viz_type": "pie",
                "groupby": ["gender"],
                "metric": "missing_saved_metric",
            },
            {
                "viz_type": "table",
                "query_mode": "raw",
                "all_columns": ["gender"],
                "order_by_cols": ['["missing_order_column", false]'],
            },
            {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "gender",
                "granularity_sqla": "gender",
                "time_grain_sqla": "P1D",
                "metrics": ["sum_boys"],
            },
        ],
    )
    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_dataset_only_native_rebind_rejects_incompatible_roles(
        self, mock_compile, form_data
    ):
        result = validate_and_compile(
            None,
            form_data,
            _orm_dataset(has_database=False),
            run_compile_check=True,
        )

        assert not result.success
        assert result.tier == "validation"
        assert result.error_obj is not None
        assert result.error_obj.error_type == "invalid_native_chart_reference"
        mock_compile.assert_not_called()

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_dataset_only_rebind_rejects_inert_stale_temporal_reference(
        self, mock_compile
    ):
        result = validate_and_compile(
            None,
            {
                "viz_type": "table",
                "query_mode": "raw",
                "all_columns": ["gender"],
                "adhoc_filters": [
                    {
                        "expressionType": "SIMPLE",
                        "subject": "removed_time",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "No filter",
                    }
                ],
            },
            _orm_dataset(),
            run_compile_check=True,
        )

        assert not result.success
        mock_compile.assert_not_called()

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_timeseries_rebind_rejects_missing_saved_ranking_metric_even_when_hidden(
        self, mock_compile
    ) -> None:
        """An explicit orderby keeps normalizeOrderBy from emitting the raw role."""
        result = validate_and_compile(
            None,
            {
                "viz_type": "echarts_timeseries_bar",
                "x_axis": "ds",
                "groupby": [],
                "metrics": ["sum_boys", "sum_girls"],
                "timeseries_limit_metric": "missing_rank",
                "x_axis_sort": "missing_rank",
                "x_axis_sort_asc": True,
                "orderby": [["sum_boys", False]],
            },
            _orm_dataset(),
            run_compile_check=True,
        )

        assert not result.success
        assert result.error_obj is not None
        assert "timeseries_limit_metric" in result.error_obj.message
        mock_compile.assert_not_called()

    @pytest.mark.parametrize(
        "ranking_field", ["timeseries_limit_metric", "series_limit_metric"]
    )
    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_timeseries_rebind_accepts_compatible_saved_ranking_roles(
        self, mock_compile, ranking_field
    ) -> None:
        mock_compile.return_value = CompileResult(success=True)
        form_data = {
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "ds",
            "groupby": [],
            "metrics": ["sum_boys", "sum_girls"],
            ranking_field: "sum_girls",
            "x_axis_sort": "sum_girls",
            "x_axis_sort_asc": False,
        }

        result = validate_and_compile(
            None, form_data, _orm_dataset(), run_compile_check=True
        )

        assert result.success
        mock_compile.assert_called_once_with(form_data, 3)

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_timeseries_rebind_validates_physical_ranking_metric_column(
        self, mock_compile
    ) -> None:
        mock_compile.return_value = CompileResult(success=True)
        ranking = {
            "expressionType": "SIMPLE",
            "column": {"column_name": "num"},
            "aggregate": "MAX",
            "label": "MAX(num)",
        }
        compatible = {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "ds",
            "metrics": ["sum_boys"],
            "timeseries_limit_metric": ranking,
            "x_axis_sort": "MAX(num)",
            "x_axis_sort_asc": True,
        }

        result = validate_and_compile(
            None, compatible, _orm_dataset(), run_compile_check=True
        )
        assert result.success

        incompatible = {
            **compatible,
            "timeseries_limit_metric": {
                **ranking,
                "column": {"column_name": "missing_num"},
            },
        }
        result = validate_and_compile(
            None, incompatible, _orm_dataset(), run_compile_check=True
        )
        assert not result.success
        assert result.error_obj is not None
        assert "missing_num" in result.error_obj.message

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_mixed_rebind_validates_primary_and_secondary_roles_independently(
        self, mock_compile
    ) -> None:
        mock_compile.return_value = CompileResult(success=True)
        compatible = {
            "viz_type": "mixed_timeseries",
            "x_axis": "ds",
            "groupby": ["gender"],
            "metrics": ["sum_boys", "sum_girls"],
            "timeseries_limit_metric": "sum_boys",
            "groupby_b": ["name"],
            "metrics_b": ["sum_girls", "sum_boys"],
            "timeseries_limit_metric_b": "sum_girls",
        }

        result = validate_and_compile(
            None, compatible, _orm_dataset(), run_compile_check=True
        )
        assert result.success

        for bad_field in ("metrics", "metrics_b", "timeseries_limit_metric_b"):
            incompatible = {**compatible, bad_field: ["missing_metric"]}
            if bad_field == "timeseries_limit_metric_b":
                incompatible[bad_field] = "missing_metric"
            result = validate_and_compile(
                None, incompatible, _orm_dataset(), run_compile_check=True
            )
            assert not result.success, bad_field
            assert result.error_obj is not None
            assert bad_field in result.error_obj.message

    @pytest.mark.parametrize(
        ("form_data", "columns", "metrics", "missing_role"),
        [
            (
                {
                    "viz_type": "deck_path",
                    "line_column": "route",
                    "dimension": "route_type",
                    "tooltip_contents": ["missing_owner"],
                    "metric": "color_metric",
                    "line_width": {"type": "metric", "value": "width_metric"},
                    "breakpoint_metric": "break_metric",
                },
                ["route", "route_type"],
                ["color_metric", "width_metric", "break_metric"],
                "missing_owner",
            ),
            (
                {
                    "viz_type": "deck_path",
                    "line_column": "route",
                    "tooltip_contents": ["owner"],
                    "line_width": {
                        "type": "metric",
                        "value": "missing_width_metric",
                    },
                },
                ["route", "owner"],
                ["width_metric"],
                "missing_width_metric",
            ),
            (
                {
                    "viz_type": "deck_path",
                    "line_column": "route",
                    "breakpoint_metric": "missing_break_metric",
                },
                ["route"],
                ["break_metric"],
                "missing_break_metric",
            ),
            (
                {
                    "viz_type": "deck_geojson",
                    "geojson": "geom",
                    "cross_filter_column": "missing_region",
                    "tooltip_contents": ["name"],
                },
                ["geom", "name"],
                [],
                "missing_region",
            ),
            (
                {
                    "viz_type": "deck_polygon",
                    "line_column": "polygon",
                    "cross_filter_column": "region",
                    "tooltip_contents": ["missing_owner"],
                    "metric": "value_metric",
                },
                ["polygon", "region"],
                ["value_metric"],
                "missing_owner",
            ),
            (
                {
                    "viz_type": "deck_hex",
                    "spatial": {
                        "type": "latlong",
                        "lonCol": "lon",
                        "latCol": "missing_lat",
                    },
                    "size": "weight_metric",
                },
                ["lon"],
                ["weight_metric"],
                "missing_lat",
            ),
        ],
    )
    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_deck_rebind_fails_closed_for_every_renderer_role(
        self,
        mock_compile: Mock,
        form_data: dict[str, Any],
        columns: list[str],
        metrics: list[str],
        missing_role: str,
    ) -> None:
        result = validate_and_compile(
            None,
            form_data,
            _orm_dataset(column_names=columns, metric_names=metrics),
            run_compile_check=True,
        )

        assert not result.success
        assert result.error_obj is not None
        assert result.error_obj.error_type == "invalid_native_chart_reference"
        assert missing_role in result.error_obj.message
        mock_compile.assert_not_called()

    @patch("superset.mcp_service.chart.compile._compile_chart")
    def test_deck_path_rebind_accepts_complete_renderer_contract(
        self, mock_compile: Mock
    ) -> None:
        mock_compile.return_value = CompileResult(success=True)
        form_data = {
            "viz_type": "deck_path",
            "line_column": "route",
            "dimension": "route_type",
            "tooltip_contents": [
                "owner",
                {"item_type": "column", "column_name": "city"},
            ],
            "metric": "color_metric",
            "line_width": {"type": "metric", "value": "width_metric"},
            "breakpoint_metric": "break_metric",
        }

        result = validate_and_compile(
            None,
            form_data,
            _orm_dataset(
                column_names=["route", "route_type", "owner", "city"],
                metric_names=["color_metric", "width_metric", "break_metric"],
            ),
            run_compile_check=True,
        )

        assert result.success
        mock_compile.assert_called_once()


def test_compile_chart_executes_final_ungrouped_timeseries_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from types import SimpleNamespace

    from superset.common.query_object import QueryObject
    from superset.mcp_service.chart.compile import _compile_chart

    factory_module = __import__(
        "superset.common.query_context_factory", fromlist=["QueryContextFactory"]
    )
    command_module = __import__(
        "superset.commands.chart.data.get_data_command", fromlist=["ChartDataCommand"]
    )
    captured: dict[str, Any] = {}

    class _Factory:
        def create(self, **kwargs: Any) -> Any:
            captured.update(kwargs)
            return SimpleNamespace(
                form_data=kwargs["form_data"],
                queries=[QueryObject(**query) for query in kwargs["queries"]],
            )

    class _Command:
        def __init__(self, query_context: Any) -> None:
            self.query_context = query_context

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return {"queries": [{"data": [], "colnames": []}]}

    monkeypatch.setattr(factory_module, "QueryContextFactory", _Factory)
    monkeypatch.setattr(command_module, "ChartDataCommand", _Command)
    monkeypatch.setattr(
        "superset.charts.data.form_data.set_query_context_form_data",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )

    result = _compile_chart(
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "ds",
            "groupby": [],
            "metrics": ["sum_boys", "sum_girls"],
            "timeseries_limit_metric": "sum_girls",
            "x_axis_sort": "sum_girls",
            "x_axis_sort_asc": True,
        },
        3,
    )

    assert result.success
    query = cast(list[dict[str, Any]], captured["queries"])[0]
    assert query["series_columns"] == []
    assert query["post_processing"][0]["options"]["columns"] == []
    assert query["metrics"] == ["sum_boys", "sum_girls"]
    assert query["series_limit_metric"] == "sum_girls"


def test_compile_chart_executes_final_big_number_trendline_query(
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
) -> None:
    from types import SimpleNamespace

    from superset.common.query_object import QueryObject
    from superset.mcp_service.chart.compile import _compile_chart

    factory_module = __import__(
        "superset.common.query_context_factory", fromlist=["QueryContextFactory"]
    )
    command_module = __import__(
        "superset.commands.chart.data.get_data_command", fromlist=["ChartDataCommand"]
    )
    captured: dict[str, Any] = {}

    class _Factory:
        def create(self, **kwargs: Any) -> Any:
            captured.update(kwargs)
            return SimpleNamespace(
                form_data=kwargs["form_data"],
                queries=[QueryObject(**query) for query in kwargs["queries"]],
            )

    class _Command:
        def __init__(self, query_context: Any) -> None:
            self.query_context = query_context

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            trend, raw = self.query_context.queries
            processed = trend.exec_post_processing(
                pd.DataFrame(
                    {
                        "event_time": pd.to_datetime(["2024-01-01", "2024-02-01"]),
                        "Gross revenue": [10.0, 15.0],
                    }
                )
            )
            assert list(processed.columns) == ["event_time", "Gross revenue"]
            assert raw.columns == []
            assert raw.is_timeseries is False
            assert raw.post_processing == []
            return {
                "queries": [
                    {
                        "data": [
                            {
                                "event_time": row["event_time"].isoformat(),
                                "Gross revenue": row["Gross revenue"],
                            }
                            for row in processed.to_dict("records")
                        ],
                        "colnames": [],
                    },
                    {"data": [{"Gross revenue": 25.0}], "colnames": []},
                ]
            }

    monkeypatch.setattr(factory_module, "QueryContextFactory", _Factory)
    monkeypatch.setattr(command_module, "ChartDataCommand", _Command)
    monkeypatch.setattr(
        "superset.charts.data.form_data.set_query_context_form_data",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "revenue"},
        "aggregate": "SUM",
        "label": "Gross revenue",
    }

    result = _compile_chart(
        {
            "viz_type": "big_number",
            "metric": metric,
            "x_axis": "event_time",
            "granularity_sqla": "event_time",
            "time_grain_sqla": "P1M",
            "aggregation": "raw",
        },
        3,
    )

    assert result.success
    trend, raw = cast(list[dict[str, Any]], captured["queries"])
    assert trend["columns"] == [
        {
            "timeGrain": "P1M",
            "columnType": "BASE_AXIS",
            "sqlExpression": "event_time",
            "label": "event_time",
            "expressionType": "SQL",
            "isColumnReference": True,
        }
    ]
    assert trend["series_columns"] == []
    assert trend["metrics"] == [metric]
    assert "is_timeseries" not in trend
    assert trend["post_processing"][0]["options"] == {
        "index": ["event_time"],
        "columns": [],
        "aggregates": {"Gross revenue": {"operator": "mean"}},
        "drop_missing_columns": True,
    }
    assert raw["columns"] == []
    assert raw["series_columns"] == []
    assert raw["is_timeseries"] is False
    assert raw["post_processing"] == []


@patch("superset.charts.data.form_data.set_query_context_form_data")
@patch("superset.daos.dataset.DatasetDAO")
@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_chart_returns_database_error_when_wrapped_in_query_failed(
    mock_factory, mock_cmd_cls, mock_dataset_dao, mock_set_form_data
):
    """ChartDataCommand converts OperationalError to a string inside
    ChartDataQueryFailedError (no __cause__ set). _classify_as_database_error
    should use db_engine_spec.extract_errors() to detect the DB error."""
    from superset.commands.chart.exceptions import ChartDataQueryFailedError
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.mcp_service.chart.compile import _compile_chart

    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.validate.return_value = None

    # Real scenario: __cause__ is NOT set, error is just a string
    wrapped = ChartDataQueryFailedError(
        "Error: (psycopg2.OperationalError) connection to server at '10.0.0.1',"
        " port 5432 failed: FATAL: tenant not found"
    )
    mock_cmd_cls.return_value.run.side_effect = wrapped

    # Mock the dataset's db_engine_spec to return GENERIC_DB_ENGINE_ERROR
    mock_db = Mock()
    mock_db.db_engine_spec.extract_errors.return_value = [
        SupersetError(
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            message="connection to server failed",
            level=ErrorLevel.ERROR,
            extra={"engine_name": "PostgreSQL"},
        )
    ]
    mock_dataset = Mock()
    mock_dataset.database = mock_db
    mock_dataset_dao.find_by_id.return_value = mock_dataset

    result = _compile_chart(
        form_data={
            "metrics": [{"label": "count", "expressionType": "SIMPLE"}],
            "adhoc_filters": [],
        },
        dataset_id=1,
    )

    assert not result.success
    assert "Database connection error" in result.error
    assert result.error_obj is not None
    assert result.error_obj.error_type == "database_connection_error"
    assert result.error_obj.error_code == "DATABASE_CONNECTION_ERROR"
    mock_db.db_engine_spec.extract_errors.assert_called_once()


@patch("superset.charts.data.form_data.set_query_context_form_data")
@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_chart_returns_database_error_on_raw_sqlalchemy_error(
    mock_factory, mock_cmd_cls, mock_set_form_data
):
    """When SQLAlchemyError escapes unwrapped, _compile_chart should
    catch it and return a database_connection_error."""
    from sqlalchemy.exc import OperationalError

    from superset.mcp_service.chart.compile import _compile_chart

    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.validate.return_value = None
    mock_cmd_cls.return_value.run.side_effect = OperationalError(
        "connection to server at '10.0.0.1', port 5432 failed: Connection timed out",
        None,
        None,
    )

    result = _compile_chart(
        form_data={
            "metrics": [{"label": "count", "expressionType": "SIMPLE"}],
            "adhoc_filters": [],
        },
        dataset_id=1,
    )

    assert not result.success
    assert "Database connection error" in result.error
    assert result.error_obj is not None
    assert result.error_obj.error_type == "database_connection_error"
    assert result.error_obj.error_code == "DATABASE_CONNECTION_ERROR"


@pytest.mark.parametrize(
    "config_factory",
    [
        lambda: PieChartConfig(
            dimension=ColumnRef(name="gender"),
            metric=ColumnRef(name="sum_boys", saved_metric=True),
        ),
        lambda: TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="gender"),
                ColumnRef(name="sum_boys", saved_metric=True),
            ],
        ),
    ],
)
def test_valid_configs_pass_tier1(config_factory):
    ds = _orm_dataset()
    result = validate_and_compile(config_factory(), {}, ds, run_compile_check=False)
    assert result.success, result.error


@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
@patch("superset.charts.data.form_data.set_query_context_form_data")
def test_compile_chart_seeds_form_data_before_query(
    mock_set_form_data, mock_factory, mock_cmd_cls
):
    from superset.mcp_service.chart.compile import _compile_chart

    query_context = Mock()
    mock_factory.return_value.create.return_value = query_context
    call_order: list[str] = []
    mock_set_form_data.side_effect = lambda *_args: call_order.append("seed")
    mock_cmd_cls.return_value.run.side_effect = lambda: (
        call_order.append("run") or {"queries": [{"data": []}]}
    )

    result = _compile_chart({"metrics": ["count"]}, 42)

    assert result.success
    mock_set_form_data.assert_called_once_with(query_context, 42, "table")
    assert call_order == ["seed", "run"]
