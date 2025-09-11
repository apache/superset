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
MCP tool: get_chart_info
"""

import logging

from fastmcp import Context

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartInfo,
    GetChartInfoRequest,
    serialize_chart_object,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
async def get_chart_info(
    request: GetChartInfoRequest, ctx: Context
) -> ChartInfo | ChartError:
    """
    Get detailed information about a specific chart with metadata cache control.

    IMPORTANT FOR LLM CLIENTS:
    - ALWAYS display the chart URL when returned (e.g., "View chart at: {url}")
    - The URL field contains the chart's screenshot URL for preview

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Metadata Cache Control:
    - use_cache: Whether to use metadata cache for faster responses
    - refresh_metadata: Force refresh of metadata cache for fresh data

    Returns a ChartInfo model or ChartError on error.
    """
    from superset.daos.chart import ChartDAO

    await ctx.info(
        "Retrieving chart information", extra={"identifier": request.identifier}
    )

    tool = ModelGetInfoCore(
        dao_class=ChartDAO,  # type: ignore[arg-type]
        output_schema=ChartInfo,
        error_schema=ChartError,
        serializer=serialize_chart_object,
        supports_slug=False,  # Charts don't have slugs
        logger=logger,
    )

    result = tool.run_tool(request.identifier)

    if isinstance(result, ChartInfo):
        await ctx.info(
            "Chart information retrieved successfully",
            extra={"chart_name": result.slice_name},
        )
    else:
        await ctx.warning("Chart retrieval failed", extra={"error": str(result)})

    return result
