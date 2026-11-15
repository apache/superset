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

"""
Test and development helpers for the artifacts contracts.

- ``InMemoryArtifactStore``: an ``ArtifactStoreBackend`` that keeps everything
  in memory, the reference backend.
- ``ArtifactStoreBackendConformance``: the backend contract as tests, for any
  backend's own suite to inherit.

Neither needs pytest to import; the conformance tests run under pytest.
"""

from __future__ import annotations

import threading
from collections.abc import Iterable, Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass

from superset_core.artifacts.store import (
    ArtifactStoreBackend,
    DRAFT_REF,
    InvalidPathError,
    is_sha256_hex,
    MissingObjectsError,
    PUBLISHED_REF,
    sha256_hex,
    tree_hash,
    validate_tree,
)


def _require_hash(value: str) -> str:
    if not is_sha256_hex(value):
        raise ValueError(f"{value!r} is not a SHA-256 (64 lowercase hex digits)")
    return value


class InMemoryArtifactStore:
    """
    An ``ArtifactStoreBackend`` that keeps everything in memory.

    For tests and development: nothing is durable, and it serves one process.
    Each namespace has its own blobs, trees and refs, and one lock makes every
    operation, compare-and-swap included, atomic across threads.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._blobs: dict[str, dict[str, bytes]] = {}
        self._trees: dict[str, dict[str, dict[str, str]]] = {}
        self._refs: dict[str, dict[tuple[str, str], str]] = {}

    def put_blob(self, namespace: str, data: bytes) -> str:
        if not isinstance(data, (bytes, bytearray, memoryview)):
            raise TypeError(f"blob content must be bytes, not {type(data).__name__}")
        content = bytes(data)
        blob_hash = sha256_hex(content)
        with self._lock:
            self._blobs.setdefault(namespace, {}).setdefault(blob_hash, content)
        return blob_hash

    def get_blob(self, namespace: str, blob_hash: str) -> bytes | None:
        _require_hash(blob_hash)
        with self._lock:
            return self._blobs.get(namespace, {}).get(blob_hash)

    def missing_blobs(self, namespace: str, hashes: Iterable[str]) -> set[str]:
        wanted = {_require_hash(blob_hash) for blob_hash in hashes}
        with self._lock:
            stored = self._blobs.get(namespace, {})
            return {blob_hash for blob_hash in wanted if blob_hash not in stored}

    def put_tree(self, namespace: str, tree: Mapping[str, str]) -> str:
        snapshot = dict(tree)
        validate_tree(snapshot)
        digest = tree_hash(snapshot)
        with self._lock:
            stored = self._blobs.get(namespace, {})
            missing = {
                blob_hash for blob_hash in snapshot.values() if blob_hash not in stored
            }
            if missing:
                raise MissingObjectsError(missing)
            self._trees.setdefault(namespace, {}).setdefault(digest, snapshot)
        return digest

    def get_tree(self, namespace: str, tree_hash: str) -> dict[str, str] | None:
        _require_hash(tree_hash)
        with self._lock:
            tree = self._trees.get(namespace, {}).get(tree_hash)
            return None if tree is None else dict(tree)

    def get_ref(self, namespace: str, artifact_id: str, ref: str) -> str | None:
        with self._lock:
            return self._refs.get(namespace, {}).get((artifact_id, ref))

    def compare_and_set_ref(
        self,
        namespace: str,
        artifact_id: str,
        ref: str,
        expected: str | None,
        new: str,
    ) -> bool:
        _require_hash(new)
        if expected is not None:
            _require_hash(expected)
        with self._lock:
            if new not in self._trees.get(namespace, {}):
                raise MissingObjectsError([new])
            refs = self._refs.setdefault(namespace, {})
            if refs.get((artifact_id, ref)) != expected:
                return False
            refs[(artifact_id, ref)] = new
            return True


@dataclass
class _Raised:
    """The exception that ``_raises`` caught."""

    error: Exception | None = None


@contextmanager
def _raises(error: type[Exception]) -> Iterator[_Raised]:
    """Fail unless the block raises ``error``, without needing pytest."""
    raised = _Raised()
    try:
        yield raised
    except error as caught:
        raised.error = caught
        return
    raise AssertionError(f"expected {error.__name__}")


class ArtifactStoreBackendConformance:
    """
    The ``ArtifactStoreBackend`` contract (DR-05), as tests to inherit.

    Subclass it in a ``Test...`` class, and give that class or its module an
    ``artifact_store`` fixture that returns a new, empty backend for each
    test; pytest then runs every check below against it. A backend that
    accepts only some identifiers can override ``namespace``,
    ``other_namespace``, ``artifact_id`` and ``other_artifact_id``.

    The checks cover what the protocol promises: content addressing, trees
    that need their blobs, namespaces kept apart and refs that move only by
    compare-and-swap, under concurrent writers too. What a backend does with
    malformed input beyond that is its own to test. For assertion details on
    failure, load this module as a pytest plugin
    (``-p superset_core.artifacts.testing``).
    """

    namespace = "workspace-a"
    other_namespace = "workspace-b"
    artifact_id = "artifact-1"
    other_artifact_id = "artifact-2"

    def _commit(self, store: ArtifactStoreBackend, files: Mapping[str, bytes]) -> str:
        """Store ``files`` as blobs and a tree; return the tree's hash."""
        tree = {
            path: store.put_blob(self.namespace, data) for path, data in files.items()
        }
        return store.put_tree(self.namespace, tree)

    def test_implements_the_protocol(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        assert isinstance(artifact_store, ArtifactStoreBackend)

    def test_blobs_are_content_addressed_and_idempotent(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        blob_hash = artifact_store.put_blob(self.namespace, b"hello")
        assert blob_hash == sha256_hex(b"hello")
        assert artifact_store.put_blob(self.namespace, b"hello") == blob_hash
        assert artifact_store.get_blob(self.namespace, blob_hash) == b"hello"
        assert artifact_store.get_blob(self.namespace, sha256_hex(b"other")) is None

    def test_missing_blobs_lists_what_to_upload(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        stored = artifact_store.put_blob(self.namespace, b"kept")
        absent = sha256_hex(b"new")
        assert artifact_store.missing_blobs(self.namespace, [stored, absent]) == {
            absent
        }
        assert artifact_store.missing_blobs(self.namespace, []) == set()

    def test_put_tree_needs_every_blob(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        stored = artifact_store.put_blob(self.namespace, b"<html></html>")
        absent = sha256_hex(b"console.log(1)")
        with _raises(MissingObjectsError) as raised:
            artifact_store.put_tree(
                self.namespace, {"index.html": stored, "app.js": absent}
            )
        assert isinstance(raised.error, MissingObjectsError)
        assert raised.error.missing == frozenset({absent})

    def test_put_tree_validates_the_tree(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        blob_hash = artifact_store.put_blob(self.namespace, b"x")
        with _raises(InvalidPathError):
            artifact_store.put_tree(self.namespace, {"../x.js": blob_hash})
        with _raises(InvalidPathError):
            artifact_store.put_tree(
                self.namespace, {"src": blob_hash, "src/app.js": blob_hash}
            )

    def test_trees_are_content_addressed_and_copied(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        blob_hash = artifact_store.put_blob(self.namespace, b"<html></html>")
        tree = {"index.html": blob_hash}
        digest = artifact_store.put_tree(self.namespace, tree)
        assert digest == tree_hash(tree)
        assert artifact_store.put_tree(self.namespace, dict(tree)) == digest

        tree["extra.js"] = blob_hash
        fetched = artifact_store.get_tree(self.namespace, digest)
        assert fetched == {"index.html": blob_hash}
        assert fetched is not None
        fetched["other.js"] = blob_hash
        assert artifact_store.get_tree(self.namespace, digest) == {
            "index.html": blob_hash
        }
        assert artifact_store.get_tree(self.namespace, sha256_hex(b"no tree")) is None

    def test_namespaces_keep_objects_apart(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        here, there = self.namespace, self.other_namespace
        blob_hash = artifact_store.put_blob(here, b"secret")
        digest = artifact_store.put_tree(here, {"data.json": blob_hash})
        assert artifact_store.compare_and_set_ref(
            here, self.artifact_id, DRAFT_REF, None, digest
        )

        assert artifact_store.get_blob(there, blob_hash) is None
        assert artifact_store.missing_blobs(there, [blob_hash]) == {blob_hash}
        assert artifact_store.get_tree(there, digest) is None
        assert artifact_store.get_ref(there, self.artifact_id, DRAFT_REF) is None
        with _raises(MissingObjectsError):
            artifact_store.put_tree(there, {"data.json": blob_hash})
        with _raises(MissingObjectsError):
            artifact_store.compare_and_set_ref(
                there, self.artifact_id, DRAFT_REF, None, digest
            )

    def test_compare_and_set_creates_a_ref_only_if_it_is_unset(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        first = self._commit(artifact_store, {"index.html": b"v1"})
        second = self._commit(artifact_store, {"index.html": b"v2"})
        ref = (self.namespace, self.artifact_id, DRAFT_REF)
        assert artifact_store.get_ref(*ref) is None

        assert artifact_store.compare_and_set_ref(*ref, None, first)
        assert not artifact_store.compare_and_set_ref(*ref, None, second)
        assert artifact_store.get_ref(*ref) == first

    def test_a_write_from_a_stale_version_never_wins(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        """Two writers start from one version; only the first moves the ref."""
        ref = (self.namespace, self.artifact_id, DRAFT_REF)
        base = self._commit(artifact_store, {"index.html": b"v5"})
        assert artifact_store.compare_and_set_ref(*ref, None, base)
        first = self._commit(artifact_store, {"index.html": b"v6 by the first"})
        second = self._commit(artifact_store, {"index.html": b"v6 by the second"})

        assert artifact_store.compare_and_set_ref(*ref, base, first)
        assert not artifact_store.compare_and_set_ref(*ref, base, second)
        assert artifact_store.get_ref(*ref) == first

    def test_compare_and_set_needs_a_stored_tree(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        ref = (self.namespace, self.artifact_id, DRAFT_REF)
        with _raises(MissingObjectsError):
            artifact_store.compare_and_set_ref(*ref, None, sha256_hex(b"no tree"))
        assert artifact_store.get_ref(*ref) is None

    def test_refs_are_per_artifact_and_per_ref(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        draft = self._commit(artifact_store, {"index.html": b"draft"})
        published = self._commit(artifact_store, {"index.html": b"published"})
        namespace, artifact_id = self.namespace, self.artifact_id
        assert artifact_store.compare_and_set_ref(
            namespace, artifact_id, DRAFT_REF, None, draft
        )
        assert artifact_store.compare_and_set_ref(
            namespace, artifact_id, PUBLISHED_REF, None, published
        )

        assert artifact_store.get_ref(namespace, artifact_id, DRAFT_REF) == draft
        assert artifact_store.get_ref(namespace, artifact_id, PUBLISHED_REF) == (
            published
        )
        assert (
            artifact_store.get_ref(namespace, self.other_artifact_id, DRAFT_REF) is None
        )

    def test_only_one_of_many_concurrent_writers_wins(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        ref = (self.namespace, self.artifact_id, DRAFT_REF)
        base = self._commit(artifact_store, {"index.html": b"base"})
        assert artifact_store.compare_and_set_ref(*ref, None, base)
        candidates = [
            self._commit(artifact_store, {"index.html": f"writer {index}".encode()})
            for index in range(16)
        ]
        barrier = threading.Barrier(len(candidates))
        results: list[bool] = []
        lock = threading.Lock()

        def write(new: str) -> None:
            barrier.wait()
            moved = artifact_store.compare_and_set_ref(*ref, base, new)
            with lock:
                results.append(moved)

        threads = [threading.Thread(target=write, args=(new,)) for new in candidates]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert results.count(True) == 1
        assert artifact_store.get_ref(*ref) in candidates
