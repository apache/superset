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

from unittest.mock import Mock, patch

import pytest

from superset.mcp_service.chart.compile import (
    build_dataset_context_from_orm,
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
