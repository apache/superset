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

"""Structural repair for a dashboard's ``position_json``."""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)

ROOT_ID = "ROOT_ID"
CHART_TYPE = "CHART"
HEADER_TYPE = "HEADER"
MARKDOWN_TYPE = "MARKDOWN"
ROW_TYPE = "ROW"
TABS_TYPE = "TABS"
GRID_COLUMN_COUNT = 12
GRID_DEFAULT_CHART_WIDTH = 4
# ``HEADER_ID`` is dashboard metadata rather than a rendered child, and a
# dashboard with top-level tabs keeps an empty, detached ``GRID_ID``. Both are
# unreachable by design. Mirrors the reserved ids in the frontend's
# ``removeUnreachableComponents``.
RESERVED_IDS = frozenset({ROOT_ID, "GRID_ID", "HEADER_ID"})


def _children(component: Any) -> list[str]:
    children = component.get("children") if isinstance(component, dict) else None
    if not isinstance(children, list):
        return []
    return [child_id for child_id in children if isinstance(child_id, str)]


def _chart_id(component: dict[str, Any]) -> Any:
    meta = component.get("meta")
    return meta.get("chartId") if isinstance(meta, dict) else None


def _first_container_path(position: dict[str, Any]) -> list[str] | None:
    """Path from ``ROOT_ID`` to where new charts go, mirroring the frontend's
    ``findFirstParentContainerId``."""
    top_level = _children(position.get(ROOT_ID))
    if not top_level or not isinstance(position.get(top_level[0]), dict):
        return None
    if position[top_level[0]].get("type") == TABS_TYPE:
        tabs = _children(position[top_level[0]])
        if not tabs or not isinstance(position.get(tabs[0]), dict):
            return None
        return [ROOT_ID, top_level[0], tabs[0]]
    return [ROOT_ID, top_level[0]]


def _reattach_components(
    position: dict[str, Any],
    components: list[tuple[str, dict[str, Any]]],
    container_path: list[str],
) -> None:
    container_id = container_path[-1]
    container = position[container_id]
    row_parents = list(container_path)
    children = _children(container)
    row: dict[str, Any] | None = None
    row_width = 0
    for component_key, component in components:
        # a header is not a valid ROW child, so it goes directly in the container
        if component.get("type") == HEADER_TYPE:
            children.append(component_key)
            position[component_key] = {**component, "parents": list(row_parents)}
            row = None
            continue
        width = (component.get("meta") or {}).get("width")
        if not isinstance(width, int) or width <= 0:
            width = GRID_DEFAULT_CHART_WIDTH
        if row is None or row_width + width > GRID_COLUMN_COUNT:
            row_id = f"{ROW_TYPE}-{uuid4().hex[:10]}"
            row = {
                "id": row_id,
                "type": ROW_TYPE,
                "children": [],
                "parents": list(row_parents),
                "meta": {"background": "BACKGROUND_TRANSPARENT"},
            }
            position[row_id] = row
            children.append(row_id)
            row_width = 0
        row["children"].append(component_key)
        position[component_key] = {
            **component,
            "parents": [*row_parents, row["id"]],
        }
        row_width += width
    position[container_id] = {**container, "children": children}


def _reachable_ids(position: dict[str, Any]) -> set[str]:
    reachable: set[str] = set()
    stack: list[str] = [ROOT_ID]
    while stack:
        component_id = stack.pop()
        # doubles as the cycle guard: an id already seen is never expanded twice
        if component_id in reachable:
            continue
        reachable.add(component_id)
        for child_id in _children(position.get(component_id)):
            if isinstance(position.get(child_id), dict):
                stack.append(child_id)
    return reachable


def remove_unreachable_components(
    position: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    """Drop layout components that cannot be reached from ``ROOT_ID``.

    Superset renders only what hangs off ``ROOT_ID``, so a detached component is
    already invisible. It still survives in ``position_json``, where code that
    walks every entry or trusts a node's stale ``parents`` can find it — a
    detached subtree holding a cycle is what crashes the filter scope modal with
    "Maximum call stack size exceeded".

    A detached chart is reattached in new rows of the first top-level container
    instead of dropped, keeping its layout id. That preserves its
    ``chart_configuration`` (derived scopes drop entries for charts absent from
    the layout) and its dashboard membership even when the chart is archived and
    so absent from the charts the frontend loads. A chart that is also placed
    reachably is not duplicated.

    Detached markdown and headers are reattached the same way, since their text
    lives nowhere but ``position_json``. Markdown goes into the new rows; a
    header, which cannot be a row child, goes directly into the container.

    Returns the (possibly unchanged) position and the ids that were detached;
    reattached components are among them. Non-dict entries such as
    ``DASHBOARD_VERSION_KEY`` are never removed.
    """
    root = position.get(ROOT_ID) if isinstance(position, dict) else None
    # a malformed root would make everything look detached; leave it alone
    if not isinstance(root, dict) or not isinstance(root.get("children"), list):
        return position, []

    reachable = _reachable_ids(position)

    removed = [
        component_id
        for component_id, component in position.items()
        if isinstance(component, dict)
        and component_id not in reachable
        and component_id not in RESERVED_IDS
    ]
    if not removed:
        return position, []

    placed_chart_ids = {
        _chart_id(position[component_id])
        for component_id in reachable
        if position[component_id].get("type") == CHART_TYPE
    }
    rescued: list[tuple[str, dict[str, Any]]] = []
    for component_id in removed:
        component = position[component_id]
        component_type = component.get("type")
        if component_type in (MARKDOWN_TYPE, HEADER_TYPE):
            rescued.append((component_id, component))
            continue
        chart_id = _chart_id(component)
        if (
            component_type == CHART_TYPE
            and chart_id is not None
            and chart_id not in placed_chart_ids
        ):
            placed_chart_ids.add(chart_id)
            rescued.append((component_id, component))

    repaired = {
        component_id: component
        for component_id, component in position.items()
        if component_id not in removed
    }
    # a detached reserved id is kept, but must not reference the dropped nodes
    for component_id in RESERVED_IDS - reachable:
        component = repaired.get(component_id)
        if isinstance(component, dict) and component.get("children"):
            repaired[component_id] = {**component, "children": []}
    if rescued and (container_path := _first_container_path(repaired)):
        _reattach_components(repaired, rescued, container_path)
    return repaired, removed


def repair_position(
    position: dict[str, Any], dashboard_id: int | None = None
) -> dict[str, Any]:
    """Return *position* with detached components repaired, logging which.

    Thin wrapper over ``remove_unreachable_components`` for the write paths,
    which care about the repaired layout rather than the detached ids.
    """
    repaired, removed = remove_unreachable_components(position)
    if removed:
        logger.warning(
            "Dashboard %s: repaired %d layout component(s) unreachable from "
            "ROOT_ID: %s",
            dashboard_id,
            len(removed),
            ", ".join(sorted(removed)),
        )
    return repaired
