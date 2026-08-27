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

"""Application-level state for semantic containment caching."""

from __future__ import annotations

import enum
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from flask_caching.backends.nullcache import NullCache
from flask_caching.backends.rediscache import RedisSentinelCache
from superset_core.semantic_layers.types import SemanticQuery, SemanticResult

from superset.semantic_layers.cache_coordination import (
    OwnerTokenCoordinationBackend,
    SemanticCacheCoordinationSettings,
    SemanticCacheCoordinator,
)
from superset.semantic_layers.cache_policy import (
    ContainmentCapabilities,
    eligible_reuse_mode as eligible_reuse_mode,
    rank_eligible_entries as rank_eligible_entries,
)
from superset.semantic_layers.cache_repository import (
    SemanticCacheBackend,
    SemanticCacheBackendError,
    SemanticCacheLookupError,
    SemanticCacheLookupResult,
    SemanticCacheRepository,
    SemanticCacheStoreError,
    ViewMeta,
)
from superset.semantic_layers.cache_transform import (
    SemanticCacheTransformationError,
    transform_result,
)


class SemanticCacheDisabledReason(str, enum.Enum):
    """Stable operational reasons why containment is ineffective."""

    PARENT_FLAG_OFF = "parent_flag_off"
    FLAG_OFF = "flag_off"
    UNSUPPORTED_COORDINATION = "unsupported_coordination"
    INVALID_COORDINATION_CONFIGURATION = "invalid_coordination_configuration"
    UNSUPPORTED_BACKEND = "unsupported_backend"


@dataclass(frozen=True)
class SemanticCacheState:
    """Requested and effective containment state owned by the cache service."""

    requested: bool
    effective: bool
    disabled_reason: SemanticCacheDisabledReason | None

    def __post_init__(self) -> None:
        if self.effective and not self.requested:
            raise ValueError("Effective semantic caching must be requested")
        if self.effective and self.disabled_reason is not None:
            raise ValueError("Effective semantic caching cannot have a disabled reason")
        if not self.effective and self.disabled_reason is None:
            raise ValueError("Ineffective semantic caching requires a disabled reason")

    @classmethod
    def enabled(cls) -> SemanticCacheState:
        """Return the single valid effective state."""
        return cls(requested=True, effective=True, disabled_reason=None)

    @classmethod
    def disabled(
        cls,
        reason: SemanticCacheDisabledReason,
        *,
        requested: bool = False,
    ) -> SemanticCacheState:
        """Return an explicitly ineffective state."""
        return cls(
            requested=requested,
            effective=False,
            disabled_reason=reason,
        )


@dataclass(frozen=True)
class SemanticCacheOutcome:
    """Host-side result plus whether containment supplied it."""

    result: SemanticResult
    cache_hit: bool


class SemanticCacheMetrics(Protocol):
    """Fixed-name metrics used by containment cache operations."""

    def incr(self, key: str) -> None: ...  # pragma: no cover

    def gauge(self, key: str, value: float) -> None: ...  # pragma: no cover


SEMANTIC_CACHE_METRIC_PREFIX: str = "semantic_cache.containment"
logger: logging.Logger = logging.getLogger(__name__)


class SafeSemanticCacheBackend:
    """Translate pluggable cache-client failures into the repository boundary."""

    def __init__(self, backend: SemanticCacheBackend) -> None:
        self._backend: SemanticCacheBackend = backend

    def get(self, key: str) -> object | None:
        try:
            return self._backend.get(key)
        except Exception as ex:  # pylint: disable=broad-exception-caught
            raise SemanticCacheBackendError("Semantic cache get failed") from ex

    def has(self, key: str) -> bool:
        try:
            return bool(self._backend.has(key))
        except Exception as ex:  # pylint: disable=broad-exception-caught
            raise SemanticCacheBackendError("Semantic cache has failed") from ex

    def set(
        self,
        key: str,
        value: object,
        timeout: int | None = None,
    ) -> bool:
        try:
            return self._backend.set(key, value, timeout=timeout)
        except Exception as ex:  # pylint: disable=broad-exception-caught
            raise SemanticCacheBackendError("Semantic cache set failed") from ex

    def delete(self, key: str) -> bool:
        try:
            return self._backend.delete(key)
        except Exception as ex:  # pylint: disable=broad-exception-caught
            raise SemanticCacheBackendError("Semantic cache delete failed") from ex


