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
    is_ref_name,
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


def _require_ref_name(value: str) -> str:
    if not is_ref_name(value):
        raise ValueError(f"{value!r} is not a ref name (see REF_NAME_PATTERN)")
    return value


class InMemoryArtifactStore:
    """
    An ``ArtifactStoreBackend`` that keeps everything in memory.

    For tests and development: nothing is durable, and it serves one process.
    Each instance is a scope of its own, with its own blobs, trees and refs,
    and one lock makes every operation, compare-and-swap included, atomic
    across threads.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._blobs: dict[str, bytes] = {}
        self._trees: dict[str, dict[str, str]] = {}
        self._refs: dict[tuple[str, str], str] = {}

    def put_blob(self, data: bytes) -> str:
        if not isinstance(data, (bytes, bytearray, memoryview)):
            raise TypeError(f"blob content must be bytes, not {type(data).__name__}")
        content = bytes(data)
        blob_hash = sha256_hex(content)
        with self._lock:
            self._blobs.setdefault(blob_hash, content)
        return blob_hash

    def get_blob(self, blob_hash: str) -> bytes | None:
        _require_hash(blob_hash)
        with self._lock:
            return self._blobs.get(blob_hash)

    def missing_blobs(self, hashes: Iterable[str]) -> set[str]:
        wanted = {_require_hash(blob_hash) for blob_hash in hashes}
        with self._lock:
            return {blob_hash for blob_hash in wanted if blob_hash not in self._blobs}

    def put_tree(self, tree: Mapping[str, str]) -> str:
        snapshot = dict(tree)
        validate_tree(snapshot)
        digest = tree_hash(snapshot)
        with self._lock:
            missing = {
                blob_hash
                for blob_hash in snapshot.values()
                if blob_hash not in self._blobs
            }
            if missing:
                raise MissingObjectsError(missing)
            self._trees.setdefault(digest, snapshot)
        return digest

    def get_tree(self, tree_hash: str) -> dict[str, str] | None:
        _require_hash(tree_hash)
        with self._lock:
            tree = self._trees.get(tree_hash)
            return None if tree is None else dict(tree)

    def get_ref(self, artifact_id: str, ref: str) -> str | None:
        _require_ref_name(ref)
        with self._lock:
            return self._refs.get((artifact_id, ref))

    def compare_and_set_ref(
        self, artifact_id: str, ref: str, expected: str | None, new: str
    ) -> bool:
        _require_ref_name(ref)
        _require_hash(new)
        if expected is not None:
            _require_hash(expected)
        with self._lock:
            if new not in self._trees:
                raise MissingObjectsError([new])
            if self._refs.get((artifact_id, ref)) != expected:
                return False
            self._refs[(artifact_id, ref)] = new
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
    The ``ArtifactStoreBackend`` contract, as tests to inherit.

    Subclass it in a ``Test...`` class, and give that class or its module an
    ``artifact_store`` fixture that returns a new, empty backend for each
    test; pytest then runs every check below against it. A backend that
    accepts only some artifact ids can override ``artifact_id`` and
    ``other_artifact_id``.

    The checks cover what the protocol promises: content addressing, trees
    that need their blobs and refs that move only by compare-and-swap, under
    concurrent writers too. Scoping, such as keeping one tenant's objects
    from another's, is the host's to test, and what a backend does with
    malformed input beyond that is its own. For assertion details on failure,
    load this module as a pytest plugin (``-p superset_core.artifacts.testing``).
    """

    artifact_id = "artifact-1"
    other_artifact_id = "artifact-2"

    def _commit(self, store: ArtifactStoreBackend, files: Mapping[str, bytes]) -> str:
        """Store ``files`` as blobs and a tree; return the tree's hash."""
        tree = {path: store.put_blob(data) for path, data in files.items()}
        return store.put_tree(tree)

    def test_implements_the_protocol(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        assert isinstance(artifact_store, ArtifactStoreBackend)

    def test_blobs_are_content_addressed_and_idempotent(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        blob_hash = artifact_store.put_blob(b"hello")
        assert blob_hash == sha256_hex(b"hello")
        assert artifact_store.put_blob(b"hello") == blob_hash
        assert artifact_store.get_blob(blob_hash) == b"hello"
        assert artifact_store.get_blob(sha256_hex(b"other")) is None

    def test_missing_blobs_lists_what_to_upload(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        stored = artifact_store.put_blob(b"kept")
        absent = sha256_hex(b"new")
        assert artifact_store.missing_blobs([stored, absent]) == {absent}
        assert artifact_store.missing_blobs([]) == set()

    def test_put_tree_needs_every_blob(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        stored = artifact_store.put_blob(b"<html></html>")
        absent = sha256_hex(b"console.log(1)")
        with _raises(MissingObjectsError) as raised:
            artifact_store.put_tree({"index.html": stored, "app.js": absent})
        assert isinstance(raised.error, MissingObjectsError)
        assert raised.error.missing == frozenset({absent})

    def test_put_tree_validates_the_tree(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        blob_hash = artifact_store.put_blob(b"x")
        with _raises(InvalidPathError):
            artifact_store.put_tree({"../x.js": blob_hash})
        with _raises(InvalidPathError):
            artifact_store.put_tree({"src": blob_hash, "src/app.js": blob_hash})

    def test_trees_are_content_addressed_and_copied(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        blob_hash = artifact_store.put_blob(b"<html></html>")
        tree = {"index.html": blob_hash}
        digest = artifact_store.put_tree(tree)
        assert digest == tree_hash(tree)
        assert artifact_store.put_tree(dict(tree)) == digest

        tree["extra.js"] = blob_hash
        fetched = artifact_store.get_tree(digest)
        assert fetched == {"index.html": blob_hash}
        assert fetched is not None
        fetched["other.js"] = blob_hash
        assert artifact_store.get_tree(digest) == {"index.html": blob_hash}
        assert artifact_store.get_tree(sha256_hex(b"no tree")) is None

    def test_compare_and_set_creates_a_ref_only_if_it_is_unset(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        first = self._commit(artifact_store, {"index.html": b"v1"})
        second = self._commit(artifact_store, {"index.html": b"v2"})
        ref = (self.artifact_id, DRAFT_REF)
        assert artifact_store.get_ref(*ref) is None

        assert artifact_store.compare_and_set_ref(*ref, None, first)
        assert not artifact_store.compare_and_set_ref(*ref, None, second)
        assert artifact_store.get_ref(*ref) == first

    def test_a_write_from_a_stale_version_never_wins(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        """Two writers start from one version; only the first moves the ref."""
        ref = (self.artifact_id, DRAFT_REF)
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
        ref = (self.artifact_id, DRAFT_REF)
        with _raises(MissingObjectsError):
            artifact_store.compare_and_set_ref(*ref, None, sha256_hex(b"no tree"))
        assert artifact_store.get_ref(*ref) is None

    def test_refs_are_per_artifact_and_per_ref(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        draft = self._commit(artifact_store, {"index.html": b"draft"})
        published = self._commit(artifact_store, {"index.html": b"published"})
        artifact_id = self.artifact_id
        assert artifact_store.compare_and_set_ref(artifact_id, DRAFT_REF, None, draft)
        assert artifact_store.compare_and_set_ref(
            artifact_id, PUBLISHED_REF, None, published
        )

        assert artifact_store.get_ref(artifact_id, DRAFT_REF) == draft
        assert artifact_store.get_ref(artifact_id, PUBLISHED_REF) == published
        assert artifact_store.get_ref(self.other_artifact_id, DRAFT_REF) is None

    def test_accepts_every_ref_name_the_contract_allows(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        version = self._commit(artifact_store, {"index.html": b"named"})
        for ref in (
            DRAFT_REF,
            PUBLISHED_REF,
            "_meta",
            "_log/draft/0",
            "a/" + "b" * 198,
        ):
            assert artifact_store.compare_and_set_ref(
                self.artifact_id, ref, None, version
            ), ref
            assert artifact_store.get_ref(self.artifact_id, ref) == version, ref

    def test_refuses_ref_names_outside_the_contract(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        version = self._commit(artifact_store, {"index.html": b"refused"})
        for ref in (
            "",
            "_",
            "__meta",
            "Draft",
            "1draft",
            "a//b",
            "a/",
            "/a",
            "a/../b",
            "a/_b",
            "a" * 201,
        ):
            with _raises(ValueError):
                artifact_store.compare_and_set_ref(self.artifact_id, ref, None, version)
            with _raises(ValueError):
                artifact_store.get_ref(self.artifact_id, ref)

    def test_only_one_of_many_concurrent_writers_wins(
        self, artifact_store: ArtifactStoreBackend
    ) -> None:
        ref = (self.artifact_id, DRAFT_REF)
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
