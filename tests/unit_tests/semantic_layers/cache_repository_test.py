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
from dataclasses import replace
from unittest.mock import MagicMock

import pytest
from superset_core.semantic_layers.types import (
    AggregationType,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers.cache_policy import ContainmentCapabilities, ReuseMode
from superset.semantic_layers.cache_repository import (
    CachedEntry,
    MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET,
    SemanticCacheBackendError,
    SemanticCacheCoordinationError,
    SemanticCacheLookupResult,
    SemanticCacheRepository,
    SemanticCacheStoreError,
)
from tests.unit_tests.semantic_layers.conftest import (
    build_semantic_query,
    build_semantic_result,
    build_view_meta,
)


def test_descriptor_bound_is_named_and_fixed() -> None:
    assert MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET == 128


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
    result_values: list[SemanticResult] = [
        value for value in backend.values.values() if isinstance(value, SemanticResult)
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
        key
        for key, value in backend.values.items()
        if isinstance(value, SemanticResult)
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
        key
        for key, value in backend.values.items()
        if isinstance(value, SemanticResult)
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
