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
from typing import cast
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from flask_caching.backends.nullcache import NullCache
from flask_caching.backends.rediscache import RedisSentinelCache
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Metric,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers.cache import (
    eligible_reuse_mode,
    initialize_semantic_cache,
    rank_eligible_entries,
    SafeSemanticCacheBackend,
    SemanticCacheDisabledReason,
    SemanticCacheOutcome,
    SemanticCacheService,
    SemanticCacheState,
)
from superset.semantic_layers.cache_coordination import OwnerTokenCoordinationBackend
from superset.semantic_layers.cache_policy import (
    ContainmentCapabilities,
    ReuseDecision,
    ReuseMode,
)
from superset.semantic_layers.cache_repository import (
    CachedEntry,
    CachedResultCandidate,
    SemanticCacheBackend,
    SemanticCacheBackendError,
    SemanticCacheLookupError,
    SemanticCacheLookupResult,
    SemanticCacheRepository,
)
from tests.unit_tests.semantic_layers.conftest import (
    build_semantic_query,
    build_semantic_result,
    build_view_meta,
)


class _ImmediateCoordinator:
    def mutate(self, key: str, operation: Callable[[], None]) -> bool:
        operation()
        return True


class _OwnerTokenBackend:
    def acquire_owner_token(
        self,
        key: str,
        owner_token: str,
        lease_seconds: int,
    ) -> bool:
        return True

    def release_owner_token(self, key: str, owner_token: str) -> bool:
        return True

    def refresh_owner_token(
        self,
        key: str,
        owner_token: str,
        lease_seconds: int,
    ) -> bool:
        return True


def _metric(
    metric_id: str,
    aggregation: AggregationType | None = AggregationType.SUM,
) -> Metric:
    return Metric(
        id=metric_id,
        name=metric_id,
        type=pa.float64(),
        definition=f"{aggregation or 'unknown'}({metric_id})",
        aggregation=aggregation,
    )


def _dimension(dimension_id: str) -> Dimension:
    return Dimension(id=dimension_id, name=dimension_id, type=pa.string())


def _query(
    *,
    dimensions: tuple[str, ...] = ("country",),
    metrics: tuple[Metric, ...] = (_metric("revenue"),),
    limit: int | None = None,
    offset: int | None = None,
) -> SemanticQuery:
    return SemanticQuery(
        metrics=list(metrics),
        dimensions=[_dimension(key) for key in dimensions],
        limit=limit,
        offset=offset,
    )


def _entry(
    *,
    dimensions: tuple[str, ...] = ("country",),
    metrics: tuple[Metric, ...] = (_metric("revenue"),),
    limit: int | None = None,
    offset: int = 0,
    order_key: str = "",
    group_limit_key: str = "",
    value_key: str = "value",
    timestamp: float = 1.0,
) -> CachedEntry:
    return CachedEntry(
        filters=frozenset(),
        dimensions=frozenset(_dimension(key) for key in dimensions),
        metrics=frozenset(metrics),
        limit=limit,
        offset=offset,
        order_key=order_key,
        group_limit_key=group_limit_key,
        value_key=value_key,
        timestamp=timestamp,
    )


def test_disabled_state_is_safely_ineffective() -> None:
    state: SemanticCacheState = SemanticCacheState.disabled(
        SemanticCacheDisabledReason.FLAG_OFF
    )

    assert state.requested is False
    assert state.effective is False
    assert state.disabled_reason is SemanticCacheDisabledReason.FLAG_OFF


def test_requested_unsupported_state_preserves_request() -> None:
    state: SemanticCacheState = SemanticCacheState.disabled(
        SemanticCacheDisabledReason.UNSUPPORTED_COORDINATION,
        requested=True,
    )

    assert state.requested is True
    assert state.effective is False


@pytest.mark.parametrize(
    "requested,effective,disabled_reason,error_match",
    [
        (False, True, None, "must be requested"),
        (
            True,
            True,
            SemanticCacheDisabledReason.FLAG_OFF,
            "cannot have a disabled reason",
        ),
        (True, False, None, "requires a disabled reason"),
    ],
)
def test_cache_state_rejects_contradictory_combinations(
    requested: bool,
    effective: bool,
    disabled_reason: SemanticCacheDisabledReason | None,
    error_match: str,
) -> None:
    with pytest.raises(ValueError, match=error_match):
        SemanticCacheState(
            requested=requested,
            effective=effective,
            disabled_reason=disabled_reason,
        )


def test_enabled_state_has_one_valid_representation() -> None:
    state: SemanticCacheState = SemanticCacheState.enabled()

    assert state.requested is True
    assert state.effective is True
    assert state.disabled_reason is None


