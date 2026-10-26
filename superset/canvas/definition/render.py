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
``widgetTypes`` maps placements to their widget so clients pick a renderer;
placements that don't resolve are left out and render as placeholders.
``gridColumns`` gives the column count of each grid container, whose
children's placements are in its own grid units. ``layoutConstraints`` gives
the span limits a widget declares, so a client that lets the user drag and
resize clamps to the same bounds the server validates against. For a container
it also carries the row minimum its own content imposes, which validation
enforces by growing the container to fit (see ``_fit``) and which no declared
limit describes. ``widgets``
holds the content of the widget entities placements hold, keyed by UUID:
whoever can read the canvas can read the widgets it places.

``layouts`` gives each node's *stored* layout, which is what placement is
resolved from and is not recoverable from ``placements``: an auto-placed node
has no stored ``col``/``row`` at all, and validation writes a collided node's
pushed-down ``row`` back to its layout. ``childOrder`` gives each grid's
children in reading order, which the ``place`` operation rewrites when a drop
lands on an earlier sibling. A client previewing a drag needs both to reach the
same answer the server will.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from superset_core.canvas import GridPlacement, WidgetResolver
from superset_core.widgets import WidgetUi

from superset.canvas.definition.grid import resolve_grid
from superset.canvas.definition.pending import widget_payload
from superset.canvas.definition.placements import placement_types
from superset.canvas.definition.registry import (
    get_widget_resolver,
    get_widget_types,
    WidgetTypes,
)
from superset.canvas.definition.schemas import ROOT_ID


def render_context(
    definition: dict[str, Any],
    widget_types: WidgetTypes | None = None,
    resolver: WidgetResolver | None = None,
) -> dict[str, Any]:
    nodes = definition["nodes"]
    resolver = resolver or get_widget_resolver()
    node_types = placement_types(
        nodes,
        get_widget_types() if widget_types is None else widget_types,
        resolver,
    )
    widgets = resolver.widgets(
        {node["widgetId"] for node in nodes.values() if node.get("widgetId")}
    )
    type_ids = {node_id: w.widget_type for node_id, w in node_types.items()}

    grids: list[tuple[str, list[str], int]] = [
        (
            ROOT_ID,
            definition["root"]["children"],
            definition["root"]["layout"]["columns"],
        )
    ]
    grid_columns: dict[str, int] = {}
    for node_id, widget in node_types.items():
        columns = widget.behavior.grid_columns
        if widget.behavior.container and columns is not None:
            grids.append((node_id, nodes[node_id].get("children") or [], columns))
            grid_columns[node_id] = columns

    placements: dict[str, dict[str, int]] = {}
    stored_layouts: dict[str, dict[str, Any]] = {}
    # Rows each grid container's children take up, for the row minimum below.
    content_rows: dict[str, int] = {}
    for parent, children, columns in grids:
        layouts = [_grid_layout(nodes[c]["layout"]) for c in children]
        rects, _ = resolve_grid(layouts, columns)
        for child, rect, layout in zip(children, rects, layouts, strict=True):
            placements[child] = {
                "col": rect.col,
                "row": rect.row,
                "colSpan": rect.col_span,
                "rowSpan": rect.row_span,
            }
            stored_layouts[child] = layout
        extent = max((r.row + r.row_span - 1 for r in rects), default=0)
        chrome = node_types[parent].ui.chrome_rows if parent in node_types else 0
        content_rows[parent] = extent + chrome if extent else 0
    return {
        "widgetTypes": type_ids,
        "placements": placements,
        "layouts": stored_layouts,
        "childOrder": {parent: list(children) for parent, children, _ in grids},
        "gridColumns": grid_columns,
        "layoutConstraints": {
            node_id: constraints
            for node_id, widget in node_types.items()
            if node_id in placements
            and (
                constraints := _span_constraints(
                    widget.ui, content_rows.get(node_id, 0)
                )
            )
        },
        "widgets": widget_payload(widgets),
    }


def _span_constraints(ui: WidgetUi, content_rows: int = 0) -> dict[str, int]:
    """
    A widget's span limits, omitting the ones it leaves open.

    ``content_rows`` is the rows a container's children occupy. Validation
    grows a container to fit them and never shrinks it, so that is a real
    minimum even though the widget declares none: without it a client dragging
    a container's top edge down would compute the shrink against 1, send a
    span the server replaces, and move the container's bottom edge down into
    whatever sits below instead of shrinking it.
    """
    # A minimum of one row is what every widget already gets, so it is left
    # out rather than sent as a constraint that constrains nothing.
    rows = max(ui.min_row_span or 0, content_rows)
    limits = {
        "minColSpan": ui.min_col_span,
        "maxColSpan": ui.max_col_span,
        "minRowSpan": rows if rows > 1 else None,
        "maxRowSpan": ui.max_row_span,
    }
    return {name: limit for name, limit in limits.items() if limit is not None}


def _grid_layout(layout: dict[str, Any]) -> dict[str, Any]:
    """A stored layout as grid placement; one kept from another layout model
    after a container's rules changed is auto-placed instead."""
    try:
        return GridPlacement.model_validate(layout).model_dump(
            mode="json", by_alias=True, exclude_none=True
        )
    except ValidationError:
        return {}
