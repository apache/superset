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
"""The authoring handlers: the provider gate, and the answers agents get."""

from __future__ import annotations

import base64
import json  # noqa: TID251 -- pure test; the host's JSON utility needs Flask.
import re
from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from superset_core.artifacts.authoring import (
    ArtifactBuildRequest,
    ArtifactCheckRequest,
    ArtifactCommitFilesRequest,
    ArtifactCreateFileRequest,
    ArtifactCreateRequest,
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
)
from superset_core.artifacts.manifest import ArtifactManifest
from superset_core.artifacts.provider import (
    ArtifactRef,
    BuildResult,
    CheckResult,
    clear_provider,
    Diagnostic,
    FrameContext,
    FrameLink,
    register_provider,
)
from superset_core.artifacts.store import sha256_hex
from superset_core.artifacts.testing import InMemoryArtifactStore
from superset_oss.artifacts.authoring.handlers import (
    ArtifactUploadBlobsRequest,
    AuthoringHandlers,
    BlobUpload,
)
from superset_oss.artifacts.authoring.prompt_text import (
    create_artifact_text,
    import_claude_artifact_text,
)
from superset_oss.artifacts.constants import ID_PREFIX, WIDGET_TYPE

UUID = "00000000-0000-4000-8000-000000000000"
VERSION = "0" * 64
OWNER = "7"


class FakeProvider:
    def __init__(self) -> None:
        self.backend = InMemoryArtifactStore()
        self.built: list[ArtifactRef] = []

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        return FrameLink(
            url=f"https://box.example/{ref.artifact_id}",
            expires_at=datetime(2026, 11, 15, tzinfo=timezone.utc),
        )

    def build(self, ref: ArtifactRef) -> BuildResult:
        self.built.append(ref)
        return BuildResult(
            ok=False,
            diagnostics=(Diagnostic("missing import", file="index.html", line=3),),
        )

    def check(self, ref: ArtifactRef) -> CheckResult:
        return CheckResult(ok=True, console=("ready",), subscribed_to_data=True)

    def package_host(self) -> str | None:
        return None

    def store_backend(self) -> InMemoryArtifactStore:
        return self.backend


@pytest.fixture
def provider() -> Iterator[FakeProvider]:
    fake = FakeProvider()
    register_provider(fake, replace=True)
    yield fake
    clear_provider()


@pytest.fixture
def handlers() -> AuthoringHandlers:
    return AuthoringHandlers()


EVERY_CALL = [
    ("create", ArtifactCreateRequest()),
    ("view", ArtifactViewRequest(artifact_id=UUID, path=".")),
    (
        "create_file",
        ArtifactCreateFileRequest(
            artifact_id=UUID, base_version=VERSION, path="a.js", file_text=""
        ),
    ),
    (
        "str_replace",
        ArtifactStrReplaceRequest(
            artifact_id=UUID, base_version=VERSION, path="a.js", old_str="x"
        ),
    ),
    (
        "insert",
        ArtifactInsertRequest(
            artifact_id=UUID,
            base_version=VERSION,
            path="a.js",
            insert_line=0,
            insert_text="x",
        ),
    ),
    (
        "delete_file",
        ArtifactDeleteFileRequest(artifact_id=UUID, base_version=VERSION, path="a.js"),
    ),
    (
        "move_file",
        ArtifactMoveFileRequest(
            artifact_id=UUID, base_version=VERSION, old_path="a.js", new_path="b.js"
        ),
    ),
    ("search", ArtifactSearchRequest(artifact_id=UUID, query="x")),
    ("history", ArtifactHistoryRequest(artifact_id=UUID)),
    (
        "restore",
        ArtifactRestoreRequest(artifact_id=UUID, base_version=VERSION, version=VERSION),
    ),
    ("manifest_get", ArtifactManifestGetRequest(artifact_id=UUID)),
    (
        "manifest_update",
        ArtifactManifestUpdateRequest(
            artifact_id=UUID,
            base_version=VERSION,
            manifest=ArtifactManifest.model_validate({"artifact_version": "1"}),
        ),
    ),
    (
        "request_publish",
        ArtifactRequestPublishRequest(artifact_id=UUID, base_version=VERSION),
    ),
    ("build", ArtifactBuildRequest(artifact_id=UUID)),
    ("check", ArtifactCheckRequest(artifact_id=UUID)),
    (
        "commit_files",
        ArtifactCommitFilesRequest(artifact_id=UUID, base_version=VERSION, files={}),
    ),
    (
        "upload_blobs",
        ArtifactUploadBlobsRequest(artifact_id=UUID, blobs=[BlobUpload(content="x")]),
    ),
]


