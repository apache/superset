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

"""MCP tool: get_compatible_metrics

Returns metrics compatible with the current dimension/metric selection.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.semantic_layer.schemas import (
    CompatibleMetricsResponse,
    GetCompatibleMetricsRequest,
    MetricInfo,
    SemanticLayerError,
)
from superset.mcp_service.utils.query_utils import validate_names

logger = logging.getLogger(__name__)


@tool(
    tags=["data", "semantic"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Get compatible metrics",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
@requires_data_model_metadata_access
async def get_compatible_metrics(
    request: GetCompatibleMetricsRequest,
    ctx: Context,
) -> CompatibleMetricsResponse | SemanticLayerError:
    """Return metrics compatible with the current dimension/metric selection.

    Used to progressively refine a query: given a set of already-selected
    metrics and dimensions, returns the additional metrics that can be
    combined without breaking the underlying semantic constraints.

    Provide exactly one of ``dataset_id`` (built-in) or ``view_id`` (external).

    For built-in datasets, all metrics from the dataset are considered
    compatible (SQL GROUP BY imposes no metric-level constraints). Unknown
    names in ``selected_metrics`` or ``selected_dimensions`` are rejected
    with a ValidationError.

    For external semantic views, delegates to the view's
    ``get_compatible_metrics`` implementation.

    Example:
    ```json
    {
        "selected_metrics": [],
        "selected_dimensions": ["region"],
        "view_id": 5
    }
    ```
    """
    await ctx.info(
        "Getting compatible metrics: dataset_id=%s, view_id=%s, "
        "metrics=%s, dims=%s"
        % (
            request.dataset_id,
            request.view_id,
            request.selected_metrics,
            request.selected_dimensions,
        )
    )

    if not user_can_view_data_model_metadata():
        return SemanticLayerError.create(
            error="You don't have permission to access dataset details for your role.",
            error_type=DATA_MODEL_METADATA_ERROR_TYPE,
        )

    if request.dataset_id is None and request.view_id is None:
        return SemanticLayerError.create(
            error="Provide either dataset_id (built-in) or view_id (external).",
            error_type="ValidationError",
        )
    if request.dataset_id is not None and request.view_id is not None:
        return SemanticLayerError.create(
            error="Provide only one of dataset_id or view_id, not both.",
            error_type="ValidationError",
        )

    try:
        # ------------------------------------------------------------------
        # Built-in dataset path
        # ------------------------------------------------------------------
        if request.dataset_id is not None:
            from sqlalchemy.orm import subqueryload

            from superset.connectors.sqla.models import SqlaTable
            from superset.daos.dataset import DatasetDAO

            with event_logger.log_context(action="mcp.get_compatible_metrics.builtin"):
                dataset: SqlaTable | None = DatasetDAO.find_by_id(
                    request.dataset_id,
                    query_options=[
                        subqueryload(SqlaTable.columns),
                        subqueryload(SqlaTable.metrics),
                    ],
                )

            if dataset is None:
                return SemanticLayerError.create(
                    error=f"No dataset found with id: {request.dataset_id}.",
                    error_type="NotFound",
                )

            valid_metrics = {m.metric_name for m in dataset.metrics}
            valid_columns = {c.column_name for c in dataset.columns}
            validation_errors = validate_names(
                request.selected_metrics,
                valid_metrics,
                "metric",
                list_valid_on_miss=True,
                full_list_hint="call list_metrics for the full list",
            )
            validation_errors.extend(
                validate_names(request.selected_dimensions, valid_columns, "dimension")
            )
            if validation_errors:
                return SemanticLayerError.create(
                    error="; ".join(validation_errors),
                    error_type="ValidationError",
                )

            # All metrics on a SQL dataset are always mutually compatible;
            # exclude ones already selected so clients don't get duplicate
            # suggestions for metrics they've already added.
            selected_metrics: set[str] = set(request.selected_metrics)
            compatible: list[MetricInfo] = [
                MetricInfo(
                    name=m.metric_name,
                    verbose_name=m.verbose_name or None,
                    description=m.description or None,
                    expression=m.expression or None,
                    d3format=m.d3format or None,
                    warning_text=m.warning_text or None,
                    source="builtin",
                    dataset_id=dataset.id,
                    dataset_name=dataset.table_name,
                )
                for m in dataset.metrics
                if m.metric_name not in selected_metrics
            ]

            await ctx.info("Compatible metrics (builtin): count=%d" % len(compatible))
            return CompatibleMetricsResponse(
                compatible_metrics=compatible,
                source="builtin",
            )

        # ------------------------------------------------------------------
        # External semantic view path
        # ------------------------------------------------------------------
        from superset.daos.semantic_layer import SemanticViewDAO
        from superset.exceptions import SupersetSecurityException
        from superset.semantic_layers.models import MetricMetadata, SemanticView

        view_id: int = request.view_id  # type: ignore[assignment]
        with event_logger.log_context(action="mcp.get_compatible_metrics.external"):
            view: SemanticView | None = SemanticViewDAO.find_by_id(view_id)

        if view is None:
            return SemanticLayerError.create(
                error=f"No semantic view found with id: {view_id}.",
                error_type="NotFound",
            )

        try:
            view.raise_for_access()
        except SupersetSecurityException as ex:
            return SemanticLayerError.create(
                error=str(ex.error.message),
                error_type="AccessDenied",
            )

        compatible_names: list[str] = view.get_compatible_metrics(
            request.selected_metrics,
            request.selected_dimensions,
        )

        # Enrich with full metric metadata
        all_metrics_map: dict[str, MetricMetadata] = {
            m.metric_name: m for m in view.metrics
        }
        compatible = [
            MetricInfo(
                name=name,
                description=(
                    all_metrics_map[name].description
                    if name in all_metrics_map
                    else None
                ),
                expression=(
                    all_metrics_map[name].expression
                    if name in all_metrics_map
                    else None
                ),
                source="external",
                view_id=view.id,
                view_name=view.name,
            )
            for name in compatible_names
        ]

        await ctx.info(
            "Compatible metrics (external view id=%d): count=%d"
            % (view.id, len(compatible))
        )
        return CompatibleMetricsResponse(
            compatible_metrics=compatible,
            source="external",
        )

    except Exception as exc:
        logger.exception(
            "Unexpected error in get_compatible_metrics: %s: %s",
            type(exc).__name__,
            str(exc),
        )
        await ctx.error("Unexpected error: %s: %s" % (type(exc).__name__, str(exc)))
        return SemanticLayerError.create(
            error=f"Internal error in get_compatible_metrics: {exc}",
            error_type="InternalError",
        )
