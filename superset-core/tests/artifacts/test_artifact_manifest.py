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

"""Validation of the artifact manifest (``manifest.json``)."""

from __future__ import annotations

import json  # noqa: TID251 -- SDK cannot depend on the host JSON utility.
from typing import Any, get_args

import pytest
from pydantic import ValidationError
from superset_core.artifacts.capabilities import Capability
from superset_core.artifacts.manifest import (
    ArtifactManifest,
    DatasetSource,
    manifest_json_schema,
    MANIFEST_VERSION,
    SavedChartSource,
    SemanticViewSource,
)

REVENUE_BINDING: dict[str, Any] = {
    "source": {"kind": "dataset", "dataset_id": 42},
    "metrics": ["SUM(revenue)"],
    "dimensions": ["region"],
    "parameters": {
        "time_range": {"type": "time_range"},
        "region": {"type": "string_list"},
    },
}
CROSS_FILTER_ON_REGION: dict[str, Any] = {
    "kind": "cross_filter",
    "binding": "revenue_by_region",
    "dimension": "region",
}


def _manifest(**overrides: Any) -> dict[str, Any]:
    """A valid manifest: one dataset binding with a cross-filter on it."""
    manifest: dict[str, Any] = {
        "artifact_version": "1",
        "bindings": {"revenue_by_region": REVENUE_BINDING},
        "events": [CROSS_FILTER_ON_REGION],
        "capabilities": ["data", "cross_filter"],
    }
    manifest.update(overrides)
    return manifest


def _errors(raw: dict[str, Any]) -> str:
    """The validation errors for an invalid manifest, as one string."""
    with pytest.raises(ValidationError) as excinfo:
        ArtifactManifest.model_validate(raw)
    return str(excinfo.value)


def test_manifest_version_matches_the_schema() -> None:
    """The ``artifact_version`` literal is ``MANIFEST_VERSION``."""
    annotation = ArtifactManifest.model_fields["artifact_version"].annotation
    assert get_args(annotation) == (MANIFEST_VERSION,)


def test_minimal_manifest_gets_its_defaults() -> None:
    manifest = ArtifactManifest.model_validate({"artifact_version": "1"})
    assert manifest.entrypoint == "index.html"
    assert manifest.title is None
    assert manifest.bindings == {}
    assert manifest.events == []
    assert manifest.capabilities == []
    assert manifest.dependencies == {}
    assert manifest.snapshots == []


def test_full_manifest_round_trips_through_json() -> None:
    raw = _manifest(
        title="Revenue globe",
        entrypoint="./app/index.html",
        bindings={
            "revenue_by_region": REVENUE_BINDING,
            "top_products": {
                "source": {"kind": "chart", "chart_id": 7},
                "dimensions": ["product"],
                "row_limit": 10,
            },
            "margin": {
                "source": {"kind": "semantic_view", "semantic_view": "sales"},
                "metrics": ["gross_margin"],
                "filters": [{"col": "year", "op": "==", "val": 2026}],
            },
        },
        events=[
            CROSS_FILTER_ON_REGION,
            {"kind": "selection", "binding": "top_products", "dimension": "product"},
        ],
        capabilities=["data", "cross_filter", "events", "refresh", "theme"],
        dependencies={"three": "0.160.0", "@types/d3": "7.4.3", "d3-geo": "3.1.1-rc.1"},
        snapshots=[
            {
                "binding": "margin",
                "captured_at": "2026-11-15T09:30:00Z",
                "captured_by": "alice",
                "row_count": 120,
            }
        ],
    )
    manifest = ArtifactManifest.model_validate(raw)

    assert manifest.entrypoint == "app/index.html"
    assert isinstance(manifest.bindings["revenue_by_region"].source, DatasetSource)
    assert isinstance(manifest.bindings["top_products"].source, SavedChartSource)
    assert isinstance(manifest.bindings["margin"].source, SemanticViewSource)
    assert manifest.capabilities[0] is Capability.DATA
    assert manifest.model_dump(mode="json")["capabilities"][:2] == [
        "data",
        "cross_filter",
    ]
    assert ArtifactManifest.model_validate_json(manifest.model_dump_json()) == manifest


@pytest.mark.parametrize("version", ["2", 1, "1.0"])
def test_unknown_manifest_versions_are_rejected(version: Any) -> None:
    assert "artifact_version" in _errors(_manifest(artifact_version=version))


