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

"""Scoped, fenced publication of provider-owned semantic metadata."""

from __future__ import annotations

import hashlib
import hmac
import math
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Protocol, TYPE_CHECKING
from uuid import uuid4

from flask import current_app
from redis.exceptions import RedisError
from sqlalchemy.orm import Session
from superset_core.semantic_layers.layer import SemanticLayer as SemanticLayerABC
from superset_core.semantic_layers.metadata import (
    CatalogLoader,
    CatalogSnapshot,
    MetadataRefreshError,
    MetadataRefreshResult,
)
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC

from superset import is_feature_enabled
from superset.coordination.base import CoordinationService
from superset.extensions import db
from superset.utils import json

if TYPE_CHECKING:
    from superset.coordination.types import CoordinationBackend
    from superset.semantic_layers.models import SemanticLayer

CATALOG_TTL_SECONDS: int = 300
REFRESH_LEASE_SECONDS: int = 60
FETCH_DEADLINE_SECONDS: int = 30
MAX_CATALOG_BYTES: int = 10 * 1024 * 1024
SNAPSHOT_FORMAT_VERSION: int = 1


class PublicationBackend(Protocol):
    """The existing coordination backend's subset used by catalog publication."""

    def get(self, name: str) -> bytes | None: ...
    def set(self, name: str, value: str, ex: int, nx: bool = False) -> bool | None: ...
    def compare_and_delete(self, name: str, expected: str) -> int: ...
    def compare_and_publish(
        self, lease_key: str, expected: str, snapshot_key: str, value: str, ttl: int
    ) -> bool: ...


def metadata_scope(
    secret: str, namespace: str, connection_uuid: str, configuration: str
) -> str:
    """HMAC trusted deployment/tenant/connection and effective stored configuration."""
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
    """Internal envelope; attempt and content digest never cross the public API."""

    snapshot: CatalogSnapshot
    digest: str
    attempt: str


class ScopedMetadataStore:
    """One shared catalog and lease, never a worker-local fallback cache."""

    def __init__(
        self,
        backend: PublicationBackend,
        scope: str,
        *,
        before_publish: Callable[[], None] | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._backend: PublicationBackend = backend
        self._scope: str = scope
        self._lease_key: str = f"semantic-metadata:{{{scope}}}:lease"
        self._snapshot_key: str = f"semantic-metadata:{{{scope}}}:snapshot"
        self._before_publish: Callable[[], None] | None = before_publish
        self._clock: Callable[[], float] = clock

    def _load(self) -> StoredCatalog | None:
        """Read the authoritative envelope; incompatible records require rebuild."""
        raw: bytes | None = self._backend.get(self._snapshot_key)
        if raw is None:
            return None
        if len(raw) > MAX_CATALOG_BYTES:
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
                for key in ("payload", "revision", "observed_at", "digest", "attempt")
            ):
                return None
            if any(
                not envelope[key]
                for key in ("revision", "observed_at", "digest", "attempt")
            ):
                return None
            payload: str = envelope["payload"]
            json.dumps(json.loads(payload), allow_nan=False)
            if hashlib.sha256(payload.encode()).hexdigest() != envelope["digest"]:
                return None
            snapshot: CatalogSnapshot = CatalogSnapshot(
                payload,
                envelope["revision"],
                f"{self._scope}:{envelope['revision']}",
                envelope["observed_at"],
            )
            return StoredCatalog(snapshot, envelope["digest"], envelope["attempt"])
        except (ValueError, UnicodeError):
            return None

    def read(self, fetch: CatalogLoader) -> CatalogSnapshot:
        """Use a fresh shared observation, or the same fenced acquisition as sync."""
        try:
            current: StoredCatalog | None = self._load()
        except RedisError:
            raise MetadataRefreshError("unavailable") from None
        return current.snapshot if current is not None else self.refresh(fetch).snapshot

    def refresh(self, fetch: CatalogLoader) -> MetadataRefreshResult:
        """Fetch once, revalidate and publish only while this attempt owns its lease."""
        attempt: str = uuid4().hex
        try:
            acquired: bool | None = self._backend.set(
                self._lease_key, attempt, ex=REFRESH_LEASE_SECONDS, nx=True
            )
        except RedisError:
            raise MetadataRefreshError("unavailable") from None
        if not acquired:
            raise MetadataRefreshError("in_progress")
        published: bool = False
        try:
            started: float = self._clock()
            previous: StoredCatalog | None = self._load()
            payload: str = fetch()
            if len(payload.encode()) > MAX_CATALOG_BYTES:
                raise MetadataRefreshError("invalid_payload")
            # Canonicalization covers all provider fields, including relationships,
            # labels and grains. Providers normalize semantically unordered arrays.
            try:
                payload = json.dumps(
                    json.loads(payload),
                    sort_keys=True,
                    separators=(",", ":"),
                    allow_nan=False,
                )
            except (ValueError, TypeError):
                raise MetadataRefreshError("invalid_payload") from None
            digest: str = hashlib.sha256(payload.encode()).hexdigest()
            status: Literal["changed", "unchanged"] = (
                "unchanged"
                if previous is not None and previous.digest == digest
                else "changed"
            )
            revision: str = (
                previous.snapshot.revision
                if previous is not None and status == "unchanged"
                else uuid4().hex
            )
            observed_at: str = datetime.now(timezone.utc).isoformat()
            snapshot: CatalogSnapshot = CatalogSnapshot(
                payload, revision, f"{self._scope}:{revision}", observed_at
            )
            envelope: str = json.dumps(
                {
                    "version": SNAPSHOT_FORMAT_VERSION,
                    "payload": payload,
                    "revision": revision,
                    "observed_at": observed_at,
                    "digest": digest,
                    "attempt": attempt,
                },
                separators=(",", ":"),
            )
            if len(envelope.encode()) > MAX_CATALOG_BYTES:
                raise MetadataRefreshError("invalid_payload")
            if self._before_publish is not None:
                self._before_publish()
            elapsed: float = self._clock() - started
            if elapsed >= FETCH_DEADLINE_SECONDS:
                raise MetadataRefreshError("deadline")
            ttl: int = math.floor(CATALOG_TTL_SECONDS - elapsed)
            snapshot = self._publish(attempt, envelope, ttl, snapshot)
            published = True
            return MetadataRefreshResult(status, snapshot)
        except RedisError:
            raise MetadataRefreshError("unavailable") from None
        finally:
            if not published:
                self._release_failed_attempt(attempt)

    def _release_failed_attempt(self, attempt: str) -> None:
        """Release only our lease, preserving the original failure during outages."""
        try:
            self._backend.compare_and_delete(self._lease_key, attempt)
        except RedisError:
            # A stranded lease expires without masking the original outcome.
            pass

    def _publish(
        self,
        attempt: str,
        envelope: str,
        ttl: int,
        snapshot: CatalogSnapshot,
    ) -> CatalogSnapshot:
        """Confirm atomic publication, reconciling a lost acknowledgement once."""
        try:
            accepted: bool = self._backend.compare_and_publish(
                self._lease_key,
                attempt,
                self._snapshot_key,
                envelope,
                ttl,
            )
        except RedisError:
            try:
                confirmed: StoredCatalog | None = self._load()
            except RedisError:
                confirmed = None
            if confirmed is None or confirmed.attempt != attempt:
                raise MetadataRefreshError("indeterminate") from None
            return confirmed.snapshot
        if not accepted:
            raise MetadataRefreshError("in_progress")
        return snapshot


