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

from collections.abc import Callable, Iterator
from contextvars import Token
from dataclasses import fields, replace
from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest
from flask_caching.backends.rediscache import RedisCache
from superset_core.semantic_layers.types import (
    AggregationType,
    SemanticQuery,
    SemanticResult,
)

from superset.coordination.cache_backend import RedisCacheBackend
from superset.semantic_layers.cache import SafeSemanticCacheBackend
from superset.semantic_layers.cache_coordination import (
    SemanticCacheCoordinationSettings,
    SemanticCacheCoordinator,
)
from superset.semantic_layers.cache_identity import IDENTITY_FORMAT_VERSION
from superset.semantic_layers.cache_policy import ContainmentCapabilities, ReuseMode
from superset.semantic_layers.cache_repository import (
    CachedEntry,
    MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET,
    semantic_cache_write_fence,
    SemanticCacheBackendError,
    SemanticCacheCoordinationError,
    SemanticCacheLookupResult,
    SemanticCacheRepository,
    SemanticCacheStoreError,
    SemanticCacheWriteFence,
    ViewMeta,
)
from superset.semantic_layers.cache_types import CachedValue
from tests.unit_tests.semantic_layers.conftest import (
    build_semantic_query,
    build_semantic_result,
    build_view_meta,
)


def test_descriptor_bound_is_named_and_fixed() -> None:
    assert MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET == 128


@pytest.mark.parametrize("owns_lease", [True, False])
def test_distinct_redis_clients_use_immediate_nonatomic_recheck(
    owns_lease: bool,
) -> None:
    """Separate-client Lua would check a lease in the wrong Redis database."""
    coordination: RedisCacheBackend = object.__new__(RedisCacheBackend)
    coordination._cache = MagicMock()
    client: MagicMock = MagicMock()
    values: RedisCache = RedisCache(host=client)
    safe: SafeSemanticCacheBackend = SafeSemanticCacheBackend(values)
    check: MagicMock = MagicMock(return_value=owns_lease)
    fence: SemanticCacheWriteFence = SemanticCacheWriteFence(
        "lease", "owner", check, coordination
    )
    repository: SemanticCacheRepository = SemanticCacheRepository(safe, _Coordinator())
    token: Token[SemanticCacheWriteFence | None] = semantic_cache_write_fence.set(fence)
    try:
        if owns_lease:
            repository._set("value", "fresh", 60, SemanticCacheStoreError)
            client.set.assert_called_once()
        else:
            with pytest.raises(
                SemanticCacheCoordinationError, match="ownership was lost"
            ):
                repository._set("value", "stale", 60, SemanticCacheStoreError)
            client.set.assert_not_called()
    finally:
        semantic_cache_write_fence.reset(token)
    check.assert_called_once_with()
    client.eval.assert_not_called()
    coordination._cache.eval.assert_not_called()


class _FencedRedis:
    """Redis command stub with a deterministic takeover before Lua executes."""

    def __init__(self) -> None:
        self.values: dict[str, bytes] = {}
        self.timeouts: dict[str, int | None] = {}
        self.before_set: Callable[[], None] | None = None
        self.rejected: int = 0

    def set(
        self,
        name: str,
        value: bytes | str,
        ex: int | None = None,
        nx: bool = False,
        **_: Any,
    ) -> bool:
        if nx and name in self.values:
            return False
        self.values[name] = value.encode() if isinstance(value, str) else value
        self.timeouts[name] = ex
        return True

    def get(self, key: str) -> bytes | None:
        return self.values.get(key)

    def exists(self, key: str) -> bool:
        return key in self.values

    def delete(self, key: str) -> bool:
        return self.values.pop(key, None) is not None

    def eval(self, script: str, numkeys: int, *args: Any) -> int:
        if numkeys == 2:
            lease, key, owner, value, timeout = args
            if self.before_set is not None:
                callback: Callable[[], None] = self.before_set
                self.before_set = None
                callback()
            if self.get(lease) != owner.encode():
                self.rejected += 1
                return 0
            return int(self.set(key, value, ex=timeout if timeout > 0 else None))
        lease, owner, *rest = args
        if self.get(lease) != owner.encode():
            return 0
        if "'del'" in script:
            return int(self.delete(lease))
        self.timeouts[lease] = rest[0]
        return 1