def test_unknown_binding_sources_are_rejected() -> None:
    binding = {**REVENUE_BINDING, "source": {"kind": "table", "table": "sales"}}
    errors = _errors(_manifest(bindings={"revenue_by_region": binding}))
    assert "source" in errors


def test_sources_need_their_kind() -> None:
    """``kind`` picks the source, so the schema that agents read requires it."""
    binding = {**REVENUE_BINDING, "source": {"dataset_id": 42}}
    assert "source" in _errors(_manifest(bindings={"revenue_by_region": binding}))
    definitions = ArtifactManifest.model_json_schema()["$defs"]
    for source in ("DatasetSource", "SavedChartSource", "SemanticViewSource"):
        assert "kind" in definitions[source]["required"]


@pytest.mark.parametrize("dataset_id", ["42", True, 0, -1, 4.2])
def test_source_ids_are_strict_positive_integers(dataset_id: Any) -> None:
    binding = {
        **REVENUE_BINDING,
        "source": {"kind": "dataset", "dataset_id": dataset_id},
    }
    assert "dataset_id" in _errors(_manifest(bindings={"revenue_by_region": binding}))


def test_undeclared_fields_are_rejected() -> None:
    """A misspelled key fails instead of being silently ignored."""
    assert "capabilites" in _errors(_manifest(capabilites=["data"]))
    binding = {**REVENUE_BINDING, "metric": ["SUM(revenue)"]}
    assert "metric" in _errors(_manifest(bindings={"revenue_by_region": binding}))


@pytest.mark.parametrize(
    "name", ["Revenue", "1st_binding", "with-dash", "with space", "", "x" * 65]
)
def test_binding_names_must_be_slugs(name: str) -> None:
    errors = _errors(_manifest(bindings={name: REVENUE_BINDING}, events=[]))
    assert "must be a slug" in errors


def test_binding_names_may_be_64_characters() -> None:
    name = "b" * 64
    manifest = ArtifactManifest.model_validate(
        _manifest(bindings={name: REVENUE_BINDING}, events=[])
    )
    assert list(manifest.bindings) == [name]


@pytest.mark.parametrize("name", ["TimeRange", "time-range", "2nd", ""])
def test_parameter_names_must_be_slugs(name: str) -> None:
    binding = {**REVENUE_BINDING, "parameters": {name: {"type": "string"}}}
    errors = _errors(_manifest(bindings={"revenue_by_region": binding}))
    assert "parameter name" in errors


def test_unknown_parameter_types_are_rejected() -> None:
    binding = {**REVENUE_BINDING, "parameters": {"region": {"type": "regex"}}}
    assert "type" in _errors(_manifest(bindings={"revenue_by_region": binding}))


def test_events_must_reference_declared_bindings() -> None:
    event = {**CROSS_FILTER_ON_REGION, "binding": "missing"}
    assert "undeclared binding 'missing'" in _errors(_manifest(events=[event]))


def test_event_dimensions_must_belong_to_their_binding() -> None:
    event = {**CROSS_FILTER_ON_REGION, "dimension": "country"}
    errors = _errors(_manifest(events=[event]))
    assert "'country' is not a dimension of binding 'revenue_by_region'" in errors


@pytest.mark.parametrize(
    ("kind", "capability"),
    [
        ("cross_filter", "cross_filter"),
        ("selection", "events"),
        ("highlight", "events"),
        ("drill", "events"),
    ],
)
def test_events_need_their_capability(kind: str, capability: str) -> None:
    event = {**CROSS_FILTER_ON_REGION, "kind": kind}
    errors = _errors(_manifest(events=[event], capabilities=["data"]))
    assert f"need the '{capability}' capability" in errors
    granted = _manifest(events=[event], capabilities=["data", capability])
    assert ArtifactManifest.model_validate(granted).events[0].kind == kind


def test_bindings_need_the_data_capability() -> None:
    errors = _errors(_manifest(events=[], capabilities=[]))
    assert "bindings need the 'data' capability" in errors


def test_unknown_capabilities_are_rejected() -> None:
    assert "capabilities" in _errors(_manifest(capabilities=["data", "compute"]))


