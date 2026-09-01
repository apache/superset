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

from superset.mcp_service.chart.schemas import ChartConfig, ColumnRef
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
