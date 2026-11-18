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
The artifact file store: a git-shaped virtual file system.

It runs over any ``ArtifactStoreBackend``. Agents edit with the primitives of
Anthropic's text-editor and memory tools, which models already know; every
write names the draft version it starts from and moves the draft by
compare-and-swap; and publishing waits for the user's confirmation.

A write whose base is no longer the draft is rebased when it can be: when the
files it changes and the files changed since its base don't overlap, its
changes apply to the current draft. Otherwise it fails with
``STALE_BASE_VERSION`` and changes nothing.

What it keeps in the backend, for each artifact:

- ``draft``: the current draft's tree, and the authoritative version. Writes
  move it by compare-and-swap.
- ``published``: the published tree. Only ``confirm_publish`` moves it.
- ``_meta`` and ``_publish``: one-file trees holding the artifact's record
  (its owners) and its latest publish request.

The backend keeps each ref's history with it, moved in the same atomic step,
so the versions a ref has pointed to are the backend's to answer.

The module is pure Python, without Flask or Superset: callers pass the acting
user as ``actor`` and decide who that is.
"""

# TODO: owners stand in for the editors and viewers that each artifact gets
# once it is a persisted widget.
# TODO: per-artifact quotas, beyond the policy's limits on files.
# TODO: garbage collection of blobs and trees no version holds, retention,
# and GDPR erasure.
# TODO: a retry-safe operation id on every write, and limits on how many pages
# a result may have.

from __future__ import annotations

import json  # noqa: TID251 -- pure module; the host's JSON utility needs Flask.
import math
import uuid
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, TypeVar

from superset_artifacts_sdk.authoring import (
    ArtifactCommitFilesRequest,
    ArtifactCommitFilesResponse,
    ArtifactCreateFileRequest,
    ArtifactCreateRequest,
    ArtifactCreateResponse,
    ArtifactDeleteFileRequest,
    ArtifactHistoryRequest,
    ArtifactInsertRequest,
    ArtifactManifestGetRequest,
    ArtifactManifestUpdateRequest,
    ArtifactMoveFileRequest,
    ArtifactRequestPublishRequest,
    ArtifactRestoreRequest,
    ArtifactSearchRequest,
    ArtifactStrReplaceRequest,
    ArtifactViewRequest,
    ArtifactWriteRequest,
    ArtifactWriteResponse,
    AuthoringErrorCode,
    ROOT_PATH,
)
from superset_artifacts_sdk.manifest import (
    ArtifactManifest,
    MANIFEST_FILE,
    MANIFEST_VERSION,
)
from superset_artifacts_sdk.policy import ArtifactPolicy, LOCKED, manifest_problems
from superset_artifacts_sdk.store import (
    ArtifactStoreBackend,
    DRAFT_REF,
    InvalidPathError,
    MissingObjectsError,
    PUBLISHED_REF,
    sha256_hex,
    validate_tree,
)
from superset_oss.artifacts.errors import (
    ArtifactError,
    ExtensionErrorCode,
    translate_invalid_manifest,
)

# At most this many UTF-8 bytes of content in one page of ``view`` or
# ``search``, comfortably under the MCP read tools' 50 KB limit.
PAGE_BYTES = 40_000
HISTORY_PAGE_SIZE = 100
# The most content one ``put_blobs`` call takes.
MAX_UPLOAD_BYTES = 8_000_000
# A search match's line is cut to this many characters.
MAX_MATCH_CHARS = 500
PUBLISH_REQUEST_TTL = timedelta(hours=24)

_META_REF = "_meta"
_PUBLISH_REF = "_publish"
_RECORD_FILE = "record.json"
# How often a compare-and-swap loop retries under contention before giving up.
_CAS_ATTEMPTS = 16

_T = TypeVar("_T")


@dataclass(frozen=True)
class FileView:
    """One page of ``artifact_view``: a file's numbered lines, or a listing."""

    path: str
    kind: Literal["file", "directory"]
    content: str
    page: int
    pages: int
    # The draft version that was read: the next write's ``base_version``.
    version: str


@dataclass(frozen=True)
class SearchMatch:
    """A line that holds the query: its file, its number and its text."""

    path: str
    line: int
    text: str


@dataclass(frozen=True)
class SearchResult:
    """One page of ``artifact_search``'s matches."""

    query: str
    matches: tuple[SearchMatch, ...]
    page: int
    pages: int
    version: str


@dataclass(frozen=True)
class HistoryPage:
    """One page of the versions a ref has pointed to, newest first."""

    ref: str
    versions: tuple[str, ...]
    page: int
    pages: int


