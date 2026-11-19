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

"""The host's default chronological order for unordered semantic queries."""

from collections.abc import Callable
from dataclasses import replace
from datetime import date, datetime
from unittest.mock import call, Mock

import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Metric,
    OrderDirection,
    OrderTuple,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers import mapper
from superset.semantic_layers.cache import (
    SemanticCacheOutcome,
    SemanticCacheService,
    SemanticCacheState,
)
from superset.semantic_layers.cache_policy import ContainmentCapabilities
from superset.semantic_layers.cache_repository import SemanticCacheRepository
from superset.semantic_layers.cache_transform import (
    SemanticCacheRollupRefusedError,
    SemanticCacheTransformationError,
    transform_result,
)
from superset.semantic_layers.cache_types import (
    CachedEntry,
    CachedResultCandidate,
    ReuseDecision,
    ReuseMode,
    SemanticCacheLookupResult,
)
from tests.unit_tests.semantic_layers.conftest import build_view_meta

SALES: Metric = Metric(
    id="orders.total_sales",
    name="total_sales",
    type=pa.float64(),
    definition="SUM(amount)",
)
REGION: Dimension = Dimension(
    id="customers.region", name="region", type=pa.utf8(), definition="region"
)
ORDER_DATE: Dimension = Dimension(
    id="orders.order_date", name="order_date", type=pa.date32(), definition="d"
)
SHIPPED_AT: Dimension = Dimension(
    id="orders.shipped_at",
    name="shipped_at",
    type=pa.timestamp("us"),
    definition="s",
)
EMPTY_RESULT: SemanticResult = SemanticResult(
    requests=[], results=pa.table({"total_sales": pa.array([], pa.float64())})
)


def _dispatch(mocker: MockerFixture, query: SemanticQuery) -> SemanticQuery:
    """Dispatch *query* and return the query the provider received."""
    provider: Mock = mocker.Mock(return_value=EMPTY_RESULT)
    mapper._dispatch_semantic_query(mocker.Mock(), provider, query, cacheable=False)
    provider.assert_called_once()
    received: SemanticQuery = provider.call_args.args[0]
    return received


@pytest.mark.parametrize(
    "dimensions, expected",
    [
        # The first selected temporal dimension, ascending.
        ([REGION, SHIPPED_AT, ORDER_DATE], [(SHIPPED_AT, OrderDirection.ASC)]),
        ([ORDER_DATE, SHIPPED_AT], [(ORDER_DATE, OrderDirection.ASC)]),
        # No temporal dimension: the query stays unordered.
        ([REGION], None),
        ([], None),
    ],
)
def test_unordered_query_gets_default_chronological_order(
    mocker: MockerFixture,
    dimensions: list[Dimension],
    expected: list[OrderTuple] | None,
) -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[SALES], dimensions=dimensions, limit=10
    )

    received: SemanticQuery = _dispatch(mocker, query)

    assert received.order == expected
    assert received.limit == 10
    assert received.dimensions == dimensions


@pytest.mark.parametrize(
    "order",
    [
        [(SALES, OrderDirection.DESC)],
        [(REGION, OrderDirection.ASC), (ORDER_DATE, OrderDirection.DESC)],
    ],
)
def test_explicit_order_reaches_the_provider_unchanged(
    mocker: MockerFixture, order: list[OrderTuple]
) -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[SALES], dimensions=[ORDER_DATE, REGION], order=order, limit=5
    )

    assert _dispatch(mocker, query) is query


def test_default_order_leaves_the_cache_identity_unchanged(
    mocker: MockerFixture,
) -> None:
    """The cache keys and reuses on the query as mapped, not the provider's copy."""
    service: Mock = mocker.patch.object(mapper.semantic_cache, "semantic_cache_service")
    service.state.effective = True
    mocker.patch.object(
        mapper,
        "build_cache_configuration",
        return_value=(mocker.Mock(), mocker.Mock()),
    )
    service.execute.side_effect = lambda meta, query, dispatch, **kwargs: (
        SemanticCacheOutcome(dispatch(query), cache_hit=False)
    )
    provider: Mock = mocker.Mock(return_value=EMPTY_RESULT)
    query: SemanticQuery = SemanticQuery(metrics=[SALES], dimensions=[ORDER_DATE])

    mapper._dispatch_semantic_query(mocker.Mock(), provider, query)

    assert service.execute.call_args.args[1] is query
    assert provider.call_args.args[0].order == [(ORDER_DATE, OrderDirection.ASC)]


