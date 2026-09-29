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

"""Real Redis publication contract; no in-memory substitute for writer fencing."""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from multiprocessing.context import SpawnContext
from unittest.mock import Mock
from uuid import uuid4

import pytest
from superset_core.semantic_layers.metadata import (
    CatalogSnapshot,
    MetadataRefreshResult,
)

from superset.coordination.cache_backend import RedisCacheBackend


@pytest.fixture
def publication_backend() -> Iterator[tuple[RedisCacheBackend, str, str]]:
    """Use unique keys on the explicitly configured integration Redis service."""
    backend: RedisCacheBackend = RedisCacheBackend(
        host=os.environ.get("REDIS_HOST", "127.0.0.1"),
        port=int(os.environ.get("REDIS_PORT", "16379")),
        socket_timeout=2,
        socket_connect_timeout=2,
    )
    scope: str = f"test-metadata:{{{uuid4().hex}}}"
    lease_key: str = f"{scope}:lease"
    snapshot_key: str = f"{scope}:snapshot"
    try:
        yield backend, lease_key, snapshot_key
    finally:
        backend.delete(lease_key, snapshot_key)


def test_expired_writer_cannot_replace_newer_snapshot(
    publication_backend: tuple[RedisCacheBackend, str, str],
) -> None:
    """Resume writer A after its lease is lost and writer B has published."""
    backend: RedisCacheBackend
    lease_key: str
    snapshot_key: str
    backend, lease_key, snapshot_key = publication_backend
    assert backend.set(lease_key, "writer-a", ex=60, nx=True)
    # Expiration is controlled explicitly rather than relying on scheduling sleeps.
    assert backend._cache.pexpire(lease_key, 0)
    assert backend.set(lease_key, "writer-b", ex=60, nx=True)
    assert backend.compare_and_publish(lease_key, "writer-b", snapshot_key, "new", 300)
    assert not backend.compare_and_publish(
        lease_key, "writer-a", snapshot_key, "old", 300
    )
    assert backend.get(snapshot_key) == b"new"
    assert backend.get(lease_key) is None


def test_non_owner_does_not_release_lease_or_extend_snapshot(
    publication_backend: tuple[RedisCacheBackend, str, str],
) -> None:
    """Rejected publication changes neither snapshot nor current owner's lease."""
    backend: RedisCacheBackend
    lease_key: str
    snapshot_key: str
    backend, lease_key, snapshot_key = publication_backend
    assert backend.set(snapshot_key, "original", ex=300)
    remaining_ms: int = backend._cache.pttl(snapshot_key)
    assert backend.set(lease_key, "owner", ex=60, nx=True)
    assert not backend.compare_and_publish(
        lease_key, "intruder", snapshot_key, "bad", 300
    )
    assert backend.get(snapshot_key) == b"original"
    assert backend.get(lease_key) == b"owner"
    assert 0 < backend._cache.pttl(snapshot_key) <= remaining_ms


def test_expired_fetch_cannot_publish(
    publication_backend: tuple[RedisCacheBackend, str, str],
) -> None:
    """Nonpositive remaining freshness cannot install a snapshot."""
    backend: RedisCacheBackend
    lease_key: str
    snapshot_key: str
    backend, lease_key, snapshot_key = publication_backend
    assert backend.set(lease_key, "owner", ex=60, nx=True)
    with pytest.raises(ValueError, match="positive TTL"):
        backend.compare_and_publish(lease_key, "owner", snapshot_key, "expired", 0)
    assert backend.get(snapshot_key) is None


def _read_worker(port: int, scope: str, pipe: object) -> None:
    """Independent interpreter reads authoritative snapshots without discovery."""
    from multiprocessing.connection import Connection
    from typing import cast

    from superset.semantic_layers.metadata import ScopedMetadataStore

    channel: Connection = cast(Connection, pipe)
    backend: RedisCacheBackend = RedisCacheBackend(
        host="127.0.0.1", port=port, socket_timeout=2, socket_connect_timeout=2
    )
    store: ScopedMetadataStore = ScopedMetadataStore(backend, scope)

    def unexpected_fetch() -> str:
        raise AssertionError("Fresh shared catalog was not visible")

    try:
        while channel.recv() == "read":
            snapshot: CatalogSnapshot = store.read(unexpected_fetch)
            channel.send((snapshot.revision, snapshot.payload))
    finally:
        channel.close()


