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
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier, Event, Lock
from unittest.mock import MagicMock

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from superset_core.semantic_layers.types import SemanticQuery

from superset.semantic_layers.cache_coordination import (
    SEMANTIC_CACHE_COORDINATION_FAILURE_METRIC,
    SemanticCacheCoordinationSettings,
    SemanticCacheCoordinator,
)
from superset.semantic_layers.cache_policy import ContainmentCapabilities
from superset.semantic_layers.cache_repository import (
    CachedEntry,
    SemanticCacheCoordinationError,
    SemanticCacheLookupResult,
    SemanticCacheRepository,
)
from tests.unit_tests.semantic_layers.conftest import (
    build_semantic_query,
    build_semantic_result,
    build_view_meta,
)


@pytest.mark.parametrize(
    "wait_seconds,lease_seconds",
    [
        (-1.0, 10),
        (float("inf"), 10),
        (float("nan"), 10),
        (0.0, 0),
        (0.0, -1),
    ],
)
def test_coordination_settings_reject_invalid_values(
    wait_seconds: float,
    lease_seconds: int,
) -> None:
    with pytest.raises(ValueError, match="Coordination"):
        SemanticCacheCoordinationSettings(wait_seconds, lease_seconds)


def test_coordinator_acquires_mutates_and_releases_its_token() -> None:
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = True
    backend.release_owner_token.return_value = True
    operation: MagicMock = MagicMock()
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 10),
        token_factory=lambda: "owner-a",
    )

    assert coordinator.mutate("bucket", operation) is True
    backend.acquire_owner_token.assert_called_once_with(
        "semantic-cache-lock:bucket", "owner-a", 10
    )
    operation.assert_called_once()
    backend.release_owner_token.assert_called_once_with(
        "semantic-cache-lock:bucket", "owner-a"
    )


def test_coordinator_renews_lease_during_long_mutation() -> None:
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = True
    backend.release_owner_token.return_value = True
    renewed: Event = Event()

    def refresh(*_: object) -> bool:
        renewed.set()
        return True

    backend.refresh_owner_token.side_effect = refresh
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 1),
        token_factory=lambda: "owner-a",
    )

    def wait_for_renewal() -> None:
        assert renewed.wait(timeout=1.0)

    assert coordinator.mutate("bucket", wait_for_renewal) is True
    backend.refresh_owner_token.assert_called_with(
        "semantic-cache-lock:bucket",
        "owner-a",
        1,
    )


def test_renewal_backend_error_fails_the_mutation_after_release() -> None:
    # A RedisError during background lease renewal must stop the renewal
    # thread, still release the lease, and surface as the typed coordination
    # failure once the operation completes.
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = True
    backend.release_owner_token.return_value = True
    refresh_attempted: Event = Event()

    def refresh(*_: object) -> bool:
        refresh_attempted.set()
        raise RedisConnectionError("connection dropped mid-lease")

    backend.refresh_owner_token.side_effect = refresh
    metric: MagicMock = MagicMock()
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 1),
        token_factory=lambda: "owner-a",
        failure_metric=metric,
    )

    def wait_for_failed_renewal() -> None:
        assert refresh_attempted.wait(timeout=5.0)

    with pytest.raises(SemanticCacheCoordinationError, match="renewal failed"):
        coordinator.mutate("bucket", wait_for_failed_renewal)
    backend.release_owner_token.assert_called_once_with(
        "semantic-cache-lock:bucket",
        "owner-a",
    )
    metric.assert_called_once_with(SEMANTIC_CACHE_COORDINATION_FAILURE_METRIC)


def test_lost_renewal_ownership_fails_the_mutation_after_release() -> None:
    # refresh_owner_token returning False means another owner holds the lease:
    # the renewal thread must stop and the mutation must fail loudly rather
    # than complete under a lease it no longer holds.
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = True
    backend.release_owner_token.return_value = True
    refresh_attempted: Event = Event()

    def refresh(*_: object) -> bool:
        refresh_attempted.set()
        return False

    backend.refresh_owner_token.side_effect = refresh
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 1),
        token_factory=lambda: "owner-a",
    )

    def wait_for_failed_renewal() -> None:
        assert refresh_attempted.wait(timeout=5.0)

    with pytest.raises(SemanticCacheCoordinationError, match="renewal failed"):
        coordinator.mutate("bucket", wait_for_failed_renewal)
    backend.release_owner_token.assert_called_once_with(
        "semantic-cache-lock:bucket",
        "owner-a",
    )


