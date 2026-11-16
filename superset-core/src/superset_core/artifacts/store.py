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
The artifact file store contract: content-addressed blobs, trees and refs.

An artifact is a tree of files with versions, shaped like git:

- each file's content is a **blob**, stored once under its SHA-256;
- each **version** is a tree, a mapping from file path to blob hash, stored
  under the SHA-256 of its canonical JSON (``tree_hash``), so a version's id is
  its tree hash;
- the ``draft`` and ``published`` **refs** point to trees, and move only by
  compare-and-swap: a write that names a stale version never wins.

This module holds the pure helpers every backend shares and the backend
protocol. ``superset_core.artifacts.testing`` has an in-memory backend.
"""

from __future__ import annotations

import hashlib
import json  # noqa: TID251 -- SDK cannot depend on the host JSON utility.
import re
import unicodedata
from collections.abc import Iterable, Mapping
from typing import Protocol, runtime_checkable

DRAFT_REF = "draft"
PUBLISHED_REF = "published"

MAX_PATH_LENGTH = 255

# The one form of a hash in the store, for blobs and trees (and so versions):
# a SHA-256 digest as 64 lowercase hex digits. Anchored, so that schemas can
# use it as a JSON Schema ``pattern`` too.
SHA256_HEX_PATTERN = r"^[0-9a-f]{64}$"

# The one form of a ref name, for every backend, shaped like a git ref: one or
# more segments joined by ``/``, at most ``MAX_REF_NAME_LENGTH`` characters in
# all. The first segment starts with a lowercase letter, optionally after a
# leading ``_``; each later segment starts with a lowercase letter or digit, so
# a version hash can be one. Segments hold lowercase letters, digits, ``_`` and
# ``-`` only, so ``.``, ``..`` and empty segments can't occur. A leading ``_``
# marks a ref that the store's user keeps for its own records, such as an
# artifact's owners or its history, rather than a version that frames load.
MAX_REF_NAME_LENGTH = 200
REF_NAME_PATTERN = (
    rf"^(?=.{{1,{MAX_REF_NAME_LENGTH}}}$)_?[a-z][a-z0-9_-]*(?:/[a-z0-9][a-z0-9_-]*)*$"
)

_SHA256_HEX = re.compile(SHA256_HEX_PATTERN)
_REF_NAME = re.compile(REF_NAME_PATTERN)
# C0 controls (NUL included), DEL and C1 controls.
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f-\x9f]")


class InvalidPathError(ValueError):
    """A file path that isn't a safe, relative path in an artifact's tree."""


class MissingObjectsError(LookupError):
    """A tree or ref names blobs or trees that the store doesn't hold."""

    def __init__(self, missing: Iterable[str]) -> None:
        self.missing: frozenset[str] = frozenset(missing)
        super().__init__(f"missing objects: {', '.join(sorted(self.missing))}")


def sha256_hex(data: bytes) -> str:
    """Return the SHA-256 of ``data`` as 64 lowercase hex digits."""
    return hashlib.sha256(data).hexdigest()


def is_sha256_hex(value: object) -> bool:
    """Whether ``value`` is a SHA-256 in the store's form: 64 lowercase hex digits."""
    return isinstance(value, str) and _SHA256_HEX.fullmatch(value) is not None


def is_ref_name(value: object) -> bool:
    """Whether ``value`` is a ref name every backend accepts (``REF_NAME_PATTERN``)."""
    return isinstance(value, str) and _REF_NAME.fullmatch(value) is not None


def normalize_path(path: str) -> str:
    """
    Return ``path`` in the canonical form that trees store.

    A path is relative, with ``/`` between segments. Empty and ``.`` segments
    are dropped (``./src//app.js`` becomes ``src/app.js``) and the result is
    NFC-normalized, so one file can't hide under two spellings.

    Raises ``InvalidPathError`` for an empty path, an absolute path, a ``..``
    segment, a backslash, NUL or any other control character, and a path
    longer than ``MAX_PATH_LENGTH`` characters.
    """
    if not isinstance(path, str):
        raise InvalidPathError("path must be a string")
    if not path:
        raise InvalidPathError("path is empty")
    if "\\" in path:
        raise InvalidPathError(f"path {path!r} contains a backslash; use '/'")
    if _CONTROL_CHARACTERS.search(path):
        raise InvalidPathError(f"path {path!r} contains a control character")
    if path.startswith("/"):
        raise InvalidPathError(f"path {path!r} is absolute; use a relative path")
    segments = [
        segment
        for segment in unicodedata.normalize("NFC", path).split("/")
        if segment not in ("", ".")
    ]
    if ".." in segments:
        raise InvalidPathError(f"path {path!r} contains a '..' segment")
    normalized = "/".join(segments)
    if not normalized:
        raise InvalidPathError(f"path {path!r} names no file")
    if len(normalized) > MAX_PATH_LENGTH:
        raise InvalidPathError(
            f"path is {len(normalized)} characters long; the limit is {MAX_PATH_LENGTH}"
        )
    return normalized


