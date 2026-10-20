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

from collections.abc import Callable
from dataclasses import replace
from datetime import date
from functools import partial
from pathlib import Path
from typing import TYPE_CHECKING

import pyarrow as pa
import pytest
from superset_core.semantic_layers.errors import SemanticResultCompletenessReason
from superset_core.semantic_layers.testing import SemanticProviderConformance
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Grains,
    Metric,
    Operator,
    OrderDirection,
    OrFilter,
    PredicateType,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature

if TYPE_CHECKING:
    from conformance_provider import Backend, QueryView

pytest_plugins: list[str] = ["superset_core.semantic_layers.testing"]


@pytest.fixture
def backend(semantic_layer_registration: None) -> "Backend":
    """Create independent backend state for each conformance test."""
    from conformance_provider import Backend

    return Backend()


@pytest.fixture
def semantic_view(backend: "Backend") -> "QueryView":
    """Bind the real SDK example view to its controlled backend."""
    from conformance_provider import QueryView

    return QueryView(backend)


@pytest.fixture
def semantic_reloaded_view(backend: "Backend") -> "QueryView":
    """Reconstruct metadata through the provider's public catalog methods."""
    from conformance_provider import QueryView

    return QueryView(backend)


@pytest.fixture
def semantic_query_cases(
    semantic_view: "QueryView",
) -> dict[str, tuple[SemanticQuery, pa.Table]]:
    """Expected answers are independent of the provider's query implementation."""
    category: Dimension = next(
        d for d in semantic_view.get_dimensions() if d.name == "category"
    )
    month: Dimension = next(
        d for d in semantic_view.get_dimensions() if d.grain == Grains.MONTH
    )
    total: Metric = next(iter(semantic_view.get_metrics()))
    null: Filter = Filter(PredicateType.WHERE, category, Operator.IS_NULL, None)
    equals: Filter = Filter(PredicateType.WHERE, category, Operator.EQUALS, "A")
    return {
        "identity": (
            SemanticQuery([total], [category], order=[(total, OrderDirection.ASC)]),
            pa.table(
                {
                    "category": pa.array([None, "A", "B"], type=pa.string()),
                    "total": [3, 7, 8],
                }
            ),
        ),
        "grain": (
            SemanticQuery([total], [month], order=[(month, OrderDirection.ASC)]),
            pa.table(
                {
                    "occurred": pa.array(
                        [date(2026, 1, 1), date(2026, 2, 1)], type=pa.date32()
                    ),
                    "total": [5, 13],
                }
            ),
        ),
        "null": (
            SemanticQuery([total], [category], filters={null}),
            pa.table({"category": pa.array([None], type=pa.string()), "total": [3]}),
        ),
        "not_null": (
            SemanticQuery(
                [total],
                [category],
                filters={
                    Filter(PredicateType.WHERE, category, Operator.IS_NOT_NULL, None)
                },
                order=[(total, OrderDirection.ASC)],
            ),
            pa.table({"category": ["A", "B"], "total": [7, 8]}),
        ),
        "or": (
            SemanticQuery(
                [total],
                [category],
                filters={OrFilter(frozenset({null, equals}))},
                order=[(total, OrderDirection.ASC)],
            ),
            pa.table(
                {"category": pa.array([None, "A"], type=pa.string()), "total": [3, 7]}
            ),
        ),
        "order_limit": (
            SemanticQuery(
                [total], [category], order=[(total, OrderDirection.DESC)], limit=1
            ),
            pa.table({"category": ["B"], "total": [8]}),
        ),
    }


@pytest.fixture
def semantic_capability_cases(
    semantic_view: "QueryView",
) -> dict[str, tuple[SemanticQuery, pa.Table]]:
    """ROW_OFFSET must skip the highest group after ordering."""
    category: Dimension = next(
        d for d in semantic_view.get_dimensions() if d.name == "category"
    )
    total: Metric = next(iter(semantic_view.get_metrics()))
    return {
        "ROW_OFFSET": (
            SemanticQuery(
                [total],
                [category],
                order=[(total, OrderDirection.DESC)],
                limit=1,
                offset=1,
            ),
            pa.table({"category": ["A"], "total": [7]}),
        )
    }


