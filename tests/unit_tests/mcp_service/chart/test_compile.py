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

from typing import Any
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.common.db_query_status import QueryStatus
from superset.mcp_service.chart.compile import (
    _compile_chart,
    CompileResult,
    validate_and_compile,
)
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    ColumnRef,
    FilterConfig,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
    SunburstChartConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    build_dataset_context_from_orm,
)
from superset.utils.core import GenericDataType
from tests.unit_tests.mcp_service.chart.query_result_fixtures import (
    chart_data_command_result,
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
        col.is_dttm = name == "ds"
        col.python_date_format = None
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


def _assert_saved_metric_hint(error: Any) -> None:
    """A metric-slot typo is steered at the saved metric, not SUM(column).

    ``num_boys`` is neither a column nor an exact metric name, so the physical
    column pass finds nothing. Without the metric near-miss hint the caller
    dead-ends on "No matching columns found." and its likely next move is
    ``SUM(num)`` — a valid chart answering a different question.
    """
    assert error.error_type == "column_not_found"
    hint: str = next(
        s for s in error.suggestions if s.startswith("Did you mean the saved metric")
    )
    assert "'sum_boys'" in hint
    assert '"saved_metric": true' in hint
    # Never suggest the broken SUM(metric) shape.
    assert all("SUM(sum_boys)" not in s for s in error.suggestions)
    assert error.dataset_context is not None
    assert {c["name"] for c in error.dataset_context.available_columns} == {
        "ds",
        "gender",
        "name",
        "num",
    }
    # The dataset's saved metrics are listed, so an empty list means "none".
    assert {m["name"] for m in error.dataset_context.available_metrics} == {
        "sum_boys",
        "sum_girls",
    }


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
        _assert_saved_metric_hint(result.error_obj)

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
        _assert_saved_metric_hint(result.error_obj)

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

        WHERE filters need a physical column; a saved metric cannot satisfy it.
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

    def test_simple_having_filter_is_rejected_without_where_coercion(self):
        """SIMPLE HAVING is unsupported and must never become a WHERE filter."""
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
        assert not result.success
        assert result.error_obj is not None
        assert result.error_obj.error_code == "UNSUPPORTED_FILTER_CLAUSE"

    @pytest.mark.parametrize("clause", [None, 7, "where", "", "GROUP"])
    def test_malformed_simple_filter_clause_is_rejected(self, clause):
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": clause,
                    "subject": "gender",
                    "operator": "==",
                    "comparator": "boy",
                }
            ]
        }
        result = validate_and_compile(config, form_data, ds, run_compile_check=False)
        assert not result.success
        assert result.error_obj is not None
        assert result.error_obj.error_code == "INVALID_FILTER_CLAUSE"

    @pytest.mark.parametrize(
        ("clause", "suggested"),
        [("HAVING", False), ("WHERE", False)],
    )
    def test_metric_suggestions_follow_the_filter_clause(
        self, clause: str, suggested: bool
    ) -> None:
        """Unsupported HAVING and physical-only WHERE must not suggest metrics."""
        ds = _orm_dataset()
        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="gender")]
        )
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": clause,
                    "subject": "sum_boy",  # near-miss of the saved metric
                    "operator": ">",
                    "comparator": "0",
                }
            ]
        }
        result = validate_and_compile(config, form_data, ds, run_compile_check=False)
        assert not result.success
        assert result.error_obj is not None
        assert ("sum_boys" in result.error_obj.suggestions) is suggested


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
    "query_payload",
    [
        {"status": "FAILED", "message": "top-level failure", "queries": []},
        {"error_message": "top-level failure", "queries": []},
        {"queries": [{"status": "failed", "message": "boom", "data": []}]},
        {
            "queries": [
                {"status": "success", "data": [{"value": 1}]},
                {"status": "ERROR", "error_message": "second failed", "data": []},
            ]
        },
    ],
)
@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_chart_rejects_embedded_query_failures(
    mock_factory, mock_cmd_cls, query_payload
):
    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.run.return_value = query_payload

    result = _compile_chart({"viz_type": "table", "columns": ["value"]}, 1)

    assert not result.success
    assert result.error_code == "CHART_COMPILE_FAILED"
    assert result.tier == "compile"
    assert result.error_obj is not None
    assert result.error_obj.error_type == "compile_error"


@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_chart_allows_success_message_with_valid_empty_data(
    mock_factory, mock_cmd_cls
):
    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.run.return_value = {
        "status": "success",
        "message": "served from cache",
        "queries": [{"status": "SUCCESS", "message": "no rows", "data": []}],
    }

    result = _compile_chart({"viz_type": "table", "columns": ["value"]}, 1)

    assert result.success
    assert result.row_count == 0


@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_chart_big_number_uses_temporal_query_contract(
    mock_factory, mock_cmd_cls
):
    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.run.return_value = {"queries": [{"data": []}]}
    form_data = {
        "viz_type": "big_number",
        "granularity_sqla": "event_time",
        "metric": "count",
        "aggregation": "LAST_VALUE",
        "time_range": "Last week",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "region",
                "operator": "==",
                "comparator": "EMEA",
            }
        ],
    }

    result = _compile_chart(form_data, 1)

    assert result.success
    query = mock_factory.return_value.create.call_args.kwargs["queries"][0]
    assert query["metrics"] == ["count"]
    assert query["time_range"] == "Last week"
    assert query["filters"] == [{"col": "region", "op": "==", "val": "EMEA"}]
    assert query["row_limit"] == 2
    # A legacy granularity trendline keeps its temporal dimension through the
    # granularity binding rather than a groupby column, matching buildQuery.
    assert query["columns"] == []
    assert query["granularity"] == "event_time"
    assert query["is_timeseries"] is True


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
def test_compile_chart_seeds_form_data_before_query_execution(
    mock_set_form_data, mock_factory, mock_cmd_cls
):
    """Virtual-dataset Jinja sees the programmatic query before execution."""
    from superset.mcp_service.chart.compile import _compile_chart

    query_context = Mock()
    mock_factory.return_value.create.return_value = query_context
    mock_cmd_cls.return_value.validate.return_value = None
    call_order: list[str] = []
    mock_set_form_data.side_effect = lambda *args: call_order.append("seed")
    producer_result = chart_data_command_result(
        [{"event_time": pd.Timestamp("2026-09-02T10:11:12Z"), "value": np.int64(1)}],
        columns=["event_time", "value"],
        coltypes=[GenericDataType.TEMPORAL, GenericDataType.NUMERIC],
    )
    mock_cmd_cls.return_value.run.side_effect = lambda: (
        call_order.append("run") or producer_result
    )

    result = _compile_chart(
        {"metrics": [{"label": "count", "expressionType": "SIMPLE"}]},
        dataset_id=42,
    )

    assert result.success, result.error
    mock_set_form_data.assert_called_once_with(query_context, 42, "table")
    assert call_order == ["seed", "run"]


