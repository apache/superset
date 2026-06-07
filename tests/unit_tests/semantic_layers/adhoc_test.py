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

# pylint: disable=invalid-name

from __future__ import annotations

from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import AggregationType, Dimension

from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.adhoc import (
    adhoc_column_to_semantic_dimension,
    adhoc_metric_to_semantic_metric,
)


@pytest.fixture
def dataset() -> MagicMock:
    ds = MagicMock()
    ds.database_id = 1
    ds.schema = "public"
    ds.database.db_engine_spec.engine = "postgresql"
    # Identifier quoter — return double-quoted name.
    ds.quote_identifier = lambda name: f'"{name}"'
    # ``_process_select_expression`` echoes back the SQL after "rendering".
    ds._process_select_expression = (
        lambda expression, **kwargs: expression  # noqa: U100
    )
    return ds


# ---------------------------------------------------------------------------
# Adhoc metric
# ---------------------------------------------------------------------------


def test_simple_metric_sum(dataset: MagicMock) -> None:
    metric = adhoc_metric_to_semantic_metric(
        {
            "expressionType": "SIMPLE",
            "label": "total_amount",
            "aggregate": "SUM",
            "column": {"column_name": "amount"},
        },
        dataset,
    )
    assert metric.id == "total_amount"
    assert metric.name == "total_amount"
    assert metric.definition == 'SUM("amount")'
    assert metric.aggregation == AggregationType.SUM
    # SUM(...) infers to float64.
    assert metric.type == pa.float64()


def test_simple_metric_count_distinct(dataset: MagicMock) -> None:
    metric = adhoc_metric_to_semantic_metric(
        {
            "expressionType": "SIMPLE",
            "label": "unique_customers",
            "aggregate": "COUNT_DISTINCT",
            "column": {"column_name": "customer_id"},
        },
        dataset,
    )
    assert metric.definition == 'COUNT(DISTINCT "customer_id")'
    assert metric.aggregation == AggregationType.COUNT_DISTINCT


def test_simple_metric_unknown_aggregate_falls_back_to_other(
    dataset: MagicMock,
) -> None:
    metric = adhoc_metric_to_semantic_metric(
        {
            "expressionType": "SIMPLE",
            "label": "median_x",
            "aggregate": "MEDIAN",
            "column": {"column_name": "x"},
        },
        dataset,
    )
    # MEDIAN isn't in the rollup-safe map.
    assert metric.aggregation == AggregationType.OTHER


def test_simple_metric_missing_aggregate_raises(dataset: MagicMock) -> None:
    with pytest.raises(QueryObjectValidationError, match="aggregate and a column"):
        adhoc_metric_to_semantic_metric(
            {
                "expressionType": "SIMPLE",
                "label": "bad",
                "column": {"column_name": "amount"},
            },
            dataset,
        )


def test_simple_metric_missing_column_raises(dataset: MagicMock) -> None:
    with pytest.raises(QueryObjectValidationError, match="aggregate and a column"):
        adhoc_metric_to_semantic_metric(
            {
                "expressionType": "SIMPLE",
                "label": "bad",
                "aggregate": "SUM",
                "column": {},
            },
            dataset,
        )


def test_sql_metric(dataset: MagicMock) -> None:
    metric = adhoc_metric_to_semantic_metric(
        {
            "expressionType": "SQL",
            "label": "profit_margin",
            "sqlExpression": "SUM(revenue - cost) / SUM(revenue)",
        },
        dataset,
    )
    assert metric.definition == "SUM(revenue - cost) / SUM(revenue)"
    assert metric.aggregation == AggregationType.OTHER


def test_sql_metric_missing_expression_raises(dataset: MagicMock) -> None:
    with pytest.raises(QueryObjectValidationError, match="sqlExpression"):
        adhoc_metric_to_semantic_metric(
            {"expressionType": "SQL", "label": "bad"},
            dataset,
        )