class SemanticCacheService:
    """Orchestrate optional cache lookup, provider execution, and storage.

    This service is intentionally limited to application flow. Cache identity,
    containment proofs, result transformation, persistence, distributed mutation,
    and Superset host adaptation live in ``cache_identity``, ``cache_policy``,
    ``cache_transform``, ``cache_repository``, ``cache_coordination``, and
    ``cache_host`` respectively. Keeping those decisions behind narrow boundaries
    prevents the orchestration service from becoming a multipurpose cache class.
    """

    def __init__(
        self,
        state: SemanticCacheState,
        repository: SemanticCacheRepository | None = None,
        metrics: SemanticCacheMetrics | None = None,
        *,
        max_value_bytes: int | None = None,
    ) -> None:
        if state.effective and repository is None:
            raise ValueError("Effective semantic caching requires a repository")
        self.state: SemanticCacheState = state
        self._repository: SemanticCacheRepository | None = repository
        self._metrics: SemanticCacheMetrics | None = metrics
        # Results above this many Arrow bytes are served but never stored.
        # The value is pickled inside the lease, where a large payload stalls
        # renewal and can flood the shared data cache; None disables the cap.
        self._max_value_bytes: int | None = max_value_bytes

    def _increment(self, suffix: str) -> None:
        metrics: SemanticCacheMetrics | None = self._metrics
        if metrics is None:
            return
        try:
            metrics.incr(f"{SEMANTIC_CACHE_METRIC_PREFIX}.{suffix}")
        except Exception:  # pylint: disable=broad-exception-caught
            logger.debug("Semantic cache metric emission failed", exc_info=True)

    @classmethod
    def default_ineffective(cls) -> SemanticCacheService:
        """Build the safe process default used before capability initialization."""
        return cls(SemanticCacheState.disabled(SemanticCacheDisabledReason.FLAG_OFF))

    def execute(
        self,
        meta: ViewMeta,
        query: SemanticQuery,
        provider: Callable[[SemanticQuery], SemanticResult],
        *,
        capabilities: ContainmentCapabilities,
        force: bool = False,
    ) -> SemanticCacheOutcome:
        """Serve a proven hit or execute and best-effort store provider output."""
        repository: SemanticCacheRepository | None = self._repository
        if not self.state.effective or repository is None:
            self._increment("bypass")
            return SemanticCacheOutcome(provider(query), cache_hit=False)
        # Every cache stage degrades on ANY exception rather than failing the
        # request: cached material outlives the code that wrote it, so a
        # deploy that reshapes a pickled entry (or any unanticipated backend
        # fault) must cost a miss or a skipped store, never the user's chart.
        if not force:
            served: SemanticCacheOutcome | None
            proceed_to_store: bool
            served, proceed_to_store = self._serve_from_cache(
                repository, meta, query, capabilities
            )
            if served is not None:
                return served
            if not proceed_to_store:
                return SemanticCacheOutcome(provider(query), cache_hit=False)
        else:
            self._increment("bypass")
        result: SemanticResult = provider(query)
        if self._exceeds_size_cap(result):
            self._increment("store_skipped")
            return SemanticCacheOutcome(result, cache_hit=False)
        try:
            # A forced refresh must replace whatever is cached; an ordinary
            # miss may find that a concurrent identical request already stored
            # the same value, in which case the store is redundant.
            repository.store(meta, query, result, replace=force)
        except SemanticCacheStoreError:
            self._increment("store_failure")
        except Exception:  # pylint: disable=broad-exception-caught
            logger.warning("Semantic cache store failed unexpectedly", exc_info=True)
            self._increment("store_failure")
        return SemanticCacheOutcome(result, cache_hit=False)

    def _exceeds_size_cap(self, result: SemanticResult) -> bool:
        if self._max_value_bytes is None or result.results is None:
            return False
        return result.results.nbytes > self._max_value_bytes

    def _serve_from_cache(
        self,
        repository: SemanticCacheRepository,
        meta: ViewMeta,
        query: SemanticQuery,
        capabilities: ContainmentCapabilities,
    ) -> tuple[SemanticCacheOutcome | None, bool]:
        """Attempt a cache read; return (hit outcome or None, store on miss).

        The second element is False when the read phase failed outright — the
        caller should execute the provider without attempting a store, since
        the backend just demonstrated it is unhealthy.
        """
        try:
            lookup_result: SemanticCacheLookupResult = repository.lookup(
                meta, query, capabilities
            )
        except SemanticCacheLookupError:
            self._increment("lookup_failure")
            return None, False
        except Exception:  # pylint: disable=broad-exception-caught
            logger.warning("Semantic cache lookup failed unexpectedly", exc_info=True)
            self._increment("lookup_failure")
            return None, False
        for candidate in lookup_result.candidates:
            try:
                transformed: SemanticResult = transform_result(
                    candidate.result,
                    query,
                    candidate.decision,
                    capabilities,
                )
            except SemanticCacheTransformationError:
                self._increment("transform_failure")
                continue
            except Exception:  # pylint: disable=broad-exception-caught
                logger.warning(
                    "Semantic cache transformation failed unexpectedly",
                    exc_info=True,
                )
                self._increment("transform_failure")
                continue
            self._increment("hit")
            return SemanticCacheOutcome(transformed, cache_hit=True), False
        try:
            repository.prune_missing(
                meta,
                lookup_result.missing_value_keys,
            )
        except SemanticCacheLookupError:
            self._increment("prune_failure")
        except Exception:  # pylint: disable=broad-exception-caught
            logger.warning("Semantic cache pruning failed unexpectedly", exc_info=True)
            self._increment("prune_failure")
        self._increment("miss")
        return None, True

    def execute_provider(
        self,
        query: SemanticQuery,
        provider: Callable[[SemanticQuery], SemanticResult],
    ) -> SemanticCacheOutcome:
        """Execute a provider while recording an intentional cache bypass."""
        self._increment("bypass")
        return SemanticCacheOutcome(provider(query), cache_hit=False)


def _backend_reads_from_replicas(backend: object) -> bool:
    """Detect cache backends whose reads may lag their own writes."""
    inner: object = getattr(backend, "cache", backend)
    return isinstance(backend, RedisSentinelCache) or isinstance(
        inner, RedisSentinelCache
    )


def _backend_discards_values(backend: object) -> bool:
    """Detect cache backends that never retain a stored value."""
    inner: object = getattr(backend, "cache", backend)
    return isinstance(backend, NullCache) or isinstance(inner, NullCache)


def initialize_semantic_cache(
    *,
    parent_enabled: bool,
    requested: bool,
    backend: SemanticCacheBackend,
    coordination: OwnerTokenCoordinationBackend | None,
    wait_seconds: float,
    lease_seconds: int,
    metrics: SemanticCacheMetrics | None = None,
    max_value_bytes: int | None = None,
) -> SemanticCacheState:
    """Replace process cache state from validated startup configuration."""
    global semantic_cache_service

    if not parent_enabled:
        state: SemanticCacheState = SemanticCacheState.disabled(
            SemanticCacheDisabledReason.PARENT_FLAG_OFF,
            requested=requested,
        )
        semantic_cache_service = SemanticCacheService(state, metrics=metrics)
        return state
    if not requested:
        state = SemanticCacheState.disabled(SemanticCacheDisabledReason.FLAG_OFF)
        semantic_cache_service = SemanticCacheService(state, metrics=metrics)
        return state
    if _backend_discards_values(backend):
        # Containment values and descriptors live in the data cache. The
        # default ``NullCache`` accepts every store and answers every lookup
        # with a miss, so the feature would look enabled while paying for
        # coordination on every request and never serving a hit. Fail closed
        # so the operator sees the misconfiguration at startup.
        state = SemanticCacheState.disabled(
            SemanticCacheDisabledReason.UNSUPPORTED_BACKEND,
            requested=True,
        )
        semantic_cache_service = SemanticCacheService(state, metrics=metrics)
        return state
    if _backend_reads_from_replicas(backend):
        # Sentinel-backed caches read through ``slave_for`` replicas while
        # writing to the master, so the lease-guarded read-modify-write on
        # descriptor buckets loses read-your-writes under replication lag:
        # a freshly stored descriptor can be invisible to the next lease
        # holder, which then persists the stale bucket over it. Fail closed
        # until repository reads are routed through the write client.
        state = SemanticCacheState.disabled(
            SemanticCacheDisabledReason.UNSUPPORTED_BACKEND,
            requested=True,
        )
        semantic_cache_service = SemanticCacheService(state, metrics=metrics)
        return state
    if coordination is None:
        state = SemanticCacheState.disabled(
            SemanticCacheDisabledReason.UNSUPPORTED_COORDINATION,
            requested=True,
        )
        semantic_cache_service = SemanticCacheService(state, metrics=metrics)
        return state
    try:
        settings: SemanticCacheCoordinationSettings = SemanticCacheCoordinationSettings(
            wait_seconds, lease_seconds
        )
    except (TypeError, ValueError):
        state = SemanticCacheState.disabled(
            SemanticCacheDisabledReason.INVALID_COORDINATION_CONFIGURATION,
            requested=True,
        )
        semantic_cache_service = SemanticCacheService(state, metrics=metrics)
        return state

    coordinator: SemanticCacheCoordinator = SemanticCacheCoordinator(
        coordination,
        settings,
        failure_metric=(
            (lambda key: metrics.incr(key)) if metrics is not None else None
        ),
    )
    repository: SemanticCacheRepository = SemanticCacheRepository(
        SafeSemanticCacheBackend(backend),
        coordinator,
    )
    state = SemanticCacheState.enabled()
    semantic_cache_service = SemanticCacheService(
        state,
        repository,
        metrics,
        max_value_bytes=max_value_bytes,
    )
    return state


semantic_cache_service: SemanticCacheService = (
    SemanticCacheService.default_ineffective()
)
