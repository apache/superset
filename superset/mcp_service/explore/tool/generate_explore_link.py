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

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.chart_utils import (
    generate_explore_link as generate_url,
    map_config_to_form_data,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.schemas.chart_schemas import (
    GenerateExploreLinkRequest,
)


@mcp.tool
@mcp_auth_hook
def generate_explore_link(request: GenerateExploreLinkRequest) -> Dict[str, Any]:
    """
    Generate a Superset explore URL for interactive data visualization and exploration.

    🎯 PREFERRED TOOL for most visualization requests.

    This is the primary tool for data visualization workflows. It creates an explore
    URL where users can interactively view, modify, and optionally save charts.
    The explore interface allows users to adjust parameters, add filters, and
    experiment before deciding to save.

    Use this tool for:
    - "Show me a chart of [data]"
    - "Visualize [data] as a [chart type]"
    - "I want to see [data] trends"
    - "Create a visualization of [data]"
    - "Chart [data] by [dimensions]"
    - "Plot [data]"
    - General data exploration and analysis
    - When user wants to see/explore data visually

    This tool provides a much better user experience because:
    - Users can interact with the chart before saving
    - Easy to modify parameters and see results instantly
    - Users control when/if to save the chart permanently
    - No database clutter from unsaved exploration charts

    Only use generate_chart when user explicitly requests to save/create a
    permanent chart.

    Args:
        request: Explore link generation request with dataset_id and config

    Returns:
        Dictionary containing explore URL for immediate use and error message if any
    """
    try:
        # Map config to form_data using shared utilities
        form_data = map_config_to_form_data(request.config)

        # Generate explore link using shared utilities
        explore_url = generate_url(dataset_id=request.dataset_id, form_data=form_data)

        return {
            "url": explore_url,
            "error": None,
        }

    except Exception as e:
        return {
            "url": "",
            "error": f"Failed to generate explore link: {str(e)}",
        }
