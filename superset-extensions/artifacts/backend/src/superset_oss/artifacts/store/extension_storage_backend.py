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
The default store backend, on Superset's extension storage. A scaffold.

Entries live in the extension's shared persistent storage, under:

- ``artifacts/blob/<sha256>``: a blob, base64 in the JSON codec;
- ``artifacts/tree/<sha256>``: a tree, its path-to-hash mapping;
- ``artifacts/ref/<artifact id>/<ref>``: a ref's record, which holds both the
  version it points to and its history, so that one compare-and-swap moves
  them together;
- ``artifacts/history/<sha256>``: an immutable chunk of a ref's older
  history, which its record names once the record's own entries fill up.

Its scope is the extension's shared storage, so every artifact in one
Superset shares one set of blobs and trees. Reads check content against its
hash, so a blob, tree or history chunk that was changed in storage is refused
rather than served.

It refuses to run until extension storage has what a store needs:

- TODO: extension storage finds the calling extension through a context the
  host sets only while it imports the entry point, so calls made while a REST,
  MCP or task request runs fail until there is a request-time context.
- TODO: the storage REST API lets any caller with the storage permission read
  and write an extension's shared entries, so a direct write could move a ref,
  ``published`` included, past the user's confirmation. The rows must be scoped
  to their resource before this backend holds real artifacts.
- TODO: a ref's record is tagged with its artifact as the resource, so that it
  can be listed, counted against a quota and purged per artifact, once a
  compare-and-swap write takes resource fields. Blobs and trees stay untagged:
  content addressing shares them between artifacts, so purging one artifact
  mustn't remove them.
"""

from __future__ import annotations

import base64
import binascii
import json  # noqa: TID251 -- pure module; the host's JSON utility needs Flask.
from collections.abc import Iterable, Mapping
from typing import Any, TYPE_CHECKING

from superset_artifacts_sdk.store import (
    is_ref_name,
    is_sha256_hex,
    MissingObjectsError,
    RefHistory,
    sha256_hex,
    tree_hash as compute_tree_hash,
    validate_tree,
)

if TYPE_CHECKING:
    # Imported for its type only: the storage package needs Flask to import.
    from superset_core.extensions.storage.persistent import PersistentStateAccessor

KEY_PREFIX = "artifacts"
# A ref's record keeps at most this many of its newest history entries itself.
# Once it holds one more, the oldest this many move into an immutable chunk,
# so that a record stays far below extension storage's value cap (1 MB by
# default) however long the history grows.
HISTORY_CHUNK_SIZE = 1024
# Past this many failed writes, a record that keeps changing under the same
# version is a fault, not contention.
_CAS_ATTEMPTS = 16


class BackendUnavailableError(RuntimeError):
    """Extension storage can't back the artifact store yet; see the module notes."""


class CorruptObjectError(RuntimeError):
    """A stored object or ref record isn't what its key says it is."""


def _require_hash(value: str) -> str:
    if not is_sha256_hex(value):
        raise ValueError(f"{value!r} is not a SHA-256 (64 lowercase hex digits)")
    return value


def _require_ref_name(value: str) -> str:
    if not is_ref_name(value):
        raise ValueError(f"{value!r} is not a ref name (see REF_NAME_PATTERN)")
    return value


def _chunk_hash(versions: list[str]) -> str:
    return sha256_hex(json.dumps(versions, separators=(",", ":")).encode("ascii"))