@pytest.mark.parametrize("takeover_at", ["descriptor", "value"])
def test_same_client_fence_rejects_paused_writer(takeover_at: str) -> None:
    """Fresh payload, descriptor and TTL survive an old writer resuming at SET."""
    client: _FencedRedis = _FencedRedis()
    coordination: RedisCacheBackend = object.__new__(RedisCacheBackend)
    coordination._cache = client
    values: RedisCache = RedisCache(host=client, key_prefix="data:")
    safe: SafeSemanticCacheBackend = SafeSemanticCacheBackend(values)
    tokens: Iterator[str] = iter(["stale", "fresh"])
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        coordination,
        SemanticCacheCoordinationSettings(0, 10),
        token_factory=lambda: next(tokens),
    )
    repository: SemanticCacheRepository = SemanticCacheRepository(safe, coordinator)
    meta: ViewMeta = build_view_meta()
    fresh_meta: ViewMeta = replace(meta, timeout=120)
    query: SemanticQuery = build_semantic_query()
    stale_result: SemanticResult = build_semantic_result()
    fresh_result: SemanticResult = replace(stale_result, requests=["fresh"])

    def replace_owner() -> None:
        lease_key: str = next(
            key for key in client.values if key.startswith("semantic-cache-lock:")
        )
        client.delete(lease_key)  # Expiration while the old writer was paused.
        assert repository.store(fresh_meta, query, fresh_result)

    def pause_at_value() -> None:
        client.before_set = replace_owner

    client.before_set = replace_owner if takeover_at == "descriptor" else pause_at_value
    with pytest.raises(SemanticCacheStoreError):
        repository.store(meta, query, stale_result)
    assert client.rejected == 1
    lookup: SemanticCacheLookupResult = repository.lookup(
        fresh_meta,
        query,
        ContainmentCapabilities(),
    )
    assert lookup.candidates[0].result.requests == ["fresh"]
    descriptor: CachedEntry = lookup.candidates[0].entry
    assert descriptor.timeout == 120
    assert client.timeouts[f"data:{descriptor.value_key}"] == 120
    assert client.timeouts[f"data:{repository._bucket_key(meta)}"] == 120


def test_foundational_builders_produce_compatible_values() -> None:
    assert build_semantic_query().metrics[0].id == "revenue"
    assert build_semantic_result().results.num_rows == 1
    assert build_view_meta().view_identity.value == "fixture-view"


class _Backend:
    def __init__(self, *, set_succeeds: bool = True) -> None:
        self.values: dict[str, object] = {}
        self.timeouts: dict[str, int | None] = {}
        self.set_succeeds: bool = set_succeeds

    def get(self, key: str) -> object | None:
        return self.values.get(key)

    def has(self, key: str) -> bool:
        return key in self.values

    def set(self, key: str, value: object, timeout: int | None = None) -> bool:
        if not self.set_succeeds:
            return False
        self.values[key] = value
        self.timeouts[key] = timeout
        return True

    def delete(self, key: str) -> bool:
        return self.values.pop(key, None) is not None


class _Coordinator:
    def __init__(self, *, succeeds: bool = True) -> None:
        self.succeeds: bool = succeeds
        self.keys: list[str] = []

    def mutate(self, key: str, operation: Callable[[], None]) -> bool:
        self.keys.append(key)
        if not self.succeeds:
            return False
        operation()
        return True


def test_store_and_lookup_share_expiry_and_return_ranked_result() -> None:
    backend: _Backend = _Backend()
    coordinator: _Coordinator = _Coordinator()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        coordinator,
        clock=lambda: 10.0,
    )
    query: SemanticQuery = build_semantic_query()
    result: SemanticResult = build_semantic_result()

    assert repository.store(build_view_meta(), query, result) is True
    lookup_result: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(),
        query,
        ContainmentCapabilities(),
    )

    assert len(lookup_result.candidates) == 1
    assert lookup_result.candidates[0].decision.mode is ReuseMode.EXACT
    assert lookup_result.candidates[0].result == result
    assert set(backend.timeouts.values()) == {300}
    assert len(coordinator.keys) == 1