def test_row_count_dispatch_bypasses_the_cache(mocker: MockerFixture) -> None:
    """Descriptors assume the default order, so an unordered count is never stored."""
    service: Mock = mocker.patch.object(mapper.semantic_cache, "semantic_cache_service")
    service.state.effective = True
    mocker.patch.object(
        mapper,
        "build_cache_configuration",
        return_value=(mocker.Mock(), mocker.Mock()),
    )
    service.execute_provider.side_effect = lambda query, dispatch: SemanticCacheOutcome(
        dispatch(query), cache_hit=False
    )
    provider: Mock = mocker.Mock(return_value=EMPTY_RESULT)
    query: SemanticQuery = SemanticQuery(metrics=[SALES], dimensions=[ORDER_DATE])

    mapper._dispatch_semantic_query(mocker.Mock(), provider, query, row_count=True)

    service.execute.assert_not_called()
    assert provider.call_args.args[0] is query


class _MemoryBackend:
    """A dict-backed cache backend that keeps every value it is given."""

    def __init__(self) -> None:
        self.values: dict[str, object] = {}

    def get(self, key: str) -> object | None:
        return self.values.get(key)

    def has(self, key: str) -> bool:
        return key in self.values

    def set(self, key: str, value: object, timeout: int | None = None) -> bool:
        self.values[key] = value
        return True

    def delete(self, key: str) -> bool:
        return self.values.pop(key, None) is not None


class _InlineCoordinator:
    def mutate(self, key: str, operation: Callable[[], None]) -> bool:
        operation()
        return True


PRODUCT: Dimension = Dimension(
    id="products.product", name="product", type=pa.utf8(), definition="product"
)
SUMMED_SALES: Metric = replace(SALES, aggregation=AggregationType.SUM)


def _serve_from_cache(
    stored_query: SemanticQuery,
    stored_rows: dict[str, list[object]],
    query: SemanticQuery,
) -> dict[str, list[object]] | None:
    """Store a provider result for *stored_query*, then serve *query* from it."""
    repository: SemanticCacheRepository = SemanticCacheRepository(
        _MemoryBackend(), _InlineCoordinator(), clock=lambda: 10.0
    )
    schema: pa.Schema = pa.schema(
        [
            *(pa.field(d.name, d.type) for d in stored_query.dimensions),
            *(pa.field(m.name, m.type) for m in stored_query.metrics),
        ]
    )
    stored: SemanticResult = SemanticResult(
        requests=[], results=pa.Table.from_pydict(stored_rows, schema=schema)
    )
    repository.store(build_view_meta(), stored_query, stored)
    lookup: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    )
    if not lookup.candidates:
        return None
    candidate: CachedResultCandidate = lookup.candidates[0]
    try:
        served: SemanticResult = transform_result(
            candidate.result, query, candidate.decision, ContainmentCapabilities()
        )
    except SemanticCacheTransformationError:
        return None
    return served.results.to_pydict()


def test_rollup_that_would_cut_rows_is_not_served_from_cache() -> None:
    """A local chronological sort cannot prove the provider's page membership."""
    stored_query: SemanticQuery = SemanticQuery(
        metrics=[SUMMED_SALES], dimensions=[REGION, PRODUCT, ORDER_DATE]
    )
    # Rows as a provider returns them for the stored query: by order_date.
    stored_rows: dict[str, list[object]] = {
        "region": ["West", "East", "East", "West", "East"],
        "product": ["p1", "p1", "p2", "p1", "p1"],
        "order_date": [
            date(2026, 1, 1),
            date(2026, 1, 2),
            date(2026, 1, 2),
            date(2026, 1, 3),
            date(2026, 1, 4),
        ],
        "total_sales": [5.0, 1.0, 1.0, 3.0, 2.0],
    }
    query: SemanticQuery = SemanticQuery(
        metrics=[SUMMED_SALES], dimensions=[REGION, ORDER_DATE], limit=2
    )

    assert _serve_from_cache(stored_query, stored_rows, query) is None


def test_limited_hit_is_not_reused_under_a_different_default_order() -> None:
    """A top-N cut by one temporal dimension cannot answer a cut by another."""
    rows: dict[str, list[object]] = {
        "order_date": [date(2026, 1, 1), date(2026, 1, 2)],
        "shipped_at": [datetime(2026, 1, 9), datetime(2026, 1, 3)],
        "total_sales": [1.0, 2.0],
    }
    stored_query: SemanticQuery = SemanticQuery(
        metrics=[SALES], dimensions=[ORDER_DATE, SHIPPED_AT], limit=2
    )

    assert (
        _serve_from_cache(
            stored_query,
            rows,
            replace(stored_query, dimensions=[SHIPPED_AT, ORDER_DATE]),
        )
        is None
    )
    assert _serve_from_cache(stored_query, rows, replace(stored_query, limit=1)) == {
        "order_date": [date(2026, 1, 1)],
        "shipped_at": [datetime(2026, 1, 9)],
        "total_sales": [1.0],
    }