def test_default_service_executes_provider_without_touching_cache() -> None:
    service: SemanticCacheService = SemanticCacheService.default_ineffective()
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.result == build_semantic_result()
    assert outcome.cache_hit is False
    provider.assert_called_once()


def test_application_metrics_use_fixed_names_and_are_non_fatal() -> None:
    metrics: MagicMock = MagicMock()
    metrics.incr.side_effect = RuntimeError("metrics unavailable")
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.disabled(SemanticCacheDisabledReason.FLAG_OFF),
        metrics=metrics,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.cache_hit is False
    metrics.incr.assert_called_once_with("semantic_cache.containment.bypass")


@pytest.mark.parametrize("operation", ["get", "set", "delete"])
def test_safe_backend_translates_pluggable_cache_failures(operation: str) -> None:
    delegate: MagicMock = MagicMock()
    getattr(delegate, operation).side_effect = RuntimeError("client unavailable")
    backend: SafeSemanticCacheBackend = SafeSemanticCacheBackend(delegate)
    operation_call: Callable[[], object] = {
        "get": lambda: backend.get("key"),
        "set": lambda: backend.set("key", "value", timeout=30),
        "delete": lambda: backend.delete("key"),
    }[operation]

    with pytest.raises(SemanticCacheBackendError, match=operation):
        operation_call()


@pytest.mark.parametrize(
    "parent_enabled,requested,coordination,expected_reason",
    [
        (
            False,
            True,
            _OwnerTokenBackend(),
            SemanticCacheDisabledReason.PARENT_FLAG_OFF,
        ),
        (True, False, _OwnerTokenBackend(), SemanticCacheDisabledReason.FLAG_OFF),
        (True, True, None, SemanticCacheDisabledReason.UNSUPPORTED_COORDINATION),
    ],
)
def test_initialization_preserves_requested_and_effective_state(
    parent_enabled: bool,
    requested: bool,
    coordination: OwnerTokenCoordinationBackend | None,
    expected_reason: SemanticCacheDisabledReason,
) -> None:
    backend: MagicMock = MagicMock()

    state: SemanticCacheState = initialize_semantic_cache(
        parent_enabled=parent_enabled,
        requested=requested,
        backend=backend,
        coordination=coordination,
        wait_seconds=1.0,
        lease_seconds=30,
    )

    assert state.requested is requested
    assert state.effective is False
    assert state.disabled_reason is expected_reason


@pytest.mark.parametrize(
    "wait_seconds,lease_seconds",
    [
        (float("nan"), 30),
        (1.0, 0),
        (True, 30),
        (1.0, True),
        ("1", 30),
        (1.0, "30"),
        (None, 30),
    ],
)
def test_initialization_rejects_invalid_coordination_settings(
    wait_seconds: object,
    lease_seconds: object,
) -> None:
    state: SemanticCacheState = initialize_semantic_cache(
        parent_enabled=True,
        requested=True,
        backend=MagicMock(),
        coordination=_OwnerTokenBackend(),
        wait_seconds=wait_seconds,  # type: ignore[arg-type]
        lease_seconds=lease_seconds,  # type: ignore[arg-type]
    )

    assert state.disabled_reason is (
        SemanticCacheDisabledReason.INVALID_COORDINATION_CONFIGURATION
    )


def test_restart_configuration_converges_from_enabled_to_disabled() -> None:
    enabled: SemanticCacheState = initialize_semantic_cache(
        parent_enabled=True,
        requested=True,
        backend=MagicMock(),
        coordination=_OwnerTokenBackend(),
        wait_seconds=1.0,
        lease_seconds=30,
    )
    disabled: SemanticCacheState = initialize_semantic_cache(
        parent_enabled=True,
        requested=False,
        backend=MagicMock(),
        coordination=_OwnerTokenBackend(),
        wait_seconds=1.0,
        lease_seconds=30,
    )

    assert enabled.effective is True
    assert disabled.effective is False


def test_effective_service_requires_repository() -> None:
    with pytest.raises(ValueError, match="requires a repository"):
        SemanticCacheService(SemanticCacheState.enabled())


def test_prune_failure_does_not_prevent_provider_execution() -> None:
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.return_value = SemanticCacheLookupResult(
        candidates=(),
        missing_value_keys=frozenset({"missing"}),
    )
    repository.prune_missing.side_effect = SemanticCacheLookupError("prune unavailable")
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.cache_hit is False
    provider.assert_called_once()


def test_force_bypasses_lookup_and_stores_provider_result() -> None:
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
        force=True,
    )

    assert outcome.cache_hit is False
    repository.lookup.assert_not_called()
    repository.store.assert_called_once()
    assert repository.store.call_args.kwargs["replace"] is True


