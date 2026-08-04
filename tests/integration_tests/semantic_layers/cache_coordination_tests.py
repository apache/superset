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

"""Hermetic Redis coordination tests run by the dedicated integration CI job."""

import os
import pickle  # noqa: S403
from collections.abc import Iterator
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import replace
from time import sleep
from typing import Any, TypeAlias

import pytest
from superset_core.semantic_layers.types import SemanticQuery

from superset.async_events.cache_backend import (
    RedisCacheBackend,
    RedisSentinelCacheBackend,
)
from superset.semantic_layers.cache_coordination import (
    SemanticCacheCoordinationSettings,
    SemanticCacheCoordinator,
)
from superset.semantic_layers.cache_policy import ContainmentCapabilities
from superset.semantic_layers.cache_repository import (
    CachedResultCandidate,
    MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET,
    SemanticCacheLookupResult,
    SemanticCacheRepository,
)
from tests.unit_tests.semantic_layers.conftest import (
    build_semantic_query,
    build_semantic_result,
    build_view_meta,
)

CoordinationBackend: TypeAlias = RedisCacheBackend | RedisSentinelCacheBackend


def _backends() -> list[CoordinationBackend]:
    redis_port: int = int(os.environ.get("SEMANTIC_CACHE_REDIS_PORT", "0"))
    sentinel_port: int = int(os.environ.get("SEMANTIC_CACHE_SENTINEL_PORT", "0"))
    if not redis_port or not sentinel_port:
        pytest.skip("Semantic-cache Redis integration services are not configured")
    return [
        RedisCacheBackend(host="127.0.0.1", port=redis_port),
        RedisSentinelCacheBackend(
            sentinels=[("127.0.0.1", sentinel_port)],
            master="mymaster",
            force_master_ip="127.0.0.1",
        ),
    ]


@pytest.fixture(params=[0, 1], ids=["redis", "sentinel"])
def coordination_backend(
    request: pytest.FixtureRequest,
) -> Iterator[CoordinationBackend]:
    backends: list[CoordinationBackend] = _backends()
    backend: CoordinationBackend = backends[request.param]
    backend._cache.flushdb()
    try:
        yield backend
    finally:
        backend._cache.flushdb()


def test_expired_owner_cannot_release_successor(
    coordination_backend: CoordinationBackend,
) -> None:
    assert coordination_backend.acquire_owner_token("lease", "owner-a", 1)
    sleep(1.1)
    assert coordination_backend.acquire_owner_token("lease", "owner-b", 5)

    assert coordination_backend.release_owner_token("lease", "owner-a") is False
    assert coordination_backend.get("lease") == b"owner-b"
    assert coordination_backend.release_owner_token("lease", "owner-b") is True


class _PickleCache:
    def __init__(self, backend: CoordinationBackend) -> None:
        self._backend: CoordinationBackend = backend

    def get(self, key: str) -> object | None:
        value: bytes | None = self._backend.get(key)
        return pickle.loads(value) if value is not None else None  # noqa: S301

    def set(self, key: str, value: object, timeout: int | None = None) -> bool:
        return bool(self._backend.set(key, pickle.dumps(value), ex=timeout))

    def delete(self, key: str) -> bool:
        return bool(self._backend.delete(key))


def test_concurrent_dashboard_workload_preserves_results_and_bound(
    coordination_backend: CoordinationBackend,
) -> None:
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        coordination_backend,
        SemanticCacheCoordinationSettings(2.0, 10),
    )
    cache: _PickleCache = _PickleCache(coordination_backend)
    repository: SemanticCacheRepository = SemanticCacheRepository(
        cache,
        coordinator,
    )
    queries: list[SemanticQuery] = [
        replace(build_semantic_query(), limit=index) for index in range(1, 25)
    ]

    def execute(query: SemanticQuery) -> bool:
        lookup: SemanticCacheLookupResult = repository.lookup(
            build_view_meta(),
            query,
            ContainmentCapabilities(),
        )
        if lookup.candidates:
            return lookup.candidates[0].result == build_semantic_result()
        return repository.store(
            build_view_meta(),
            query,
            build_semantic_result(),
        )

    with ThreadPoolExecutor(max_workers=8) as executor:
        outcomes: list[bool] = list(executor.map(execute, queries * 2))

    assert all(outcomes)
    missing_keys: list[frozenset[str]] = []
    for query in queries[:4]:
        candidate: CachedResultCandidate = repository.lookup(
            build_view_meta(), query, ContainmentCapabilities()
        ).candidates[0]
        assert cache.delete(candidate.entry.value_key)
        missing_keys.append(
            repository.lookup(
                build_view_meta(), query, ContainmentCapabilities()
            ).missing_value_keys
        )
    with ThreadPoolExecutor(max_workers=8) as executor:
        repairs: list[Future[Any]] = [
            *[
                executor.submit(
                    repository.prune_missing,
                    build_view_meta(),
                    missing,
                )
                for missing in missing_keys
            ],
            *[
                executor.submit(
                    repository.store,
                    build_view_meta(),
                    query,
                    build_semantic_result(),
                )
                for query in queries[:4]
            ],
            *[executor.submit(execute, query) for query in queries[4:]],
        ]
        repair_results: list[object] = [future.result() for future in repairs]

    assert len(repair_results) == 28
    for query in queries:
        assert repository.lookup(
            build_view_meta(), query, ContainmentCapabilities()
        ).candidates
    raw_values: list[Any] = [
        pickle.loads(value)  # noqa: S301
        for key in coordination_backend._cache.scan_iter()
        if (value := coordination_backend._cache.get(key)) is not None
    ]
    descriptor_lists: list[list[object]] = [
        value for value in raw_values if isinstance(value, list)
    ]
    assert descriptor_lists
    assert len(descriptor_lists[0]) <= MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET
