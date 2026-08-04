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

"""Storage records for semantic containment caching."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from time import time
from typing import cast, Protocol

from superset_core.semantic_layers.types import SemanticQuery, SemanticResult

from superset.semantic_layers.cache_identity import (
    semantic_dimension_key,
    SemanticCacheIdentityFactory,
    SemanticCacheProviderIdentity,
    SemanticCacheScopeIdentity,
    SemanticDefinitionIdentity,
    SemanticViewIdentity,
)
from superset.semantic_layers.cache_policy import rank_reuse_decisions
from superset.semantic_layers.cache_types import (
    CachedEntry as CachedEntry,
    CachedResultCandidate as CachedResultCandidate,
    ContainmentCapabilities,
    ReuseDecision,
    SemanticCacheLookupResult as SemanticCacheLookupResult,
)

MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET: int = 128


class SemanticCacheRepositoryError(RuntimeError):
    """Base error for expected cache-adapter failures."""


class SemanticCacheLookupError(SemanticCacheRepositoryError):
    """Raised when an expected backend lookup operation fails."""


class SemanticCacheStoreError(SemanticCacheRepositoryError):
    """Raised when an expected backend store operation fails."""


class SemanticCacheBackendError(RuntimeError):
    """Expected operational failure raised by an expiring backend adapter."""


class SemanticCacheCoordinationError(RuntimeError):
    """Expected operational failure raised by a mutation coordinator."""


@dataclass(frozen=True)
class ViewMeta:
    """Identity and expiry inputs for one semantic-view cache bucket."""

    view_identity: SemanticViewIdentity
    definition_identity: SemanticDefinitionIdentity
    provider_identity: SemanticCacheProviderIdentity
    scope_identity: SemanticCacheScopeIdentity
    timeout: int | None


class SemanticCacheBackend(Protocol):
    """Expiring value/descriptor operations required by the repository."""

    def get(self, key: str) -> object | None: ...  # pragma: no cover

    def set(
        self, key: str, value: object, timeout: int | None = None
    ) -> bool: ...  # pragma: no cover

    def delete(self, key: str) -> bool: ...  # pragma: no cover


class SemanticCacheMutationCoordinator(Protocol):
    """Boundary for ownership-safe descriptor mutation."""

    def mutate(
        self, key: str, operation: Callable[[], None]
    ) -> bool: ...  # pragma: no cover


class SemanticCacheRepository:
    """Store expiring results and bounded descriptors behind injected ports."""

    def __init__(
        self,
        backend: SemanticCacheBackend,
        coordinator: SemanticCacheMutationCoordinator,
        *,
        clock: Callable[[], float] = time,
    ) -> None:
        self._backend: SemanticCacheBackend = backend
        self._coordinator: SemanticCacheMutationCoordinator = coordinator
        self._clock: Callable[[], float] = clock

    def _get(
        self,
        key: str,
        error_type: type[SemanticCacheRepositoryError],
    ) -> object | None:
        try:
            return self._backend.get(key)
        except SemanticCacheBackendError as ex:
            raise error_type("Semantic cache backend get failed") from ex

    def _set(
        self,
        key: str,
        value: object,
        timeout: int | None,
        error_type: type[SemanticCacheRepositoryError],
    ) -> None:
        try:
            persisted: bool = self._backend.set(key, value, timeout=timeout)
        except SemanticCacheBackendError as ex:
            raise error_type("Semantic cache backend set failed") from ex
        if not persisted:
            raise error_type("Semantic cache backend rejected set")

    def _mutate(
        self,
        key: str,
        operation: Callable[[], None],
        error_type: type[SemanticCacheRepositoryError],
    ) -> bool:
        try:
            return self._coordinator.mutate(key, operation)
        except SemanticCacheCoordinationError as ex:
            raise error_type("Semantic cache descriptor mutation failed") from ex

    def _delete(
        self,
        key: str,
        error_type: type[SemanticCacheRepositoryError],
    ) -> None:
        try:
            self._backend.delete(key)
        except SemanticCacheBackendError as ex:
            raise error_type("Semantic cache backend delete failed") from ex

    @staticmethod
    def _bucket_key(meta: ViewMeta) -> str:
        return SemanticCacheIdentityFactory.bucket(
            meta.view_identity,
            meta.definition_identity,
            meta.provider_identity,
            meta.scope_identity,
        )

    @staticmethod
    def _entries(value: object | None) -> list[CachedEntry]:
        if not isinstance(value, list) or not all(
            isinstance(entry, CachedEntry) for entry in value
        ):
            return []
        return cast(list[CachedEntry], value)

    def store(
        self,
        meta: ViewMeta,
        query: SemanticQuery,
        result: SemanticResult,
    ) -> bool:
        """Store a TTL-bounded value and register its bounded descriptor."""
        bucket_key: str = self._bucket_key(meta)
        value_key: str = SemanticCacheIdentityFactory.value(bucket_key, query)
        self._set(value_key, result, meta.timeout, SemanticCacheStoreError)
        descriptor: CachedEntry = CachedEntry(
            filters=frozenset(query.filters or set()),
            dimension_keys=frozenset(
                semantic_dimension_key(dimension) for dimension in query.dimensions
            ),
            metric_ids=frozenset(metric.id for metric in query.metrics),
            limit=query.limit,
            offset=query.offset or 0,
            order_key=SemanticCacheIdentityFactory.order(query.order),
            group_limit_key=SemanticCacheIdentityFactory.group_limit(query.group_limit),
            value_key=value_key,
            timestamp=self._clock(),
        )
        descriptor_registered: bool = False

        def register() -> None:
            nonlocal descriptor_registered
            entries: list[CachedEntry] = self._entries(
                self._get(bucket_key, SemanticCacheStoreError)
            )
            retained: list[CachedEntry] = [
                entry for entry in entries if entry.value_key != value_key
            ]
            retained.append(descriptor)
            bounded: list[CachedEntry] = sorted(
                retained,
                key=lambda entry: entry.timestamp,
                reverse=True,
            )[:MAX_SEMANTIC_CACHE_DESCRIPTORS_PER_BUCKET]
            bounded_value_keys: set[str] = {entry.value_key for entry in bounded}
            evicted_value_keys: set[str] = {
                entry.value_key
                for entry in retained
                if entry.value_key not in bounded_value_keys
            }
            self._set(
                bucket_key,
                bounded,
                meta.timeout,
                SemanticCacheStoreError,
            )
            descriptor_registered = True
            for evicted_value_key in evicted_value_keys:
                self._delete(evicted_value_key, SemanticCacheStoreError)

        try:
            return self._mutate(bucket_key, register, SemanticCacheStoreError)
        finally:
            if not descriptor_registered:
                self._delete(value_key, SemanticCacheStoreError)

    def lookup(
        self,
        meta: ViewMeta,
        query: SemanticQuery,
        capabilities: ContainmentCapabilities,
    ) -> SemanticCacheLookupResult:
        """Load ranked values and report missing descriptors without mutation."""
        bucket_key: str = self._bucket_key(meta)
        entries: list[CachedEntry] = self._entries(
            self._get(bucket_key, SemanticCacheLookupError)
        )
        ranked: list[tuple[ReuseDecision, CachedEntry]] = rank_reuse_decisions(
            query, entries, capabilities
        )
        candidates: list[CachedResultCandidate] = []
        missing_value_keys: set[str] = set()
        for decision, entry in ranked:
            value: object | None = self._get(entry.value_key, SemanticCacheLookupError)
            if not isinstance(value, SemanticResult):
                missing_value_keys.add(entry.value_key)
                continue
            candidates.append(CachedResultCandidate(entry, value, decision))
        return SemanticCacheLookupResult(
            candidates=tuple(candidates),
            missing_value_keys=frozenset(missing_value_keys),
        )

    def prune_missing(
        self,
        meta: ViewMeta,
        missing_value_keys: frozenset[str],
    ) -> None:
        """Identity-safely remove descriptors whose values remain absent."""
        if not missing_value_keys:
            return
        bucket_key: str = self._bucket_key(meta)

        def prune() -> None:
            entries: list[CachedEntry] = self._entries(
                self._get(bucket_key, SemanticCacheLookupError)
            )
            retained: list[CachedEntry] = [
                entry
                for entry in entries
                if entry.value_key not in missing_value_keys
                or self._get(entry.value_key, SemanticCacheLookupError) is not None
            ]
            self._set(
                bucket_key,
                retained,
                meta.timeout,
                SemanticCacheLookupError,
            )

        self._mutate(bucket_key, prune, SemanticCacheLookupError)