def _error_operation(method: str, kind: str) -> SemanticResult:
    """Drive each actual provider entry point with controlled backend failures."""
    from conformance_provider import Backend, QueryView

    source: Backend = Backend()
    source.fault = kind == "fault"
    if kind in {"incomplete", "unverified"}:
        reason: SemanticResultCompletenessReason = (
            "incomplete" if kind == "incomplete" else "unverified"
        )
        source.completeness = reason
    view: QueryView = QueryView(source)
    dimension: Dimension = next(
        d for d in view.get_dimensions() if d.name == "category"
    )
    if kind == "refusal":
        dimension = Dimension("invalid", "invalid", pa.string())
    query: SemanticQuery = SemanticQuery(metrics=[], dimensions=[dimension])
    if method == "get_values":
        return view.get_values(dimension)
    if method == "get_row_count":
        return view.get_row_count(query)
    return view.get_table(query)


@pytest.fixture
def semantic_error_cases(
    semantic_layer_registration: None,
) -> dict[str, Callable[[], SemanticResult]]:
    """The suite checks real methods, not closures that directly raise SDK errors."""
    return {
        f"{method}:{kind}": partial(_error_operation, method, kind)
        for method in ("get_table", "get_values", "get_row_count")
        for kind in ("refusal", "fault", "incomplete", "unverified")
    }


@pytest.fixture
def semantic_make_view(backend: "Backend") -> Callable[[str], SemanticView]:
    """Keep construction in the adapter, independent of pending SDK signatures."""
    from conformance_provider import QueryView

    def make(token: str) -> SemanticView:
        return QueryView(backend, token)

    return make


@pytest.fixture
def semantic_change_catalog(backend: "Backend") -> Callable[[], None]:
    """Each source edit changes the discoverable member selection names."""

    def change() -> None:
        backend.revision += 1

    return change


@pytest.fixture
def semantic_provider_class() -> tuple[str, str]:
    """Import and schema checks run in a clean interpreter."""
    return "example_provider", "ExampleLayer"


class TestExampleConformance(SemanticProviderConformance):
    """Run the reusable SDK suite against the SDK-only example adapter."""


@pytest.mark.parametrize(
    "violation",
    [
        "import flask",
        "open('/conformance-schema-must-not-read')",
        "__import__('socket').create_connection(('localhost', 1))",
    ],
)
def test_isolation_rejects_caught_attempts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, violation: str
) -> None:
    """A provider swallowing the tripwire exception must still fail its lane."""
    module: Path = tmp_path / "bad_schema_provider.py"
    module.write_text(
        "class Layer:\n"
        "    @classmethod\n"
        "    def get_configuration_schema(cls, configuration=None):\n"
        "        try:\n"
        f"            {violation}\n"
        "        except (ImportError, AssertionError):\n"
        "            pass\n"
        "        return {}\n",
        encoding="utf-8",
    )
    monkeypatch.syspath_prepend(str(tmp_path))
    suite: SemanticProviderConformance = SemanticProviderConformance()
    with pytest.raises(AssertionError, match="AssertionError"):
        suite.test_imports_and_static_schema(("bad_schema_provider", "Layer"))


@pytest.mark.parametrize("lane", ["query", "capability"])
def test_multirow_fixture_requires_explicit_order(
    semantic_view: "QueryView",
    semantic_query_cases: dict[str, tuple[SemanticQuery, pa.Table]],
    lane: str,
) -> None:
    """The kit must not turn an incidental backend row order into an SDK rule."""
    query: SemanticQuery
    expected: pa.Table
    query, expected = semantic_query_cases["identity"]
    query = replace(query, order=None)
    suite: SemanticProviderConformance = SemanticProviderConformance()
    operation: Callable[[], None]
    if lane == "query":
        operation = partial(
            suite.test_query_outputs,
            "identity",
            semantic_view,
            {"identity": (query, expected)},
        )
    else:
        operation = partial(
            suite.test_advertised_capabilities,
            SemanticViewFeature.ROW_OFFSET,
            semantic_view,
            {"ROW_OFFSET": (replace(query, offset=1, limit=2), expected.slice(1))},
        )
    with pytest.raises(AssertionError, match="explicit order"):
        operation()


