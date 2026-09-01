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
Get dashboard info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific dashboard.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastmcp import Context
from sqlalchemy.orm import subqueryload
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.permalink import (
    DashboardLookupResult,
    get_matching_dashboard_permalink_state,
    lookup_dashboard_reference,
)
from superset.mcp_service.dashboard.schemas import (
    dashboard_serializer,
    DashboardError,
    DashboardInfo,
    GetDashboardInfoRequest,
    redact_filter_state_data_model_metadata,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.privacy import user_can_view_data_model_metadata

logger = logging.getLogger(__name__)


def _apply_permalink_state(
    result: DashboardInfo,
    permalink_key: str | None,
    permalink_state: dict[str, object],
    is_permalink: bool = True,
) -> DashboardInfo:
    """Attach the filter state without changing its stored values.
    is_permalink is False when the state was supplied directly, not resolved
    from a permalink."""
    return result.model_copy(
        update={
            "permalink_key": permalink_key,
            "filter_state": permalink_state,
            "is_permalink_state": is_permalink,
        }
    )


def _lookup_dashboard(
    tool: ModelGetInfoCore,
    request: GetDashboardInfoRequest,
) -> tuple[
    DashboardInfo | DashboardError,
    DashboardLookupResult[DashboardInfo | DashboardError],
]:
    """Resolve an ordinary identifier or dashboard permalink, then run lookup."""
    lookup_result = lookup_dashboard_reference(
        identifier=request.identifier,
        permalink_key=request.permalink_key,
        lookup=tool.run_tool,
        is_found=lambda result: isinstance(result, DashboardInfo),
    )
    result = lookup_result.result
    if result is None:
        # Only reachable when the dashboard had to come from a permalink, so the
        # identifier's own "not found" error (when there is one) is preserved.
        result = DashboardError.create(
            "Dashboard permalink could not be resolved. It may be invalid or "
            "expired; ask for a fresh shared dashboard link.",
            "permalink_not_found",
        )
    return result, lookup_result


@tool(
    tags=["discovery"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get dashboard info",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_dashboard_info(
    request: GetDashboardInfoRequest, ctx: Context
) -> dict[str, Any] | DashboardError:
    """
    Get dashboard metadata by ID, UUID, slug, or dashboard permalink.

    Returns title, charts, and layout details.

    For dashboards with many charts or native filters, the ``charts`` and
    ``native_filters`` lists may be capped below their true size (see
    ``chart_count`` for the real total, and ``_truncation_notes`` in the
    response when truncation occurred). To retrieve the complete list of
    charts on a large dashboard regardless of size, call ``list_charts``
    with ``filters=[{"col": "dashboards", "opr": "eq", "value": <dashboard
    id>}]`` and page through the results using ``page``/``page_size``.

    If the user gives you a shared URL containing ``/dashboard/p/<key>/``, pass
    the URL or bare key as ``identifier`` (or use ``permalink_key`` alone). The
    response includes the dashboard ID plus active tab and filter state.

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    With permalink (filter state from URL):
    ```json
    {
        "permalink_key": "abc123def456"
    }
    ```
    """
    await ctx.info(
        "Retrieving dashboard information: identifier=%s, permalink_key=%s"
        % (request.identifier, request.permalink_key)
    )
    await ctx.debug(
        "Metadata cache settings: use_cache=%s, refresh_metadata=%s, force_refresh=%s"
        % (request.use_cache, request.refresh_metadata, request.force_refresh)
    )

    try:
        from superset.daos.dashboard import DashboardDAO
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        # Eager load slices (charts), editors, tags, and embedded rows to avoid
        # N+1 queries. Also eager load editors/tags on each slice since the
        # dashboard serializer calls serialize_chart_object for every chart.
        eager_options = [
            subqueryload(Dashboard.slices).subqueryload(Slice.editors),
            subqueryload(Dashboard.slices).subqueryload(Slice.tags),
            subqueryload(Dashboard.editors),
            subqueryload(Dashboard.tags),
            subqueryload(Dashboard.embedded),
        ]

        with event_logger.log_context(action="mcp.get_dashboard_info.lookup"):
            tool = ModelGetInfoCore(
                dao_class=DashboardDAO,
                output_schema=DashboardInfo,
                error_schema=DashboardError,
                serializer=dashboard_serializer,
                supports_slug=True,  # Dashboards support slugs
                logger=logger,
                query_options=eager_options,
            )

            result, lookup_result = _lookup_dashboard(tool, request)
            permalink_key = lookup_result.permalink_key
            permalink_value = lookup_result.permalink_value

        if isinstance(result, DashboardInfo):
            # If permalink_key is provided, retrieve filter state
            if permalink_key:
                await ctx.info(
                    "Retrieving filter state from permalink: permalink_key=%s"
                    % (permalink_key,)
                )

                if permalink_value:
                    permalink_state = get_matching_dashboard_permalink_state(
                        lookup_result,
                        result.id,
                        result.uuid,
                        result.slug,
                    )
                    if permalink_state is None:
                        await ctx.warning(
                            "permalink_key belongs to a different dashboard; "
                            "ignoring permalink filter state."
                        )
                    else:
                        result = _apply_permalink_state(
                            result,
                            permalink_state.key,
                            permalink_state.state,
                        )

                        await ctx.info(
                            "Filter state retrieved from permalink: "
                            "has_dataMask=%s, has_chartStates=%s, has_activeTabs=%s"
                            % (
                                "dataMask" in permalink_state.state,
                                "chartStates" in permalink_state.state,
                                "activeTabs" in permalink_state.state,
                            )
                        )
                else:
                    await ctx.warning(
                        "permalink_key provided but no permalink found. "
                        "The permalink may have expired or is invalid."
                    )
            elif request.filter_state is not None:
                # Filter context supplied directly (no permalink), e.g. embedded.
                await ctx.info("Applying caller-supplied filter_state")
                filter_state = request.filter_state
                if not user_can_view_data_model_metadata():
                    filter_state = redact_filter_state_data_model_metadata(filter_state)
                result = _apply_permalink_state(
                    result, None, filter_state, is_permalink=False
                )

            await ctx.info(
                "Dashboard information retrieved successfully: id=%s, title=%s, "
                "chart_count=%s, published=%s, is_permalink_state=%s"
                % (
                    result.id,
                    result.dashboard_title,
                    result.chart_count,
                    result.published,
                    result.is_permalink_state,
                )
            )
            # Include filter_state by default when present, but honor an explicit
            # select_columns projection (model_fields_set = caller chose it).
            effective_select_columns = list(request.select_columns)
            if (
                result.filter_state is not None
                and "select_columns" not in request.model_fields_set
                and "filter_state" not in effective_select_columns
            ):
                effective_select_columns.append("filter_state")

            return result.model_dump(
                mode="json",
                context={"select_columns": effective_select_columns},
            )
        else:
            await ctx.warning(
                "Dashboard retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Dashboard information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, str(e), type(e).__name__)
        )
        return DashboardError(
            error=f"Failed to get dashboard info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
