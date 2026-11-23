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

"""MCP tool: get_canvas_data"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from superset_core.canvas import WidgetResolver
from superset_core.mcp.decorators import tool, ToolAnnotations
from superset_core.widgets import QueryRequest

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
from superset.commands.canvas.placement_data import widget_queries
from superset.daos.canvas import CanvasDAO
from superset.mcp_service.canvas.schemas import GetCanvasDataResponse
from superset.mcp_service.canvas.tool.canvas_draft_common import draft_url, NOT_FOUND
from superset.mcp_service.canvas.tool.canvas_ops_common import (
    absolute_url,
    keeps_own_data,
    query_error,
    UNREAD_REASON,
)
from superset.utils import json

MAX_ROWS = 500
MAX_WIDGETS = 50
# Under the MCP response size guard, which fails the whole call when crossed:
# rows are trimmed to fit instead.
MAX_RESPONSE_BYTES = 40_000
# The most ``unread`` entries listed; each repeats the reason.
MAX_UNREAD = 20


def _in_layout_order(definition: dict[str, Any]) -> Iterator[str]:
    """Node ids depth first, in the order each container lists its children."""
    nodes = definition["nodes"]
    stack = list(reversed(definition["root"].get("children") or []))
    seen: set[str] = set()
    while stack:
        node_id = stack.pop()
        if node_id in seen or node_id not in nodes:
            continue
        seen.add(node_id)
        yield node_id
        stack.extend(reversed(nodes[node_id].get("children") or []))


def _load(
    canvas_id: int | str, draft_token: str | None
) -> tuple[dict[str, Any], WidgetResolver, dict[str, Any]] | str:
    """The definition to read, its resolver, and the canvas fields to report."""
    if draft_token:
        try:
            draft = load_draft(draft_token)
        except (CanvasDraftNotFoundError, CanvasNotFoundError, CanvasForbiddenError):
            return NOT_FOUND
        canvas = CanvasDAO.find_by_id(draft.canvas_id)
        if canvas is None:
            return NOT_FOUND
        about = {
            "canvas_id": canvas.id,
            "title": canvas.title,
            "url": draft_url(draft),
        }
        return draft.definition, draft.resolver(), about
    canvas = CanvasDAO.find_by_id_or_uuid(str(canvas_id))
    if canvas is None:
        return f"Canvas {canvas_id} not found, or no access to it"
    try:
        definition = CanvasDAO.load(canvas)
    except DefinitionVersionError as ex:
        return str(ex)
    about = {
        "canvas_id": canvas.id,
        "title": canvas.title,
        "url": absolute_url(canvas.url),
    }
    return definition, get_widget_resolver(), about


def _rows(rows: list[dict[str, Any]], max_rows: int) -> dict[str, Any]:
    shown: dict[str, Any] = {
        "row_count": len(rows),
        "columns": list(rows[0]) if rows else [],
        "rows": rows[:max_rows],
    }
    if len(rows) > max_rows:
        shown["truncated"] = True
    return shown


def _widget_data(
    placement_id: str,
    widget_type: str | None,
    queries: dict[str, dict[str, Any]],
    title: str | None,
    max_rows: int,
    runtime_filters: list[RuntimeFilter] | None,
) -> dict[str, Any]:
    """The rows of a widget's queries, or why they failed: as for the canvas
    page, one failing query fails them all."""
    entry: dict[str, Any] = {
        "placement_id": placement_id,
        "title": title,
        "widget_type": widget_type,
    }
    try:
        datasets = {
            name: run_binding(binding, runtime_filters).rows
            for name, binding in queries.items()
        }
    except Exception as ex:  # pylint: disable=broad-except
        entry.update(query_error(ex))
        return entry
    if list(datasets) == ["main"]:
        entry.update(_rows(datasets["main"], max_rows))
    else:
        entry["datasets"] = [
            {"name": name, **_rows(rows, max_rows)} for name, rows in datasets.items()
        ]
    return entry


def _unread(
    node_id: str, node: dict[str, Any], widget_type: str | None
) -> list[dict[str, Any]]:
    """The placement as an ``unread`` entry, when it may have data elsewhere."""
    if "children" in node or not keeps_own_data(widget_type):
        return []
    return [
        {"placement_id": node_id, "widget_type": widget_type, "reason": UNREAD_REASON}
    ]


def _get_canvas_data_impl(
    canvas_id: int | str,
    draft_token: str | None,
    placement_ids: list[str] | None,
    max_rows: int,
    max_widgets: int,
    runtime_filters: list[RuntimeFilter] | None,
) -> dict[str, Any]:
    loaded = _load(canvas_id, draft_token)
    if isinstance(loaded, str):
        return {"error": loaded}
    definition, resolver, result = loaded
    nodes = definition["nodes"]
    wanted = set(placement_ids or [])
    if missing := sorted(wanted - nodes.keys()):
        return {**result, "error": f"No placements {missing!r} on this canvas"}
    titles = render_context(definition, resolver=resolver).get("titles", {})
    widgets = resolver.widgets(
        {node["widgetId"] for node in nodes.values() if node.get("widgetId")}
    )
    entries: list[dict[str, Any]] = []
    skipped: list[str] = []
    unread: list[dict[str, Any]] = []
    # Queries run so far, against ``max_widgets``.
    ran = 0
    for node_id in _in_layout_order(definition):
        if wanted and node_id not in wanted:
            continue
        node = nodes[node_id]
        widget_type, props = node.get("widgetType"), node.get("props") or {}
        if widget_id := node.get("widgetId"):
            if (widget := widgets.get(widget_id)) is None:
                continue
            widget_type, props = widget.widget_type, widget.props
        request = QueryRequest(
            str(result["canvas_id"]),
            node_id,
            props,
            draft_token=draft_token or None,
            widget_id=widget_id or None,
        )
        failed: dict[str, str] | None = None
        try:
            queries = widget_queries(widget_type, request)
        except Exception as ex:  # pylint: disable=broad-except
            queries, failed = {}, query_error(ex)
        if not queries and failed is None:
            unread.extend(_unread(node_id, node, widget_type))
            continue
        # A type that failed to build its queries counts as one, so that a
        # canvas of such widgets stays within the size budget too.
        cost = len(queries) or 1
        if skipped or ran + cost > max_widgets:
            skipped.append(node_id)
            continue
        ran += cost
        title = titles.get(node_id)
        entries.append(
            {
                "placement_id": node_id,
                "title": title,
                "widget_type": widget_type,
                **failed,
            }
            if failed is not None
            else _widget_data(
                node_id, widget_type, queries, title, max_rows, runtime_filters
            )
        )
    listed = {
        key: value
        for key, value in (("skipped", skipped), ("unread", unread[:MAX_UNREAD]))
        if value
    }
    # The lists share the budget with the rows: trimmed rows alone could still
    # leave the response past the size guard.
    _fit_rows(entries, MAX_RESPONSE_BYTES - len(json.dumps(listed)))
    result["widgets"] = entries
    result.update(listed)
    return result


def _fit_rows(entries: list[dict[str, Any]], budget: int) -> None:
    """Halve the longest row list until the widgets' data fits ``budget``."""
    holders = [
        holder for entry in entries for holder in (entry, *entry.get("datasets", ()))
    ]
    while holders and len(json.dumps(entries, default=str)) > budget:
        longest = max(holders, key=lambda holder: len(holder.get("rows") or []))
        rows = longest.get("rows") or []
        if not rows:
            return
        longest["rows"] = rows[: len(rows) // 2]
        longest["truncated"] = True


@tool(
    tags=["discovery"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Get a canvas's data",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def get_canvas_data(
    canvas_id: int | str,
    draft_token: str | None = None,
    placement_ids: list[str] | None = None,
    max_rows: int = 15,
    max_widgets: int = 10,
    filters: list[RuntimeFilter] | None = None,
) -> GetCanvasDataResponse:
    """Get the data behind a canvas's widgets in one call, to answer questions
    about what the canvas shows.

    Runs each placement's queries as you, as its widget type builds them, in
    layout order, and returns its title, row count, columns and up to
    ``max_rows`` rows (at most 500); a type that builds several has each in
    ``datasets``. Rows are trimmed further, marked ``truncated``, to keep the
    response small. Placements without a query (containers, text, filters)
    are left out; the first 20 extension widgets without one are listed in
    ``unread``.
    ``placement_ids`` limits it to those placements; ``max_widgets`` (at most
    50) caps how many queries run, and the rest are listed in ``skipped``.
    With ``draft_token``, reads the draft instead of the published canvas.
    ``filters`` narrows the queries the way the canvas's filters do, one
    ``{datasetId, column, values}`` per filter; filters on other datasets
    don't apply. For one widget's rendered output, use ``preview_widget``.
    """
    return GetCanvasDataResponse.model_validate(
        _get_canvas_data_impl(
            canvas_id,
            draft_token,
            placement_ids,
            max(1, min(max_rows, MAX_ROWS)),
            max(1, min(max_widgets, MAX_WIDGETS)),
            filters,
        )
    )
