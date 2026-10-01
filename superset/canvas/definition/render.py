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
What a renderer needs besides the stored definition.

Placement rules live on the server only: ``placements`` gives every node on a
grid its resolved position, auto-placed nodes included, so clients render
without re-implementing auto-placement and collision push-down.
``widget_types`` maps nodes to their widget's type so clients pick a renderer;
nodes whose widget no longer resolves are left out. ``gridColumns`` gives the
column count of each grid container, whose children's placements are in its
own grid units.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from superset_core.canvas import GridPlacement, WidgetResolver

from superset.canvas.definition.grid import resolve_grid
from superset.canvas.definition.registry import (
    get_widget_resolver,
    layout_rules,
    LayoutRulesRegistry,
)


def render_context(
    definition: dict[str, Any],
    rules: LayoutRulesRegistry | None = None,
    resolver: WidgetResolver | None = None,
) -> dict[str, Any]:
    rules = rules or layout_rules
    resolver = resolver or get_widget_resolver()
    nodes = definition["nodes"]
    types = resolver.widget_types({node["widget"] for node in nodes.values()})
    widget_types = {
        node_id: types[node["widget"]]
        for node_id, node in nodes.items()
        if node["widget"] in types
    }

    grids: list[tuple[list[str], int]] = [
        (definition["root"]["children"], definition["root"]["layout"]["columns"])
    ]
    grid_columns: dict[str, int] = {}
    for node_id, node in nodes.items():
        widget_type = widget_types.get(node_id)
        if widget_type is None:
            continue
        container = rules.get(widget_type)
        if container.is_container and container.grid_columns is not None:
            grids.append((node.get("children") or [], container.grid_columns))
            grid_columns[node_id] = container.grid_columns

    placements: dict[str, dict[str, int]] = {}
    for children, columns in grids:
        layouts = [_grid_layout(nodes[c]["layout"]) for c in children]
        rects, _ = resolve_grid(layouts, columns)
        for child, rect in zip(children, rects, strict=True):
            placements[child] = {
                "col": rect.col,
                "row": rect.row,
                "colSpan": rect.col_span,
                "rowSpan": rect.row_span,
            }
    return {
        "widgetTypes": widget_types,
        "placements": placements,
        "gridColumns": grid_columns,
    }


def _grid_layout(layout: dict[str, Any]) -> dict[str, Any]:
    """A stored layout as grid placement; one kept from another layout model
    after a container's rules changed is auto-placed instead."""
    try:
        return GridPlacement.model_validate(layout).model_dump(
            mode="json", by_alias=True, exclude_none=True
        )
    except ValidationError:
        return {}