def test_lookup_rejects_same_metric_id_with_different_semantics() -> None:
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
    )
    sum_query: SemanticQuery = replace(
        build_semantic_query(),
        metrics=[
            replace(
                build_semantic_query().metrics[0],
                aggregation=AggregationType.SUM,
                definition="SUM(revenue)",
            )
        ],
    )
    avg_query: SemanticQuery = replace(
        sum_query,
        metrics=[
            replace(
                sum_query.metrics[0],
                aggregation=AggregationType.AVG,
                definition="AVG(revenue)",
            )
        ],
    )
    repository.store(build_view_meta(), avg_query, build_semantic_result())

    lookup_result: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(),
        sum_query,
        ContainmentCapabilities(),
    )

    assert not lookup_result.candidates


def test_coordination_failure_raises_typed_store_error() -> None:
    coordinator: MagicMock = MagicMock()
    coordinator.mutate.side_effect = SemanticCacheCoordinationError("unavailable")
    repository: SemanticCacheRepository = SemanticCacheRepository(
        _Backend(),
        coordinator,
    )

    with pytest.raises(SemanticCacheStoreError, match="mutation failed"):
        repository.store(
            build_view_meta(),
            build_semantic_query(),
            build_semantic_result(),
        )


def test_store_replaces_same_value_identity_without_duplicate_descriptor() -> None:
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: 10.0,
    )
    query: SemanticQuery = build_semantic_query()

    repository.store(build_view_meta(), query, build_semantic_result())
    repository.store(build_view_meta(), query, build_semantic_result())

    descriptor_lists: list[list[CachedEntry]] = [
        value
        for value in backend.values.values()
        if isinstance(value, list)
        and all(isinstance(entry, CachedEntry) for entry in value)
    ]
    assert len(descriptor_lists) == 1
    assert len(descriptor_lists[0]) == 1


def test_store_retains_only_newest_bounded_descriptors() -> None:
    backend: _Backend = _Backend()
    ticks: Iterator[float] = iter(
        float(index) for index in range(MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET + 1)
    )
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: next(ticks),
    )
    query: SemanticQuery = build_semantic_query()

    for limit in range(MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET + 1):
        repository.store(
            build_view_meta(),
            replace(query, limit=limit),
            build_semantic_result(),
        )

    descriptor_list: list[CachedEntry] = next(
        value
        for value in backend.values.values()
        if isinstance(value, list)
        and all(isinstance(entry, CachedEntry) for entry in value)
    )
    assert len(descriptor_list) == MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET
    assert min(entry.timestamp for entry in descriptor_list) == 1.0
    result_values: list[CachedValue] = [
        value for value in backend.values.values() if isinstance(value, CachedValue)
    ]
    assert len(result_values) == MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET


def test_store_surfaces_backend_delete_failure_as_store_error() -> None:
    # Eviction of a bounded-out descriptor deletes its value key; a backend
    # failure there must surface as the store's typed error, not leak the
    # backend exception class to callers.
    class _DeleteFailingBackend(_Backend):
        def delete(self, key: str) -> bool:
            raise SemanticCacheBackendError("backend down")

    backend: _Backend = _DeleteFailingBackend()
    ticks: Iterator[float] = iter(
        float(index) for index in range(MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET + 1)
    )
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: next(ticks),
    )
    query: SemanticQuery = build_semantic_query()

    for limit in range(MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET):
        repository.store(
            build_view_meta(),
            replace(query, limit=limit),
            build_semantic_result(),
        )

    with pytest.raises(SemanticCacheStoreError) as excinfo:
        repository.store(
            build_view_meta(),
            replace(query, limit=MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET),
            build_semantic_result(),
        )
    assert isinstance(excinfo.value.__cause__, SemanticCacheBackendError)


def test_failed_coordination_removes_undiscoverable_value() -> None:
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(succeeds=False),
    )
    query: SemanticQuery = build_semantic_query()

    assert repository.store(build_view_meta(), query, build_semantic_result()) is False
    assert not backend.values
    assert not repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    ).candidates


