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

- ``artifacts/<namespace>/blob/<sha256>``: a blob, base64 in the JSON codec;
- ``artifacts/<namespace>/tree/<sha256>``: a tree, its path-to-hash mapping;
- ``artifacts/<namespace>/ref/<artifact id>/<ref>``: a ref, its tree hash.

Reads check content against its hash, so a blob or tree that was changed in
storage is refused rather than served.

It refuses to run until extension storage has what a store needs:

- TODO: refs need an atomic compare-and-swap write. Extension storage only has
  get and set, and a get-then-set would let two writers that read the same
  version both win. ``AtomicStorageAccessor.compare_and_set`` is the shape this
  backend expects extension storage to add; without it
  ``from_extension_context`` refuses.
- TODO: the storage REST API lets any caller with the storage permission read
  and write an extension's shared entries, so a direct write could move a ref,
  ``published`` included, past the user's confirmation. The rows must be scoped
  to their resource before this backend holds real artifacts.
- TODO: refs are tagged with their artifact as the resource
  (``resource_type="artifact"``, ``resource_uuid=<id>``) through the same
  compare-and-swap write, so that they can be listed, counted against a quota
  and purged per artifact; ``PersistentSetOptions`` has no resource fields.
  Blobs and trees stay untagged: content addressing shares them between the
  artifacts of a namespace, which a per-namespace purge would remove.
- TODO: extension storage finds the calling extension through a context the
  host sets only while it imports the entry point, so calls made while a REST,
  MCP or task request runs fail until there is a request-time context.
"""

from __future__ import annotations

import base64
import binascii
from collections.abc import Iterable, Mapping
from typing import Any, Protocol, runtime_checkable

from superset_core.artifacts.store import (
    is_sha256_hex,
    MissingObjectsError,
    sha256_hex,
    tree_hash as compute_tree_hash,
    validate_tree,
)

KEY_PREFIX = "artifacts"
RESOURCE_TYPE = "artifact"


class BackendUnavailableError(RuntimeError):
    """Extension storage can't back the artifact store yet; see the module notes."""


class CorruptObjectError(RuntimeError):
    """A stored blob or tree doesn't match the hash it is stored under."""


@runtime_checkable
class AtomicStorageAccessor(Protocol):
    """
    ``PersistentStateAccessor`` with the atomic write a ref needs.

    ``compare_and_set`` stores ``new`` under ``key`` only if the stored value
    equals ``expected`` (``None`` meaning no entry), and says whether it did,
    in one atomic step. It tags the entry with a resource when given one.
    """

    def get(self, key: str) -> Any: ...

    def set(self, key: str, value: Any, options: Any = None) -> None: ...

    def compare_and_set(
        self,
        key: str,
        expected: Any,
        new: Any,
        *,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> bool: ...


def _require_hash(value: str) -> str:
    if not is_sha256_hex(value):
        raise ValueError(f"{value!r} is not a SHA-256 (64 lowercase hex digits)")
    return value


class ExtensionStorageBackend:
    """An ``ArtifactStoreBackend`` on extension storage; see the module notes."""

    def __init__(self, storage: AtomicStorageAccessor) -> None:
        if not isinstance(storage, AtomicStorageAccessor):
            raise BackendUnavailableError(
                "extension storage has no atomic compare-and-swap write, "
                "which the artifact store's refs need"
            )
        self._storage = storage

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
    def _key(namespace: str, *parts: str) -> str:
        return "/".join((KEY_PREFIX, namespace, *parts))

    def put_blob(self, namespace: str, data: bytes) -> str:
        content = bytes(data)
        blob_hash = sha256_hex(content)
        key = self._key(namespace, "blob", blob_hash)
        if self._storage.get(key) is None:
            self._storage.set(key, base64.b64encode(content).decode("ascii"))
        return blob_hash

    def get_blob(self, namespace: str, blob_hash: str) -> bytes | None:
        key = self._key(namespace, "blob", _require_hash(blob_hash))
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

    def missing_blobs(self, namespace: str, hashes: Iterable[str]) -> set[str]:
        wanted = {_require_hash(blob_hash) for blob_hash in hashes}
        return {
            blob_hash
            for blob_hash in wanted
            if self._storage.get(self._key(namespace, "blob", blob_hash)) is None
        }

    def put_tree(self, namespace: str, tree: Mapping[str, str]) -> str:
        snapshot = dict(tree)
        validate_tree(snapshot)
        if missing := self.missing_blobs(namespace, snapshot.values()):
            raise MissingObjectsError(missing)
        digest = compute_tree_hash(snapshot)
        key = self._key(namespace, "tree", digest)
        if self._storage.get(key) is None:
            self._storage.set(key, snapshot)
        return digest

    def get_tree(self, namespace: str, tree_hash: str) -> dict[str, str] | None:
        key = self._key(namespace, "tree", _require_hash(tree_hash))
        stored = self._storage.get(key)
        if stored is None:
            return None
        if not isinstance(stored, dict) or compute_tree_hash(stored) != tree_hash:
            raise CorruptObjectError(f"tree {tree_hash} doesn't match its hash")
        return dict(stored)

    def get_ref(self, namespace: str, artifact_id: str, ref: str) -> str | None:
        stored = self._storage.get(self._key(namespace, "ref", artifact_id, ref))
        return stored if isinstance(stored, str) else None

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
        if self._storage.get(self._key(namespace, "tree", new)) is None:
            raise MissingObjectsError([new])
        return self._storage.compare_and_set(
            self._key(namespace, "ref", artifact_id, ref),
            expected,
            new,
            resource_type=RESOURCE_TYPE,
            resource_uuid=artifact_id,
        )
