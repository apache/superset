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
The authoring tool contract: what agents call to write artifacts.

This module has no implementation. It names the tools and defines their
requests, their responses and their error codes; an extension implements the
tools over the file store (``superset_core.artifacts.store``) and the provider
(``superset_core.artifacts.provider``).

The file tools mirror Anthropic's text-editor tool (``view``, ``create``,
``str_replace``, ``insert``) and its memory tool (``delete``, ``rename``): the
same command semantics and parameter names, with errors that map onto
``AuthoringErrorCode``. Models already know those tools, so the edit format
is one they were trained on.

Every write names ``base_version``: the draft version (a tree hash) the agent
last read. A write against a draft that has moved since fails with
``STALE_BASE_VERSION`` and changes nothing; a successful write answers with
the new draft version, for the next write to name.

Paths are relative to the artifact's root and are normalized on input
(``normalize_path``).
"""

# TODO: a retry-safe ``op_id`` on every write, so that a retried call can't
# apply twice.
# TODO: paging limits for ``view``, ``search`` and ``history`` results.

from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from types import MappingProxyType
from typing import Annotated, Literal, TypeVar

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from superset_core.artifacts.manifest import ArtifactManifest
from superset_core.artifacts.store import (
    normalize_path,
    SHA256_HEX_PATTERN,
    validate_tree,
)

ARTIFACT_CREATE = "artifact_create"
ARTIFACT_VIEW = "artifact_view"
ARTIFACT_CREATE_FILE = "artifact_create_file"
ARTIFACT_STR_REPLACE = "artifact_str_replace"
ARTIFACT_INSERT = "artifact_insert"
ARTIFACT_DELETE_FILE = "artifact_delete_file"
ARTIFACT_MOVE_FILE = "artifact_move_file"
ARTIFACT_SEARCH = "artifact_search"
ARTIFACT_HISTORY = "artifact_history"
ARTIFACT_RESTORE = "artifact_restore"
ARTIFACT_MANIFEST_GET = "artifact_manifest_get"
ARTIFACT_MANIFEST_UPDATE = "artifact_manifest_update"
ARTIFACT_REQUEST_PUBLISH = "artifact_request_publish"
ARTIFACT_BUILD = "artifact_build"
ARTIFACT_CHECK = "artifact_check"
# Commit a whole tree by content hash.
ARTIFACT_COMMIT_FILES = "artifact_commit_files"

# ``artifact_view``'s path for the artifact's root directory.
ROOT_PATH = "."

ArtifactId = Annotated[str, Field(min_length=1)]
Sha256Hex = Annotated[str, Field(pattern=SHA256_HEX_PATTERN)]
# A version is identified by the hash of its tree.
Version = Sha256Hex
TreePath = Annotated[str, AfterValidator(normalize_path)]

_V = TypeVar("_V")


def _is_root(path: object) -> bool:
    """Whether ``path`` names the artifact's root directory."""
    return path in (ROOT_PATH, "./")


def _normalized_paths(files: Mapping[str, _V]) -> dict[str, _V]:
    normalized: dict[str, _V] = {}
    for path, value in files.items():
        key = normalize_path(path)
        if key in normalized:
            raise ValueError(f"{path!r} names the same file as another path, {key!r}")
        normalized[key] = value
    return normalized


class AuthoringErrorCode(StrEnum):
    """Why an authoring tool call failed."""

    # The draft has moved since ``base_version``: read it again, then retry.
    STALE_BASE_VERSION = "STALE_BASE_VERSION"
    # No artifact with this id that the caller may use. A missing artifact and
    # one the caller can't access answer the same, so that an id doesn't
    # reveal whether an artifact exists.
    ARTIFACT_NOT_FOUND = "ARTIFACT_NOT_FOUND"
    # The version isn't one of this artifact's.
    VERSION_NOT_FOUND = "VERSION_NOT_FOUND"
    # The path names no file.
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    # The path is taken already.
    FILE_EXISTS = "FILE_EXISTS"
    # ``old_str`` doesn't appear in the file.
    NO_MATCH = "NO_MATCH"
    # ``old_str`` appears more than once: add context to make it unique.
    MULTIPLE_MATCHES = "MULTIPLE_MATCHES"
    # Not a valid path in an artifact's tree (see ``normalize_path``).
    INVALID_PATH = "INVALID_PATH"
    # ``manifest.json`` is missing, or doesn't validate (``ArtifactManifest``).
    INVALID_MANIFEST = "INVALID_MANIFEST"
    # A value that the request model accepts but the artifact doesn't: a line
    # or a page past the end, or a text edit on a file that isn't text.
    INVALID_ARGUMENT = "INVALID_ARGUMENT"
    # A file, a result page or the artifact is over its size limit.
    TOO_LARGE = "TOO_LARGE"
    # Artifacts are off: no provider is registered, or the host turned them off.
    NOT_ENABLED = "NOT_ENABLED"
    # Publishing waits for the user's explicit confirmation.
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"


