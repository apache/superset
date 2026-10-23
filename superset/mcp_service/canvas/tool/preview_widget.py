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

"""MCP tool: preview_widget"""

from __future__ import annotations

import logging
from typing import Any

import requests
from fastmcp.tools.tool import ToolResult
from flask import current_app
from mcp.types import ImageContent, TextContent
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.data import run_binding, RuntimeFilter
from superset.canvas.definition.registry import get_widget_resolver
from superset.canvas.definition.render import render_context
from superset.canvas.definition.versions import DefinitionVersionError
from superset.commands.canvas.draft import load_draft
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasForbiddenError,
    CanvasNotFoundError,
)
from superset.daos.canvas import CanvasDAO
from superset.extensions import security_manager
from superset.mcp_service.canvas.schemas import PreviewWidgetResponse
from superset.mcp_service.canvas.tool.canvas_draft_common import NOT_FOUND
from superset.utils import json

logger = logging.getLogger(__name__)

SAMPLE_ROWS = 10
RENDER_TIMEOUT_SECONDS = 15
# The canvas page's content width and grid, for sizing a placement in pixels.
PAGE_WIDTH = 1360
GAP = 16


def _pixel_size(definition: dict[str, Any], placement_id: str) -> tuple[int, int]:
    root_layout = definition["root"].get("layout", {})
    columns = root_layout.get("columns", 24)
    row_unit = root_layout.get("rowUnit", 40)
    gap = root_layout.get("gap", GAP)
    placement = render_context(definition)["placements"].get(placement_id, {})
    col_span = placement.get("colSpan", columns // 2)
    row_span = placement.get("rowSpan", 8)
    column_width = (PAGE_WIDTH - gap * (columns - 1)) / columns
    width = col_span * column_width + gap * (col_span - 1)
    height = row_span * row_unit + gap * (row_span - 1)
    return round(width), round(height)


def _render(
    url: str,
    props: dict[str, Any],
    rows: list[dict[str, Any]],
    definition: dict[str, Any],
    size: tuple[int, int],
    dark: bool,
) -> dict[str, Any]:
    theme = current_app.config["THEME_DARK"] if dark else None
    theme = theme or current_app.config["THEME_DEFAULT"]
    colors = definition.get("settings", {}).get("colors", {})
    response = requests.post(
        f"{url.rstrip('/')}/render/echarts",
        json={
            "props": props,
            "rows": rows,
            "theme": theme,
            "scheme": colors.get("scheme"),
            "labelColors": colors.get("labelColors", {}),
            "width": size[0],
            "height": size[1],
        },
        timeout=RENDER_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def _with_rows(
    result: dict[str, Any],
    props: dict[str, Any],
    runtime_filters: list[RuntimeFilter] | None = None,
) -> list[dict[str, Any]]:
    """Run the widget's query, if it has one, and record what came back."""
    binding = props.get("dataBinding")
    if not isinstance(binding, dict) or not binding.get("datasetId"):
        return []
    data = run_binding(binding, runtime_filters)
    rows = data.rows
    result["row_count"] = len(rows)
    result["columns"] = list(rows[0]) if rows else []
    result["sample_rows"] = rows[:SAMPLE_ROWS]
    # Classic charts gate "View query" on the same permission.
    if data.query and security_manager.can_access("can_view_query", "Dashboard"):
        result["query"] = data.query
        result["query_language"] = data.language
    if not rows:
        result["warnings"] = ["The widget's query returned no rows"]
    return rows


def _with_render(
    result: dict[str, Any],
    url: str,
    props: dict[str, Any],
    rows: list[dict[str, Any]],
    definition: dict[str, Any],
    size: tuple[int, int],
    dark: bool,
) -> str | None:
    """Render the widget, record the option and warnings, return the PNG."""
    warnings = result.setdefault("warnings", [])
    try:
        rendered = _render(url, props, rows, definition, size, dark)
    except requests.RequestException as ex:
        logger.warning("Canvas widget renderer failed: %s", ex)
        result["rendered"] = False
        warnings.append(
            f"No image: the renderer failed ({ex}). The chart was not checked "
            "visually; don't report it as verified."
        )
        return None
    result["rendered"] = True
    result["option"] = rendered.get("option")
    warnings.extend(rendered.get("warnings", []))
    if rendered.get("error"):
        result["error"] = rendered["error"]
    image = rendered.get("png")
    if image:
        width, height = rendered.get("width"), rendered.get("height")
        result["image"] = f"attached, {width}x{height} PNG"
    return image


def _definition(canvas_id: int | str, draft_token: str | None) -> dict[str, Any] | str:
    """The canvas's definition, or its draft's, or an error message."""
    if draft_token:
        try:
            draft = load_draft(draft_token)
        except (CanvasDraftNotFoundError, CanvasNotFoundError, CanvasForbiddenError):
            return NOT_FOUND
        return draft.definition
    canvas = CanvasDAO.find_by_id_or_uuid(str(canvas_id))
    if canvas is None:
        return f"Canvas {canvas_id} not found, or no access to it"
    try:
        return CanvasDAO.load(canvas)
    except DefinitionVersionError as ex:
        return str(ex)


def _preview_widget_impl(
    canvas_id: int | str,
    placement_id: str,
    dark: bool,
    draft_token: str | None = None,
    runtime_filters: list[RuntimeFilter] | None = None,
) -> tuple[dict[str, Any], str | None]:
    definition = _definition(canvas_id, draft_token)
    if isinstance(definition, str):
        return {"error": definition}, None
    node = definition["nodes"].get(placement_id)
    if node is None:
        return {"error": f"No placement {placement_id!r} on this canvas"}, None
    widget_type = node.get("widgetType")
    props = node.get("props") or {}
    if widget_id := node.get("widgetId"):
        resolver = (
            load_draft(draft_token).resolver() if draft_token else get_widget_resolver()
        )
        widget = resolver.widgets({widget_id}).get(widget_id)
        if widget is None:
            return {
                "error": f"The widget {placement_id!r} holds no longer exists"
            }, None
        widget_type, props = widget.widget_type, widget.props
    result: dict[str, Any] = {
        "placement_id": placement_id,
        "widget_type": widget_type,
    }
    try:
        rows = _with_rows(result, props, runtime_filters)
    except Exception as ex:  # pylint: disable=broad-except
        result["error"] = f"The widget's query failed: {ex}"
        return result, None
    url = current_app.config.get("CANVAS_WIDGET_RENDERER_URL")
    if widget_type != "echarts" or not url:
        return result, None
    size = _pixel_size(definition, placement_id)
    image = _with_render(result, url, props, rows, definition, size, dark)
    return result, image


@tool(
    tags=["discovery"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Preview a canvas widget",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def preview_widget(
    canvas_id: int | str,
    placement_id: str,
    dark: bool = False,
    draft_token: str | None = None,
    filters: list[RuntimeFilter] | None = None,
) -> PreviewWidgetResponse:
    """Check a widget the way a viewer will see it, after adding or changing it.

    Runs the placement's query as you and returns the row count and sample
    rows. For ``echarts`` widgets, when the deployment has a renderer, also
    returns the option as rendered, warnings (unbound fields, empty data,
    tooltips or labels that would print raw objects) and a PNG at the
    placement's size; ``dark`` renders it with the dark theme. Fix what it
    reports with ``apply_canvas_draft_ops`` and preview again. With
    ``draft_token``, previews the placement as it is in that draft.

    Also returns ``query``, the query that ran, when the user can view
    queries: use it when asked what a chart computes. ``filters`` narrows the
    query the way the canvas's filters do, one ``{datasetId, column, values}``
    per filter value; filters on other datasets don't apply.
    """
    result, image = _preview_widget_impl(
        canvas_id, placement_id, dark, draft_token, filters
    )
    response = PreviewWidgetResponse.model_validate(result)
    if image is None:
        return response
    payload = response.model_dump(exclude_none=True)
    return ToolResult(
        content=[
            TextContent(type="text", text=json.dumps(payload)),
            ImageContent(type="image", data=image, mimeType="image/png"),
        ],
        structured_content=payload,
    )
