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
"""Frames: which version a viewer gets, and the context its link is minted for."""

from __future__ import annotations

import json  # noqa: TID251 -- pure test; the host's JSON utility needs Flask.
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from superset_artifacts_sdk.authoring import (
    ArtifactCreateRequest,
    ArtifactRequestPublishRequest,
    ArtifactStrReplaceRequest,
    AuthoringErrorCode,
)
from superset_artifacts_sdk.capabilities import Capability
from superset_artifacts_sdk.manifest import ArtifactManifest
from superset_artifacts_sdk.policy import (
    ArtifactPolicy,
    FrameMode,
    LOCKED,
    policy_layer,
)
from superset_artifacts_sdk.provider import (
    ArtifactRef,
    FrameContext,
    FrameLink,
    VersionNotFoundError,
)
from superset_artifacts_sdk.testing import InMemoryArtifactStore
from superset_core.canvas import placements
from superset_core.widgets import Widget
from superset_oss.artifacts.canvas.controls import ArtifactControls
from superset_oss.artifacts.constants import WIDGET_TYPE
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import choose_version, ServedVersion
from superset_oss.artifacts.frames.grants import (
    frame_context,
    host_manifest,
    origin_of,
)
from superset_oss.artifacts.frames.links import link_payload
from superset_oss.artifacts.frames.placement import (
    placement_artifact,
    PlacementNotFoundError,
)
from superset_oss.artifacts.store.filestore import ArtifactFileStore

OWNER = "1"
MANIFEST = ArtifactManifest.model_validate(
    {
        "artifact_version": "1",
        "title": "Revenue",
        "bindings": {
            "revenue": {
                "source": {"kind": "dataset", "dataset_id": 42},
                "metrics": ["revenue"],
                "dimensions": ["region"],
            }
        },
        "events": [
            {"kind": "cross_filter", "binding": "revenue", "dimension": "region"}
        ],
        "capabilities": ["data", "cross_filter", "theme", "compute.wasm"],
    }
)
STANDARD = policy_layer({"profile": "standard"})


def test_the_grant_is_manifest_policy_and_context() -> None:
    def grant(
        mode: FrameMode, policy: ArtifactPolicy = STANDARD
    ) -> frozenset[Capability]:
        return frame_context(
            mode, MANIFEST, policy, "https://superset.example.com/"
        ).capabilities

    assert grant("canvas") == {
        Capability.DATA,
        Capability.CROSS_FILTER,
        Capability.THEME,
        Capability.COMPUTE_WASM,
    }
    assert grant("standalone") == {
        Capability.DATA,
        Capability.THEME,
        Capability.COMPUTE_WASM,
    }
    # Locked allows no WebAssembly, whatever the manifest asks.
    assert Capability.COMPUTE_WASM not in grant("canvas", LOCKED)


def test_allowed_parents_are_origins() -> None:
    context = frame_context(
        "canvas", MANIFEST, LOCKED, "https://Superset.example.com:8443/canvas/1/"
    )

    assert context.allowed_parents == ("https://superset.example.com:8443",)
    assert origin_of("http://[::1]:8088/x") == "http://[::1]:8088"
    for bad in ("javascript:alert(1)", "file:///etc", "//no-scheme"):
        with pytest.raises(ValueError, match="no http or https origin"):
            origin_of(bad)


def test_the_host_gets_what_it_checks_requests_against() -> None:
    checked = host_manifest(MANIFEST)

    assert set(checked) == {"title", "bindings", "events", "capabilities"}
    assert checked["bindings"]["revenue"]["source"] == {
        "kind": "dataset",
        "dataset_id": 42,
    }
    json.dumps(checked)


@pytest.fixture
def store() -> ArtifactFileStore:
    return ArtifactFileStore(InMemoryArtifactStore(), policy=STANDARD)


def create(store: ArtifactFileStore, **files: str) -> tuple[str, str]:
    created = store.create(str(uuid4()), ArtifactCreateRequest(files=files))
    return created.artifact_id, created.version


def test_editors_get_drafts_and_others_only_published_versions(
    store: ArtifactFileStore,
) -> None:
    artifact_id, first = create(store, **{"index.html": "v1"})

    assert choose_version(store, artifact_id, can_edit=True) == ServedVersion(
        artifact_id, first, is_draft=True, can_edit=True
    )
    with pytest.raises(ArtifactError, match="isn't published"):
        choose_version(store, artifact_id, can_edit=False)

    publish = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=first),
    )
    store.confirm_publish(OWNER, artifact_id, publish.request_id)
    second = store.str_replace(
        ArtifactStrReplaceRequest(
            artifact_id=artifact_id,
            base_version=first,
            path="index.html",
            old_str="v1",
            new_str="v2",
        ),
    ).version

    assert choose_version(store, artifact_id, can_edit=False).version == first
    assert choose_version(store, artifact_id, can_edit=True).version == first
    assert (
        choose_version(store, artifact_id, can_edit=True, use_draft=True).version
        == second
    )
    # A viewer in a draft of the canvas still gets the published version.
    assert (
        choose_version(store, artifact_id, can_edit=False, use_draft=True).version
        == first
    )