@dataclass(frozen=True)
class PublishRequest:
    """A request to publish one version, which waits for the user."""

    request_id: str
    artifact_id: str
    version: str
    requested_by: str
    requested_at: datetime
    expires_at: datetime
    status: Literal["pending", "confirmed"] = "pending"
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None

    def summary(self) -> dict[str, str]:
        """What a host shows of the request while it waits for the user."""
        return {
            "request_id": self.request_id,
            "version": self.version,
            "requested_at": self.requested_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
        }


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _canonical_json(value: Any) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def _encode(text: str, what: str) -> bytes:
    try:
        return text.encode("utf-8")
    except UnicodeEncodeError as ex:
        raise ArtifactError(
            AuthoringErrorCode.INVALID_ARGUMENT,
            f"{what} isn't valid Unicode text (it holds a lone surrogate)",
        ) from ex


def _char_size(char: str) -> int:
    """UTF-8 length of one character of already-valid text."""
    point = ord(char)
    if point < 0x80:
        return 1
    if point < 0x800:
        return 2
    return 3 if point < 0x10000 else 4


def _text_size(text: str) -> int:
    return sum(_char_size(char) for char in text)


def _split_lines(text: str) -> list[str]:
    """``text``'s lines, split on ``\\n`` and keeping it; the last may lack one."""
    parts = text.split("\n")
    lines = [part + "\n" for part in parts[:-1]]
    if parts[-1]:
        lines.append(parts[-1])
    return lines


def _line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def _pages(
    items: Sequence[_T], size_of: Callable[[_T], int], budget: int
) -> list[list[_T]]:
    """``items`` in pages of at most ``budget``; an oversized item fills one."""
    pages: list[list[_T]] = [[]]
    size = 0
    for item in items:
        item_size = size_of(item)
        if pages[-1] and size + item_size > budget:
            pages.append([])
            size = 0
        pages[-1].append(item)
        size += item_size
    return pages


def _chunks(text: str, budget: int) -> list[str]:
    """``text`` cut into pieces of at most ``budget`` UTF-8 bytes."""
    if _text_size(text) <= budget:
        return [text]
    chunks: list[str] = []
    current: list[str] = []
    size = 0
    for char in text:
        char_size = _char_size(char)
        if current and size + char_size > budget:
            chunks.append("".join(current))
            current, size = [], 0
        current.append(char)
        size += char_size
    if current:
        chunks.append("".join(current))
    return chunks


def _paginate_text(pieces: Iterable[str], budget: int = PAGE_BYTES) -> list[str]:
    """``pieces`` joined into pages of at most ``budget`` bytes."""
    chunks = [chunk for piece in pieces for chunk in _chunks(piece, budget)]
    return ["".join(page) for page in _pages(chunks, _text_size, budget)]


def _page_number(page: int | None, pages: int) -> int:
    """The page asked for, counting from 1; ``INVALID_ARGUMENT`` past the last."""
    number = page or 1
    if number > pages:
        raise ArtifactError(
            AuthoringErrorCode.INVALID_ARGUMENT,
            f"page {number} is past the last page, {pages}",
        )
    return number


def _pick_page(pages: Sequence[_T], page: int | None) -> tuple[int, _T]:
    number = _page_number(page, len(pages))
    return number, pages[number - 1]


def _text_of(data: bytes) -> str | None:
    """``data`` as text, or ``None`` when it isn't UTF-8 (a binary file)."""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def _is_directory(tree: Mapping[str, str], path: str) -> bool:
    prefix = f"{path}/"
    return any(candidate.startswith(prefix) for candidate in tree)


def _manifest_text(manifest: ArtifactManifest) -> str:
    return manifest.model_dump_json(indent=2, exclude_none=True) + "\n"


def _changed_paths(before: Mapping[str, str], after: Mapping[str, str]) -> set[str]:
    """The paths whose file was added, removed or changed from ``before``."""
    return {
        path
        for path in before.keys() | after.keys()
        if before.get(path) != after.get(path)
    }


def _rebased(
    base: Mapping[str, str], mine: Mapping[str, str], current: Mapping[str, str]
) -> dict[str, str] | None:
    """
    ``mine``'s changes from ``base``, applied to ``current``; ``None`` when a
    file changed on both sides, or when the result isn't a valid tree.
    """
    changed = _changed_paths(base, mine)
    if changed & _changed_paths(base, current):
        return None
    rebased = {path: blob for path, blob in current.items() if path not in changed}
    rebased.update({path: mine[path] for path in changed if path in mine})
    try:
        validate_tree(rebased)
    except InvalidPathError:
        # Disjoint paths can still clash, as a file and a directory.
        return None
    return rebased


def _publish_record(publish: PublishRequest) -> dict[str, Any]:
    return {
        "request_id": publish.request_id,
        "version": publish.version,
        "requested_by": publish.requested_by,
        "requested_at": publish.requested_at.isoformat(),
        "expires_at": publish.expires_at.isoformat(),
        "status": publish.status,
        "confirmed_by": publish.confirmed_by,
        "confirmed_at": (
            publish.confirmed_at.isoformat() if publish.confirmed_at else None
        ),
    }


