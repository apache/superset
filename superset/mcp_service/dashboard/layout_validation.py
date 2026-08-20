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
_CHART_TYPE = "CHART"
_CONTAINER_TYPES = {"GRID", "TABS"}
_ALLOWED_CHILD_TYPES = {
    "ROOT": {"GRID", "TABS"},
    "GRID": {
        "CHART",
        "COLUMN",
        "DIVIDER",
        "DYNAMIC",
        "HEADER",
        "MARKDOWN",
        "ROW",
        "TABS",
    },
    "ROW": {"CHART", "COLUMN", "DYNAMIC", "MARKDOWN"},
    "TABS": {"TAB"},
    "TAB": {
        "CHART",
        "COLUMN",
        "DIVIDER",
        "DYNAMIC",
        "HEADER",
        "MARKDOWN",
        "ROW",
        "TABS",
    },
    "COLUMN": {"CHART", "DIVIDER", "HEADER", "MARKDOWN", "ROW", "TABS"},
    "CHART": set(),
    "DIVIDER": set(),
    "DYNAMIC": set(),
    "HEADER": set(),
    "MARKDOWN": set(),
}


def validate_dashboard_layout(  # noqa: C901
    layout: dict[str, Any], expected_chart_ids: Collection[int]
) -> str | None:
    """Return an error when an MCP layout replacement is unsafe to persist.

    Superset renders only components reachable from ``ROOT_ID``. It separately
    indexes every chart component in ``position_json``, including unreachable
    ones, so an orphaned chart can suppress hydration's missing-chart fallback
    while remaining invisible. Validate graph reachability and parent paths,
    then require the layout to contain exactly the dashboard's associated
    charts before allowing a full replacement.

    ``HEADER_ID`` is dashboard metadata rather than a rendered tree child.
    Superset also retains an empty, detached ``GRID_ID`` when top-level tabs are
    used; both are allowed as explicit reserved-node exceptions.
    """
    root = layout.get(_ROOT_ID)
    if not isinstance(root, dict) or root.get("type") != "ROOT":
        return "Layout must contain a ROOT_ID component with type ROOT."

    root_children = root.get("children", [])
    if not isinstance(root_children, list) or not all(
        isinstance(child_id, str) for child_id in root_children
    ):
        return "ROOT_ID.children must be a list of component IDs."
    if len(root_children) > 1:
        return "ROOT_ID may contain at most one GRID or TABS component."
    if root_children:
        root_child = layout.get(root_children[0])
        root_child_type = (
            root_child.get("type") if isinstance(root_child, dict) else None
        )
        if not isinstance(root_child_type, str) or root_child_type not in (
            _CONTAINER_TYPES
        ):
            return "ROOT_ID's child must be a GRID or TABS component."

    visited: set[str] = set()
    visiting: set[str] = set()
    reachable_chart_ids: set[int] = set()

    def visit(  # noqa: C901
        component_id: str, ancestors: list[str]
    ) -> str | None:
        if component_id in visiting:
            return f"Layout contains a cycle at {component_id}."
        if component_id in visited:
            return f"Layout component {component_id} has more than one parent."

        component = layout.get(component_id)
        if not isinstance(component, dict):
            return f"Layout references missing component {component_id}."
        if component.get("id") != component_id:
            return f"Layout component {component_id} must have the same id value."
        if component_id == _ROOT_ID:
            if component.get("parents", []) not in ([], None):
                return "ROOT_ID must not have parents."
        elif component.get("parents") != ancestors:
            return f"Layout component {component_id} has inconsistent parents."

        children = component.get("children", [])
        if not isinstance(children, list) or not all(
            isinstance(child_id, str) for child_id in children
        ):
            return f"Layout component {component_id}.children must be a list."

        component_type = component.get("type")
        if not isinstance(component_type, str):
            return f"Layout component {component_id} has unsupported type."
        allowed_child_types = _ALLOWED_CHILD_TYPES.get(component_type)
        if allowed_child_types is None:
            return f"Layout component {component_id} has unsupported type."

        for child_id in children:
            child = layout.get(child_id)
            if not isinstance(child, dict):
                return f"Layout references missing component {child_id}."
            if child.get("type") not in allowed_child_types:
                return (
                    f"Layout component {child_id} cannot be a child of {component_id}."
                )

        if component_type == _CHART_TYPE:
            meta = component.get("meta")
            chart_id = meta.get("chartId") if isinstance(meta, dict) else None
            if not isinstance(chart_id, int) or isinstance(chart_id, bool):
                return f"Chart component {component_id} must have an integer chartId."
            if children:
                return f"Chart component {component_id} cannot have children."
            reachable_chart_ids.add(chart_id)

        visiting.add(component_id)
        for child_id in children:
            if error := visit(child_id, [*ancestors, component_id]):
                return error
        visiting.remove(component_id)
        visited.add(component_id)
        return None

    if error := visit(_ROOT_ID, []):
        return error

    detached_grid_allowed = bool(
        root_children
        and isinstance(layout.get(root_children[0]), dict)
        and layout[root_children[0]].get("type") == "TABS"
    )
    for component_id, component in layout.items():
        if not isinstance(component, dict) or "type" not in component:
            continue
        if component_id in visited:
            continue
        if (
            component_id == _HEADER_ID
            and component.get("id") == _HEADER_ID
            and component.get("type") == "HEADER"
            and component.get("children", []) == []
        ):
            continue
        if (
            component_id == _GRID_ID
            and detached_grid_allowed
            and component.get("id") == _GRID_ID
            and component.get("type") == "GRID"
            and component.get("children", []) == []
            and component.get("parents") == [_ROOT_ID]
        ):
            continue
        return f"Layout component {component_id} is unreachable from ROOT_ID."

    expected = set(expected_chart_ids)
    if missing := sorted(expected - reachable_chart_ids):
        return f"Layout would hide dashboard charts: {missing}."
    if unknown := sorted(reachable_chart_ids - expected):
        return f"Layout references charts not associated with the dashboard: {unknown}."

    return None
