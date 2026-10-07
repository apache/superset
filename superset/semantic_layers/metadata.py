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

"""Scoped publication and invalidation of provider-owned metadata."""

from __future__ import annotations

import hashlib
import hmac
import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import InvalidOperation
from typing import Literal, Protocol, TYPE_CHECKING
from uuid import uuid4

from celery.exceptions import SoftTimeLimitExceeded
from redis.exceptions import RedisError
from superset_core.semantic_layers.metadata import (
    CatalogLoader,
    CatalogSnapshot,
    MetadataRefreshError,
    MetadataRefreshResult,
    remaining_budget,
)

from superset.semantic_layers.cache_inspection import CacheEntryInfo, describe_entry
from superset.utils import json

CATALOG_TTL_SECONDS: int = 300
MAX_SNAPSHOT_TTL_SECONDS: int = 2**31 - 1
REFRESH_LEASE_SECONDS: int = 60
FETCH_DEADLINE_SECONDS: int = 30
MAX_CATALOG_BYTES: int = 10 * 1024 * 1024
SNAPSHOT_FORMAT_VERSION: int = 2
READER_POLL_SECONDS: float = 0.05


if TYPE_CHECKING:

    class PublicationBackend(Protocol):
        """The shared coordinator operations used by semantic metadata."""

        def with_deadline(self, deadline: float) -> PublicationBackend: ...
        def get(self, name: str) -> bytes | None: ...
        def set(
            self,
            name: str,
            value: str,
            ex: int | None = None,
            px: int | None = None,
            nx: bool = False,
            xx: bool = False,
        ) -> bool | None: ...
        def delete(self, *names: str) -> int: ...
        def compare_and_delete(self, name: str, expected: str) -> int: ...
        def compare_and_publish(
            self,
            lease_key: str,
            expected: str,
            snapshot_key: str,
            value: str,
            ttl_ms: int,
            lease_ttl_ms: int,
            snapshot_ttl_ms: int,
        ) -> bool: ...
        def get_with_ttl(self, name: str) -> tuple[bytes | None, int]: ...
        def get_or_create(self, name: str, value: str, ttl: int) -> bytes: ...


