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
from superset_core.mcp import tool

from superset.mcp_service.dashboard.schemas import (
    dashboard_serializer,
    DashboardError,
    DashboardInfo,
    GetDashboardInfoRequest,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


@tool(tags=["discovery"])
@parse_request(GetDashboardInfoRequest)
async def get_dashboard_info(
    request: GetDashboardInfoRequest, ctx: Context
) -> DashboardInfo | DashboardError:
    """
    Get dashboard metadata by ID, UUID, or slug.

    Returns title, charts, and layout details.
    """
    await ctx.info("Retrieving dashboard information: %s" % (request.identifier,))
    await ctx.debug(
        "Metadata cache settings: use_cache=%s, refresh_metadata=%s, force_refresh=%s"
        % (request.use_cache, request.refresh_metadata, request.force_refresh)
    )

    try:
        from superset.daos.dashboard import DashboardDAO

        tool = ModelGetInfoCore(
            dao_class=DashboardDAO,
            output_schema=DashboardInfo,
            error_schema=DashboardError,
            serializer=dashboard_serializer,
            supports_slug=True,  # Dashboards support slugs
            logger=logger,
        )

        result = tool.run_tool(request.identifier)

        if isinstance(result, DashboardInfo):
            await ctx.info(
                "Dashboard information retrieved successfully: id=%s, title=%s, "
                "chart_count=%s, published=%s"
                % (
                    result.id,
                    result.dashboard_title,
                    result.chart_count,
                    result.published,
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