@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
@patch("superset.charts.data.form_data.set_query_context_form_data")
def test_compile_chart_strictly_validates_every_query_result(
    mock_set_form_data, mock_factory, mock_cmd_cls
):
    """A valid primary result cannot hide hostile secondary query data."""
    from superset.mcp_service.chart.compile import _compile_chart

    class HostileList(list):
        def __iter__(self):
            raise AssertionError("hostile secondary list hook executed")

    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.run.return_value = {
        "queries": [{"data": [{"value": 1}]}, {"data": HostileList()}]
    }

    result = _compile_chart(
        {"metrics": [{"label": "count", "expressionType": "SIMPLE"}]},
        dataset_id=42,
    )

    assert not result.success
    assert result.error_code == "CHART_COMPILE_FAILED"
    assert "query 2 result data" in (result.error or "").lower()


@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
@patch("superset.charts.data.form_data.set_query_context_form_data")
def test_compile_chart_rejects_hostile_enum_without_dispatching_hooks(
    mock_set_form_data, mock_factory, mock_cmd_cls
):
    from enum import Enum

    from superset.mcp_service.chart.compile import _compile_chart

    class HostileEnum(Enum):
        VALUE = "hostile"

        def __getattribute__(self, name):
            if name == "value":
                raise AssertionError("hostile enum value hook executed")
            return object.__getattribute__(self, name)

        def __str__(self):
            raise AssertionError("hostile enum string hook executed")

    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.run.return_value = {
        "queries": [{"data": [{"value": HostileEnum.VALUE}]}]
    }

    result = _compile_chart(
        {"metrics": [{"label": "count", "expressionType": "SIMPLE"}]},
        dataset_id=42,
    )

    assert not result.success
    assert result.error_code == "CHART_COMPILE_FAILED"
    assert "hostile" in (result.error or "").lower()


@pytest.mark.parametrize(
    "value",
    [10**5000, b"\xff" * 65_537, QueryStatus.SUCCESS],
    ids=["huge-int", "oversized-bytes", "query-status"],
)
@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
@patch("superset.charts.data.form_data.set_query_context_form_data")
def test_compile_chart_rejects_unbounded_or_noncanonical_scalars(
    mock_set_form_data, mock_factory, mock_cmd_cls, value
):
    from superset.mcp_service.chart.compile import _compile_chart

    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.run.return_value = {
        "queries": [
            {
                "data": [{"value": value}],
                "colnames": ["value"],
                "coltypes": [0],
            }
        ]
    }

    result = _compile_chart(
        {"metrics": [{"label": "count", "expressionType": "SIMPLE"}]},
        dataset_id=42,
    )

    assert not result.success
    assert result.error_code == "CHART_COMPILE_FAILED"
    assert result.error_obj is not None
    assert result.error_obj.error_type == "compile_error"


@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
@patch("superset.charts.data.form_data.set_query_context_form_data")
def test_compile_chart_canonicalizes_dataframe_nan_to_null(
    mock_set_form_data, mock_factory, mock_cmd_cls
):
    from superset.mcp_service.chart.compile import _compile_chart

    query = {
        "data": [{"value": float("nan")}],
        "colnames": ["value"],
        "coltypes": [0],
    }
    mock_factory.return_value.create.return_value = Mock()
    mock_cmd_cls.return_value.run.return_value = {"queries": [query]}

    result = _compile_chart(
        {"metrics": [{"label": "count", "expressionType": "SIMPLE"}]},
        dataset_id=42,
    )

    assert result.success
    assert query["data"] == [{"value": None}]


@pytest.mark.parametrize("having_first", [True, False])
def test_simple_having_is_rejected_with_multiple_filters(having_first: bool) -> None:
    """Keep HAVING rejection independent of the order of valid filter subjects."""
    filters = [
        {
            "expressionType": "SIMPLE",
            "clause": "HAVING",
            "subject": "sum_boys",
            "operator": ">",
            "comparator": "0",
        },
        {
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": "gender",
            "operator": "==",
            "comparator": "boy",
        },
    ]
    if not having_first:
        filters.reverse()
    result = validate_and_compile(
        TableChartConfig(chart_type="table", columns=[ColumnRef(name="gender")]),
        {"adhoc_filters": filters},
        _orm_dataset(),
        run_compile_check=False,
    )
    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_code == "UNSUPPORTED_FILTER_CLAUSE"


@pytest.mark.parametrize("slot", ["metric", "secondary_metric"])
def test_sunburst_metric_slot_typo_gets_saved_metric_hint(slot: str) -> None:
    """Both sunburst metric slots guide near misses toward saved metrics."""
    config = SunburstChartConfig.model_validate(
        {
            "chart_type": "sunburst",
            "columns": [{"name": "gender"}],
            "metric": {"name": "num", "aggregate": "SUM"},
            slot: {"name": "num_boys", "aggregate": "SUM"},
        }
    )
    result = validate_and_compile(config, {}, _orm_dataset(), run_compile_check=False)
    assert not result.success
    assert result.tier == "validation"
    assert result.error_obj is not None
    _assert_saved_metric_hint(result.error_obj)


@patch("superset.charts.data.form_data.set_query_context_form_data")
@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_sample_skips_rolling_and_forecast(
    mock_factory: Mock, mock_command: Mock, mock_seed: Mock
) -> None:
    """A two-row compile sample cannot validate seven-period analytics."""
    from copy import deepcopy

    from superset.utils import pandas_postprocessing as pp

    form_data = {
        "viz_type": "echarts_timeseries_line",
        "x_axis": "ds",
        "metrics": ["revenue"],
        "time_grain_sqla": "P1D",
        "rolling_type": "mean",
        "rolling_periods": 7,
        "min_periods": 7,
        "forecastEnabled": True,
        "forecastPeriods": 10,
        "forecastInterval": 0.8,
    }
    original = deepcopy(form_data)

    def run_sample() -> dict[str, Any]:
        """Execute the real query operators against the bounded sample."""
        query = mock_factory.return_value.create.call_args.kwargs["queries"][0]
        assert query["row_limit"] == 2
        frame = pd.DataFrame(
            {"ds": pd.date_range("2026-01-01", periods=2), "revenue": [1.0, 2.0]}
        )
        for step in query["post_processing"]:
            frame = getattr(pp, step["operation"])(frame, **step.get("options", {}))
        return chart_data_command_result(frame.to_dict("records"))

    mock_command.return_value.run.side_effect = run_sample
    result = _compile_chart(form_data, 7)
    assert result.success, result.error
    assert result.row_count == 2
    assert form_data == original
    sampled = mock_factory.return_value.create.call_args.kwargs["queries"][0]
    assert not {"rolling", "prophet"} & {
        step["operation"] for step in sampled["post_processing"]
    }

    from superset.mcp_service.chart.chart_helpers import (
        build_query_dicts_from_form_data,
    )

    full = build_query_dicts_from_form_data(
        {**form_data, "datasource": "7__table"}, 7, "table"
    )[0]
    assert {"rolling", "prophet"} <= {
        step["operation"] for step in full["post_processing"]
    }


