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

"""Test-only SQLite adapter for the conformance examples; no external service."""

import sqlite3
from contextlib import closing
from datetime import date
from typing import Any

import pyarrow as pa
from example_provider import ExampleView
from superset_core.semantic_layers.errors import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
    SemanticResultCompletenessError,
    SemanticResultCompletenessReason,
)
from superset_core.semantic_layers.types import (
    AdhocExpression,
    Dimension,
    Filter,
    FilterExpression,
    Grains,
    Metric,
    null_placement,
    NullPlacement,
    Operator,
    OrFilter,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticViewFeature


class Backend:
    """Controlled backend responses and a changing metadata catalog."""

    def __init__(self) -> None:
        self.revision: int = 0
        self.fault: bool = False
        self.completeness: SemanticResultCompletenessReason | None = None

    def execute(self, sql: str, parameters: list[object]) -> list[tuple[Any, ...]]:
        """Execute against deliberately unsorted data, including a NULL group."""
        if self.fault:
            raise ConnectionError("test backend unavailable")
        connection: sqlite3.Connection
        with closing(sqlite3.connect(":memory:")) as connection:
            connection.execute(
                "CREATE TABLE records(category TEXT, occurred TEXT, amount INT)"
            )
            connection.executemany(
                "INSERT INTO records VALUES (?, ?, ?)",
                [
                    ("B", "2026-02-04", 8),
                    ("C", "2026-02-07", 6),
                    (None, "2026-01-03", 3),
                    (None, "2026-02-06", 1),
                    ("A", "2026-02-05", 5),
                    ("A", "2026-01-02", 2),
                ],
            )
            return connection.execute(sql, parameters).fetchall()


class QueryView(ExampleView):
    """Exercise SDK results with an isolated, uncached test backend."""

    features: frozenset[SemanticViewFeature] = frozenset(
        {SemanticViewFeature.ROW_OFFSET}
    )

    def __init__(self, backend: Backend, token: str | None = None) -> None:
        self.backend: Backend = backend
        self.token: str | None = token
        self.revision: int = backend.revision

    @property
    def metadata_cache_token(self) -> str | None:
        """Echo discovery identity without relabeling older view objects."""
        return self.token

    def get_dimensions(self) -> set[Dimension]:
        """Raw and month variants share a stable selection name."""
        return {
            Dimension(
                "private-category", "category", pa.string(), verbose_name="Label"
            ),
            Dimension("private-day", "occurred", pa.date32()),
            Dimension("private-month", "occurred", pa.date32(), grain=Grains.MONTH),
            *{
                Dimension(f"private-{revision}", f"revision_{revision}", pa.string())
                for revision in range(self.revision + 1)
            },
        }

    def get_metrics(self) -> set[Metric]:
        """The metric's selection name differs from both ID and display label."""
        return {
            Metric(
                "private-total",
                "total",
                pa.int64(),
                "SUM(amount)",
                verbose_name="Amount",
            )
        }

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        """Compile a bounded subset of queries, then execute through the backend."""
        if (not query.dimensions and not query.metrics) or query.group_limit:
            raise SemanticQueryRejectedError(SemanticQueryErrorCode.UNSUPPORTED_QUERY)
        if any(d not in self.get_dimensions() for d in query.dimensions) or any(
            m not in self.get_metrics() for m in query.metrics
        ):
            raise SemanticQueryRejectedError(SemanticQueryErrorCode.INVALID_QUERY)
        expressions: list[str] = [
            "substr(occurred, 1, 7) || '-01'" if d.grain == Grains.MONTH else d.name
            for d in query.dimensions
        ]
        columns: list[Dimension | Metric] = [*query.dimensions, *query.metrics]
        selections: list[str] = [
            f'{expression} AS "{d.name}"'
            for expression, d in zip(expressions, query.dimensions, strict=False)
        ]
        selections.extend(f'{m.definition} AS "{m.name}"' for m in query.metrics)
        parameters: list[object] = []
        predicates: list[str] = [
            _predicate(f, parameters) for f in query.filters or set()
        ]
        # Expressions come only from the fixed catalog checked above; values are bound.
        sql: str = "SELECT " + ", ".join(selections) + " FROM records"  # noqa: S608
        if predicates:
            sql += " WHERE " + " AND ".join(predicates)
        if expressions:
            sql += " GROUP BY " + ", ".join(expressions)
        if query.order:
            if any(member not in columns for member, _ in query.order):
                raise SemanticQueryRejectedError(SemanticQueryErrorCode.INVALID_QUERY)
            sql += " ORDER BY " + ", ".join(
                f'"{term[0].name}" {term[1].value}{_nulls(null_placement(term))}'
                for term in query.order
                if not isinstance(term[0], AdhocExpression)
            )
        if query.limit is not None:
            sql += " LIMIT ? OFFSET ?"
            parameters.extend([query.limit, query.offset or 0])
        rows: list[tuple[Any, ...]] = self.backend.execute(sql, parameters)
        if self.backend.completeness is not None:
            raise SemanticResultCompletenessError(self.backend.completeness)
        return _result(columns, rows)

    def get_values(
        self, dimension: Dimension, filters: set[Filter] | None = None
    ) -> SemanticResult:
        """Use the same backend and error boundary for value discovery."""
        return self.get_table(
            SemanticQuery(
                metrics=[],
                dimensions=[dimension],
                filters=set(filters) if filters else None,
            )
        )

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        """Exercise failure propagation without defining a new count convention."""
        self.get_table(query)
        raise SemanticQueryRejectedError(SemanticQueryErrorCode.UNSUPPORTED_QUERY)


def _nulls(placement: NullPlacement | None) -> str:
    """Render a requested NULL placement; without one, SQLite's default applies."""
    return f" NULLS {placement.value}" if placement is not None else ""


def _predicate(expression: FilterExpression, parameters: list[object]) -> str:
    """Render only the normalized predicates used by this example."""
    if isinstance(expression, OrFilter):
        return (
            "("
            + " OR ".join(
                _predicate(leaf, parameters)
                for leaf in sorted(
                    expression.filters, key=lambda leaf: leaf.operator.value
                )
            )
            + ")"
        )
    if expression.column is not None and expression.column.name == "occurred":
        if expression.operator == Operator.GREATER_THAN_OR_EQUAL and isinstance(
            expression.value, date
        ):
            parameters.append(expression.value.isoformat())
            return "occurred >= ?"
        raise SemanticQueryRejectedError(SemanticQueryErrorCode.INVALID_FILTER)
    if expression.column is None or expression.column.name != "category":
        raise SemanticQueryRejectedError(SemanticQueryErrorCode.INVALID_FILTER)
    if expression.operator == Operator.IS_NULL:
        return "category IS NULL"
    if expression.operator == Operator.IS_NOT_NULL:
        return "category IS NOT NULL"
    if (
        expression.operator == Operator.IN
        and isinstance(expression.value, frozenset)
        and expression.value
    ):
        values: list[str] = sorted(
            value for value in expression.value if isinstance(value, str)
        )
        if len(values) != len(expression.value):
            raise SemanticQueryRejectedError(SemanticQueryErrorCode.INVALID_FILTER)
        parameters.extend(values)
        return "category IN (" + ", ".join("?" for _ in expression.value) + ")"
    if expression.operator == Operator.EQUALS and expression.value is not None:
        parameters.append(expression.value)
        return "category = ?"
    raise SemanticQueryRejectedError(SemanticQueryErrorCode.INVALID_FILTER)


def _result(
    columns: list[Dimension | Metric], rows: list[tuple[Any, ...]]
) -> SemanticResult:
    """Preserve SDK member names and types in the backend result."""
    values: dict[str, pa.Array] = {}
    index: int
    member: Dimension | Metric
    for index, member in enumerate(columns):
        data: list[Any] = [row[index] for row in rows]
        if pa.types.is_date32(member.type):
            data = [date.fromisoformat(value) for value in data]
        values[member.name] = pa.array(data, type=member.type)
    return SemanticResult(requests=[], results=pa.table(values))