def tree_hash(tree: Mapping[str, str]) -> str:
    """
    Return the SHA-256 of ``tree``'s canonical JSON: the version's id.

    The canonical form is a JSON object with keys sorted by code point, no
    whitespace, non-ASCII characters kept as they are, encoded as UTF-8. This
    function hashes; it doesn't validate (see ``validate_tree``).
    """
    canonical = json.dumps(
        dict(tree), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    return sha256_hex(canonical.encode("utf-8"))


def validate_tree(tree: Mapping[str, str]) -> None:
    """
    Check that ``tree`` is a valid version: raise if it isn't.

    Every path must already be in normalized form (``normalize_path``), every
    value must be a blob hash, and no path may be both a file and a directory
    (``src`` and ``src/app.js`` can't both be files), so that a tree always
    maps onto a directory of files. Paths are case-sensitive: ``App.js`` and
    ``app.js`` are two files, which a case-insensitive file system (the
    default on macOS and Windows) can't hold side by side.

    Raises ``InvalidPathError`` for a path problem and ``ValueError`` for a
    malformed hash.
    """
    for path, blob_hash in tree.items():
        normalized = normalize_path(path)
        if normalized != path:
            raise InvalidPathError(
                f"path {path!r} is not normalized; use {normalized!r}"
            )
        if not is_sha256_hex(blob_hash):
            raise ValueError(f"path {path!r} has a malformed blob hash")
    for path in tree:
        segments = path.split("/")
        for depth in range(1, len(segments)):
            directory = "/".join(segments[:depth])
            if directory in tree:
                raise InvalidPathError(
                    f"{directory!r} is a file, so it can't also hold {path!r}"
                )


@runtime_checkable
class ArtifactStoreBackend(Protocol):
    """
    Where an artifact's blobs, trees and refs live.

    Hashes are SHA-256 digests as 64 lowercase hex digits; a backend may raise
    ``ValueError`` for anything else.

    A backend instance is scoped by its host already, for example to one
    tenant, so callers never choose a scope: every call reads and writes the
    objects of that scope only, and content addressing deduplicates within
    it. Keeping scopes apart, and choosing the scope for a call, are the
    host's.

    The default backend runs on Superset's extension storage once that storage
    gains compare-and-swap writes and quotas; a provider can supply its own
    backend instead (``ArtifactStoreSource.store_backend``).
    """

    # TODO: history and restore need each ref's past positions (a ref log, or
    # commit objects with parents); this protocol has no way to read them.
    # TODO: deletion (retention, GDPR erasure).
    # TODO: per-resource quotas.

    def put_blob(self, data: bytes) -> str:
        """
        Store ``data`` and return its hash.

        Idempotent: storing the same content again returns the same hash.
        """
        ...

    def get_blob(self, blob_hash: str) -> bytes | None:
        """Return the content stored under ``blob_hash``, or ``None``."""
        ...

    def missing_blobs(self, hashes: Iterable[str]) -> set[str]:
        """
        Return the subset of ``hashes`` that this backend doesn't hold.

        Agents with a disk commit by hash (``artifact_commit_files``): they
        send every path's hash, and upload only the blobs this returns.
        """
        ...

    def put_tree(self, tree: Mapping[str, str]) -> str:
        """
        Store a version's tree (file path to blob hash) and return its hash.

        The tree must pass ``validate_tree`` and every blob it names must be
        stored already; otherwise this raises ``InvalidPathError``,
        ``ValueError`` or ``MissingObjectsError``. Idempotent.
        """
        ...

    def get_tree(self, tree_hash: str) -> dict[str, str] | None:
        """
        Return the tree stored under ``tree_hash``, or ``None``.

        The result is a copy: changing it doesn't change the store.
        """
        ...

    def get_ref(self, artifact_id: str, ref: str) -> str | None:
        """
        Return the tree hash that ``ref`` points to, or ``None`` if unset.

        Every backend accepts exactly the ref names that ``is_ref_name``
        accepts, and raises ``ValueError`` for any other.
        """
        ...

    def compare_and_set_ref(
        self, artifact_id: str, ref: str, expected: str | None, new: str
    ) -> bool:
        """
        Point ``ref`` at ``new`` if it points at ``expected``; return whether it moved.

        ``expected=None`` means the ref must not exist yet, so the first write
        creates it. The check and the move are one atomic step: of two writers
        that read the same version, only one moves the ref. ``new`` must be a
        stored tree, otherwise this raises ``MissingObjectsError``. A ref name
        that ``is_ref_name`` refuses raises ``ValueError``.
        """
        ...
