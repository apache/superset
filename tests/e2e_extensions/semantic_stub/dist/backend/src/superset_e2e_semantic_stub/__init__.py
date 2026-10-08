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
In-memory semantic layer for end-to-end tests.

Loaded only as a ``LOCAL_EXTENSIONS`` entry by the Playwright semantic-view
configuration (``tests.integration_tests.superset_test_config_semantic``). It
registers through the public ``@semantic_layer`` decorator like any provider,
so the host code under test is the code that runs in production; only the
warehouse is replaced by a fixed table.

Anything the stub does not implement raises instead of being ignored, so a
host change that starts sending a new query shape fails the browser test
rather than rendering plausible but unfiltered data.
"""

from __future__ import annotations

from collections import defaultdict
from operator import itemgetter
from typing import Any

import pyarrow as pa
from pydantic import BaseModel, ConfigDict
from superset_core.semantic_layers.decorators import semantic_layer
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Filter,
    FilterValues,
    Metric,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView

VIEW_NAME = "orders"

CATEGORY = Dimension("category", "category", pa.string(), verbose_name="Category")
REGION = Dimension("region", "region", pa.string(), verbose_name="Region")
TOTAL_AMOUNT = Metric(
    "total_amount",
    "total_amount",
    pa.int64(),
    "SUM(amount)",
    aggregation=AggregationType.SUM,
    verbose_name="Total amount",
)
ORDER_COUNT = Metric(
    "order_count",
    "order_count",
    pa.int64(),
    "COUNT(*)",
    aggregation=AggregationType.COUNT,
    verbose_name="Order count",
)

# Small enough to reason about in an assertion: Books totals 10 + 5 = 15.
ROWS: tuple[dict[str, Any], ...] = (
    {"category": "Books", "region": "East", "amount": 10},
    {"category": "Books", "region": "West", "amount": 5},
    {"category": "Games", "region": "East", "amount": 7},
    {"category": "Music", "region": "West", "amount": 3},
)

SUPPORTED_OPERATORS = frozenset(
    {Operator.EQUALS, Operator.NOT_EQUALS, Operator.IN, Operator.NOT_IN}
)


class StubConfiguration(BaseModel):
    """The stub needs no connection settings; reject anything supplied."""

    model_config = ConfigDict(extra="forbid")


def _matches(row: dict[str, Any], filter_: Filter) -> bool:
    if filter_.type != PredicateType.WHERE or not isinstance(filter_.column, Dimension):
        raise ValueError("The E2E stub only supports WHERE filters on dimensions")
    if filter_.operator not in SUPPORTED_OPERATORS:
        raise ValueError(f"The E2E stub does not support {filter_.operator.value}")

    actual = row[filter_.column.id]
    values: frozenset[FilterValues] = (
        frozenset(filter_.value)
        if isinstance(filter_.value, (frozenset, tuple))
        else frozenset({filter_.value})
    )
    if filter_.operator in {Operator.EQUALS, Operator.IN}:
        return actual in values
    return actual not in values


def _filtered_rows(filters: set[Filter] | None) -> list[dict[str, Any]]:
    return [row for row in ROWS if all(_matches(row, f) for f in filters or set())]


def _aggregate(metric: Metric, rows: list[dict[str, Any]]) -> int:
    if metric.aggregation == AggregationType.SUM:
        return sum(row["amount"] for row in rows)
    if metric.aggregation == AggregationType.COUNT:
        return len(rows)
    raise ValueError(f"The E2E stub cannot aggregate {metric.id}")


class StubOrdersView(SemanticView):
    """A single fixed view: two string dimensions and two additive metrics."""

    name = VIEW_NAME

    def uid(self) -> str:
        return f"e2e-stub:{VIEW_NAME}"

    def get_dimensions(self) -> set[Dimension]:
        return {CATEGORY, REGION}

    def get_metrics(self) -> set[Metric]:
        return {TOTAL_AMOUNT, ORDER_COUNT}

    def get_values(
        self,
        dimension: Dimension,
        filters: set[Filter] | None = None,
    ) -> SemanticResult:
        values = sorted({row[dimension.id] for row in _filtered_rows(filters)})
        return SemanticResult(
            requests=[SemanticRequest("stub", f"values of {dimension.id}")],
            results=pa.table({dimension.name: pa.array(values, dimension.type)}),
        )

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        if query.group_limit is not None:
            raise ValueError("The E2E stub does not support group limits")

        groups: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
        for row in _filtered_rows(query.filters):
            groups[tuple(row[d.id] for d in query.dimensions)].append(row)
        if not query.dimensions and not groups:
            groups[()] = []  # an aggregate-only query always returns one row

        records = [
            {
                **{d.name: key[i] for i, d in enumerate(query.dimensions)},
                **{m.name: _aggregate(m, rows) for m in query.metrics},
            }
            for key, rows in groups.items()
        ]
        # Deterministic output: requested order first, then dimension values.
        records.sort(key=lambda r: tuple(r[d.name] for d in query.dimensions))
        for element, direction in reversed(query.order or []):
            if not isinstance(element, (Dimension, Metric)):
                raise ValueError("The E2E stub does not support adhoc ordering")
            records.sort(
                key=itemgetter(element.name),
                reverse=direction == OrderDirection.DESC,
            )
        records = records[query.offset or 0 :]
        if query.limit is not None:
            records = records[: query.limit]

        schema = pa.schema(
            [pa.field(d.name, d.type) for d in query.dimensions]
            + [pa.field(m.name, m.type) for m in query.metrics]
        )
        return SemanticResult(
            requests=[SemanticRequest("stub", f"table of {VIEW_NAME}")],
            results=pa.Table.from_pylist(records, schema=schema),
        )

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        count = self.get_table(query).results.num_rows
        return SemanticResult(
            requests=[SemanticRequest("stub", f"row count of {VIEW_NAME}")],
            results=pa.table({"COUNT": pa.array([count], pa.int64())}),
        )

    def get_compatible_metrics(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[Dimension],
    ) -> set[Metric]:
        return self.get_metrics()

    def get_compatible_dimensions(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[Dimension],
    ) -> set[Dimension]:
        return self.get_dimensions()


@semantic_layer(
    id="stub",
    name="E2E Semantic Stub",
    description="Test-only in-memory semantic layer",
)
class StubSemanticLayer(SemanticLayer[StubConfiguration, StubOrdersView]):
    configuration_class = StubConfiguration

    @classmethod
    def from_configuration(cls, configuration: dict[str, Any]) -> StubSemanticLayer:
        StubConfiguration.model_validate(configuration)
        return cls()

    @classmethod
    def get_configuration_schema(
        cls,
        configuration: StubConfiguration | None = None,
    ) -> dict[str, Any]:
        return StubConfiguration.model_json_schema()

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: StubConfiguration,
        runtime_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {"type": "object", "properties": {}}

    def get_semantic_views(
        self,
        runtime_configuration: dict[str, Any],
    ) -> set[StubOrdersView]:
        return {StubOrdersView()}

    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> StubOrdersView:
        if name != VIEW_NAME:
            raise ValueError(f"The E2E stub has no semantic view named {name!r}")
        return StubOrdersView()
