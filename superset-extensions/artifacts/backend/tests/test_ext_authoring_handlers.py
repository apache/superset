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
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

import pytest
from superset_artifacts_sdk.authoring import (
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
from superset_artifacts_sdk.manifest import ArtifactManifest
from superset_artifacts_sdk.policy import ArtifactPolicy, LOCKED, policy_layer
from superset_artifacts_sdk.provider import (
    ArtifactRef,
    BuildResult,
    CheckResult,
    Diagnostic,
    FrameContext,
    FrameLink,
    VersionNotFoundError,
)
from superset_artifacts_sdk.registry import clear_provider, register_provider
from superset_artifacts_sdk.store import DRAFT_REF, sha256_hex
from superset_artifacts_sdk.testing import InMemoryArtifactStore
from superset_oss.artifacts.authoring.handlers import (
    ArtifactManifestUpdateArguments,
    ArtifactUploadBlobsRequest,
    AuthoringHandlers,
    BlobUpload,
)
from superset_oss.artifacts.authoring.prompt_text import (
    create_artifact_text,
    import_claude_artifact_text,
)
from superset_oss.artifacts.constants import ID_PREFIX, WIDGET_TYPE
from superset_oss.artifacts.gate import artifacts_on, configure

UUID = "00000000-0000-4000-8000-000000000000"
VERSION = "0" * 64
OWNER = "7"
READER = "8"
STRANGER = "9"


class FakeProvider:
    def __init__(self) -> None:
        self.backend: InMemoryArtifactStore | None = InMemoryArtifactStore()
        self.built: list[tuple[ArtifactRef, ArtifactPolicy]] = []
        self.layer: Mapping[str, Any] | None = None
        # Whether its store has lost every version, as after a publish that
        # lands between the tool reading a version and the provider call.
        self.lost_versions = False

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        return FrameLink(
            url=f"https://box.example/{ref.artifact_id}",
            expires_at=datetime(2026, 11, 15, tzinfo=timezone.utc),
        )

    def frame_sources(self) -> Sequence[str]:
        return ("https://box.example",)

    def build(self, ref: ArtifactRef, policy: ArtifactPolicy) -> BuildResult:
        if self.lost_versions:
            raise VersionNotFoundError(f"no version {ref.version}")
        self.built.append((ref, policy))
        return BuildResult(
            ok=False,
            diagnostics=(Diagnostic("missing import", file="index.html", line=3),),
        )

    def check(self, ref: ArtifactRef, policy: ArtifactPolicy) -> CheckResult:
        if self.lost_versions:
            raise VersionNotFoundError(f"no version {ref.version}")
        return CheckResult(ok=True, console=("ready",), subscribed_to_data=True)

    def store_backend(self) -> InMemoryArtifactStore | None:
        return self.backend

    def policy_layer(self) -> Mapping[str, Any] | None:
        return self.layer


class FakeAccess:
    """The artifacts' widgets: who reads and who edits each, as ``caller`` asks."""

    def __init__(self) -> None:
        self.caller = OWNER
        self.editors: dict[str, set[str]] = {}
        self.readers: dict[str, set[str]] = {}
        self.registered: list[tuple[str, str, str]] = []

    def register(self, artifact_id: str, name: str, editor: str) -> None:
        self.registered.append((artifact_id, name, editor))
        self.editors.setdefault(artifact_id, set()).add(editor)

    def can_read(self, artifact_id: str) -> bool:
        return self.can_edit(artifact_id) or self.caller in self.readers.get(
            artifact_id, set()
        )

    def can_edit(self, artifact_id: str) -> bool:
        return self.caller in self.editors.get(artifact_id, set())


@pytest.fixture
def access() -> Iterator[FakeAccess]:
    fake = FakeAccess()
    configure(deployment_policy=None, access=fake)
    yield fake
    configure(deployment_policy=None, access=None)


@pytest.fixture
def provider(access: FakeAccess) -> Iterator[FakeProvider]:
    fake = FakeProvider()
    register_provider(fake, replace=True)
    yield fake
    clear_provider()


@contextmanager
def deployment_policy(access: FakeAccess, layer: dict[str, Any]) -> Iterator[None]:
    configure(deployment_policy=layer, access=access)
    try:
        yield
    finally:
        configure(deployment_policy=None, access=access)


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
        ArtifactManifestUpdateArguments(
            artifact_id=UUID,
            base_version=VERSION,
            manifest={"artifact_version": "1"},
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
    assert not artifacts_on()


def test_a_provider_without_a_store_backend_leaves_artifacts_off(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    provider.backend = None

    answer = handlers.create(OWNER, ArtifactCreateRequest())

    assert answer["code"] == "NOT_ENABLED"
    assert not artifacts_on()


def test_anonymous_callers_reach_nothing(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    answer = handlers.create(None, ArtifactCreateRequest())

    assert answer["code"] == "ARTIFACT_NOT_FOUND"


def test_the_authoring_flow(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    assert artifacts_on()
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


# A cross_filter event needs the cross_filter capability, which this lacks.
CROSS_FILTER_WITHOUT_ITS_CAPABILITY = {
    "artifact_version": "1",
    "bindings": {
        "sales": {
            "source": {"kind": "dataset", "dataset_id": 42},
            "metrics": ["revenue"],
            "dimensions": ["region"],
        }
    },
    "events": [{"kind": "cross_filter", "binding": "sales", "dimension": "region"}],
    "capabilities": ["data"],
}


def test_the_manifest_update_arguments_take_the_manifest_as_sent() -> None:
    """
    A manifest that the checks refuse still makes valid arguments, so that the
    tool runs and can say what's wrong; agents still see the manifest's schema.
    """
    arguments = ArtifactManifestUpdateArguments.model_validate(
        {
            "artifact_id": UUID,
            "base_version": VERSION,
            "manifest": CROSS_FILTER_WITHOUT_ITS_CAPABILITY,
        }
    )
    published = ArtifactManifestUpdateArguments.model_json_schema()
    contract = ArtifactManifestUpdateRequest.model_json_schema()

    assert arguments.manifest == CROSS_FILTER_WITHOUT_ITS_CAPABILITY
    assert published["properties"]["manifest"]["$ref"] == "#/$defs/ArtifactManifest"
    assert published["$defs"] == contract["$defs"]


def test_a_manifest_update_answers_what_is_wrong_with_the_manifest(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    created = handlers.create(OWNER, ArtifactCreateRequest())
    artifact_id, version = created["artifact_id"], created["version"]

    def update(manifest: object) -> dict[str, Any]:
        return handlers.manifest_update(
            OWNER,
            ArtifactManifestUpdateArguments(
                artifact_id=artifact_id, base_version=version, manifest=manifest
            ),
        )

    refused = update(CROSS_FILTER_WITHOUT_ITS_CAPABILITY)
    fixed = update(
        {
            **CROSS_FILTER_WITHOUT_ITS_CAPABILITY,
            "capabilities": ["data", "cross_filter"],
        }
    )
    stored = handlers.manifest_get(
        OWNER, ArtifactManifestGetRequest(artifact_id=artifact_id)
    )

    message = refused["message"]
    assert refused["code"] == "INVALID_MANIFEST"
    assert message.startswith("manifest.json is invalid: ")
    assert "cross_filter events need the 'cross_filter' capability" in message
    # The refusal left the draft where it was, so the fix applies to it.
    assert "code" not in fixed
    assert stored["version"] == fixed["version"] != version
    assert stored["manifest"]["capabilities"] == ["data", "cross_filter"]
    json.dumps([refused, fixed])


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

    # The build gets the request's policy: Locked, with no deployment layer.
    assert provider.built == [
        (ArtifactRef(created["artifact_id"], created["version"]), LOCKED)
    ]
    assert built["version"] == created["version"]
    assert built["ok"] is False
    assert [item["severity"] for item in built["diagnostics"]] == ["error", "warning"]
    warning = built["diagnostics"][1]
    assert "chart sources don't map" in warning["message"]
    assert warning == {
        "message": warning["message"],
        "severity": "warning",
        "file": "manifest.json",
        "line": None,
        "column": None,
    }
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


def test_build_and_check_answer_a_version_the_provider_lost(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    created = handlers.create(OWNER, ArtifactCreateRequest())
    provider.lost_versions = True

    built = handlers.build(
        OWNER, ArtifactBuildRequest(artifact_id=created["artifact_id"])
    )
    checked = handlers.check(
        OWNER, ArtifactCheckRequest(artifact_id=created["artifact_id"])
    )

    assert built["code"] == checked["code"] == "VERSION_NOT_FOUND"
    assert created["version"] in built["message"]
    assert provider.built == []


def test_commit_by_hash_with_uploads(
    handlers: AuthoringHandlers, provider: FakeProvider
) -> None:
    created = handlers.create(OWNER, ArtifactCreateRequest())
    artifact_id, version = created["artifact_id"], created["version"]
    assert provider.backend is not None
    tree = provider.backend.get_tree(version)
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
    text = create_artifact_text(LOCKED)
    example = re.search(r"```json\n(.*?)```", text, re.S)

    assert f"`{ID_PREFIX}artifact_str_replace`" in text
    assert f"`{ID_PREFIX}artifact_upload_blobs`" in text
    assert WIDGET_TYPE in text
    assert example is not None
    ArtifactManifest.model_validate_json(example.group(1))
    assert "window.claude.complete" in import_claude_artifact_text()


def test_the_prompt_teaches_no_parameter_values() -> None:
    """The host refuses every parameter value, so the contract can't teach one."""
    text = create_artifact_text(LOCKED)
    example = re.search(r"```json\n(.*?)```", text, re.S)

    assert example is not None
    declared = ArtifactManifest.model_validate_json(example.group(1))
    assert [name for name, b in declared.bindings.items() if b.parameters] == []
    assert re.findall(r"superset\.query\(([^)]*)\)", text) == ['"revenue_by_region"']


def test_the_providers_layer_narrows_the_deployments_policy(
    provider: FakeProvider, handlers: AuthoringHandlers, access: FakeAccess
) -> None:
    """A workspace can only narrow: with no deployment layer, it stays Locked."""
    provider.layer = {"profile": "open"}
    created = handlers.create(OWNER, ArtifactCreateRequest())
    handlers.build(OWNER, ArtifactBuildRequest(artifact_id=created["artifact_id"]))

    with deployment_policy(access, {"profile": "standard"}):
        handlers.build(OWNER, ArtifactBuildRequest(artifact_id=created["artifact_id"]))

    assert [policy.profile for _, policy in provider.built] == ["locked", "standard"]


def test_the_prompt_teaches_what_the_policy_allows() -> None:
    def prose(policy: ArtifactPolicy) -> str:
        return " ".join(create_artifact_text(policy).split())

    locked = prose(LOCKED)
    assert "policy is locked" in locked
    assert "No npm packages here" in locked
    assert "No workers, no WebAssembly" in locked

    allowlist = prose(
        policy_layer({"profile": "standard", "packages": {"allow": ["three", "d3"]}})
    )
    assert "Only these packages are allowed: d3, three." in allowlist
    assert "WebAssembly (declare `compute.wasm`) work" in allowlist


def test_a_build_fails_for_what_the_policy_refuses(
    provider: FakeProvider, handlers: AuthoringHandlers, access: FakeAccess
) -> None:
    """A draft the policy refuses fails its build, even if the provider's passes."""
    with deployment_policy(access, {"profile": "open"}):
        created = handlers.create(
            OWNER,
            ArtifactCreateRequest(
                files={
                    "manifest.json": json.dumps(
                        {"artifact_version": "1", "dependencies": {"d3": "7.9.0"}}
                    )
                }
            ),
        )

    built = handlers.build(
        OWNER, ArtifactBuildRequest(artifact_id=created["artifact_id"])
    )

    assert built["ok"] is False
    assert any("'d3'" in item["message"] for item in built["diagnostics"])


def test_the_artifact_is_its_saved_widget(
    handlers: AuthoringHandlers, provider: FakeProvider, access: FakeAccess
) -> None:
    """Creating an artifact saves its widget, with its author as its editor."""
    created = handlers.create(OWNER, ArtifactCreateRequest(title="Revenue globe"))

    assert access.registered == [(created["artifact_id"], "Revenue globe", OWNER)]
    assert provider.backend is not None
    assert (
        provider.backend.get_ref(created["artifact_id"], DRAFT_REF)
        == (created["version"])
    )


def test_readers_view_and_only_editors_change_an_artifact(
    handlers: AuthoringHandlers, provider: FakeProvider, access: FakeAccess
) -> None:
    created = handlers.create(OWNER, ArtifactCreateRequest(files={"a.js": "x"}))
    artifact_id, version = created["artifact_id"], created["version"]
    access.readers[artifact_id] = {READER}
    view = ArtifactViewRequest(artifact_id=artifact_id, path="a.js")
    edit = ArtifactStrReplaceRequest(
        artifact_id=artifact_id, base_version=version, path="a.js", old_str="x"
    )
    publish = ArtifactRequestPublishRequest(
        artifact_id=artifact_id, base_version=version
    )

    access.caller = READER
    assert "x" in handlers.view(READER, view)["content"]
    assert handlers.str_replace(READER, edit)["code"] == "ARTIFACT_NOT_FOUND"
    assert handlers.request_publish(READER, publish)["code"] == "ARTIFACT_NOT_FOUND"
    assert handlers.build(READER, ArtifactBuildRequest(artifact_id=artifact_id))[
        "code"
    ] == ("ARTIFACT_NOT_FOUND")

    access.caller = STRANGER
    assert handlers.view(STRANGER, view)["code"] == "ARTIFACT_NOT_FOUND"
