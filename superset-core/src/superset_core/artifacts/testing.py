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

"""Test and development helpers for the artifacts contracts."""

from __future__ import annotations

import threading
from collections.abc import Iterable, Mapping

from superset_core.artifacts.store import (
    is_sha256_hex,
    MissingObjectsError,
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
