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
from superset_oss.artifacts.data.resolver import placement_binding
from superset_oss.artifacts.store.filestore import ArtifactFileStore

OWNER = "1"
VIEWER = "2"


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


def create(store: ArtifactFileStore, declared: ArtifactManifest) -> tuple[str, str]:
    """A new artifact whose draft declares ``declared``: its id and version."""
    files = {"manifest.json": declared.model_dump_json()}
    created = store.create(OWNER, ArtifactCreateRequest(files=files))
    return created.artifact_id, created.version


def publish(store: ArtifactFileStore, artifact_id: str, version: str) -> None:
    pending = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=version),
    )
    store.confirm_publish(OWNER, artifact_id, pending.request_id)


def asked(
    props: dict[str, Any], name: str = "revenue", draft_token: str | None = None
) -> BindingRequest:
    """What the placement data endpoint asks the artifact widget type."""
    return BindingRequest(
        canvas_id="7",
        placement_id="sales",
        props=props,
        name=name,
        draft_token=draft_token,
    )


def test_a_placement_binding_comes_from_the_version_its_frame_loads(
    store: ArtifactFileStore,
) -> None:
    artifact_id, published = create(store, manifest())
    publish(store, artifact_id, published)
    draft = store.manifest_update(
        OWNER,
        ArtifactManifestUpdateRequest(
            artifact_id=artifact_id,
            base_version=published,
            manifest=manifest(source={"kind": "dataset", "dataset_id": 43}),
        ),
    ).version
    unpublished_manifest = manifest(source={"kind": "dataset", "dataset_id": 44})
    unpublished, _ = create(store, unpublished_manifest)

    def dataset(
        actor: str | None, draft_token: str | None = None, **props: Any
    ) -> int | None:
        binding = placement_binding(
            store,
            LOCKED,
            actor,
            asked({"artifact_id": artifact_id, **props}, draft_token=draft_token),
        )
        return None if binding is None else binding["datasetId"]

    assert placement_binding(
        store, LOCKED, VIEWER, asked({"artifact_id": artifact_id})
    ) == resolve_binding(manifest(), "revenue")
    # Outside a draft of the canvas, everyone runs the published version.
    assert dataset(VIEWER) == dataset(None) == dataset(OWNER) == 42
    # In their own draft of the canvas, owners run the artifact's draft; anyone
    # else who may edit the canvas still runs the published version.
    assert dataset(OWNER, "token") == 43
    assert dataset(VIEWER, "token") == 42
    # A pinned version runs as pinned, for owners even before it is published.
    assert dataset(VIEWER, version=published) == 42
    assert dataset(OWNER, version=draft) == 43
    # As the frame does, an owner previews an unpublished artifact's draft.
    assert placement_binding(
        store, LOCKED, OWNER, asked({"artifact_id": unpublished})
    ) == resolve_binding(unpublished_manifest, "revenue")


def test_a_placement_binding_is_none_when_nothing_would_run(
    store: ArtifactFileStore,
) -> None:
    artifact_id, published = create(store, manifest())
    publish(store, artifact_id, published)
    draft = store.manifest_update(
        OWNER,
        ArtifactManifestUpdateRequest(
            artifact_id=artifact_id,
            base_version=published,
            manifest=manifest(row_limit=10),
        ),
    ).version
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

    def binding(
        actor: str, props: dict[str, Any], name: str = "revenue"
    ) -> dict[str, Any] | None:
        return placement_binding(store, LOCKED, actor, asked(props, name))

    # Props that name no artifact, or not by its id.
    assert binding(OWNER, {}) is None
    assert binding(OWNER, {"artifact_id": "not-a-uuid"}) is None
    # A name the manifest doesn't declare, and a binding that doesn't map.
    assert binding(VIEWER, {"artifact_id": artifact_id}, "missing") is None
    assert binding(OWNER, {"artifact_id": chart}, "sales") is None
    # Versions a viewer may not see: unpublished, pinned or not.
    assert binding(VIEWER, {"artifact_id": artifact_id, "version": draft}) is None
    assert binding(VIEWER, {"artifact_id": unpublished}) is None


def test_the_policy_is_checked_on_every_query(store: ArtifactFileStore) -> None:
    """A tighter policy reaches a published artifact at its next query."""
    artifact_id, version = create(store, manifest())
    publish(store, artifact_id, version)
    props = {"artifact_id": artifact_id}
    elsewhere = policy_layer(
        {"profile": "locked", "data": {"resources": ["dataset:7"]}}
    )

    assert placement_binding(store, LOCKED, VIEWER, asked(props)) is not None
    assert placement_binding(store, elsewhere, VIEWER, asked(props)) is None


def test_a_snapshot_binding_has_no_live_data(store: ArtifactFileStore) -> None:
    """Snapshots are minted by the server, never run as the viewer at view time."""
    standard = policy_layer({"profile": "standard"})
    snapshots = ArtifactFileStore(InMemoryArtifactStore(), policy=standard)
    artifact_id, version = create(
        snapshots,
        manifest(mode="snapshot"),
    )
    publish(snapshots, artifact_id, version)

    assert (
        placement_binding(
            snapshots, standard, VIEWER, asked({"artifact_id": artifact_id})
        )
        is None
    )
