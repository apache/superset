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


def _get_cached_form_data(form_data_key: str) -> str | None:
    """Retrieve form_data from cache using form_data_key.

    Returns the JSON string of form_data if found, None otherwise.
    """
    from superset.commands.explore.form_data.get import GetFormDataCommand
    from superset.commands.explore.form_data.parameters import CommandParameters

    try:
        cmd_params = CommandParameters(key=form_data_key)
        return GetFormDataCommand(cmd_params).run()
    except Exception as e:
        logger.warning("Failed to retrieve form_data from cache: %s", e)
        return None


@tool(tags=["discovery"])
@parse_request(GetChartInfoRequest)
async def get_chart_info(
    request: GetChartInfoRequest, ctx: Context
) -> ChartInfo | ChartError:
    """Get chart metadata by ID or UUID.

    IMPORTANT FOR LLM CLIENTS:
    - ALWAYS display the chart URL when returned
    - URL field contains chart's screenshot URL for preview
    - Use numeric ID or UUID string (NOT chart name)
    - To find a chart ID, use the list_charts tool first
    - When form_data_key is provided, returns the unsaved chart configuration
      (what the user sees in Explore) instead of the saved version

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

    With unsaved state (form_data_key from Explore URL):
    ```json
    {
        "identifier": 123,
        "form_data_key": "abc123def456"
    }
    ```

    Returns chart details including name, type, and URL.
    """
    from superset.daos.chart import ChartDAO
    from superset.utils import json as utils_json

    await ctx.info(
        "Retrieving chart information: identifier=%s, form_data_key=%s"
        % (request.identifier, request.form_data_key)
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
        # If form_data_key is provided, override form_data with cached version
        if request.form_data_key:
            await ctx.info(
                "Retrieving unsaved chart state from cache: form_data_key=%s"
                % (request.form_data_key,)
            )
            cached_form_data = _get_cached_form_data(request.form_data_key)

            if cached_form_data:
                try:
                    result.form_data = utils_json.loads(cached_form_data)
                    result.form_data_key = request.form_data_key
                    result.is_unsaved_state = True

                    # Update viz_type from cached form_data if present
                    if result.form_data and "viz_type" in result.form_data:
                        result.viz_type = result.form_data["viz_type"]

                    await ctx.info(
                        "Chart form_data overridden with unsaved state from cache"
                    )
                except Exception as e:
                    await ctx.warning(
                        "Failed to parse cached form_data: %s. "
                        "Using saved chart configuration." % (str(e),)
                    )
            else:
                await ctx.warning(
                    "form_data_key provided but no cached data found. "
                    "The cache may have expired. Using saved chart configuration."
                )

        await ctx.info(
            "Chart information retrieved successfully: chart_name=%s, "
            "is_unsaved_state=%s" % (result.slice_name, result.is_unsaved_state)
        )
    else:
        await ctx.warning("Chart retrieval failed: error=%s" % (str(result),))

    return result
