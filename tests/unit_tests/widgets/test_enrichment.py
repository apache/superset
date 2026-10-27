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

from typing import Any

import pytest
from pydantic import BaseModel
from superset_core.widgets.enrichment import (
    build_dependency_graph,
    dynamic_field_paths,
    run_enrichers,
    toposort_or_raise,
)


def test_dynamic_field_paths_finds_top_level_field() -> None:
    schema = {
        "properties": {
            "a": {"x-dynamic": True, "x-dependsOn": ["b"]},
            "b": {"type": "string"},
        }
    }
    fields = dynamic_field_paths(schema)
    assert list(fields) == ["a"]
    assert fields["a"] is schema["properties"]["a"]


def test_dynamic_field_paths_finds_nested_defs_field() -> None:
    # Mirrors Customization.series's actual shape: the dynamic field lives
    # inside a $defs entry referenced by $ref, not directly in properties.
    schema = {
        "properties": {"customize": {"$ref": "#/$defs/Customization"}},
        "$defs": {
            "Customization": {
                "properties": {
                    "series": {"x-dynamic": True, "x-dependsOn": ["dataBinding"]}
                }
            }
        },
    }
    fields = dynamic_field_paths(schema)
    assert list(fields) == ["customize/series"]


def test_build_dependency_graph_edge_vs_gate() -> None:
    fields: dict[str, dict[str, Any]] = {
        "a": {"x-dynamic": True, "x-dependsOn": ["b", "staticField"]},
        "b": {"x-dynamic": True},
    }
    graph = build_dependency_graph(fields)
    # "b" is a known dynamic path -> ordering edge; "staticField" isn't -> not an edge.
    assert graph == {"a": ["b"], "b": []}


def test_toposort_orders_a_chain() -> None:
    graph = {"c": ["b"], "b": ["a"], "a": []}
    order = toposort_or_raise(graph, "test-widget")
    assert order.index("a") < order.index("b") < order.index("c")


def test_toposort_raises_on_cycle() -> None:
    graph = {"a": ["b"], "b": ["a"]}
    with pytest.raises(ValueError, match="a") as exc_info:
        toposort_or_raise(graph, "test-widget")
    assert "b" in str(exc_info.value)


def test_run_enrichers_threads_upstream_result_forward() -> None:
    schema: dict[str, Any] = {
        "properties": {
            "a": {"x-dynamic": True},
            "b": {"x-dynamic": True, "x-dependsOn": ["a"]},
        }
    }
    fields = dynamic_field_paths(schema)
    order = toposort_or_raise(build_dependency_graph(fields), "test-widget")

    seen_upstream = {}

    def enrich_a(schema_arg, node, parsed, series, upstream):
        node["computed"] = "from-a"
        return "a-result"

    def enrich_b(schema_arg, node, parsed, series, upstream):
        seen_upstream.update(upstream)

    run_enrichers(schema, fields, order, {"a": enrich_a, "b": enrich_b}, None, [])

    assert schema["properties"]["a"]["computed"] == "from-a"
    assert seen_upstream == {"a": "a-result"}


def test_run_enrichers_skips_ungated_field_without_error() -> None:
    # No enricher registered for a discovered dynamic field: no-op, not an error.
    schema = {"properties": {"a": {"x-dynamic": True}}}
    fields = dynamic_field_paths(schema)
    order = toposort_or_raise(build_dependency_graph(fields), "test-widget")
    run_enrichers(schema, fields, order, {}, None, [])  # must not raise


def test_run_enrichers_does_not_gate_on_its_own_ordering_edge() -> None:
    # "b" depends on "a" only as an ordering edge (both are x-dynamic paths in
    # `fields`) — that's enforced by `order`, not a plain-attribute gate. A
    # naive check_dependencies(node, parsed) call would look up an attribute
    # literally named "a", find nothing, and skip "b" forever.
    schema: dict[str, Any] = {
        "properties": {
            "a": {"x-dynamic": True},
            "b": {"x-dynamic": True, "x-dependsOn": ["a"]},
        }
    }
    fields = dynamic_field_paths(schema)
    order = toposort_or_raise(build_dependency_graph(fields), "test-widget")

    class Config(BaseModel):
        pass

    ran = []

    def enrich_a(schema_arg, node, parsed, series, upstream):
        ran.append("a")

    def enrich_b(schema_arg, node, parsed, series, upstream):
        ran.append("b")

    run_enrichers(schema, fields, order, {"a": enrich_a, "b": enrich_b}, Config(), [])

    assert ran == ["a", "b"]


def test_run_enrichers_still_gates_on_a_plain_non_edge_dependency() -> None:
    schema: dict[str, Any] = {
        "properties": {"a": {"x-dynamic": True, "x-dependsOn": ["flag"]}}
    }
    fields = dynamic_field_paths(schema)
    order = toposort_or_raise(build_dependency_graph(fields), "test-widget")

    class Config(BaseModel):
        flag: bool = False

    ran = []

    def enrich_a(schema_arg, node, parsed, series, upstream):
        ran.append("a")

    run_enrichers(schema, fields, order, {"a": enrich_a}, Config(flag=False), [])
    assert ran == []

    run_enrichers(schema, fields, order, {"a": enrich_a}, Config(flag=True), [])
    assert ran == ["a"]
