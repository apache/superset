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
from dataclasses import dataclass, fields
from math import ceil
from time import time
from typing import cast, Protocol

from superset_core.semantic_layers.types import SemanticQuery, SemanticResult

from superset.semantic_layers.cache_identity import (
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

    def has(self, key: str) -> bool: ...  # pragma: no cover

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

    def _has(
        self,
        key: str,
        error_type: type[SemanticCacheRepositoryError],
    ) -> bool:
        try:
            return self._backend.has(key)
        except SemanticCacheBackendError as ex:
            raise error_type("Semantic cache backend has failed") from ex

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
        # A pickled dataclass restores only the attributes it was written
        # with, so an entry from an older shape can pass ``isinstance`` and
        # still lack a field (a class-level default masks that from
        # ``hasattr``, hence the instance-dict check). Key rotation
        # (``IDENTITY_FORMAT_VERSION``) is the primary defence; treating such
        # a bucket as empty is the backstop, so it costs one miss and a
        # re-store rather than a lookup failure on every request until the
        # bucket expires.
        expected: tuple[str, ...] = tuple(field.name for field in fields(CachedEntry))
        if not isinstance(value, list) or not all(
            isinstance(entry, CachedEntry)
            and all(name in vars(entry) for name in expected)
            for entry in value
        ):
            return []
        return cast(list[CachedEntry], value)

    def store(
        self,
        meta: ViewMeta,
        query: SemanticQuery,
        result: SemanticResult,
        *,
        replace: bool = True,
    ) -> bool:
        """Store a TTL-bounded value and register its bounded descriptor.

        With ``replace`` false, a value that another request already stored
        and registered under the same identity is left alone: the identical
        provider result is already discoverable, and skipping saves this
        request the lease wait and the payload write. A herd of identical
        misses then contends for the lease once, not once per request.
        """
        bucket_key: str = self._bucket_key(meta)
        value_key: str = SemanticCacheIdentityFactory.value(bucket_key, query)
        if not replace and self._is_registered(bucket_key, value_key):
            return True
        now: float = self._clock()
        descriptor: CachedEntry = CachedEntry(
            filters=frozenset(query.filters or set()),
            dimensions=frozenset(query.dimensions),
            metrics=frozenset(query.metrics),
            limit=query.limit,
            offset=query.offset or 0,
            order_key=SemanticCacheIdentityFactory.order(query.order),
            group_limit_key=SemanticCacheIdentityFactory.group_limit(query.group_limit),
            value_key=value_key,
            timestamp=now,
            timeout=meta.timeout,
        )

        def register() -> None:
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
                self._bucket_timeout(bounded, meta.timeout, now),
                SemanticCacheStoreError,
            )
            self._set(value_key, result, meta.timeout, SemanticCacheStoreError)
            for evicted_value_key in evicted_value_keys:
                self._delete(evicted_value_key, SemanticCacheStoreError)

        return self._mutate(bucket_key, register, SemanticCacheStoreError)

    def _is_registered(self, bucket_key: str, value_key: str) -> bool:
        entries: list[CachedEntry] = self._entries(
            self._get(bucket_key, SemanticCacheStoreError)
        )
        return any(entry.value_key == value_key for entry in entries) and self._has(
            value_key, SemanticCacheStoreError
        )

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
            break
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
        now: float = self._clock()

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
                self._bucket_timeout(retained, meta.timeout, now),
                SemanticCacheLookupError,
            )

        self._mutate(bucket_key, prune, SemanticCacheLookupError)

    @staticmethod
    def _bucket_timeout(
        entries: list[CachedEntry],
        fallback: int | None,
        now: float,
    ) -> int | None:
        """Expire a bucket no sooner than the longest-lived value it indexes.

        Requests resolve their own cache timeout (custom, chart, then dataset),
        so one view's bucket indexes values stored with different TTLs. Writing
        the bucket with the latest request's timeout would let a short-lived
        store expire the index out from under longer-lived values, orphaning
        them until their own TTL. ``0`` follows the backend's never-expire
        convention and wins outright; ``None`` (backend default) is used only
        when no entry carries an explicit TTL, because its length is unknown
        here.
        """
        timeouts: list[int | None] = [entry.timeout for entry in entries]
        if not timeouts:
            return fallback
        if any(timeout == 0 for timeout in timeouts):
            return 0
        remaining: list[float] = [
            entry.timestamp + entry.timeout - now
            for entry in entries
            if entry.timeout is not None and entry.timeout > 0
        ]
        if not remaining:
            return None
        return max(1, ceil(max(remaining)))
