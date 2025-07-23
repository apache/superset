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
MCP tool: create_chart (simplified schema)
"""

from typing import Any, Dict

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.chart_utils import (
    generate_chart_name,
    map_config_to_form_data,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import CreateChartRequest
from superset.utils import json


@mcp.tool
@mcp_auth_hook
async def create_chart(request: CreateChartRequest) -> Dict[str, Any]:
    """
    Create a new chart in Superset.

    Args:
        request: Chart creation request with dataset_id and config

    Returns:
        Dictionary containing chart info and error message if any
    """
    try:
        # Map the simplified config to Superset's form_data format
        form_data = map_config_to_form_data(request.config)

        # Save the chart
        from superset.commands.chart.create import CreateChartCommand

        # Generate a chart name
        chart_name = generate_chart_name(request.config)

        # Create the chart using Superset's command
        command = CreateChartCommand(
            {
                "slice_name": chart_name,
                "viz_type": form_data["viz_type"],
                "datasource_id": int(request.dataset_id),
                "datasource_type": "table",
                "params": json.dumps(form_data),
            }
        )

        chart = command.run()

        return {
            "chart": {
                "id": chart.id,
                "slice_name": chart.slice_name,
                "viz_type": chart.viz_type,
                "url": f"/explore/?slice_id={chart.id}",
            },
            "error": None,
        }

    except Exception as e:
        return {
            "chart": None,
            "error": f"Chart creation failed: {str(e)}",
        }
