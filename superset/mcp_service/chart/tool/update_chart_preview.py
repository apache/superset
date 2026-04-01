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

from fastmcp import Context
from mcp.types import ToolAnnotations

from superset.exceptions import OAuth2Error, OAuth2RedirectError
from superset.extensions import event_logger
from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    generate_explore_link,
    map_config_to_form_data,
)
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    parse_chart_config,
    PerformanceMetadata,
    UpdateChartPreviewRequest,
)
from superset.mcp_service.utils.oauth2_utils import (
    build_oauth2_redirect_message,
    OAUTH2_CONFIG_ERROR_MESSAGE,
)
from superset.utils import json as utils_json

logger = logging.getLogger(__name__)


def _get_old_adhoc_filters(form_data_key: str) -> list[Dict[str, Any]] | None:
    """Retrieve adhoc_filters from the previously cached form_data."""
    from superset.commands.exceptions import CommandException
    from superset.commands.explore.form_data.get import GetFormDataCommand
    from superset.commands.explore.form_data.parameters import CommandParameters

    try:
        cmd_params = CommandParameters(key=form_data_key)
        cached_data = GetFormDataCommand(cmd_params).run()
        if cached_data:
            if isinstance(cached_data, str):
                cached_data = utils_json.loads(cached_data)
            if isinstance(cached_data, dict):
                adhoc_filters = cached_data.get("adhoc_filters")
                if adhoc_filters:
                    return adhoc_filters
    except (KeyError, ValueError, TypeError, CommandException):
        logger.debug("Could not retrieve old form_data for filter preservation")
    return None


@mcp.tool(
    tags=["mutate"],
    annotations=ToolAnnotations(
        title="Update chart preview",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
@mcp_auth_hook(class_permission_name="Chart", method_permission_name="write")
def update_chart_preview(
    request: UpdateChartPreviewRequest, ctx: Context
) -> Dict[str, Any]:
    """Update cached chart preview without saving.

    IMPORTANT:
    - Modifies cached form_data from generate_chart (save_chart=False)
    - Original form_data_key is invalidated, new one returned
    - LLM clients MUST display explore_url to users

    Use when:
    - Modifying preview before deciding to save
    - Iterating on chart design without creating permanent charts
    - Testing different configurations

    Returns new form_data_key, preview images, and explore URL.
    """
    start_time = time.time()

    try:
        # Parse the raw config dict into a typed ChartConfig
        config = parse_chart_config(request.config)

        with event_logger.log_context(action="mcp.update_chart_preview.form_data"):
            # Map the new config to form_data format
            # Pass dataset_id to enable column type checking
            new_form_data = map_config_to_form_data(
                config, dataset_id=request.dataset_id
            )
            new_form_data.pop("_mcp_warnings", None)

            # Preserve adhoc filters from the previous cached form_data
            # when the new config doesn't explicitly specify filters
            if (
                getattr(request.config, "filters", None) is None
                and request.form_data_key
            ):
                old_adhoc_filters = _get_old_adhoc_filters(request.form_data_key)
                if old_adhoc_filters:
                    new_form_data["adhoc_filters"] = old_adhoc_filters

            # Generate new explore link with updated form_data
            explore_url = generate_explore_link(request.dataset_id, new_form_data)

        # Extract new form_data_key from the explore URL
        new_form_data_key = None
        if "form_data_key=" in explore_url:
            new_form_data_key = explore_url.split("form_data_key=")[1].split("&")[0]

        with event_logger.log_context(action="mcp.update_chart_preview.metadata"):
            # Generate semantic analysis
            capabilities = analyze_chart_capabilities(None, config)
            semantics = analyze_chart_semantics(None, config)

        # Create performance metadata
        execution_time = int((time.time() - start_time) * 1000)
        performance = PerformanceMetadata(
            query_duration_ms=execution_time,
            cache_status="miss",
            optimization_suggestions=[],
        )

        # Create accessibility metadata
        chart_name = generate_chart_name(config)
        accessibility = AccessibilityMetadata(
            color_blind_safe=True,  # Would need actual analysis
            alt_text=f"Updated chart preview showing {chart_name}",
            high_contrast_available=False,
        )

        # Note: Screenshot-based previews are not supported.
        # Use the explore_url to view the chart interactively.
        previews: Dict[str, Any] = {}

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

    except OAuth2RedirectError as ex:
        logger.warning(
            "Chart preview update requires OAuth authentication: form_data_key=%s",
            request.form_data_key,
        )
        return {
            "chart": None,
            "error": build_oauth2_redirect_message(ex),
            "success": False,
        }
    except OAuth2Error:
        logger.warning(
            "OAuth2 configuration error: form_data_key=%s", request.form_data_key
        )
        return {
            "chart": None,
            "error": OAUTH2_CONFIG_ERROR_MESSAGE,
            "success": False,
        }
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
