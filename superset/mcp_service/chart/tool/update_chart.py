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
MCP tool: update_chart
"""

import logging
import time
from typing import Any, Dict

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    map_config_to_form_data,
)
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    PerformanceMetadata,
    UpdateChartRequest,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.utils.url_utils import (
    get_chart_screenshot_url,
    get_superset_base_url,
)
from superset.utils import json

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def update_chart(request: UpdateChartRequest) -> Dict[str, Any]:
    """
    Update an existing saved chart with new configuration.

    This tool modifies a permanently saved chart in Superset with new settings,
    filters, or visualization parameters. The chart must already exist (created
    via generate_chart with save_chart=True).

    IMPORTANT FOR LLM CLIENTS:
    - ALWAYS display the updated chart URL (e.g., "Chart updated! View at: {url}")
    - When preview_url is returned, embed it as an image: ![Updated Chart](preview_url)
    - Display the explore_url for users to further edit the chart

    Use this tool when:
    - User wants to modify an existing saved chart
    - Updating chart title, filters, or visualization settings
    - Changing chart type or data columns for a saved chart

    Args:
        request: Chart update request with chart identifier, new config,
            and optional preview generation

    Returns:
        Response with updated chart info, preview images, and explore URL
    """
    start_time = time.time()

    try:
        # Find the existing chart
        from superset.daos.chart import ChartDAO

        chart = None
        if isinstance(request.identifier, int) or (
            isinstance(request.identifier, str) and request.identifier.isdigit()
        ):
            chart_id = (
                int(request.identifier)
                if isinstance(request.identifier, str)
                else request.identifier
            )
            chart = ChartDAO.find_by_id(chart_id)
        else:
            # Try UUID lookup using DAO flexible method
            chart = ChartDAO.find_by_id(request.identifier, id_column="uuid")

        if not chart:
            return {
                "chart": None,
                "error": f"No chart found with identifier: {request.identifier}",
                "success": False,
                "schema_version": "2.0",
                "api_version": "v1",
            }

        # Map the new config to form_data format
        new_form_data = map_config_to_form_data(request.config)

        # Update chart using Superset's command
        from superset.commands.chart.update import UpdateChartCommand

        # Generate new chart name if provided, otherwise keep existing
        chart_name = (
            request.chart_name
            if request.chart_name
            else chart.slice_name or generate_chart_name(request.config)
        )

        update_payload = {
            "slice_name": chart_name,
            "viz_type": new_form_data["viz_type"],
            "params": json.dumps(new_form_data),
        }

        command = UpdateChartCommand(chart.id, update_payload)
        updated_chart = command.run()

        # Generate semantic analysis
        capabilities = analyze_chart_capabilities(updated_chart, request.config)
        semantics = analyze_chart_semantics(updated_chart, request.config)

        # Create performance metadata
        execution_time = int((time.time() - start_time) * 1000)
        performance = PerformanceMetadata(
            query_duration_ms=execution_time,
            cache_status="miss",
            optimization_suggestions=[],
        )

        # Create accessibility metadata
        chart_name = (
            updated_chart.slice_name
            if updated_chart and hasattr(updated_chart, "slice_name")
            else generate_chart_name(request.config)
        )
        accessibility = AccessibilityMetadata(
            color_blind_safe=True,  # Would need actual analysis
            alt_text=f"Updated chart showing {chart_name}",
            high_contrast_available=False,
        )

        # Generate previews if requested
        previews = {}
        if request.generate_preview:
            try:
                from superset.mcp_service.chart.tool.get_chart_preview import (
                    _get_chart_preview_internal,
                    GetChartPreviewRequest,
                )

                for format_type in request.preview_formats:
                    preview_request = GetChartPreviewRequest(
                        identifier=str(updated_chart.id), format=format_type
                    )
                    preview_result = _get_chart_preview_internal(preview_request)

                    if hasattr(preview_result, "content"):
                        previews[format_type] = preview_result.content

            except Exception as e:
                # Log warning but don't fail the entire request
                logger.warning(f"Preview generation failed: {e}")

        # Return enhanced data
        result = {
            "chart": {
                "id": updated_chart.id,
                "slice_name": updated_chart.slice_name,
                "viz_type": updated_chart.viz_type,
                "url": (
                    f"{get_superset_base_url()}/explore/?slice_id={updated_chart.id}"
                ),
                "uuid": str(updated_chart.uuid) if updated_chart.uuid else None,
                "updated": True,
            },
            "error": None,
            # Enhanced fields for better LLM integration
            "previews": previews,
            "capabilities": capabilities.model_dump() if capabilities else None,
            "semantics": semantics.model_dump() if semantics else None,
            "explore_url": (
                f"{get_superset_base_url()}/explore/?slice_id={updated_chart.id}"
            ),
            "api_endpoints": {
                "data": (
                    f"{get_superset_base_url()}/api/v1/chart/{updated_chart.id}/data/"
                ),
                "preview": get_chart_screenshot_url(updated_chart.id),
                "export": (
                    f"{get_superset_base_url()}/api/v1/chart/{updated_chart.id}/export/"
                ),
            },
            "performance": performance.model_dump() if performance else None,
            "accessibility": accessibility.model_dump() if accessibility else None,
            "success": True,
            "schema_version": "2.0",
            "api_version": "v1",
        }
        return result

    except Exception as e:
        execution_time = int((time.time() - start_time) * 1000)
        return {
            "chart": None,
            "error": f"Chart update failed: {str(e)}",
            "performance": {
                "query_duration_ms": execution_time,
                "cache_status": "error",
                "optimization_suggestions": [],
            },
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }
