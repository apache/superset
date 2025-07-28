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
MCP tool: generate_chart (simplified schema)
"""

from typing import Any, Dict

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.chart_utils import (
    generate_chart_name,
    map_config_to_form_data,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import GenerateChartRequest
from superset.utils import json


@mcp.tool
@mcp_auth_hook
def generate_chart(request: GenerateChartRequest) -> Dict[str, Any]:
    """
    Generate a new chart in Superset.

    Args:
        request: Chart creation request with dataset_id, config, and optional
            preview generation

    Returns:
        Dictionary containing chart info, optional preview image (base64),
        and error message if any
    """
    try:
        # Map the simplified config to Superset's form_data format
        form_data = map_config_to_form_data(request.config)

        # Save the chart
        from superset.commands.chart.create import CreateChartCommand

        # Generate a chart name
        chart_name = generate_chart_name(request.config)

        # Find the dataset to get its numeric ID
        from superset.daos.dataset import DatasetDAO

        dataset = None
        if isinstance(request.dataset_id, int) or (
            isinstance(request.dataset_id, str) and request.dataset_id.isdigit()
        ):
            dataset_id = (
                int(request.dataset_id)
                if isinstance(request.dataset_id, str)
                else request.dataset_id
            )
            dataset = DatasetDAO.find_by_id(dataset_id)
        else:
            # Try UUID lookup using DAO flexible method
            dataset = DatasetDAO.find_by_id(request.dataset_id, id_column="uuid")

        if not dataset:
            return {
                "chart": None,
                "error": f"No dataset found with identifier: {request.dataset_id}",
            }

        # Create the chart using Superset's command
        command = CreateChartCommand(
            {
                "slice_name": chart_name,
                "viz_type": form_data["viz_type"],
                "datasource_id": dataset.id,
                "datasource_type": "table",
                "params": json.dumps(form_data),
            }
        )

        chart = command.run()

        result: Dict[str, Any] = {
            "chart": {
                "id": chart.id,
                "slice_name": chart.slice_name,
                "viz_type": chart.viz_type,
                "url": f"/explore/?slice_id={chart.id}",
            },
            "error": None,
        }

        # Generate preview if requested
        if request.generate_preview:
            try:
                from superset.mcp_service.chart.tool.get_chart_preview import (
                    _get_chart_preview_internal,
                    GetChartPreviewRequest,
                )

                preview_request = GetChartPreviewRequest(identifier=str(chart.id))
                preview_result = _get_chart_preview_internal(preview_request)

                if hasattr(preview_result, "screenshot_url"):
                    result["chart"]["preview_screenshot_url"] = (
                        preview_result.screenshot_url
                    )
                    result["chart"]["preview_thumbnail_url"] = (
                        preview_result.thumbnail_url
                    )
                    result["chart"]["preview_width"] = preview_result.width
                    result["chart"]["preview_height"] = preview_result.height
                    result["chart"]["preview_description"] = (
                        preview_result.chart_description
                    )
                else:
                    result["preview_error"] = str(
                        preview_result.error
                        if hasattr(preview_result, "error")
                        else preview_result
                    )

            except Exception as preview_error:
                result["preview_error"] = (
                    f"Failed to generate preview: {str(preview_error)}"
                )

        return result

    except Exception as e:
        return {
            "chart": None,
            "error": f"Chart creation failed: {str(e)}",
        }
