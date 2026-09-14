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

"""Validation for dashboard layouts supplied through MCP tools."""

from __future__ import annotations

from collections.abc import Collection
from typing import Any

_ROOT_ID = "ROOT_ID"
_GRID_ID = "GRID_ID"
_HEADER_ID = "HEADER_ID"
_VERSION_KEY = "DASHBOARD_VERSION_KEY"
_CHART_TYPE = "CHART"
# Chart IDs are database integers; a decimal string longer than a 64-bit value
# is malformed input rather than an ID that could ever resolve.
_MAX_CHART_ID_DIGITS = 19

# Keep in sync with the frontend's parent/child contract in
# superset-frontend/src/dashboard/util/isValidChild.ts, which admits a child
# only when both its type and its parent's nesting depth are allowed. The
# values below are that file's ``parentMaxDepthLookup``; traversal is iterative
# so deeply nested input cannot overflow Python's call stack.
_ROOT_DEPTH = 0
_DEPTH_ONE = _ROOT_DEPTH + 1
_DEPTH_THREE = _ROOT_DEPTH + 3
_DEPTH_FOUR = _ROOT_DEPTH + 4
_DEPTH_FIVE = _ROOT_DEPTH + 5

_PARENT_MAX_DEPTH: dict[str, dict[str, int]] = {
    "ROOT": {"GRID": _ROOT_DEPTH, "TABS": _ROOT_DEPTH},
    "GRID": {
        "CHART": _DEPTH_ONE,
        "COLUMN": _DEPTH_ONE,
        "DIVIDER": _DEPTH_ONE,
        "DYNAMIC": _DEPTH_ONE,
        "HEADER": _DEPTH_ONE,
        "MARKDOWN": _DEPTH_ONE,
        "ROW": _DEPTH_ONE,
        "TABS": _DEPTH_ONE,
    },
    "ROW": {
        "CHART": _DEPTH_FOUR,
        "COLUMN": _DEPTH_FOUR,
        "DYNAMIC": _DEPTH_FOUR,
        "MARKDOWN": _DEPTH_FOUR,
    },
    "TABS": {"TAB": _DEPTH_THREE},
    "TAB": {
        "CHART": _DEPTH_FIVE,
        "COLUMN": _DEPTH_THREE,
        "DIVIDER": _DEPTH_FIVE,
        "DYNAMIC": _DEPTH_FIVE,
        "HEADER": _DEPTH_FIVE,
        "MARKDOWN": _DEPTH_FIVE,
        "ROW": _DEPTH_THREE,
        "TABS": _DEPTH_THREE,
    },
    "COLUMN": {
        "CHART": _DEPTH_FIVE,
        "DIVIDER": _DEPTH_THREE,
        "HEADER": _DEPTH_FIVE,
        "MARKDOWN": _DEPTH_FIVE,
        "ROW": _DEPTH_THREE,
        "TABS": _DEPTH_THREE,
    },
    "CHART": {},
    "DIVIDER": {},
    "DYNAMIC": {},
    "HEADER": {},
    "MARKDOWN": {},
}
_ALLOWED_CHILD_TYPES: dict[str, frozenset[str]] = {
    parent_type: frozenset(child_depths)
    for parent_type, child_depths in _PARENT_MAX_DEPTH.items()
}
# TABS and TAB deliberately render their children at their own depth; every
# other container increments it. See the worked examples in isValidChild.ts.
_DEPTH_TRANSPARENT_TYPES = frozenset({"TABS", "TAB"})
_CONTAINER_TYPES = frozenset(
    component_type
    for component_type, child_types in _ALLOWED_CHILD_TYPES.items()
    if child_types
)
_META_REQUIRED_TYPES = frozenset(_ALLOWED_CHILD_TYPES) - {"ROOT", "GRID"}


def normalize_chart_id(value: Any) -> int | None:
    """Normalize an integer or canonical decimal-string chart ID.

    Only canonical decimal strings are accepted. Leading-zero forms such as
    ``"007"`` are rejected so that layout lookups and the ``json_metadata``
    cleanup in ``remove_chart_from_dashboard`` — which keys off
    ``str(chart_id)`` — cannot disagree about whether a reference matches and
    leave stale references behind. The digit bound keeps ``int()`` away from
    CPython's integer string conversion limit, which would otherwise raise
    ``ValueError`` out of the validator instead of returning a structured
    error; no real chart ID approaches it.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if (
        isinstance(value, str)
        and value.isascii()
        and value.isdecimal()
        and len(value) <= _MAX_CHART_ID_DIGITS
        and not value.startswith("0")
    ):
        return int(value)
    return None


def _validate_component_shapes(  # noqa: C901
    layout: dict[str, Any],
) -> tuple[dict[str, dict[str, Any]], str | None]:
    """Validate and return every component object in a raw layout mapping."""
    if layout.get(_VERSION_KEY) != "v2":
        return {}, f"{_VERSION_KEY} must be the string 'v2'."

    components: dict[str, dict[str, Any]] = {}
    for component_id, component in layout.items():
        if component_id == _VERSION_KEY:
            continue
        if not isinstance(component, dict):
            return {}, f"Layout value {component_id} must be a component object."
        if component.get("id") != component_id:
            return {}, f"Layout component {component_id} must have the same id value."

        component_type = component.get("type")
        if not isinstance(component_type, str) or component_type not in (
            _ALLOWED_CHILD_TYPES
        ):
            return {}, f"Layout component {component_id} has unsupported type."
        if component_type == "DYNAMIC":
            return {}, (
                f"Layout component {component_id} uses DYNAMIC, which cannot be "
                "safely validated by the server."
            )

        children = component.get("children")
        if component_type in _CONTAINER_TYPES and children is None:
            return {}, f"Layout component {component_id} must define children."
        if children is not None and (
            not isinstance(children, list)
            or not all(isinstance(child_id, str) for child_id in children)
        ):
            return {}, f"Layout component {component_id}.children must be a list."
        if component_type not in _CONTAINER_TYPES and children not in (None, []):
            return {}, f"Layout component {component_id} cannot have children."
        if component_type == "TABS" and not children:
            return {}, f"Tabs component {component_id} must contain at least one tab."
        if component_type in _META_REQUIRED_TYPES and not isinstance(
            component.get("meta"), dict
        ):
            return {}, f"Layout component {component_id}.meta must be an object."

        components[component_id] = component

    return components, None


def _validate_edges(
    components: dict[str, dict[str, Any]],
) -> tuple[dict[str, str], str | None]:
    """Validate graph edges and return each component's actual parent."""
    parent_by_child: dict[str, str] = {}
    for parent_id, parent in components.items():
        parent_type = parent["type"]
        for child_id in parent.get("children") or []:
            child = components.get(child_id)
            if child is None:
                return {}, f"Layout references missing component {child_id}."
            if child["type"] not in _ALLOWED_CHILD_TYPES[parent_type]:
                return {}, (
                    f"Layout component {child_id} cannot be a child of {parent_id}."
                )
            if child_id in parent_by_child:
                return {}, f"Layout component {child_id} has more than one parent."
            parent_by_child[child_id] = parent_id

    if _ROOT_ID in parent_by_child:
        return {}, "ROOT_ID must not have a parent."
    return parent_by_child, None


