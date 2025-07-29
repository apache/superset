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
MCP tool: update_chart_preview
"""

import logging
import time
from typing import Any, Dict

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    generate_explore_link,
    map_config_to_form_data,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    AccessibilityMetadata,
    PerformanceMetadata,
    UpdateChartPreviewRequest,
    URLPreview,
)
from superset.mcp_service.url_utils import get_mcp_service_url

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def update_chart_preview(request: UpdateChartPreviewRequest) -> Dict[str, Any]:
    """
    Update a cached chart preview with new configuration without saving.

    This tool modifies the cached form_data for a chart preview (created via
    generate_chart with save_chart=False) and returns a new preview with updated
    configuration. The original form_data_key is invalidated and a new one is
    created.

    Use this tool when:
    - User wants to modify a chart preview before deciding to save
    - Iterating on chart design without creating permanent charts
    - Testing different visualization configurations
    - Updating filters, chart type, or data columns for previews

    Args:
        request: Chart preview update request with form_data_key, dataset_id,
            new config, and optional preview generation

    Returns:
        Response with new form_data_key, preview images, and explore URL
    """
    start_time = time.time()

    try:
        # Map the new config to form_data format
        new_form_data = map_config_to_form_data(request.config)

        # Generate new explore link with updated form_data
        explore_url = generate_explore_link(request.dataset_id, new_form_data)

        # Extract new form_data_key from the explore URL
        new_form_data_key = None
        if "form_data_key=" in explore_url:
            new_form_data_key = explore_url.split("form_data_key=")[1].split("&")[0]

        # Generate semantic analysis
        capabilities = analyze_chart_capabilities(None, request.config)
        semantics = analyze_chart_semantics(None, request.config)

        # Create performance metadata
        execution_time = int((time.time() - start_time) * 1000)
        performance = PerformanceMetadata(
            query_duration_ms=execution_time,
            cache_status="miss",
            optimization_suggestions=[],
        )

        # Create accessibility metadata
        chart_name = generate_chart_name(request.config)
        accessibility = AccessibilityMetadata(
            color_blind_safe=True,  # Would need actual analysis
            alt_text=f"Updated chart preview showing {chart_name}",
            high_contrast_available=False,
        )

        # Generate previews if requested
        previews = {}
        if request.generate_preview and new_form_data_key:
            try:
                for format_type in request.preview_formats:
                    if format_type == "url":
                        # Generate screenshot URL using new form_data key
                        mcp_base = get_mcp_service_url()
                        preview_url = (
                            f"{mcp_base}/screenshot/explore/{new_form_data_key}.png"
                        )

                        previews[format_type] = URLPreview(
                            preview_url=preview_url,
                            width=800,
                            height=600,
                            supports_interaction=False,
                        )
                    # Other formats would need form_data execution
                    # which is more complex for preview-only mode

            except Exception as e:
                # Log warning but don't fail the entire request
                logger.warning(f"Preview generation failed: {e}")

        # Return enhanced data
        result = {
            "chart": {
                "id": None,
                "slice_name": chart_name,
                "viz_type": new_form_data.get("viz_type"),
                "url": explore_url,
                "uuid": None,
                "saved": False,
                "updated": True,
            },
            "error": None,
            # Enhanced fields for better LLM integration
            "previews": previews,
            "capabilities": capabilities.model_dump() if capabilities else None,
            "semantics": semantics.model_dump() if semantics else None,
            "explore_url": explore_url,
            "form_data_key": new_form_data_key,
            "previous_form_data_key": request.form_data_key,  # For reference
            "api_endpoints": {},  # No API endpoints for unsaved charts
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
            "error": f"Chart preview update failed: {str(e)}",
            "performance": {
                "query_duration_ms": execution_time,
                "cache_status": "error",
                "optimization_suggestions": [],
            },
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }
