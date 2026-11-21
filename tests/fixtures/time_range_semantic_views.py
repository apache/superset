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
"""Shared builders for time range limits tests."""

from __future__ import annotations

from typing import Any

import pyarrow as pa
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Filter,
    Metric,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC

ORDER_DATE = Dimension("order_date", "order_date", pa.timestamp("us"))


SHIP_DATE = Dimension("ship_date", "ship_date", pa.timestamp("us"))


CATEGORY = Dimension("category", "category", pa.string(), verbose_name="Category")


TOTAL = Metric(
    "total_amount",
    "total_amount",
    pa.int64(),
    "SUM(amount)",
    aggregation=AggregationType.SUM,
)


class TimedOrdersView(SemanticViewABC):
    """A view with two timestamp dimensions that records what reaches it."""

    name = "timed_orders"

    def __init__(self, preferred: str | None = "order_date") -> None:
        self.preferred_temporal_dimension = preferred
        self.queries: list[SemanticQuery] = []

    def uid(self) -> str:
        return "test:timed_orders"

    def get_dimensions(self) -> set[Dimension]:
        return {ORDER_DATE, SHIP_DATE, CATEGORY}

    def get_metrics(self) -> set[Metric]:
        return {TOTAL}

    def get_compatible_metrics(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Metric]:
        return self.get_metrics()

    def get_compatible_dimensions(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Dimension]:
        return self.get_dimensions()

    def get_values(
        self, dimension: Dimension, filters: set[Filter] | None = None
    ) -> SemanticResult:
        return SemanticResult(
            requests=[SemanticRequest("test", f"values of {dimension.name}")],
            results=pa.table({dimension.name: pa.array([], dimension.type)}),
        )

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        self.queries.append(query)
        columns = {
            **{d.name: pa.array([], d.type) for d in query.dimensions},
            **{m.name: pa.array([], m.type) for m in query.metrics},
        }
        return SemanticResult(
            requests=[SemanticRequest("test", "table")], results=pa.table(columns)
        )

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        return SemanticResult(
            requests=[SemanticRequest("test", "count")],
            results=pa.table({"COUNT": pa.array([0], pa.int64())}),
        )

    def provider_filters(self) -> list[str]:
        return sorted(
            f"{flt.column.name} {flt.operator.value} {flt.value}"
            for query in self.queries
            for flt in query.filters or ()
            if isinstance(flt, Filter) and flt.column is not None
        )


X_AXIS = {
    "columnType": "BASE_AXIS",
    "expressionType": "SQL",
    "isColumnReference": True,
    "label": "order_date",
    "sqlExpression": "order_date",
}


def query(**fields: Any) -> dict[str, Any]:
    return {"metrics": ["total_amount"], "columns": ["category"], **fields}


__all__ = [
    "AggregationType",
    "Any",
    "CATEGORY",
    "Dimension",
    "Filter",
    "Metric",
    "ORDER_DATE",
    "SHIP_DATE",
    "SemanticQuery",
    "SemanticRequest",
    "SemanticResult",
    "SemanticViewABC",
    "TOTAL",
    "TimedOrdersView",
    "X_AXIS",
    "pa",
    "query",
]
