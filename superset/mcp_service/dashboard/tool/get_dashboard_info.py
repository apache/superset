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

from fastmcp import Context
from sqlalchemy.orm import subqueryload
from superset_core.mcp import tool

from superset.dashboards.permalink.exceptions import DashboardPermalinkGetFailedError
from superset.dashboards.permalink.types import DashboardPermalinkValue
from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    dashboard_serializer,
    DashboardError,
    DashboardInfo,
    GetDashboardInfoRequest,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


def _get_permalink_state(permalink_key: str) -> DashboardPermalinkValue | None:
    """Retrieve dashboard filter state from permalink.

    Returns the permalink value containing dashboardId and state if found,
    None otherwise.
    """
    from superset.commands.dashboard.permalink.get import GetDashboardPermalinkCommand

    try:
        return GetDashboardPermalinkCommand(permalink_key).run()
    except DashboardPermalinkGetFailedError as e:
        logger.warning("Failed to retrieve permalink state: %s", e)
        return None


@tool(tags=["discovery"])
@parse_request(GetDashboardInfoRequest)
async def get_dashboard_info(
    request: GetDashboardInfoRequest, ctx: Context
) -> DashboardInfo | DashboardError:
    """
    Get dashboard metadata by ID, UUID, or slug.

    Returns title, charts, and layout details.

    When permalink_key is provided, also returns the filter state from that
    permalink, allowing you to see what filters the user has applied to the
    dashboard (not just the default filter state).

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    With permalink (filter state from URL):
    ```json
    {
        "identifier": 123,
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

        # Eager load slices (charts), owners, tags, and roles to avoid N+1
        # queries. Also eager load owners/tags on each slice since the
        # dashboard serializer calls serialize_chart_object for every chart.
        eager_options = [
            subqueryload(Dashboard.slices).subqueryload(Slice.owners),
            subqueryload(Dashboard.slices).subqueryload(Slice.tags),
            subqueryload(Dashboard.owners),
            subqueryload(Dashboard.tags),
            subqueryload(Dashboard.roles),
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

            result = tool.run_tool(request.identifier)

        if isinstance(result, DashboardInfo):
            # If permalink_key is provided, retrieve filter state
            if request.permalink_key:
                await ctx.info(
                    "Retrieving filter state from permalink: permalink_key=%s"
                    % (request.permalink_key,)
                )
                permalink_value = _get_permalink_state(request.permalink_key)

                if permalink_value:
                    # Verify the permalink belongs to the requested dashboard
                    # dashboardId in permalink is stored as str, result.id is int
                    permalink_dashboard_id = permalink_value.get("dashboardId")
                    try:
                        permalink_dashboard_id_int = (
                            int(permalink_dashboard_id)
                            if permalink_dashboard_id
                            else None
                        )
                    except (ValueError, TypeError):
                        permalink_dashboard_id_int = None

                    if (
                        permalink_dashboard_id_int is not None
                        and permalink_dashboard_id_int != result.id
                    ):
                        await ctx.warning(
                            "permalink_key dashboardId (%s) does not match "
                            "requested dashboard id (%s); ignoring permalink "
                            "filter state." % (permalink_dashboard_id, result.id)
                        )
                    else:
                        # Extract the state from permalink value
                        # Handle None or non-dict state gracefully
                        raw_state = permalink_value.get("state")
                        permalink_state = (
                            dict(raw_state) if isinstance(raw_state, dict) else {}
                        )
                        result.permalink_key = request.permalink_key
                        result.filter_state = permalink_state
                        result.is_permalink_state = True

                        await ctx.info(
                            "Filter state retrieved from permalink: "
                            "has_dataMask=%s, has_activeTabs=%s"
                            % (
                                "dataMask" in permalink_state,
                                "activeTabs" in permalink_state,
                            )
                        )
                else:
                    await ctx.warning(
                        "permalink_key provided but no permalink found. "
                        "The permalink may have expired or is invalid."
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
