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

RBAC reuses the Canvas permissions: can_read on Canvas to read, can_write to
write. Operators can remove any of the tools with ``MCP_DISABLED_TOOLS``.
"""

# TODO: decorators that don't raise when the MCP extras aren't installed;
# without them ``@tool`` raises, which the entry point catches.
# TODO: tools denied by default until a deployment allows them, tools offered
# by what the caller's token entitles, and a narrow OAuth scope for authoring.

from __future__ import annotations

from typing import Any

from superset_artifacts_sdk.authoring import (
    ARTIFACT_BUILD,
    ARTIFACT_CHECK,
    ARTIFACT_COMMIT_FILES,
    ARTIFACT_CREATE,
    ARTIFACT_CREATE_FILE,
    ARTIFACT_DELETE_FILE,
    ARTIFACT_HISTORY,
    ARTIFACT_INSERT,
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
from superset_oss.artifacts.constants import ARTIFACT_UPLOAD_BLOBS
from superset_oss.artifacts.web import current_actor

PERMISSION = "Canvas"
READ_TAGS = ["artifacts"]
WRITE_TAGS = ["artifacts", "mutate"]

handlers = AuthoringHandlers()


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


@tool(
    name=ARTIFACT_CREATE,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Create an artifact", idempotent=False),
)
def artifact_create(request: ArtifactCreateRequest) -> dict[str, Any]:
    """Start a new artifact from its first files (path to text).

    Without a manifest.json among them, the artifact starts from a minimal one.
    Read the create_artifact prompt first. Returns the artifact_id and the
    first version, which the next write names as base_version.
    """
    return handlers.create(current_actor(), request)


@tool(
    name=ARTIFACT_VIEW,
    tags=READ_TAGS,
    class_permission_name=PERMISSION,
    annotations=_reads("View an artifact file"),
)
def artifact_view(request: ArtifactViewRequest) -> dict[str, Any]:
    """Read a draft file with line numbers, or list a directory ("." is the root).

    view_range picks lines [start, end], 1-indexed; an end of -1 reads to the
    end. Long results come in pages of about 40 KB: pass page to read on.
    Returns the draft version that was read.
    """
    return handlers.view(current_actor(), request)


@tool(
    name=ARTIFACT_CREATE_FILE,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Create an artifact file", idempotent=True),
)
def artifact_create_file(request: ArtifactCreateFileRequest) -> dict[str, Any]:
    """Add a new file to the draft. FILE_EXISTS when the path is taken.

    Returns the new draft version.
    """
    return handlers.create_file(current_actor(), request)


@tool(
    name=ARTIFACT_STR_REPLACE,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Edit an artifact file", idempotent=True),
)
def artifact_str_replace(request: ArtifactStrReplaceRequest) -> dict[str, Any]:
    """Replace one exact string in a draft file; an empty new_str deletes it.

    old_str must appear exactly once, whitespace included: NO_MATCH or
    MULTIPLE_MATCHES otherwise. Returns the new draft version.
    """
    return handlers.str_replace(current_actor(), request)


@tool(
    name=ARTIFACT_INSERT,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Insert into an artifact file", idempotent=True),
)
def artifact_insert(request: ArtifactInsertRequest) -> dict[str, Any]:
    """Insert text after line insert_line of a draft file; 0 is the start.

    Returns the new draft version.
    """
    return handlers.insert(current_actor(), request)


@tool(
    name=ARTIFACT_DELETE_FILE,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Delete an artifact file", idempotent=True, destructive=True),
)
def artifact_delete_file(request: ArtifactDeleteFileRequest) -> dict[str, Any]:
    """Delete one file from the draft; earlier versions keep it.

    manifest.json can't be deleted. Returns the new draft version.
    """
    return handlers.delete_file(current_actor(), request)


@tool(
    name=ARTIFACT_MOVE_FILE,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Move an artifact file", idempotent=True),
)
def artifact_move_file(request: ArtifactMoveFileRequest) -> dict[str, Any]:
    """Move or rename one draft file. FILE_EXISTS when new_path is taken.

    Returns the new draft version.
    """
    return handlers.move_file(current_actor(), request)


@tool(
    name=ARTIFACT_SEARCH,
    tags=READ_TAGS,
    class_permission_name=PERMISSION,
    annotations=_reads("Search an artifact"),
)
def artifact_search(request: ArtifactSearchRequest) -> dict[str, Any]:
    """Find plain, case-sensitive text in the draft's files, or under path.

    Returns the matching lines with their paths and line numbers, in pages.
    """
    return handlers.search(current_actor(), request)


@tool(
    name=ARTIFACT_HISTORY,
    tags=READ_TAGS,
    class_permission_name=PERMISSION,
    annotations=_reads("List an artifact's versions"),
)
def artifact_history(request: ArtifactHistoryRequest) -> dict[str, Any]:
    """List the versions the draft (or the published ref) has pointed to.

    Newest first, in pages of 100.
    """
    return handlers.history(current_actor(), request)


@tool(
    name=ARTIFACT_RESTORE,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Restore an artifact version", idempotent=True),
)
def artifact_restore(request: ArtifactRestoreRequest) -> dict[str, Any]:
    """Make an earlier version's files the draft again, as a new history entry.

    Returns the new draft version, which equals the restored one.
    """
    return handlers.restore(current_actor(), request)


@tool(
    name=ARTIFACT_MANIFEST_GET,
    tags=READ_TAGS,
    class_permission_name=PERMISSION,
    annotations=_reads("Read an artifact's manifest"),
)
def artifact_manifest_get(request: ArtifactManifestGetRequest) -> dict[str, Any]:
    """Read the draft's validated manifest.json, and the draft version."""
    return handlers.manifest_get(current_actor(), request)


