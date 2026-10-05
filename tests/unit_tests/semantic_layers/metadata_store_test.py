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

"""Store state-machine tests; real Redis separately verifies the atomic primitives."""

from __future__ import annotations

import hashlib
import time
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Event, RLock
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
    """Atomic test double, not evidence of Redis script correctness."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self.clock: Callable[[], float] = clock
        self.entries: dict[str, tuple[bytes, float | None]] = {}
        self.lock: RLock = RLock()

    def with_deadline(self, deadline: float) -> MemoryBackend:
        return self

    def get(self, name: str) -> bytes | None:
        with self.lock:
            entry: tuple[bytes, float | None] | None = self.entries.get(name)
            if entry is None:
                return None
            if entry[1] is not None and entry[1] <= self.clock():
                self.entries.pop(name)
                return None
            return entry[0]

    def set(
        self,
        name: str,
        value: str,
        ex: int | None = None,
        px: int | None = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool | None:
        with self.lock:
            current: bytes | None = self.get(name)
            if (nx and current is not None) or (xx and current is None):
                return None
            duration: float | None = px / 1000 if px is not None else ex
            self.entries[name] = (
                value.encode(),
                None if duration is None else self.clock() + duration,
            )
            return True

    def delete(self, *names: str) -> int:
        with self.lock:
            return sum(self.entries.pop(name, None) is not None for name in names)

    def compare_and_delete(self, name: str, expected: str) -> int:
        with self.lock:
            return self.delete(name) if self.get(name) == expected.encode() else 0

    def compare_and_publish(
        self,
        lease_key: str,
        expected: str,
        snapshot_key: str,
        value: str,
        ttl_ms: int,
    ) -> bool:
        with self.lock:
            if self.get(lease_key) != expected.encode():
                return False
            self.set(snapshot_key, value, px=ttl_ms)
            self.delete(lease_key)
            return True

    def get_with_ttl(self, name: str) -> tuple[bytes | None, int]:
        with self.lock:
            value: bytes | None = self.get(name)
            if value is None:
                return None, -2
            expiry: float | None = self.entries[name][1]
            return value, -1 if expiry is None else max(
                0, int((expiry - self.clock()) * 1000)
            )

    def get_or_create(self, name: str, value: str, ttl: int) -> bytes:
        with self.lock:
            self.set(name, value, ex=ttl, nx=True)
            result: bytes | None = self.get(name)
            assert result is not None
            return result


class Clock:
    def __init__(self) -> None:
        self.value: float = 100.0

    def __call__(self) -> float:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += seconds


def catalog(deadline: float) -> str:
    return '{"metrics":["orders"]}'


def test_publication_rotates_token_even_when_discovery_is_unchanged() -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "tenant-a", deadline=store_deadline
    )
    first: CatalogSnapshot = store.read(catalog, deadline=store_deadline)
    assert store.read(catalog, deadline=store_deadline) == first
    second: MetadataRefreshResult = store.refresh(catalog, deadline=store_deadline)
    assert second.status == "unchanged"
    assert second.snapshot.payload == first.payload
    assert second.snapshot.cache_token != first.cache_token


def test_same_deadline_reaches_two_acquisitions_without_reset() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    store_deadline: float = 105
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "tenant-a", deadline=store_deadline, clock=clock
    )
    seen: list[float] = []

    def fetch(deadline: float) -> str:
        seen.append(deadline)
        clock.advance(1)
        return "[]"

    store.refresh(fetch, deadline=store_deadline)
    store.refresh(fetch, deadline=store_deadline)
    assert seen == [105, 105]
    clock.advance(4)
    with pytest.raises(MetadataRefreshError, match="deadline"):
        store.refresh(fetch, deadline=store_deadline)
    assert seen == [105, 105]


@pytest.mark.parametrize("deadline", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_deadline_is_rejected_without_backend_work(deadline: float) -> None:
    backend: MemoryBackend = MemoryBackend()
    with pytest.raises(MetadataRefreshError, match="configuration"):
        ScopedMetadataStore(backend, "tenant-a", deadline=deadline)
    assert backend.entries == {}


def test_cold_readers_wait_for_one_owner_and_share_its_observation() -> None:
    backend: MemoryBackend = MemoryBackend()
    started: Event = Event()
    release: Event = Event()
    waiting: Event = Event()
    fetches: list[float] = []
    owner_deadline: float = time.monotonic() + 5
    owner: ScopedMetadataStore = ScopedMetadataStore(
        backend, "tenant-a", deadline=owner_deadline
    )

    def wait(seconds: float) -> None:
        waiting.set()
        time.sleep(seconds)

    follower_deadline: float = time.monotonic() + 5
    follower: ScopedMetadataStore = ScopedMetadataStore(
        backend, "tenant-a", deadline=follower_deadline, wait=wait
    )

    def fetch(deadline: float) -> str:
        fetches.append(deadline)
        started.set()
        assert release.wait(2)
        return "[]"

    executor: ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as executor:
        first: Future[CatalogSnapshot] = executor.submit(
            owner.read, fetch, deadline=owner_deadline
        )
        assert started.wait(2)
        second: Future[CatalogSnapshot] = executor.submit(
            follower.read, fetch, deadline=follower_deadline
        )
        assert waiting.wait(2)
        release.set()
        assert first.result(timeout=2) == second.result(timeout=2)
    assert len(fetches) == 1


def test_busy_cold_reader_waits_to_its_deadline_without_another_fetch() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    backend.set("semantic-metadata:{scope}:lease", "owner", ex=60)
    store_deadline: float = 100.2
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline, clock=clock, wait=clock.advance
    )
    calls: list[float] = []

    def fetch(deadline: float) -> str:
        calls.append(deadline)
        return "[]"

    with pytest.raises(MetadataRefreshError, match="deadline"):
        store.read(fetch, deadline=store_deadline)
    assert calls == []
    assert clock.value == pytest.approx(100.2)


def test_catalog_invalidation_retires_an_inflight_writer() -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )

    def fetch(deadline: float) -> str:
        store.invalidate_catalog()
        return "[]"

    with pytest.raises(MetadataRefreshError, match="configuration_changed"):
        store.refresh(fetch, deadline=store_deadline)
    assert backend.get("semantic-metadata:{scope}:snapshot") is None


def test_failure_and_hits_do_not_renew_expiry() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    store_deadline: float = 130
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline, clock=clock
    )
    store.read(catalog, deadline=store_deadline)
    initial_expiry: float | None = backend.entries[
        "semantic-metadata:{scope}:snapshot"
    ][1]
    clock.advance(1)
    store.read(catalog, deadline=store_deadline)

    def failed(deadline: float) -> str:
        raise MetadataRefreshError("upstream")

    with pytest.raises(MetadataRefreshError, match="upstream"):
        store.refresh(failed, deadline=store_deadline)
    assert backend.entries["semantic-metadata:{scope}:snapshot"][1] == initial_expiry


def test_expired_catalog_gets_new_identity_for_same_payload() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    acquisition_deadline_1: float = 130
    first: CatalogSnapshot = ScopedMetadataStore(
        backend, "scope", deadline=acquisition_deadline_1, clock=clock
    ).read(catalog, deadline=acquisition_deadline_1)
    clock.advance(301)
    acquisition_deadline_2: float = clock() + 30
    second: CatalogSnapshot = ScopedMetadataStore(
        backend, "scope", deadline=acquisition_deadline_2, clock=clock
    ).read(catalog, deadline=acquisition_deadline_2)
    assert second.payload == first.payload
    assert second.cache_token != first.cache_token


def test_scopes_include_tenant_connection_and_configuration() -> None:
    scope: str = metadata_scope(
        "test-secret", "tenant-a", "connection-a", '{"a":1,"b":2}'
    )
    assert scope == metadata_scope(
        "test-secret", "tenant-a", "connection-a", '{"b":2,"a":1}'
    )
    assert scope != metadata_scope(
        "test-secret", "tenant-b", "connection-a", '{"a":1,"b":2}'
    )
    assert scope != metadata_scope(
        "test-secret", "tenant-a", "connection-b", '{"a":1,"b":2}'
    )
    assert scope != metadata_scope(
        "test-secret", "tenant-a", "connection-a", '{"a":2,"b":2}'
    )


def test_compatibility_invalidation_is_independent_of_catalog() -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    snapshot: CatalogSnapshot = store.read(catalog, deadline=store_deadline)
    first: str = store.compatibility_generation()
    store.invalidate_compatibility()
    assert store.compatibility_generation() != first
    assert store.read(catalog, deadline=store_deadline) == snapshot


@pytest.mark.parametrize(
    "payload",
    [b"[]", "not-json", "NaN", "\ud800", '{"value":1e9999999999999999999}'],
)
def test_invalid_provider_payload_never_replaces_a_valid_snapshot(payload: Any) -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    original: CatalogSnapshot = store.read(catalog, deadline=store_deadline)
    with pytest.raises(MetadataRefreshError, match="invalid_payload"):
        store.refresh(lambda deadline: payload, deadline=store_deadline)
    assert store.peek() == original


def test_unrepresentable_decimal_in_stored_payload_is_a_cache_miss() -> None:
    """A corrupt envelope cannot escape the catalog decode failure path."""
    backend: MemoryBackend = MemoryBackend()
    deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=deadline
    )
    store.read(catalog, deadline=deadline)
    key: str = "semantic-metadata:{scope}:snapshot"
    raw: bytes | None = backend.get(key)
    assert raw is not None
    envelope: dict[str, Any] = json.loads(raw)
    payload: str = '{"value":1e9999999999999999999}'
    envelope.update(
        payload=payload, digest=hashlib.sha256(payload.encode()).hexdigest()
    )
    backend.set(key, json.dumps(envelope), ex=300)
    assert store.peek() is None
    replacement: CatalogSnapshot = store.read(catalog, deadline=deadline)
    assert replacement.payload == catalog(deadline)


def test_unknown_publish_outcome_reconciles_only_its_own_attempt() -> None:
    memory: MemoryBackend = MemoryBackend()
    backend: Mock = Mock(wraps=memory)
    backend.with_deadline.return_value = backend
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )

    def committed(*args: Any) -> bool:
        memory.compare_and_publish(*args)
        raise RedisConnectionError("private vendor message")

    backend.compare_and_publish.side_effect = committed
    result: MetadataRefreshResult = store.refresh(catalog, deadline=store_deadline)
    assert result.snapshot == store.peek()
    backend.compare_and_publish.side_effect = RedisConnectionError(
        "private vendor message"
    )
    error: pytest.ExceptionInfo[MetadataRefreshError]
    with pytest.raises(MetadataRefreshError, match="indeterminate") as error:
        store.refresh(catalog, deadline=store_deadline)
    assert "private" not in str(error.value)
    assert store.peek() == result.snapshot
    backend.get.side_effect = RedisConnectionError("private")
    with pytest.raises(MetadataRefreshError, match="indeterminate"):
        store._publish("unconfirmed", "[]", 500, result.snapshot)


def test_busy_refresh_and_expired_owner_cannot_publish() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    backend.set("semantic-metadata:{scope}:lease", "other", ex=60)
    store_deadline: float = 300
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline, clock=clock
    )
    with pytest.raises(MetadataRefreshError, match="in_progress"):
        store.refresh(catalog, deadline=store_deadline)
    clock.advance(61)

    def slow(deadline: float) -> str:
        clock.advance(61)
        return "[]"

    with pytest.raises(MetadataRefreshError, match="configuration_changed"):
        store.refresh(slow, deadline=store_deadline)
    assert store.peek() is None


def test_size_bounds_and_provider_exception_are_safe() -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    with patch("superset.semantic_layers.metadata.MAX_CATALOG_BYTES", 150):
        with pytest.raises(MetadataRefreshError, match="invalid_payload"):
            store.refresh(
                lambda deadline: '"' + "x" * 200 + '"', deadline=store_deadline
            )
        with pytest.raises(MetadataRefreshError, match="invalid_payload"):
            store.refresh(lambda deadline: "[]", deadline=store_deadline)
    with pytest.raises(MetadataRefreshError, match="upstream"):
        store.refresh(Mock(side_effect=ValueError("private")), deadline=store_deadline)
    assert backend.entries == {}


def test_backend_failures_do_not_claim_success() -> None:
    backend: Mock = Mock(spec=MemoryBackend)
    backend.with_deadline.return_value = backend
    backend.get.side_effect = RedisConnectionError("private")
    backend.set.side_effect = RedisConnectionError("private")
    backend.delete.side_effect = RedisConnectionError("private")
    backend.get_or_create.side_effect = RedisConnectionError("private")
    backend.get_with_ttl.side_effect = RedisConnectionError("private")
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    method: Callable[..., CatalogSnapshot | MetadataRefreshResult]
    mutation: Callable[[], None]
    read: Callable[[], object]
    for method in (store.read, store.refresh):
        with pytest.raises(MetadataRefreshError, match="unavailable"):
            method(catalog, deadline=store_deadline)
    for mutation in (store.invalidate_catalog, store.invalidate_compatibility):
        with pytest.raises(MetadataRefreshError, match="indeterminate"):
            mutation()
    for read in (
        store.peek,
        store.compatibility_generation,
        store.peek_compatibility_generation,
    ):
        with pytest.raises(MetadataRefreshError, match="unavailable"):
            read()
    assert store.inspect_catalog().state == "unavailable"
    backend.set.side_effect = None
    backend.set.return_value = False
    with pytest.raises(MetadataRefreshError, match="unavailable"):
        store.invalidate_compatibility()


@pytest.mark.parametrize(
    "raw", [b"bad", b"[]", b'{"version":1}', b'{"version":2}', b"\xff"]
)
def test_malformed_shared_entries_are_not_served(raw: bytes) -> None:
    backend: MemoryBackend = MemoryBackend()
    backend.entries["semantic-metadata:{scope}:snapshot"] = (raw, None)
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    assert store.inspect_catalog().state == "unsupported"
    assert store.peek() is None
    assert store.read(catalog, deadline=store_deadline).payload == catalog(0)


@pytest.mark.parametrize("configuration", ["not-json", "NaN"])
def test_bad_scope_configuration_is_safe(configuration: str) -> None:
    with pytest.raises(MetadataRefreshError, match="configuration"):
        metadata_scope("test-secret", "tenant", "connection", configuration)
    with pytest.raises(MetadataRefreshError, match="configuration"):
        metadata_scope("", "tenant", "connection", "{}")


def test_stale_or_corrupt_envelopes_cannot_supply_cache_identity() -> None:
    from superset.utils import json

    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    store.read(catalog, deadline=store_deadline)
    raw: bytes = backend.entries["semantic-metadata:{scope}:snapshot"][0]
    envelope: dict[str, Any] = json.loads(raw)
    changed: dict[str, Any]
    for changed in (
        {**envelope, "cache_token": ""},
        {**envelope, "cache_token": "other:token"},
        {**envelope, "digest": "incorrect"},
        {**envelope, "payload": "NaN"},
    ):
        backend.set("semantic-metadata:{scope}:snapshot", json.dumps(changed))
        assert store.peek() is None
    with patch("superset.semantic_layers.metadata.MAX_CATALOG_BYTES", 1):
        assert store.peek() is None


def test_newly_acquired_reader_rechecks_a_completed_publication() -> None:
    memory: MemoryBackend = MemoryBackend()
    acquisition_deadline_3: float = time.monotonic() + 5
    original: CatalogSnapshot = ScopedMetadataStore(
        memory, "scope", deadline=acquisition_deadline_3
    ).read(catalog, deadline=acquisition_deadline_3)
    backend: Mock = Mock(wraps=memory)
    backend.with_deadline.return_value = backend
    raw: bytes | None = memory.get("semantic-metadata:{scope}:snapshot")
    backend.get.side_effect = [None, raw]
    fetch: Mock = Mock(side_effect=AssertionError("redundant upstream call"))
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    assert store.read(fetch, deadline=store_deadline) == original
    fetch.assert_not_called()


def test_cleanup_outage_does_not_hide_confirmed_publication_or_deadline() -> None:
    memory: MemoryBackend = MemoryBackend()
    backend: Mock = Mock(wraps=memory)
    backend.with_deadline.return_value = backend
    backend.compare_and_delete.side_effect = RedisConnectionError("private")
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    assert store.read(catalog, deadline=store_deadline) == store.peek()
    clock: Clock = Clock()
    slow_deadline: float = 105
    slow: ScopedMetadataStore = ScopedMetadataStore(
        MemoryBackend(clock), "slow", deadline=slow_deadline, clock=clock
    )

    def fetch(deadline: float) -> str:
        clock.advance(6)
        return "[]"

    with pytest.raises(MetadataRefreshError, match="deadline"):
        slow.refresh(fetch, deadline=slow_deadline)


@pytest.mark.parametrize("budget", [5.0, 0.001])
def test_exhausted_owner_does_not_pin_the_next_cold_reader(budget: float) -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    owner_deadline: float = clock() + budget
    owner: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=owner_deadline, clock=clock
    )

    def exhausted(deadline: float) -> str:
        clock.advance(budget + 0.002)
        return "[]"

    with pytest.raises(MetadataRefreshError, match="deadline"):
        owner.read(exhausted, deadline=owner_deadline)
    assert backend.get("semantic-metadata:{scope}:lease") is None
    follower_deadline: float = clock() + 30
    follower: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=follower_deadline, clock=clock, wait=clock.advance
    )
    assert follower.read(catalog, deadline=follower_deadline).payload == catalog(0)


@pytest.mark.parametrize(
    "number", ["0.12345678901234567890123456789", "1e400", "1e-400"]
)
def test_provider_numbers_survive_publication_and_cached_read(number: str) -> None:
    """Normalization must preserve provider-owned numeric values."""
    from decimal import Decimal

    from superset.utils import json

    backend: MemoryBackend = MemoryBackend()
    deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "tenant", deadline=deadline
    )
    fetch: Mock = Mock(return_value='{"value":' + number + "}")
    first: CatalogSnapshot = store.read(fetch, deadline=deadline)
    assert json.loads(first.payload, use_decimal=True)["value"] == Decimal(number)
    assert store.read(fetch, deadline=deadline) == first
    fetch.assert_called_once()
    assert store.refresh(fetch, deadline=deadline).status == "unchanged"
