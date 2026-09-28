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
Get dashboard data FastMCP tool

Returns a compact, filter-aware summary of the underlying data across a
dashboard's charts, so an agent can answer analytical questions about the whole
dashboard from a single call instead of fetching each chart separately.
"""

import logging
from datetime import datetime, timezone
from time import monotonic
from typing import Any, TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import (
    ChartData,
    ChartError,
    GetChartDataRequest,
)
from superset.mcp_service.chart.tool.get_chart_data import (
    execute_chart_data,
    get_chart_data,
)
from superset.mcp_service.dashboard.schemas import (
    _extract_layout_from_position,
    DashboardChartData,
    DashboardChartQueryData,
    DashboardData,
    DashboardError,
    GetDashboardDataRequest,
)

if TYPE_CHECKING:
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def _completeness(
    row_count: int, source_total: int | None, limit: int
) -> tuple[int | None, bool]:
    """Resolve (total_rows, truncated) for a query result. A source total is only
    authoritative when it exceeds the returned count; a total equal to a capped
    fetch is just the cap (the upstream rowcount is the length of the already
    limited dataframe), so treat it as unknown (None). Truncated means fewer rows
    were returned than exist.
    """
    if source_total is not None and source_total > row_count:
        return source_total, True
    if row_count >= limit:
        return None, True
    return (source_total if source_total is not None else row_count), False


def _order_by_layout(slices: list["Slice"], position_json: str | None) -> list["Slice"]:
    """Order slices by their layout reading order so a bounded selection covers
    the most prominent charts first; charts absent from the layout keep their
    original order."""
    _, positions = _extract_layout_from_position(position_json)
    order = {
        position.chart_id: index
        for index, position in enumerate(positions)
        if position.chart_id is not None
    }
    return sorted(slices, key=lambda slc: order.get(slc.id, len(order)))


def _summarize_chart_data(
    result: ChartData,
    extra: dict[str, Any] | None,
    request: "GetDashboardDataRequest",
) -> DashboardChartData:
    """Compact per-chart summary. Uses the first non-empty query layer for the
    headline so an empty leading layer is not reported as empty, preserves each
    layer's authoritative total, and includes a per-layer breakdown for
    multi-query charts."""
    layers = result.query_results or []
    primary = next((q for q in layers if q.data), layers[0] if layers else None)
    limit = request.fetch_row_limit
    if primary is not None:
        columns = primary.columns
        sample_data = primary.data[: request.sample_rows]
        row_count = primary.row_count
        total_rows, _ = _completeness(row_count, primary.total_rows, limit)
        # A chart is incomplete if any layer returned fewer than its total.
        truncated = any(
            _completeness(lyr.row_count, lyr.total_rows, limit)[1] for lyr in layers
        )
    else:
        columns = [column.name for column in result.columns]
        sample_data = result.data[: request.sample_rows]
        row_count = result.row_count
        total_rows, truncated = _completeness(row_count, result.total_rows, limit)
    queries: list[DashboardChartQueryData] | None = None
    if len(layers) > 1:
        queries = []
        for layer in layers:
            l_total, l_truncated = _completeness(
                layer.row_count, layer.total_rows, limit
            )
            queries.append(
                DashboardChartQueryData(
                    query_index=layer.query_index,
                    columns=layer.columns,
                    sample_data=layer.data[: request.sample_rows],
                    row_count=layer.row_count,
                    total_rows=l_total,
                    truncated=l_truncated,
                )
            )
    return DashboardChartData(
        chart_id=result.chart_id,
        chart_name=result.chart_name,
        chart_type=result.chart_type,
        columns=columns,
        sample_data=sample_data,
        row_count=row_count,
        total_rows=total_rows,
        truncated=truncated,
        queries=queries,
        filtered=bool(extra),
    )


@tool(
    tags=["data"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get dashboard data",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_dashboard_data(
    request: GetDashboardDataRequest, ctx: Context
) -> DashboardData | DashboardError:
    """Get bounded, filter-aware data across a dashboard's charts.

    For each chart (up to max_charts, selected in dashboard layout order),
    returns a compact view of the underlying data: column names, a few sample
    rows, and row counts. Active dashboard filters are applied per chart via
    applied_filters (keyed by chart id, each value extra_form_data). Use this to
    answer analytical questions about a whole dashboard in one call instead of
    calling get_chart_data for every chart.

    Example:
    ```json
    {
        "identifier": 6,
        "applied_filters": {
            "56": {"filters": [{"col": "country", "op": "IN", "val": ["US"]}]}
        }
    }
    ```
    """
    await ctx.info(
        "Retrieving dashboard data: identifier=%s, max_charts=%s"
        % (request.identifier, request.max_charts)
    )

    try:
        from superset.daos.dashboard import DashboardDAO

        with event_logger.log_context(action="mcp.get_dashboard_data.lookup"):
            dashboard = DashboardDAO.get_by_id_or_slug(str(request.identifier))
    except Exception as exc:  # noqa: BLE001
        await ctx.warning(
            "Dashboard not found or inaccessible: identifier=%s, error=%s"
            % (request.identifier, str(exc))
        )
        return DashboardError(
            error=f"Dashboard not found or inaccessible: {request.identifier}",
            error_type="DashboardNotFound",
            timestamp=datetime.now(timezone.utc),
        )

    # Composing the core skips get_chart_data's Chart read gate, so enforce it
    # here. Guests stay supported: check_tool_permission honors the allow-list.
    from superset.mcp_service.auth import check_tool_permission

    if not check_tool_permission(get_chart_data):
        await ctx.warning(
            "Chart read permission required for dashboard data: identifier=%s"
            % (request.identifier,)
        )
        return DashboardError(
            error="Chart read permission is required to read dashboard chart data",
            error_type="ChartAccessDenied",
            timestamp=datetime.now(timezone.utc),
        )

    slices = list(dashboard.slices or [])
    applied_filters = request.applied_filters or {}
    selected = _order_by_layout(slices, dashboard.position_json)[: request.max_charts]

    charts: list[DashboardChartData] = []
    deadline = monotonic() + request.time_budget_seconds
    for slc in selected:
        # `charts` guards the budget so at least one chart is always attempted.
        if charts and monotonic() >= deadline:
            await ctx.warning(
                "Dashboard data time budget reached after %s charts" % len(charts)
            )
            break
        extra = applied_filters.get(str(slc.id))
        try:
            chart_request = GetChartDataRequest(
                identifier=slc.id,
                extra_form_data=extra or None,
                limit=request.fetch_row_limit,
            )
            # Reuse get_chart_data's core so guest auth + filter handling match.
            result = await execute_chart_data(chart_request, ctx)
        except Exception as exc:  # noqa: BLE001
            await ctx.warning(
                "Chart data failed: chart_id=%s, error=%s" % (slc.id, str(exc))
            )
            charts.append(
                DashboardChartData(
                    chart_id=slc.id,
                    chart_name=slc.slice_name or "",
                    chart_type=slc.viz_type or "unknown",
                    filtered=bool(extra),
                    error=str(exc),
                )
            )
            continue

        if isinstance(result, ChartData):
            charts.append(_summarize_chart_data(result, extra, request))
        elif isinstance(result, ChartError):
            charts.append(
                DashboardChartData(
                    chart_id=slc.id,
                    chart_name=slc.slice_name or "",
                    chart_type=slc.viz_type or "unknown",
                    filtered=bool(extra),
                    error=result.message,
                )
            )

    response = DashboardData(
        dashboard_id=dashboard.id,
        dashboard_name=dashboard.dashboard_title or "",
        chart_count=len(slices),
        charts_returned=len(charts),
        charts_truncated=len(charts) < len(slices),
        charts=charts,
    )
    await ctx.info(
        "Dashboard data retrieved: id=%s, charts_returned=%s, truncated=%s"
        % (
            response.dashboard_id,
            response.charts_returned,
            response.charts_truncated,
        )
    )
    return response
