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

import pytest
from pydantic import ValidationError
from superset_core.artifacts.authoring import (
    ArtifactCreateRequest,
    ArtifactRequestPublishRequest,
    ArtifactStrReplaceRequest,
)
from superset_core.artifacts.capabilities import Capability
from superset_core.artifacts.manifest import ArtifactManifest
from superset_core.artifacts.testing import InMemoryArtifactStore
from superset_oss.artifacts.canvas.controls import ArtifactControls
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import choose_version, ServedVersion
from superset_oss.artifacts.frames.grants import (
    frame_context,
    grant_for,
    host_manifest,
    origin_of,
)
from superset_oss.artifacts.store.filestore import ArtifactFileStore

OWNER = "1"
VIEWER = "2"
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
        "capabilities": ["data", "cross_filter", "theme"],
        "dependencies": {"d3": "7.9.0"},
    }
)


def test_the_grant_is_what_the_manifest_declares_and_the_context_allows() -> None:
    assert grant_for(MANIFEST, "canvas") == {
        Capability.DATA,
        Capability.CROSS_FILTER,
        Capability.THEME,
    }
    assert grant_for(MANIFEST, "standalone") == {Capability.DATA, Capability.THEME}


def test_allowed_parents_are_origins() -> None:
    context = frame_context(
        "canvas",
        MANIFEST,
        "https://Superset.example.com:8443/canvas/1/",
        ["https://superset.example.com:8443"],
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
    return ArtifactFileStore(InMemoryArtifactStore(), namespace="test")


def test_owners_get_drafts_and_others_only_published_versions(
    store: ArtifactFileStore,
) -> None:
    created = store.create(OWNER, ArtifactCreateRequest(files={"index.html": "v1"}))
    artifact_id, first = created.artifact_id, created.version

    assert choose_version(store, OWNER, artifact_id) == ServedVersion(
        artifact_id, first, is_draft=True, can_edit=True
    )
    with pytest.raises(ArtifactError, match="isn't published"):
        choose_version(store, VIEWER, artifact_id)

    publish = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=first),
    )
    store.confirm_publish(OWNER, artifact_id, publish.request_id)
    second = store.str_replace(
        OWNER,
        ArtifactStrReplaceRequest(
            artifact_id=artifact_id,
            base_version=first,
            path="index.html",
            old_str="v1",
            new_str="v2",
        ),
    ).version

    assert choose_version(store, VIEWER, artifact_id).version == first
    assert choose_version(store, None, artifact_id).version == first
    assert choose_version(store, VIEWER, artifact_id, first).version == first
    assert choose_version(store, OWNER, artifact_id).version == first
    assert choose_version(store, OWNER, artifact_id, use_draft=True).version == second
    assert choose_version(store, OWNER, artifact_id, second).version == second
    # A viewer asking for the draft, or pinning an unpublished version, gets
    # neither.
    assert choose_version(store, VIEWER, artifact_id, use_draft=True).version == first
    with pytest.raises(ArtifactError, match="isn't a published version"):
        choose_version(store, VIEWER, artifact_id, second)


def test_props_name_an_artifact_and_optionally_a_version() -> None:
    props = ArtifactControls.model_validate(
        {"artifact_id": "00000000-0000-4000-8000-000000000000", "title": "Map"}
    )

    assert props.version is None
    with pytest.raises(ValidationError):
        ArtifactControls.model_validate({"artifact_id": "not-a-uuid"})
    with pytest.raises(ValidationError):
        ArtifactControls.model_validate(
            {"artifact_id": "00000000-0000-4000-8000-000000000000", "version": "v2"}
        )
