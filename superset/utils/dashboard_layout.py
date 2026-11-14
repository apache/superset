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
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


"""Read-only helpers for reasoning about a dashboard's ``position_json`` layout."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

ROOT_ID = "ROOT_ID"
GRID_ID = "GRID_ID"

_LEAF_TYPES = {"MARKDOWN", "HEADER", "DIVIDER"}
_KNOWN_TYPES = _LEAF_TYPES | {"ROOT", "GRID", "ROW", "COLUMN", "TAB", "TABS", "CHART"}


class _LayoutError(Exception):
    """The layout cannot be interpreted with confidence."""


def _children(
    position: dict[str, Any], node_id: Any
) -> tuple[dict[str, Any], list[Any]]:
    node = position.get(node_id) if isinstance(node_id, str) else None
    if not isinstance(node, dict):
        raise _LayoutError(f"missing or malformed node {node_id!r}")
    children = node.get("children", [])
    if not isinstance(children, list):
        raise _LayoutError(f"malformed children on {node_id!r}")
    return node, children


def _find_anchor_paths(position: dict[str, Any], anchor: str) -> list[list[str]]:
    """Walk the whole layout, validating it, and return each root-to-anchor path.

    A node reachable from more than one parent is rejected: path-aware counting
    assumes every node has exactly one place in the tree.
    """

    paths: list[list[str]] = []
    stack: list[str] = []
    seen: set[str] = set()

    def walk(node_id: Any) -> None:
        if not isinstance(node_id, str):
            raise _LayoutError(f"non-string node id {node_id!r}")
        if node_id in seen:
            raise _LayoutError("layout reaches a node more than once")
        seen.add(node_id)
        node, children = _children(position, node_id)
        if node.get("type") not in _KNOWN_TYPES:
            raise _LayoutError(f"unsupported node type {node.get('type')!r}")
        stack.append(node_id)
        if node_id == anchor:
            paths.append(list(stack))
        for child_id in children:
            walk(child_id)
        stack.pop()

    walk(ROOT_ID)
    return paths


def _active_chart_count(
    position: dict[str, Any], node_id: str, on_path: set[str]
) -> int:
    """Count charts mounted when the anchor path is active.

    A TABS node on the root-to-anchor path shows only its path child; any other
    TABS node shows its first tab.
    """

    node, children = _children(position, node_id)
    node_type = node["type"]
    if node_type == "CHART":
        return 1
    if node_type in _LEAF_TYPES:
        return 0
    if node_type == "TABS":
        active = [child for child in children if child in on_path]
        active = active[:1] or children[:1]
        return sum(_active_chart_count(position, c, on_path) for c in active)
    return sum(_active_chart_count(position, c, on_path) for c in children)


def _has_orphan_charts(
    position: dict[str, Any], attached_chart_ids: Iterable[Any]
) -> bool:
    """Whether any attached chart has no CHART node in the layout.

    The dashboard frontend renders such charts (e.g. saved from Explore) in an
    extra row appended to the first root tab, so the layout alone understates
    what a browser mounts.
    """

    laid_out: set[Any] = set()
    for node in position.values():
        if isinstance(node, dict) and node.get("type") == "CHART":
            meta = node.get("meta")
            if isinstance(meta, dict):
                laid_out.add(meta.get("chartId"))
    return any(chart_id not in laid_out for chart_id in attached_chart_ids)


def selected_tab_chart_count(
    position: Any,
    anchor: Any,
    attached_chart_ids: Iterable[Any] | None = None,
) -> tuple[int, str] | None:
    """Return ``(active_chart_count, pane_id_suffix)`` for a tab-anchored capture.

    The count is the number of charts a browser mounts when the dashboard opens
    with ``anchor`` selected: only the path child of every TABS node between the
    root and the anchor is active, and every other TABS node shows its first
    tab. ``pane_id_suffix`` identifies the rendered tab pane: the pane key of a
    root-level tab (``GRID_ID`` for the first tab, otherwise its index), or the
    tab id for tabs nested under any other container. The pane id format
    (``<TabsId>-panel-<key>``) is produced by antd/rc-tabs and relied on by the
    report readiness predicate.

    When ``attached_chart_ids`` is given, ``None`` is also returned if any of
    those charts has no CHART node in the layout, since the frontend mounts it
    in the first root tab.

    Returns ``None`` whenever the layout is empty, malformed, ambiguous, or
    contains node types this helper cannot reason about, so callers keep the
    default behaviour rather than treating the tab as empty.
    """

    if not isinstance(position, dict) or not position:
        return None
    if not isinstance(anchor, str) or not anchor:
        return None
    anchor_node = position.get(anchor)
    if not isinstance(anchor_node, dict) or anchor_node.get("type") != "TAB":
        return None
    if attached_chart_ids is not None and _has_orphan_charts(
        position, attached_chart_ids
    ):
        return None
    try:
        paths = _find_anchor_paths(position, anchor)
        if len(paths) != 1:
            return None
        path = paths[0]
        if anchor_node.get("parents") != path[:-1]:
            return None
        if len(path) < 3 or position[path[-2]].get("type") != "TABS":
            return None
        count = _active_chart_count(position, ROOT_ID, set(path))
        tabs_id = path[-2]
        _, siblings = _children(position, tabs_id)
        _, root_children = _children(position, ROOT_ID)
        if root_children and root_children[0] == tabs_id:
            index = siblings.index(anchor)
            return count, GRID_ID if index == 0 else str(index)
        return count, anchor
    except (_LayoutError, ValueError):
        return None
