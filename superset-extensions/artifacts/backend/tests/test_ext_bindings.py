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
from superset_artifacts_sdk.policy import ArtifactPolicy, LOCKED, policy_layer
from superset_artifacts_sdk.testing import InMemoryArtifactStore
from superset_core.widgets import QueryRequest, WidgetQuery
from superset_oss.artifacts.data.bindings import (
    binding_problems,
    BindingError,
    resolve_binding,
)
from superset_oss.artifacts.data.queries import artifact_queries, HOST_ROW_LIMIT
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


def asked(widget_id: str | None, draft_token: str | None = None) -> QueryRequest:
    """What the host asks the artifact widget type, for one of its placements."""
    return QueryRequest(
        canvas_id="7",
        placement_id="sales",
        props={},
        draft_token=draft_token,
        widget_id=widget_id,
    )


def two_bindings(costs: dict[str, Any]) -> ArtifactManifest:
    """``manifest()``'s ``revenue``, and a ``costs`` binding as given."""
    declared = manifest().model_dump(mode="json", exclude_none=True)
    declared["bindings"]["costs"] = costs
    return ArtifactManifest.model_validate(declared)


def names(queries: list[WidgetQuery]) -> list[str]:
    return [query.name for query in queries]


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

    def dataset(access: Access, draft_token: str | None = None) -> object:
        [query] = artifact_queries(
            store, LOCKED, access, asked(artifact_id, draft_token=draft_token)
        )
        return query.binding["datasetId"]

    assert artifact_queries(store, LOCKED, VIEWER, asked(artifact_id)) == [
        WidgetQuery(
            "revenue",
            {**resolve_binding(manifest(), "revenue"), "rowLimit": HOST_ROW_LIMIT},
        )
    ]
    # Outside a draft of the canvas, everyone runs the published version.
    assert dataset(VIEWER) == dataset(editor) == 42
    # In their own draft of the canvas, editors run the artifact's draft; anyone
    # else who may edit the canvas still runs the published version.
    assert dataset(editor, "token") == 43
    assert dataset(VIEWER, "token") == 42
    # As the frame does, an editor previews an unpublished artifact's draft.
    assert artifact_queries(store, LOCKED, editor, asked(unpublished)) == [
        WidgetQuery(
            "revenue",
            {
                **resolve_binding(unpublished_manifest, "revenue"),
                "rowLimit": HOST_ROW_LIMIT,
            },
        )
    ]


def test_every_binding_that_would_run_is_a_query(store: ArtifactFileStore) -> None:
    both, version = create(
        store,
        two_bindings({"source": {"kind": "dataset", "dataset_id": 7}}),
    )
    publish(store, both, version)

    queries = artifact_queries(store, LOCKED, VIEWER, asked(both))

    assert names(queries) == ["revenue", "costs"]
    assert queries[1].binding["datasetId"] == 7


def test_no_query_runs_what_nothing_would_run(store: ArtifactFileStore) -> None:
    unpublished, _ = create(store, manifest())
    chart, version = create(
        store, two_bindings({"source": {"kind": "chart", "chart_id": 3}})
    )
    publish(store, chart, version)

    def queried(widget_id: str | None) -> list[str]:
        return names(artifact_queries(store, LOCKED, VIEWER, asked(widget_id)))

    # No saved widget, or not one the store holds.
    assert queried(None) == []
    assert queried("not-a-uuid") == []
    assert queried(str(uuid4())) == []
    # A binding that doesn't map has no query; the others still run.
    assert queried(chart) == ["revenue"]
    # A version a viewer may not see: the draft of an unpublished artifact.
    assert queried(unpublished) == []


def test_the_policy_is_checked_on_every_query(store: ArtifactFileStore) -> None:
    """A tighter policy reaches a published artifact at its next query."""
    artifact_id, version = create(
        store, two_bindings({"source": {"kind": "dataset", "dataset_id": 7}})
    )
    publish(store, artifact_id, version)
    elsewhere = policy_layer(
        {"profile": "locked", "data": {"resources": ["dataset:7"]}}
    )

    def queried(policy: ArtifactPolicy) -> list[str]:
        return names(artifact_queries(store, policy, VIEWER, asked(artifact_id)))

    assert queried(LOCKED) == ["revenue", "costs"]
    assert queried(elsewhere) == ["costs"]


def test_the_policys_max_rows_caps_every_binding(store: ArtifactFileStore) -> None:
    undeclared, version = create(store, manifest())
    publish(store, undeclared, version)
    declared, version = create(store, manifest(row_limit=50))
    publish(store, declared, version)
    hundred = policy_layer({"profile": "locked", "data": {"max_rows": 100}})

    def row_limit(artifact_id: str, policy: Any) -> object:
        [query] = artifact_queries(store, policy, VIEWER, asked(artifact_id))
        return query.binding["rowLimit"]

    # One without a row limit runs with the host's default, capped too.
    assert row_limit(undeclared, LOCKED) == HOST_ROW_LIMIT
    assert row_limit(undeclared, hundred) == 100
    assert row_limit(declared, hundred) == 50


def test_a_guest_gets_no_live_rows(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store, manifest())
    publish(store, artifact_id, version)
    # Open lets guests have snapshots, which aren't served yet; no profile
    # lets them have live rows.
    open_policy = policy_layer({"profile": "open"})
    assert open_policy.surfaces.guest == "snapshot"

    assert artifact_queries(store, open_policy, VIEWER, asked(artifact_id))
    assert (
        artifact_queries(store, open_policy, VIEWER, asked(artifact_id), guest=True)
        == []
    )


def test_a_snapshot_binding_has_no_live_data() -> None:
    """Snapshots are minted by the server, never run as the viewer at view time."""
    standard = policy_layer({"profile": "standard"})
    store = ArtifactFileStore(InMemoryArtifactStore(), policy=standard)
    artifact_id, version = create(
        store,
        two_bindings(
            {"source": {"kind": "dataset", "dataset_id": 42}, "mode": "snapshot"}
        ),
    )
    publish(store, artifact_id, version)

    queries = artifact_queries(store, standard, VIEWER, asked(artifact_id))

    assert names(queries) == ["revenue"]
