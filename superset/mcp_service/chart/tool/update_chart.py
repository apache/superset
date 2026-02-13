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

from fastmcp import Context
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    map_config_to_form_data,
)
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    GenerateChartResponse,
    PerformanceMetadata,
    UpdateChartRequest,
)
from superset.mcp_service.utils.schema_utils import parse_request
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


@tool(tags=["mutate"])
@parse_request(UpdateChartRequest)
async def update_chart(
    request: UpdateChartRequest, ctx: Context
) -> GenerateChartResponse:
    """Update existing chart with new configuration.

    IMPORTANT:
    - Chart must already be saved (from generate_chart with save_chart=True)
    - LLM clients MUST display updated chart URL to users
    - Use numeric ID or UUID string to identify the chart (NOT chart name)
    - MUST include chart_type in config (either 'xy' or 'table')

    Example usage:
    ```json
    {
        "identifier": 123,
        "config": {
            "chart_type": "xy",
            "x": {"name": "date"},
            "y": [{"name": "sales", "aggregate": "SUM"}],
            "kind": "line"
        }
    }
    ```

    Or with UUID:
    ```json
    {
        "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        "config": {
            "chart_type": "table",
            "columns": [
                {"name": "product_name"},
                {"name": "revenue", "aggregate": "SUM"}
            ]
        }
    }
    ```

    Use when:
    - Modifying existing saved chart
    - Updating title, filters, or visualization settings
    - Changing chart type or data columns

    Returns:
    - Updated chart info and metadata
    - Preview URL and explore URL for further editing
    """
    start_time = time.time()

    try:
        # Find the existing chart
        from superset.daos.chart import ChartDAO

        with event_logger.log_context(action="mcp.update_chart.chart_lookup"):
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
            return GenerateChartResponse.model_validate(
                {
                    "chart": None,
                    "error": f"No chart found with identifier: {request.identifier}",
                    "success": False,
                    "schema_version": "2.0",
                    "api_version": "v1",
                }
            )

        # Map the new config to form_data format
        # Get dataset_id from existing chart for column type checking
        dataset_id = chart.datasource_id if chart.datasource_id else None
        new_form_data = map_config_to_form_data(request.config, dataset_id=dataset_id)

        # Update chart using Superset's command
        from superset.commands.chart.update import UpdateChartCommand

        with event_logger.log_context(action="mcp.update_chart.db_write"):
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
                with event_logger.log_context(action="mcp.update_chart.preview"):
                    from superset.mcp_service.chart.tool.get_chart_preview import (
                        _get_chart_preview_internal,
                        GetChartPreviewRequest,
                    )

                    for format_type in request.preview_formats:
                        preview_request = GetChartPreviewRequest(
                            identifier=str(updated_chart.id),
                            format=format_type,
                        )
                        preview_result = await _get_chart_preview_internal(
                            preview_request, ctx
                        )

                        if hasattr(preview_result, "content"):
                            previews[format_type] = preview_result.content

            except Exception as e:
                # Log warning but don't fail the entire request
                logger.warning("Preview generation failed: %s", e)

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
        return GenerateChartResponse.model_validate(result)

    except Exception as e:
        execution_time = int((time.time() - start_time) * 1000)
        return GenerateChartResponse.model_validate(
            {
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
        )