def test_two_processes_read_published_catalog_one_hundred_times(
    publication_backend: tuple[RedisCacheBackend, str, str],
) -> None:
    """A successful refresh is visible to both previously primed workers."""
    import multiprocessing
    from multiprocessing.connection import Connection
    from multiprocessing.process import BaseProcess

    from superset.semantic_layers.metadata import ScopedMetadataStore

    backend: RedisCacheBackend
    lease_key: str
    snapshot_key: str
    backend, lease_key, snapshot_key = publication_backend
    scope: str = lease_key.split("{", 1)[1].split("}", 1)[0]
    # The public store uses the same tagged keys as its factory, separately from
    # the lower-level primitive fixture's prefix.
    store: ScopedMetadataStore = ScopedMetadataStore(backend, scope)
    context: SpawnContext = multiprocessing.get_context("spawn")
    parents: list[Connection] = []
    children: list[BaseProcess] = []
    try:
        store.refresh(lambda: '{"metrics":["one","two","three"]}')
        for _ in range(2):
            parent: Connection
            child: Connection
            parent, child = context.Pipe()
            process: BaseProcess = context.Process(
                target=_read_worker,
                args=(int(os.environ.get("REDIS_PORT", "16379")), scope, child),
            )
            process.start()
            child.close()
            parents.append(parent)
            children.append(process)
            parent.send("read")
            assert parent.poll(10), "Worker failed to start"
            assert '"three"' in parent.recv()[1]
        published: MetadataRefreshResult = store.refresh(
            lambda: '{"metrics":["one","two","three","four"]}'
        )
        index: int
        for index in range(100):
            parents[index % 2].send("read")
            assert parents[index % 2].poll(5), "Worker did not answer"
            revision: str
            payload: str
            revision, payload = parents[index % 2].recv()
            assert revision == published.snapshot.revision
            assert payload == '{"metrics":["one","two","three","four"]}'
    finally:
        for parent in parents:
            parent.send("stop")
            parent.close()
        for process in children:
            process.join(5)
            if process.is_alive():
                process.terminate()
                process.join(5)
        backend.delete(
            f"semantic-metadata:{{{scope}}}:lease",
            f"semantic-metadata:{{{scope}}}:snapshot",
        )
    assert all(process.exitcode == 0 for process in children)


@pytest.fixture
def shared_store(
    publication_backend: tuple[RedisCacheBackend, str, str],
) -> Iterator[tuple[RedisCacheBackend, str, object]]:
    """Own one complete store namespace on the real Redis service."""
    from superset.semantic_layers.metadata import ScopedMetadataStore

    backend: RedisCacheBackend = publication_backend[0]
    scope: str = uuid4().hex
    store: ScopedMetadataStore = ScopedMetadataStore(backend, scope)
    try:
        yield backend, scope, store
    finally:
        backend.delete(
            f"semantic-metadata:{{{scope}}}:lease",
            f"semantic-metadata:{{{scope}}}:snapshot",
        )


def test_shared_hits_and_failed_refresh_do_not_slide_expiry(
    shared_store: tuple[RedisCacheBackend, str, object],
) -> None:
    from typing import cast
    from unittest.mock import Mock

    from superset_core.semantic_layers.metadata import (
        MetadataRefreshError,
    )

    from superset.semantic_layers.metadata import ScopedMetadataStore

    backend: RedisCacheBackend = shared_store[0]
    key: str = f"semantic-metadata:{{{shared_store[1]}}}:snapshot"
    store: ScopedMetadataStore = cast(ScopedMetadataStore, shared_store[2])
    initial: CatalogSnapshot = store.read(lambda: '{"metrics":[]}')
    # Shorten only this test's snapshot to distinguish reuse from a TTL renewal.
    assert backend._cache.pexpire(key, 10000)
    remaining: int = backend._cache.pttl(key)
    fetch: Mock = Mock(side_effect=MetadataRefreshError("upstream"))
    assert store.read(fetch) == initial
    fetch.assert_not_called()
    with pytest.raises(MetadataRefreshError, match="upstream"):
        store.refresh(fetch)
    assert store.read(fetch) == initial
    assert 0 < backend._cache.pttl(key) <= remaining