def test_coordinator_wait_is_bounded_when_lease_is_busy() -> None:
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = False
    times: Iterator[float] = iter([0.0, 0.0, 0.05, 0.1])
    sleeper: MagicMock = MagicMock()
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.1, 10),
        clock=lambda: next(times),
        sleeper=sleeper,
        token_factory=lambda: "owner-a",
    )

    assert coordinator.mutate("bucket", MagicMock()) is False
    assert backend.acquire_owner_token.call_count == 3
    assert sleeper.call_count == 2


def test_busy_wait_spin_is_jittered_within_its_bound() -> None:
    """Waiters released by one lease expiry must not retry in lockstep."""
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = False
    times: Iterator[float] = iter([0.0, 0.0, 0.05, 0.1])
    jitters: Iterator[float] = iter([0.0, 1.0])
    sleeper: MagicMock = MagicMock()
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.1, 10),
        clock=lambda: next(times),
        sleeper=sleeper,
        token_factory=lambda: "owner-a",
        jitter=lambda: next(jitters),
    )

    assert coordinator.mutate("bucket", MagicMock()) is False
    assert [call.args[0] for call in sleeper.call_args_list] == [0.025, 0.05]


def test_busy_lease_timeout_emits_coordination_failure_metric() -> None:
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = False
    metric: MagicMock = MagicMock()
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 10),
        failure_metric=metric,
    )

    assert coordinator.mutate("bucket", MagicMock()) is False
    metric.assert_called_once_with(SEMANTIC_CACHE_COORDINATION_FAILURE_METRIC)


def test_stale_owner_release_is_reported_and_cannot_delete_successor() -> None:
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = True
    backend.release_owner_token.return_value = False
    metric: MagicMock = MagicMock()
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 10),
        token_factory=lambda: "owner-a",
        failure_metric=metric,
    )

    with pytest.raises(SemanticCacheCoordinationError, match="ownership was lost"):
        coordinator.mutate("bucket", MagicMock())

    metric.assert_called_once_with(SEMANTIC_CACHE_COORDINATION_FAILURE_METRIC)


def test_coordination_metric_failure_does_not_replace_typed_failure() -> None:
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = True
    backend.release_owner_token.return_value = False
    metric: MagicMock = MagicMock(side_effect=RuntimeError("metrics unavailable"))
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 10),
        failure_metric=metric,
    )

    with pytest.raises(SemanticCacheCoordinationError, match="ownership was lost"):
        coordinator.mutate("bucket", MagicMock())

    metric.assert_called_once_with(SEMANTIC_CACHE_COORDINATION_FAILURE_METRIC)


@pytest.mark.parametrize(
    "operation,error_match",
    [("acquire", "acquisition"), ("release", "release")],
)
def test_backend_errors_become_typed_coordination_failures(
    operation: str,
    error_match: str,
) -> None:
    backend: MagicMock = MagicMock()
    backend.acquire_owner_token.return_value = True
    backend.release_owner_token.return_value = True
    getattr(backend, f"{operation}_owner_token").side_effect = RedisConnectionError(
        "unavailable"
    )
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        backend,
        SemanticCacheCoordinationSettings(0.0, 10),
    )

    with pytest.raises(SemanticCacheCoordinationError, match=error_match):
        coordinator.mutate("bucket", MagicMock())


class _ThreadOwnerBackend:
    def __init__(self) -> None:
        self.owner: str | None = None
        self.lock: Lock = Lock()
        self.acquisitions: int = 0

    def acquire_owner_token(
        self,
        key: str,
        owner_token: str,
        lease_seconds: int,
    ) -> bool:
        assert key
        assert lease_seconds > 0
        with self.lock:
            if self.owner is not None:
                return False
            self.owner = owner_token
            self.acquisitions += 1
            return True

    def release_owner_token(self, key: str, owner_token: str) -> bool:
        assert key
        with self.lock:
            if self.owner != owner_token:
                return False
            self.owner = None
            return True

    def refresh_owner_token(
        self,
        key: str,
        owner_token: str,
        lease_seconds: int,
    ) -> bool:
        assert key
        assert lease_seconds > 0
        with self.lock:
            return self.owner == owner_token


class _ThreadCache:
    def __init__(self) -> None:
        self.values: dict[str, object] = {}
        self.lock: Lock = Lock()

    def get(self, key: str) -> object | None:
        with self.lock:
            return self.values.get(key)

    def has(self, key: str) -> bool:
        with self.lock:
            return key in self.values

    def set(self, key: str, value: object, timeout: int | None = None) -> bool:
        assert timeout is None or timeout > 0
        with self.lock:
            self.values[key] = value
        return True

    def delete(self, key: str) -> bool:
        with self.lock:
            return self.values.pop(key, None) is not None