@patch("superset.charts.data.form_data.set_query_context_form_data")
@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_sample_skips_forecast_for_grouped_series_on_one_timestamp(
    mock_factory: Mock, mock_command: Mock, mock_seed: Mock
) -> None:
    """Two grouped sample rows on one day must not reach the Prophet step."""
    from superset.utils import pandas_postprocessing as pp

    form_data = {
        "viz_type": "echarts_timeseries_line",
        "x_axis": "ds",
        "metrics": ["revenue"],
        "groupby": ["region"],
        "time_grain_sqla": "P1D",
        "forecastEnabled": True,
        "forecastPeriods": 10,
        "forecastInterval": 0.8,
    }

    def run_sample() -> dict[str, Any]:
        """Execute the real query operators against the bounded sample."""
        query = mock_factory.return_value.create.call_args.kwargs["queries"][0]
        assert query["row_limit"] == 2
        frame = pd.DataFrame(
            {
                "ds": [pd.Timestamp("2026-01-01")] * 2,
                "region": ["East", "West"],
                "revenue": [1.0, 2.0],
            }
        )
        for step in query["post_processing"]:
            frame = getattr(pp, step["operation"])(frame, **step.get("options", {}))
        return chart_data_command_result(frame.to_dict("records"))

    mock_command.return_value.run.side_effect = run_sample
    result = _compile_chart(form_data, 7)

    assert result.success, result.error
    sampled = mock_factory.return_value.create.call_args.kwargs["queries"][0]
    assert "prophet" not in {step["operation"] for step in sampled["post_processing"]}


@pytest.mark.parametrize("run_compile_check", [False, True])
@pytest.mark.parametrize(
    "clause,subject,error_code",
    [
        ("HAVING", "sum_boys", "UNSUPPORTED_FILTER_CLAUSE"),
        (None, "gender", "INVALID_FILTER_CLAUSE"),
        ("WHERE", "missing_column", "CHART_VALIDATION_FAILED"),
        ("WHERE", "gender", None),
    ],
)
def test_mixed_secondary_filters_receive_tier_one_validation(
    clause: str | None, subject: str, error_code: str | None, run_compile_check: bool
) -> None:
    """Query B must not silently drop filters that query A would reject."""
    from superset.mcp_service.chart.chart_utils import map_mixed_timeseries_config

    config = MixedTimeseriesChartConfig.model_validate(
        {
            "chart_type": "mixed_timeseries",
            "x": {"name": "ds"},
            "y": [{"name": "num", "aggregate": "SUM"}],
            "y_secondary": [{"name": "num", "aggregate": "AVG"}],
            "adhoc_filters_b": [
                {
                    "expressionType": "SIMPLE",
                    "clause": clause,
                    "subject": subject,
                    "operator": ">",
                    "comparator": 100,
                }
            ],
        }
    )
    with patch(
        "superset.mcp_service.chart.compile._compile_chart",
        return_value=CompileResult(success=True),
    ) as compile_chart:
        result = validate_and_compile(
            config,
            map_mixed_timeseries_config(config),
            _orm_dataset(),
            run_compile_check=run_compile_check,
        )
    assert result.success == (error_code is None)
    if error_code:
        assert result.tier == "validation"
        assert result.error_obj is not None
        assert result.error_obj.error_code == error_code
        compile_chart.assert_not_called()


@patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
@patch("superset.common.query_context_factory.QueryContextFactory")
def test_compile_chart_returns_structured_error_for_malformed_gantt_form_data(
    mock_factory: Mock, mock_cmd_cls: Mock
) -> None:
    """Gantt query building raises QueryObjectValidationError, which is not a
    CommandException; compile must still return CHART_COMPILE_FAILED."""
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
        "tooltip_columns": [f"column_{index}" for index in range(51)],
    }

    result = _compile_chart(form_data, 1)

    assert not result.success
    assert result.error_code == "CHART_COMPILE_FAILED"
    assert result.tier == "compile"
    assert result.error_obj is not None
    assert result.error_obj.error_type == "compile_error"
    assert "tooltip_columns must contain at most 50 entries" in (result.error or "")
    mock_cmd_cls.assert_not_called()


@pytest.mark.parametrize(
    "message",
    [
        "Error in jinja expression in metric expression: "
        "Unsafe template value for key time_grain: TimeGrain",
        "Invalid post-processing operation",
    ],
)
def test_compile_chart_validation_failure_is_not_connection_error(
    mocker: MockerFixture, message: str
) -> None:
    """Typed template/processing failures must bypass generic DB classification."""
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.exceptions import (
        QueryObjectValidationError,
        QueryObjectValidationMessage,
    )

    context = Mock()
    context.get_payload.return_value = {
        "queries": [
            {"error": QueryObjectValidationMessage(QueryObjectValidationError(message))}
        ]
    }
    mocker.patch(
        "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
        return_value=context,
    )
    mocker.patch("superset.charts.data.form_data.set_query_context_form_data")
    dataset = Mock()
    dataset.database.db_engine_spec = BaseEngineSpec
    mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset)

    result = _compile_chart({"metrics": ["count"]}, dataset_id=1)

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == "compile_error"
    assert result.error_obj.error_code == "CHART_COMPILE_FAILED"
    assert message in result.error_obj.details


@pytest.mark.parametrize(
    ("message", "validation_failure", "expected_error_type"),
    [
        (
            "(psycopg2.OperationalError) connection to server failed: "
            "Connection refused",
            False,
            "database_connection_error",
        ),
        (
            "Unsafe template value for key time_grain: TimeGrain",
            True,
            "compile_error",
        ),
        ("Invalid post-processing operation", True, "compile_error"),
    ],
)
def test_compile_chart_annotation_failure_preserves_error_classification(
    mocker: MockerFixture,
    message: str,
    validation_failure: bool,
    expected_error_type: str,
) -> None:
    """Annotation failures retain their classification through validation wraps."""
    from superset.common.query_context_processor import QueryContextProcessor
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.exceptions import (
        QueryObjectValidationError,
        QueryObjectValidationMessage,
    )

    annotation_context = Mock(queries=[])
    annotation_error = (
        QueryObjectValidationMessage(QueryObjectValidationError(message))
        if validation_failure
        else message
    )
    annotation_context.get_payload.return_value = {
        "queries": [{"error": annotation_error}]
    }
    chart = Mock()
    chart.get_query_context.return_value = annotation_context
    mocker.patch(
        "superset.common.query_context_processor.ChartDAO.find_by_id",
        return_value=chart,
    )

    def get_payload(**kwargs: Any) -> dict[str, Any]:
        """Record the annotation error like the main query processor."""
        try:
            QueryContextProcessor.get_viz_annotation_data(
                {"value": 2, "name": "annotation"}, force=False
            )
        except QueryObjectValidationError as exc:
            return {"queries": [{"error": QueryObjectValidationMessage(exc)}]}
        raise AssertionError("Expected the annotation query to fail")

    context = Mock()
    context.get_payload.side_effect = get_payload
    mocker.patch(
        "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
        return_value=context,
    )
    mocker.patch("superset.charts.data.form_data.set_query_context_form_data")
    dataset = Mock()
    dataset.database.db_engine_spec = BaseEngineSpec
    mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset)

    result = _compile_chart({"metrics": ["count"]}, dataset_id=1)

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == expected_error_type
    assert message in result.error_obj.details


_POSTGRES_CONNECTION_REFUSED = (
    "(psycopg2.OperationalError) could not connect to server: Connection refused\n"
    '\tIs the server running on host "db.example" (10.0.0.1) and accepting\n'
    "\tTCP/IP connections on port 5432?"
)


