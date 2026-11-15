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
Named bindings (5.3; DR-08, DR-10): what an artifact may ask of Superset's data.

The host builds every query from the stored manifest and runs it as the
viewer. The frame only names a declared binding and sends values for its
declared parameters. This module checks those requests against the manifest
(the SDK's ``ArtifactManifest``), and maps a binding onto the canvas placement
data request that runs it (S8).

Mapping rules, chosen to keep the data governed:

- only dataset sources map; saved charts and semantic views wait for S8;
- a metric is a saved metric's name on the dataset, never an expression, so
  its definition stays Superset's (DR-10);
- a filter is a simple ``subject``/``operator``/``comparator`` filter: a SQL
  expression waits for the catalog checks of review finding D2.
"""

# TODO(S8): the placement data endpoint runs ``props.bindings[name]``, but an
# artifact's props hold only its id and version (DR-02). The endpoint needs a
# widget-level hook that calls ``resolve_binding`` with the manifest of the
# placed version; until then the frame gets no binding data on a canvas.
# TODO(S8): typed parameters in the query, saved-chart and semantic-view
# sources, and results with metric definitions and formats.
# Review findings D1 (bindings shaped like SemanticQuery), D2 (catalog
# checks), T1 (typed, rate-limited parameters) and T16 (query limits) are
# pending.

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

from superset_core.artifacts.manifest import (
    ArtifactManifest,
    Binding,
    DatasetSource,
    ParameterSpec,
)


class BindingError(ValueError):
    """A request that the artifact's manifest doesn't declare or allow."""


def binding(manifest: ArtifactManifest, name: str) -> Binding:
    """The declared binding ``name``."""
    found = manifest.bindings.get(name)
    if found is None:
        raise BindingError(f"the manifest declares no binding {name!r}")
    return found


def _matches_type(spec: ParameterSpec, value: Any) -> bool:
    if spec.type == "number":
        return (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
        )
    if spec.type == "boolean":
        return isinstance(value, bool)
    if spec.type == "string_list":
        return isinstance(value, list) and all(isinstance(item, str) for item in value)
    # string, date and time_range travel as strings.
    return isinstance(value, str)


def check_query(
    manifest: ArtifactManifest, name: str, params: Mapping[str, Any]
) -> dict[str, Any]:
    """
    The values of a frame's ``query`` request, checked against the binding.

    Only declared parameters, each of its declared type and, when the binding
    lists them, one of its allowed values. A required parameter without a
    value or default is an error. Returns the values with defaults filled in.
    """
    declared = binding(manifest, name).parameters
    if unknown := sorted(set(params) - set(declared)):
        raise BindingError(
            f"binding {name!r} declares no parameters {', '.join(unknown)}"
        )
    values: dict[str, Any] = {}
    for parameter, spec in declared.items():
        value = params.get(parameter, spec.default)
        if value is None:
            if spec.required:
                raise BindingError(f"parameter {parameter!r} needs a value")
            continue
        if not _matches_type(spec, value):
            raise BindingError(f"parameter {parameter!r} must be a {spec.type}")
        if spec.allowed is not None and value not in spec.allowed:
            raise BindingError(f"parameter {parameter!r} doesn't allow {value!r}")
        values[parameter] = value
    return values


def _filter_problem(adhoc: Mapping[str, Any]) -> str | None:
    if adhoc.get("expressionType", "SIMPLE") != "SIMPLE":
        return "only simple filters map; SQL expressions wait for review finding D2"
    if not isinstance(adhoc.get("subject"), str) or not isinstance(
        adhoc.get("operator"), str
    ):
        return "a filter needs a subject column and an operator"
    return None


def binding_problems(manifest: ArtifactManifest) -> list[str]:
    """What keeps the manifest's bindings from running on the placement endpoint."""
    problems = []
    for name, declared in manifest.bindings.items():
        if not isinstance(declared.source, DatasetSource):
            problems.append(
                f"binding {name!r}: {declared.source.kind} sources wait for S8; "
                "bind a dataset"
            )
        for index, adhoc in enumerate(declared.filters):
            if problem := _filter_problem(adhoc):
                problems.append(f"binding {name!r}, filters[{index}]: {problem}")
    return problems


def resolve_binding(manifest: ArtifactManifest, name: str) -> dict[str, Any]:
    """
    The placement ``dataBinding`` that runs binding ``name``: S8's ``bindings[name]``.

    Raises ``BindingError`` when the binding doesn't map (see the module notes).
    """
    declared = binding(manifest, name)
    source = declared.source
    if not isinstance(source, DatasetSource):
        raise BindingError(
            f"binding {name!r}: {source.kind} sources wait for S8; bind a dataset"
        )
    filters = []
    for index, adhoc in enumerate(declared.filters):
        if problem := _filter_problem(adhoc):
            raise BindingError(f"binding {name!r}, filters[{index}]: {problem}")
        filters.append(
            {
                "expressionType": "SIMPLE",
                "subject": adhoc["subject"],
                "operator": adhoc["operator"],
                "comparator": adhoc.get("comparator"),
            }
        )
    data_binding: dict[str, Any] = {
        "datasetId": source.dataset_id,
        "metrics": list(declared.metrics),
        "dimensions": list(declared.dimensions),
    }
    if filters:
        data_binding["filters"] = filters
    if declared.row_limit is not None:
        data_binding["rowLimit"] = declared.row_limit
    return data_binding


def placement_data_request(
    manifest: ArtifactManifest,
    name: str,
    runtime_filters: Sequence[Mapping[str, Any]] = (),
) -> dict[str, Any]:
    """
    The body of the placement data request for binding ``name`` (S8).

    ``POST /api/v1/canvas/<canvas>/placement/<node>/data`` with it, and the
    ``X-Canvas-Draft`` header in a draft (S2). The runtime filters are the
    canvas filter bus's values, ``{datasetId, column, values}``.
    """
    resolve_binding(manifest, name)
    return {
        "binding": name,
        "runtime_filters": [dict(runtime_filter) for runtime_filter in runtime_filters],
    }