@tool(
    name=ARTIFACT_MANIFEST_UPDATE,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Update an artifact's manifest", idempotent=True),
)
def artifact_manifest_update(
    request: ArtifactManifestUpdateArguments,
) -> dict[str, Any]:
    """Replace the draft's manifest.json: bindings, events, capabilities, packages.

    Returns the new draft version.
    """
    return handlers.manifest_update(current_actor(), request)


@tool(
    name=ARTIFACT_REQUEST_PUBLISH,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
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


@tool(
    name=ARTIFACT_BUILD,
    tags=READ_TAGS,
    class_permission_name=PERMISSION,
    annotations=_reads("Build an artifact"),
)
def artifact_build(request: ArtifactBuildRequest) -> dict[str, Any]:
    """Build a version, the draft by default, and report what to fix.

    Compile errors, imports that don't resolve, APIs the sandbox blocks and
    bindings that can't run.
    """
    return handlers.build(current_actor(), request)


@tool(
    name=ARTIFACT_CHECK,
    tags=READ_TAGS,
    class_permission_name=PERMISSION,
    annotations=_reads("Check an artifact in a browser"),
)
def artifact_check(request: ArtifactCheckRequest) -> dict[str, Any]:
    """Run a version, the draft by default, in an isolated headless browser.

    Reports uncaught errors, console output, CSP violations, whether it asked
    for its data, and a summary of what it rendered.
    """
    return handlers.check(current_actor(), request)


@tool(
    name=ARTIFACT_COMMIT_FILES,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Commit artifact files by hash", idempotent=True),
)
def artifact_commit_files(request: ArtifactCommitFilesRequest) -> dict[str, Any]:
    """Commit a whole new version as path to SHA-256, for projects on disk.

    A path left out is deleted. When the answer lists missing hashes, nothing
    was committed: upload them with artifact_upload_blobs, then commit again
    from the same base_version.
    """
    return handlers.commit_files(current_actor(), request)


@tool(
    name=ARTIFACT_UPLOAD_BLOBS,
    tags=WRITE_TAGS,
    class_permission_name=PERMISSION,
    annotations=_writes("Upload artifact file contents", idempotent=True),
)
def artifact_upload_blobs(request: ArtifactUploadBlobsRequest) -> dict[str, Any]:
    """Upload file contents that artifact_commit_files reported missing.

    Each blob is UTF-8 text, or base64 for a binary file. Returns their
    SHA-256 hashes, in order.
    """
    return handlers.upload_blobs(current_actor(), request)