def metadata_scope(
    secret: str, namespace: str, connection_uuid: str, configuration: str
) -> str:
    """Derive a private identity from trusted deployment, tenant and connection data."""
    if not secret or not namespace or not connection_uuid:
        raise MetadataRefreshError("configuration")
    try:
        canonical: str = json.dumps(
            [namespace, connection_uuid, json.loads(configuration)],
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
    except (TypeError, ValueError):
        raise MetadataRefreshError("configuration") from None
    return hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


@dataclass(frozen=True)
class StoredCatalog:
    """Internal envelope; publication bookkeeping is never a provider revision."""

    snapshot: CatalogSnapshot
    digest: str = field(repr=False)
    attempt: str = field(repr=False)
    created_at: str


class ScopedMetadataStore:
    """One shared observation with a request-wide budget and no local fallback."""

    def __init__(
        self,
        backend: PublicationBackend,
        scope: str,
        *,
        deadline: float,
        snapshot_ttl_seconds: int = CATALOG_TTL_SECONDS,
        before_publish: Callable[[], None] | None = None,
        clock: Callable[[], float] = time.monotonic,
        wait: Callable[[float], None] = time.sleep,
    ) -> None:
        if not math.isfinite(deadline) or not scope or "{" in scope or "}" in scope:
            raise MetadataRefreshError("configuration")
        if (
            isinstance(snapshot_ttl_seconds, bool)
            or not isinstance(snapshot_ttl_seconds, int)
            or not 1 <= snapshot_ttl_seconds <= MAX_SNAPSHOT_TTL_SECONDS
        ):
            raise MetadataRefreshError("configuration")
        self._snapshot_ttl_seconds: int = snapshot_ttl_seconds
        self._backend: PublicationBackend = backend
        self._scope: str = scope
        self._deadline: float = deadline
        self._lease_key: str = f"semantic-metadata:{{{scope}}}:lease"
        self._snapshot_key: str = f"semantic-metadata:{{{scope}}}:snapshot"
        self._generation_key: str = f"semantic-metadata:{{{scope}}}:compatibility"
        self._before_publish: Callable[[], None] | None = before_publish
        self._clock: Callable[[], float] = clock
        self._wait: Callable[[float], None] = wait
        self._observations: dict[str, str] = {}

    def _remaining(self) -> float:
        return remaining_budget(self._deadline, now=self._clock())

    def _decode(self, raw: bytes | None) -> StoredCatalog | None:
        if raw is None or len(raw) > MAX_CATALOG_BYTES:
            return None
        try:
            envelope: object = json.loads(raw)
            if (
                not isinstance(envelope, dict)
                or envelope.get("version") != SNAPSHOT_FORMAT_VERSION
            ):
                return None
            if any(
                not isinstance(envelope.get(key), str)
                for key in (
                    "payload",
                    "cache_token",
                    "observed_at",
                    "digest",
                    "attempt",
                    "created_at",
                )
            ):
                return None
            if any(
                not envelope[key]
                for key in (
                    "cache_token",
                    "observed_at",
                    "digest",
                    "attempt",
                    "created_at",
                )
            ) or not envelope["cache_token"].startswith(f"{self._scope}:"):
                return None
            payload: str = envelope["payload"]
            json.loads(payload, use_decimal=True)
            if hashlib.sha256(payload.encode()).hexdigest() != envelope["digest"]:
                return None
            return StoredCatalog(
                CatalogSnapshot(
                    payload, envelope["cache_token"], envelope["observed_at"]
                ),
                envelope["digest"],
                envelope["attempt"],
                envelope["created_at"],
            )
        except (ValueError, UnicodeError, RecursionError, InvalidOperation):
            return None

    def _load(self) -> StoredCatalog | None:
        self._remaining()
        stored: StoredCatalog | None = self._decode(
            self._backend.get(self._snapshot_key)
        )
        self._remaining()
        return stored

    def _remember(self, snapshot: CatalogSnapshot) -> CatalogSnapshot:
        self._observations[snapshot.cache_token] = snapshot.observed_at
        return snapshot

    def observed_at(self, token: str) -> str | None:
        """Read the timestamp captured with a provider's token, without backend I/O."""
        return (
            self._observations.get(token)
            if token.startswith(f"{self._scope}:")
            else None
        )

    def peek(self) -> CatalogSnapshot | None:
        """Read the current observation without acquiring, filling or renewing it."""
        try:
            stored: StoredCatalog | None = self._load()
        except RedisError:
            raise MetadataRefreshError("unavailable") from None
        return stored.snapshot if stored is not None else None

    def _for_deadline(self, deadline: float) -> ScopedMetadataStore:
        """Narrow one call without mutating the operation or another call's budget."""
        remaining_budget(deadline, now=self._clock())
        if deadline > self._deadline:
            raise MetadataRefreshError("deadline")
        scoped: ScopedMetadataStore = ScopedMetadataStore(
            self._backend.with_deadline(deadline),
            self._scope,
            deadline=deadline,
            snapshot_ttl_seconds=self._snapshot_ttl_seconds,
            before_publish=self._before_publish,
            clock=self._clock,
            wait=self._wait,
        )
        scoped._observations = self._observations
        return scoped

    def read(self, fetch: CatalogLoader, *, deadline: float) -> CatalogSnapshot:
        """Honor the explicit caller budget, including cache hits and transport."""
        return self._for_deadline(deadline)._read(fetch)

    def refresh(
        self, fetch: CatalogLoader, *, deadline: float
    ) -> MetadataRefreshResult:
        """Publish within the caller budget, which cannot extend the host operation."""
        return self._for_deadline(deadline)._refresh(fetch)

    def _read(self, fetch: CatalogLoader) -> CatalogSnapshot:
        """Wait for an owner or acquire once using the same remaining request budget."""
        try:
            while True:
                current: StoredCatalog | None = self._load()
                if current is not None:
                    return self._remember(current.snapshot)
                attempt: str = uuid4().hex
                lease_ttl_ms: int = max(
                    1, math.ceil(min(REFRESH_LEASE_SECONDS, self._remaining()) * 1000)
                )
                if self._backend.set(
                    self._lease_key,
                    attempt,
                    px=lease_ttl_ms,
                    nx=True,
                ):
                    try:
                        # Another owner may have published between our read and SET NX.
                        current = self._load()
                        if current is not None:
                            return self._remember(current.snapshot)
                        return self._acquire(fetch, attempt, lease_ttl_ms).snapshot
                    finally:
                        self._release(attempt)
                self._wait(min(READER_POLL_SECONDS, self._remaining()))
        except RedisError:
            self._remaining()
            raise MetadataRefreshError("unavailable") from None

    def _refresh(self, fetch: CatalogLoader) -> MetadataRefreshResult:
        """Publish a new observation, or report explicit contention without retry."""
        self._remaining()
        attempt: str = uuid4().hex
        lease_ttl_ms: int = max(
            1, math.ceil(min(REFRESH_LEASE_SECONDS, self._remaining()) * 1000)
        )
        try:
            if not self._backend.set(
                self._lease_key,
                attempt,
                px=lease_ttl_ms,
                nx=True,
            ):
                raise MetadataRefreshError("in_progress")
            try:
                return self._acquire(fetch, attempt, lease_ttl_ms)
            finally:
                self._release(attempt)
        except RedisError:
            self._remaining()
            raise MetadataRefreshError("unavailable") from None

    def _acquire(
        self, fetch: CatalogLoader, attempt: str, lease_ttl_ms: int
    ) -> MetadataRefreshResult:
        started: float = self._clock()
        previous: StoredCatalog | None = self._load()
        self._remaining()
        try:
            payload: str = fetch(self._deadline)
        except (MetadataRefreshError, SoftTimeLimitExceeded):
            raise
        except Exception:  # pylint: disable=broad-except
            # Provider failures cannot transport vendor payloads into host errors.
            raise MetadataRefreshError("upstream") from None
        self._remaining()
        if not isinstance(payload, str):
            raise MetadataRefreshError("invalid_payload")
        try:
            if len(payload.encode()) > MAX_CATALOG_BYTES:
                raise MetadataRefreshError("invalid_payload")
            payload = json.dumps(
                json.loads(payload, use_decimal=True),
                sort_keys=True,
                separators=(",", ":"),
                allow_nan=False,
            )
        except (TypeError, ValueError, UnicodeError, RecursionError, InvalidOperation):
            raise MetadataRefreshError("invalid_payload") from None
        digest: str = hashlib.sha256(payload.encode()).hexdigest()
        status: Literal["changed", "unchanged"] = (
            "unchanged"
            if previous is not None and previous.digest == digest
            else "changed"
        )
        observed_at: str = datetime.now(timezone.utc).isoformat()
        snapshot: CatalogSnapshot = CatalogSnapshot(
            payload, f"{self._scope}:{uuid4().hex}", observed_at
        )
        if self._before_publish is not None:
            self._before_publish()
        self._remaining()
        envelope: str = json.dumps(
            {
                "version": SNAPSHOT_FORMAT_VERSION,
                "payload": payload,
                "cache_token": snapshot.cache_token,
                "observed_at": observed_at,
                "digest": digest,
                "attempt": attempt,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            separators=(",", ":"),
        )
        if len(envelope.encode()) > MAX_CATALOG_BYTES:
            raise MetadataRefreshError("invalid_payload")
        ttl_ms: int = math.floor(
            (self._snapshot_ttl_seconds - (self._clock() - started)) * 1000
        )
        self._remaining()
        if ttl_ms <= 0:
            raise MetadataRefreshError("deadline")
        return MetadataRefreshResult(
            status, self._publish(attempt, envelope, ttl_ms, lease_ttl_ms, snapshot)
        )

    def _publish(
        self,
        attempt: str,
        envelope: str,
        ttl_ms: int,
        lease_ttl_ms: int,
        snapshot: CatalogSnapshot,
    ) -> CatalogSnapshot:
        try:
            accepted: bool = self._backend.compare_and_publish(
                self._lease_key,
                attempt,
                self._snapshot_key,
                envelope,
                ttl_ms,
                lease_ttl_ms,
                self._snapshot_ttl_seconds * 1000,
            )
        except RedisError:
            try:
                confirmed: StoredCatalog | None = self._load()
            except (RedisError, MetadataRefreshError):
                confirmed = None
            if confirmed is None or confirmed.attempt != attempt:
                raise MetadataRefreshError("indeterminate") from None
            return self._remember(confirmed.snapshot)
        if not accepted:
            raise MetadataRefreshError("configuration_changed")
        return self._remember(snapshot)

    def _release(self, attempt: str) -> None:
        # Do not perform cleanup I/O after the request budget is exhausted.
        if self._clock() >= self._deadline:
            return
        try:
            self._backend.compare_and_delete(self._lease_key, attempt)
        except RedisError:
            # A failed cleanup leaves only an expiring lease, preserving the error.
            pass

    def invalidate_catalog(self) -> None:
        """Atomically retire visibility and old writer authority without fetching."""
        self._remaining()
        try:
            self._backend.delete(self._snapshot_key, self._lease_key)
        except RedisError:
            raise MetadataRefreshError("indeterminate") from None

    def inspect_catalog(self) -> CacheEntryInfo:
        """Observe timing without filling an empty catalog or renewing its lifetime."""
        self._remaining()
        try:
            raw: bytes | None
            ttl_ms: int
            raw, ttl_ms = self._backend.get_with_ttl(self._snapshot_key)
        except RedisError:
            return CacheEntryInfo("catalog", "unavailable", datetime.now(timezone.utc))
        stored: StoredCatalog | None = self._decode(raw)
        if raw is not None and stored is None:
            return CacheEntryInfo("catalog", "unsupported", datetime.now(timezone.utc))
        return describe_entry(
            "catalog",
            {
                "created_at": stored.created_at,
                "observed_at": stored.snapshot.observed_at,
            }
            if stored is not None
            else None,
            ttl_ms,
        )

    def compatibility_generation(self) -> str:
        """Capture a non-reusable generation, including after eviction."""
        self._remaining()
        try:
            return self._backend.get_or_create(
                self._generation_key, uuid4().hex, self._snapshot_ttl_seconds
            ).decode()
        except RedisError:
            raise MetadataRefreshError("unavailable") from None

    def peek_compatibility_generation(self) -> str | None:
        """Diagnostics must not initialize a missing generation."""
        self._remaining()
        try:
            raw: bytes | None = self._backend.get(self._generation_key)
            return raw.decode() if raw is not None else None
        except (RedisError, UnicodeError):
            raise MetadataRefreshError("unavailable") from None

    def invalidate_compatibility(self) -> None:
        """Retire compatibility alone; catalog and result identities are unchanged."""
        self._remaining()
        try:
            if not self._backend.set(
                self._generation_key, uuid4().hex, ex=self._snapshot_ttl_seconds
            ):
                raise MetadataRefreshError("unavailable")
        except RedisError:
            raise MetadataRefreshError("indeterminate") from None