def _annotation_compile_result(
    mocker: MockerFixture,
    annotation_failure: str | Exception,
    *,
    dataset_engine_spec: Any,
    annotation_engine_spec: Any | None = None,
    other_annotation_engine_spec: Any | None = None,
    annotation_key: str = "annotation_layers",
    other_annotation_key: str = "annotation_layers",
) -> Any:
    """Compile a chart whose first line annotation chart fails.

    ``other_annotation_engine_spec`` adds a second, healthy annotation chart on
    another engine, so the exception alone does not say which engine failed.

    ``annotation_failure`` is either the annotation query's payload error text or
    an exception raised while the annotation chart builds its payload.
    """
    from superset.common.query_context_processor import QueryContextProcessor
    from superset.exceptions import (
        QueryObjectValidationError,
        QueryObjectValidationMessage,
    )

    annotation_context = Mock(queries=[])
    if isinstance(annotation_failure, Exception):
        annotation_context.get_payload.side_effect = annotation_failure
    else:
        annotation_context.get_payload.return_value = {
            "queries": [{"error": annotation_failure}]
        }
    chart = Mock()
    chart.get_query_context.return_value = annotation_context
    if annotation_engine_spec is None:
        chart.datasource = None
    else:
        chart.datasource.database.db_engine_spec = annotation_engine_spec
    other_chart = Mock()
    other_chart.datasource.database.db_engine_spec = other_annotation_engine_spec
    mocker.patch(
        "superset.daos.chart.ChartDAO.find_by_id",
        side_effect=lambda chart_id: other_chart if chart_id == 3 else chart,
    )
    layer = {
        "annotationType": "TIME_SERIES",
        "name": "annotation",
        "sourceType": "line",
        "value": 2,
    }
    form_data: dict[str, Any] = {"metrics": ["count"], annotation_key: [layer]}
    if annotation_key == "annotation_layers_b":
        form_data["viz_type"] = "mixed_timeseries"
    if other_annotation_engine_spec is not None:
        form_data.setdefault(other_annotation_key, []).append(
            {**layer, "name": "other annotation", "value": 3}
        )

    def get_payload(**kwargs: Any) -> dict[str, Any]:
        """Record the annotation error like the main query processor."""
        try:
            QueryContextProcessor.get_viz_annotation_data(layer, force=False)
        except QueryObjectValidationError as exc:
            return {"queries": [{"error": QueryObjectValidationMessage(exc)}]}
        raise AssertionError("Expected the annotation query to fail")

    context = Mock()
    context.get_payload.side_effect = get_payload
    mocker.patch(
        "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
        return_value=context,
    )
    mocker.patch("superset.charts.data.form_data.set_query_context_form_data")
    dataset = Mock()
    dataset.database.db_engine_spec = dataset_engine_spec
    mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset)

    return _compile_chart(form_data, dataset_id=1)


@pytest.mark.parametrize(
    ("message", "expected_error_type"),
    [
        (_POSTGRES_CONNECTION_REFUSED, "database_connection_error"),
        (
            '(psycopg2.errors.SyntaxError) syntax error at or near "FROMM"',
            "compile_error",
        ),
    ],
)
def test_compile_chart_annotation_failure_uses_engine_error_patterns(
    mocker: MockerFixture, message: str, expected_error_type: str
) -> None:
    """Only the engine's connection patterns make an annotation failure a DB error.

    PostgresEngineSpec recognizes both texts, so a syntax error in the
    annotation query stays a compile error instead of the generic fallback.
    """
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    result = _annotation_compile_result(
        mocker,
        message,
        dataset_engine_spec=PostgresEngineSpec,
        annotation_engine_spec=PostgresEngineSpec,
    )

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == expected_error_type
    assert message in result.error_obj.details


def test_compile_chart_annotation_dbapi_error_is_connection_error(
    mocker: MockerFixture,
) -> None:
    """A typed DB-API failure raised outside the annotation query stays a DB error.

    The annotation chart raises it before any payload exists, so the chain holds
    no chart-data query failure, only the typed engine error.
    """
    from superset.db_engine_specs.exceptions import SupersetDBAPIOperationalError
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    result = _annotation_compile_result(
        mocker,
        SupersetDBAPIOperationalError(_POSTGRES_CONNECTION_REFUSED),
        dataset_engine_spec=PostgresEngineSpec,
        annotation_engine_spec=PostgresEngineSpec,
    )

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == "database_connection_error"


@pytest.mark.parametrize(
    ("message", "expected_error_type"),
    [
        (
            "(MySQLdb.OperationalError) (2003, \"Can't connect to MySQL server "
            "on 'mysql.example' (111)\")",
            "database_connection_error",
        ),
        (
            "(MySQLdb.ProgrammingError) (1064, 'You have an error in your SQL "
            "syntax; check the manual that corresponds to your MySQL server "
            "version for the right syntax to use near 'FROMM x' at line 1')",
            "compile_error",
        ),
    ],
)
def test_compile_chart_annotation_failure_uses_annotation_engine_spec(
    mocker: MockerFixture, message: str, expected_error_type: str
) -> None:
    """An annotation chart's failure is classified by its own database's engine.

    The main dataset is on Postgres, whose patterns match neither MySQL text and
    so fall back to the generic engine error.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    result = _annotation_compile_result(
        mocker,
        message,
        dataset_engine_spec=PostgresEngineSpec,
        annotation_engine_spec=MySQLEngineSpec,
    )

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == expected_error_type
    if expected_error_type == "database_connection_error":
        assert "annotation layer" in result.error_obj.message


def test_classify_as_database_error_stops_on_cyclic_cause_chain() -> None:
    """A cyclic ``__cause__`` chain ends the walk instead of looping forever."""
    from superset.commands.chart.exceptions import ChartDataQueryValidationError
    from superset.exceptions import QueryObjectValidationError
    from superset.mcp_service.chart.compile import _classify_as_database_error

    outer = ChartDataQueryValidationError("Error: annotation failed")
    cause_reads = 0

    class BoundedValidationError(QueryObjectValidationError):
        """Fail synchronously if the cycle guard stops bounding the walk."""

        def __getattribute__(self, name: str) -> Any:
            nonlocal cause_reads
            if name == "__cause__":
                cause_reads += 1
                assert cause_reads <= 2, "cause-chain walk revisited the cycle"
            return super().__getattribute__(name)

    inner = BoundedValidationError("annotation failed")
    outer.__cause__ = inner
    inner.__cause__ = outer
    assert _classify_as_database_error(outer, {}, 1) is None
    assert cause_reads == 1


def test_compile_chart_annotation_syntax_error_with_several_engines_is_not_connection(
    mocker: MockerFixture,
) -> None:
    """Which annotation engine failed is unknown, so no generic fallback applies.

    Two annotation charts sit on Postgres and MySQL. A MySQL syntax error matches
    no specific connection pattern; an engine's generic fallback must not turn it
    into a database connection error.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    message = (
        "(MySQLdb.ProgrammingError) (1064, 'You have an error in your SQL "
        "syntax; check the manual that corresponds to your MySQL server "
        "version for the right syntax to use near 'FROMM x' at line 1')"
    )
    result = _annotation_compile_result(
        mocker,
        message,
        dataset_engine_spec=PostgresEngineSpec,
        annotation_engine_spec=MySQLEngineSpec,
        other_annotation_engine_spec=PostgresEngineSpec,
    )

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == "compile_error"
    assert message in result.error_obj.details


