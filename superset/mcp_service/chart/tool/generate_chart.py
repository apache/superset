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
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    AccessibilityMetadata,
    GenerateChartRequest,
    PerformanceMetadata,
    URLPreview,
)
from superset.mcp_service.url_utils import get_mcp_service_url, get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def generate_chart(request: GenerateChartRequest) -> Dict[str, Any]:  # noqa: C901
    """
    Create and SAVE a new chart in Superset with enhanced preview capabilities.

    This tool creates a permanent chart in Superset and generates preview images
    that can be embedded in LLM conversations. The chart appears in saved charts
    and can be added to dashboards.

    Enhanced features:
    - Generates chart preview images for embedding in LLM conversations
    - Returns explore URL for interactive editing after creation
    - Supports multiple preview formats (url, ascii, table, base64)
    - Rich semantic analysis and capabilities metadata
    - Enhanced form_data caching for better explore experience

    Default behavior (save_chart=True):
    - Permanently saves chart in Superset
    - Generates preview images
    - Returns chart ID and metadata
    - Provides explore URL for further editing

    Optional behavior (save_chart=False):
    - Creates temporary visualization only
    - Caches configuration server-side
    - Returns preview + explore link
    - No permanent chart saved

    Args:
        request: Chart creation request with dataset_id, config, save_chart flag,
            and preview options

    Returns:
        Response with saved chart info, preview images, and explore URL
    """
    start_time = time.time()

    try:
        # Map the simplified config to Superset's form_data format
        form_data = map_config_to_form_data(request.config)

        chart = None
        chart_id = None
        explore_url = None
        form_data_key = None

        # Save chart by default (unless save_chart=False)
        if request.save_chart:
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
                    "success": False,
                    "schema_version": "2.0",
                    "api_version": "v1",
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
            chart_id = chart.id
            # Update explore URL to use saved chart
            explore_url = f"{get_superset_base_url()}/explore/?slice_id={chart.id}"
        else:
            # Generate explore link with cached form_data for preview-only mode
            from superset.mcp_service.chart.chart_utils import generate_explore_link

            explore_url = generate_explore_link(request.dataset_id, form_data)

            # Extract form_data_key from the explore URL
            if "form_data_key=" in explore_url:
                form_data_key = explore_url.split("form_data_key=")[1].split("&")[0]

        # Generate semantic analysis
        capabilities = analyze_chart_capabilities(chart, request.config)
        semantics = analyze_chart_semantics(chart, request.config)

        # Create performance metadata
        execution_time = int((time.time() - start_time) * 1000)
        performance = PerformanceMetadata(
            query_duration_ms=execution_time,
            cache_status="miss",
            optimization_suggestions=[],
        )

        # Create accessibility metadata
        chart_name = (
            chart.slice_name
            if chart and hasattr(chart, "slice_name")
            else generate_chart_name(request.config)
        )
        accessibility = AccessibilityMetadata(
            color_blind_safe=True,  # Would need actual analysis
            alt_text=f"Chart showing {chart_name}",
            high_contrast_available=False,
        )

        # Generate previews if requested
        previews = {}
        if request.generate_preview:
            try:
                for format_type in request.preview_formats:
                    if chart_id:
                        # For saved charts, use the existing preview generation
                        from superset.mcp_service.chart.tool.get_chart_preview import (
                            _get_chart_preview_internal,
                            GetChartPreviewRequest,
                        )

                        preview_request = GetChartPreviewRequest(
                            identifier=str(chart_id), format=format_type
                        )
                        preview_result = _get_chart_preview_internal(preview_request)

                        if hasattr(preview_result, "content"):
                            previews[format_type] = preview_result.content
                    elif format_type == "url" and form_data_key:
                        # For preview-only mode, generate screenshot URL
                        mcp_base = get_mcp_service_url()
                        preview_url = (
                            f"{mcp_base}/screenshot/explore/{form_data_key}.png"
                        )

                        previews[format_type] = URLPreview(
                            preview_url=preview_url,
                            width=800,
                            height=600,
                            supports_interaction=False,
                        )

            except Exception as e:
                # Log warning but don't fail the entire request
                logger.warning(f"Preview generation failed: {e}")

        # Return enhanced data while maintaining backward compatibility
        result = {
            "chart": {
                "id": chart.id if chart else None,
                "slice_name": chart.slice_name
                if chart
                else generate_chart_name(request.config),
                "viz_type": chart.viz_type if chart else form_data.get("viz_type"),
                "url": explore_url,
                "uuid": str(chart.uuid) if chart and chart.uuid else None,
                "saved": request.save_chart,
            }
            if request.save_chart
            else {
                "id": None,
                "slice_name": generate_chart_name(request.config),
                "viz_type": form_data.get("viz_type"),
                "url": explore_url,
                "uuid": None,
                "saved": False,
            },
            "error": None,
            # Enhanced fields for better LLM integration
            "previews": previews,
            "capabilities": capabilities.model_dump() if capabilities else None,
            "semantics": semantics.model_dump() if semantics else None,
            "explore_url": explore_url,
            "form_data_key": form_data_key,
            "api_endpoints": {
                "data": f"{get_superset_base_url()}/api/v1/chart/{chart.id}/data/"
                if chart
                else None,
                "preview": f"{get_superset_base_url()}/api/v1/chart/{chart.id}/preview/"
                if chart
                else None,
                "export": f"{get_superset_base_url()}/api/v1/chart/{chart.id}/export/"
                if chart
                else None,
            }
            if chart
            else {},
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
            "error": f"Chart creation failed: {str(e)}",
            "performance": {
                "query_duration_ms": execution_time,
                "cache_status": "error",
                "optimization_suggestions": [],
            },
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }
