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
"""The data seam: manifest bindings checked and mapped onto placement data."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from superset_artifacts_sdk.authoring import (
    ArtifactCreateRequest,
    ArtifactManifestUpdateRequest,
    ArtifactRequestPublishRequest,
)
from superset_artifacts_sdk.manifest import ArtifactManifest
from superset_artifacts_sdk.policy import LOCKED, policy_layer
from superset_artifacts_sdk.testing import InMemoryArtifactStore
from superset_core.widgets import BindingRequest
from superset_oss.artifacts.data.bindings import (
    binding_problems,
    BindingError,
    resolve_binding,
)
from superset_oss.artifacts.data.resolver import artifact_binding, HOST_ROW_LIMIT
from superset_oss.artifacts.store.filestore import ArtifactFileStore

OWNER = "1"


def manifest(**binding: Any) -> ArtifactManifest:
    return ArtifactManifest.model_validate(
        {
            "artifact_version": "1",
            "bindings": {
                "revenue": {
                    "source": {"kind": "dataset", "dataset_id": 42},
                    "metrics": ["revenue"],
                    "dimensions": ["region"],
                    **binding,
                }
            },
            "capabilities": ["data"],
        }
    )


def test_a_dataset_binding_maps_onto_the_placement_binding() -> None:
    declared = manifest(
        filters=[{"subject": "country", "operator": "IN", "comparator": ["FR"]}],
        row_limit=500,
    )

    assert resolve_binding(declared, "revenue") == {
        "datasetId": 42,
        "metrics": ["revenue"],
        "dimensions": ["region"],
        "filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "country",
                "operator": "IN",
                "comparator": ["FR"],
            }
        ],
        "rowLimit": 500,
    }
    assert binding_problems(declared) == []


def test_what_doesnt_map_is_refused() -> None:
    chart = ArtifactManifest.model_validate(
        {
            "artifact_version": "1",
            "bindings": {"sales": {"source": {"kind": "chart", "chart_id": 3}}},
            "capabilities": ["data"],
        }
    )
    sql = manifest(
        filters=[
            {"expressionType": "SQL", "sqlExpression": "1 = 1"},
            {"subject": "country", "operator": "IN"},
            {"operator": "IN"},
        ]
    )

    with pytest.raises(BindingError, match="no binding 'missing'"):
        resolve_binding(chart, "missing")
    with pytest.raises(BindingError, match="chart sources don't map"):
        resolve_binding(chart, "sales")
    with pytest.raises(BindingError) as refused:
        resolve_binding(sql, "revenue")
    assert str(refused.value) == (
        "binding 'revenue', filters[0]: only simple filters map, not SQL "
        "expressions; filters[2]: a filter needs a subject column and an operator"
    )
    assert binding_problems(chart) == [
        "binding 'sales': chart sources don't map onto placement data yet; "
        "bind a dataset"
    ]
    assert binding_problems(sql) == [str(refused.value)]


@pytest.fixture
def store() -> ArtifactFileStore:
    return ArtifactFileStore(InMemoryArtifactStore())


class Access:
    """An ``ArtifactAccess`` whose editors are listed."""

    def __init__(self, *editable: str) -> None:
        self.editable = set(editable)

    def register(self, artifact_id: str, name: str, editor: str) -> None:
        self.editable.add(artifact_id)

    def can_read(self, artifact_id: str) -> bool:
        return True

    def can_edit(self, artifact_id: str) -> bool:
        return artifact_id in self.editable


VIEWER = Access()


def create(store: ArtifactFileStore, declared: ArtifactManifest) -> tuple[str, str]:
    """A new artifact whose draft declares ``declared``: its id and version."""
    files = {"manifest.json": declared.model_dump_json()}
    created = store.create(str(uuid4()), ArtifactCreateRequest(files=files))
    return created.artifact_id, created.version


def publish(store: ArtifactFileStore, artifact_id: str, version: str) -> None:
    pending = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=version),
    )
    store.confirm_publish(OWNER, artifact_id, pending.request_id)


def asked(
    widget_id: str | None, name: str = "revenue", draft_token: str | None = None
) -> BindingRequest:
    """What the host asks the artifact widget type, for one of its placements."""
    return BindingRequest(
        canvas_id="7",
        placement_id="sales",
        props={},
        name=name,
        draft_token=draft_token,
        widget_id=widget_id,
    )


def test_a_binding_comes_from_the_version_its_frame_loads(
    store: ArtifactFileStore,
) -> None:
    artifact_id, published = create(store, manifest())
    publish(store, artifact_id, published)
    store.manifest_update(
        ArtifactManifestUpdateRequest(
            artifact_id=artifact_id,
            base_version=published,
            manifest=manifest(source={"kind": "dataset", "dataset_id": 43}),
        ),
    )
    unpublished_manifest = manifest(source={"kind": "dataset", "dataset_id": 44})
    unpublished, _ = create(store, unpublished_manifest)
    editor = Access(artifact_id, unpublished)

    def dataset(access: Access, draft_token: str | None = None) -> int | None:
        binding = artifact_binding(
            store, LOCKED, access, asked(artifact_id, draft_token=draft_token)
        )
        return None if binding is None else binding["datasetId"]

    assert artifact_binding(store, LOCKED, VIEWER, asked(artifact_id)) == {
        **resolve_binding(manifest(), "revenue"),
        "rowLimit": HOST_ROW_LIMIT,
    }
    # Outside a draft of the canvas, everyone runs the published version.
    assert dataset(VIEWER) == dataset(editor) == 42
    # In their own draft of the canvas, editors run the artifact's draft; anyone
    # else who may edit the canvas still runs the published version.
    assert dataset(editor, "token") == 43
    assert dataset(VIEWER, "token") == 42
    # As the frame does, an editor previews an unpublished artifact's draft.
    assert artifact_binding(store, LOCKED, editor, asked(unpublished)) == {
        **resolve_binding(unpublished_manifest, "revenue"),
        "rowLimit": HOST_ROW_LIMIT,
    }


def test_a_binding_is_none_when_nothing_would_run(store: ArtifactFileStore) -> None:
    artifact_id, published = create(store, manifest())
    publish(store, artifact_id, published)
    unpublished, _ = create(store, manifest())
    chart, _ = create(
        store,
        ArtifactManifest.model_validate(
            {
                "artifact_version": "1",
                "bindings": {"sales": {"source": {"kind": "chart", "chart_id": 3}}},
                "capabilities": ["data"],
            }
        ),
    )
    publish(store, chart, store.draft_version(chart))

    def binding(widget_id: str | None, name: str = "revenue") -> object:
        return artifact_binding(store, LOCKED, VIEWER, asked(widget_id, name))

    # No saved widget, or not one the store holds.
    assert binding(None) is None
    assert binding("not-a-uuid") is None
    assert binding(str(uuid4())) is None
    # A name the manifest doesn't declare, and a binding that doesn't map.
    assert binding(artifact_id, "missing") is None
    assert binding(chart, "sales") is None
    # A version a viewer may not see: the draft of an unpublished artifact.
    assert binding(unpublished) is None


def test_the_policy_is_checked_on_every_query(store: ArtifactFileStore) -> None:
    """A tighter policy reaches a published artifact at its next query."""
    artifact_id, version = create(store, manifest())
    publish(store, artifact_id, version)
    elsewhere = policy_layer(
        {"profile": "locked", "data": {"resources": ["dataset:7"]}}
    )

    assert artifact_binding(store, LOCKED, VIEWER, asked(artifact_id)) is not None
    assert artifact_binding(store, elsewhere, VIEWER, asked(artifact_id)) is None


def test_the_policys_max_rows_caps_every_binding(store: ArtifactFileStore) -> None:
    undeclared, version = create(store, manifest())
    publish(store, undeclared, version)
    declared, version = create(store, manifest(row_limit=50))
    publish(store, declared, version)
    hundred = policy_layer({"profile": "locked", "data": {"max_rows": 100}})

    def row_limit(artifact_id: str, policy: Any) -> object:
        binding = artifact_binding(store, policy, VIEWER, asked(artifact_id))
        return None if binding is None else binding["rowLimit"]

    # One without a row limit runs with the host's default, capped too.
    assert row_limit(undeclared, LOCKED) == HOST_ROW_LIMIT
    assert row_limit(undeclared, hundred) == 100
    assert row_limit(declared, hundred) == 50


def test_a_snapshot_binding_has_no_live_data() -> None:
    """Snapshots are minted by the server, never run as the viewer at view time."""
    standard = policy_layer({"profile": "standard"})
    store = ArtifactFileStore(InMemoryArtifactStore(), policy=standard)
    artifact_id, version = create(store, manifest(mode="snapshot"))
    publish(store, artifact_id, version)

    assert artifact_binding(store, standard, VIEWER, asked(artifact_id)) is None