class ExtensionStorageBackend:
    """An ``ArtifactStoreBackend`` on extension storage; see the module notes."""

    def __init__(
        self,
        storage: PersistentStateAccessor,
        *,
        history_chunk_size: int = HISTORY_CHUNK_SIZE,
    ) -> None:
        self._storage = storage
        self._chunk_size = history_chunk_size

    @classmethod
    def from_extension_context(cls) -> ExtensionStorageBackend:
        """The backend on this extension's shared persistent storage."""
        from superset_core.extensions.context import get_context

        try:
            # The context's storage protocol doesn't declare the ``shared``
            # accessor that the host's persistent state has.
            persistent: Any = get_context().storage.persistent
            storage = persistent.shared
        except (LookupError, NotImplementedError, RuntimeError) as ex:
            raise BackendUnavailableError(
                "extension storage isn't reachable while a request runs: the "
                "host sets the extension's context only while it loads"
            ) from ex
        return cls(storage)

    @staticmethod
    def _key(*parts: str) -> str:
        return "/".join((KEY_PREFIX, *parts))

    # -- Content -------------------------------------------------------------

    def put_blob(self, data: bytes) -> str:
        content = bytes(data)
        blob_hash = sha256_hex(content)
        key = self._key("blob", blob_hash)
        if self._storage.get(key) is None:
            self._storage.set(key, base64.b64encode(content).decode("ascii"))
        return blob_hash

    def get_blob(self, blob_hash: str) -> bytes | None:
        key = self._key("blob", _require_hash(blob_hash))
        stored = self._storage.get(key)
        if stored is None:
            return None
        try:
            content = base64.b64decode(stored, validate=True)
        except (binascii.Error, TypeError, ValueError) as ex:
            raise CorruptObjectError(f"blob {blob_hash} is not base64") from ex
        if sha256_hex(content) != blob_hash:
            raise CorruptObjectError(f"blob {blob_hash} doesn't match its hash")
        return content

    def missing_blobs(self, hashes: Iterable[str]) -> set[str]:
        wanted = {_require_hash(blob_hash) for blob_hash in hashes}
        return {
            blob_hash
            for blob_hash in wanted
            if self._storage.get(self._key("blob", blob_hash)) is None
        }

    def put_tree(self, tree: Mapping[str, str]) -> str:
        snapshot = dict(tree)
        validate_tree(snapshot)
        if missing := self.missing_blobs(snapshot.values()):
            raise MissingObjectsError(missing)
        digest = compute_tree_hash(snapshot)
        key = self._key("tree", digest)
        if self._storage.get(key) is None:
            self._storage.set(key, snapshot)
        return digest

    def get_tree(self, tree_hash: str) -> dict[str, str] | None:
        key = self._key("tree", _require_hash(tree_hash))
        stored = self._storage.get(key)
        if stored is None:
            return None
        if not isinstance(stored, dict) or compute_tree_hash(stored) != tree_hash:
            raise CorruptObjectError(f"tree {tree_hash} doesn't match its hash")
        return dict(stored)

    # -- Refs and their history ----------------------------------------------

    def get_ref(self, artifact_id: str, ref: str) -> str | None:
        record = self._record(artifact_id, ref)
        return record["target"] if record else None

    def compare_and_set_ref(
        self, artifact_id: str, ref: str, expected: str | None, new: str
    ) -> bool:
        _require_ref_name(ref)
        _require_hash(new)
        if expected is not None:
            _require_hash(expected)
        if self._storage.get(self._key("tree", new)) is None:
            raise MissingObjectsError([new])
        key = self._key("ref", artifact_id, ref)
        for _attempt in range(_CAS_ATTEMPTS):
            record = self._record(artifact_id, ref)
            if (record["target"] if record else None) != expected:
                return False
            if new == expected:
                return True
            # Every write changes the target, so a refused write means that
            # another writer moved the ref; the next read answers it.
            if self._storage.compare_and_set(key, record, self._moved(record, new)):
                return True
        raise RuntimeError(f"{ref} of {artifact_id} keeps changing under {expected}")

    def ref_history(
        self, artifact_id: str, ref: str, *, offset: int = 0, limit: int = 100
    ) -> RefHistory:
        record = self._record(artifact_id, ref)
        if record is None:
            return RefHistory(versions=(), total=0)
        total = record["total"]
        # Entries count from the oldest, 0; the page runs newest first.
        stop = max(0, total - offset)
        start = max(0, stop - limit)
        chunks: dict[int, list[str]] = {}
        versions = []
        for index in range(stop - 1, start - 1, -1):
            chunk, position = divmod(index, self._chunk_size)
            if chunk < len(record["chunks"]):
                if chunk not in chunks:
                    chunks[chunk] = self._chunk(record["chunks"][chunk])
                versions.append(chunks[chunk][position])
            else:
                versions.append(
                    record["recent"][index - len(record["chunks"]) * self._chunk_size]
                )
        return RefHistory(versions=tuple(versions), total=total)

    def ref_has_held(self, artifact_id: str, ref: str, version: str) -> bool:
        _require_hash(version)
        record = self._record(artifact_id, ref)
        if record is None:
            return False
        if version in record["recent"]:
            return True
        return any(
            version in self._chunk(chunk_hash)
            for chunk_hash in reversed(record["chunks"])
        )

    def _record(self, artifact_id: str, ref: str) -> dict[str, Any] | None:
        """A ref's record: its target, history size, newest entries and chunks."""
        key = self._key("ref", artifact_id, _require_ref_name(ref))
        record = self._storage.get(key)
        if record is None:
            return None
        if not (
            isinstance(record, dict)
            and isinstance(record.get("target"), str)
            and isinstance(record.get("total"), int)
            and isinstance(record.get("recent"), list)
            and isinstance(record.get("chunks"), list)
            and record["total"]
            == len(record["recent"]) + len(record["chunks"]) * self._chunk_size
        ):
            raise CorruptObjectError(f"the record of {key} is malformed")
        return record

    def _moved(self, record: dict[str, Any] | None, new: str) -> dict[str, Any]:
        """``record`` once its ref points at ``new``, which its history gains."""
        recent = [*(record["recent"] if record else ()), new]
        chunks = list(record["chunks"]) if record else []
        if len(recent) > self._chunk_size:
            full, recent = recent[: self._chunk_size], recent[self._chunk_size :]
            chunks.append(self._put_chunk(full))
        return {
            "target": new,
            "total": (record["total"] if record else 0) + 1,
            "recent": recent,
            "chunks": chunks,
        }

    def _put_chunk(self, versions: list[str]) -> str:
        # Written before the record that names it: a record never names a
        # chunk that isn't stored, and a lost race leaves only an unused one.
        digest = _chunk_hash(versions)
        key = self._key("history", digest)
        if self._storage.get(key) is None:
            self._storage.set(key, versions)
        return digest

    def _chunk(self, chunk_hash: str) -> list[str]:
        stored = self._storage.get(self._key("history", _require_hash(chunk_hash)))
        if (
            not isinstance(stored, list)
            or len(stored) != self._chunk_size
            or _chunk_hash(stored) != chunk_hash
        ):
            raise CorruptObjectError(
                f"history chunk {chunk_hash} is missing or changed"
            )
        return stored
