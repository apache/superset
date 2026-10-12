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

import pytest
from pydantic import TypeAdapter

from superset.mcp_service.chart.schemas import (
    ChartConfig,
    ColumnRef,
    SortByConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)


def _validate_sum(sql_type: str) -> list[ChartGenerationError]:
    context = DatasetContext(
        id=69,
        table_name="virtual_metrics",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "computed_total", "type": sql_type, "is_numeric": False}
        ],
        available_metrics=[],
    )

    return DatasetValidator._validate_aggregations(
        [ColumnRef(name="computed_total", aggregate="SUM")], context
    )


@pytest.mark.parametrize(
    "sql_type",
    [
        "BIGINT",
        "SMALLINT",
        "TINYINT",
        "REAL",
        "NUMBER",
        "DOUBLE PRECISION",
        "INT8",
        "FLOAT8",
        "DECIMAL(10, 2)",
        "MONEY",
        "SMALLMONEY",
    ],
)
def test_numeric_type_spelling_is_accepted(sql_type: str) -> None:
    assert _validate_sum(sql_type) == []


@pytest.mark.parametrize("sql_type", ["", "UNKNOWN"])
def test_unknown_type_is_deferred_to_compile_check(sql_type: str) -> None:
    assert _validate_sum(sql_type) == []


@pytest.mark.parametrize("sql_type", ["VARCHAR", "INTERVAL", "POINT"])
def test_non_numeric_type_is_rejected_for_numeric_aggregation(
    sql_type: str,
) -> None:
    assert _validate_sum(sql_type)[0].error_type == "invalid_aggregation"


def test_xy_chart_sort_by_metric_label_does_not_fail_column_validation() -> None:
    """Ensure sorting by a metric label does not fail column validation."""
    context: DatasetContext = DatasetContext(
        id=1,
        table_name="sales_data",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "category", "type": "VARCHAR"},
            {"name": "sales", "type": "BIGINT"},
        ],
        available_metrics=[],
    )
    config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        sort_by="SUM(sales)",
    )
    refs: list[ColumnRef] = DatasetValidator._extract_column_references(config)
    assert "SUM(sales)" not in [r.name for r in refs]
    error: ChartGenerationError | None = DatasetValidator._validate_columns_exist(
        refs, context
    )
    assert error is None


def test_xy_chart_sort_by_saved_metric_does_not_fail_column_validation() -> None:
    """Ensure sorting by a saved metric in y does not fail column validation."""
    context: DatasetContext = DatasetContext(
        id=1,
        table_name="sales_data",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "category", "type": "VARCHAR"},
        ],
        available_metrics=[{"name": "total_sales", "expression": "SUM(sales)"}],
    )
    config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(name="total_sales", saved_metric=True)],
        sort_by="total_sales",
    )
    refs: list[ColumnRef] = DatasetValidator._extract_column_references(config)
    error: ChartGenerationError | None = DatasetValidator._validate_columns_exist(
        refs, context
    )
    assert error is None


def test_xy_chart_sort_by_independent_column_validation() -> None:
    """Ensure independent sort_by columns are validated against dataset columns."""
    context: DatasetContext = DatasetContext(
        id=1,
        table_name="sales_data",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "category", "type": "VARCHAR"},
            {"name": "sales", "type": "BIGINT"},
            {"name": "profit", "type": "BIGINT"},
        ],
        available_metrics=[],
    )
    # Valid independent column
    valid_config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        sort_by=SortByConfig(column="profit", ascending=False),
    )
    refs: list[ColumnRef] = DatasetValidator._extract_column_references(valid_config)
    assert "profit" in [r.name for r in refs]
    error: ChartGenerationError | None = DatasetValidator._validate_columns_exist(
        refs, context
    )
    assert error is None

    # Invalid independent column
    invalid_config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        sort_by=SortByConfig(column="non_existent", ascending=False),
    )
    invalid_refs: list[ColumnRef] = DatasetValidator._extract_column_references(
        invalid_config
    )
    assert "non_existent" in [r.name for r in invalid_refs]
    invalid_error: ChartGenerationError | None = (
        DatasetValidator._validate_columns_exist(invalid_refs, context)
    )
    assert invalid_error is not None
    assert invalid_error.error_type == "column_not_found"


def _make_sales_dataset_context() -> DatasetContext:
    """Create a standard sales dataset context for testing."""
    return DatasetContext(
        id=1,
        table_name="sales_data",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "category", "type": "VARCHAR"},
            {"name": "sales", "type": "BIGINT"},
        ],
        available_metrics=[{"name": "TotalRevenue", "expression": "SUM(rev)"}],
    )


