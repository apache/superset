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

"""The authoring tool contract: tool names, request models and responses."""

from __future__ import annotations

from typing import Any, get_args

import pytest
from pydantic import ValidationError
from superset_core.artifacts import authoring
from superset_core.artifacts.authoring import (
    ArtifactBuildRequest,
    ArtifactCommitFilesRequest,
    ArtifactCommitFilesResponse,
    ArtifactCreateFileRequest,
    ArtifactCreateRequest,
    ArtifactHistoryRequest,
    ArtifactInsertRequest,
    ArtifactManifestUpdateRequest,
    ArtifactMoveFileRequest,
    ArtifactSearchRequest,
    ArtifactStrReplaceRequest,
    ArtifactViewRequest,
    ArtifactWriteRequest,
    AuthoringErrorCode,
    AuthoringErrorResponse,
    TOOL_REQUESTS,
)
from superset_core.artifacts.manifest import ArtifactManifest
from superset_core.artifacts.store import DRAFT_REF, PUBLISHED_REF, sha256_hex

VERSION = sha256_hex(b"draft version")
BLOB = sha256_hex(b"<html></html>")
TOOL_NAMES = [
    "artifact_create",
    "artifact_view",
    "artifact_create_file",
    "artifact_str_replace",
    "artifact_insert",
    "artifact_delete_file",
    "artifact_move_file",
    "artifact_search",
    "artifact_history",
    "artifact_restore",
    "artifact_manifest_get",
    "artifact_manifest_update",
    "artifact_request_publish",
    "artifact_build",
    "artifact_check",
    "artifact_commit_files",
]
WRITE_TOOLS = {
    "artifact_create_file",
    "artifact_str_replace",
    "artifact_insert",
    "artifact_delete_file",
    "artifact_move_file",
    "artifact_restore",
    "artifact_manifest_update",
    "artifact_request_publish",
    "artifact_commit_files",
}


def _write(**fields: Any) -> dict[str, Any]:
    """The fields every write request carries, plus ``fields``."""
    return {"artifact_id": "artifact-1", "base_version": VERSION, **fields}


def _view(**fields: Any) -> ArtifactViewRequest:
    return ArtifactViewRequest.model_validate({"artifact_id": "artifact-1", **fields})


def test_tool_names_are_the_contracts_tools() -> None:
    assert list(TOOL_REQUESTS) == TOOL_NAMES
    constants = {
        value for name, value in vars(authoring).items() if name.startswith("ARTIFACT_")
    }
    assert constants == set(TOOL_NAMES)


@pytest.mark.parametrize("tool", sorted(WRITE_TOOLS))
def test_write_tools_name_their_base_version(tool: str) -> None:
    model = TOOL_REQUESTS[tool]
    assert issubclass(model, ArtifactWriteRequest)
    assert model.model_fields["base_version"].is_required()


@pytest.mark.parametrize("tool", sorted(set(TOOL_NAMES) - WRITE_TOOLS))
def test_read_tools_and_create_have_no_base_version(tool: str) -> None:
    assert "base_version" not in TOOL_REQUESTS[tool].model_fields


@pytest.mark.parametrize("base_version", ["v5", VERSION.upper(), VERSION[:-1], ""])
def test_base_version_is_a_tree_hash(base_version: str) -> None:
    with pytest.raises(ValidationError, match="base_version"):
        ArtifactStrReplaceRequest.model_validate(
            _write(base_version=base_version, path="index.html", old_str="a")
        )


def test_undeclared_fields_are_rejected() -> None:
    """A misnamed parameter, such as ``old_string``, fails rather than vanish."""
    with pytest.raises(ValidationError, match="old_string"):
        ArtifactStrReplaceRequest.model_validate(
            _write(path="index.html", old_str="a", old_string="a")
        )


def test_paths_are_normalized() -> None:
    request = ArtifactCreateFileRequest.model_validate(
        _write(path="./src//app.js", file_text="export {};\n")
    )
    assert request.path == "src/app.js"


@pytest.mark.parametrize("path", ["../secrets.txt", "/etc/passwd", "src\\app.js", ""])
def test_unsafe_paths_are_rejected(path: str) -> None:
    with pytest.raises(ValidationError, match="path"):
        ArtifactCreateFileRequest.model_validate(_write(path=path, file_text=""))


def test_view_accepts_the_root_directory() -> None:
    assert _view(path=".").path == "."
    assert _view(path="./").path == "."
    assert _view(path="./src/").path == "src"


@pytest.mark.parametrize("view_range", [[1, 1], [1, 40], [10, -1]])
def test_view_ranges_are_one_indexed_and_inclusive(view_range: list[int]) -> None:
    assert _view(path="index.html", view_range=view_range).view_range == tuple(
        view_range
    )


@pytest.mark.parametrize("view_range", [[0, 3], [5, 2], [1, -2], [-1, -1]])
def test_invalid_view_ranges_are_rejected(view_range: list[int]) -> None:
    with pytest.raises(ValidationError, match="view_range"):
        _view(path="index.html", view_range=view_range)


def test_pages_count_from_one() -> None:
    assert _view(path="index.html", page=1).page == 1
    with pytest.raises(ValidationError, match="page"):
        _view(path="index.html", page=0)


def test_str_replace_needs_an_old_string_and_defaults_to_deleting() -> None:
    request = ArtifactStrReplaceRequest.model_validate(
        _write(path="index.html", old_str="<b>")
    )
    assert request.new_str == ""
    with pytest.raises(ValidationError, match="old_str"):
        ArtifactStrReplaceRequest.model_validate(_write(path="index.html", old_str=""))