def metadata_refresh_enabled() -> bool:
    """Require explicit rollout opt-in as well as the semantic-layer flag."""
    return current_app.config.get(
        "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED"
    ) is True and is_feature_enabled("SEMANTIC_LAYERS")


def connection_metadata_scope(layer: SemanticLayer) -> str:
    """Resolve trusted tenant configuration at request time, never from client data."""
    namespace: Any = current_app.config.get("SEMANTIC_LAYER_METADATA_NAMESPACE")
    if callable(namespace):
        namespace = namespace()
    secret: Any = current_app.config.get("SECRET_KEY")
    if isinstance(secret, bytes):
        secret = secret.decode()
    if not isinstance(namespace, str) or not isinstance(secret, str):
        raise MetadataRefreshError("configuration")
    configuration: str = json.dumps(
        {"provider": layer.type, "configuration": json.loads(layer.configuration)},
        sort_keys=True,
    )
    return metadata_scope(secret, namespace, str(layer.uuid), configuration)


def bind_metadata_store(
    layer: SemanticLayer,
    implementation: SemanticLayerABC[Any, SemanticViewABC],
    *,
    before_publish: Callable[[Session], None] | None = None,
) -> None:
    """Bind before discovery; enabled participants cannot fall back to local data."""
    if not metadata_refresh_enabled() or implementation.metadata_refresh is None:
        return
    backend: CoordinationBackend | None = CoordinationService.get_backend()
    if backend is None:
        raise MetadataRefreshError("unavailable")
    scope: str = connection_metadata_scope(layer)

    def revalidate() -> None:
        """Use a separate short read transaction, leaving request state untouched."""
        from superset.semantic_layers.models import SemanticLayer

        if not metadata_refresh_enabled():
            raise MetadataRefreshError("configuration_changed")
        session: Session
        with Session(
            bind=db.session.get_bind(mapper=SemanticLayer), autoflush=False
        ) as session:
            fresh: SemanticLayer | None = session.get(SemanticLayer, layer.uuid)
            if fresh is None or connection_metadata_scope(fresh) != scope:
                raise MetadataRefreshError("configuration_changed")
            if before_publish is not None:
                before_publish(session)

    implementation.metadata_refresh.bind(
        ScopedMetadataStore(backend, scope, before_publish=revalidate)
    )
