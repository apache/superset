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
The authoring tools, as MCP tools.

They carry the names of the SDK's authoring contract, which the host prefixes
to ``extensions.superset-oss.artifacts.<name>``, plus
``artifact_upload_blobs`` for the uploads that commit by hash needs. Each one
delegates to ``AuthoringHandlers`` with the signed-in user; every answer is a
JSON object, and a failure carries a ``code`` from ``AuthoringErrorCode`` or
the extension's own codes.

By default a deployment offers the tools every agent needs: the text editor's
commands, the push and pull of a folder, and building, checking and
publishing. Every tool offered costs every agent context, so the rest of the
file tools (``EXTRA_TOOLS``), which only clients without a disk may want,
come with ``ARTIFACTS_ALL_FILE_TOOLS = True``.

An artifact is a saved widget, so RBAC reuses the Widget permissions: can_read
on Widget to read, can_write to write; each tool then checks the artifact's
own widget, its readers or its editors. Operators can remove any of the tools
with ``MCP_DISABLED_TOOLS``.
"""

# TODO: decorators that don't raise when the MCP extras aren't installed;
# without them ``@tool`` raises, which the entry point catches.
# TODO: tools denied by default until a deployment allows them, tools offered
# by what the caller's token entitles, and a narrow OAuth scope for authoring.

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar

from superset_artifacts_sdk.authoring import (
    ARTIFACT_BUILD,
    ARTIFACT_CHECK,
    ARTIFACT_COMMIT_FILES,
    ARTIFACT_CREATE,
    ARTIFACT_CREATE_FILE,
    ARTIFACT_DELETE_FILE,
    ARTIFACT_HISTORY,
    ARTIFACT_INSERT,
    ARTIFACT_LAND,
    ARTIFACT_MANIFEST_GET,
    ARTIFACT_MANIFEST_UPDATE,
    ARTIFACT_MOVE_FILE,
    ARTIFACT_REQUEST_PUBLISH,
    ARTIFACT_RESTORE,
    ARTIFACT_SEARCH,
    ARTIFACT_STR_REPLACE,
    ARTIFACT_VIEW,
    ArtifactBuildRequest,
    ArtifactCheckRequest,
    ArtifactCommitFilesRequest,
    ArtifactCreateFileRequest,
    ArtifactCreateRequest,
    ArtifactDeleteFileRequest,
    ArtifactHistoryRequest,
    ArtifactInsertRequest,
    ArtifactLandRequest,
    ArtifactManifestGetRequest,
    ArtifactMoveFileRequest,
    ArtifactRequestPublishRequest,
    ArtifactRestoreRequest,
    ArtifactSearchRequest,
    ArtifactStrReplaceRequest,
    ArtifactViewRequest,
)
from superset_core.mcp.decorators import tool, ToolAnnotations
from superset_oss.artifacts.authoring.handlers import (
    ArtifactManifestUpdateArguments,
    ArtifactUploadBlobsRequest,
    AuthoringHandlers,
)
from superset_oss.artifacts.authoring.prompt_text import EXTRA_TOOLS
from superset_oss.artifacts.constants import ARTIFACT_UPLOAD_BLOBS
from superset_oss.artifacts.web import all_file_tools, current_actor, transfer_links

PERMISSION = "Widget"
READ_TAGS = ["artifacts"]
WRITE_TAGS = ["artifacts", "mutate"]

_F = TypeVar("_F", bound=Callable[..., Any])

ALL_FILE_TOOLS = all_file_tools()

handlers = AuthoringHandlers(transfer_links)


def _tool(name: str, **options: Any) -> Callable[[_F], _F]:
    """``@tool`` for a tool this deployment offers; any other stays a function."""
    if name in EXTRA_TOOLS and not ALL_FILE_TOOLS:
        return lambda function: function
    return tool(name=name, class_permission_name=PERMISSION, **options)


def _reads(title: str) -> ToolAnnotations:
    return ToolAnnotations(
        title=title, readOnlyHint=True, destructiveHint=False, openWorldHint=False
    )


def _writes(
    title: str, *, idempotent: bool, destructive: bool = False
) -> ToolAnnotations:
    """
    A write's annotations. A write that names ``base_version`` is idempotent:
    repeated, it finds its own files changed since its base, and changes
    nothing.
    """
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=destructive,
        idempotentHint=idempotent,
        openWorldHint=False,
    )


@_tool(
    ARTIFACT_CREATE,
    tags=WRITE_TAGS,
    annotations=_writes("Create an artifact", idempotent=False),
)
def artifact_create(request: ArtifactCreateRequest) -> dict[str, Any]:
    """Start a new artifact from its first files (path to text).

    Without a manifest.json among them, the artifact starts from a minimal one.
    Read the create_artifact prompt first. Returns the artifact_id and the
    first version, which the next write names as base_version.
    """
    return handlers.create(current_actor(), request)


@_tool(
    ARTIFACT_VIEW,
    tags=READ_TAGS,
    annotations=_reads("View an artifact file"),
)
def artifact_view(request: ArtifactViewRequest) -> dict[str, Any]:
    """Read a draft file with line numbers, or list a directory ("." is the root).

    view_range picks lines [start, end], 1-indexed; an end of -1 reads to the
    end. Long results come in pages of about 40 KB: pass page to read on.
    Returns the draft version that was read.
    """
    return handlers.view(current_actor(), request)


@_tool(
    ARTIFACT_CREATE_FILE,
    tags=WRITE_TAGS,
    annotations=_writes("Create an artifact file", idempotent=True),
)
def artifact_create_file(request: ArtifactCreateFileRequest) -> dict[str, Any]:
    """Add a new file to the draft. FILE_EXISTS when the path is taken.

    Returns the new draft version.
    """
    return handlers.create_file(current_actor(), request)


@_tool(
    ARTIFACT_STR_REPLACE,
    tags=WRITE_TAGS,
    annotations=_writes("Edit an artifact file", idempotent=True),
)
def artifact_str_replace(request: ArtifactStrReplaceRequest) -> dict[str, Any]:
    """Replace one exact string in a draft file; an empty new_str deletes it.

    old_str must appear exactly once, whitespace included: NO_MATCH or
    MULTIPLE_MATCHES otherwise. Returns the new draft version.
    """
    return handlers.str_replace(current_actor(), request)


@_tool(
    ARTIFACT_INSERT,
    tags=WRITE_TAGS,
    annotations=_writes("Insert into an artifact file", idempotent=True),
)
def artifact_insert(request: ArtifactInsertRequest) -> dict[str, Any]:
    """Insert text after line insert_line of a draft file; 0 is the start.

    Returns the new draft version.
    """
    return handlers.insert(current_actor(), request)


@_tool(
    ARTIFACT_DELETE_FILE,
    tags=WRITE_TAGS,
    annotations=_writes("Delete an artifact file", idempotent=True, destructive=True),
)
def artifact_delete_file(request: ArtifactDeleteFileRequest) -> dict[str, Any]:
    """Delete one file from the draft; earlier versions keep it.

    manifest.json can't be deleted. Returns the new draft version.
    """
    return handlers.delete_file(current_actor(), request)


@_tool(
    ARTIFACT_MOVE_FILE,
    tags=WRITE_TAGS,
    annotations=_writes("Move an artifact file", idempotent=True),
)
def artifact_move_file(request: ArtifactMoveFileRequest) -> dict[str, Any]:
    """Move or rename one draft file. FILE_EXISTS when new_path is taken.

    Returns the new draft version.
    """
    return handlers.move_file(current_actor(), request)


@_tool(
    ARTIFACT_SEARCH,
    tags=READ_TAGS,
    annotations=_reads("Search an artifact"),
)
def artifact_search(request: ArtifactSearchRequest) -> dict[str, Any]:
    """Find plain, case-sensitive text in the draft's files, or under path.

    Returns the matching lines with their paths and line numbers, in pages.
    """
    return handlers.search(current_actor(), request)


@_tool(
    ARTIFACT_HISTORY,
    tags=READ_TAGS,
    annotations=_reads("List an artifact's versions"),
)
def artifact_history(request: ArtifactHistoryRequest) -> dict[str, Any]:
    """List the versions the draft (or the published ref) has pointed to.

    Newest first, in pages of 100.
    """
    return handlers.history(current_actor(), request)


@_tool(
    ARTIFACT_RESTORE,
    tags=WRITE_TAGS,
    annotations=_writes("Restore an artifact version", idempotent=True),
)
def artifact_restore(request: ArtifactRestoreRequest) -> dict[str, Any]:
    """Make an earlier version's files the draft again, as a new history entry.

    Returns the new draft version, which equals the restored one.
    """
    return handlers.restore(current_actor(), request)


@_tool(
    ARTIFACT_MANIFEST_GET,
    tags=READ_TAGS,
    annotations=_reads("Read an artifact's manifest"),
)
def artifact_manifest_get(request: ArtifactManifestGetRequest) -> dict[str, Any]:
    """Read the draft's validated manifest.json, and the draft version."""
    return handlers.manifest_get(current_actor(), request)


