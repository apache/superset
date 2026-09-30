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

from typing import Any
from unittest.mock import Mock, patch

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from superset_core.semantic_layers.metadata import (
    CatalogSnapshot,
    MetadataRefreshError,
    MetadataRefreshResult,
)

from superset.semantic_layers.metadata import metadata_scope, ScopedMetadataStore
from superset.utils import json


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


@pytest.mark.parametrize("configuration", ["not-json", '{"number": NaN}'])
def test_invalid_scope_configuration_is_categorized(configuration: str) -> None:
    """Invalid identity inputs cannot select a shared catalog namespace."""
    with pytest.raises(MetadataRefreshError, match="^configuration$"):
        metadata_scope("secret", "tenant", "connection", configuration)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        (None, b" " * 1025),
        (None, b"[]"),
        (None, b"not-json"),
        (None, b"\xff"),
        ("version", 0),
        ("payload", None),
        ("revision", 42),
        ("observed_at", None),
        ("digest", []),
        ("attempt", False),
        ("revision", ""),
        ("observed_at", ""),
        ("digest", ""),
        ("attempt", ""),
        ("payload", "not-json"),
        ("digest", "wrong-digest"),
    ],
)
def test_invalid_shared_observation_requires_fenced_rebuild(
    field: str | None,
    value: object,
) -> None:
    """Malformed observations are never returned as a successful empty catalog."""
    memory: MemoryBackend = MemoryBackend()
    backend: Mock = Mock(wraps=memory)
    store: ScopedMetadataStore = ScopedMetadataStore(backend, "scope")
    original: CatalogSnapshot = store.refresh(lambda: '{"metrics":["old"]}').snapshot
    key: str = next(iter(memory.values))
    envelope: dict[str, Any] = json.loads(memory.values[key])
    if field is None:
        backend.get.return_value = value
    else:
        envelope[field] = value
        backend.get.return_value = json.dumps(envelope).encode()
    backend.reset_mock()
    fetch: Mock = Mock(return_value='{"metrics":["new"]}')
    with patch("superset.semantic_layers.metadata.MAX_CATALOG_BYTES", 1024):
        rebuilt: CatalogSnapshot = store.read(fetch)
    assert json.loads(rebuilt.payload) == {"metrics": ["new"]}
    assert rebuilt.revision != original.revision
    fetch.assert_called_once_with()
    backend.compare_and_publish.assert_called_once()
    assert json.loads(memory.values[key])["revision"] == rebuilt.revision


@pytest.mark.parametrize("failure", ["lease", "read_after_lease"])
def test_backend_failure_prevents_fetch_and_publication(failure: str) -> None:
    """Unavailable coordination never degrades to a worker-local fetch."""
    backend: Mock = Mock(wraps=MemoryBackend())
    if failure == "lease":
        backend.set.side_effect = RedisConnectionError("private backend detail")
    else:
        backend.get.side_effect = RedisConnectionError("private backend detail")
    fetch: Mock = Mock()
    with pytest.raises(MetadataRefreshError, match="^unavailable$"):
        ScopedMetadataStore(backend, "scope").refresh(fetch)
    fetch.assert_not_called()
    backend.compare_and_publish.assert_not_called()


@pytest.mark.parametrize("failure", ["payload_size", "envelope_size", "invalid_json"])
def test_invalid_fetched_catalog_preserves_previous_observation(failure: str) -> None:
    """Rejected provider data cannot replace the published snapshot or extend TTL."""
    backend: MemoryBackend = MemoryBackend()
    store: ScopedMetadataStore = ScopedMetadataStore(backend, "scope")
    store.refresh(lambda: '{"metrics": []}')
    before: dict[str, str] = dict(backend.values)
    key: str = next(iter(before))
    ttl: int = backend.ttls[key]
    payload: str = '"' + "x" * 150 + '"'
    bound: int = 200
    if failure == "payload_size":
        payload = "x" * 201
    elif failure == "invalid_json":
        payload = "not-json"
    with patch("superset.semantic_layers.metadata.MAX_CATALOG_BYTES", bound):
        with pytest.raises(MetadataRefreshError, match="^invalid_payload$"):
            store.refresh(lambda: payload)
    assert backend.values == before
    assert backend.ttls[key] == ttl


def test_lease_cleanup_outage_preserves_original_provider_failure() -> None:
    """A secondary cleanup failure cannot replace the safe primary result."""
    backend: Mock = Mock(wraps=MemoryBackend())
    backend.compare_and_delete.side_effect = RedisConnectionError("cleanup")
    fetch: Mock = Mock(side_effect=MetadataRefreshError("upstream"))
    with pytest.raises(MetadataRefreshError, match="^upstream$"):
        ScopedMetadataStore(backend, "scope").refresh(fetch)
    backend.compare_and_publish.assert_not_called()
    backend.compare_and_delete.assert_called_once()


@pytest.mark.parametrize("confirmation", ["own", "other", "outage"])
def test_lost_publish_acknowledgement_is_reconciled_once(confirmation: str) -> None:
    """Only a readback bearing our attempt confirms publication; never retry."""
    memory: MemoryBackend = MemoryBackend()
    backend: Mock = Mock(wraps=memory)

    def publish_then_disconnect(
        lease: str,
        attempt: str,
        target: str,
        envelope: str,
        ttl: int,
    ) -> bool:
        memory.compare_and_publish(lease, attempt, target, envelope, ttl)
        if confirmation == "other":
            record: dict[str, Any] = json.loads(memory.values[target])
            record["attempt"] = "another-writer"
            memory.values[target] = json.dumps(record)
        elif confirmation == "outage":
            backend.get.side_effect = RedisConnectionError("readback")
        raise RedisConnectionError("lost acknowledgement")

    backend.compare_and_publish.side_effect = publish_then_disconnect
    store: ScopedMetadataStore = ScopedMetadataStore(backend, "scope")
    if confirmation == "own":
        result: MetadataRefreshResult = store.refresh(lambda: '{"metrics": []}')
        assert result.status == "changed"
        assert json.loads(result.snapshot.payload) == {"metrics": []}
    else:
        with pytest.raises(MetadataRefreshError, match="^indeterminate$"):
            store.refresh(lambda: '{"metrics": []}')
    backend.compare_and_publish.assert_called_once()
    assert backend.get.call_count == 2


def test_expired_writer_cannot_replace_newer_observation() -> None:
    """Losing ownership before publish leaves the winner's snapshot untouched."""
    memory: MemoryBackend = MemoryBackend()
    backend: Mock = Mock(wraps=memory)
    store: ScopedMetadataStore = ScopedMetadataStore(backend, "scope")
    store.refresh(lambda: '{"metrics": ["winner"]}')
    before: dict[str, str] = dict(memory.values)
    backend.compare_and_publish.return_value = False
    with pytest.raises(MetadataRefreshError, match="^in_progress$"):
        store.refresh(lambda: '{"metrics": ["stale"]}')
    assert memory.values == before
