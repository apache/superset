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

"""Host-only cache timing, without acquisition or payload disclosure."""

from __future__ import annotations

import pickle
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, TypeAlias

from flask_caching import Cache
from flask_caching.backends.nullcache import NullCache
from flask_caching.backends.rediscache import RedisCache
from redis.exceptions import RedisError

from superset.coordination.deadline_backend import DeadlineRedisBackend

CacheKind: TypeAlias = Literal["catalog", "compatibility", "query_result"]
CacheState: TypeAlias = Literal[
    "present", "missing", "disabled", "unsupported", "unavailable"
]
ExpiryKind: TypeAlias = Literal["finite", "none", "unknown"]


@dataclass(frozen=True)
class CacheEntryInfo:
    """Timing of one authorized entry, with no key, token or cached content."""

    kind: CacheKind
    state: CacheState
    inspected_at: datetime
    created_at: datetime | None = None
    source_observed_at: datetime | None = None
    expiry_kind: ExpiryKind = "unknown"
    expires_at: datetime | None = None
    remaining_ttl_seconds: float | None = None
    expires_at_is_estimate: bool = False


def _timestamp(value: object) -> datetime | None:
    """Legacy result dttm is UTC with second precision and no offset suffix."""
    if not isinstance(value, str):
        return None
    try:
        parsed: datetime = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return (
            parsed.replace(tzinfo=timezone.utc)
            if parsed.tzinfo is None
            else parsed.astimezone(timezone.utc)
        )
    except (ValueError, OverflowError):
        return None


def describe_entry(
    kind: CacheKind,
    value: dict[str, Any] | None,
    ttl_ms: int | None,
    *,
    inspected_at: datetime | None = None,
) -> CacheEntryInfo:
    """Describe a coherent entry/TTL observation; missing timestamps stay unknown."""
    inspected: datetime = inspected_at or datetime.now(timezone.utc)
    if value is None or ttl_ms == -2:
        return CacheEntryInfo(kind, "missing", inspected)
    expiry: ExpiryKind = (
        "unknown" if ttl_ms is None else "none" if ttl_ms == -1 else "finite"
    )
    remaining: float | None = (
        ttl_ms / 1000 if ttl_ms is not None and ttl_ms >= 0 else None
    )
    return CacheEntryInfo(
        kind,
        "present",
        inspected,
        created_at=_timestamp(
            value.get("created_at") if kind == "catalog" else value.get("dttm")
        ),
        source_observed_at=_timestamp(
            value.get("observed_at")
            if kind == "catalog"
            else value.get("source_observed_at")
        ),
        expiry_kind=expiry,
        expires_at=inspected + timedelta(seconds=remaining)
        if remaining is not None
        else None,
        remaining_ttl_seconds=remaining,
        expires_at_is_estimate=remaining is not None,
    )


def inspect_data_cache(
    cache: Cache,
    key: str,
    kind: CacheKind,
    *,
    backend: DeadlineRedisBackend | None = None,
) -> CacheEntryInfo:
    """Inspect a server-resolved key after permission and query/RLS resolution."""
    inspected: datetime = datetime.now(timezone.utc)
    if isinstance(cache.cache, NullCache):
        return CacheEntryInfo(kind, "disabled", inspected)
    value: Any
    ttl_ms: int | None = None
    try:
        if isinstance(cache.cache, RedisCache):
            # The caller resolves a bounded reader for the SAME configured cache.
            # No fallback to an unbounded shared client or a different Redis DB.
            if backend is None:
                return CacheEntryInfo(kind, "unsupported", inspected)
            raw: bytes | None
            raw, ttl_ms = backend.get_with_ttl(cache.cache._get_prefix() + key)
            value = cache.cache.serializer.loads(raw) if raw is not None else None
            if raw is not None and value is None:
                return CacheEntryInfo(kind, "unsupported", inspected)
        else:
            value = cache.get(key)
    except RedisError:
        return CacheEntryInfo(kind, "unavailable", inspected)
    except (pickle.UnpicklingError, UnicodeError, TypeError, ValueError, EOFError):
        return CacheEntryInfo(kind, "unsupported", inspected)
    if value is not None and not isinstance(value, dict):
        return CacheEntryInfo(kind, "unsupported", inspected)
    return describe_entry(kind, value, ttl_ms, inspected_at=datetime.now(timezone.utc))