@_tool(
    ARTIFACT_MANIFEST_UPDATE,
    tags=WRITE_TAGS,
    annotations=_writes("Update an artifact's manifest", idempotent=True),
)
def artifact_manifest_update(
    request: ArtifactManifestUpdateArguments,
) -> dict[str, Any]:
    """Replace the draft's manifest.json: bindings, events, capabilities, packages.

    Returns the new draft version.
    """
    return handlers.manifest_update(current_actor(), request)


@_tool(
    ARTIFACT_REQUEST_PUBLISH,
    tags=WRITE_TAGS,
    annotations=_writes("Ask the user to publish an artifact", idempotent=False),
)
def artifact_request_publish(
    request: ArtifactRequestPublishRequest,
) -> dict[str, Any]:
    """Ask the user to publish the draft version base_version.

    Nothing is published: the answer is CONFIRMATION_REQUIRED, and the user
    confirms in Superset under their own login. Don't report the artifact as
    published, and don't ask the user to confirm in the conversation.
    """
    return handlers.request_publish(current_actor(), request)


@_tool(
    ARTIFACT_BUILD,
    tags=READ_TAGS,
    annotations=_reads("Build an artifact"),
)
def artifact_build(request: ArtifactBuildRequest) -> dict[str, Any]:
    """Build a version, the draft by default, and report what to fix.

    Compile errors, imports that don't resolve, APIs the sandbox blocks and
    bindings that can't run.
    """
    return handlers.build(current_actor(), request)


