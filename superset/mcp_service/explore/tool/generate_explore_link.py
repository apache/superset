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

import logging
from typing import Any, Dict

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.auth import has_dataset_access
from superset.mcp_service.chart.chart_helpers import extract_form_data_key_from_url
from superset.mcp_service.chart.chart_utils import (
    generate_explore_link as generate_url,
    get_table_chart_type_label,
    map_config_to_form_data,
)
from superset.mcp_service.chart.compile import validate_and_compile
from superset.mcp_service.chart.schemas import (
    GenerateExploreLinkRequest,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["explore"],
    class_permission_name="Explore",
    annotations=ToolAnnotations(
        title="Generate explore link",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
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
        # config is already a typed ChartConfig (validated by Pydantic)
        config = request.config

        await ctx.report_progress(1, 4, "Validating dataset exists")
        with event_logger.log_context(action="mcp.generate_explore_link.dataset_check"):
            from superset.daos.dataset import DatasetDAO

            dataset = None
            if isinstance(request.dataset_id, int) or (
                isinstance(request.dataset_id, str) and request.dataset_id.isdigit()
            ):
                dataset_id_int = (
                    int(request.dataset_id)
                    if isinstance(request.dataset_id, str)
                    else request.dataset_id
                )
                dataset = DatasetDAO.find_by_id(dataset_id_int)
            else:
                dataset = DatasetDAO.find_by_id(request.dataset_id, id_column="uuid")

            if not dataset:
                await ctx.warning(
                    "Dataset not found: dataset_id=%s" % (request.dataset_id,)
                )
                return {
                    "url": "",
                    "form_data": {},
                    "form_data_key": None,
                    "chart_type_label": None,
                    "error": (
                        f"Dataset not found: {request.dataset_id}. "
                        "Use list_datasets to find valid dataset IDs."
                    ),
                }

            if not has_dataset_access(dataset):
                logger.warning(
                    "User attempted to access dataset %s without permission",
                    request.dataset_id,
                )
                await ctx.warning(
                    "Dataset access denied: dataset_id=%s" % (request.dataset_id,)
                )
                return {
                    "url": "",
                    "form_data": {},
                    "form_data_key": None,
                    "chart_type_label": None,
                    "error": (
                        f"Dataset not found: {request.dataset_id}. "
                        "Use list_datasets to find valid dataset IDs."
                    ),
                }

        await ctx.report_progress(2, 4, "Converting configuration to form data")
        with event_logger.log_context(action="mcp.generate_explore_link.form_data"):
            # Normalize column names to match canonical dataset column names
            # This fixes case sensitivity issues (e.g., 'order_date' vs 'OrderDate')
            try:
                from superset.mcp_service.chart.validation.dataset_validator import (
                    DatasetValidator,
                )

                normalized_config = DatasetValidator.normalize_column_names(
                    config, request.dataset_id
                )
            except (ImportError, AttributeError, KeyError, ValueError, TypeError):
                normalized_config = config

            # Map config to form_data using shared utilities
            form_data = map_config_to_form_data(
                normalized_config, dataset_id=request.dataset_id
            )

        # Add datasource to form_data for consistency with generate_chart
        # Only set if not already present to avoid overwriting
        if "datasource" not in form_data:
            form_data["datasource"] = f"{request.dataset_id}__table"

        await ctx.debug(
            "Form data generated with keys: %s, has_viz_type=%s, has_datasource=%s"
            % (
                list(form_data.keys()),
                bool(form_data.get("viz_type")),
                bool(form_data.get("datasource")),
            )
        )

        # Tier-1 schema validation against the dataset (no DB roundtrip).
        # Catches references to non-existent columns/metrics with fuzzy
        # suggestions so the LLM can self-correct ("did you mean sum_boys?").
        with event_logger.log_context(action="mcp.generate_explore_link.validation"):
            compile_result = validate_and_compile(
                normalized_config,
                form_data,
                dataset,
                run_compile_check=False,
            )
        if not compile_result.success:
            await ctx.warning(
                "Explore link validation failed: error=%s" % (compile_result.error,)
            )
            error_payload: Dict[str, Any]
            if compile_result.error_obj is not None:
                error_payload = compile_result.error_obj.model_dump()
            else:
                error_payload = {
                    "error_type": "validation_error",
                    "message": "Explore link validation failed",
                    "details": compile_result.error or "",
                    "error_code": compile_result.error_code,
                    "suggestions": [],
                }
            return {
                "url": "",
                "form_data": form_data,
                "form_data_key": None,
                "chart_type_label": None,
                "error": error_payload,
            }

        await ctx.report_progress(3, 4, "Generating explore URL")
        with event_logger.log_context(
            action="mcp.generate_explore_link.url_generation"
        ):
            # Generate explore link using shared utilities
            explore_url = generate_url(
                dataset_id=request.dataset_id, form_data=form_data
            )

        # Extract form_data_key from the explore URL
        form_data_key = extract_form_data_key_from_url(explore_url)

        await ctx.report_progress(4, 4, "URL generation complete")
        await ctx.info(
            "Explore link generated successfully: url_length=%s, dataset_id=%s, "
            "form_data_key=%s"
            % (len(explore_url or ""), request.dataset_id, form_data_key)
        )

        return {
            "url": explore_url,
            "form_data": form_data,
            "form_data_key": form_data_key,
            "chart_type_label": get_table_chart_type_label(form_data.get("viz_type")),
            "error": None,
        }

    except Exception as e:
        await ctx.error(
            "Explore link generation failed for dataset_id=%s, chart_type=%s: %s: %s"
            % (
                request.dataset_id,
                request.config.chart_type,
                type(e).__name__,
                str(e),
            )
        )
        return {
            "url": "",
            "form_data": {},
            "form_data_key": None,
            "chart_type_label": None,
            "error": f"Failed to generate explore link: {str(e)}",
        }