def test_store_does_not_touch_deterministic_value_when_lease_is_unavailable() -> None:
    backend: _Backend = _Backend()
    query: SemanticQuery = build_semantic_query()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
    )
    repository.store(build_view_meta(), query, build_semantic_result())
    original_values: dict[str, object] = dict(backend.values)
    losing_repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(succeeds=False),
    )

    assert (
        losing_repository.store(
            build_view_meta(),
            query,
            build_semantic_result(),
        )
        is False
    )
    assert backend.values == original_values


def test_backend_false_write_is_a_typed_store_failure() -> None:
    repository: SemanticCacheRepository = SemanticCacheRepository(
        _Backend(set_succeeds=False),
        _Coordinator(),
    )

    with pytest.raises(SemanticCacheStoreError, match="rejected set"):
        repository.store(
            build_view_meta(),
            build_semantic_query(),
            build_semantic_result(),
        )


def test_lookup_skips_missing_value_and_prunes_its_exact_descriptor() -> None:
    backend: _Backend = _Backend()
    coordinator: _Coordinator = _Coordinator()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        coordinator,
    )
    query: SemanticQuery = build_semantic_query()
    repository.store(build_view_meta(), query, build_semantic_result())
    value_key: str = next(
        key for key, value in backend.values.items() if isinstance(value, CachedValue)
    )
    backend.delete(value_key)
    coordinator.keys.clear()

    lookup_result: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    )
    assert not lookup_result.candidates
    assert lookup_result.missing_value_keys == frozenset({value_key})
    assert not coordinator.keys
    repository.prune_missing(build_view_meta(), lookup_result.missing_value_keys)
    assert len(coordinator.keys) == 1
    assert all(
        not isinstance(value, list) or value == [] for value in backend.values.values()
    )


def test_prune_rechecks_same_key_value_registered_after_lookup() -> None:
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
    )
    query: SemanticQuery = build_semantic_query()
    repository.store(build_view_meta(), query, build_semantic_result())
    value_key: str = next(
        key for key, value in backend.values.items() if isinstance(value, CachedValue)
    )
    backend.delete(value_key)
    lookup_result: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    )

    repository.store(build_view_meta(), query, build_semantic_result())
    repository.prune_missing(build_view_meta(), lookup_result.missing_value_keys)
    repeated: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    )

    assert repeated.candidates


def _bucket_timeout(backend: _Backend) -> int | None:
    bucket_key: str = next(
        key for key, value in backend.values.items() if isinstance(value, list)
    )
    return backend.timeouts[bucket_key]


def test_bucket_outlives_longest_lived_value_across_request_timeouts() -> None:
    """Charts on one view resolve different timeouts; a short-lived store must
    not expire the bucket while a longer-lived value it indexes is still
    valid, or that value is orphaned until its own TTL."""
    backend: _Backend = _Backend()
    clock: list[float] = [10.0]
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: clock[0],
    )
    query: SemanticQuery = build_semantic_query()

    repository.store(
        replace(build_view_meta(), timeout=3600),
        replace(query, limit=1),
        build_semantic_result(),
    )
    clock[0] = 20.0
    repository.store(
        replace(build_view_meta(), timeout=60),
        replace(query, limit=2),
        build_semantic_result(),
    )
    # 3590 s left on the first value, so the bucket keeps it discoverable.
    assert _bucket_timeout(backend) == 3590

    clock[0] = 4000.0
    repository.store(
        replace(build_view_meta(), timeout=60),
        replace(query, limit=3),
        build_semantic_result(),
    )
    # The first value has expired: only live values bound the bucket.
    assert _bucket_timeout(backend) == 60


@pytest.mark.parametrize(
    ("timeouts", "expected"),
    [
        ((None, None), 0),
        ((None, 300), 0),
        ((300, None), 0),
        ((300, 0), 0),
    ],
)
def test_bucket_timeout_follows_backend_conventions(
    timeouts: tuple[int | None, ...],
    expected: int | None,
) -> None:
    """Unknown default TTLs cannot be shortened by an explicit bucket TTL."""
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: 10.0,
    )
    query: SemanticQuery = build_semantic_query()

    for limit, timeout in enumerate(timeouts):
        repository.store(
            replace(build_view_meta(), timeout=timeout),
            replace(query, limit=limit),
            build_semantic_result(),
        )

    assert _bucket_timeout(backend) == expected


