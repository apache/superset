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

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartInfo,
    GetChartInfoRequest,
    serialize_chart_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
async def get_chart_info(
    request: GetChartInfoRequest, ctx: Context
) -> ChartInfo | ChartError:
    """Get chart metadata by ID or UUID.

    Returns chart details including name, type, and URL.
    """
    from superset.daos.chart import ChartDAO

    await ctx.info(
        "Retrieving chart information: identifier=%s" % (request.identifier,)
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
            "Chart information retrieved successfully: chart_name=%s"
            % (result.slice_name,)
        )
    else:
        await ctx.warning("Chart retrieval failed: error=%s" % (str(result),))

    return result
