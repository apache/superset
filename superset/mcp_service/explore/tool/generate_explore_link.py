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
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.dataset import DatasetDAO
from superset.extensions import event_logger
from superset.mcp_service.auth import has_dataset_access
from superset.mcp_service.chart.chart_helpers import extract_form_data_key_from_url
from superset.mcp_service.chart.chart_utils import (
    generate_explore_link as generate_url,
    get_table_chart_type_label,
    map_config_to_form_data,
)
from superset.mcp_service.chart.compile import validate_and_compile
from superset.mcp_service.chart.datasource_resolver import (
    ChartDatasource,
    resolve_semantic_view,
    validate_semantic_view_config,
    validate_semantic_view_form_data,
    view_not_found_error,
)
from superset.mcp_service.chart.schemas import (
    GenerateExploreLinkRequest,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)
from superset.mcp_service.explore.schemas import GenerateExploreLinkResponse
from superset.mcp_service.utils.url_utils import (
    extract_permalink_key_from_url,
    get_superset_base_url,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["explore"],
    class_permission_name="Explore",
    annotations=ToolAnnotations(
        title="Generate explore link",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def generate_explore_link(  # noqa: C901
    request: GenerateExploreLinkRequest, ctx: Context
) -> GenerateExploreLinkResponse:
    """Generate explore URL for interactive visualization.

    PREFERRED TOOL for most visualization requests.

    Use this tool for:
    - "Show me a chart of [data]"
    - "Visualize [data]"
    - General data exploration
    - When user wants to SEE data visually
    - Opening a dataset in Explore without a preconfigured chart (omit config)

    IMPORTANT:
    - Use numeric dataset ID or UUID (NOT schema.table_name format)
    - When config is provided, MUST include chart_type (e.g. 'xy' or 'table')
    - Omit config entirely to return a default explore URL for the dataset
    - To open a semantic view (semantic layer) pass view_id instead of
      dataset_id (exactly one of the two). Semantic-view charts may only use
      the view's saved metrics ({"name": "<metric>", "saved_metric": true})
      and saved dimensions; ad-hoc aggregates and SQL expressions are rejected.

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

    Or with no config to simply open the dataset in Explore:
    ```json
    {"dataset_id": 123}
    ```

    Or a semantic view (saved metric + saved dimension):
    ```json
    {
        "view_id": 1,
        "config": {
            "chart_type": "xy",
            "x": {"name": "metric_time"},
            "y": [{"name": "revenue", "saved_metric": true}],
            "kind": "line"
        }
    }
    ```

    Better UX because:
    - Users can interact with chart before saving
    - Easy to modify parameters instantly
    - No database clutter from exploration

    Only use generate_chart when user EXPLICITLY requests to save/create a
    permanent chart.

    Returns explore URL for immediate use. The URL scheme matches the configured
    instance URL (HTTPS in production/staging, HTTP in local development).
    """
    chart_type = request.config.chart_type if request.config else "none"
    await ctx.info(
        "Generating explore link for dataset_id=%s, chart_type=%s"
        % (request.dataset_id, chart_type)
    )
    await ctx.debug(
        "Configuration details: use_cache=%s, force_refresh=%s, cache_form_data=%s"
        % (request.use_cache, request.force_refresh, request.cache_form_data)
    )

    try:
        if request.view_id is not None:
            return await _generate_for_semantic_view(request, ctx)
        assert request.dataset_id is not None

        await ctx.report_progress(1, 4, "Validating dataset exists")
        with event_logger.log_context(action="mcp.generate_explore_link.dataset_check"):
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
                return GenerateExploreLinkResponse(
                    url="",
                    form_data={},
                    permalink_key=None,
                    form_data_key=None,
                    chart_type_label=None,
                    error=ChartGenerationError(
                        error_type="dataset_not_found",
                        error_code="MCP_EXPLORE_DATASET_NOT_FOUND",
                        message=f"Dataset not found: {request.dataset_id}.",
                        details=(
                            f"No dataset found with identifier "
                            f"'{request.dataset_id}'. Use list_datasets to "
                            "find valid dataset IDs."
                        ),
                        suggestions=[
                            "Verify the dataset ID or UUID is correct",
                            "Use the list_datasets tool to find available datasets",
                        ],
                    ),
                    success=False,
                )

            if not has_dataset_access(dataset):
                logger.warning(
                    "User attempted to access dataset %s without permission",
                    request.dataset_id,
                )
                await ctx.warning(
                    "Dataset access denied: dataset_id=%s" % (request.dataset_id,)
                )
                # User-facing message stays generic to avoid leaking dataset
                # existence; error_type lets programmatic callers distinguish.
                return GenerateExploreLinkResponse(
                    url="",
                    form_data={},
                    permalink_key=None,
                    form_data_key=None,
                    chart_type_label=None,
                    error=ChartGenerationError(
                        error_type="permission_denied",
                        # Same code as the not-found path: the user-visible
                        # message is intentionally indistinguishable so
                        # access policy isn't disclosed; ``error_type`` is
                        # the programmatic distinguisher.
                        error_code="MCP_EXPLORE_DATASET_NOT_FOUND",
                        message=f"Dataset not found: {request.dataset_id}.",
                        details=(
                            f"No dataset found with identifier "
                            f"'{request.dataset_id}'. Use list_datasets to "
                            "find valid dataset IDs."
                        ),
                        suggestions=[
                            "Check that you have access to this dataset",
                            "Use the list_datasets tool to find available datasets",
                        ],
                    ),
                    success=False,
                )

        # When no config is provided, return a default explore URL that opens
        # the dataset in Superset without a preconfigured chart.
        if request.config is None:
            await ctx.report_progress(4, 4, "URL generation complete")
            base_url = get_superset_base_url()
            default_url = (
                f"{base_url}/explore/?datasource_type=table&datasource_id={dataset.id}"
            )
            await ctx.info(
                "Default explore link generated: dataset_id=%s" % (request.dataset_id,)
            )
            return GenerateExploreLinkResponse(
                url=default_url,
                form_data={},
                permalink_key=None,
                form_data_key=None,
                chart_type_label=None,
                error=None,
                success=True,
            )

        await ctx.report_progress(2, 4, "Converting configuration to form data")
        with event_logger.log_context(action="mcp.generate_explore_link.form_data"):
            # config is already a typed ChartConfig (validated by Pydantic)
            config = request.config

            # Normalize column names to match canonical dataset column names
            # This fixes case sensitivity issues (e.g., 'order_date' vs 'OrderDate')
            try:
                normalized_config = DatasetValidator.normalize_column_names(
                    config, request.dataset_id
                )
            except (
                ImportError,
                AttributeError,
                KeyError,
                ValueError,
                TypeError,
            ) as norm_err:
                logger.warning(
                    "Column normalization failed for dataset_id=%s; falling back "
                    "to caller-supplied config. %s: %s",
                    request.dataset_id,
                    type(norm_err).__name__,
                    norm_err,
                )
                await ctx.warning(
                    "Column normalization failed for dataset_id=%s; using config "
                    "as-supplied. Chart may behave unexpectedly if column names "
                    "differ in case." % (request.dataset_id,)
                )
                normalized_config = config

            # Map config to form_data using shared utilities
            form_data = map_config_to_form_data(
                normalized_config, dataset_id=request.dataset_id
            )

        # Add datasource to form_data for consistency with generate_chart
        # Only set if not already present to avoid overwriting
        if "datasource" not in form_data:
            form_data["datasource"] = f"{dataset.id}__table"

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
                run_compile_check=normalized_config.chart_type == "gauge",
            )
        if not compile_result.success:
            await ctx.warning(
                "Explore link validation failed: error=%s" % (compile_result.error,)
            )
            if compile_result.error_obj is not None:
                error_payload = compile_result.error_obj
            else:
                error_payload = ChartGenerationError(
                    error_type="validation_error",
                    message="Explore link validation failed",
                    details=compile_result.error or "",
                    error_code=compile_result.error_code,
                )
            return GenerateExploreLinkResponse(
                url="",
                form_data=form_data,
                permalink_key=None,
                form_data_key=None,
                chart_type_label=None,
                error=error_payload,
                success=False,
            )

        await ctx.report_progress(3, 4, "Generating explore URL")
        with event_logger.log_context(
            action="mcp.generate_explore_link.url_generation"
        ):
            # Generate explore link using shared utilities
            explore_url = generate_url(
                dataset_id=request.dataset_id, form_data=form_data
            )

        # Extract permalink_key (durable) or fall back to form_data_key (ephemeral)
        permalink_key = extract_permalink_key_from_url(explore_url)
        form_data_key = (
            extract_form_data_key_from_url(explore_url) if not permalink_key else None
        )

        await ctx.report_progress(4, 4, "URL generation complete")
        await ctx.info(
            "Explore link generated successfully: url_length=%s, dataset_id=%s, "
            "permalink_key=%s, form_data_key=%s"
            % (len(explore_url or ""), request.dataset_id, permalink_key, form_data_key)
        )

        return GenerateExploreLinkResponse(
            url=explore_url,
            form_data=form_data,
            permalink_key=permalink_key,
            form_data_key=form_data_key,
            chart_type_label=get_table_chart_type_label(form_data.get("viz_type")),
            error=None,
            success=True,
        )

    except Exception as e:
        await ctx.error(
            "Explore link generation failed for dataset_id=%s, chart_type=%s: %s: %s"
            % (
                request.dataset_id,
                chart_type,
                type(e).__name__,
                str(e),
            )
        )
        # ``details`` intentionally omits ``str(e)`` so internal info
        # (file paths, schema names) isn't echoed to the MCP response.
        # The raw exception is already captured in the server-side log
        # above via ``ctx.error``.
        return GenerateExploreLinkResponse(
            url="",
            form_data={},
            permalink_key=None,
            form_data_key=None,
            chart_type_label=None,
            error=ChartGenerationError(
                error_type="generation_failed",
                error_code="MCP_EXPLORE_GENERATION_FAILED",
                message="Failed to generate explore link",
                details=(
                    "An unexpected error occurred; check server logs for details."
                ),
            ),
            success=False,
        )


async def _generate_for_semantic_view(
    request: GenerateExploreLinkRequest, ctx: Context
) -> GenerateExploreLinkResponse:
    """Explore link for a semantic view target (``request.view_id``)."""
    assert request.view_id is not None
    await ctx.report_progress(1, 4, "Resolving semantic view")
    target: ChartDatasource | None = resolve_semantic_view(request.view_id)
    if target is None:
        await ctx.warning("Semantic view not found: view_id=%s" % (request.view_id,))
        return GenerateExploreLinkResponse(
            url="",
            form_data={},
            permalink_key=None,
            form_data_key=None,
            chart_type_label=None,
            error=view_not_found_error(request.view_id),
            success=False,
        )

    base_url: str = get_superset_base_url()
    if request.config is None:
        await ctx.report_progress(4, 4, "URL generation complete")
        return GenerateExploreLinkResponse(
            url=f"{base_url}{target.explore_url_path}",
            form_data={},
            permalink_key=None,
            form_data_key=None,
            chart_type_label=None,
            error=None,
            success=True,
        )

    await ctx.report_progress(2, 4, "Validating configuration against the view")
    is_valid: bool
    error: ChartGenerationError | None
    _context: DatasetContext
    is_valid, error, _context = validate_semantic_view_config(request.config, target)
    if not is_valid:
        await ctx.warning(
            "Semantic view chart validation failed: %s"
            % (error.model_dump() if error else None,)
        )
        return GenerateExploreLinkResponse(
            url="",
            form_data={},
            permalink_key=None,
            form_data_key=None,
            chart_type_label=None,
            error=error,
            success=False,
        )

    await ctx.report_progress(3, 4, "Converting configuration to form data")
    # No dataset id here: the plugins' dataset-backed temporal checks fall back
    # to their permissive defaults, and the view's own validation ran above.
    form_data: dict[str, Any] = map_config_to_form_data(request.config, dataset_id=None)
    form_data.pop("_mcp_warnings", None)
    form_data["datasource"] = target.form_data_datasource
    error = validate_semantic_view_form_data(form_data, target)
    if error is not None:
        return GenerateExploreLinkResponse(
            url="",
            form_data={},
            permalink_key=None,
            form_data_key=None,
            chart_type_label=None,
            error=error,
            success=False,
        )

    await ctx.report_progress(4, 4, "Generating explore URL")
    url: str = generate_url(
        target.id, form_data, datasource_type=target.datasource_type.value
    )
    permalink_key: str | None = extract_permalink_key_from_url(url)
    form_data_key: str | None = (
        extract_form_data_key_from_url(url) if not permalink_key else None
    )
    await ctx.info(
        "Explore link generated for semantic view %s (%s)" % (target.id, target.name)
    )
    return GenerateExploreLinkResponse(
        url=url,
        form_data=form_data,
        permalink_key=permalink_key,
        form_data_key=form_data_key,
        chart_type_label=(
            get_table_chart_type_label(form_data.get("viz_type"))
            if request.config.chart_type == "table"
            else None
        ),
        error=None,
        success=True,
    )