def test_prune_keeps_bucket_alive_for_surviving_values() -> None:
    backend: _Backend = _Backend()
    clock: list[float] = [10.0]
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: clock[0],
    )
    query: SemanticQuery = build_semantic_query()
    repository.store(
        replace(build_view_meta(), timeout=3600),
        replace(query, limit=1),
        build_semantic_result(),
    )
    repository.store(
        replace(build_view_meta(), timeout=60),
        replace(query, limit=2),
        build_semantic_result(),
    )
    descriptors: list[CachedEntry] = next(
        value for value in backend.values.values() if isinstance(value, list)
    )
    short_lived: CachedEntry = next(
        entry for entry in descriptors if entry.timeout == 60
    )
    backend.values.pop(short_lived.value_key)

    clock[0] = 100.0
    repository.prune_missing(
        replace(build_view_meta(), timeout=60),
        frozenset({short_lived.value_key}),
    )

    assert _bucket_timeout(backend) == 3510


def test_store_skips_identical_value_another_request_already_registered() -> None:
    """A herd of identical misses should contend for the lease once: once the
    value is registered, later non-forced stores are redundant."""
    backend: _Backend = _Backend()
    coordinator: _Coordinator = _Coordinator()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        coordinator,
        clock=lambda: 10.0,
    )
    query: SemanticQuery = build_semantic_query()
    first: SemanticResult = build_semantic_result()

    assert repository.store(build_view_meta(), query, first) is True
    assert repository.store(build_view_meta(), query, first, replace=False) is True
    assert len(coordinator.keys) == 1

    # A forced refresh must still replace the value.
    assert repository.store(build_view_meta(), query, first, replace=True) is True
    assert len(coordinator.keys) == 2


def test_store_does_not_skip_when_descriptor_was_evicted() -> None:
    """A surviving value whose descriptor is gone is undiscoverable, so the
    store must register it again rather than trust the value's presence."""
    backend: _Backend = _Backend()
    coordinator: _Coordinator = _Coordinator()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        coordinator,
        clock=lambda: 10.0,
    )
    query: SemanticQuery = build_semantic_query()
    repository.store(build_view_meta(), query, build_semantic_result())
    bucket_key: str = next(
        key for key, value in backend.values.items() if isinstance(value, list)
    )
    backend.values[bucket_key] = []

    assert (
        repository.store(
            build_view_meta(), query, build_semantic_result(), replace=False
        )
        is True
    )
    assert len(coordinator.keys) == 2
    assert len(cast(list[CachedEntry], backend.values[bucket_key])) == 1


def test_entries_from_an_older_pickled_shape_are_treated_as_empty() -> None:
    """A pickled dataclass restores only the attributes it was written with.
    Key rotation keeps such buckets out of reach; if one is reached anyway
    it must cost a miss, not a lookup failure until it expires."""
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: 10.0,
    )
    query: SemanticQuery = build_semantic_query()
    repository.store(build_view_meta(), query, build_semantic_result())
    bucket_key: str = next(
        key for key, value in backend.values.items() if isinstance(value, list)
    )
    stale: CachedEntry = cast(list[CachedEntry], backend.values[bucket_key])[0]
    del stale.__dict__["timeout"]

    lookup_result: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(),
        query,
        ContainmentCapabilities(),
    )

    assert lookup_result.candidates == ()
    assert lookup_result.missing_value_keys == frozenset()


def test_cached_entry_shape_is_pinned_to_the_identity_version() -> None:
    """``CachedEntry`` is pickled into the shared data cache and outlives the
    code that wrote it. Changing its fields without rotating every key would
    hand the new code buckets it cannot read. If this test fails because the
    shape changed, bump ``IDENTITY_FORMAT_VERSION`` and update both values."""
    assert tuple(field.name for field in fields(CachedEntry)) == (
        "filters",
        "dimensions",
        "metrics",
        "limit",
        "offset",
        "order_key",
        "group_limit_key",
        "value_key",
        "timestamp",
        "timeout",
        "write_nonce",
    )
    assert IDENTITY_FORMAT_VERSION == "v4"


