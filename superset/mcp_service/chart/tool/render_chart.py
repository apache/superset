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
MCP tool: render_chart (MCP Apps interactive chart widget)

``render_chart`` returns a chart's data together with a ``_meta.ui.resourceUri``
descriptor pointing at the ``ui://superset/chart-viewer/v2`` UI resource. MCP
Apps hosts (Claude, ChatGPT, VS Code Copilot, Cursor, Goose, ...) fetch that
resource and render the chart-viewer widget in a sandboxed iframe, turning the
tool result into a real interactive visualization instead of a prose summary.

``render_chart_requery`` is the app-visible companion the widget calls back for
drill-down, brush-to-zoom and filtering. It is marked ``visibility: ["app"]`` so
compliant hosts keep it out of the model's tool list.

Both tools are thin wrappers over :func:`get_chart_data_core` — the shared,
already-authorized data path — so all data access continues to flow through the
same RBAC/RLS-enforcing query pipeline as ``get_chart_data``.
"""

import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import (
    ChartData,
    ChartError,
    GetChartDataRequest,
    RenderChartRequeryRequest,
    RenderChartRequest,
)
from superset.mcp_service.chart.tool.get_chart_data import get_chart_data_core
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)

# UI resource that renders these tools' results. Versioned so the widget bundle
# and the tools can evolve together without breaking cached hosts.
CHART_VIEWER_URI = "ui://superset/chart-viewer/v2"

# Tool-descriptor _meta for the MCP Apps extension. Note: the iframe CSP is
# declared on the ``ui://`` resource itself (see chart_viewer.py), not here — the
# MCP Apps spec ignores tool-level ``ui.csp``. We only link the resource and
# declare visibility here.
_RENDER_CHART_UI_META: dict[str, Any] = {
    "ui": {
        "resourceUri": CHART_VIEWER_URI,
        # Both the model (to decide when to render) and the app may call it.
        "visibility": ["model", "app"],
    }
}
_REQUERY_UI_META: dict[str, Any] = {
    "ui": {
        "resourceUri": CHART_VIEWER_URI,
        # App-visibility is host routing metadata, NOT an authorization boundary:
        # render_chart_requery independently runs the same Chart/read RBAC + RLS
        # path, so a model that calls it directly gains no extra entitlement.
        "visibility": ["app"],
    }
}


# Design tokens the chart-viewer widget consumes. Deliberately a small,
# explicit allow-list: only presentational values, no URLs/secrets, and bounded
# in size so the widget payload stays small.
_THEME_TOKEN_KEYS: tuple[str, ...] = (
    "colorPrimary",
    "colorLink",
    "colorError",
    "colorWarning",
    "colorSuccess",
    "colorInfo",
    "fontFamily",
)


def _instance_theme_tokens() -> dict[str, Any] | None:
    """Return the deployment's antd design tokens for the widget.

    Customers configure Superset theming precisely so their visualizations look
    consistent; without this the widget would render with hardcoded colors and
    drift from the rest of the product. Only an allow-listed subset of
    presentational tokens is forwarded.
    """
    try:
        from flask import current_app

        theme = current_app.config.get("THEME_DEFAULT") or {}
        tokens = theme.get("token") or {}
    except Exception:  # pragma: no cover - theming is best-effort decoration
        return None
    if not isinstance(tokens, dict):
        return None
    selected = {
        key: tokens[key]
        for key in _THEME_TOKEN_KEYS
        if isinstance(tokens.get(key), str)
    }
    return selected or None


def _build_explore_url(chart_id: int | None) -> str | None:
    """Best-effort absolute Explore deep link for the chart-viewer widget's
    "Open in Superset" affordance.

    Built from the resolved numeric ``chart_id`` (from the query result) so it
    works even when the caller passed a UUID. Returns ``None`` when there is no
    saved chart id (e.g. unsaved charts, ``chart_id == 0``) or no base URL.
    """
    if not chart_id:
        return None
    try:
        base_url = get_superset_base_url().rstrip("/")
    except Exception:  # pragma: no cover - defensive; base URL is best-effort
        return None
    if not base_url:
        return None
    return f"{base_url}/explore/?slice_id={chart_id}"


async def _render_chart_impl(
    request: RenderChartRequest, ctx: Context
) -> ChartData | ChartError:
    """Undecorated body of ``render_chart`` (see the tool for docs). Kept
    separate so it can be unit-tested without the auth decorator."""
    await ctx.info("Rendering chart: identifier=%s" % (request.identifier,))

    # Delegate to the shared, authorized data path. Reuse of the core keeps a
    # single query/RBAC/RLS pipeline; render_chart adds only presentation.
    data_request = GetChartDataRequest(
        identifier=request.identifier,
        limit=request.limit,
        extra_form_data=request.extra_form_data,
        use_cache=request.use_cache,
        force_refresh=request.force_refresh,
        cache_timeout=request.cache_timeout,
        format="json",
    )
    with event_logger.log_context(action="mcp.render_chart"):
        result = await get_chart_data_core(data_request, ctx)

    if isinstance(result, ChartData):
        result.explore_url = _build_explore_url(result.chart_id)
        result.theme = _instance_theme_tokens()
    return result


@tool(
    tags=["data"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Render chart",
        readOnlyHint=True,
        destructiveHint=False,
    ),
    meta=_RENDER_CHART_UI_META,
)
async def render_chart(
    request: RenderChartRequest, ctx: Context
) -> ChartData | ChartError:
    """Render a saved chart as an interactive visualization in the chat.

    Use this instead of ``get_chart_data`` when the user wants to *see* a chart,
    not just read its numbers. On MCP Apps-capable hosts the result renders as a
    real, interactive chart (line/bar/area/table/big-number) inline in the
    conversation; on other hosts the same structured data and text summary are
    returned so the model can describe it.

    Pass a chart ``identifier`` (numeric ID or UUID). Optionally narrow the data
    with ``extra_form_data`` filters or a row ``limit``.
    """
    return await _render_chart_impl(request, ctx)


def _resolve_filter(
    request: RenderChartRequeryRequest,
) -> tuple[Any | None, Any | None]:
    """Resolve the drill filter column/value from either the flat
    ``filter_col``/``filter_val`` fields or the widget's ``filter={col,val}``
    object form. The object form takes precedence when present."""
    col = request.filter_col
    val = request.filter_val
    if isinstance(request.filter, dict):
        col = request.filter.get("col", col)
        # Support both {"val": ...} and {"value": ...}.
        if "val" in request.filter:
            val = request.filter["val"]
        elif "value" in request.filter:
            val = request.filter["value"]
    return col, val


def _requery_extra_form_data(
    request: RenderChartRequeryRequest,
) -> dict[str, Any]:
    """Translate widget interactions into a Superset ``extra_form_data`` override
    that the shared query path understands."""
    extra: dict[str, Any] = {}
    filters: list[dict[str, Any]] = []

    filter_col, filter_val = _resolve_filter(request)
    if filter_col is not None and filter_val is not None:
        filters.append({"col": filter_col, "op": "==", "val": filter_val})
    if filters:
        extra["filters"] = filters
    if request.time_range is not None:
        extra["time_range"] = request.time_range
    if request.granularity is not None:
        # Superset reads the time grain from extra_form_data.time_grain_sqla.
        extra["time_grain_sqla"] = request.granularity
    return extra


async def _render_chart_requery_impl(
    request: RenderChartRequeryRequest, ctx: Context
) -> ChartData | ChartError:
    """Undecorated body of ``render_chart_requery`` (see the tool for docs)."""
    await ctx.info(
        "Re-querying chart for widget: identifier=%s, time_range=%s"
        % (request.identifier, request.time_range)
    )

    extra_form_data = _requery_extra_form_data(request)

    data_request = GetChartDataRequest(
        identifier=request.identifier,
        limit=request.limit,
        extra_form_data=extra_form_data or None,
        use_cache=request.use_cache,
        force_refresh=request.force_refresh,
        cache_timeout=request.cache_timeout,
        format="json",
    )
    with event_logger.log_context(action="mcp.render_chart_requery"):
        result = await get_chart_data_core(data_request, ctx)

    if isinstance(result, ChartData):
        result.explore_url = _build_explore_url(result.chart_id)
        result.theme = _instance_theme_tokens()
    return result


@tool(
    tags=["data"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Re-query chart (widget drill-down)",
        readOnlyHint=True,
        destructiveHint=False,
    ),
    meta=_REQUERY_UI_META,
)
async def render_chart_requery(
    request: RenderChartRequeryRequest, ctx: Context
) -> ChartData | ChartError:
    """Re-query a chart for the interactive widget (drill-down / zoom / filter).

    Called by the chart-viewer widget when the user clicks a data point, brushes
    a time range, or drills by a dimension. Not intended for direct model use.
    Runs through the same authorized data path as ``render_chart``.
    """
    return await _render_chart_requery_impl(request, ctx)