def test_compile_chart_annotation_connection_error_with_several_engines(
    mocker: MockerFixture,
) -> None:
    """A specific connection pattern still classifies with several engines."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    result = _annotation_compile_result(
        mocker,
        _POSTGRES_CONNECTION_REFUSED,
        dataset_engine_spec=MySQLEngineSpec,
        annotation_engine_spec=PostgresEngineSpec,
        other_annotation_engine_spec=MySQLEngineSpec,
    )

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == "database_connection_error"
    assert "annotation layer's chart" in result.error_obj.message


@pytest.mark.parametrize("with_query_a_layer", [False, True])
@pytest.mark.parametrize(
    ("message", "expected_error_type"),
    [
        (
            "(MySQLdb.OperationalError) (2003, \"Can't connect to MySQL server "
            "on 'mysql.example' (111)\")",
            "database_connection_error",
        ),
        (
            "(MySQLdb.ProgrammingError) (1064, 'You have an error in your SQL "
            "syntax; check the manual that corresponds to your MySQL server "
            "version for the right syntax to use near 'FROMM x' at line 1')",
            "compile_error",
        ),
    ],
)
def test_compile_chart_mixed_timeseries_query_b_annotation_failure(
    mocker: MockerFixture,
    with_query_a_layer: bool,
    message: str,
    expected_error_type: str,
) -> None:
    """Query B contributes both the annotation source and possible failing engines."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    result = _annotation_compile_result(
        mocker,
        message,
        dataset_engine_spec=PostgresEngineSpec,
        annotation_engine_spec=MySQLEngineSpec,
        other_annotation_engine_spec=(
            PostgresEngineSpec if with_query_a_layer else None
        ),
        annotation_key="annotation_layers_b",
    )

    assert not result.success
    assert result.error_obj is not None
    assert result.error_obj.error_type == expected_error_type
    assert message in result.error_obj.details
    if expected_error_type == "database_connection_error":
        assert "annotation layer's chart" in result.error_obj.message


@pytest.mark.parametrize("source", ["dataset", "annotation"])
def test_classification_debug_log_identifies_candidate_engine_source(
    mocker: MockerFixture, source: str
) -> None:
    """Engine lookup failures identify the source, not an annotation dataset."""
    from superset.commands.chart.exceptions import (
        ChartDataQueryFailedError,
        ChartDataQueryValidationError,
    )
    from superset.mcp_service.chart.compile import _classify_as_database_error

    failure = ChartDataQueryFailedError("query failed")
    exc: Exception = failure
    form_data: dict[str, Any] = {}
    spec = Mock()
    spec.extract_errors.side_effect = RuntimeError("classification failed")
    dataset = Mock()
    dataset.database.db_engine_spec = spec
    mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset)
    mocker.patch(
        "superset.mcp_service.chart.compile._annotation_engine_specs",
        return_value=([spec], True),
    )
    if source == "annotation":
        exc = ChartDataQueryValidationError("annotation failed")
        exc.__cause__ = failure
        form_data["annotation_layers"] = [{"sourceType": "line", "value": 2}]
    debug = mocker.patch("superset.mcp_service.chart.compile.logger.debug")

    assert _classify_as_database_error(exc, form_data, 1) is None
    debug.assert_called_once_with(
        "Failed to classify %s error via candidate engine specs (main dataset %s): %s",
        source,
        1,
        exc,
    )


class TestTemporalFilterValues:
    """A non-date comparator on a temporal column is rejected before any SQL."""

    @staticmethod
    def _dataset() -> Mock:
        from superset.db_engine_specs.sqlite import SqliteEngineSpec

        ds = _orm_dataset()
        ds.database.db_engine_spec = SqliteEngineSpec
        for col in ds.columns:
            col.is_dttm = col.column_name == "ds"
            col.type = "DATETIME" if col.column_name == "ds" else "TEXT"
        return ds

    @staticmethod
    def _config(op: str, value: Any) -> XYChartConfig:
        return XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="ds"),
            y=[ColumnRef(name="num", aggregate="SUM")],
            kind="line",
            filters=[FilterConfig(column="ds", op=op, value=value)],
        )

    @pytest.mark.parametrize(
        "value",
        [
            "2000",
            "not-a-date",
            "2000-01-01😀12:30:00",
            "2000-01-01T12:00:00+00:99",
            float("inf"),
            float("nan"),
            10**30,
        ],
    )
    def test_invalid_value_rejected(self, value):
        result = validate_and_compile(
            self._config(">=", value), {}, self._dataset(), run_compile_check=False
        )
        assert not result.success
        assert result.tier == "validation"
        assert result.error_obj is not None
        assert result.error_obj.error_code == "INVALID_TEMPORAL_FILTER_VALUE"

    @pytest.mark.parametrize(
        ("op", "value"),
        [(">=", "2000-01-01"), (">=", 946684800000), ("IN", ["2000-01-01"])],
    )
    def test_valid_value_accepted(self, op, value):
        result = validate_and_compile(
            self._config(op, value), {}, self._dataset(), run_compile_check=False
        )
        assert result.success, result.error


@pytest.mark.parametrize("native_key", ["adhoc_filters", "adhoc_filters_b"])
@pytest.mark.parametrize("run_compile_check", [False, True])
def test_preserved_temporal_comparator_is_validated(
    native_key: str, run_compile_check: bool
) -> None:
    """An update omitting filters must validate the final merged predicates."""
    from superset.mcp_service.chart.chart_utils import merge_form_data_for_update

    config = MixedTimeseriesChartConfig(
        chart_type="mixed_timeseries",
        x=ColumnRef(name="ds"),
        y=[ColumnRef(name="num", aggregate="SUM")],
        y_secondary=[ColumnRef(name="num", aggregate="SUM")],
    )
    filter_ = {
        "expressionType": "SIMPLE",
        "clause": "WHERE",
        "subject": "ds",
        "operator": ">=",
        "comparator": "2000",
    }
    form_data = merge_form_data_for_update(
        {"viz_type": "mixed_timeseries", native_key: [filter_]},
        {"viz_type": "mixed_timeseries"},
        config,
    )
    assert form_data[native_key] == [filter_]
    with patch("superset.mcp_service.chart.compile._compile_chart") as compile_chart:
        result = validate_and_compile(
            config,
            form_data,
            TestTemporalFilterValues._dataset(),
            run_compile_check=run_compile_check,
        )
    assert result.success is False
    assert result.error_obj is not None
    assert result.error_obj.error_code == "INVALID_TEMPORAL_FILTER_VALUE"
    compile_chart.assert_not_called()