def test_store_surfaces_existence_check_failure_as_store_error() -> None:
    """The redundant-store check is an expected backend operation like any
    other: its failure is a typed store error, not a request failure."""

    class _FailingHasBackend(_Backend):
        def has(self, key: str) -> bool:
            raise SemanticCacheBackendError("has unavailable")

    backend: _FailingHasBackend = _FailingHasBackend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        _Coordinator(),
        clock=lambda: 10.0,
    )
    query: SemanticQuery = build_semantic_query()
    repository.store(build_view_meta(), query, build_semantic_result())

    with pytest.raises(SemanticCacheStoreError, match="has failed"):
        repository.store(
            build_view_meta(), query, build_semantic_result(), replace=False
        )


def test_lookup_bounds_value_age_by_the_requesting_timeout() -> None:
    """Requests resolve their own timeout: a value stored by a 3600 s chart
    must not answer a 60 s chart on the same view once it is older than 60 s,
    and the 60 s chart's own store must not be skipped as already registered."""
    backend: _Backend = _Backend()
    coordinator: _Coordinator = _Coordinator()
    clock: list[float] = [0.0]
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        coordinator,
        clock=lambda: clock[0],
    )
    query: SemanticQuery = build_semantic_query()
    long_lived: ViewMeta = replace(build_view_meta(), timeout=3600)
    short_lived: ViewMeta = replace(build_view_meta(), timeout=60)
    repository.store(long_lived, query, build_semantic_result())

    clock[0] = 30.0
    assert (
        len(repository.lookup(short_lived, query, ContainmentCapabilities()).candidates)
        == 1
    )

    clock[0] = 1800.0
    stale: SemanticCacheLookupResult = repository.lookup(
        short_lived, query, ContainmentCapabilities()
    )
    assert stale.candidates == ()
    # Not a missing value: it is still valid for the long-lived chart.
    assert stale.missing_value_keys == frozenset()
    assert (
        len(repository.lookup(long_lived, query, ContainmentCapabilities()).candidates)
        == 1
    )
    unbounded: ViewMeta = replace(build_view_meta(), timeout=None)
    assert (
        len(repository.lookup(unbounded, query, ContainmentCapabilities()).candidates)
        == 1
    )

    assert repository.store(short_lived, query, build_semantic_result(), replace=False)
    assert len(coordinator.keys) == 2


def test_store_dedupe_requires_the_registered_ttl_to_cover_this_request() -> None:
    """A 60 s chart storing first must not pin a 3600 s chart to its entry."""
    backend: _Backend = _Backend()
    coordinator: _Coordinator = _Coordinator()
    clock: list[float] = [0.0]
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend,
        coordinator,
        clock=lambda: clock[0],
    )
    query: SemanticQuery = build_semantic_query()
    short_lived: ViewMeta = replace(build_view_meta(), timeout=60)
    long_lived: ViewMeta = replace(build_view_meta(), timeout=3600)
    repository.store(short_lived, query, build_semantic_result())

    clock[0] = 30.0
    assert repository.store(long_lived, query, build_semantic_result(), replace=False)
    assert len(coordinator.keys) == 2
    # Re-registered with the longer TTL: now the 3600 s chart is covered.
    assert repository.store(long_lived, query, build_semantic_result(), replace=False)
    assert len(coordinator.keys) == 2

    never_expiring: ViewMeta = replace(build_view_meta(), timeout=0)
    repository.store(never_expiring, replace(query, limit=7), build_semantic_result())
    assert repository.store(
        long_lived, replace(query, limit=7), build_semantic_result(), replace=False
    )
    assert len(coordinator.keys) == 3