def test_metric_missing_label_raises(dataset: MagicMock) -> None:
    with pytest.raises(QueryObjectValidationError, match="missing a ``label``"):
        adhoc_metric_to_semantic_metric(
            {"expressionType": "SIMPLE", "aggregate": "SUM"},
            dataset,
        )


def test_metric_unknown_expression_type_raises(dataset: MagicMock) -> None:
    with pytest.raises(QueryObjectValidationError, match="Unknown adhoc metric"):
        adhoc_metric_to_semantic_metric(
            {"label": "weird", "expressionType": "MYSTERY"},
            dataset,
        )


def test_sql_metric_jinja_applied(dataset: MagicMock) -> None:
    # ``_process_select_expression`` is where Jinja and safety validation
    # live in the dataset model. We verify the helper is invoked.
    dataset._process_select_expression = MagicMock(return_value="user_id = 42")
    metric = adhoc_metric_to_semantic_metric(
        {
            "expressionType": "SQL",
            "label": "rendered",
            "sqlExpression": "user_id = {{ current_user_id() }}",
        },
        dataset,
        template_processor=MagicMock(),
    )
    assert metric.definition == "user_id = 42"
    dataset._process_select_expression.assert_called_once()


def test_sql_metric_empty_processed_raises(dataset: MagicMock) -> None:
    dataset._process_select_expression = MagicMock(return_value=None)
    with pytest.raises(QueryObjectValidationError, match="empty string"):
        adhoc_metric_to_semantic_metric(
            {
                "expressionType": "SQL",
                "label": "bad",
                "sqlExpression": "{{ '' }}",
            },
            dataset,
            template_processor=MagicMock(),
        )


# ---------------------------------------------------------------------------
# Adhoc column
# ---------------------------------------------------------------------------


def test_adhoc_column_reference_uses_existing_dimension(dataset: MagicMock) -> None:
    existing = Dimension(id="country", name="country", type=pa.utf8())
    result = adhoc_column_to_semantic_dimension(
        {
            "label": "country",
            "sqlExpression": "country",
            "isColumnReference": True,
        },
        dataset,
        {"country": existing},
    )
    assert result is existing


def test_adhoc_column_synthesises_dimension(dataset: MagicMock) -> None:
    dataset._process_select_expression = MagicMock(return_value="UPPER(country)")
    result = adhoc_column_to_semantic_dimension(
        {
            "label": "upper_country",
            "sqlExpression": "UPPER(country)",
        },
        dataset,
        {},
        template_processor=MagicMock(),
    )
    assert result.id == "upper_country"
    assert result.name == "upper_country"
    assert result.definition == "UPPER(country)"
    # UPPER(...) infers to utf8.
    assert result.type == pa.utf8()


def test_adhoc_column_missing_label_raises(dataset: MagicMock) -> None:
    with pytest.raises(QueryObjectValidationError, match="``label``"):
        adhoc_column_to_semantic_dimension(
            {"sqlExpression": "x"},
            dataset,
            {},
        )


def test_adhoc_column_missing_sql_raises(dataset: MagicMock) -> None:
    with pytest.raises(QueryObjectValidationError, match="``sqlExpression``"):
        adhoc_column_to_semantic_dimension(
            {"label": "x"},
            dataset,
            {},
        )


def test_adhoc_column_reference_falls_back_when_not_matching(
    dataset: MagicMock,
) -> None:
    """
    A column-reference adhoc whose sqlExpression doesn't match an existing
    dimension is treated as a synthesized adhoc.
    """
    dataset._process_select_expression = MagicMock(return_value="ghost")
    result = adhoc_column_to_semantic_dimension(
        {
            "label": "spooky",
            "sqlExpression": "ghost",
            "isColumnReference": True,
        },
        dataset,
        {"country": Dimension(id="country", name="country", type=pa.utf8())},
        template_processor=MagicMock(),
    )
    assert result.id == "spooky"
    assert result.definition == "ghost"