class AuthoringRequest(BaseModel):
    """Base of every authoring request; undeclared fields are rejected."""

    model_config = ConfigDict(extra="forbid")


class ArtifactScopedRequest(AuthoringRequest):
    """A request about one existing artifact."""

    artifact_id: ArtifactId


class ArtifactWriteRequest(ArtifactScopedRequest):
    """A request that changes an artifact, from the draft version it names."""

    base_version: Version


class ArtifactCreateRequest(AuthoringRequest):
    """
    ``artifact_create``: start a new artifact, answered by ``ArtifactCreateResponse``.

    ``files`` maps paths to the text of the first draft's files. A
    ``manifest.json`` among them is validated like any manifest write; without
    one, the artifact starts from the minimal manifest.
    """

    title: str | None = None
    files: dict[str, str] = Field(default_factory=dict)

    @field_validator("files")
    @classmethod
    def _normalize_paths(cls, files: dict[str, str]) -> dict[str, str]:
        return _normalized_paths(files)


class ArtifactViewRequest(ArtifactScopedRequest):
    """
    ``artifact_view``: read a file or list a directory (text editor ``view``).

    ``path`` is ``"."`` for the artifact's root. For a file, ``view_range``
    picks lines ``[start, end]``, 1-indexed and inclusive; an ``end`` of
    ``-1`` reads to the end of the file. A long result comes in pages, and
    ``page`` picks one, counting from 1.
    """

    path: str
    view_range: tuple[int, int] | None = None
    page: int | None = Field(default=None, ge=1)

    @field_validator("path")
    @classmethod
    def _normalize_path(cls, path: str) -> str:
        return ROOT_PATH if _is_root(path) else normalize_path(path)

    @field_validator("view_range")
    @classmethod
    def _valid_view_range(
        cls, view_range: tuple[int, int] | None
    ) -> tuple[int, int] | None:
        if view_range is not None:
            start, end = view_range
            if start < 1 or (end != -1 and end < start):
                raise ValueError(
                    "view_range must be [start, end] with 1 <= start <= end, "
                    "or with end = -1 to read to the end of the file"
                )
        return view_range


class ArtifactCreateFileRequest(ArtifactWriteRequest):
    """
    ``artifact_create_file``: write a new file (text editor ``create``).

    Fails with ``FILE_EXISTS`` when the path is taken, as the memory tool's
    ``create`` does, where the text editor would overwrite. To replace a file
    whole, delete it first.
    """

    path: TreePath
    file_text: str


class ArtifactStrReplaceRequest(ArtifactWriteRequest):
    """
    ``artifact_str_replace``: replace one exact string (text editor ``str_replace``).

    ``old_str`` must appear exactly once in the file: the call fails with
    ``NO_MATCH`` when it doesn't appear and ``MULTIPLE_MATCHES`` when it
    appears more than once. An empty ``new_str`` deletes the match.
    """

    path: TreePath
    old_str: str = Field(min_length=1)
    new_str: str = ""


class ArtifactInsertRequest(ArtifactWriteRequest):
    """
    ``artifact_insert``: insert text after a line (text editor ``insert``).

    ``insert_text`` goes after line ``insert_line``; ``0`` inserts it at the
    start of the file.
    """

    path: TreePath
    insert_line: int = Field(ge=0)
    insert_text: str


class ArtifactDeleteFileRequest(ArtifactWriteRequest):
    """``artifact_delete_file``: delete one file (memory tool ``delete``)."""

    path: TreePath


class ArtifactMoveFileRequest(ArtifactWriteRequest):
    """
    ``artifact_move_file``: move or rename one file (memory tool ``rename``).

    Fails with ``FILE_EXISTS`` when ``new_path`` is taken.
    """

    old_path: TreePath
    new_path: TreePath

    @model_validator(mode="after")
    def _paths_differ(self) -> ArtifactMoveFileRequest:
        if self.old_path == self.new_path:
            raise ValueError("old_path and new_path name the same file")
        return self


class ArtifactSearchRequest(ArtifactScopedRequest):
    """
    ``artifact_search``: find a string in the draft's files.

    ``query`` is case-sensitive plain text, not a regular expression. ``path``
    limits the search to one file or directory; the root (``"."``, as in
    ``artifact_view``) or no path searches every file, and normalizes to
    ``None``.
    """

    query: str = Field(min_length=1)
    path: TreePath | None = None
    page: int | None = Field(default=None, ge=1)

    @field_validator("path", mode="before")
    @classmethod
    def _root_is_every_file(cls, path: object) -> object:
        return None if _is_root(path) else path


class ArtifactHistoryRequest(ArtifactScopedRequest):
    """``artifact_history``: the versions a ref has pointed to, newest first."""

    ref: Literal["draft", "published"] = "draft"
    page: int | None = Field(default=None, ge=1)