def _coordinated_repository() -> tuple[
    SemanticCacheRepository,
    _ThreadCache,
    _ThreadOwnerBackend,
]:
    cache: _ThreadCache = _ThreadCache()
    owner_backend: _ThreadOwnerBackend = _ThreadOwnerBackend()
    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        owner_backend,
        SemanticCacheCoordinationSettings(1.0, 10),
    )
    return SemanticCacheRepository(cache, coordinator), cache, owner_backend


def test_competing_writers_preserve_every_successful_registration() -> None:
    repository: SemanticCacheRepository
    cache: _ThreadCache
    owner_backend: _ThreadOwnerBackend
    repository, cache, owner_backend = _coordinated_repository()

    def store(limit: int) -> bool:
        return repository.store(
            build_view_meta(),
            replace(build_semantic_query(), limit=limit),
            build_semantic_result(),
        )

    with ThreadPoolExecutor(max_workers=8) as executor:
        stored: list[bool] = list(executor.map(store, range(1, 21)))

    descriptors: list[CachedEntry] = next(
        value
        for value in cache.values.values()
        if isinstance(value, list)
        and all(isinstance(entry, CachedEntry) for entry in value)
    )
    assert all(stored)
    assert len(descriptors) == 20
    assert owner_backend.acquisitions == 20

    acquisitions_before_lookup: int = owner_backend.acquisitions
    lookup: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(),
        replace(build_semantic_query(), limit=1),
        capabilities=ContainmentCapabilities(),
    )
    assert lookup.candidates
    assert owner_backend.acquisitions == acquisitions_before_lookup


def test_overlapping_prune_and_store_preserve_fresh_registration() -> None:
    repository: SemanticCacheRepository
    cache: _ThreadCache
    owner_backend: _ThreadOwnerBackend
    repository, cache, owner_backend = _coordinated_repository()
    query: SemanticQuery = build_semantic_query()
    repository.store(build_view_meta(), query, build_semantic_result())
    value_key: str = next(
        key for key, value in cache.values.items() if not isinstance(value, list)
    )
    cache.delete(value_key)
    missing: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    )

    with ThreadPoolExecutor(max_workers=2) as executor:
        prune_future: Future[None] = executor.submit(
            repository.prune_missing,
            build_view_meta(),
            missing.missing_value_keys,
        )
        store_future: Future[bool] = executor.submit(
            repository.store,
            build_view_meta(),
            query,
            build_semantic_result(),
        )
        prune_future.result()
        assert store_future.result() is True

    repeated: SemanticCacheLookupResult = repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    )
    assert repeated.candidates


class _BlindReleaseBackend(_ThreadOwnerBackend):
    def release_owner_token(self, key: str, owner_token: str) -> bool:
        assert key
        assert owner_token
        with self.lock:
            self.owner = None
        return True


def test_stale_release_regression_kills_blind_release_collaborator() -> None:
    backend: _BlindReleaseBackend = _BlindReleaseBackend()
    assert backend.acquire_owner_token("lease", "owner-a", 1)
    backend.owner = None
    assert backend.acquire_owner_token("lease", "owner-b", 1)

    backend.release_owner_token("lease", "owner-a")

    with pytest.raises(AssertionError):
        assert backend.owner == "owner-b"


class _LostUpdateCache(_ThreadCache):
    def __init__(self) -> None:
        super().__init__()
        self.read_barrier: Barrier = Barrier(2)

    def get(self, key: str) -> object | None:
        value: object | None = super().get(key)
        if value is None:
            self.read_barrier.wait(timeout=1)
        return value


class _NoCoordination:
    def mutate(self, key: str, operation: Callable[[], None]) -> bool:
        assert key
        operation()
        return True


def test_competing_writer_regression_kills_lost_update_collaborator() -> None:
    cache: _LostUpdateCache = _LostUpdateCache()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        cache,
        _NoCoordination(),
    )

    def store(limit: int) -> bool:
        return repository.store(
            build_view_meta(),
            replace(build_semantic_query(), limit=limit),
            build_semantic_result(),
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        stored: list[bool] = list(executor.map(store, [1, 2]))

    descriptors: list[CachedEntry] = next(
        value
        for value in cache.values.values()
        if isinstance(value, list)
        and all(isinstance(entry, CachedEntry) for entry in value)
    )
    assert all(stored)
    with pytest.raises(AssertionError):
        assert len(descriptors) == 2
