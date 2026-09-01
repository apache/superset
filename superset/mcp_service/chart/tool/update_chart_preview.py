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
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.exceptions import OAuth2Error, OAuth2RedirectError, SupersetException
from superset.extensions import event_logger
from superset.mcp_service.auth import has_dataset_access
from superset.mcp_service.chart.chart_helpers import extract_form_data_key_from_url
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    generate_explore_link,
    map_config_to_form_data,
    merge_form_data_for_update,
    merge_interactive_pivot_ui_config,
    merge_table_column_config,
)
from superset.mcp_service.chart.compile import validate_and_compile
from superset.mcp_service.chart.preview_utils import (
    generate_preview_from_form_data,
    SUPPORTED_FORM_DATA_PREVIEW_FORMATS,
)
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    ChartError,
    PerformanceMetadata,
    UpdateChartPreviewRequest,
)
from superset.mcp_service.chart.sunburst import (
    canonicalize_sunburst_operation_fields,
    normalize_sunburst_form_data_references,
)
from superset.mcp_service.utils.oauth2_utils import (
    build_oauth2_redirect_message,
    OAUTH2_CONFIG_ERROR_MESSAGE,
)
from superset.utils import json as utils_json

logger = logging.getLogger(__name__)

INVALID_FORM_DATA_KEY_WARNING = (
    "Previous cached chart state could not be loaded from the previous "
    "form_data_key. The preview was generated from the supplied "
    "configuration only; the previous form_data_key may be invalid or "
    "expired."
)


def _validation_error_result(compile_result: Any) -> Dict[str, Any]:
    """Build the structured response used for preview validation failures."""
    if compile_result.error_obj is not None:
        error_payload = compile_result.error_obj.model_dump()
    else:
        error_payload = {
            "error_type": "validation_error",
            "message": "Chart preview validation failed",
            "details": compile_result.error or "",
            "error_code": compile_result.error_code,
            "suggestions": [],
        }
    return {
        "chart": None,
        "error": error_payload,
        "success": False,
        "schema_version": "2.0",
        "api_version": "v1",
    }


def _find_dataset(dataset_id: int | str) -> Any | None:
    """Look up a dataset by numeric ID or UUID."""
    from superset.daos.dataset import DatasetDAO

    if isinstance(dataset_id, int) or (
        isinstance(dataset_id, str) and dataset_id.isdigit()
    ):
        dataset = DatasetDAO.find_by_id(int(dataset_id))
    else:
        dataset = DatasetDAO.find_by_id(dataset_id, id_column="uuid")

    return dataset


def _get_previous_form_data(form_data_key: str) -> dict[str, Any] | None:
    """Retrieve the previously cached form_data."""
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
                return cached_data
    except (KeyError, ValueError, TypeError, CommandException):
        logger.debug("Could not retrieve previous form_data from cache")
    return None


