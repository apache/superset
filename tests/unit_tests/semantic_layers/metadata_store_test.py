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

"""Scoped catalog publication rules independent of Flask and real time."""

from __future__ import annotations

from unittest.mock import Mock

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from superset_core.semantic_layers.metadata import (
    CatalogSnapshot,
    MetadataRefreshError,
    MetadataRefreshResult,
)

from superset.semantic_layers.metadata import metadata_scope, ScopedMetadataStore


class MemoryBackend:
    """Controllable primitive stub; real atomicity is tested against Redis."""

    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    def get(self, key: str) -> bytes | None:
        value: str | None = self.values.get(key)
        return value.encode() if value is not None else None

    def set(self, key: str, value: str, ex: int, nx: bool = False) -> bool:
        if nx and key in self.values:
            return False
        self.values[key] = value
        self.ttls[key] = ex
        return True

    def compare_and_delete(self, key: str, expected: str) -> int:
        if self.values.get(key) != expected:
            return 0
        del self.values[key]
        return 1

    def compare_and_publish(
        self, key: str, expected: str, target: str, value: str, ttl: int
    ) -> bool:
        if self.values.get(key) != expected:
            return False
        self.set(target, value, ttl)
        self.compare_and_delete(key, expected)
        return True


def test_manual_refresh_bypasses_hit_and_unchanged_retains_revision() -> None:
    backend: MemoryBackend = MemoryBackend()
    clock: Mock = Mock(return_value=0.0)
    store: ScopedMetadataStore = ScopedMetadataStore(backend, "scope", clock=clock)
    fetch: Mock = Mock(return_value='{"metrics": ["one"]}')
    initial: CatalogSnapshot = store.read(fetch)
    assert store.read(fetch) == initial
    assert fetch.call_count == 1
    assert store.refresh(fetch).status == "unchanged"
    assert store.read(fetch).revision == initial.revision
    fetch.return_value = '{"metrics": ["one", "two"]}'
    changed: MetadataRefreshResult = store.refresh(fetch)
    assert changed.status == "changed"
    assert changed.snapshot.revision != initial.revision
    assert fetch.call_count == 3


def test_failed_refresh_preserves_snapshot_and_expiry() -> None:
    backend: MemoryBackend = MemoryBackend()
    store: ScopedMetadataStore = ScopedMetadataStore(backend, "scope")
    fetch: Mock = Mock(return_value='{"metrics": []}')
    initial: CatalogSnapshot = store.read(fetch)
    original: dict[str, str] = dict(backend.values)
    original_ttls: dict[str, int] = dict(backend.ttls)
    fetch.side_effect = MetadataRefreshError("upstream")
    with pytest.raises(MetadataRefreshError, match="upstream"):
        store.refresh(fetch)
    assert backend.values == original
    assert all(backend.ttls[key] == value for key, value in original_ttls.items())
    assert store.read(fetch) == initial


def test_scope_isolates_tenant_connection_and_effective_credentials() -> None:
    base: tuple[str, str, str, str] = (
        "secret",
        "tenant-a",
        "connection",
        '{"token":"a"}',
    )
    expected: str = metadata_scope(*base)
    assert expected != metadata_scope("secret", "tenant-b", "connection", base[3])
    assert expected != metadata_scope("secret", "tenant-a", "other", base[3])
    assert expected != metadata_scope(
        "secret", "tenant-a", "connection", '{"token":"b"}'
    )
    assert "tenant" not in expected
    assert "connection" not in expected
    with pytest.raises(MetadataRefreshError, match="configuration"):
        metadata_scope("secret", "", "connection", base[3])


def test_contention_performs_no_provider_work() -> None:
    backend: Mock = Mock()
    backend.set.return_value = False
    fetch: Mock = Mock()
    with pytest.raises(MetadataRefreshError, match="in_progress"):
        ScopedMetadataStore(backend, "scope").refresh(fetch)
    fetch.assert_not_called()


def test_revalidation_aborts_before_publication() -> None:
    backend: MemoryBackend = MemoryBackend()
    guard: Mock = Mock(side_effect=MetadataRefreshError("configuration_changed"))
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", before_publish=guard
    )
    with pytest.raises(MetadataRefreshError, match="configuration_changed"):
        store.refresh(lambda: '{"metrics": []}')
    assert backend.values == {}


def test_fetch_deadline_does_not_publish() -> None:
    backend: MemoryBackend = MemoryBackend()
    clock: Mock = Mock(side_effect=[0.0, 31.0])
    with pytest.raises(MetadataRefreshError, match="deadline"):
        ScopedMetadataStore(backend, "scope", clock=clock).refresh(
            lambda: '{"metrics": []}'
        )
    assert backend.values == {}


def test_ambiguous_publication_is_not_retried() -> None:
    backend: Mock = Mock()
    backend.get.return_value = None
    backend.set.return_value = True
    backend.compare_and_publish.side_effect = RedisConnectionError()
    with pytest.raises(MetadataRefreshError, match="indeterminate"):
        ScopedMetadataStore(backend, "scope").refresh(lambda: '{"metrics": []}')
    backend.compare_and_publish.assert_called_once()
    assert backend.get.call_count == 2


def test_shared_read_outage_never_falls_back_to_fetch() -> None:
    backend: Mock = Mock()
    backend.get.side_effect = RedisConnectionError()
    fetch: Mock = Mock()
    with pytest.raises(MetadataRefreshError, match="unavailable"):
        ScopedMetadataStore(backend, "scope").read(fetch)
    fetch.assert_not_called()