@pytest.mark.parametrize(("method", "request_model"), EVERY_CALL)
def test_every_tool_answers_not_enabled_without_a_provider(
    handlers: AuthoringHandlers, method: str, request_model: object
) -> None:
    clear_provider()

    answer = getattr(handlers, method)(OWNER, request_model)

    assert answer["code"] == "NOT_ENABLED"


def test_anonymous_callers_reach_nothing(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    answer = handlers.create(None, ArtifactCreateRequest())

    assert answer["code"] == "ARTIFACT_NOT_FOUND"


def test_the_authoring_flow(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    created = handlers.create(
        OWNER, ArtifactCreateRequest(title="Demo", files={"index.html": "<p>hi</p>"})
    )
    artifact_id, version = created["artifact_id"], created["version"]

    view = handlers.view(OWNER, ArtifactViewRequest(artifact_id=artifact_id, path="."))
    stale = handlers.str_replace(
        OWNER,
        ArtifactStrReplaceRequest(
            artifact_id=artifact_id,
            base_version=VERSION,
            path="index.html",
            old_str="hi",
        ),
    )
    publish = handlers.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=version),
    )

    assert view["content"] == "index.html\nmanifest.json\n"
    assert view["version"] == version
    assert stale == {
        "code": "STALE_BASE_VERSION",
        "message": stale["message"],
        "current_version": version,
    }
    assert publish["code"] == "CONFIRMATION_REQUIRED"
    assert publish["current_version"] == version
    assert publish["publish_request_id"]
    json.dumps([view, stale, publish])


def test_build_adds_the_extensions_binding_checks(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    manifest = {
        "artifact_version": "1",
        "bindings": {"sales": {"source": {"kind": "chart", "chart_id": 3}}},
        "capabilities": ["data"],
    }
    created = handlers.create(
        OWNER, ArtifactCreateRequest(files={"manifest.json": json.dumps(manifest)})
    )

    built = handlers.build(
        OWNER, ArtifactBuildRequest(artifact_id=created["artifact_id"])
    )
    checked = handlers.check(
        OWNER, ArtifactCheckRequest(artifact_id=created["artifact_id"])
    )

    assert provider.built == [ArtifactRef(created["artifact_id"], created["version"])]
    assert built["version"] == created["version"]
    assert built["ok"] is False
    assert [item["severity"] for item in built["diagnostics"]] == ["error", "warning"]
    assert "chart sources wait for S8" in built["diagnostics"][1]["message"]
    assert checked["console"] == ["ready"]
    json.dumps([built, checked])


def test_build_takes_only_this_artifacts_versions(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    created = handlers.create(OWNER, ArtifactCreateRequest())

    answer = handlers.build(
        OWNER, ArtifactBuildRequest(artifact_id=created["artifact_id"], version=VERSION)
    )

    assert answer["code"] == "VERSION_NOT_FOUND"
    assert provider.built == []


def test_commit_by_hash_with_uploads(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    created = handlers.create(OWNER, ArtifactCreateRequest())
    artifact_id, version = created["artifact_id"], created["version"]
    tree = provider.backend.get_tree("default", version)
    assert tree is not None
    files = {**tree, "logo.png": sha256_hex(b"\x89PNG")}
    request = ArtifactCommitFilesRequest(
        artifact_id=artifact_id, base_version=version, files=files
    )

    missing = handlers.commit_files(OWNER, request)
    uploaded = handlers.upload_blobs(
        OWNER,
        ArtifactUploadBlobsRequest(
            artifact_id=artifact_id,
            blobs=[
                BlobUpload(
                    content=base64.b64encode(b"\x89PNG").decode(), encoding="base64"
                )
            ],
        ),
    )
    committed = handlers.commit_files(OWNER, request)
    viewed = handlers.view(
        OWNER, ArtifactViewRequest(artifact_id=artifact_id, path="logo.png")
    )

    assert missing == {"missing": [sha256_hex(b"\x89PNG")], "version": None}
    assert uploaded == {"hashes": missing["missing"]}
    assert committed["missing"] == []
    assert viewed["content"] == "(binary file, 4 bytes)\n"
    bad = handlers.upload_blobs(
        OWNER,
        ArtifactUploadBlobsRequest(
            artifact_id=artifact_id,
            blobs=[BlobUpload(content="not base64!", encoding="base64")],
        ),
    )
    assert bad["code"] == "INVALID_ARGUMENT"


def test_the_prompts_name_the_prefixed_tools_and_a_valid_manifest() -> None:
    text = create_artifact_text()
    example = re.search(r"```json\n(.*?)```", text, re.S)

    assert f"`{ID_PREFIX}artifact_str_replace`" in text
    assert f"`{ID_PREFIX}artifact_upload_blobs`" in text
    assert WIDGET_TYPE in text
    assert example is not None
    ArtifactManifest.model_validate_json(example.group(1))
    assert "window.claude.complete" in import_claude_artifact_text()