@tool(
    tags=["mutate"],
    class_permission_name="Chart",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update chart preview",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def update_chart_preview(  # noqa: C901
    request: UpdateChartPreviewRequest, ctx: Context
) -> Dict[str, Any]:
    """Update cached chart preview without saving.

    IMPORTANT:
    - Modifies cached form_data from generate_chart (save_chart=False)
    - Original form_data_key (when provided) is invalidated, new one returned
    - LLM clients MUST display explore_url to users

    Use when:
    - Creating a fresh preview from config + dataset_id (omit form_data_key)
    - Modifying preview before deciding to save
    - Iterating on chart design without creating permanent charts
    - Testing different configurations

    Sunburst uses chart_type="sunburst" and the exact frontend viz_type
    ``sunburst_v2``. Supply hierarchy plus metric; omitted cached presentation
    and filter controls are preserved, while explicit false/None/[] values win.

    Returns new form_data_key, preview images, and explore URL. The explore_url
    scheme matches the configured instance URL (HTTPS in production/staging,
    HTTP in local development).
    """
    start_time = time.time()

    try:
        # config is already a typed ChartConfig (validated by Pydantic)
        config = request.config

        # Validate dataset exists and user has access
        with event_logger.log_context(action="mcp.update_chart_preview.dataset_lookup"):
            dataset = _find_dataset(request.dataset_id)

            if dataset is not None and not has_dataset_access(dataset):
                return {
                    "chart": None,
                    "error": {
                        "error_type": "DatasetNotAccessible",
                        "message": f"Dataset not found: {request.dataset_id}",
                        "details": (
                            f"Dataset {request.dataset_id} is missing or inaccessible."
                        ),
                    },
                    "success": False,
                    "schema_version": "2.0",
                    "api_version": "v1",
                }

            if not dataset:
                return {
                    "chart": None,
                    "error": {
                        "error_type": "dataset_not_found",
                        "message": (f"Dataset not found: {request.dataset_id}"),
                        "details": (
                            f"No dataset found with identifier "
                            f"'{request.dataset_id}'. This could "
                            f"be an invalid ID/UUID or a "
                            f"permissions issue."
                        ),
                        "suggestions": [
                            "Verify the dataset ID or UUID",
                            "Check dataset access permissions",
                            "Use list_datasets to find available datasets",
                        ],
                    },
                    "success": False,
                    "schema_version": "2.0",
                    "api_version": "v1",
                }

        with event_logger.log_context(action="mcp.update_chart_preview.form_data"):
            from superset.mcp_service.chart.validation.dataset_validator import (
                build_dataset_context_from_orm,
                DatasetValidator,
            )

            dataset_context = build_dataset_context_from_orm(dataset)
            static_result = validate_and_compile(
                config, {}, dataset, run_compile_check=False
            )
            if not static_result.success:
                return _validation_error_result(static_result)
            config = DatasetValidator.normalize_column_names(
                config,
                dataset.id,
                dataset_context=dataset_context,
            )

            # Map the new config to form_data format
            # Pass dataset_id to enable column type checking
            new_form_data = map_config_to_form_data(
                config, dataset_id=request.dataset_id
            )
            new_form_data.pop("_mcp_warnings", None)
            new_form_data = canonicalize_sunburst_operation_fields(
                new_form_data,
                datasource_id=dataset.id,
            )
            warnings: list[str] = []
            previous_form_data: dict[str, Any] | None = None

            if request.form_data_key:
                previous_form_data = _get_previous_form_data(request.form_data_key)
                if previous_form_data is None:
                    warnings.append(INVALID_FORM_DATA_KEY_WARNING)

            if previous_form_data:
                merge_table_column_config(previous_form_data, new_form_data)
                merge_interactive_pivot_ui_config(previous_form_data, new_form_data)
                new_form_data = merge_form_data_for_update(
                    previous_form_data, new_form_data, config
                )
                if getattr(config, "filters", None) == []:
                    new_form_data.pop("adhoc_filters", None)

            # This tool owns an unsaved cache entry, not a chart update target.
            # Rebind datasource state to the authorized dataset and remove any
            # native/cached chart identity before compile and recaching.
            new_form_data = canonicalize_sunburst_operation_fields(
                new_form_data,
                datasource_id=dataset.id,
            )

            if (
                new_form_data.get("viz_type") == "sunburst_v2"
                and dataset_context is not None
            ):
                new_form_data = normalize_sunburst_form_data_references(
                    new_form_data, dataset_context
                )

            compile_result = validate_and_compile(
                config, new_form_data, dataset, run_compile_check=True
            )
            if not compile_result.success:
                logger.warning(
                    "update_chart_preview validation failed: %s",
                    compile_result.error,
                )
                return _validation_error_result(compile_result)

            # Generate new explore link with updated form_data. This preview flow
            # extracts and re-caches the form_data_key, so force that URL shape.
            explore_url = generate_explore_link(
                request.dataset_id, new_form_data, prefer_permalink=False
            )

        # Extract new form_data_key from the explore URL
        new_form_data_key = extract_form_data_key_from_url(explore_url)
        if not new_form_data_key:
            return {
                "chart": None,
                "error": {
                    "error_type": "PreviewError",
                    "message": "Failed to generate preview: missing form_data_key",
                    "details": "The explore URL did not contain a form_data_key",
                },
                "success": False,
                "schema_version": "2.0",
                "api_version": "v1",
            }

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

        previews: Dict[str, Any] = {}
        preview_errors: Dict[str, Any] = {}
        if request.generate_preview:
            try:
                with event_logger.log_context(
                    action="mcp.update_chart_preview.preview"
                ):
                    for format_type in request.preview_formats:
                        # URL previews are represented by explore_url/chart.url.
                        # Screenshot-based previews are not supported.
                        if format_type not in SUPPORTED_FORM_DATA_PREVIEW_FORMATS:
                            continue

                        preview_result = generate_preview_from_form_data(
                            form_data=new_form_data,
                            dataset_id=dataset.id,
                            preview_format=format_type,
                        )

                        if isinstance(preview_result, ChartError):
                            preview_errors[format_type] = preview_result.model_dump(
                                mode="json"
                            )
                            logger.warning(
                                "Preview '%s' failed: %s",
                                format_type,
                                preview_result.error,
                            )
                        else:
                            previews[format_type] = (
                                preview_result.model_dump(mode="json")
                                if hasattr(preview_result, "model_dump")
                                else preview_result
                            )

            except (CommandException, ValueError, KeyError) as e:
                logger.warning("Preview generation failed: %s", e)

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
            "preview_errors": preview_errors,
            "capabilities": capabilities.model_dump() if capabilities else None,
            "semantics": semantics.model_dump() if semantics else None,
            "explore_url": explore_url,
            "form_data_key": new_form_data_key,
            "previous_form_data_key": request.form_data_key,  # For reference
            "warnings": warnings,
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
    except (
        SupersetException,
        CommandException,
        SQLAlchemyError,
        KeyError,
        ValueError,
        TypeError,
        AttributeError,
    ) as e:
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