@pytest.mark.parametrize(
    "stored_dimensions, query_dimensions, expected",
    [
        # Dropping the time dimension: the rollup promises no order.
        (
            [REGION, ORDER_DATE],
            [REGION],
            {"region": ["East", "West"], "total_sales": [3.0, 5.0]},
        ),
        # The entry defaulted to shipped_at; the rollup re-sorts by order_date.
        (
            [REGION, SHIPPED_AT, ORDER_DATE],
            [REGION, ORDER_DATE],
            {
                "region": ["West", "East"],
                "order_date": [date(2026, 1, 1), date(2026, 1, 2)],
                "total_sales": [5.0, 3.0],
            },
        ),
    ],
)
def test_rollup_reuses_an_unlimited_entry_whatever_its_default_order(
    stored_dimensions: list[Dimension],
    query_dimensions: list[Dimension],
    expected: dict[str, list[object]],
) -> None:
    columns: dict[str, list[object]] = {
        "region": ["East", "West", "East"],
        "shipped_at": [
            datetime(2026, 1, 1),
            datetime(2026, 1, 2),
            datetime(2026, 1, 3),
        ],
        "order_date": [date(2026, 1, 2), date(2026, 1, 1), date(2026, 1, 2)],
        "total_sales": [1.0, 5.0, 2.0],
    }
    stored_rows: dict[str, list[object]] = {
        name: values
        for name, values in columns.items()
        if name in {d.name for d in stored_dimensions} or name == "total_sales"
    }
    stored_query: SemanticQuery = SemanticQuery(
        metrics=[SUMMED_SALES], dimensions=stored_dimensions
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[SUMMED_SALES], dimensions=query_dimensions
    )

    assert _serve_from_cache(stored_query, stored_rows, query) == expected


def test_store_replaces_a_descriptor_written_without_the_default_order() -> None:
    """A pre-upgrade entry for the same value is re-registered, not deduplicated."""
    backend: _MemoryBackend = _MemoryBackend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend, _InlineCoordinator(), clock=lambda: 10.0
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[SALES], dimensions=[ORDER_DATE], limit=2
    )
    result: SemanticResult = SemanticResult(
        requests=[],
        results=pa.table(
            {
                "order_date": pa.array([date(2026, 1, 1)], pa.date32()),
                "total_sales": [1.0],
            }
        ),
    )
    repository.store(build_view_meta(), query, result)
    # Rewrite the descriptor as an upgrade would find it: same value, no order.
    bucket_key: str = next(
        key for key, value in backend.values.items() if isinstance(value, list)
    )
    entries: list[CachedEntry] = backend.values[bucket_key]  # type: ignore[assignment]
    backend.values[bucket_key] = [replace(entry, order_key="") for entry in entries]
    assert not repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    ).candidates

    assert repository.store(build_view_meta(), query, result, replace=False)

    lookup: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    )
    assert [candidate.decision.mode for candidate in lookup.candidates] == [
        ReuseMode.EXACT
    ]