def test_confirmed_lost_publication_response_returns_success_once(
    shared_store: tuple[RedisCacheBackend, str, object],
) -> None:
    from typing import cast
    from unittest.mock import patch

    from redis.exceptions import ConnectionError as RedisConnectionError

    from superset.semantic_layers.metadata import ScopedMetadataStore

    backend: RedisCacheBackend = shared_store[0]
    store: ScopedMetadataStore = cast(ScopedMetadataStore, shared_store[2])
    original_publish: Callable[[str, str, str, str, int], bool] = (
        backend.compare_and_publish
    )

    def publish_then_disconnect(
        lease_key: str, expected: str, snapshot_key: str, value: str, ttl: int
    ) -> bool:
        assert original_publish(lease_key, expected, snapshot_key, value, ttl)
        raise RedisConnectionError("controlled lost acknowledgement")

    publish: Mock
    with patch.object(
        backend, "compare_and_publish", side_effect=publish_then_disconnect
    ) as publish:
        result: MetadataRefreshResult = store.refresh(lambda: '{"metrics":["new"]}')
    assert result.status == "changed"
    assert store.read(lambda: "{}") == result.snapshot
    publish.assert_called_once()


def test_expiry_refetches_and_unchanged_refresh_preserves_revision(
    shared_store: tuple[RedisCacheBackend, str, object],
) -> None:
    from typing import cast
    from unittest.mock import Mock

    from superset.semantic_layers.metadata import ScopedMetadataStore

    backend: RedisCacheBackend = shared_store[0]
    store: ScopedMetadataStore = cast(ScopedMetadataStore, shared_store[2])
    fetch: Mock = Mock(return_value='{"metrics":["one"]}')
    first: CatalogSnapshot = store.read(fetch)
    same: MetadataRefreshResult = store.refresh(fetch)
    assert same.status == "unchanged"
    assert same.snapshot.revision == first.revision
    backend._cache.pexpire(f"semantic-metadata:{{{shared_store[1]}}}:snapshot", 0)
    fetch.return_value = '{"metrics":["one","two"]}'
    assert store.read(fetch).revision != first.revision
    assert fetch.call_count == 3


@pytest.mark.parametrize(
    "corruption", ["unknown_version", "broken_payload", "empty_revision", "bad_digest"]
)
def test_malformed_envelope_requires_fenced_rebuild(
    shared_store: tuple[RedisCacheBackend, str, object], corruption: str
) -> None:
    import hashlib
    from typing import Any, cast
    from unittest.mock import Mock

    from superset.semantic_layers.metadata import ScopedMetadataStore
    from superset.utils import json

    backend: RedisCacheBackend = shared_store[0]
    key: str = f"semantic-metadata:{{{shared_store[1]}}}:snapshot"
    store: ScopedMetadataStore = cast(ScopedMetadataStore, shared_store[2])
    store.refresh(lambda: '{"metrics":[]}')
    envelope: dict[str, Any] = json.loads(backend.get(key))
    if corruption == "unknown_version":
        envelope["version"] = 999
    elif corruption == "broken_payload":
        envelope["payload"] = "not json"
        envelope["digest"] = hashlib.sha256(b"not json").hexdigest()
    elif corruption == "empty_revision":
        envelope["revision"] = ""
    else:
        envelope["digest"] = "invalid"
    backend.set(key, json.dumps(envelope), ex=300)
    fetch: Mock = Mock(return_value='{"metrics":["rebuilt"]}')
    assert store.read(fetch).payload == '{"metrics":["rebuilt"]}'
    fetch.assert_called_once()


def _hold_refresh_worker(port: int, scope: str, pipe: object) -> None:
    """Hold an acquired lease inside a fetch until the test terminates this worker."""
    from multiprocessing.connection import Connection
    from typing import cast

    from superset.semantic_layers.metadata import ScopedMetadataStore

    channel: Connection = cast(Connection, pipe)
    backend: RedisCacheBackend = RedisCacheBackend(
        host="127.0.0.1", port=port, socket_timeout=2, socket_connect_timeout=2
    )
    store: ScopedMetadataStore = ScopedMetadataStore(backend, scope)

    def held_fetch() -> str:
        channel.send("lease-acquired")
        channel.recv()
        return '{"metrics":["abandoned"]}'

    try:
        store.refresh(held_fetch)
    finally:
        channel.close()


def test_worker_death_preserves_snapshot_and_recovers_after_lease_expiry(
    shared_store: tuple[RedisCacheBackend, str, object],
) -> None:
    """A killed owner cannot force local fallback or strand subsequent refreshes."""
    import multiprocessing
    from multiprocessing.connection import Connection
    from multiprocessing.process import BaseProcess
    from typing import cast
    from unittest.mock import Mock

    from superset_core.semantic_layers.metadata import (
        MetadataRefreshError,
    )

    from superset.semantic_layers.metadata import ScopedMetadataStore

    backend: RedisCacheBackend = shared_store[0]
    scope: str = shared_store[1]
    store: ScopedMetadataStore = cast(ScopedMetadataStore, shared_store[2])
    lease_key: str = f"semantic-metadata:{{{scope}}}:lease"
    original: CatalogSnapshot = store.read(lambda: '{"metrics":["original"]}')
    context: SpawnContext = multiprocessing.get_context("spawn")
    parent: Connection
    child: Connection
    parent, child = context.Pipe()
    process: BaseProcess = context.Process(
        target=_hold_refresh_worker,
        args=(int(os.environ.get("REDIS_PORT", "16379")), scope, child),
    )
    try:
        process.start()
        child.close()
        assert parent.poll(10), "Refresh worker failed to acquire its lease"
        assert parent.recv() == "lease-acquired"
        owner: bytes | None = backend.get(lease_key)
        assert owner is not None
        process.terminate()
        process.join(5)
        assert not process.is_alive()
        assert process.exitcode not in (None, 0)
        assert backend.get(lease_key) == owner
        fetch: Mock = Mock(return_value='{"metrics":["recovered"]}')
        assert store.read(fetch) == original
        with pytest.raises(MetadataRefreshError, match="in_progress"):
            store.refresh(fetch)
        fetch.assert_not_called()
        # Trigger expiration deterministically on this test's real Redis lease.
        assert backend._cache.pexpire(lease_key, 0)
        recovered: MetadataRefreshResult = store.refresh(fetch)
        assert recovered.status == "changed"
        assert recovered.snapshot.payload == '{"metrics":["recovered"]}'
        assert recovered.snapshot.revision != original.revision
        assert backend.get(lease_key) is None
        assert store.read(fetch) == recovered.snapshot
        fetch.assert_called_once_with()
    finally:
        parent.close()
        child.close()
        if process.is_alive():
            process.terminate()
        if process.pid is not None:
            process.join(5)


def test_namespace_rotation_isolates_restored_old_snapshot(
    publication_backend: tuple[RedisCacheBackend, str, str],
) -> None:
    """Rotating trusted namespace after state restore cannot reuse its old token."""
    from unittest.mock import Mock

    from superset.semantic_layers.metadata import metadata_scope, ScopedMetadataStore

    backend: RedisCacheBackend = publication_backend[0]
    connection: str = uuid4().hex
    old_scope: str = metadata_scope("synthetic", "before-restore", connection, "{}")
    new_scope: str = metadata_scope("synthetic", "after-restore", connection, "{}")
    old_store: ScopedMetadataStore = ScopedMetadataStore(backend, old_scope)
    new_store: ScopedMetadataStore = ScopedMetadataStore(backend, new_scope)
    old_key: str = f"semantic-metadata:{{{old_scope}}}:snapshot"
    try:
        before: CatalogSnapshot = old_store.read(lambda: '{"metrics":["old"]}')
        archived: bytes | None = backend.get(old_key)
        assert archived is not None
        old_store.refresh(lambda: '{"metrics":["current"]}')
        # Simulate restoring only this synthetic namespace from an old backup.
        backend.set(old_key, archived.decode(), ex=300)
        fetch: Mock = Mock(return_value='{"metrics":["current"]}')
        assert old_store.read(fetch) == before
        fetch.assert_not_called()
        after: CatalogSnapshot = new_store.read(fetch)
        assert after.payload == '{"metrics":["current"]}'
        assert after.cache_token != before.cache_token
        assert after.revision != before.revision
        assert old_store.read(fetch) == before
        assert new_store.read(fetch) == after
        fetch.assert_called_once_with()
    finally:
        backend.delete(
            f"semantic-metadata:{{{old_scope}}}:lease",
            old_key,
            f"semantic-metadata:{{{new_scope}}}:lease",
            f"semantic-metadata:{{{new_scope}}}:snapshot",
        )
