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
MCP tool: show_chart

Mints a short-lived, chart-scoped guest token and returns the metadata
needed for an MCP client to render a live, interactive Superset chart
inline via the ``ui://superset/chart-viewer`` MCP App resource.
"""

import logging
from typing import Any
from urllib.parse import urlencode

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.chart.chart_helpers import (
    extract_form_data_key_from_url,
    find_chart_by_identifier,
)
from superset.mcp_service.chart.chart_utils import generate_explore_link
from superset.mcp_service.chart.schemas import ShowChartRequest, ShowChartResponse
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.security.guest_token import GuestTokenResourceType
from superset.utils import json as utils_json

logger = logging.getLogger(__name__)


CHART_VIEWER_RESOURCE_URI = "ui://superset/chart-viewer"


def _merge_form_data(
    base: dict[str, Any] | None,
    overrides: dict[str, Any] | None,
    slice_id: int,
    datasource: str | None,
) -> dict[str, Any]:
    """Merge overrides on top of saved form_data, pinning slice/datasource."""
    merged: dict[str, Any] = dict(base or {})
    if overrides:
        merged.update(overrides)
    merged["slice_id"] = slice_id
    if datasource and "datasource" not in merged:
        merged["datasource"] = datasource
    return merged


@tool(
    tags=["core"],
    class_permission_name="Chart",
    method_permission_name="read",
    annotations=ToolAnnotations(
        title="Show chart",
        readOnlyHint=True,
        destructiveHint=False,
    ),
    meta={
        "ui": {
            "resourceUri": CHART_VIEWER_RESOURCE_URI,
            # Allow the iframe inside the chart-viewer resource to load from
            # any Superset instance origin; the host app enforces sandboxing.
            "csp": {"frame-src": ["*"], "img-src": ["*"]},
        }
    },
)
async def show_chart(request: ShowChartRequest, ctx: Context) -> ShowChartResponse:
    """Render a saved Superset chart inline in an MCP client.

    Takes a chart identifier (id, uuid, or slug), mints a short-lived
    chart-scoped guest token, and returns an ``explore_url`` that loads the
    chart in Superset's standalone (chromeless) Explore view. MCP clients
    that implement the MCP Apps extension will render this tool's output
    through the ``ui://superset/chart-viewer`` resource as a live iframe.

    Use when:
    - The user wants to *see* a saved chart inside the chat
    - Inspecting a chart found via ``list_charts``/``get_chart_info``
    - Sharing an interactive view of a dashboard chart

    Overrides (filters, time range, metrics, etc.) may be passed via
    ``overrides``; they are merged on top of the chart's saved ``form_data``
    and cached under a single-use ``form_data_key``.
    """
    await ctx.info("show_chart: identifier=%s" % (request.identifier,))
    chart = find_chart_by_identifier(request.identifier)
    if chart is None:
        return ShowChartResponse(
            chart_id=0,
            chart_uuid=None,
            chart_name=None,
            viz_type=None,
            explore_url="",
            form_data_key=None,
            guest_token="",
            expires_at=0.0,
            superset_domain=get_superset_base_url(),
            error=f"Chart not found: {request.identifier}",
        )

    # Access check — honors regular RBAC and guest-chart tokens alike.
    if not security_manager.can_access_chart(chart):
        return ShowChartResponse(
            chart_id=chart.id,
            chart_uuid=str(chart.uuid) if chart.uuid is not None else None,
            chart_name=chart.slice_name,
            viz_type=chart.viz_type,
            explore_url="",
            form_data_key=None,
            guest_token="",
            expires_at=0.0,
            superset_domain=get_superset_base_url(),
            error="You do not have access to this chart",
        )

    base_url = get_superset_base_url()

    with event_logger.log_context(action="mcp.show_chart.prepare"):
        # Build form_data with optional overrides, cache it, and grab the key.
        saved_form_data: dict[str, Any] = {}
        if chart.params:
            try:
                saved_form_data = utils_json.loads(chart.params)
            except (ValueError, TypeError):
                saved_form_data = {}

        datasource_id = chart.datasource_id
        datasource_str = (
            f"{datasource_id}__{chart.datasource_type}"
            if datasource_id and chart.datasource_type
            else None
        )
        form_data = _merge_form_data(
            saved_form_data, request.overrides, chart.id, datasource_str
        )

        form_data_key: str | None = None
        if request.overrides:
            if datasource_id is None:
                return ShowChartResponse(
                    chart_id=chart.id,
                    chart_uuid=str(chart.uuid) if chart.uuid is not None else None,
                    chart_name=chart.slice_name,
                    viz_type=chart.viz_type,
                    explore_url="",
                    form_data_key=None,
                    guest_token="",
                    expires_at=0.0,
                    superset_domain=base_url,
                    error="Chart has no datasource; cannot apply overrides",
                )
            cached_url = generate_explore_link(datasource_id, form_data)
            form_data_key = extract_form_data_key_from_url(cached_url)

    with event_logger.log_context(action="mcp.show_chart.mint_token"):
        # Mint a chart-scoped guest token. Prefer UUID for stability across
        # environments; fall back to numeric id if uuid is unavailable.
        resource_id: str | int = str(chart.uuid) if chart.uuid is not None else chart.id
        raw_token = security_manager.create_guest_access_token(
            user={
                "username": "mcp_show_chart",
                "first_name": "MCP",
                "last_name": "Viewer",
            },
            resources=[{"type": GuestTokenResourceType.CHART, "id": resource_id}],
            rls=[],
        )
        if isinstance(raw_token, bytes):
            token_str = raw_token.decode("utf-8")
        else:
            token_str = str(raw_token)
        # Extract the exp claim so clients can display / refresh accordingly.
        parsed = security_manager.parse_jwt_guest_token(token_str)
        expires_at = float(parsed.get("exp", 0.0))

    query: dict[str, Any] = {
        "slice_id": chart.id,
        "standalone": 1,
        "guest_token": token_str,
    }
    if form_data_key:
        query["form_data_key"] = form_data_key
    explore_url = f"{base_url}/explore/?{urlencode(query)}"

    await ctx.info(
        "show_chart: chart_id=%s form_data_key=%s" % (chart.id, form_data_key)
    )

    return ShowChartResponse(
        chart_id=chart.id,
        chart_uuid=str(chart.uuid) if chart.uuid is not None else None,
        chart_name=chart.slice_name,
        viz_type=chart.viz_type,
        explore_url=explore_url,
        form_data_key=form_data_key,
        guest_token=token_str,
        expires_at=expires_at,
        superset_domain=base_url,
        error=None,
    )