@pytest.mark.parametrize("preserved", [False, True])
def test_temporal_storage_format_is_preserved(preserved: bool) -> None:
    """Formatted VARCHAR dates must reach SQL without ISO substitution."""
    ds = TestTemporalFilterValues._dataset()
    ds.columns[0].type = "VARCHAR"
    ds.columns[0].python_date_format = "%Y%m%d"
    config = TestTemporalFilterValues._config("=", "20000101")
    form_data = {}
    if preserved:
        config = config.model_copy(update={"filters": None})
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "ds",
                    "operator": "=",
                    "comparator": "20000101",
                }
            ],
        }
    with patch(
        "superset.mcp_service.chart.compile._compile_chart",
        return_value=CompileResult(success=True),
    ) as compile_chart:
        result = validate_and_compile(config, form_data, ds)
    assert result.success is True, result.error
    compile_chart.assert_called_once_with(form_data, ds.id)

    import sqlite3

    from superset.connectors.sqla.models import SqlaTable
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    comparator = SqlaTable.filter_values_handler(
        "20000101",
        "==",
        GenericDataType.STRING,
        "VARCHAR",
        db_engine_spec=SqliteEngineSpec,
    )
    assert comparator == "20000101"
    with sqlite3.connect(":memory:") as connection:
        connection.execute("CREATE TABLE events (ds VARCHAR)")
        connection.execute("INSERT INTO events VALUES (?)", ("20000101",))
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM events WHERE ds = ?", (comparator,)
            ).fetchone()[0]
            == 1
        )
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM events WHERE ds = ?", ("2000-01-01",)
            ).fetchone()[0]
            == 0
        )
    if preserved:
        assert form_data["adhoc_filters"][0]["comparator"] == "20000101"


@pytest.mark.parametrize("operator", ["IN", "NOT IN"])
def test_preserved_temporal_null_membership_is_accepted(operator: str) -> None:
    """The final-form validator must preserve SQL null-membership semantics."""
    result = validate_and_compile(
        TableChartConfig(chart_type="table", columns=[ColumnRef(name="ds")]),
        {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "ds",
                    "operator": operator,
                    "comparator": ["2000-01-01", None],
                }
            ]
        },
        TestTemporalFilterValues._dataset(),
        run_compile_check=False,
    )
    assert result.success is True, result.error


@pytest.mark.parametrize("value", ["2000-01-01", "2000"])
def test_native_temporal_ignores_storage_format(value: str) -> None:
    """A format on a native DATETIME must not override its actual SQL type."""
    ds = TestTemporalFilterValues._dataset()
    ds.columns[0].python_date_format = "%Y"
    result = validate_and_compile(
        TestTemporalFilterValues._config("=", value), {}, ds, run_compile_check=False
    )
    assert result.success is (value == "2000-01-01")


@pytest.mark.parametrize("value", ["2000-01-01", 946684800000])
@pytest.mark.parametrize("preserved", [False, True])
def test_temporal_storage_format_rejects_wrong_representation(
    value: str | int, preserved: bool
) -> None:
    """ISO and epoch inputs cannot be forwarded unchanged to YYYYMMDD storage."""
    ds = TestTemporalFilterValues._dataset()
    ds.columns[0].type = "VARCHAR"
    ds.columns[0].python_date_format = "%Y%m%d"
    config = TestTemporalFilterValues._config("=", value)
    form_data = {}
    if preserved:
        config = config.model_copy(update={"filters": None})
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "ds",
                    "operator": "=",
                    "comparator": value,
                }
            ]
        }
    result = validate_and_compile(config, form_data, ds, run_compile_check=False)
    assert result.success is False
    assert result.error_obj is not None
    assert result.error_obj.error_code == "INVALID_TEMPORAL_FILTER_VALUE"
    assert "%Y%m%d" in result.error_obj.details


@pytest.mark.parametrize("suffix", ["", "_b"])
@pytest.mark.parametrize(
    "source",
    [
        "filters",
        "extra_filters",
        "extra_form_data.filters",
        "extra_form_data.adhoc_filters",
    ],
)
def test_preserved_temporal_predicate_aliases_are_validated(
    source: str, suffix: str
) -> None:
    """Legacy/native filter containers feed the same final query predicates."""
    filter_ = {"col": "ds", "op": ">=", "val": "2000"}
    if source.endswith("adhoc_filters"):
        filter_ = {
            "expressionType": "SIMPLE",
            "subject": "ds",
            "operator": ">=",
            "comparator": "2000",
        }
    root, _, nested = source.partition(".")
    form_data = {
        "viz_type": "mixed_timeseries",
        root + suffix: {nested: [filter_]} if nested else [filter_],
    }
    config = MixedTimeseriesChartConfig(
        chart_type="mixed_timeseries",
        x=ColumnRef(name="ds"),
        y=[ColumnRef(name="num", aggregate="SUM")],
        y_secondary=[ColumnRef(name="num", aggregate="SUM")],
    )
    result = validate_and_compile(
        config, form_data, TestTemporalFilterValues._dataset(), run_compile_check=False
    )
    assert result.success is False
    assert result.error_obj is not None
    assert result.error_obj.error_code == "INVALID_TEMPORAL_FILTER_VALUE"


@pytest.mark.parametrize("suffix", ["", "_b"])
def test_preserved_legacy_time_override_is_not_a_point_comparison(suffix: str) -> None:
    """Legacy time control pseudo-columns are not physical temporal literals."""
    config = MixedTimeseriesChartConfig(
        chart_type="mixed_timeseries",
        x=ColumnRef(name="ds"),
        y=[ColumnRef(name="num", aggregate="SUM")],
        y_secondary=[ColumnRef(name="num", aggregate="SUM")],
    )
    result = validate_and_compile(
        config,
        {
            "viz_type": "mixed_timeseries",
            "extra_filters" + suffix: [
                {"col": "__time_range", "op": "==", "val": "Last year"}
            ],
        },
        TestTemporalFilterValues._dataset(),
        run_compile_check=False,
    )
    assert result.success is True, result.error


@pytest.mark.parametrize("suffix", ["", "_b"])
@pytest.mark.parametrize(
    "source",
    [
        "filters",
        "extra_filters",
        "extra_form_data.filters",
        "extra_form_data.adhoc_filters",
    ],
)
def test_semantic_temporal_predicate_aliases_are_validated(
    source: str, suffix: str
) -> None:
    """The semantic-view proxy must not discard native filter containers."""
    from superset.mcp_service.chart.datasource_resolver import (
        ChartDatasource,
        validate_semantic_view_form_data,
    )
    from superset.utils.core import DatasourceType

    column = Mock(column_name="ds", type="TIMESTAMP", is_dttm=True)
    view = Mock(columns=[column], metrics=[])
    target = ChartDatasource(view, DatasourceType.SEMANTIC_VIEW, 7, "events")
    filter_ = {"col": "ds", "op": ">=", "val": "2000"}
    if source.endswith("adhoc_filters"):
        filter_ = {
            "expressionType": "SIMPLE",
            "subject": "ds",
            "operator": ">=",
            "comparator": "2000",
        }
    root, _, nested = source.partition(".")
    form_data = {
        "viz_type": "mixed_timeseries",
        root + suffix: {nested: [filter_]} if nested else [filter_],
    }
    error = validate_semantic_view_form_data(form_data, target)
    assert error is not None
    assert error.error_code == "INVALID_TEMPORAL_FILTER_VALUE"


