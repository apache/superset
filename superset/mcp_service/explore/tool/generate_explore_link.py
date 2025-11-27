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
Generate explore link MCP tool

This tool generates a URL to the Superset explore interface with the specified
chart configuration.
"""

from typing import Any, Dict

from fastmcp import Context
from superset_core.mcp import tool

from superset.mcp_service.chart.chart_utils import (
    generate_explore_link as generate_url,
    map_config_to_form_data,
)
from superset.mcp_service.chart.schemas import (
    GenerateExploreLinkRequest,
)
from superset.mcp_service.utils.schema_utils import parse_request


@tool
@parse_request(GenerateExploreLinkRequest)
async def generate_explore_link(
    request: GenerateExploreLinkRequest, ctx: Context
) -> Dict[str, Any]:
    """Generate explore URL for interactive visualization.

    PREFERRED TOOL for most visualization requests.

    Use this tool for:
    - "Show me a chart of [data]"
    - "Visualize [data]"
    - General data exploration
    - When user wants to SEE data visually

    IMPORTANT:
    - Use numeric dataset ID or UUID (NOT schema.table_name format)
    - MUST include chart_type in config (either 'xy' or 'table')

    Example usage:
    ```json
    {
        "dataset_id": 123,
        "config": {
            "chart_type": "xy",
            "x": {"name": "date"},
            "y": [{"name": "sales", "aggregate": "SUM"}],
            "kind": "bar"
        }
    }
    ```

    Better UX because:
    - Users can interact with chart before saving
    - Easy to modify parameters instantly
    - No database clutter from exploration

    Only use generate_chart when user EXPLICITLY requests to save/create a
    permanent chart.

    Returns explore URL for immediate use.
    """
    await ctx.info(
        "Generating explore link for dataset_id=%s, chart_type=%s"
        % (request.dataset_id, request.config.chart_type)
    )
    await ctx.debug(
        "Configuration details: use_cache=%s, force_refresh=%s, cache_form_data=%s"
        % (request.use_cache, request.force_refresh, request.cache_form_data)
    )

    try:
        await ctx.report_progress(1, 3, "Converting configuration to form data")
        # Map config to form_data using shared utilities
        form_data = map_config_to_form_data(request.config)

        await ctx.debug(
            "Form data generated with keys: %s, has_viz_type=%s, has_datasource=%s"
            % (
                list(form_data.keys()),
                bool(form_data.get("viz_type")),
                bool(form_data.get("datasource")),
            )
        )

        await ctx.report_progress(2, 3, "Generating explore URL")
        # Generate explore link using shared utilities
        explore_url = generate_url(dataset_id=request.dataset_id, form_data=form_data)

        await ctx.report_progress(3, 3, "URL generation complete")
        await ctx.info(
            "Explore link generated successfully: url_length=%s, dataset_id=%s"
            % (len(explore_url), request.dataset_id)
        )

        return {
            "url": explore_url,
            "error": None,
        }

    except Exception as e:
        await ctx.error(
            "Explore link generation failed for dataset_id=%s, chart_type=%s: %s: %s"
            % (request.dataset_id, request.config.chart_type, type(e).__name__, str(e))
        )
        return {
            "url": "",
            "error": f"Failed to generate explore link: {str(e)}",
        }