def test_ordinary_miss_does_not_replace_an_identical_concurrent_store() -> None:
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.return_value = SemanticCacheLookupResult(
        candidates=(), missing_value_keys=frozenset()
    )
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )

    service.execute(
        build_view_meta(),
        build_semantic_query(),
        MagicMock(return_value=build_semantic_result()),
        capabilities=ContainmentCapabilities(),
    )

    assert repository.store.call_args.kwargs["replace"] is False


def test_oversized_result_is_served_but_never_stored() -> None:
    """Values are pickled inside the lease and share the data cache; a result
    above the operator's cap is returned to the user and skipped."""
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.return_value = SemanticCacheLookupResult(
        candidates=(), missing_value_keys=frozenset()
    )
    metrics: MagicMock = MagicMock()
    result: SemanticResult = build_semantic_result()
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
        metrics,
        max_value_bytes=result.results.nbytes - 1,
    )

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        MagicMock(return_value=result),
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.result is result
    assert outcome.cache_hit is False
    repository.store.assert_not_called()
    metrics.incr.assert_any_call("semantic_cache.containment.store_skipped")

    within_cap: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
        metrics,
        max_value_bytes=result.results.nbytes,
    )
    within_cap.execute(
        build_view_meta(),
        build_semantic_query(),
        MagicMock(return_value=result),
        capabilities=ContainmentCapabilities(),
    )
    repository.store.assert_called_once()


def test_lookup_backend_failure_executes_provider() -> None:
    backend: MagicMock = MagicMock()
    backend.get.side_effect = SemanticCacheBackendError("lookup unavailable")
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _ImmediateCoordinator(),
    )
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.result == build_semantic_result()
    assert outcome.cache_hit is False
    provider.assert_called_once()


def test_transform_failure_falls_back_to_provider() -> None:
    query: SemanticQuery = build_semantic_query()
    incompatible_query: SemanticQuery = SemanticQuery(
        metrics=query.metrics,
        dimensions=[Dimension("missing", "Missing", pa.string())],
    )
    entry: CachedEntry = _entry()
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.return_value = SemanticCacheLookupResult(
        candidates=(
            CachedResultCandidate(
                entry,
                build_semantic_result(),
                ReuseDecision(ReuseMode.EXACT, frozenset()),
            ),
        ),
        missing_value_keys=frozenset(),
    )
    metrics: MagicMock = MagicMock()
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
        metrics,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        incompatible_query,
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.cache_hit is False
    provider.assert_called_once()
    metrics.incr.assert_any_call("semantic_cache.containment.transform_failure")


def test_store_backend_failure_returns_provider_result() -> None:
    backend: MagicMock = MagicMock()
    backend.get.return_value = None
    backend.set.side_effect = SemanticCacheBackendError("store unavailable")
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _ImmediateCoordinator(),
    )
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.result == build_semantic_result()
    assert outcome.cache_hit is False
    provider.assert_called_once()


@pytest.mark.parametrize(
    "query,entry,expected",
    [
        (_query(), _entry(), ReuseMode.EXACT),
        (
            _query(),
            _entry(metrics=(_metric("revenue"), _metric("cost"))),
            ReuseMode.PROJECT,
        ),
        (
            _query(),
            _entry(dimensions=("country", "city")),
            ReuseMode.ROLLUP,
        ),
        (
            _query(metrics=(_metric("average", AggregationType.AVG),)),
            _entry(
                dimensions=("country", "city"),
                metrics=(_metric("average", AggregationType.AVG),),
            ),
            None,
        ),
        (
            _query(metrics=(_metric("unknown", None),)),
            _entry(
                dimensions=("country", "city"),
                metrics=(_metric("unknown", None),),
            ),
            None,
        ),
    ],
)
def test_reuse_mode_requires_safe_projection_or_rollup(
    query: SemanticQuery,
    entry: CachedEntry,
    expected: ReuseMode | None,
) -> None:
    assert eligible_reuse_mode(query, entry) is expected


@pytest.mark.parametrize(
    "query,entry",
    [
        (_query(limit=20), _entry(limit=10)),
        (_query(limit=10), _entry(limit=20, order_key="different")),
        (_query(offset=1), _entry(offset=0)),
        (_query(offset=1), _entry(offset=1)),
        (_query(), _entry(group_limit_key="cached-group-limit")),
    ],
)
def test_reuse_rejects_incompatible_limit_order_offset_and_group_limit(
    query: SemanticQuery,
    entry: CachedEntry,
) -> None:
    assert eligible_reuse_mode(query, entry) is None