@pytest.mark.parametrize("operator", ["IN", "NOT IN", "==", "!="])
@pytest.mark.parametrize("sentinel", ["<NULL>", "<empty string>", "\t<NULL>\n"])
def test_temporal_sentinels_reach_chart_compilation(
    operator: str, sentinel: str
) -> None:
    """Retained Explore filters preserve sentinel comparators through validation."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.utils.core import FilterValues

    value: FilterValues = (
        [sentinel, "2000-01-01"] if operator in {"IN", "NOT IN"} else sentinel
    )
    config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="ds")])
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "ds",
                "operator": operator,
                "comparator": value,
            }
        ]
    }
    with patch(
        "superset.mcp_service.chart.compile._compile_chart",
        return_value=CompileResult(success=True),
    ) as compile_chart:
        result = validate_and_compile(
            config, form_data, TestTemporalFilterValues._dataset()
        )
    assert result.success is True, result.error
    compile_chart.assert_called_once_with(form_data, 3)
    assert form_data["adhoc_filters"][0]["comparator"] == value
    expected = None if sentinel.strip("\t\n") == "<NULL>" else ""
    assert SqlaTable.filter_values_handler(
        value,
        operator,
        GenericDataType.TEMPORAL,
        "DATETIME",
        is_list_target=operator in {"IN", "NOT IN"},
        db_engine_spec=SqliteEngineSpec,
    ) == ([expected, "2000-01-01"] if isinstance(value, list) else expected)


@pytest.mark.parametrize("operator", ["IN", "NOT IN", "==", "!="])
@pytest.mark.parametrize("sentinel", ["<NULL>", "<empty string>"])
@pytest.mark.parametrize("suffix", ["", "_b"])
def test_semantic_temporal_sentinels_are_accepted(
    operator: str, sentinel: str, suffix: str
) -> None:
    """Semantic rebind validation shares the retained Explore sentinel rules."""
    from superset.mcp_service.chart.datasource_resolver import (
        ChartDatasource,
        validate_semantic_view_form_data,
    )
    from superset.utils.core import DatasourceType

    view = Mock(
        columns=[Mock(column_name="ds", type="TIMESTAMP", is_dttm=True)], metrics=[]
    )
    target = ChartDatasource(view, DatasourceType.SEMANTIC_VIEW, 7, "events")
    value = [sentinel, "2000-01-01"] if operator in {"IN", "NOT IN"} else sentinel
    form_data = {
        "viz_type": "mixed_timeseries",
        "adhoc_filters" + suffix: [
            {
                "expressionType": "SIMPLE",
                "subject": "ds",
                "operator": operator,
                "comparator": value,
            }
        ],
    }
    assert validate_semantic_view_form_data(form_data, target) is None


@pytest.mark.parametrize("suffix", ["", "_b"])
@pytest.mark.parametrize(
    "source",
    [
        "filters",
        "extra_filters",
        "extra_form_data.filters",
        "extra_form_data.adhoc_filters",
    ],
)
@pytest.mark.parametrize("semantic", [False, True])
def test_legacy_filter_unknown_columns_keep_reference_validation_scope(
    source: str, suffix: str, semantic: bool
) -> None:
    """Temporal validation must not add reference checks to legacy containers."""
    filter_ = {"col": "nope", "op": "in", "val": ["a"]}
    if source.endswith("adhoc_filters"):
        filter_ = {
            "expressionType": "SIMPLE",
            "subject": "nope",
            "operator": "IN",
            "comparator": ["a"],
        }
    root, _, nested = source.partition(".")
    form_data = {
        "viz_type": "mixed_timeseries",
        root + suffix: {nested: [filter_]} if nested else [filter_],
    }
    if semantic:
        from superset.mcp_service.chart.datasource_resolver import (
            ChartDatasource,
            validate_semantic_view_form_data,
        )
        from superset.utils.core import DatasourceType

        view = Mock(
            columns=[Mock(column_name="ds", type="TIMESTAMP", is_dttm=True)], metrics=[]
        )
        target = ChartDatasource(view, DatasourceType.SEMANTIC_VIEW, 7, "events")
        assert validate_semantic_view_form_data(form_data, target) is None
    else:
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="ds"),
            y=[ColumnRef(name="num", aggregate="SUM")],
            y_secondary=[ColumnRef(name="num", aggregate="SUM")],
        )
        with patch(
            "superset.mcp_service.chart.compile._compile_chart",
            return_value=CompileResult(success=True),
        ) as compile_chart:
            result = validate_and_compile(
                config, form_data, TestTemporalFilterValues._dataset()
            )
        assert result.success is True, result.error
        compile_chart.assert_called_once_with(form_data, 3)


@pytest.mark.parametrize("preserved", [False, True])
def test_unformatted_temporal_text_reaches_chart_compilation(preserved: bool) -> None:
    """SIMPLE string comparisons stay valid on is_dttm VARCHAR columns."""
    dataset = TestTemporalFilterValues._dataset()
    dataset.columns[0].type = "VARCHAR"
    dataset.columns[0].python_date_format = None
    config = TestTemporalFilterValues._config("=", "FY2000")
    if preserved:
        config = config.model_copy(update={"filters": None})
    form_data = {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "ds",
                "operator": "==",
                "comparator": "FY2000",
            }
        ]
    }
    with patch(
        "superset.mcp_service.chart.compile._compile_chart",
        return_value=CompileResult(success=True),
    ) as compile_chart:
        result = validate_and_compile(config, form_data, dataset)
    assert result.success is True, result.error
    compile_chart.assert_called_once_with(form_data, dataset.id)
    assert form_data["adhoc_filters"][0]["comparator"] == "FY2000"


@pytest.mark.parametrize("semantic", [False, True])
@pytest.mark.parametrize("secondary", [False, True])
@pytest.mark.parametrize("sent", [False, True])
@pytest.mark.parametrize("preview_mode", [False, True])
def test_update_validates_only_authored_temporal_values(
    semantic: bool, secondary: bool, sent: bool, preview_mode: bool
) -> None:
    """Untouched saved legacy filters cannot veto a replacement configuration."""
    from superset.mcp_service.chart.datasource_resolver import ChartDatasource
    from superset.mcp_service.chart.schemas import UpdateChartRequest
    from superset.mcp_service.chart.tool.update_chart import (
        _build_preview_form_data,
        _build_update_payload,
        _validate_update_against_dataset,
        _validate_update_against_semantic_view,
    )
    from superset.utils import json
    from superset.utils.core import DatasourceType

    dataset = TestTemporalFilterValues._dataset()
    bad_value = "2000" if secondary else "946684800000"
    filter_ = FilterConfig(
        column="ds",
        op=">=" if secondary else "IN",
        value=bad_value if secondary else [bad_value],
    )
    saved_filters: dict[str, Any]
    if secondary:
        config = MixedTimeseriesChartConfig(
            chart_type="mixed_timeseries",
            x=ColumnRef(name="ds"),
            y=[ColumnRef(name="sum_boys", saved_metric=True)],
            y_secondary=[ColumnRef(name="sum_girls", saved_metric=True)],
            **({"filters_secondary": [filter_]} if sent else {}),
        )
        saved_filters = {
            "adhoc_filters_b": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "ds",
                    "operator": ">=",
                    "comparator": bad_value,
                }
            ],
        }
        viz_type = "mixed_timeseries"
    else:
        config = TableChartConfig(
            columns=[ColumnRef(name="ds")],
            **({"filters": [filter_]} if sent else {}),
        )
        saved_filters = {
            "extra_form_data": {
                "filters": [{"col": "ds", "op": "IN", "val": [bad_value]}]
            },
        }
        viz_type = "table"
    datasource_type = "semantic_view" if semantic else "table"
    chart = Mock(
        id=12,
        datasource=dataset,
        datasource_id=3,
        datasource_type=datasource_type,
        viz_type=viz_type,
        params=json.dumps(
            {
                "viz_type": viz_type,
                "datasource": f"3__{datasource_type}",
                "metrics": ["sum_boys"],
                "metrics_b": ["sum_girls"],
                "granularity_sqla": "ds",
                **saved_filters,
            }
        ),
    )
    request = UpdateChartRequest(identifier=12, config=config)
    if preview_mode:
        form_data = _build_preview_form_data(request, chart, config)
    else:
        payload = _build_update_payload(request, chart, config)
        assert isinstance(payload, dict)
        form_data = json.loads(payload["params"])
    assert isinstance(form_data, dict)
    with (
        patch(
            "superset.mcp_service.chart.compile._compile_chart",
            return_value=CompileResult(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart._compile_chart",
            return_value=CompileResult(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.resolve_semantic_view",
            return_value=ChartDatasource(
                dataset, DatasourceType.SEMANTIC_VIEW, 3, "View"
            ),
        ),
    ):
        response = (
            _validate_update_against_semantic_view(config, 3, form_data)
            if semantic
            else _validate_update_against_dataset(config, form_data, chart)
        )
    if sent:
        assert response is not None
        assert response.error is not None
        assert response.error.error_code == "INVALID_TEMPORAL_FILTER_VALUE"
        assert bad_value in response.error.details
    else:
        assert response is None
        key = "adhoc_filters_b" if secondary else "extra_form_data"
        assert form_data[key] == saved_filters[key]


@pytest.mark.parametrize("storage", [None, "%Y%m%d"])
@pytest.mark.parametrize("operator", ["=", "!=", "IN", "NOT IN"])
@pytest.mark.parametrize("sentinel", ["<NULL>", "<empty string>"])
def test_authored_chart_temporal_sentinels_survive_sanitization(
    storage: str | None, operator: str, sentinel: str
) -> None:
    """Typed authoring must preserve sentinel data before temporal validation."""
    from superset.mcp_service.chart.chart_utils import map_config_to_form_data

    dataset = TestTemporalFilterValues._dataset()
    column = next(c for c in dataset.columns if c.column_name == "ds")
    column.type = "VARCHAR" if storage else "DATE"
    column.python_date_format = storage
    value = [sentinel] if operator in {"IN", "NOT IN"} else sentinel
    config = TestTemporalFilterValues._config(operator, value)
    assert config.filters is not None
    assert config.filters[0].value == value
    form_data = map_config_to_form_data(config, dataset_id=3)
    result = validate_and_compile(config, form_data, dataset, run_compile_check=False)
    assert result.success, result.error
    assert any(f.get("comparator") == value for f in form_data["adhoc_filters"])


def test_temporal_whitespace_documented_per_authoring_tool() -> None:
    """Documentation distinguishes trimming chart inputs from raw dataset inputs."""
    from pathlib import Path

    from superset.mcp_service.common.temporal_filter_values import (
        invalid_temporal_filter_value,
    )

    config = TestTemporalFilterValues._config("=", " 2000-01-01 ")
    assert config.filters is not None
    assert config.filters[0].value == "2000-01-01"
    assert invalid_temporal_filter_value("==", " 2000-01-01 ") is not None
    docs = (
        Path(__file__).resolve().parents[4]
        / "docs/docs/using-superset/using-ai-with-superset.mdx"
    ).read_text()
    assert (
        "Chart configuration filters\ntrim surrounding whitespace before validation"
        in docs
    )
    assert (
        "`query_dataset` preserves spaces\nand rejects date strings containing them"
        in docs
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("sent", [False, True])
async def test_cached_preview_checks_only_authored_temporal_values(
    mocker: MockerFixture, sent: bool
) -> None:
    """Cache-backed updates share the saved-chart comparator provenance rule."""
    import importlib
    from contextlib import nullcontext

    from superset.mcp_service.chart.schemas import UpdateChartPreviewRequest

    module = importlib.import_module(
        "superset.mcp_service.chart.tool.update_chart_preview"
    )
    dataset = TestTemporalFilterValues._dataset()
    saved_filters = [{"col": "ds", "op": "IN", "val": ["946684800000"]}]
    mocker.patch.object(module, "_find_dataset", return_value=dataset)
    mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset)
    mocker.patch.object(module, "has_dataset_access", return_value=True)
    mocker.patch.object(
        module,
        "_get_previous_form_data",
        return_value={
            "viz_type": "table",
            "datasource": "3__table",
            "extra_form_data": {"filters": saved_filters},
        },
    )
    mocker.patch.object(
        module, "event_logger", Mock(log_context=lambda **kwargs: nullcontext())
    )
    mocker.patch(
        "superset.mcp_service.auth.get_user_from_request", return_value=Mock(id=1)
    )
    mocker.patch(
        "superset.mcp_service.chart.compile._compile_chart",
        return_value=CompileResult(success=True),
    )
    link = mocker.patch.object(
        module,
        "generate_explore_link",
        return_value="http://localhost/explore/?form_data_key=new",
    )
    config = TableChartConfig(
        columns=[ColumnRef(name="ds")],
        **(
            {"filters": [FilterConfig(column="ds", op="=", value="946684800000")]}
            if sent
            else {}
        ),
    )
    response = await module.update_chart_preview(
        UpdateChartPreviewRequest(
            form_data_key="old",
            dataset_id=3,
            config=config,
            generate_preview=False,
            preview_formats=[],
        ),
        ctx=Mock(),
    )
    assert response["success"] is not sent
    if sent:
        assert response["error"]["error_code"] == "INVALID_TEMPORAL_FILTER_VALUE"
        link.assert_not_called()
    else:
        assert link.call_args.args[1]["extra_form_data"]["filters"] == saved_filters


@pytest.mark.parametrize("preserved", [False, True])
def test_temporal_storage_rejects_month_case_mismatch(preserved: bool) -> None:
    """Typed and Explore predicates share exact stored-name validation."""
    ds = TestTemporalFilterValues._dataset()
    ds.columns[0].type = "VARCHAR"
    ds.columns[0].python_date_format = "%d-%b-%Y"
    config = TestTemporalFilterValues._config("=", "01-JAN-2000")
    form_data = {}
    if preserved:
        config = config.model_copy(update={"filters": None})
        form_data = {
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "ds",
                    "operator": "=",
                    "comparator": "01-JAN-2000",
                }
            ]
        }
    with patch("superset.mcp_service.chart.compile._compile_chart") as compile_chart:
        result = validate_and_compile(config, form_data, ds)
    assert result.success is False
    assert result.error_obj is not None
    assert result.error_obj.error_code == "INVALID_TEMPORAL_FILTER_VALUE"
    compile_chart.assert_not_called()
