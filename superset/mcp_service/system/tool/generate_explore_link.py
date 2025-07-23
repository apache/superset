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
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    GenerateExploreLinkRequest,
)


@mcp.tool
@mcp_auth_hook
async def generate_explore_link(request: GenerateExploreLinkRequest) -> Dict[str, Any]:
    """
    Generate a Superset explore URL with pre-configured chart configuration.

    Args:
        request: Explore link generation request with dataset_id and config

    Returns:
        Dictionary containing explore URL and error message if any
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
