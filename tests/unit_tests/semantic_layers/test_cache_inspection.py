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

"""Read-only cache timing never substitutes inspection time for creation."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import Mock, patch

import pytest
from flask import Flask
from flask_caching import Cache
from redis.exceptions import ConnectionError as RedisConnectionError

from superset.semantic_layers.cache_inspection import (
    CacheEntryInfo,
    describe_entry,
    inspect_data_cache,
)
from superset.semantic_layers.metadata import ScopedMetadataStore
from tests.unit_tests.semantic_layers.metadata_store_test import (
    catalog,
    Clock,
    MemoryBackend,
)


def test_catalog_inspection_does_not_fetch_or_renew() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=130, clock=clock
    )
    assert store.inspect_catalog().state == "missing"
    assert backend.entries == {}
    store.read(catalog, deadline=130)
    original: dict[str, tuple[bytes, float | None]] = dict(backend.entries)
    first: CacheEntryInfo = store.inspect_catalog()
    clock.advance(2)
    second: CacheEntryInfo = store.inspect_catalog()
    assert first.state == second.state == "present"
    assert first.created_at == second.created_at
    assert first.source_observed_at == second.source_observed_at
    assert first.remaining_ttl_seconds is not None
    assert second.remaining_ttl_seconds is not None
    assert first.remaining_ttl_seconds - second.remaining_ttl_seconds == 2
    assert first.expiry_kind == "finite"
    assert first.expires_at_is_estimate
    assert backend.entries == original


@pytest.mark.parametrize("ttl,kind", [(-1, "none"), (None, "unknown"), (500, "finite")])
def test_legacy_creation_is_unknown(ttl: int | None, kind: str) -> None:
    info: CacheEntryInfo = describe_entry("query_result", {}, ttl)
    assert info.created_at is None
    assert info.source_observed_at is None
    assert info.expiry_kind == kind
    assert info.inspected_at is not None


def test_existing_result_timestamp_is_reused_with_unknown_backend_expiry(
    app: Flask,
) -> None:
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    cache.set("owned-result", {"dttm": "2026-09-30T12:00:00", "df": "legacy"})
    info: CacheEntryInfo = inspect_data_cache(cache, "owned-result", "query_result")
    assert info.created_at == datetime(2026, 9, 30, 12, tzinfo=timezone.utc)
    assert info.expiry_kind == "unknown"
    assert cache.get("owned-result") == {"dttm": "2026-09-30T12:00:00", "df": "legacy"}


def test_missing_and_bad_timestamps_are_honest() -> None:
    assert describe_entry("catalog", None, -2).state == "missing"
    info: CacheEntryInfo = describe_entry(
        "query_result", {"dttm": "not a timestamp"}, None
    )
    assert info.created_at is None
    assert info.expiry_kind == "unknown"


def test_disabled_and_unreadable_caches_are_distinct(app: Flask) -> None:
    disabled: Cache = Cache(app, config={"CACHE_TYPE": "NullCache"})
    assert inspect_data_cache(disabled, "unused", "query_result").state == "disabled"
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    cache.set("scalar", "legacy")
    assert inspect_data_cache(cache, "scalar", "query_result").state == "unsupported"
    with patch.object(cache, "get", side_effect=RedisConnectionError("private")):
        assert (
            inspect_data_cache(cache, "unused", "query_result").state == "unavailable"
        )


def test_redis_inspection_is_coherent_bounded_and_safe_on_bad_payload(
    app: Flask,
) -> None:
    from superset.coordination.deadline_backend import DeadlineRedisBackend

    cache: Cache = Cache(
        app, config={"CACHE_TYPE": "RedisCache", "CACHE_KEY_PREFIX": "owned:"}
    )
    reader: Mock = Mock(spec=DeadlineRedisBackend)
    reader.get_with_ttl.return_value = (
        cache.cache.serializer.dumps({"dttm": "2026-09-30T10:00:00"}),
        2000,
    )
    assert inspect_data_cache(cache, "entry", "compatibility").state == "unsupported"
    info: CacheEntryInfo = inspect_data_cache(
        cache, "entry", "compatibility", backend=reader
    )
    assert info.created_at == datetime(2026, 9, 30, 10, tzinfo=timezone.utc)
    assert info.remaining_ttl_seconds == 2
    reader.get_with_ttl.assert_called_once_with("owned:entry")
    reader.get_with_ttl.return_value = (b"!not-pickle", 2000)
    assert (
        inspect_data_cache(cache, "entry", "compatibility", backend=reader).state
        == "unsupported"
    )


def test_cache_backend_decode_error_is_unsupported(app: Flask) -> None:
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    with patch.object(cache, "get", side_effect=ValueError("private content")):
        assert (
            inspect_data_cache(cache, "owned-entry", "query_result").state
            == "unsupported"
        )