def test_insert_line_zero_is_the_start_of_the_file() -> None:
    request = ArtifactInsertRequest.model_validate(
        _write(path="index.html", insert_line=0, insert_text="<!doctype html>\n")
    )
    assert request.insert_line == 0
    with pytest.raises(ValidationError, match="insert_line"):
        ArtifactInsertRequest.model_validate(
            _write(path="index.html", insert_line=-1, insert_text="x")
        )


def test_move_needs_two_different_files() -> None:
    request = ArtifactMoveFileRequest.model_validate(
        _write(old_path="app.js", new_path="src/app.js")
    )
    assert (request.old_path, request.new_path) == ("app.js", "src/app.js")
    with pytest.raises(ValidationError, match="same file"):
        ArtifactMoveFileRequest.model_validate(
            _write(old_path="app.js", new_path="./app.js")
        )


def test_search_is_plain_text_under_an_optional_path() -> None:
    request = ArtifactSearchRequest.model_validate(
        {"artifact_id": "artifact-1", "query": "superset.data(", "path": "./src"}
    )
    assert request.path == "src"
    with pytest.raises(ValidationError, match="query"):
        ArtifactSearchRequest.model_validate({"artifact_id": "artifact-1", "query": ""})


def test_history_refs_are_the_store_refs() -> None:
    annotation = ArtifactHistoryRequest.model_fields["ref"].annotation
    assert get_args(annotation) == (DRAFT_REF, PUBLISHED_REF)
    request = ArtifactHistoryRequest.model_validate({"artifact_id": "artifact-1"})
    assert request.ref == DRAFT_REF
    with pytest.raises(ValidationError, match="ref"):
        ArtifactHistoryRequest.model_validate(
            {"artifact_id": "artifact-1", "ref": "main"}
        )


def test_build_defaults_to_the_draft() -> None:
    assert (
        ArtifactBuildRequest.model_validate({"artifact_id": "artifact-1"}).version
        is None
    )
    with pytest.raises(ValidationError, match="version"):
        ArtifactBuildRequest.model_validate(
            {"artifact_id": "artifact-1", "version": "latest"}
        )


def test_manifest_update_validates_the_manifest() -> None:
    manifest = {
        "artifact_version": "1",
        "bindings": {"sales": {"source": {"kind": "dataset", "dataset_id": 1}}},
    }
    with pytest.raises(ValidationError, match="'data' capability"):
        ArtifactManifestUpdateRequest.model_validate(_write(manifest=manifest))
    request = ArtifactManifestUpdateRequest.model_validate(
        _write(manifest={**manifest, "capabilities": ["data"]})
    )
    assert isinstance(request.manifest, ArtifactManifest)


def test_create_normalizes_file_paths() -> None:
    request = ArtifactCreateRequest.model_validate(
        {"title": "Globe", "files": {"./index.html": "<html></html>"}}
    )
    assert request.files == {"index.html": "<html></html>"}
    with pytest.raises(ValidationError, match="same file"):
        ArtifactCreateRequest.model_validate(
            {"files": {"index.html": "a", "./index.html": "b"}}
        )


def test_commit_files_takes_a_whole_tree_by_hash() -> None:
    request = ArtifactCommitFilesRequest.model_validate(
        _write(files={"./index.html": BLOB, "src/app.js": VERSION})
    )
    assert request.files == {"index.html": BLOB, "src/app.js": VERSION}
    empty = ArtifactCommitFilesRequest.model_validate(_write(files={}))
    assert empty.files == {}


@pytest.mark.parametrize(
    ("files", "message"),
    [
        ({"index.html": BLOB.upper()}, "files"),
        ({"index.html": "not-a-hash"}, "files"),
        ({"../index.html": BLOB}, "'..' segment"),
        ({"index.html": BLOB, "./index.html": BLOB}, "same file"),
        ({"src": BLOB, "src/app.js": BLOB}, "is a file"),
    ],
)
def test_commit_files_rejects_invalid_trees(
    files: dict[str, str], message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        ArtifactCommitFilesRequest.model_validate(_write(files=files))


def test_commit_files_response_is_missing_blobs_or_a_version() -> None:
    missing = ArtifactCommitFilesResponse(missing=[BLOB])
    assert missing.version is None
    committed = ArtifactCommitFilesResponse(version=VERSION)
    assert committed.missing == []
    with pytest.raises(ValidationError, match="not both or neither"):
        ArtifactCommitFilesResponse(missing=[BLOB], version=VERSION)
    with pytest.raises(ValidationError, match="not both or neither"):
        ArtifactCommitFilesResponse()


def test_error_codes() -> None:
    assert {code.name for code in AuthoringErrorCode} == {
        "STALE_BASE_VERSION",
        "ARTIFACT_NOT_FOUND",
        "VERSION_NOT_FOUND",
        "FILE_NOT_FOUND",
        "FILE_EXISTS",
        "NO_MATCH",
        "MULTIPLE_MATCHES",
        "INVALID_PATH",
        "INVALID_MANIFEST",
        "INVALID_ARGUMENT",
        "TOO_LARGE",
        "NOT_ENABLED",
        "CONFIRMATION_REQUIRED",
    }
    assert all(code.value == code.name for code in AuthoringErrorCode)


def test_a_stale_write_error_carries_the_current_version() -> None:
    error = AuthoringErrorResponse.model_validate(
        {
            "code": "STALE_BASE_VERSION",
            "message": "The draft has moved; view it again.",
            "current_version": VERSION,
        }
    )
    assert error.code is AuthoringErrorCode.STALE_BASE_VERSION
    assert error.model_dump(mode="json")["code"] == "STALE_BASE_VERSION"