class ArtifactRestoreRequest(ArtifactWriteRequest):
    """
    ``artifact_restore``: make an earlier version's files the draft again.

    History isn't rewritten: the restored files become a new draft version.
    """

    version: Version


class ArtifactManifestGetRequest(ArtifactScopedRequest):
    """``artifact_manifest_get``: read the draft's validated ``manifest.json``."""


class ArtifactManifestUpdateRequest(ArtifactWriteRequest):
    """``artifact_manifest_update``: replace the draft's ``manifest.json``."""

    manifest: ArtifactManifest


class ArtifactRequestPublishRequest(ArtifactWriteRequest):
    """
    ``artifact_request_publish``: ask the user to publish ``base_version``.

    The ``published`` ref moves only once the user confirms; until then the
    tool answers ``CONFIRMATION_REQUIRED``. ``base_version`` must be the
    current draft, so the user confirms exactly what the agent last saw.
    """

    # TODO: decide where the user confirms (a host screen that shows the diff).


class ArtifactBuildRequest(ArtifactScopedRequest):
    """
    ``artifact_build``: build a version, the draft by default.

    Answered by a ``BuildResult`` (``superset_core.artifacts.provider``).
    """

    version: Version | None = None


class ArtifactCheckRequest(ArtifactScopedRequest):
    """
    ``artifact_check``: run a version in a headless browser, the draft by default.

    Answered by a ``CheckResult`` (``superset_core.artifacts.provider``).
    """

    version: Version | None = None


class ArtifactCommitFilesRequest(ArtifactWriteRequest):
    """
    ``artifact_commit_files``: commit a whole tree by content hash.

    For agents that keep the project on a disk, such as Claude Code. ``files``
    is the complete new version: every path with the SHA-256 of its content,
    and a path left out is deleted. When the store lacks some of those blobs,
    nothing is committed and the response lists them as ``missing``.
    """

    # TODO: the contract doesn't define how an agent uploads the blobs that a
    # commit reports missing (a REST upload, or content in a follow-up tool
    # call).

    files: dict[str, Sha256Hex]

    @field_validator("files")
    @classmethod
    def _valid_tree(cls, files: dict[str, str]) -> dict[str, str]:
        normalized = _normalized_paths(files)
        validate_tree(normalized)
        return normalized


class ArtifactCreateResponse(BaseModel):
    """What ``artifact_create`` answers: the new artifact and its first version."""

    artifact_id: ArtifactId
    version: Version


class ArtifactWriteResponse(BaseModel):
    """What a successful write answers: the new draft version."""

    version: Version


class ArtifactCommitFilesResponse(BaseModel):
    """
    What ``artifact_commit_files`` answers.

    Either ``missing`` lists the blobs to upload, and nothing was committed,
    or ``version`` is the new draft version.
    """

    missing: list[Sha256Hex] = Field(default_factory=list)
    version: Version | None = None

    @model_validator(mode="after")
    def _missing_or_committed(self) -> ArtifactCommitFilesResponse:
        if bool(self.missing) == (self.version is not None):
            raise ValueError(
                "set missing (nothing was committed) or version, not both or neither"
            )
        return self


class AuthoringErrorResponse(BaseModel):
    """
    What a failed call answers.

    For ``STALE_BASE_VERSION``, ``current_version`` is the draft's version at
    the time of the call.
    """

    code: AuthoringErrorCode
    message: str
    current_version: Version | None = None


TOOL_REQUESTS: Mapping[str, type[AuthoringRequest]] = MappingProxyType(
    {
        ARTIFACT_CREATE: ArtifactCreateRequest,
        ARTIFACT_VIEW: ArtifactViewRequest,
        ARTIFACT_CREATE_FILE: ArtifactCreateFileRequest,
        ARTIFACT_STR_REPLACE: ArtifactStrReplaceRequest,
        ARTIFACT_INSERT: ArtifactInsertRequest,
        ARTIFACT_DELETE_FILE: ArtifactDeleteFileRequest,
        ARTIFACT_MOVE_FILE: ArtifactMoveFileRequest,
        ARTIFACT_SEARCH: ArtifactSearchRequest,
        ARTIFACT_HISTORY: ArtifactHistoryRequest,
        ARTIFACT_RESTORE: ArtifactRestoreRequest,
        ARTIFACT_MANIFEST_GET: ArtifactManifestGetRequest,
        ARTIFACT_MANIFEST_UPDATE: ArtifactManifestUpdateRequest,
        ARTIFACT_REQUEST_PUBLISH: ArtifactRequestPublishRequest,
        ARTIFACT_BUILD: ArtifactBuildRequest,
        ARTIFACT_CHECK: ArtifactCheckRequest,
        ARTIFACT_COMMIT_FILES: ArtifactCommitFilesRequest,
    }
)
