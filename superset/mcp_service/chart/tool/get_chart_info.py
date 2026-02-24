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
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartInfo,
    GetChartInfoRequest,
    serialize_chart_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


@tool(tags=["discovery"])
@parse_request(GetChartInfoRequest)
async def get_chart_info(
    request: GetChartInfoRequest, ctx: Context
) -> ChartInfo | ChartError:
    """Get chart metadata by ID or UUID.

    IMPORTANT FOR LLM CLIENTS:
    - URL field links to the chart's explore page in Superset
    - Use numeric ID or UUID string (NOT chart name)
    - To find a chart ID, use the list_charts tool first

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    Or with UUID:
    ```json
    {
        "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    }
    ```

    Returns chart details including name, type, and URL.
    """
    from superset.daos.chart import ChartDAO

    await ctx.info(
        "Retrieving chart information: identifier=%s" % (request.identifier,)
    )

    with event_logger.log_context(action="mcp.get_chart_info.lookup"):
        tool = ModelGetInfoCore(
            dao_class=ChartDAO,
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
