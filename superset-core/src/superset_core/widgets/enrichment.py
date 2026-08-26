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
Dependency graph and execution engine for a widget's dynamic (``x-dynamic``)
control-schema fields.

A widget registers one enricher callable per dynamic field path (see
``Widget.enrichers``). Each field's existing ``x-dependsOn`` list (already
used to gate enrichment via ``check_dependencies``) does double duty here:
an entry naming another dynamic field's path becomes an ordering edge (that
field's enricher must run first, and this one receives its result); any
other entry stays a plain truthiness gate against the parsed control values.
Field paths use ``a/b`` dot-path notation, the same convention
``schema_tools.py`` uses for drill-in paths.

This module only computes the graph and runs enrichers in order — it has no
opinion on where the schema or enrichers come from; ``Widget.get_control_schema``
wires it up.
"""

from __future__ import annotations

from typing import Any, Callable

from pydantic import BaseModel

from superset_core.semantic_layers.config import check_dependencies

# (schema, node, parsed, series, upstream_results) -> Any.
# `schema` is the full document (for cross-$defs lookups, e.g. a sibling
# style definition); `node` is this field's own schema fragment, mutated in
# place. The return value is threaded to enrichers ordered after this one, as
# `upstream_results[path]`.
EnricherFn = Callable[
    [dict[str, Any], dict[str, Any], "BaseModel | None", list[str], dict[str, Any]],
    Any,
]


def _defs(schema: dict[str, Any]) -> dict[str, Any]:
    return schema.get("$defs", {}) or {}


def _deref(schema: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    if "$ref" not in node:
        return node
    return _defs(schema).get(node["$ref"].split("/")[-1], {})


def dynamic_field_paths(schema: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Walk a built (pre-enrichment) control schema and return
    ``{path: schema_node}`` for every field carrying ``x-dynamic: true``,
    using ``a/b`` dot-path notation. Descends into ``properties`` and
    resolves ``$ref`` against ``$defs`` along the way; does not descend into
    a discovered dynamic field itself (a dynamic field's own internals are
    the enricher's concern, not the graph's)."""
    fields: dict[str, dict[str, Any]] = {}

    def _walk(node: dict[str, Any], prefix: str) -> None:
        resolved = _deref(schema, node)
        for name, prop in resolved.get("properties", {}).items():
            path = f"{prefix}/{name}" if prefix else name
            prop_resolved = _deref(schema, prop)
            if prop_resolved.get("x-dynamic"):
                fields[path] = prop_resolved
            else:
                _walk(prop, path)

    _walk(schema, "")
    return fields


def build_dependency_graph(fields: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    """``{path: [ordering-edge paths]}`` for every dynamic field in
    ``fields``. Only ``x-dependsOn`` entries that name another key of
    ``fields`` become edges; every other entry is left as a gate for
    ``check_dependencies`` to evaluate at run time, not an edge here."""
    return {
        path: [dep for dep in node.get("x-dependsOn", []) if dep in fields]
        for path, node in fields.items()
    }


def toposort_or_raise(graph: dict[str, list[str]], widget_type: str) -> list[str]:
    """Kahn's algorithm over ``graph`` (``path -> [paths it depends on]``).
    Raises ``ValueError`` naming every field on a cycle when the graph isn't
    a DAG."""
    in_degree = dict.fromkeys(graph, 0)
    dependents: dict[str, list[str]] = {path: [] for path in graph}
    for path, deps in graph.items():
        in_degree[path] = len(deps)
        for dep in deps:
            dependents[dep].append(path)

    ready = sorted(path for path, degree in in_degree.items() if degree == 0)
    order: list[str] = []
    while ready:
        path = ready.pop(0)
        order.append(path)
        for dependent in sorted(dependents[path]):
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                ready.append(dependent)

    if len(order) != len(graph):
        remaining = sorted(set(graph) - set(order))
        raise ValueError(
            f"Cyclic control dependency in widget {widget_type!r} among: "
            f"{', '.join(remaining)}"
        )
    return order


def run_enrichers(
    schema: dict[str, Any],
    fields: dict[str, dict[str, Any]],
    order: list[str],
    enrichers: dict[str, EnricherFn],
    parsed: BaseModel | None,
    series: list[str],
) -> None:
    """Run each path's registered enricher (if any) in ``order``, skipping
    one whose non-edge ``x-dependsOn`` gate(s) aren't satisfied, and
    threading each enricher's return value forward as
    ``upstream_results[path]`` for anything ordered after it."""
    upstream_results: dict[str, Any] = {}
    for path in order:
        enricher = enrichers.get(path)
        if enricher is None:
            continue
        node = fields[path]
        if parsed is not None and not check_dependencies(node, parsed):
            continue
        result = enricher(schema, node, parsed, series, upstream_results)
        upstream_results[path] = result
