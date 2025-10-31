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

from fastmcp import Context

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import has_dataset_access, mcp_auth_hook
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    map_config_to_form_data,
)
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    GenerateChartRequest,
    GenerateChartResponse,
    PerformanceMetadata,
    URLPreview,
)
from superset.mcp_service.utils.url_utils import (
    get_chart_screenshot_url,
    get_superset_base_url,
)
from superset.utils import json

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
async def generate_chart(  # noqa: C901
    request: GenerateChartRequest, ctx: Context
) -> GenerateChartResponse:
    """Create and save a chart in Superset.

    IMPORTANT BEHAVIOR:
    - Charts ARE saved by default (save_chart=True)
    - Set save_chart=False for temporary preview only
    - LLM clients MUST display returned chart URL to users
    - Embed preview_url as image: ![Chart Preview](preview_url)

    VALIDATION:
    - 5-layer pipeline: Schema, business logic, dataset, Superset compatibility, runtime
    - XSS/SQL injection prevention
    - Column existence validation with fuzzy match suggestions
    - Aggregate function type compatibility checking

    Returns:
    - Chart ID and metadata (if saved)
    - Preview URL and explore URL
    - Detailed validation errors with suggestions
    """
    start_time = time.time()
    await ctx.info(
        "Starting chart generation: dataset_id=%s, chart_type=%s, "
        "save_chart=%s, preview_formats=%s"
        % (
            request.dataset_id,
            request.config.chart_type,
            request.save_chart,
            request.preview_formats,
        )
    )
    await ctx.debug(
        "Chart configuration details: config=%s" % (request.config.model_dump(),)
    )

    try:
        # Run comprehensive validation pipeline
        await ctx.report_progress(1, 5, "Running validation pipeline")
        await ctx.debug(
            "Validating chart request: dataset_id=%s" % (request.dataset_id,)
        )
        from superset.mcp_service.chart.validation import ValidationPipeline

        is_valid, parsed_request, validation_error = (
            ValidationPipeline.validate_request(request.model_dump())
        )
        if is_valid and parsed_request is not None:
            # Use the validated request going forward
            request = parsed_request
        if not is_valid:
            execution_time = int((time.time() - start_time) * 1000)
            assert validation_error is not None  # Type narrowing for mypy
            await ctx.error(
                "Chart validation failed: error=%s" % (validation_error.model_dump(),)
            )
            return GenerateChartResponse.model_validate(
                {
                    "chart": None,
                    "error": validation_error.model_dump(),
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

        # Map the simplified config to Superset's form_data format
        form_data = map_config_to_form_data(request.config)

        chart = None
        chart_id = None
        explore_url = None
        form_data_key = None

        # Save chart by default (unless save_chart=False)
        if request.save_chart:
            await ctx.report_progress(2, 5, "Creating chart in database")
            from superset.commands.chart.create import CreateChartCommand

            # Generate a chart name
            chart_name = generate_chart_name(request.config)
            await ctx.debug("Generated chart name: chart_name=%s" % (chart_name,))

            # Find the dataset to get its numeric ID
            from superset.daos.dataset import DatasetDAO

            await ctx.debug("Looking up dataset: dataset_id=%s" % (request.dataset_id,))
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
                # SECURITY FIX: Also validate permissions for numeric ID access
                if dataset and not has_dataset_access(dataset):
                    logger.warning(
                        "User %s attempted to access dataset %s without permission",
                        ctx.user.username if hasattr(ctx, "user") else "unknown",
                        dataset_id,
                    )
                    dataset = None  # Treat as not found
            else:
                # SECURITY FIX: Try UUID lookup with permission validation
                dataset = DatasetDAO.find_by_id(request.dataset_id, id_column="uuid")
                # Validate permissions for UUID-based access
                if dataset and not has_dataset_access(dataset):
                    logger.warning(
                        "User %s attempted access dataset %s via UUID",
                        ctx.user.username if hasattr(ctx, "user") else "unknown",
                        request.dataset_id,
                    )
                    dataset = None  # Treat as not found

            if not dataset:
                await ctx.error(
                    "Dataset not found: dataset_id=%s" % (request.dataset_id,)
                )
                from superset.mcp_service.common.error_schemas import (
                    ChartGenerationError,
                )

                execution_time = int((time.time() - start_time) * 1000)
                error = ChartGenerationError(
                    error_type="dataset_not_found",
                    message=f"Dataset not found: {request.dataset_id}",
                    details=(
                        f"No dataset found with identifier '{request.dataset_id}'. "
                        f"This could be an invalid ID/UUID or a permissions issue."
                    ),
                    suggestions=[
                        "Verify the dataset ID or UUID is correct",
                        "Check that you have access to this dataset",
                        "Use the list_datasets tool to find available datasets",
                        "If using UUID, ensure it's the correct format",
                    ],
                    error_code="DATASET_NOT_FOUND",
                )
                return GenerateChartResponse.model_validate(
                    {
                        "chart": None,
                        "error": error.model_dump(),
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

            try:
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

                # Ensure chart was created successfully before committing
                if not chart or not chart.id:
                    raise Exception("Chart creation failed - no chart ID returned")

                await ctx.info(
                    "Chart created successfully: chart_id=%s, chart_name=%s"
                    % (
                        chart.id,
                        chart.slice_name,
                    )
                )

            except Exception as e:
                logger.error("Chart creation failed: %s", e)
                await ctx.error("Chart creation failed: error=%s" % (str(e),))
                raise
            # Update explore URL to use saved chart
            explore_url = f"{get_superset_base_url()}/explore/?slice_id={chart.id}"
        else:
            await ctx.report_progress(2, 5, "Generating temporary chart preview")
            # Generate explore link with cached form_data for preview-only mode
            from superset.mcp_service.chart.chart_utils import generate_explore_link

            explore_url = generate_explore_link(request.dataset_id, form_data)
            await ctx.debug("Generated explore link: explore_url=%s" % (explore_url,))

            # Extract form_data_key from the explore URL
            if explore_url and "form_data_key=" in explore_url:
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
        await ctx.report_progress(3, 5, "Generating chart previews")
        previews = {}
        if request.generate_preview:
            await ctx.debug(
                "Generating previews: formats=%s" % (str(request.preview_formats),)
            )
            try:
                for format_type in request.preview_formats:
                    await ctx.debug(
                        "Processing preview format: format=%s" % (format_type,)
                    )
                    # Skip base64 format - we never return base64
                    if format_type == "base64":
                        logger.info("Skipping base64 format - not supported")
                        continue

                    if chart_id:
                        # For saved charts, use the existing preview generation
                        from superset.mcp_service.chart.tool.get_chart_preview import (
                            _get_chart_preview_internal,
                            GetChartPreviewRequest,
                        )

                        preview_request = GetChartPreviewRequest(
                            identifier=str(chart_id), format=format_type
                        )
                        preview_result = await _get_chart_preview_internal(
                            preview_request, ctx
                        )

                        if hasattr(preview_result, "content"):
                            previews[format_type] = preview_result.content
                    else:
                        # For preview-only mode (save_chart=false)
                        if format_type == "url" and form_data_key:
                            # Generate screenshot URL using centralized helper
                            from superset.mcp_service.utils.url_utils import (
                                get_explore_screenshot_url,
                            )

                            preview_url = get_explore_screenshot_url(form_data_key)
                            previews[format_type] = URLPreview(
                                preview_url=preview_url,
                                width=800,
                                height=600,
                                supports_interaction=False,
                            )
                        elif format_type in ["ascii", "table", "vega_lite"]:
                            # Generate preview from form data without saved chart
                            from superset.mcp_service.chart.preview_utils import (
                                generate_preview_from_form_data,
                            )

                            # Convert dataset_id to int only if it's numeric
                            if (
                                isinstance(request.dataset_id, str)
                                and request.dataset_id.isdigit()
                            ):
                                dataset_id_for_preview = int(request.dataset_id)
                            elif isinstance(request.dataset_id, int):
                                dataset_id_for_preview = request.dataset_id
                            else:
                                # Skip preview generation for non-numeric dataset IDs
                                logger.warning(
                                    "Cannot generate preview for non-numeric "
                                )
                                continue

                            preview_result = generate_preview_from_form_data(
                                form_data=form_data,
                                dataset_id=dataset_id_for_preview,
                                preview_format=format_type,
                            )

                            if not hasattr(preview_result, "error"):
                                previews[format_type] = preview_result

            except Exception as e:
                # Log warning but don't fail the entire request
                await ctx.warning("Preview generation failed: error=%s" % (str(e),))
                logger.warning("Preview generation failed: %s", e)

        # Return enhanced data while maintaining backward compatibility
        await ctx.report_progress(4, 5, "Building response")
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
            if request.save_chart and chart
            else None,
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
                "preview": get_chart_screenshot_url(chart.id) if chart else None,
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
        await ctx.report_progress(5, 5, "Chart generation completed")
        await ctx.info(
            "Chart generation completed successfully: chart_id=%s, execution_time_ms=%s"
            % (
                chart.id if chart else None,
                int((time.time() - start_time) * 1000),
            )
        )
        return GenerateChartResponse.model_validate(result)

    except Exception as e:
        await ctx.error(
            "Chart generation failed: error=%s, execution_time_ms=%s"
            % (
                str(e),
                int((time.time() - start_time) * 1000),
            )
        )
        from superset.mcp_service.utils.error_builder import ChartErrorBuilder

        logger.exception("Chart generation failed: %s", str(e))

        # Extract chart_type from different sources for better error context
        chart_type = "unknown"
        try:
            if hasattr(request, "config") and hasattr(request.config, "chart_type"):
                chart_type = request.config.chart_type
        except Exception as extract_error:
            # Ignore errors when extracting chart type for error context
            logger.debug("Could not extract chart type: %s", extract_error)

        execution_time = int((time.time() - start_time) * 1000)

        # Build standardized error response
        error = ChartErrorBuilder.build_error(
            error_type="chart_generation_error",
            template_key="generation_failed",
            template_vars={
                "reason": str(e),
                "dataset_id": str(request.dataset_id),
                "chart_type": chart_type,
            },
            error_code="CHART_GENERATION_FAILED",
        )

        return GenerateChartResponse.model_validate(
            {
                "chart": None,
                "error": error.model_dump(),
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