@pytest.mark.parametrize("contained", [False, True])
def test_split_store_stale_overwrite_is_a_miss_and_pruned(contained: bool) -> None:
    """A pause after the lease check cannot turn an old payload into a hit."""
    leases: _FencedRedis = _FencedRedis()
    coordination: RedisCacheBackend = object.__new__(RedisCacheBackend)
    coordination._cache = leases
    owners: Iterator[str] = iter(["old", "new", "prune"])
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        coordination,
        SemanticCacheCoordinationSettings(0, 10),
        token_factory=lambda: next(owners),
    )

    class PausingBackend(_Backend):
        before_value_set: Callable[[], None] | None = None

        def set(self, key: str, value: object, timeout: int | None = None) -> bool:
            if key.startswith("semantic-cache:value:") and self.before_value_set:
                callback: Callable[[], None] = self.before_value_set
                self.before_value_set = None
                callback()
            return super().set(key, value, timeout)

    backend: PausingBackend = PausingBackend()
    repository: SemanticCacheRepository = SemanticCacheRepository(backend, coordinator)
    meta: ViewMeta = build_view_meta()
    query: SemanticQuery = build_semantic_query()
    requested: SemanticQuery = replace(query, limit=1) if contained else query
    fresh: SemanticResult = replace(build_semantic_result(), requests=["fresh"])

    def takeover() -> None:
        lease_key: str = next(iter(leases.values))
        leases.delete(lease_key)  # Whole-process stall lets A's lease expire.
        assert repository.store(meta, query, fresh)
        assert repository.lookup(meta, requested, ContainmentCapabilities()).candidates

    backend.before_value_set = takeover
    with pytest.raises(SemanticCacheStoreError):  # Old owner cannot release B's lease.
        repository.store(meta, query, build_semantic_result())
    lookup: SemanticCacheLookupResult = repository.lookup(
        meta, requested, ContainmentCapabilities()
    )
    assert lookup.candidates == ()
    assert len(lookup.missing_value_keys) == 1
    repository.prune_missing(meta, lookup.missing_value_keys)
    assert backend.values[repository._bucket_key(meta)] == []
    assert all(key in backend.values for key in lookup.missing_value_keys)


@pytest.mark.parametrize(
    "damage", ["bare", "mismatch", "missing_nonce", "empty_descriptor", "bad_result"]
)
def test_fence_rejects_invalid_pairs_and_store_repairs(damage: str) -> None:
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend, _Coordinator()
    )
    meta: ViewMeta = build_view_meta()
    query: SemanticQuery = build_semantic_query()
    repository.store(meta, query, build_semantic_result())
    bucket: str = repository._bucket_key(meta)
    entry: CachedEntry = cast(list[CachedEntry], backend.values[bucket])[0]
    value: CachedValue = cast(CachedValue, backend.values[entry.value_key])
    if damage == "bare":
        backend.values[entry.value_key] = value.result
    elif damage == "mismatch":
        backend.values[entry.value_key] = replace(value, write_nonce="other")
    elif damage == "missing_nonce":
        del value.__dict__["write_nonce"]
    elif damage == "empty_descriptor":
        backend.values[bucket] = [replace(entry, write_nonce="")]
    else:
        value.__dict__["result"] = None
    lookup: SemanticCacheLookupResult = repository.lookup(
        meta, query, ContainmentCapabilities()
    )
    assert lookup.candidates == ()
    assert lookup.fence_rejections == 1
    assert lookup.missing_value_keys == frozenset({entry.value_key})
    assert repository.store(meta, query, build_semantic_result(), replace=False)
    repaired: CachedEntry = cast(list[CachedEntry], backend.values[bucket])[0]
    assert repaired.write_nonce != entry.write_nonce
    repository.prune_missing(meta, lookup.missing_value_keys)
    assert repository.lookup(meta, query, ContainmentCapabilities()).candidates


def test_legacy_identity_namespace_cannot_supply_a_hit() -> None:
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend, _Coordinator()
    )
    meta: ViewMeta = build_view_meta()
    query: SemanticQuery = build_semantic_query()
    with patch("superset.semantic_layers.cache_identity.IDENTITY_FORMAT_VERSION", "v3"):
        repository.store(meta, query, build_semantic_result())
    assert repository.lookup(meta, query, ContainmentCapabilities()).candidates == ()
