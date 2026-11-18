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
Named bindings: what an artifact may ask of Superset's data.

The host builds every query from the stored manifest and runs it as the viewer;
the frame only names a declared binding. This module maps a binding of the
manifest (the SDK's ``ArtifactManifest``) onto the canvas placement
``dataBinding`` that runs it, and reports the bindings that don't map yet.

Mapping rules, chosen to keep the data governed:

- only dataset sources map; the placement data endpoint doesn't run saved
  charts or semantic views;
- a metric is a saved metric's name on the dataset, never an expression, so its
  definition stays Superset's;
- a filter is a simple ``subject``/``operator``/``comparator`` filter: a SQL
  expression would first need checks against the dataset's catalog.
"""

# TODO: typed parameters in the query, saved-chart and semantic-view sources,
# results with metric definitions and formats, bindings shaped like SIP-231's
# ``SemanticQuery``, and limits on what a binding may query.

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from superset_artifacts_sdk.manifest import ArtifactManifest, DatasetSource


class BindingError(ValueError):
    """A binding the manifest doesn't declare, or one that doesn't map."""


def _filter_problem(adhoc: Mapping[str, Any]) -> str | None:
    if adhoc.get("expressionType", "SIMPLE") != "SIMPLE":
        return "only simple filters map, not SQL expressions"
    if not isinstance(adhoc.get("subject"), str) or not isinstance(
        adhoc.get("operator"), str
    ):
        return "a filter needs a subject column and an operator"
    return None


def resolve_binding(manifest: ArtifactManifest, name: str) -> dict[str, Any]:
    """
    The placement ``dataBinding`` that runs binding ``name``.

    It is what the placement data endpoint runs for binding ``name`` of an
    artifact placement (see ``data.resolver``). Raises ``BindingError`` when
    the manifest declares no such binding, or when the binding doesn't map
    (see the module notes); the message names every filter that doesn't.
    """
    declared = manifest.bindings.get(name)
    if declared is None:
        raise BindingError(f"the manifest declares no binding {name!r}")
    source = declared.source
    if not isinstance(source, DatasetSource):
        raise BindingError(
            f"binding {name!r}: {source.kind} sources don't map onto placement "
            "data yet; bind a dataset"
        )
    if problems := [
        f"filters[{index}]: {problem}"
        for index, adhoc in enumerate(declared.filters)
        if (problem := _filter_problem(adhoc))
    ]:
        raise BindingError(f"binding {name!r}, " + "; ".join(problems))
    data_binding: dict[str, Any] = {
        "datasetId": source.dataset_id,
        "metrics": list(declared.metrics),
        "dimensions": list(declared.dimensions),
    }
    if declared.filters:
        data_binding["filters"] = [
            {
                "expressionType": "SIMPLE",
                "subject": adhoc["subject"],
                "operator": adhoc["operator"],
                "comparator": adhoc.get("comparator"),
            }
            for adhoc in declared.filters
        ]
    if declared.row_limit is not None:
        data_binding["rowLimit"] = declared.row_limit
    return data_binding


def binding_problems(manifest: ArtifactManifest) -> list[str]:
    """Why each binding that doesn't map onto placement data won't run there."""
    problems = []
    for name in manifest.bindings:
        try:
            resolve_binding(manifest, name)
        except BindingError as ex:
            problems.append(str(ex))
    return problems