def test_every_cross_field_problem_is_reported_at_once() -> None:
    errors = _errors(
        _manifest(
            events=[{"kind": "drill", "binding": "nope", "dimension": "region"}],
            capabilities=[],
            snapshots=[
                {
                    "binding": "gone",
                    "captured_at": "2026-11-15T09:30:00+01:00",
                    "row_count": 3,
                }
            ],
        )
    )
    assert "events[0] references undeclared binding 'nope'" in errors
    assert "snapshots[0] references undeclared binding 'gone'" in errors
    assert "need the 'data' capability" in errors
    assert "need the 'events' capability" in errors


@pytest.mark.parametrize(
    "version",
    [
        "1.2.3",
        "0.0.1",
        "18.3.1",
        "1.2.3-beta.1",
        "1.0.0-rc.1",
        "2.0.0-alpha",
        "1.2.3-0.3.7",
        "1.2.3-x-y.7",
    ],
)
def test_exact_dependency_versions_are_accepted(version: str) -> None:
    manifest = ArtifactManifest.model_validate(_manifest(dependencies={"d3": version}))
    assert manifest.dependencies == {"d3": version}


@pytest.mark.parametrize(
    "version",
    [
        "^1.2.3",
        "~1.2.3",
        ">=1.0.0",
        "1.2.3 - 2.0.0",
        "1.2.3 || 2.0.0",
        "1.x",
        "1.2",
        "*",
        "latest",
        "next",
        "v1.2.3",
        "=1.2.3",
        "01.2.3",
        "1.2.3+build.1",
        "1.2.3-",
        "1.2.3-01",
        "https://example.com/d3.tgz",
        "git+https://github.com/d3/d3.git",
        "github:d3/d3",
        "d3/d3",
        "file:../d3",
        "npm:d3@7.9.0",
        "workspace:*",
        "",
        "1.2.3\n",
        "١.٢.٣",
    ],
)
def test_dependency_ranges_tags_and_specs_are_rejected(version: str) -> None:
    assert "is not an exact version" in _errors(_manifest(dependencies={"d3": version}))


@pytest.mark.parametrize(
    "name", ["react", "@types/react", "lodash.debounce", "d3-scale", "@visx/shape"]
)
def test_valid_package_names_are_accepted(name: str) -> None:
    raw = _manifest(dependencies={name: "1.0.0"})
    assert name in ArtifactManifest.model_validate(raw).dependencies


@pytest.mark.parametrize(
    "name",
    [
        "React",
        ".hidden",
        "_private",
        "a/b",
        "@scope",
        "@scope/",
        "@Scope/pkg",
        "with space",
        "../evil",
        "https://example.com/pkg",
        "node_modules",
        "favicon.ico",
        "café",
        "pkg~1",
        "",
        "x" * 215,
    ],
)
def test_invalid_package_names_are_rejected(name: str) -> None:
    errors = _errors(_manifest(dependencies={name: "1.0.0"}))
    assert "is not a valid npm package name" in errors


def test_snapshots_need_a_timezone() -> None:
    snapshot = {
        "binding": "revenue_by_region",
        "captured_at": "2026-11-15T09:30:00",
        "row_count": 3,
    }
    assert "captured_at" in _errors(_manifest(snapshots=[snapshot]))


def test_snapshot_row_counts_are_not_negative() -> None:
    snapshot = {
        "binding": "revenue_by_region",
        "captured_at": "2026-11-15T09:30:00Z",
        "row_count": -1,
    }
    assert "row_count" in _errors(_manifest(snapshots=[snapshot]))


@pytest.mark.parametrize(
    "entrypoint", ["../index.html", "/index.html", "", "a\\b.html"]
)
def test_entrypoint_must_be_a_tree_path(entrypoint: str) -> None:
    assert "entrypoint" in _errors(_manifest(entrypoint=entrypoint))


def test_manifest_json_schema_describes_the_manifest() -> None:
    schema = manifest_json_schema()
    assert schema["title"] == "ArtifactManifest"
    assert schema["required"] == ["artifact_version"]
    assert {
        "artifact_version",
        "entrypoint",
        "bindings",
        "events",
        "capabilities",
        "dependencies",
        "snapshots",
    } <= set(schema["properties"])
    source = schema["$defs"]["Binding"]["properties"]["source"]
    assert source["discriminator"]["propertyName"] == "kind"
    assert json.loads(json.dumps(schema)) == schema
