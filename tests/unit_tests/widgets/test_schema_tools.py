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
from __future__ import annotations

import pytest

from superset.widgets.registry import registry
from superset.widgets.schema_tools import (
    get_subtree,
    get_subtrees,
    prune_to_minimal_viable,
    SchemaPathError,
)


def _balloons_schema(control_values=None, series=None):
    widget = registry.get("balloons")
    assert widget is not None
    return widget.get_control_schema(control_values, series)


def test_prune_surfaces_mandatory_leaves_and_collapses_the_rest() -> None:
    minimal = prune_to_minimal_viable(_balloons_schema())

    assert minimal["x-disclosure"] == "minimal"
    # No $defs / $ref leak into the minimal view.
    assert "$defs" not in minimal
    # dataBinding is mandatory → expanded; its mandatory leaves are inline.
    data_binding = minimal["properties"]["dataBinding"]
    assert data_binding["properties"]["datasetId"]["type"] == "integer"
    assert data_binding["properties"]["metrics"]["type"] == "array"
    # Its optional but CHEAP leaves (array-of-strings, integer) are inlined too
    # — small, and nothing to drill into, so no wasted round trip.
    dimensions = data_binding["properties"]["dimensions"]
    assert dimensions["type"] == "array"
    assert "x-collapsed" not in dimensions
    assert data_binding["properties"]["rowLimit"]["type"] == "integer"
    # dataBinding has no collapsed (object) children → not partial.
    assert "x-partial" not in data_binding
    # colorDimension is an optional scalar at the root → inlined, not collapsed.
    assert minimal["properties"]["colorDimension"]["type"] == "string"
    assert "x-collapsed" not in minimal["properties"]["colorDimension"]
    # customize is an optional OBJECT → collapsed at the root.
    customize = minimal["properties"]["customize"]
    assert customize["x-collapsed"] is True
    assert customize["x-path"] == "customize"
    # A terse description is KEPT — it's the breadcrumb telling a consumer what
    # lives under this branch so it knows to drill in. But the child props
    # themselves are withheld (that's what keeps the first fetch small); they're
    # fetched on demand via get_subtree.
    assert customize["description"] == "Per-series color and size overrides."
    assert "properties" not in customize
    # customize contains an x-dynamic branch (per-series styling keyed by the
    # query's values), so the marker is flagged dynamic — the consumer knows it
    # expands from the current query and must be re-fetched when the query
    # changes.
    assert customize["x-dynamic"] is True
    # The root has a collapsed object child → flagged partial.
    assert minimal["x-partial"] is True


def test_collapsed_marker_is_static_when_no_dynamic_content() -> None:
    widget = registry.get("ag-grid-table")
    assert widget is not None
    minimal = prune_to_minimal_viable(widget.get_control_schema(None, None))
    # columnDefs is an optional array-of-objects → collapsed, but its shape does
    # not depend on the query, so it carries no x-dynamic flag (it's static).
    column_defs = minimal["properties"]["columnDefs"]
    assert column_defs["x-collapsed"] is True
    assert "x-dynamic" not in column_defs


def test_get_subtree_inlines_a_branch() -> None:
    subtree = get_subtree(_balloons_schema(), "dataBinding")
    props = subtree["properties"]
    assert {"datasetId", "metrics", "dimensions", "rowLimit"} <= set(props)
    # Fully inlined — no dangling refs.
    assert "$ref" not in str(subtree)


def test_get_subtree_reaches_dynamic_series_after_enrichment() -> None:
    enriched = _balloons_schema(
        {
            "dataBinding": {
                "datasetId": 1,
                "metrics": ["count"],
                "dimensions": ["gender"],
            }
        },
        ["boy", "girl"],
    )
    series = get_subtree(enriched, "customize/series")
    assert set(series["properties"]) == {"boy", "girl"}
    assert series["properties"]["boy"]["properties"]["color"]["x-control"] == "color"


def test_get_subtree_raises_on_bad_path() -> None:
    with pytest.raises(SchemaPathError):
        get_subtree(_balloons_schema(), "customize/nope")


def test_get_subtrees_expands_several_paths_in_one_call() -> None:
    subtrees = get_subtrees(_balloons_schema(), ["dataBinding", "customize"])
    assert set(subtrees) == {"dataBinding", "customize"}
    assert "datasetId" in subtrees["dataBinding"]["properties"]
    assert "series" in subtrees["customize"]["properties"]


def test_get_subtrees_raises_on_any_bad_path() -> None:
    with pytest.raises(SchemaPathError):
        get_subtrees(_balloons_schema(), ["dataBinding", "customize/nope"])