def test_xy_chart_sort_by_saved_metric_not_in_y_validates_successfully() -> None:
    """Ensure marked saved_metric not in y validates against dataset metrics."""
    context: DatasetContext = _make_sales_dataset_context()
    config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        sort_by=SortByConfig(column="totalrevenue", saved_metric=True),
    )
    is_valid: bool
    error: ChartGenerationError | None
    is_valid, error = DatasetValidator.validate_against_dataset(config, 1, context)
    assert is_valid is True
    assert error is None


def test_xy_chart_sort_by_saved_metric_unmarked_fails_validation() -> None:
    """Ensure unmarked saved metric in sort_by produces saved_metric_not_marked."""
    context: DatasetContext = _make_sales_dataset_context()
    config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        sort_by="totalrevenue",
    )
    is_valid: bool
    error: ChartGenerationError | None
    is_valid, error = DatasetValidator.validate_against_dataset(config, 1, context)
    assert is_valid is False
    assert error is not None
    assert error.error_type == "saved_metric_not_marked"


def test_xy_chart_sort_by_invalid_saved_metric_rejected() -> None:
    """Ensure that an invalid saved metric name in sort_by is rejected."""
    context: DatasetContext = _make_sales_dataset_context()
    config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        sort_by=SortByConfig(column="NonExistentMetric", saved_metric=True),
    )
    is_valid: bool
    error: ChartGenerationError | None
    is_valid, error = DatasetValidator.validate_against_dataset(config, 1, context)
    assert is_valid is False
    assert error is not None
    assert error.error_type == "invalid_saved_metric"


def test_xy_chart_sort_by_sql_expression_metric_does_not_fail() -> None:
    """Ensure sorting by a custom SQL expression in y does not fail validation."""
    context: DatasetContext = DatasetContext(
        id=1,
        table_name="sales_data",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "category", "type": "VARCHAR"},
        ],
        available_metrics=[],
    )
    config: XYChartConfig = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="category"),
        y=[ColumnRef(sql_expression="COUNT(DISTINCT user_id)", label="unique_users")],
        sort_by="count(distinct user_id)",
    )
    refs: list[ColumnRef] = DatasetValidator._extract_column_references(config)
    error: ChartGenerationError | None = DatasetValidator._validate_columns_exist(
        refs, context
    )
    assert error is None


def _case_twin_context(*, reverse: bool) -> DatasetContext:
    columns = [
        {"name": "Revenue", "type": "VARCHAR", "is_numeric": False},
        {"name": "revenue", "type": "DECIMAL", "is_numeric": True},
        {"name": "EventTime", "type": "VARCHAR", "is_temporal": False},
        {"name": "eventtime", "type": "TIMESTAMP", "is_temporal": True},
        {"name": "Region", "type": "VARCHAR", "is_temporal": False},
        {"name": "region", "type": "VARCHAR", "is_temporal": False},
        {"name": "Country", "type": "VARCHAR", "is_temporal": False},
    ]
    metrics = [
        {"name": "SAVEDREVENUE", "expression": "COUNT(*)"},
        {"name": "SavedRevenue", "expression": "SUM(revenue)"},
    ]
    if reverse:
        columns.reverse()
        metrics.reverse()
    return DatasetContext(
        id=7,
        table_name="case_twins",
        schema=None,
        database_name="database",
        available_columns=columns,
        available_metrics=metrics,
    )


_REGISTERED_CHART_CONFIGS: list[dict[str, object]] = [
    {
        "chart_type": "table",
        "columns": [
            {"name": "Region"},
            {"name": "revenue", "aggregate": "SUM"},
        ],
        "temporal_column": "eventtime",
        "filters": [{"column": "Region", "op": "=", "value": "North"}],
    },
    {
        "chart_type": "xy",
        "kind": "line",
        "x": {"name": "eventtime"},
        "y": [{"name": "revenue", "aggregate": "SUM"}],
        "filters": [{"column": "Region", "op": "=", "value": "North"}],
    },
    {
        "chart_type": "pie",
        "dimension": {"name": "Region"},
        "metric": {"name": "revenue", "aggregate": "SUM"},
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "sunburst",
        "hierarchy": [{"name": "Region"}, {"name": "Country"}],
        "metric": {"name": "revenue", "aggregate": "SUM"},
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "pivot_table",
        "rows": [{"name": "Region"}],
        "metrics": [{"name": "revenue", "aggregate": "SUM"}],
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "interactive_pivot",
        "rows": [{"name": "Region"}],
        "columns": [{"name": "Country"}],
        "metrics": [{"name": "revenue", "aggregate": "SUM"}],
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "mixed_timeseries",
        "x": {"name": "eventtime"},
        "y": [{"name": "revenue", "aggregate": "SUM"}],
        "y_secondary": [{"name": "SavedRevenue", "saved_metric": True}],
    },
    {
        "chart_type": "handlebars",
        "handlebars_template": "<p>{{revenue}}</p>",
        "metrics": [{"name": "revenue", "aggregate": "SUM"}],
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "big_number",
        "metric": {"name": "revenue", "aggregate": "SUM"},
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "histogram",
        "column": {"name": "revenue"},
        "groupby": [{"name": "Region"}],
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "box_plot",
        "metrics": [{"name": "revenue", "aggregate": "AVG"}],
        "distribute_across": [{"name": "Region"}],
        "temporal_column": "eventtime",
    },
    {
        "chart_type": "waterfall",
        "x_axis": {"name": "Region"},
        "metric": {"name": "revenue", "aggregate": "SUM"},
        "temporal_column": "eventtime",
    },
]