def _publish_from_record(artifact_id: str, record: Mapping[str, Any]) -> PublishRequest:
    confirmed_at = record.get("confirmed_at")
    return PublishRequest(
        request_id=record["request_id"],
        artifact_id=artifact_id,
        version=record["version"],
        requested_by=record["requested_by"],
        requested_at=datetime.fromisoformat(record["requested_at"]),
        expires_at=datetime.fromisoformat(record["expires_at"]),
        status=record["status"],
        confirmed_by=record.get("confirmed_by"),
        confirmed_at=datetime.fromisoformat(confirmed_at) if confirmed_at else None,
    )


class ArtifactFileStore:
    """
    Artifacts as trees of files with versions, for the authoring tools.

    Every method that takes an ``actor`` checks that the actor owns the
    artifact, and answers ``ARTIFACT_NOT_FOUND`` otherwise, the same as for an
    artifact that doesn't exist. Failures raise ``ArtifactError`` and
    change nothing; blobs a failed write stored stay behind until garbage
    collection.
    """

    def __init__(
        self,
        backend: ArtifactStoreBackend,
        *,
        policy: ArtifactPolicy = LOCKED,
        clock: Callable[[], datetime] = _utcnow,
        new_id: Callable[[], str] = _new_uuid,
    ) -> None:
        self._backend = backend
        self._policy = policy
        self._now = clock
        self._new_id = new_id

    # -- Authoring -----------------------------------------------------------

    def create(
        self, actor: str, request: ArtifactCreateRequest
    ) -> ArtifactCreateResponse:
        """Start an artifact owned by ``actor``, from ``request.files``."""
        self._require_actor(actor)
        files = dict(request.files)
        if MANIFEST_FILE not in files:
            files[MANIFEST_FILE] = _manifest_text(
                ArtifactManifest.model_validate(
                    {"artifact_version": MANIFEST_VERSION, "title": request.title}
                )
            )
        self._check_file_count(files)
        contents = {path: self._file_bytes(path, text) for path, text in files.items()}
        self._check_policy(self._parse_manifest(contents[MANIFEST_FILE]))
        # Check the whole tree before storing anything, so a rejected create
        # leaves nothing behind.
        planned = {path: sha256_hex(data) for path, data in contents.items()}
        try:
            validate_tree(planned)
        except InvalidPathError as ex:
            raise ArtifactError(AuthoringErrorCode.INVALID_PATH, str(ex)) from ex
        for data in contents.values():
            self._backend.put_blob(data)
        version = self._put_tree(planned)
        artifact_id = self._new_id()
        meta = {
            "owners": [actor],
            "created_by": actor,
            "created_at": self._now().isoformat(),
        }
        if not self._write_record(artifact_id, _META_REF, None, meta):
            raise RuntimeError(f"artifact id {artifact_id} is taken")
        if not self._backend.compare_and_set_ref(artifact_id, DRAFT_REF, None, version):
            raise RuntimeError(f"artifact {artifact_id} has a draft already")
        return ArtifactCreateResponse(artifact_id=artifact_id, version=version)

    def view(self, actor: str, request: ArtifactViewRequest) -> FileView:
        """A page of a draft file's numbered lines, or of a directory's files."""
        artifact_id = self._authorize(actor, request.artifact_id)
        version, tree = self._draft(artifact_id)
        path = request.path
        if path == ROOT_PATH or _is_directory(tree, path):
            if request.view_range is not None:
                raise ArtifactError(
                    AuthoringErrorCode.INVALID_ARGUMENT,
                    f"{path!r} is a directory; view_range applies to files",
                )
            prefix = "" if path == ROOT_PATH else f"{path}/"
            listing = [f"{name}\n" for name in sorted(tree) if name.startswith(prefix)]
            return self._view_page(path, "directory", listing, request.page, version)
        blob_hash = tree.get(path)
        if blob_hash is None:
            raise self._file_not_found(path)
        data = self._blob(blob_hash)
        text = _text_of(data)
        if text is None:
            if request.view_range is not None:
                raise ArtifactError(
                    AuthoringErrorCode.INVALID_ARGUMENT,
                    f"{path!r} is a binary file; view_range applies to text",
                )
            return self._view_page(
                path,
                "file",
                [f"(binary file, {len(data)} bytes)\n"],
                request.page,
                version,
            )
        lines = _split_lines(text)
        start, end = 1, len(lines)
        if request.view_range is not None:
            start, end = request.view_range
            end = len(lines) if end == -1 else end
            if start > len(lines) or end > len(lines):
                raise ArtifactError(
                    AuthoringErrorCode.INVALID_ARGUMENT,
                    f"view_range {list(request.view_range)} is outside {path!r}, "
                    f"which has {len(lines)} lines",
                )
        numbered = []
        for number in range(start, end + 1):
            line = lines[number - 1].removesuffix("\n")
            numbered.append(f"{number:>6}\t{line}\n")
        return self._view_page(path, "file", numbered, request.page, version)

    def create_file(
        self, actor: str, request: ArtifactCreateFileRequest
    ) -> ArtifactWriteResponse:
        """Add a new file; ``FILE_EXISTS`` when the path is taken."""
        artifact_id, tree = self._begin_write(actor, request)
        if request.path in tree or _is_directory(tree, request.path):
            raise ArtifactError(
                AuthoringErrorCode.FILE_EXISTS,
                f"{request.path!r} exists already; delete it first to replace it",
            )
        new_tree = {**tree, request.path: self._stage(request.path, request.file_text)}
        return self._commit(artifact_id, request.base_version, tree, new_tree)

    def str_replace(
        self, actor: str, request: ArtifactStrReplaceRequest
    ) -> ArtifactWriteResponse:
        """Replace the one exact occurrence of ``old_str`` in a file."""
        artifact_id, tree = self._begin_write(actor, request)
        text = self._existing_text(tree, request.path)
        found: list[int] = []
        index = text.find(request.old_str)
        # Overlapping occurrences count: replacing either would be a guess.
        while index != -1 and len(found) < 5:
            found.append(index)
            index = text.find(request.old_str, index + 1)
        if not found:
            raise ArtifactError(
                AuthoringErrorCode.NO_MATCH,
                f"old_str doesn't appear in {request.path!r}; it must match "
                "exactly, whitespace and indentation included",
            )
        if len(found) > 1:
            lines = sorted({_line_of(text, position) for position in found})
            raise ArtifactError(
                AuthoringErrorCode.MULTIPLE_MATCHES,
                f"old_str appears more than once in {request.path!r} (lines "
                f"{', '.join(map(str, lines))}); add surrounding lines to make "
                "it unique",
            )
        start = found[0]
        updated = text[:start] + request.new_str + text[start + len(request.old_str) :]
        new_tree = {**tree, request.path: self._stage(request.path, updated)}
        return self._commit(artifact_id, request.base_version, tree, new_tree)

    def insert(
        self, actor: str, request: ArtifactInsertRequest
    ) -> ArtifactWriteResponse:
        """Insert text after line ``insert_line``; ``0`` is the start of the file."""
        artifact_id, tree = self._begin_write(actor, request)
        text = self._existing_text(tree, request.path)
        lines = _split_lines(text)
        if request.insert_line > len(lines):
            raise ArtifactError(
                AuthoringErrorCode.INVALID_ARGUMENT,
                f"insert_line {request.insert_line} is past the end of "
                f"{request.path!r}, which has {len(lines)} lines",
            )
        before = lines[: request.insert_line]
        after = lines[request.insert_line :]
        insert_text = request.insert_text
        # The inserted text is whole lines: it neither joins the line before it
        # nor the one after it.
        if before and not before[-1].endswith("\n"):
            before[-1] += "\n"
        if after and insert_text and not insert_text.endswith("\n"):
            insert_text += "\n"
        updated = "".join(before) + insert_text + "".join(after)
        new_tree = {**tree, request.path: self._stage(request.path, updated)}
        return self._commit(artifact_id, request.base_version, tree, new_tree)

    def delete_file(
        self, actor: str, request: ArtifactDeleteFileRequest
    ) -> ArtifactWriteResponse:
        """Delete one file. ``manifest.json`` can't be deleted."""
        artifact_id, tree = self._begin_write(actor, request)
        if request.path == MANIFEST_FILE:
            raise self._manifest_required("deleted")
        if request.path not in tree:
            raise self._file_not_found(request.path)
        new_tree = {path: blob for path, blob in tree.items() if path != request.path}
        return self._commit(artifact_id, request.base_version, tree, new_tree)

    def move_file(
        self, actor: str, request: ArtifactMoveFileRequest
    ) -> ArtifactWriteResponse:
        """Move or rename one file; ``FILE_EXISTS`` when ``new_path`` is taken."""
        artifact_id, tree = self._begin_write(actor, request)
        if request.old_path not in tree:
            raise self._file_not_found(request.old_path)
        if request.old_path == MANIFEST_FILE:
            raise self._manifest_required("moved")
        if request.new_path in tree or _is_directory(tree, request.new_path):
            raise ArtifactError(
                AuthoringErrorCode.FILE_EXISTS,
                f"{request.new_path!r} exists already",
            )
        new_tree = {
            path: blob for path, blob in tree.items() if path != request.old_path
        }
        new_tree[request.new_path] = tree[request.old_path]
        return self._commit(artifact_id, request.base_version, tree, new_tree)

    def search(self, actor: str, request: ArtifactSearchRequest) -> SearchResult:
        """A page of the draft's lines holding ``query``, plain and case-sensitive."""
        artifact_id = self._authorize(actor, request.artifact_id)
        version, tree = self._draft(artifact_id)
        if request.path is None:
            paths = sorted(tree)
        elif request.path in tree:
            paths = [request.path]
        elif _is_directory(tree, request.path):
            prefix = f"{request.path}/"
            paths = sorted(path for path in tree if path.startswith(prefix))
        else:
            raise self._file_not_found(request.path)
        matches: list[SearchMatch] = []
        for path in paths:
            text = self._read_text(tree[path])
            if text is None:
                continue
            for number, line in enumerate(_split_lines(text), start=1):
                if request.query in line:
                    content = line.removesuffix("\n")[:MAX_MATCH_CHARS]
                    matches.append(SearchMatch(path=path, line=number, text=content))
        pages = _pages(
            matches,
            lambda match: _text_size(f"{match.path}:{match.line}: {match.text}\n"),
            PAGE_BYTES,
        )
        number, page = _pick_page(pages, request.page)
        return SearchResult(
            query=request.query,
            matches=tuple(page),
            page=number,
            pages=len(pages),
            version=version,
        )

    def history(self, actor: str, request: ArtifactHistoryRequest) -> HistoryPage:
        """A page of the versions ``request.ref`` has pointed to, newest first."""
        artifact_id = self._authorize(actor, request.artifact_id)
        number = request.page or 1
        history = self._backend.ref_history(
            artifact_id,
            request.ref,
            offset=(number - 1) * HISTORY_PAGE_SIZE,
            limit=HISTORY_PAGE_SIZE,
        )
        pages = max(1, math.ceil(history.total / HISTORY_PAGE_SIZE))
        _page_number(number, pages)
        return HistoryPage(
            ref=request.ref, versions=history.versions, page=number, pages=pages
        )

    def restore(
        self, actor: str, request: ArtifactRestoreRequest
    ) -> ArtifactWriteResponse:
        """
        Make an earlier version's files the draft again.

        History isn't rewritten: the restore is a new entry in the draft's
        history. Its version is the earlier one's, since a version is the hash
        of its files.
        """
        artifact_id, tree = self._begin_write(actor, request)
        if not self.has_version(artifact_id, request.version):
            raise self._version_not_found(request.version)
        return self._commit(
            artifact_id, request.base_version, tree, self._tree(request.version)
        )

    def manifest_get(
        self, actor: str, request: ArtifactManifestGetRequest
    ) -> tuple[str, ArtifactManifest]:
        """The draft's version and its validated ``manifest.json``."""
        artifact_id = self._authorize(actor, request.artifact_id)
        version, tree = self._draft(artifact_id)
        return version, self._manifest_of(tree)

    def manifest_update(
        self, actor: str, request: ArtifactManifestUpdateRequest
    ) -> ArtifactWriteResponse:
        """Replace the draft's ``manifest.json``."""
        artifact_id, tree = self._begin_write(actor, request)
        text = _manifest_text(request.manifest)
        new_tree = {**tree, MANIFEST_FILE: self._stage(MANIFEST_FILE, text)}
        return self._commit(artifact_id, request.base_version, tree, new_tree)

    # -- Commit by hash ------------------------------------------------------

    def put_blobs(
        self, actor: str, artifact_id: str, contents: Sequence[bytes]
    ) -> list[str]:
        """
        Store file contents for a later ``commit_files``; return their hashes.

        Only an artifact's owners upload for it. Blobs belong to the backend,
        not the artifact, so the same content is stored once.
        """
        self._authorize(actor, artifact_id)
        limit = self._policy.limits.file_bytes
        if any(len(content) > limit for content in contents):
            raise self._too_large(f"a file is over {limit} bytes")
        if sum(len(content) for content in contents) > MAX_UPLOAD_BYTES:
            raise self._too_large(f"an upload is over {MAX_UPLOAD_BYTES} bytes")
        return [self._backend.put_blob(bytes(content)) for content in contents]

    def commit_files(
        self, actor: str, request: ArtifactCommitFilesRequest
    ) -> ArtifactCommitFilesResponse:
        """
        Make ``request.files`` (path to content hash) the whole new draft.

        When the backend lacks some of the blobs, nothing is committed and
        the answer lists them: upload them with ``put_blobs``, then commit again
        from the same ``base_version``.
        """
        artifact_id, tree = self._begin_write(actor, request)
        files = dict(request.files)
        if MANIFEST_FILE not in files:
            raise self._manifest_required("left out")
        self._check_file_count(files)
        missing = self._backend.missing_blobs(set(files.values()))
        if missing:
            return ArtifactCommitFilesResponse(missing=sorted(missing))
        written = self._commit(artifact_id, request.base_version, tree, files)
        return ArtifactCommitFilesResponse(version=written.version)

    # -- Publishing ----------------------------------------------------------

    def request_publish(
        self, actor: str, request: ArtifactRequestPublishRequest
    ) -> PublishRequest:
        """
        Ask the user to publish the current draft, ``request.base_version``.

        Nothing is published here: the request waits until the user confirms it
        (``confirm_publish``) or it expires. A newer request replaces it. It is
        never rebased: the user confirms exactly the version the agent saw.
        """
        artifact_id = self._authorize(actor, request.artifact_id)
        current = self._draft_version(artifact_id)
        if current != request.base_version:
            raise self._stale(current)
        self._check_policy(self._manifest_of(self._tree(current)))
        now = self._now()
        publish = PublishRequest(
            request_id=self._new_id(),
            artifact_id=artifact_id,
            version=request.base_version,
            requested_by=actor,
            requested_at=now,
            expires_at=now + PUBLISH_REQUEST_TTL,
        )
        for _attempt in range(_CAS_ATTEMPTS):
            pointer, _record = self._read_record(artifact_id, _PUBLISH_REF)
            if self._write_record(
                artifact_id, _PUBLISH_REF, pointer, _publish_record(publish)
            ):
                return publish
        raise RuntimeError(f"the publish request of {artifact_id} kept changing")

    def pending_publish(self, actor: str, artifact_id: str) -> PublishRequest | None:
        """The publish request waiting for the user, if any."""
        canonical = self._authorize(actor, artifact_id)
        _, record = self._read_record(canonical, _PUBLISH_REF)
        if record is None:
            return None
        publish = _publish_from_record(canonical, record)
        if publish.status != "pending" or publish.expires_at <= self._now():
            return None
        return publish

    def confirm_publish(self, actor: str, artifact_id: str, request_id: str) -> str:
        """
        Publish the version of pending request ``request_id``; return it.

        Call this only for the user's own confirmation, never for an agent's
        request. The confirmed version is the one the request named,
        even if the draft has moved on since: it is what the user saw.
        """
        canonical = self._authorize(actor, artifact_id)
        pointer, record = self._read_record(canonical, _PUBLISH_REF)
        publish = _publish_from_record(canonical, record) if record else None
        if (
            publish is None
            or publish.request_id != request_id
            or publish.status != "pending"
        ):
            raise ArtifactError(
                ExtensionErrorCode.PUBLISH_REQUEST_NOT_FOUND,
                f"no pending publish request {request_id!r}: it was confirmed, "
                "replaced by a newer request, or never made",
            )
        now = self._now()
        if publish.expires_at <= now:
            raise ArtifactError(
                ExtensionErrorCode.PUBLISH_REQUEST_NOT_FOUND,
                f"publish request {request_id!r} has expired; ask for a new one",
            )
        if not self.has_version(canonical, publish.version):
            raise self._version_not_found(publish.version)
        # The policy may have tightened since the agent asked.
        self._check_policy(self._manifest_of(self._tree(publish.version)))
        self._move_ref(canonical, PUBLISHED_REF, publish.version)
        confirmed = replace(
            publish, status="confirmed", confirmed_by=actor, confirmed_at=now
        )
        # When this loses, a concurrent confirmation of the same request or a
        # newer request won; the published ref has moved either way.
        self._write_record(canonical, _PUBLISH_REF, pointer, _publish_record(confirmed))
        return publish.version

    # -- Reads for hosts that authorize on their own -------------------------

    def canonical_id(self, artifact_id: str) -> str:
        """``artifact_id`` as a canonical UUID; ``ARTIFACT_NOT_FOUND`` if it isn't."""
        try:
            return str(uuid.UUID(artifact_id))
        except (AttributeError, TypeError, ValueError):
            raise self._not_found(artifact_id) from None

    def is_owner(self, actor: str | None, artifact_id: str) -> bool:
        """Whether ``actor`` owns the artifact; ``False`` for anyone else."""
        if not actor:
            return False
        try:
            self._authorize(actor, artifact_id)
        except ArtifactError:
            return False
        return True

    def draft_version(self, actor: str, artifact_id: str) -> str:
        """The current draft version, for an owner."""
        canonical = self._authorize(actor, artifact_id)
        version, _ = self._draft(canonical)
        return version

    def published_version(self, artifact_id: str) -> str | None:
        """The published version, if any. The caller decides who may see it."""
        return self._backend.get_ref(self.canonical_id(artifact_id), PUBLISHED_REF)

    def has_version(
        self, artifact_id: str, version: str, *, ref: str = DRAFT_REF
    ) -> bool:
        """Whether ``ref`` has pointed to ``version``: whether it is this artifact's."""
        canonical = self.canonical_id(artifact_id)
        return self._backend.ref_has_held(canonical, ref, version)

    def resolve_version(
        self, actor: str, artifact_id: str, version: str | None
    ) -> tuple[str, str]:
        """The canonical id, and ``version`` checked; the draft when ``None``."""
        canonical = self._authorize(actor, artifact_id)
        if version is None:
            current, _ = self._draft(canonical)
            return canonical, current
        if not self.has_version(canonical, version):
            raise self._version_not_found(version)
        return canonical, version

    def manifest_at(self, artifact_id: str, version: str) -> ArtifactManifest:
        """The manifest of one of this artifact's versions. The caller authorizes."""
        canonical = self.canonical_id(artifact_id)
        if not self.has_version(canonical, version):
            raise self._version_not_found(version)
        return self._manifest_of(self._tree(version))

    # -- Internals -----------------------------------------------------------

    @staticmethod
    def _require_actor(actor: str) -> None:
        if not actor:
            raise ValueError("an acting user is required")

    def _authorize(self, actor: str, artifact_id: str) -> str:
        self._require_actor(actor)
        canonical = self.canonical_id(artifact_id)
        _, meta = self._read_record(canonical, _META_REF)
        if meta is None or actor not in meta.get("owners", ()):
            raise self._not_found(artifact_id)
        return canonical

    def _begin_write(
        self, actor: str, request: ArtifactWriteRequest
    ) -> tuple[str, dict[str, str]]:
        """
        The canonical id and the tree of ``base_version``, which the write
        starts from: the draft, or a version it held earlier, which the write
        is then rebased from (see ``_commit``).
        """
        artifact_id = self._authorize(actor, request.artifact_id)
        current = self._draft_version(artifact_id)
        if current != request.base_version and not self._backend.ref_has_held(
            artifact_id, DRAFT_REF, request.base_version
        ):
            raise self._stale(current)
        return artifact_id, self._tree(request.base_version)

    def _commit(
        self,
        artifact_id: str,
        base_version: str,
        base_tree: Mapping[str, str],
        new_tree: dict[str, str],
    ) -> ArtifactWriteResponse:
        """
        Store ``new_tree`` and move the draft to it.

        When the draft has moved on from ``base_version``, the write's changes
        apply to the draft instead, as long as none of the files it changes
        changed meanwhile; otherwise it fails with ``STALE_BASE_VERSION``.
        """
        for _attempt in range(_CAS_ATTEMPTS):
            current = self._draft_version(artifact_id)
            if current == base_version:
                current_tree, target = base_tree, new_tree
            else:
                current_tree = self._tree(current)
                rebased = _rebased(base_tree, new_tree, current_tree)
                if rebased is None:
                    raise self._stale(current)
                target = rebased
            self._check_file_count(target)
            self._check_manifest(current_tree, target)
            version = self._put_tree(target)
            if self._backend.compare_and_set_ref(
                artifact_id, DRAFT_REF, current, version
            ):
                return ArtifactWriteResponse(version=version)
        raise self._stale(self._draft_version(artifact_id))

    def _put_tree(self, tree: Mapping[str, str]) -> str:
        try:
            return self._backend.put_tree(tree)
        except InvalidPathError as ex:
            raise ArtifactError(AuthoringErrorCode.INVALID_PATH, str(ex)) from ex
        except MissingObjectsError as ex:
            raise ArtifactError(
                AuthoringErrorCode.INVALID_ARGUMENT,
                f"the store doesn't hold {', '.join(sorted(ex.missing))}",
            ) from ex

    def _file_bytes(self, path: str, text: str) -> bytes:
        """A file's text as UTF-8, within the policy's size limit."""
        data = _encode(text, path)
        limit = self._policy.limits.file_bytes
        if len(data) > limit:
            raise self._too_large(
                f"{path!r} is {len(data)} bytes; the limit is {limit}"
            )
        return data

    def _stage(self, path: str, text: str) -> str:
        """Store a file's text as a blob; return its hash."""
        return self._backend.put_blob(self._file_bytes(path, text))

    def _check_file_count(self, tree: Mapping[str, Any]) -> None:
        limit = self._policy.limits.files
        if len(tree) > limit:
            raise self._too_large(
                f"{len(tree)} files; an artifact holds at most {limit}"
            )

    def _check_manifest(
        self, base_tree: Mapping[str, str], new_tree: Mapping[str, str]
    ) -> None:
        """
        Every version has a valid manifest, which the policy admits; both are
        checked whenever it changes.
        """
        manifest_hash = new_tree.get(MANIFEST_FILE)
        if manifest_hash is None:
            raise self._manifest_required("left out")
        if manifest_hash != base_tree.get(MANIFEST_FILE):
            self._check_policy(self._parse_manifest(self._blob(manifest_hash)))

    def _check_policy(self, manifest: ArtifactManifest) -> None:
        """``POLICY_DENIED``, naming each knob, unless the policy admits it."""
        if problems := manifest_problems(manifest, self._policy):
            raise ArtifactError(
                AuthoringErrorCode.POLICY_DENIED,
                f"the {self._policy.profile.value} policy here refuses "
                f"{MANIFEST_FILE}: {'; '.join(problems)}",
            )

    def _parse_manifest(self, data: bytes) -> ArtifactManifest:
        with translate_invalid_manifest():
            return ArtifactManifest.model_validate_json(data)

    def _manifest_of(self, tree: Mapping[str, str]) -> ArtifactManifest:
        manifest_hash = tree.get(MANIFEST_FILE)
        if manifest_hash is None:
            raise self._manifest_required("left out")
        return self._parse_manifest(self._blob(manifest_hash))

    def _draft_version(self, artifact_id: str) -> str:
        version = self._backend.get_ref(artifact_id, DRAFT_REF)
        if version is None:
            raise self._not_found(artifact_id)
        return version

    def _draft(self, artifact_id: str) -> tuple[str, dict[str, str]]:
        version = self._draft_version(artifact_id)
        return version, self._tree(version)

    def _tree(self, version: str) -> dict[str, str]:
        tree = self._backend.get_tree(version)
        if tree is None:
            raise RuntimeError(f"the store lost version {version}")
        return tree

    def _blob(self, blob_hash: str) -> bytes:
        data = self._backend.get_blob(blob_hash)
        if data is None:
            raise RuntimeError(f"the store lost blob {blob_hash}")
        return data

    def _read_text(self, blob_hash: str) -> str | None:
        """The blob as text, or ``None`` when it isn't UTF-8 (a binary file)."""
        return _text_of(self._blob(blob_hash))

    def _existing_text(self, tree: Mapping[str, str], path: str) -> str:
        blob_hash = tree.get(path)
        if blob_hash is None:
            raise self._file_not_found(path)
        text = self._read_text(blob_hash)
        if text is None:
            raise ArtifactError(
                AuthoringErrorCode.INVALID_ARGUMENT,
                f"{path!r} is a binary file; text edits apply to text files",
            )
        return text

    def _view_page(
        self,
        path: str,
        kind: Literal["file", "directory"],
        pieces: Iterable[str],
        page: int | None,
        version: str,
    ) -> FileView:
        pages = _paginate_text(pieces)
        number, content = _pick_page(pages, page)
        return FileView(
            path=path,
            kind=kind,
            content=content,
            page=number,
            pages=len(pages),
            version=version,
        )

    def _read_record(
        self, artifact_id: str, ref: str
    ) -> tuple[str | None, dict[str, Any] | None]:
        """A record and the tree hash it sits at, for a later compare-and-swap."""
        pointer = self._backend.get_ref(artifact_id, ref)
        if pointer is None:
            return None, None
        blob_hash = self._tree(pointer).get(_RECORD_FILE)
        if blob_hash is None:
            raise RuntimeError(f"{ref} of {artifact_id} holds no record")
        return pointer, json.loads(self._blob(blob_hash))

    def _write_record(
        self,
        artifact_id: str,
        ref: str,
        expected: str | None,
        record: Mapping[str, Any],
    ) -> bool:
        """Point ``ref`` at ``record`` if it still points at ``expected``."""
        blob_hash = self._backend.put_blob(_canonical_json(record))
        pointer = self._backend.put_tree({_RECORD_FILE: blob_hash})
        return self._backend.compare_and_set_ref(artifact_id, ref, expected, pointer)

    def _move_ref(self, artifact_id: str, ref: str, version: str) -> bool:
        """Point ``ref`` at ``version`` from wherever it is; return whether it moved."""
        for _attempt in range(_CAS_ATTEMPTS):
            current = self._backend.get_ref(artifact_id, ref)
            if current == version:
                return False
            if self._backend.compare_and_set_ref(artifact_id, ref, current, version):
                return True
        raise RuntimeError(f"{ref} of {artifact_id} kept moving")

    def _stale(self, current: str | None) -> ArtifactError:
        return ArtifactError(
            AuthoringErrorCode.STALE_BASE_VERSION,
            "the draft has moved on from base_version: read it again, then retry",
            current_version=current,
        )

    @staticmethod
    def _not_found(artifact_id: str) -> ArtifactError:
        return ArtifactError(
            AuthoringErrorCode.ARTIFACT_NOT_FOUND,
            f"artifact {artifact_id!r} not found, or you can't edit it",
        )

    @staticmethod
    def _file_not_found(path: str) -> ArtifactError:
        return ArtifactError(
            AuthoringErrorCode.FILE_NOT_FOUND, f"{path!r} names no file or directory"
        )

    @staticmethod
    def _version_not_found(version: str) -> ArtifactError:
        return ArtifactError(
            AuthoringErrorCode.VERSION_NOT_FOUND,
            f"{version} isn't a version of this artifact",
        )

    @staticmethod
    def _manifest_required(how: str) -> ArtifactError:
        return ArtifactError(
            AuthoringErrorCode.INVALID_MANIFEST,
            f"{MANIFEST_FILE} can't be {how}: every version needs one",
        )

    @staticmethod
    def _too_large(message: str) -> ArtifactError:
        return ArtifactError(AuthoringErrorCode.TOO_LARGE, message)
