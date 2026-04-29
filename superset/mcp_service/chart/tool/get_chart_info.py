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
MCP tool: get_chart_info
"""

import logging

from fastmcp import Context
from sqlalchemy.orm import subqueryload
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.chart.chart_helpers import get_cached_form_data
from superset.mcp_service.chart.chart_utils import validate_chart_dataset
from superset.mcp_service.chart.schemas import (
    CHART_FORM_DATA_EXCLUDED_FIELD_NAMES,
    ChartError,
    ChartInfo,
    extract_filters_from_form_data,
    GetChartInfoRequest,
    sanitize_chart_info_for_llm_context,
    serialize_chart_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.privacy import (
    redact_chart_data_model_fields,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.utils import sanitize_for_llm_context

logger = logging.getLogger(__name__)


def _build_unsaved_chart_info(form_data_key: str) -> ChartInfo | ChartError:
    """Build a ChartInfo from cached form_data when no chart identifier exists."""
    from superset.utils import json as utils_json

    cached_form_data = get_cached_form_data(form_data_key)
    if not cached_form_data:
        return ChartError(
            error="No cached chart data found for form_data_key. "
            "The cache may have expired.",
            error_type="NotFound",
        )
    try:
        form_data = utils_json.loads(cached_form_data)
    except (TypeError, ValueError) as e:
        return ChartError(
            error=f"Failed to parse cached form_data: {e}",
            error_type="ParseError",
        )
    if not isinstance(form_data, dict):
        return ChartError(
            error="Cached form_data is not a valid JSON object.",
            error_type="ParseError",
        )
    return sanitize_chart_info_for_llm_context(
        ChartInfo(
            viz_type=form_data.get("viz_type"),
            datasource_name=form_data.get("datasource_name"),
            datasource_type=form_data.get("datasource_type"),
            filters=extract_filters_from_form_data(form_data),
            form_data=form_data,
            form_data_key=form_data_key,
            is_unsaved_state=True,
        )
    )


FORM_DATA_OVERRIDE_EXCLUDED_FIELD_NAMES = (
    CHART_FORM_DATA_EXCLUDED_FIELD_NAMES
    | frozenset({"cache_key", "database", "database_name", "schema"})
)


def _apply_unsaved_state_override(result: ChartInfo, form_data_key: str) -> None:
    """Override a ChartInfo's form_data with cached unsaved state."""
    from superset.utils import json as utils_json

    if cached_form_data := get_cached_form_data(form_data_key):
        try:
            result.form_data = utils_json.loads(cached_form_data)
            result.form_data_key = form_data_key
            result.is_unsaved_state = True

            # Update viz_type from cached form_data if present
            if result.form_data and "viz_type" in result.form_data:
                result.viz_type = result.form_data["viz_type"]

            # Update filters from cached form_data
            result.filters = extract_filters_from_form_data(result.form_data)
        except (TypeError, ValueError) as e:
            logger.warning(
                "Failed to parse cached form_data: %s. "
                "Using saved chart configuration.",
                e,
            )
    else:
        logger.warning(
            "form_data_key provided but no cached data found. "
            "The cache may have expired. Using saved chart configuration."
        )

    payload = result.model_dump(mode="python")
    if payload.get("filters") is not None:
        payload["filters"] = sanitize_for_llm_context(
            payload["filters"],
            field_path=("filters",),
        )
    if payload.get("form_data") is not None:
        payload["form_data"] = sanitize_for_llm_context(
            payload["form_data"],
            field_path=("form_data",),
            excluded_field_names=FORM_DATA_OVERRIDE_EXCLUDED_FIELD_NAMES,
        )
    sanitized = ChartInfo.model_validate(payload)
    result.filters = sanitized.filters
    result.form_data = sanitized.form_data


@tool(
    tags=["discovery"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get chart info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_chart_info(
    request: GetChartInfoRequest, ctx: Context
) -> ChartInfo | ChartError:
    """Get chart metadata by ID or UUID.

    IMPORTANT FOR LLM CLIENTS:
    - URL field links to the chart's explore page in Superset
    - Use numeric ID or UUID string (NOT chart name)
    - To find a chart ID, use the list_charts tool first
    - When form_data_key is provided, returns the unsaved chart configuration
      (what the user sees in Explore) instead of the saved version

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    Or with UUID:
    ```json
    {
        "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    }
    ```

    With unsaved state (form_data_key from Explore URL):
    ```json
    {
        "identifier": 123,
        "form_data_key": "abc123def456"
    }
    ```

    Returns chart details including name, type, and URL.
    """
    from superset.daos.chart import ChartDAO
    from superset.models.slice import Slice

    await ctx.info(
        "Retrieving chart information: identifier=%s, form_data_key=%s"
        % (request.identifier, request.form_data_key)
    )
    can_view_data_model_metadata = user_can_view_data_model_metadata()

    # Handle unsaved chart (form_data_key only, no identifier)
    if not request.identifier and request.form_data_key:
        with event_logger.log_context(
            action="mcp.get_chart_info.unsaved_chart_from_cache"
        ):
            await ctx.info(
                "No chart identifier provided - retrieving unsaved chart from cache: "
                "form_data_key=%s" % (request.form_data_key,)
            )
            result = _build_unsaved_chart_info(request.form_data_key)
            if not can_view_data_model_metadata:
                return redact_chart_data_model_fields(result)
            return result

    # At this point identifier must be set (validator ensures at least one
    # of identifier/form_data_key is provided, and the form_data_key-only
    # branch returned above).
    assert request.identifier is not None

    # Eager load tags to avoid N+1 queries during serialization.
    eager_options = [
        subqueryload(Slice.tags),
    ]

    with event_logger.log_context(action="mcp.get_chart_info.lookup"):
        tool = ModelGetInfoCore(
            dao_class=ChartDAO,
            output_schema=ChartInfo,
            error_schema=ChartError,
            serializer=serialize_chart_object,
            supports_slug=False,  # Charts don't have slugs
            logger=logger,
            query_options=eager_options,
        )

        result = tool.run_tool(request.identifier)

    if isinstance(result, ChartInfo):
        # If form_data_key is provided, override form_data with cached version
        if request.form_data_key:
            with event_logger.log_context(
                action="mcp.get_chart_info.unsaved_state_override"
            ):
                await ctx.info(
                    "Retrieving unsaved chart state from cache: form_data_key=%s"
                    % (request.form_data_key,)
                )
                _apply_unsaved_state_override(result, request.form_data_key)

        if not can_view_data_model_metadata:
            result = redact_chart_data_model_fields(result)

        await ctx.info(
            "Chart information retrieved successfully: chart_name=%s, "
            "is_unsaved_state=%s" % (result.slice_name, result.is_unsaved_state)
        )

        # Validate the chart's dataset is accessible
        if result.id:
            chart = ChartDAO.find_by_id(result.id)
            if chart:
                validation_result = validate_chart_dataset(chart, check_access=True)
                if not validation_result.is_valid:
                    await ctx.warning(
                        "Chart found but dataset is not accessible: %s"
                        % (validation_result.error,)
                    )
                    return ChartError(
                        error=validation_result.error
                        or "Chart's dataset is not accessible",
                        error_type="DatasetNotAccessible",
                    )
                # Log any warnings (e.g., virtual dataset warnings)
                for warning in validation_result.warnings:
                    await ctx.warning("Dataset warning: %s" % (warning,))
    else:
        await ctx.warning("Chart retrieval failed: error=%s" % (str(result),))

    return result
