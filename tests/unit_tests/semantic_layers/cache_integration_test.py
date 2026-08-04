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

"""Provider-parity tests for semantic containment caching."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime
from unittest.mock import MagicMock

import pandas as pd
import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.layer import (
    SemanticCacheCapabilities,
    SemanticCacheExecutionContext,
    SemanticCacheIdentityMaterial,
    SemanticCacheResponsibility,
    SemanticCacheScope,
)
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Metric,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)

from superset.extensions import cache_manager
from superset.models.helpers import QueryResult
from superset.semantic_layers import cache as semantic_cache
from superset.semantic_layers.cache import (
    SemanticCacheOutcome,
    SemanticCacheService,
    SemanticCacheState,
)
from superset.semantic_layers.cache_policy import ContainmentCapabilities
from superset.semantic_layers.cache_repository import (
    SemanticCacheRepository,
    ViewMeta,
)
from superset.semantic_layers.mapper import (
    get_results,
    ValidatedQueryObject,
)
from superset.utils.core import QueryObjectFilterClause


class _InMemoryCache:
    def __init__(self) -> None:
        self.store: dict[str, object] = {}

    def get(self, key: str) -> object | None:
        return self.store.get(key)

    def set(self, key: str, value: object, timeout: int | None = None) -> bool:
        self.store[key] = value
        return True

    def delete(self, key: str) -> bool:
        return self.store.pop(key, None) is not None


class _ImmediateCoordinator:
    def mutate(self, key: str, operation: Callable[[], None]) -> bool:
        operation()
        return True


@pytest.fixture
def data_cache(mocker: MockerFixture) -> _InMemoryCache:
    cache: _InMemoryCache = _InMemoryCache()

    def get_data_cache(_: object) -> _InMemoryCache:
        return cache

    mocker.patch.object(
        type(cache_manager),
        "data_cache",
        property(get_data_cache),
    )
    repository: SemanticCacheRepository = SemanticCacheRepository(
        cache,
        _ImmediateCoordinator(),
    )
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    mocker.patch(
        "superset.semantic_layers.cache.semantic_cache_service",
        service,
    )
    return cache


@pytest.fixture
def provider() -> MagicMock:
    country: Dimension = Dimension(
        id="orders.country",
        name="country",
        type=pa.string(),
    )
    city: Dimension = Dimension(id="orders.city", name="city", type=pa.string())
    revenue: Metric = Metric(
        id="orders.revenue",
        name="revenue",
        type=pa.float64(),
        definition="SUM(revenue)",
        aggregation=AggregationType.SUM,
    )
    cost: Metric = Metric(
        id="orders.cost",
        name="cost",
        type=pa.float64(),
        definition="SUM(cost)",
        aggregation=AggregationType.SUM,
    )
    implementation: MagicMock = MagicMock()
    implementation.metrics = {revenue, cost}
    implementation.dimensions = {country, city}
    implementation.features = frozenset()
    implementation.get_metrics.return_value = {revenue, cost}
    implementation.get_dimensions.return_value = {country, city}
    return implementation


@pytest.fixture
def datasource(provider: MagicMock) -> MagicMock:
    semantic_view: MagicMock = MagicMock()
    layer: MagicMock = MagicMock()
    layer.semantic_cache_responsibility = SemanticCacheResponsibility.SUPERSET
    layer.semantic_cache_scope = SemanticCacheScope.GLOBAL
    layer.semantic_cache_capabilities = SemanticCacheCapabilities(
        comparisons=True,
        membership=True,
        nulls=True,
        pattern_escape="\\",
    )
    layer.get_semantic_cache_provider_identity.return_value = (
        SemanticCacheIdentityMaterial({"type": "fixture", "catalog": "one"})
    )
    semantic_view.implementation = provider
    semantic_view.semantic_layer.implementation = layer
    semantic_view.uuid = "orders-view"
    semantic_view.changed_on = datetime(2026, 1, 1)
    semantic_view.cache_timeout = 60
    semantic_view.fetch_values_predicate = None
    return semantic_view


def _result(rows: list[tuple[str, str, float]]) -> SemanticResult:
    frame: pd.DataFrame = pd.DataFrame(
        rows,
        columns=["country", "city", "revenue"],
    )
    return SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="provider query")],
        results=pa.Table.from_pandas(frame, preserve_index=False),
    )


def _query(
    datasource: MagicMock,
    *,
    columns: tuple[str, ...] = ("country", "city"),
    minimum_revenue: float | None = None,
    country: str | None = None,
    metrics: tuple[str, ...] = ("revenue",),
    force_query: bool = False,
) -> ValidatedQueryObject:
    filters: list[QueryObjectFilterClause] = []
    if minimum_revenue is not None:
        filters.append(
            QueryObjectFilterClause(
                col="revenue",
                op=">",
                val=minimum_revenue,
            )
        )
    if country is not None:
        filters.append(
            QueryObjectFilterClause(
                col="country",
                op="==",
                val=country,
            )
        )
    return ValidatedQueryObject(
        datasource=datasource,
        metrics=list(metrics),
        columns=list(columns),
        filters=filters,
        force_query=force_query,
    )


def test_forced_refresh_bypasses_read_and_replaces_cached_result(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    stale: SemanticResult = _result([("GB", "London", 10.0)])
    fresh: SemanticResult = _result([("GB", "London", 20.0)])
    provider.get_table.return_value = stale
    initial: QueryResult = get_results(_query(datasource))
    provider.get_table.return_value = fresh

    forced: QueryResult = get_results(_query(datasource, force_query=True))
    repeated: QueryResult = get_results(_query(datasource))

    assert initial.df["revenue"].tolist() == [10.0]
    assert forced.df["revenue"].tolist() == [20.0]
    assert forced.semantic_cache_hit is False
    assert repeated.df["revenue"].tolist() == [20.0]
    assert repeated.semantic_cache_hit is True
    assert provider.get_table.call_count == 2


def test_failed_forced_refresh_does_not_replace_cached_result(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    stale: SemanticResult = _result([("GB", "London", 10.0)])
    provider.get_table.return_value = stale
    get_results(_query(datasource))
    provider.get_table.side_effect = RuntimeError("provider unavailable")

    with pytest.raises(RuntimeError, match="provider unavailable"):
        get_results(_query(datasource, force_query=True))

    provider.get_table.side_effect = None
    provider.get_table.return_value = _result([("GB", "London", 30.0)])
    repeated: QueryResult = get_results(_query(datasource))

    assert repeated.df["revenue"].tolist() == [10.0]
    assert repeated.semantic_cache_hit is True
    assert provider.get_table.call_count == 2


def test_forced_refresh_preserves_unrelated_query_shapes(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    provider.get_table.side_effect = [
        _result([("US", "New York", 10.0)]),
        _result([("GB", "London", 20.0)]),
        _result([("US", "New York", 30.0)]),
    ]
    get_results(_query(datasource, country="US"))
    get_results(_query(datasource, country="GB"))

    forced: QueryResult = get_results(
        _query(datasource, country="US", force_query=True)
    )
    unrelated: QueryResult = get_results(_query(datasource, country="GB"))

    assert forced.df["revenue"].tolist() == [30.0]
    assert unrelated.df["revenue"].tolist() == [20.0]
    assert unrelated.semantic_cache_hit is True
    assert provider.get_table.call_count == 3


def test_forced_store_regression_kills_noop_store_collaborator(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    service: SemanticCacheService = semantic_cache.semantic_cache_service

    class ForcedStoreNoopService:
        state: SemanticCacheState = service.state

        def execute(
            self,
            meta: ViewMeta,
            query: SemanticQuery,
            dispatcher: Callable[[SemanticQuery], SemanticResult],
            *,
            capabilities: ContainmentCapabilities,
            force: bool = False,
        ) -> SemanticCacheOutcome:
            if force:
                return SemanticCacheOutcome(dispatcher(query), cache_hit=False)
            return service.execute(
                meta,
                query,
                dispatcher,
                capabilities=capabilities,
            )

    mocker.patch.object(
        semantic_cache,
        "semantic_cache_service",
        ForcedStoreNoopService(),
    )
    provider.get_table.return_value = _result([("GB", "London", 10.0)])
    get_results(_query(datasource))
    provider.get_table.return_value = _result([("GB", "London", 20.0)])
    get_results(_query(datasource, force_query=True))
    repeated: QueryResult = get_results(_query(datasource))

    with pytest.raises(AssertionError):
        assert repeated.df["revenue"].tolist() == [20.0]


def test_exact_reuse_matches_direct_provider_result(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    expected: SemanticResult = _result([("GB", "London", 10.0)])
    provider.get_table.return_value = expected

    direct_result: QueryResult = get_results(_query(datasource))
    cached_result: QueryResult = get_results(_query(datasource))
    direct: pd.DataFrame = direct_result.df
    cached: pd.DataFrame = cached_result.df

    pd.testing.assert_frame_equal(cached, direct)
    assert direct_result.semantic_cache_hit is False
    assert cached_result.semantic_cache_hit is True
    assert provider.get_table.call_count == 1


def test_leftover_filter_matches_direct_provider_result(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    broad: SemanticResult = _result([("GB", "London", 10.0), ("US", "Boston", 20.0)])
    provider.get_table.return_value = broad
    get_results(_query(datasource))

    cached: pd.DataFrame = get_results(_query(datasource, country="US")).df

    assert cached["revenue"].tolist() == [20.0]
    assert provider.get_table.call_count == 1


def test_projection_and_rollup_match_provider_shape(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    broad: SemanticResult = _result([("GB", "London", 10.0), ("GB", "Leeds", 5.0)])
    provider.get_table.return_value = broad
    get_results(_query(datasource))

    cached: pd.DataFrame = get_results(_query(datasource, columns=("country",))).df

    assert cached.to_dict("records") == [{"country": "GB", "revenue": 15.0}]
    assert provider.get_table.call_count == 1


def test_metric_projection_matches_direct_provider_result(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    frame: pd.DataFrame = pd.DataFrame(
        [("GB", "London", 10.0, 4.0)],
        columns=["country", "city", "revenue", "cost"],
    )
    broad: SemanticResult = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="provider query")],
        results=pa.Table.from_pandas(frame, preserve_index=False),
    )
    provider.get_table.return_value = broad
    get_results(_query(datasource, metrics=("revenue", "cost")))

    cached: pd.DataFrame = get_results(_query(datasource)).df

    assert cached.columns.tolist() == ["country", "city", "revenue"]
    assert provider.get_table.call_count == 1


def test_missing_exact_value_falls_back_to_rollup_candidate(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    exact: SemanticResult = _result([("GB", "", 15.0)])
    broad: SemanticResult = _result([("GB", "London", 10.0), ("GB", "Leeds", 5.0)])
    provider.get_table.side_effect = [exact, broad]
    get_results(_query(datasource, columns=("country",)))
    get_results(_query(datasource))

    value_keys: list[str] = [
        key
        for key, value in data_cache.store.items()
        if isinstance(value, SemanticResult)
    ]
    assert value_keys
    data_cache.delete(value_keys[0])

    cached: pd.DataFrame = get_results(_query(datasource, columns=("country",))).df

    assert cached.to_dict("records") == [{"country": "GB", "revenue": 15.0}]
    assert provider.get_table.call_count == 2


def test_non_additive_rollup_executes_provider(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    average: Metric = next(
        metric for metric in provider.metrics if metric.name == "revenue"
    )
    provider.metrics = {
        Metric(
            id=average.id,
            name=average.name,
            type=average.type,
            definition="AVG(revenue)",
            aggregation=AggregationType.AVG,
        )
    }
    provider.get_metrics.return_value = provider.metrics
    provider.get_table.side_effect = [
        _result([("GB", "London", 10.0), ("GB", "Leeds", 20.0)]),
        _result([("GB", "", 15.0)]),
    ]
    get_results(_query(datasource))

    get_results(_query(datasource, columns=("country",)))

    assert provider.get_table.call_count == 2


def test_provider_owned_layer_bypasses_containment(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    layer: MagicMock = datasource.semantic_layer.implementation
    layer.semantic_cache_responsibility = SemanticCacheResponsibility.PROVIDER
    provider.get_table.return_value = _result([("GB", "London", 10.0)])

    first: QueryResult = get_results(_query(datasource))
    second: QueryResult = get_results(_query(datasource))

    assert first.semantic_cache_hit is False
    assert second.semantic_cache_hit is False
    assert provider.get_table.call_count == 2


def test_execution_context_identity_isolates_cached_results(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    layer: MagicMock = datasource.semantic_layer.implementation
    layer.semantic_cache_scope = SemanticCacheScope.EXECUTION_CONTEXT

    def identity_for_context(
        context: SemanticCacheExecutionContext,
    ) -> SemanticCacheIdentityMaterial:
        return SemanticCacheIdentityMaterial(
            {"principal": context.principal_id, "roles": context.role_ids}
        )

    layer.get_semantic_cache_context_identity.side_effect = identity_for_context
    first_context: SemanticCacheExecutionContext = SemanticCacheExecutionContext(
        "one", ("gamma",), "first-security-context"
    )
    second_context: SemanticCacheExecutionContext = SemanticCacheExecutionContext(
        "one", ("gamma",), "second-security-context"
    )
    mocker.patch(
        "superset.semantic_layers.cache_host._execution_context",
        side_effect=[first_context, first_context, second_context],
    )
    provider.get_table.return_value = _result([("GB", "London", 10.0)])

    first: QueryResult = get_results(_query(datasource))
    repeated: QueryResult = get_results(_query(datasource))
    isolated: QueryResult = get_results(_query(datasource))

    assert first.semantic_cache_hit is False
    assert repeated.semantic_cache_hit is True
    assert isolated.semantic_cache_hit is False
    assert provider.get_table.call_count == 2


def test_global_scope_shares_cache_without_request_context_identity(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
) -> None:
    layer: MagicMock = datasource.semantic_layer.implementation
    layer.semantic_cache_scope = SemanticCacheScope.GLOBAL
    provider.get_table.return_value = _result([("GB", "London", 10.0)])

    first: QueryResult = get_results(_query(datasource))
    second: QueryResult = get_results(_query(datasource))

    assert first.semantic_cache_hit is False
    assert second.semantic_cache_hit is True
    assert provider.get_table.call_count == 1
    layer.get_semantic_cache_context_identity.assert_not_called()


def test_missing_execution_context_bypasses_cache(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    layer: MagicMock = datasource.semantic_layer.implementation
    layer.semantic_cache_scope = SemanticCacheScope.EXECUTION_CONTEXT
    mocker.patch(
        "superset.semantic_layers.cache_host._execution_context",
        return_value=None,
    )
    provider.get_table.return_value = _result([("GB", "London", 10.0)])

    first: QueryResult = get_results(_query(datasource))
    second: QueryResult = get_results(_query(datasource))

    assert first.semantic_cache_hit is False
    assert second.semantic_cache_hit is False
    assert provider.get_table.call_count == 2


def test_cache_logs_do_not_include_provider_identity_material(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    sensitive_value: str = "tenant-secret-value"
    layer: MagicMock = datasource.semantic_layer.implementation
    layer.get_semantic_cache_provider_identity.return_value = (
        SemanticCacheIdentityMaterial({"tenant": sensitive_value})
    )
    provider.get_table.return_value = _result([("GB", "London", 10.0)])

    with caplog.at_level(logging.DEBUG):
        get_results(_query(datasource))

    assert sensitive_value not in caplog.text


@pytest.mark.parametrize(
    "identity_change",
    ["definition", "provider_type", "provider_configuration"],
)
def test_result_affecting_identity_change_forces_provider_fallback(
    data_cache: _InMemoryCache,
    provider: MagicMock,
    datasource: MagicMock,
    identity_change: str,
) -> None:
    provider.get_table.return_value = _result([("GB", "London", 10.0)])
    get_results(_query(datasource))
    get_results(_query(datasource))
    assert provider.get_table.call_count == 1
    layer: MagicMock = datasource.semantic_layer.implementation

    if identity_change == "definition":
        datasource.changed_on = datetime(2026, 2, 1)
    elif identity_change == "provider_type":
        layer.get_semantic_cache_provider_identity.return_value = (
            SemanticCacheIdentityMaterial({"type": "replacement", "catalog": "one"})
        )
    else:
        layer.get_semantic_cache_provider_identity.return_value = (
            SemanticCacheIdentityMaterial({"type": "fixture", "catalog": "two"})
        )

    get_results(_query(datasource))

    assert provider.get_table.call_count == 2
