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
Get dashboard layout FastMCP tool

Companion to get_dashboard_info: returns the parsed dashboard layout
(tabs and chart positions) extracted from position_json. Use this
when get_dashboard_info's omitted_fields hint indicates position_json
was stripped and structured layout data is needed for analysis.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.permalink import lookup_dashboard_reference
from superset.mcp_service.dashboard.schemas import (
    dashboard_layout_serializer,
    DashboardError,
    DashboardLayout,
    GetDashboardLayoutRequest,
    redact_filter_state_data_model_metadata,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.utils import sanitize_for_llm_context

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get dashboard layout",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_dashboard_layout(
    request: GetDashboardLayoutRequest, ctx: Context
) -> DashboardLayout | DashboardError:
    """
    Get parsed dashboard layout by ID, UUID, slug, or dashboard permalink.

    Returns the tabs and chart positions extracted from the dashboard's
    position_json. get_dashboard_info omits position_json to keep responses
    small; call this tool when you need the structured layout (e.g. to
    explain which charts live under which tab, or to locate a chart by
    its parent tab).

    If the user gives you a shared URL containing ``/dashboard/p/<key>/``, pass
    the URL or bare key as ``identifier`` (or use ``permalink_key`` alone). The
    response identifies the active tab and includes the shared filter state.

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```
    """
    await ctx.info("Retrieving dashboard layout: identifier=%s" % (request.identifier,))

    try:
        from superset.daos.dashboard import DashboardDAO

        # No eager loading: the layout serializer only reads position_json
        # (plus id/title/uuid), so Dashboard.slices is never accessed.
        with event_logger.log_context(action="mcp.get_dashboard_layout.lookup"):
            core = ModelGetInfoCore(
                dao_class=DashboardDAO,
                output_schema=DashboardLayout,
                error_schema=DashboardError,
                serializer=dashboard_layout_serializer,
                supports_slug=True,
                logger=logger,
            )
            lookup_result = lookup_dashboard_reference(
                identifier=request.identifier,
                permalink_key=request.permalink_key,
                lookup=core.run_tool,
                is_found=lambda value: isinstance(value, DashboardLayout),
            )
            result = lookup_result.result
            if result is None or lookup_result.permalink_error:
                error_type = (
                    "permalink_not_found" if request.identifier is None else "not_found"
                )
                return DashboardError.create(
                    "Dashboard permalink could not be resolved. It may be invalid "
                    "or expired; ask for a fresh shared dashboard link.",
                    error_type,
                )

        if isinstance(result, DashboardLayout):
            if lookup_result.permalink_value:
                permalink_key = lookup_result.permalink_key
                permalink_value = lookup_result.permalink_value
                try:
                    permalink_dashboard_id = int(permalink_value["dashboardId"])
                except (TypeError, ValueError):
                    permalink_dashboard_id = None
                if permalink_dashboard_id == result.id:
                    raw_state = permalink_value.get("state")
                    filter_state = (
                        dict(raw_state) if isinstance(raw_state, dict) else {}
                    )
                    if not user_can_view_data_model_metadata():
                        filter_state = redact_filter_state_data_model_metadata(
                            filter_state
                        )
                    payload = result.model_dump(mode="python")
                    payload.update(
                        permalink_key=permalink_key,
                        filter_state=sanitize_for_llm_context(
                            filter_state,
                            field_path=("filter_state",),
                            excluded_field_names=frozenset(),
                        ),
                        is_permalink_state=True,
                    )
                    result = DashboardLayout.model_validate(payload)
                else:
                    await ctx.warning(
                        "permalink_key belongs to a different dashboard; ignoring "
                        "its active-tab and filter state."
                    )
            await ctx.info(
                "Dashboard layout retrieved: id=%s, tab_count=%s, chart_count=%s, "
                "has_layout=%s"
                % (
                    result.id,
                    len(result.tabs),
                    len(result.charts),
                    result.has_layout,
                )
            )
        else:
            await ctx.warning(
                "Dashboard layout retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Dashboard layout retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, str(e), type(e).__name__)
        )
        return DashboardError(
            error=f"Failed to get dashboard layout: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