def test_candidate_ranking_prefers_mode_then_freshest_equal_rank() -> None:
    query: SemanticQuery = _query()
    entries: list[CachedEntry] = [
        _entry(value_key="older-exact", timestamp=1.0),
        _entry(
            metrics=(_metric("revenue"), _metric("cost")),
            value_key="project",
            timestamp=5.0,
        ),
        _entry(value_key="newer-exact", timestamp=2.0),
        _entry(
            dimensions=("country", "city"),
            value_key="rollup",
            timestamp=10.0,
        ),
    ]

    ranked: list[tuple[ReuseMode, CachedEntry]] = rank_eligible_entries(query, entries)

    assert [(mode, entry.value_key) for mode, entry in ranked] == [
        (ReuseMode.EXACT, "newer-exact"),
        (ReuseMode.EXACT, "older-exact"),
        (ReuseMode.PROJECT, "project"),
        (ReuseMode.ROLLUP, "rollup"),
    ]


def test_unexpected_lookup_failure_degrades_to_provider() -> None:
    """Shape-incompatible cached entries (e.g. pickles from an older release)
    raise untyped errors; the request must fall through to the provider."""
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.side_effect = AttributeError("stale entry shape")
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.cache_hit is False
    provider.assert_called_once()


def test_unexpected_transform_failure_degrades_to_miss(
    mocker: MockerFixture,
) -> None:
    candidate: MagicMock = MagicMock()
    candidate.result = build_semantic_result()
    candidate.decision = MagicMock()
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.return_value = SemanticCacheLookupResult(
        candidates=(candidate,),
        missing_value_keys=frozenset(),
    )
    mocker.patch(
        "superset.semantic_layers.cache.transform_result",
        side_effect=RuntimeError("unanticipated shape"),
    )
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.cache_hit is False
    provider.assert_called_once()
    repository.store.assert_called_once()


def test_unexpected_prune_failure_does_not_prevent_provider_execution() -> None:
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.return_value = SemanticCacheLookupResult(
        candidates=(),
        missing_value_keys=frozenset({"missing"}),
    )
    repository.prune_missing.side_effect = RuntimeError("prune blew up")
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    provider: MagicMock = MagicMock(return_value=build_semantic_result())

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.cache_hit is False
    provider.assert_called_once()


def test_unexpected_store_failure_still_returns_provider_result() -> None:
    repository: MagicMock = MagicMock(spec=SemanticCacheRepository)
    repository.lookup.return_value = SemanticCacheLookupResult(
        candidates=(),
        missing_value_keys=frozenset(),
    )
    repository.store.side_effect = RuntimeError("value key canonicalization failed")
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(),
        repository,
    )
    expected: SemanticResult = build_semantic_result()
    provider: MagicMock = MagicMock(return_value=expected)

    outcome: SemanticCacheOutcome = service.execute(
        build_view_meta(),
        build_semantic_query(),
        provider,
        capabilities=ContainmentCapabilities(),
    )

    assert outcome.cache_hit is False
    assert outcome.result is expected


def test_initialize_disables_on_value_discarding_backend() -> None:
    """The default ``NullCache`` data cache accepts stores and always misses,
    so containment would pay for coordination without ever serving a hit."""

    class _WrappedBackend:
        cache = NullCache()

    for backend in (NullCache(), _WrappedBackend()):
        state: SemanticCacheState = initialize_semantic_cache(
            parent_enabled=True,
            requested=True,
            backend=cast(SemanticCacheBackend, backend),
            coordination=MagicMock(),
            wait_seconds=1.0,
            lease_seconds=30,
        )

        assert state.effective is False
        assert state.disabled_reason is SemanticCacheDisabledReason.UNSUPPORTED_BACKEND
        assert state.requested is True


def test_initialize_disables_on_replica_read_backend() -> None:
    """Sentinel backends read from replicas; the lease-guarded bucket
    read-modify-write requires read-your-writes, so containment fails closed."""

    class _StubSentinelBackend(RedisSentinelCache):
        def __init__(self) -> None:  # pragma: no cover - trivial stub
            pass

    class _WrappedBackend:
        cache = _StubSentinelBackend()

    for backend in (_StubSentinelBackend(), _WrappedBackend()):
        state: SemanticCacheState = initialize_semantic_cache(
            parent_enabled=True,
            requested=True,
            backend=cast(SemanticCacheBackend, backend),
            coordination=MagicMock(),
            wait_seconds=1.0,
            lease_seconds=30,
        )

        assert state.effective is False
        assert state.disabled_reason is SemanticCacheDisabledReason.UNSUPPORTED_BACKEND
        assert state.requested is True