@pytest.mark.parametrize("reverse", [False, True], ids=["forward", "reversed"])
@pytest.mark.parametrize(
    "raw_config",
    _REGISTERED_CHART_CONFIGS,
    ids=[str(config["chart_type"]) for config in _REGISTERED_CHART_CONFIGS],
)
def test_registered_chart_validator_matrix_prefers_exact_case_twin_metadata(
    raw_config: dict[str, object], reverse: bool
) -> None:
    config = TypeAdapter(ChartConfig).validate_python(raw_config)
    valid, error = DatasetValidator.validate_against_dataset(
        config, 7, dataset_context=_case_twin_context(reverse=reverse)
    )
    assert valid is True, error
    assert error is None


@pytest.mark.parametrize("reverse", [False, True], ids=["forward", "reversed"])
@pytest.mark.parametrize(
    "raw_config",
    [
        {
            "chart_type": "table",
            "columns": [{"name": "REVENUE", "aggregate": "SUM"}],
        },
        {
            "chart_type": "big_number",
            "metric": {"name": "savedrevenue", "saved_metric": True},
        },
        {
            "chart_type": "pie",
            "dimension": {"name": "Country"},
            "metric": {"name": "revenue", "aggregate": "SUM"},
            "filters": [{"column": "REGION", "op": "=", "value": "North"}],
        },
        {
            "chart_type": "sunburst",
            "hierarchy": [{"name": "Country"}],
            "metric": {"name": "revenue", "aggregate": "SUM"},
            "temporal_column": "EVENTTIME",
        },
    ],
    ids=["aggregate", "saved_metric", "filter", "temporal_column"],
)
def test_nonexact_case_twins_are_actionably_ambiguous_for_every_role(
    raw_config: dict[str, object], reverse: bool
) -> None:
    config = TypeAdapter(ChartConfig).validate_python(raw_config)
    valid, error = DatasetValidator.validate_against_dataset(
        config, 7, dataset_context=_case_twin_context(reverse=reverse)
    )
    assert valid is False
    assert error is not None
    assert error.error_type == "ambiguous_dataset_reference"
    assert "Use the exact dataset spelling" in error.details
    assert len(error.suggestions) == 2


def test_unicode_casefold_resolves_physical_saved_metric_and_filter_roles() -> None:
    context = DatasetContext(
        id=7,
        table_name="unicode_names",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "Straße", "type": "DECIMAL", "is_numeric": True},
            {"name": "Land", "type": "VARCHAR", "is_numeric": False},
        ],
        available_metrics=[{"name": "Maße", "expression": "SUM(value)"}],
    )
    config = TypeAdapter(ChartConfig).validate_python(
        {
            "chart_type": "sunburst",
            "hierarchy": [{"name": "land"}],
            "metric": {"name": "STRASSE", "aggregate": "SUM"},
            "secondary_metric": {"name": "MASSE", "saved_metric": True},
            "filters": [
                {"column": "STRASSE", "op": ">", "value": 0, "clause": "WHERE"},
            ],
        }
    )

    assert DatasetValidator.validate_against_dataset(
        config, 7, dataset_context=context
    ) == (True, None)
    normalized = DatasetValidator.normalize_column_names(
        config, 7, dataset_context=context
    )
    assert normalized.metric.name == "Straße"
    assert normalized.secondary_metric.name == "Maße"
    assert [filter_.column for filter_ in normalized.filters] == ["Straße"]


def test_unicode_casefold_ambiguity_rejects_nonexact_reference() -> None:
    context = DatasetContext(
        id=7,
        table_name="unicode_twins",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "Straße", "type": "DECIMAL", "is_numeric": True},
            {"name": "STRASSE", "type": "VARCHAR", "is_numeric": False},
        ],
    )
    config = TypeAdapter(ChartConfig).validate_python(
        {
            "chart_type": "table",
            "columns": [{"name": "Strasse", "aggregate": "SUM"}],
        }
    )
    valid, error = DatasetValidator.validate_against_dataset(
        config, 7, dataset_context=context
    )
    assert valid is False
    assert error is not None
    assert error.error_type == "ambiguous_dataset_reference"