@pytest.mark.parametrize("lane", ["query", "capability"])
@pytest.mark.parametrize("variant", ["reordered", "nonnullable"])
def test_query_allows_equivalent_column_layout(
    semantic_view: "QueryView",
    semantic_query_cases: dict[str, tuple[SemanticQuery, pa.Table]],
    monkeypatch: pytest.MonkeyPatch,
    variant: str,
    lane: str,
    semantic_capability_cases: dict[str, tuple[SemanticQuery, pa.Table]],
) -> None:
    """Column layout and field nullability are not provider obligations."""
    original: Callable[[SemanticQuery], SemanticResult] = semantic_view.get_table

    def get_table(query: SemanticQuery) -> SemanticResult:
        result: SemanticResult = original(query)
        table: pa.Table = result.results
        if variant == "reordered":
            table = table.select(list(reversed(table.column_names)))
        else:
            table = table.cast(
                pa.schema(
                    [
                        field.with_nullable(table.column(field.name).null_count > 0)
                        for field in table.schema
                    ]
                )
            )
        return replace(result, results=table)

    monkeypatch.setattr(semantic_view, "get_table", get_table)
    suite: SemanticProviderConformance = SemanticProviderConformance()
    if lane == "query":
        suite.test_query_outputs("order_limit", semantic_view, semantic_query_cases)
    else:
        suite.test_advertised_capabilities(
            SemanticViewFeature.ROW_OFFSET, semantic_view, semantic_capability_cases
        )


@pytest.mark.parametrize(
    "error_type", [TypeError, AttributeError, NameError, AssertionError, KeyError]
)
def test_fault_lane_rejects_programming_errors(error_type: type[Exception]) -> None:
    """Broken provider/fixture code is not evidence of backend fault handling."""

    def broken_operation() -> SemanticResult:
        raise error_type("broken provider")

    with pytest.raises(AssertionError, match="programming error"):
        SemanticProviderConformance().test_error_categories(
            "get_table", "fault", {"get_table:fault": broken_operation}
        )


@pytest.mark.parametrize(
    "feature",
    [
        SemanticViewFeature.ADHOC_COLUMN_EXPRESSIONS,
        SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY,
    ],
)
def test_adhoc_capability_requires_expression(
    semantic_view: "QueryView",
    semantic_query_cases: dict[str, tuple[SemanticQuery, pa.Table]],
    feature: SemanticViewFeature,
) -> None:
    """A plain query cannot witness an advertised expression capability."""
    semantic_view.features = frozenset({feature})
    with pytest.raises(AssertionError, match="AdhocExpression"):
        SemanticProviderConformance().test_advertised_capabilities(
            feature, semantic_view, {feature.value: semantic_query_cases["order_limit"]}
        )


def test_generation_lane_uses_required_string_tokens(
    backend: "Backend", semantic_change_catalog: Callable[[], None]
) -> None:
    """Conformance must not invent tokenless construction absent from the SDK."""
    from conformance_provider import QueryView

    def make(token: str) -> SemanticView:
        assert isinstance(token, str), "factory requires a string token"
        return QueryView(backend, token)

    SemanticProviderConformance().test_metadata_generation(
        make, semantic_change_catalog
    )


@pytest.mark.parametrize("variant", ["type", "value", "order", "duplicate"])
def test_query_comparison_preserves_typed_ordered_values(
    semantic_view: "QueryView",
    semantic_query_cases: dict[str, tuple[SemanticQuery, pa.Table]],
    monkeypatch: pytest.MonkeyPatch,
    variant: str,
) -> None:
    """Relaxing layout must still catch corrupt answers and duplicate columns."""
    query: SemanticQuery
    expected: pa.Table
    query, expected = semantic_query_cases["identity"]
    actual: pa.Table = expected
    if variant == "type":
        actual = expected.set_column(
            1, "total", expected.column("total").cast(pa.float64())
        )
    elif variant == "value":
        actual = expected.set_column(1, "total", pa.array([3, 7, 99]))
    elif variant == "order":
        actual = expected.take([2, 1, 0])
    else:
        actual = expected.append_column("total", expected.column("total"))

    def get_table(query: SemanticQuery) -> SemanticResult:
        return SemanticResult(requests=[], results=actual)

    monkeypatch.setattr(semantic_view, "get_table", get_table)
    with pytest.raises(AssertionError):
        SemanticProviderConformance().test_query_outputs(
            "identity", semantic_view, {"identity": (query, expected)}
        )