class RecordingMinter:
    """A provider's frame-link role and nothing else."""

    def __init__(self) -> None:
        self.minted: list[tuple[ArtifactRef, FrameContext]] = []

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        self.minted.append((ref, context))
        return FrameLink(
            url="https://box.example/frame",
            expires_at=datetime(2026, 11, 15, tzinfo=timezone.utc),
        )


def test_a_link_is_minted_for_the_served_version_in_its_context(
    store: ArtifactFileStore,
) -> None:
    files = {"manifest.json": MANIFEST.model_dump_json()}
    created = store.create(str(uuid4()), ArtifactCreateRequest(files=files))
    served = choose_version(store, created.artifact_id, can_edit=True)
    minter = RecordingMinter()

    answer = link_payload(
        minter,
        store,
        served,
        "standalone",
        "https://superset.example.com/x/",
        STANDARD,
    )

    [(ref, context)] = minter.minted
    assert ref == ArtifactRef(created.artifact_id, created.version)
    assert context.allowed_parents == ("https://superset.example.com",)
    assert answer == {
        "url": "https://box.example/frame",
        "expires_at": "2026-11-15T00:00:00+00:00",
        "artifact_id": created.artifact_id,
        "version": created.version,
        "is_draft": True,
        "can_edit": True,
        "capabilities": ["compute.wasm", "data", "theme"],
        "manifest": host_manifest(MANIFEST),
    }
    json.dumps(answer)


def test_the_policy_keeps_artifacts_off_a_surface(store: ArtifactFileStore) -> None:
    created = store.create(
        str(uuid4()), ArtifactCreateRequest(files={"index.html": "v1"})
    )
    served = choose_version(store, created.artifact_id, can_edit=True)
    minter = RecordingMinter()

    with pytest.raises(ArtifactError) as raised:
        link_payload(
            minter, store, served, "embedded", "https://superset.example.com/", LOCKED
        )

    assert raised.value.code == AuthoringErrorCode.POLICY_DENIED
    assert minter.minted == []


class FailingMinter:
    """A provider's frame-link role that fails with ``error``."""

    def __init__(self, error: Exception) -> None:
        self.error = error

    def mint_frame_link(self, ref: ArtifactRef, context: FrameContext) -> FrameLink:
        raise self.error


def test_a_version_the_provider_no_longer_holds_answers_version_not_found(
    store: ArtifactFileStore,
) -> None:
    """As when a publish lands between reading the version and minting."""
    created = store.create(
        str(uuid4()), ArtifactCreateRequest(files={"index.html": "v1"})
    )
    served = choose_version(store, created.artifact_id, can_edit=True)
    minter = FailingMinter(VersionNotFoundError("not the draft or published"))

    with pytest.raises(ArtifactError) as raised:
        link_payload(
            minter, store, served, "canvas", "https://superset.example.com/", LOCKED
        )

    assert raised.value.code == AuthoringErrorCode.VERSION_NOT_FOUND
    assert created.version in raised.value.message


def test_other_lookup_errors_from_the_provider_still_surface(
    store: ArtifactFileStore,
) -> None:
    created = store.create(
        str(uuid4()), ArtifactCreateRequest(files={"index.html": "v1"})
    )
    served = choose_version(store, created.artifact_id, can_edit=True)

    with pytest.raises(KeyError):
        link_payload(
            FailingMinter(KeyError("a bug")),
            store,
            served,
            "canvas",
            "https://superset.example.com/",
            LOCKED,
        )


class ArtifactProps(Widget):
    """The artifact type's props, as the host validates them on every write."""

    controls_class = ArtifactControls


def test_the_props_name_nothing() -> None:
    """The artifact is the saved widget: no prop holds code or a version."""
    assert ArtifactProps.validate_control_values({}) == []
    errors = ArtifactProps.validate_control_values(
        {"artifact_id": "00000000-0000-4000-8000-000000000000", "version": "v2"}
    )
    assert {tuple(error["loc"]) for error in errors} == {("artifact_id",), ("version",)}


def test_a_placement_is_read_through_superset_core(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact_id = "00000000-0000-4000-8000-000000000000"
    stored = {
        "art": placements.StoredPlacement(WIDGET_TYPE, {}, widget_id=artifact_id),
        "chart": placements.StoredPlacement("chart", {}, widget_id=artifact_id),
        "inline": placements.StoredPlacement(WIDGET_TYPE, {}),
    }
    reads: list[tuple[str, str, str | None]] = []

    def load_placement(
        canvas_id: str, placement_id: str, draft_token: str | None = None
    ) -> placements.StoredPlacement:
        reads.append((canvas_id, placement_id, draft_token))
        if placement_id not in stored:
            raise placements.PlacementNotFoundError(placement_id)
        return stored[placement_id]

    monkeypatch.setattr(placements, "load_placement", load_placement)

    assert placement_artifact("7", "art", "token") == artifact_id
    assert reads == [("7", "art", "token")]
    # Nothing the caller may read, another widget type, no saved widget.
    for placement_id in ("missing", "chart", "inline"):
        with pytest.raises(PlacementNotFoundError):
            placement_artifact("7", placement_id)
