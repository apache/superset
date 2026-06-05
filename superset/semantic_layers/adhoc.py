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
Convert frontend "adhoc" metric / column dictionaries into semantic-layer
``Metric`` / ``Dimension`` objects.

Adhoc metrics and columns are user-defined SQL expressions that don't
correspond to a saved metric or physical column on the dataset. The legacy
``get_sqla_query`` path supports them through ``adhoc_metric_to_sqla`` /
``adhoc_column_to_sqla``; the semantic-layer path needs an equivalent so
that flipping ``USE_DATASET_SEMANTIC_VIEW`` doesn't regress charts that
use them.

The strategy is light: synthesize a ``Metric(definition=<sql>)`` /
``Dimension(definition=<sql>)`` and let the view's existing
``definition``-parsing path handle the rest. Jinja templating + safety
checks are delegated to the dataset's own
``_process_select_expression`` (already battle-tested).
"""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

import pyarrow as pa
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Metric,
)

from superset.exceptions import QueryObjectValidationError
from superset.utils.core import AdhocMetricExpressionType

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.jinja_context import BaseTemplateProcessor


# Map Superset's aggregate strings to the semantic-layer ``AggregationType``.
# Anything unmapped (median, percentile, …) falls back to OTHER, which the
# view treats as a non-rollup-safe metric.
_AGGREGATE_MAP: dict[str, AggregationType] = {
    "COUNT": AggregationType.COUNT,
    "SUM": AggregationType.SUM,
    "AVG": AggregationType.AVG,
    "MIN": AggregationType.MIN,
    "MAX": AggregationType.MAX,
    "COUNT_DISTINCT": AggregationType.COUNT_DISTINCT,
}


def _process_adhoc_sql(
    dataset: "SqlaTable",
    sql_expression: str,
    template_processor: "BaseTemplateProcessor | None",
) -> str:
    """
    Run Jinja + safety validation on a free-form SQL expression.

    Delegates to the dataset's ``_process_select_expression`` so adhoc
    columns and metrics go through the same Jinja rendering, subquery
    rules, and clause sanitization as the legacy path.
    """
    processed = dataset._process_select_expression(  # noqa: SLF001
        expression=sql_expression,
        database_id=dataset.database_id,
        engine=dataset.database.db_engine_spec.engine,
        schema=dataset.schema or "",
        template_processor=template_processor,
    )
    if not processed:
        raise QueryObjectValidationError(
            "Adhoc SQL expression resolved to an empty string."
        )
    return processed


def _simple_metric_definition(adhoc: dict[str, Any], dataset: "SqlaTable") -> str:
    """
    Build the SQL for a SIMPLE adhoc metric: ``AGGREGATE(column)``.

    Uses the database's identifier quoter so the column name is rendered
    in the right dialect.
    """
    aggregate = (adhoc.get("aggregate") or "").upper()
    column = adhoc.get("column") or {}
    column_name = column.get("column_name")
    if not aggregate or not column_name:
        raise QueryObjectValidationError(
            "SIMPLE adhoc metric requires both an aggregate and a column."
        )
    if aggregate == "COUNT_DISTINCT":
        return f"COUNT(DISTINCT {dataset.quote_identifier(column_name)})"
    return f"{aggregate}({dataset.quote_identifier(column_name)})"


def adhoc_metric_to_semantic_metric(
    adhoc: dict[str, Any],
    dataset: "SqlaTable",
    template_processor: "BaseTemplateProcessor | None" = None,
) -> Metric:
    """
    Convert an ``AdhocMetric`` dict to a semantic-layer ``Metric``.

    SIMPLE metrics build ``f"{aggregate}({column})"`` and tag the
    aggregation type so the view can preserve rollup semantics. SQL
    metrics use the user-provided ``sqlExpression`` (after Jinja +
    safety validation) and report ``AggregationType.OTHER`` because the
    expression is opaque.

    Adhoc dtype is set to ``pa.null()`` — the view aliases the metric
    by id and downstream chart code coerces at render time.
    """
    label = adhoc.get("label")
    if not label:
        raise QueryObjectValidationError("Adhoc metric is missing a ``label``.")

    expression_type = adhoc.get("expressionType")
    if expression_type == AdhocMetricExpressionType.SIMPLE.value:
        definition = _simple_metric_definition(adhoc, dataset)
        # Templating is irrelevant for SIMPLE metrics (no user-supplied SQL),
        # so the safety pass is skipped here.
        aggregate = (adhoc.get("aggregate") or "").upper()
        aggregation = _AGGREGATE_MAP.get(aggregate, AggregationType.OTHER)
    elif expression_type == AdhocMetricExpressionType.SQL.value:
        sql_expression = adhoc.get("sqlExpression")
        if not sql_expression:
            raise QueryObjectValidationError(
                "SQL adhoc metric is missing ``sqlExpression``."
            )
        definition = _process_adhoc_sql(dataset, sql_expression, template_processor)
        aggregation = AggregationType.OTHER
    else:
        raise QueryObjectValidationError(
            f"Unknown adhoc metric expressionType: {expression_type!r}"
        )

    return Metric(
        id=label,
        name=label,
        type=pa.null(),
        definition=definition,
        aggregation=aggregation,
    )


def adhoc_column_to_semantic_dimension(
    adhoc: dict[str, Any],
    dataset: "SqlaTable",
    dimensions_by_name: dict[str, Dimension],
    template_processor: "BaseTemplateProcessor | None" = None,
) -> Dimension:
    """
    Convert an ``AdhocColumn`` dict to a semantic-layer ``Dimension``.

    When the adhoc is a thin wrapper around a real column
    (``isColumnReference=True`` and ``sqlExpression`` matches a known
    dimension name), the existing ``Dimension`` is returned so that
    metadata such as type and grain are preserved. Otherwise a fresh
    ``Dimension`` with ``definition=<rendered SQL>`` is synthesized.
    """
    label = adhoc.get("label")
    if not label:
        raise QueryObjectValidationError("Adhoc column is missing a ``label``.")
    sql_expression = adhoc.get("sqlExpression")
    if not sql_expression:
        raise QueryObjectValidationError(
            "Adhoc column is missing ``sqlExpression``."
        )

    if adhoc.get("isColumnReference") and sql_expression in dimensions_by_name:
        return dimensions_by_name[sql_expression]

    definition = _process_adhoc_sql(dataset, sql_expression, template_processor)
    return Dimension(
        id=label,
        name=label,
        type=pa.null(),
        definition=definition,
    )