@pytest.mark.parametrize("case", ["null_first", "split_tie"])
def test_limited_rollup_defers_to_provider_when_page_membership_can_differ(
    case: str,
) -> None:
    """A local sort must not choose a different limited page from the provider."""
    repository: SemanticCacheRepository = SemanticCacheRepository(
        _MemoryBackend(),
        _InlineCoordinator(),
        clock=lambda: 10.0,
    )
    stored_query: SemanticQuery = SemanticQuery(
        [SUMMED_SALES],
        [REGION, PRODUCT, ORDER_DATE],
    )
    query: SemanticQuery = SemanticQuery([SUMMED_SALES], [REGION, ORDER_DATE], limit=1)
    if case == "null_first":
        stored_rows: dict[str, list[object]] = {
            "region": ["West", "East", "East"],
            "product": ["p1", "p1", "p2"],
            "order_date": [None, date(2026, 1, 1), date(2026, 1, 2)],
            "total_sales": [5.0, 1.0, 2.0],
        }
        provider_rows: dict[str, list[object]] = {
            "region": ["West"],
            "order_date": [None],
            "total_sales": [5.0],
        }
    else:
        stored_rows = {
            "region": ["Zulu", "Alpha", "Zulu"],
            "product": ["p1", "p1", "p2"],
            "order_date": [date(2026, 1, 1)] * 3,
            "total_sales": [2.0, 7.0, 3.0],
        }
        provider_rows = {
            "region": ["Zulu"],
            "order_date": [date(2026, 1, 1)],
            "total_sales": [5.0],
        }
    source_schema: pa.Schema = pa.schema(
        [
            *(pa.field(d.name, d.type) for d in stored_query.dimensions),
            pa.field(SUMMED_SALES.name, SUMMED_SALES.type),
        ]
    )
    requested_schema: pa.Schema = pa.schema(
        [
            *(pa.field(d.name, d.type) for d in query.dimensions),
            pa.field(SUMMED_SALES.name, SUMMED_SALES.type),
        ]
    )
    repository.store(
        build_view_meta(),
        stored_query,
        SemanticResult(
            requests=[],
            results=pa.Table.from_pydict(stored_rows, schema=source_schema),
        ),
    )
    candidates: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(),
        query,
        ContainmentCapabilities(),
    )
    assert candidates.candidates[0].decision.mode is ReuseMode.ROLLUP
    result: SemanticResult = SemanticResult(
        requests=[],
        results=pa.Table.from_pydict(provider_rows, schema=requested_schema),
    )
    provider: Mock = Mock(return_value=result)
    metrics: Mock = Mock()
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
        metrics,
    )
    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        query,
        provider,
        capabilities=ContainmentCapabilities(),
    )
    assert outcome.result.results.equals(result.results)
    assert outcome.cache_hit is False
    provider.assert_called_once_with(query)
    metrics.incr.assert_any_call("semantic_cache.containment.rollup_refused")
    metrics.incr.assert_any_call("semantic_cache.containment.miss")
    assert all(
        call.args != ("semantic_cache.containment.transform_failure",)
        for call in metrics.incr.call_args_list
    )
    cached: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        query,
        provider,
        capabilities=ContainmentCapabilities(),
    )
    assert cached.cache_hit is True
    assert metrics.incr.call_args_list == [
        call("semantic_cache.containment.rollup_refused"),
        call("semantic_cache.containment.miss"),
        call("semantic_cache.containment.hit"),
    ]
    assert cached.result.results.equals(result.results)
    provider.assert_called_once_with(query)


@pytest.mark.parametrize("limit", [None, 2, 3])
@pytest.mark.parametrize("kind", ["dates", "null_time", "ties"])
def test_complete_rollup_remains_reusable_with_a_fitting_limit(
    limit: int | None,
    kind: str,
) -> None:
    """The row bound uses actual groups, not the larger cached input count."""
    stored_query: SemanticQuery = SemanticQuery(
        [SUMMED_SALES],
        [REGION, PRODUCT, ORDER_DATE],
    )
    stored_rows: dict[str, list[object]] = {
        "region": ["East", "East", "West", "West"],
        "product": ["p1", "p2", "p1", "p2"],
        "order_date": [
            date(2026, 1, 1),
            date(2026, 1, 1),
            date(2026, 1, 2),
            date(2026, 1, 2),
        ],
        "total_sales": [1.0, 2.0, 3.0, 4.0],
    }
    expected: dict[str, list[object]] = {
        "region": ["East", "West"],
        "order_date": [date(2026, 1, 1), date(2026, 1, 2)],
        "total_sales": [3.0, 7.0],
    }
    if kind == "null_time":
        stored_rows["order_date"] = [None, None, date(2026, 1, 2), date(2026, 1, 2)]
        expected = {
            "region": ["West", "East"],
            "order_date": [date(2026, 1, 2), None],
            "total_sales": [7.0, 3.0],
        }
    elif kind == "ties":
        stored_rows["order_date"] = [
            date(2026, 1, 1),
            date(2026, 1, 1),
            date(2026, 1, 1),
            date(2026, 1, 1),
        ]
        expected["order_date"] = [date(2026, 1, 1), date(2026, 1, 1)]
    query: SemanticQuery = SemanticQuery(
        [SUMMED_SALES],
        [REGION, ORDER_DATE],
        limit=limit,
    )
    assert _serve_from_cache(stored_query, stored_rows, query) == expected


@pytest.mark.parametrize("limit", [None, 2])
def test_rollup_with_offset_is_refused_even_when_all_groups_fit(
    limit: int | None,
) -> None:
    """A local sort cannot decide which provider rows an offset skips."""
    query: SemanticQuery = SemanticQuery(
        [SUMMED_SALES], [ORDER_DATE], offset=1, limit=limit
    )
    result: SemanticResult = SemanticResult(
        requests=[],
        results=pa.table(
            {
                "order_date": pa.array([None, date(2026, 1, 1)], pa.date32()),
                "product": ["p1", "p2"],
                "total_sales": [1.0, 2.0],
            }
        ),
    )
    with pytest.raises(SemanticCacheRollupRefusedError):
        transform_result(
            result,
            query,
            ReuseDecision(ReuseMode.ROLLUP, frozenset()),
            ContainmentCapabilities(),
        )
