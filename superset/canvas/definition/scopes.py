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
Which widgets each filter on a canvas drives.

By default a filter drives every filterable widget under its nearest ancestor
container that bounds filter scope, or the whole canvas when there is none. A
filter in a tab drives that tab; a filter in a filter bar that does not bound
scope drives the whole canvas. A per-filter override in
``interactions.filters`` can make the scope global or name the targets, and
can exclude nodes from an auto or global scope.

Only filterable widgets are ever driven, and nodes whose widget or type no
longer resolves are skipped.
"""

from __future__ import annotations

from typing import Any

from superset_core.canvas import CanvasLayoutRules, WidgetResolver

from superset.canvas.definition.registry import (
    get_widget_resolver,
    layout_rules,
    LayoutRulesRegistry,
)
from superset.canvas.definition.schemas import FilterScopeMode, ROOT_ID


def _reading_order(canvas: dict[str, Any], start: str) -> list[str]:
    """Node ids under ``start`` (exclusive), depth first in children order."""
    children = (
        canvas["root"]["children"]
        if start == ROOT_ID
        else canvas["nodes"][start].get("children") or []
    )
    ordered: list[str] = []
    for child in children:
        ordered.append(child)
        ordered.extend(_reading_order(canvas, child))
    return ordered


def resolve_filter_scopes(
    canvas: dict[str, Any],
    rules: LayoutRulesRegistry | None = None,
    resolver: WidgetResolver | None = None,
) -> dict[str, list[str]]:
    """Map each filter node id to the node ids it drives, in reading order."""
    rules = rules or layout_rules
    resolver = resolver or get_widget_resolver()
    nodes = canvas["nodes"]
    types = resolver.widget_types({node["widget"] for node in nodes.values()})
    node_rules: dict[str, type[CanvasLayoutRules]] = {
        node_id: rules.get(types[node["widget"]])
        for node_id, node in nodes.items()
        if node["widget"] in types
    }
    parents = {
        child: parent
        for parent in [ROOT_ID, *nodes]
        for child in _children(canvas, parent)
    }
    filterable = {n for n, r in node_rules.items() if r.is_filterable}
    overrides = canvas.get("interactions", {}).get("filters", {})

    scopes: dict[str, list[str]] = {}
    for node_id, node_rule in node_rules.items():
        if not node_rule.is_filter:
            continue
        override = overrides.get(node_id, {})
        mode = FilterScopeMode(override.get("mode", FilterScopeMode.AUTO))
        if mode == FilterScopeMode.CUSTOM:
            scopes[node_id] = [t for t in override["targets"] if t in filterable]
            continue
        boundary = (
            ROOT_ID
            if mode == FilterScopeMode.GLOBAL
            else _scope_boundary(node_id, parents, node_rules)
        )
        excluded = set(override.get("exclude", []))
        scopes[node_id] = [
            n
            for n in _reading_order(canvas, boundary)
            if n in filterable and n not in excluded
        ]
    return scopes


def _children(canvas: dict[str, Any], parent: str) -> list[str]:
    if parent == ROOT_ID:
        return canvas["root"]["children"]
    return canvas["nodes"][parent].get("children") or []


def _scope_boundary(
    node_id: str,
    parents: dict[str, str],
    node_rules: dict[str, type[CanvasLayoutRules]],
) -> str:
    current = parents.get(node_id, ROOT_ID)
    while current != ROOT_ID:
        container = node_rules.get(current)
        # An unresolved container keeps its filters contained.
        if container is None or container.bounds_filter_scope:
            return current
        current = parents.get(current, ROOT_ID)
    return ROOT_ID