def _find_cycle(components: dict[str, dict[str, Any]]) -> str | None:
    """Return a component ID in a cycle using an iterative depth-first walk."""
    state: dict[str, int] = {}
    for start_id in components:
        if state.get(start_id) == 2:
            continue
        stack: list[tuple[str, bool]] = [(start_id, False)]
        while stack:
            component_id, exiting = stack.pop()
            if exiting:
                state[component_id] = 2
                continue
            if state.get(component_id) == 1:
                return component_id
            if state.get(component_id) == 2:
                continue
            state[component_id] = 1
            stack.append((component_id, True))
            for child_id in reversed(components[component_id].get("children") or []):
                stack.append((child_id, False))
    return None


def validate_dashboard_layout(  # noqa: C901
    layout: dict[str, Any], expected_chart_ids: Collection[int]
) -> str | None:
    """Return an error when an MCP layout replacement is unsafe to persist.

    Superset renders only components reachable from ``ROOT_ID`` but indexes all
    chart nodes during hydration. This validates renderer-required component
    shape and graph topology, then requires the reachable charts to match the
    dashboard's associated charts before allowing a full replacement.

    ``HEADER_ID`` is dashboard metadata rather than a rendered tree child.
    Superset also retains an empty, detached ``GRID_ID`` when top-level tabs are
    used; both are allowed as explicit reserved-node exceptions.
    """
    components, error = _validate_component_shapes(layout)
    if error:
        return error

    root = components.get(_ROOT_ID)
    if root is None or root.get("type") != "ROOT":
        return "Layout must contain a ROOT_ID component with type ROOT."
    root_children = root.get("children") or []
    if len(root_children) != 1:
        return "ROOT_ID must contain exactly one GRID or TABS component."

    parent_by_child, error = _validate_edges(components)
    if error:
        return error
    if cycle_id := _find_cycle(components):
        return f"Layout contains a cycle at {cycle_id}."

    visited: set[str] = set()
    reachable_chart_ids: set[int] = set()
    # The frontend treats ``parents`` as derived metadata and recomputes it
    # during hydration. Saved layouts can therefore omit it or retain stale
    # values after drag-and-drop; the validated child edges are authoritative.
    # Depth is likewise derived here rather than trusted, and is only defined
    # for reachable nodes, so the nesting limits are checked on this walk.
    stack: list[tuple[str, int]] = [(_ROOT_ID, _ROOT_DEPTH)]
    while stack:
        component_id, depth = stack.pop()
        component = components[component_id]
        component_type = component["type"]
        visited.add(component_id)

        if component_type == _CHART_TYPE:
            chart_id = normalize_chart_id(component["meta"].get("chartId"))
            if chart_id is None:
                return (
                    f"Chart component {component_id} must have a positive integer "
                    "or decimal-string chartId."
                )
            reachable_chart_ids.add(chart_id)

        child_depth = depth if component_type in _DEPTH_TRANSPARENT_TYPES else depth + 1
        for child_id in reversed(component.get("children") or []):
            # ``_validate_edges`` already accepted this parent/child type pair,
            # so a missing entry here is impossible.
            if depth > _PARENT_MAX_DEPTH[component_type][components[child_id]["type"]]:
                return (
                    f"Layout component {child_id} is nested too deeply under "
                    f"{component_id}."
                )
            stack.append((child_id, child_depth))

    top_level_type = components[root_children[0]]["type"]
    for component_id, component in components.items():
        if component_id in visited:
            continue
        if component_id == _HEADER_ID and component["type"] == "HEADER":
            continue
        if (
            component_id == _GRID_ID
            and top_level_type == "TABS"
            and component["type"] == "GRID"
            and component.get("children") == []
        ):
            continue
        return f"Layout component {component_id} is unreachable from ROOT_ID."

    expected = set(expected_chart_ids)
    if missing := sorted(expected - reachable_chart_ids):
        return f"Layout would hide dashboard charts: {missing}."
    if unknown := sorted(reachable_chart_ids - expected):
        return f"Layout references charts not associated with the dashboard: {unknown}."

    return None
