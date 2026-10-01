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
Which widgets each filter, cross-filter source and customization drives.

By default a node drives every filterable widget under its nearest ancestor
container that bounds filter scope, or the whole canvas when there is none,
never itself. A filter in a tab drives that tab; a filter in a filter bar that
does not bound scope drives the whole canvas. A per-node override in
``interactions`` can make the scope global or name the targets, and can
exclude nodes from an auto or global scope.

Only filterable widgets are ever driven, and nodes whose widget or type no
longer resolves are skipped. Cross-filter scopes are empty while cross-filters
are turned off in the canvas settings.
"""

from __future__ import annotations

from typing import Any

from superset_core.canvas import CanvasLayoutRules, WidgetResolver

from superset.canvas.definition.registry import (
    get_widget_resolver,
    layout_rules,
    LayoutRulesRegistry,
)
from superset.canvas.definition.schemas import (
    FilterScopeMode,
    ROOT_ID,
    SCOPE_FIELDS,
)

# The layout rule that makes a node own each kind of scope.
_ROLES = {
    "filter": "is_filter",
    "crossFilter": "is_cross_filter_source",
    "customization": "is_customization",
}
# Response keys for each kind's resolved scopes.
SCOPE_RESULT_KEYS = {
    "filter": "filterScopes",
    "crossFilter": "crossFilterScopes",
    "customization": "customizationScopes",
}


def _reading_order(canvas: dict[str, Any], start: str) -> list[str]:
    """Node ids under ``start`` (exclusive), depth first in children order."""
    ordered: list[str] = []
    stack = list(reversed(_children(canvas, start)))
    while stack:
        node_id = stack.pop()
        ordered.append(node_id)
        stack.extend(reversed(_children(canvas, node_id)))
    return ordered


def resolve_scopes(
    canvas: dict[str, Any],
    rules: LayoutRulesRegistry | None = None,
    resolver: WidgetResolver | None = None,
) -> dict[str, dict[str, list[str]]]:
    """
    Map each kind's response key (``filterScopes``, ``crossFilterScopes``,
    ``customizationScopes``) to ``{node id: driven node ids}``, in reading order.
    """
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
    interactions = canvas.get("interactions", {})
    cross_filters_on = (
        canvas.get("settings", {}).get("crossFilters", {}).get("enabled", True)
    )

    resolved: dict[str, dict[str, list[str]]] = {}
    for kind, role in _ROLES.items():
        scopes: dict[str, list[str]] = {}
        resolved[SCOPE_RESULT_KEYS[kind]] = scopes
        if kind == "crossFilter" and not cross_filters_on:
            continue
        overrides = interactions.get(SCOPE_FIELDS[kind], {})
        for node_id, node_rule in node_rules.items():
            if not getattr(node_rule, role):
                continue
            override = overrides.get(node_id, {})
            mode = FilterScopeMode(override.get("mode", FilterScopeMode.AUTO))
            if mode == FilterScopeMode.CUSTOM:
                candidates = override["targets"]
            else:
                boundary = (
                    ROOT_ID
                    if mode == FilterScopeMode.GLOBAL
                    else _scope_boundary(node_id, parents, node_rules)
                )
                excluded = set(override.get("exclude", []))
                candidates = [
                    n for n in _reading_order(canvas, boundary) if n not in excluded
                ]
            scopes[node_id] = [
                n for n in candidates if n in filterable and n != node_id
            ]
    return resolved


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