@_tool(
    ARTIFACT_CHECK,
    tags=READ_TAGS,
    annotations=_reads("Check an artifact in a browser"),
)
def artifact_check(request: ArtifactCheckRequest) -> dict[str, Any]:
    """Run a version, the draft by default, in an isolated headless browser.

    Reports uncaught errors, console output, CSP violations, whether it asked
    for its data, and a summary of what it rendered.
    """
    return handlers.check(current_actor(), request)


@_tool(
    ARTIFACT_COMMIT_FILES,
    tags=WRITE_TAGS,
    annotations=_writes("Commit artifact files by hash", idempotent=True),
)
def artifact_commit_files(request: ArtifactCommitFilesRequest) -> dict[str, Any]:
    """Commit a whole new version as path to SHA-256, for projects on disk.

    A path left out is deleted; the land sidecar is left out. When the answer
    lists missing hashes, nothing was committed: PUT each one's exact bytes to
    its URL in uploads (curl -T file URL), or send them with
    artifact_upload_blobs when there are no uploads or your shell can't reach
    them, then commit again from the same base_version. An answer lists 64 at
    most (missing_total counts them all): repeat until nothing is missing.
    """
    return handlers.commit_files(current_actor(), request)


@_tool(
    ARTIFACT_LAND,
    tags=READ_TAGS,
    annotations=_reads("Bring an artifact's files into a folder"),
)
def artifact_land(request: ArtifactLandRequest) -> dict[str, Any]:
    """Bring a version's files, the draft by default, into a folder of its own.

    The answer lists every file with its SHA-256. Download the tar at
    download_url into the folder (curl -s URL | tar -x); without one, or when
    your shell can't reach it, call again with inline: true for the contents,
    in pages. Write the sidecar to .superset-artifact.json: the next
    artifact_commit_files names its base_version.
    """
    return handlers.land(current_actor(), request)


@_tool(
    ARTIFACT_UPLOAD_BLOBS,
    tags=WRITE_TAGS,
    annotations=_writes("Upload artifact file contents", idempotent=True),
)
def artifact_upload_blobs(request: ArtifactUploadBlobsRequest) -> dict[str, Any]:
    """Upload file contents that artifact_commit_files reported missing.

    Each blob is UTF-8 text, or base64 for a binary file. Returns their
    SHA-256 hashes, in order.
    """
    return handlers.upload_blobs(current_actor(), request)
