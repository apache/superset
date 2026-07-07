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

"""MCP tool: list_metrics

Unified metric discovery across built-in datasets and external semantic views.
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.orm import Query
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.dataset import DatasetDAO
from superset.daos.semantic_layer import SemanticViewDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, event_logger
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.semantic_layer.schemas import (
    DimensionInfo,
    ListMetricsRequest,
    MetricInfo,
    MetricList,
    SemanticLayerError,
)
from superset.semantic_layers.models import ColumnMetadata, SemanticView

logger = logging.getLogger(__name__)


def _matches_search(text: str | None, search: str) -> bool:
    if not text:
        return False
    return search.lower() in text.lower()


def _builtin_compatible_dims(dataset: Any) -> list[DimensionInfo]:
    """Return groupby-enabled columns as compatible dimensions for a built-in metric."""
    return [
        DimensionInfo(
            name=col.column_name,
            verbose_name=col.verbose_name or None,
            description=col.description or None,
            type=col.type or None,
            is_dttm=bool(col.is_dttm),
            groupby=bool(col.groupby),
            filterable=bool(col.filterable),
            source="builtin",
        )
        for col in dataset.columns
        if col.groupby
    ]


def _collect_builtin_metrics(request: ListMetricsRequest) -> list[MetricInfo]:
    """Collect metrics from built-in SqlaTable datasets."""
    from sqlalchemy.orm import subqueryload

    from superset.connectors.sqla.models import SqlaTable

    with event_logger.log_context(action="mcp.list_metrics.builtin_query"):
        if request.dataset_id is not None:
            from sqlalchemy.orm import subqueryload

            from superset.connectors.sqla.models import SqlaTable

            dataset: SqlaTable | None = DatasetDAO.find_by_id(
                request.dataset_id,
                query_options=[
                    subqueryload(SqlaTable.columns),
                    subqueryload(SqlaTable.metrics),
                ],
            )
            datasets: list[SqlaTable] = [dataset] if dataset else []
        else:
            from sqlalchemy.orm import subqueryload

            from superset.connectors.sqla.models import SqlaTable

            # Use _apply_base_filter with explicit eager loading to avoid
            # N+1 queries when iterating dataset.metrics / dataset.columns.
            query: Query = db.session.query(SqlaTable).options(
                subqueryload(SqlaTable.columns),
                subqueryload(SqlaTable.metrics),
            )
            datasets = DatasetDAO._apply_base_filter(query).all()

    results: list[MetricInfo] = []
    for dataset in datasets:
        compat_dims = (
            _builtin_compatible_dims(dataset)
            if request.include_compatible_dimensions
            else []
        )
        for metric in dataset.metrics:
            name = metric.metric_name or ""
            desc = metric.description or ""
            if request.search and not (
                _matches_search(name, request.search)
                or _matches_search(desc, request.search)
            ):
                continue
            results.append(
                MetricInfo(
                    name=name,
                    verbose_name=metric.verbose_name or None,
                    description=desc or None,
                    expression=metric.expression or None,
                    d3format=metric.d3format or None,
                    warning_text=metric.warning_text or None,
                    source="builtin",
                    dataset_id=dataset.id,
                    dataset_name=dataset.table_name,
                    compatible_dimensions=compat_dims,
                )
            )
    return results


async def _collect_external_metrics(
    request: ListMetricsRequest,
    ctx: Context,
) -> list[MetricInfo]:
    """Collect metrics from external SemanticView models."""
    with event_logger.log_context(action="mcp.list_metrics.external_query"):
        if request.view_id is not None:
            view: SemanticView | None = SemanticViewDAO.find_by_id(request.view_id)
            views: list[SemanticView] = [view] if view else []
        else:
            # find_accessible filters at SQL level, avoiding a per-row
            # Python permission check and the audit noise of raise_for_access.
            views = SemanticViewDAO.find_accessible()

    await ctx.debug("Found %d semantic views to scan for metrics" % len(views))

    # Explicit single-view lookups aren't pre-filtered like find_accessible(),
    # so raise_for_access must run outside the broad except block below so
    # access errors are never silently swallowed as "could not load metrics".
    check_access = request.view_id is not None

    results: list[MetricInfo] = []
    for view in views:
        if check_access:
            view.raise_for_access()
        try:
            raw_metrics = view.metrics
            all_cols: dict[str, ColumnMetadata] = {
                col.column_name: col
                for col in (
                    view.columns if request.include_compatible_dimensions else []
                )
            }
            for metric in raw_metrics:
                name = metric.metric_name or ""
                desc = metric.description or ""
                if request.search and not (
                    _matches_search(name, request.search)
                    or _matches_search(desc, request.search)
                ):
                    continue
                compat_dims: list[DimensionInfo] = []
                if request.include_compatible_dimensions:
                    # Unlike built-in SQL datasets, external views enforce
                    # per-metric compatibility, so dimensions must be resolved
                    # per metric rather than reused across all metrics.
                    compatible_names = view.get_compatible_dimensions([name], [])
                    compat_dims = [
                        DimensionInfo(
                            name=dim_name,
                            verbose_name=all_cols[dim_name].verbose_name
                            if dim_name in all_cols
                            else None,
                            description=all_cols[dim_name].description
                            if dim_name in all_cols
                            else None,
                            type=all_cols[dim_name].type
                            if dim_name in all_cols
                            else None,
                            is_dttm=all_cols[dim_name].is_dttm
                            if dim_name in all_cols
                            else False,
                            groupby=all_cols[dim_name].groupby
                            if dim_name in all_cols
                            else True,
                            filterable=all_cols[dim_name].filterable
                            if dim_name in all_cols
                            else True,
                            source="external",
                        )
                        for dim_name in compatible_names
                    ]
                results.append(
                    MetricInfo(
                        name=name,
                        verbose_name=metric.verbose_name or None,
                        description=desc or None,
                        expression=metric.expression or None,
                        source="external",
                        view_id=view.id,
                        view_name=view.name,
                        compatible_dimensions=compat_dims,
                    )
                )
        except Exception as exc:  # noqa: BLE001
            # External registry may be empty in OSS — degrade gracefully
            await ctx.warning(
                "Could not load metrics for view id=%s: %s" % (view.id, str(exc))
            )
    return results


@tool(
    tags=["data", "semantic"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="List metrics",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
@requires_data_model_metadata_access
async def list_metrics(
    request: ListMetricsRequest | None = None,
    ctx: Context | None = None,
) -> MetricList | SemanticLayerError:
    """List available metrics across built-in datasets and external semantic views.

    This is the primary entry point for semantic layer exploration. Returns a
    unified list of metrics from all data sources the current user can access,
    with compatible dimensions included inline.

    Workflow:
    1. list_metrics -> discover available metrics and their compatible dimensions
    2. get_table -> query data using chosen metrics and dimensions

    Use ``search`` to filter by metric name or description. Use ``dataset_id``
    or ``view_id`` to scope to a specific data source.

    Example:
    ```json
    {"search": "revenue", "include_compatible_dimensions": true, "page": 1}
    ```
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_metrics")

    request = request or ListMetricsRequest()

    await ctx.info(
        "Listing metrics: search=%s, dataset_id=%s, view_id=%s, page=%s"
        % (request.search, request.dataset_id, request.view_id, request.page)
    )

    if not user_can_view_data_model_metadata():
        await ctx.warning("Metric listing blocked by data-model privacy controls")
        return SemanticLayerError.create(
            error="You don't have permission to access dataset details for your role.",
            error_type=DATA_MODEL_METADATA_ERROR_TYPE,
        )

    if request.dataset_id is not None and request.view_id is not None:
        return SemanticLayerError.create(
            error="Provide only one of dataset_id or view_id to scope the search, not both.",
            error_type="ValidationError",
        )

    try:
        all_metrics: list[MetricInfo] = []

        if request.view_id is None:
            all_metrics.extend(_collect_builtin_metrics(request))
            await ctx.debug("Collected %d built-in metrics" % len(all_metrics))

        if request.dataset_id is None:
            external: list[MetricInfo] = await _collect_external_metrics(request, ctx)
            all_metrics.extend(external)
            await ctx.debug("Collected %d external metrics" % len(external))

        # Sort deterministically before paginating so that page boundaries
        # are stable across calls instead of depending on collection order.
        all_metrics.sort(
            key=lambda m: (m.source, m.dataset_id or m.view_id or 0, m.name)
        )

        total_count = len(all_metrics)
        total_pages = max(1, (total_count + request.page_size - 1) // request.page_size)
        start = (request.page - 1) * request.page_size
        page_metrics = all_metrics[start : start + request.page_size]

        await ctx.info(
            "Metrics listed: total=%d, page=%d/%d, returned=%d"
            % (total_count, request.page, total_pages, len(page_metrics))
        )

        return MetricList(
            metrics=page_metrics,
            total_count=total_count,
            page=request.page,
            page_size=request.page_size,
            total_pages=total_pages,
        )

    except SupersetSecurityException as exc:
        await ctx.error("Access denied: %s" % str(exc))
        return SemanticLayerError.create(
            error=str(exc.error.message),
            error_type="AccessDenied",
        )

    except Exception as exc:
        logger.exception(
            "Unexpected error in list_metrics: %s: %s", type(exc).__name__, str(exc)
        )
        await ctx.error("Unexpected error: %s: %s" % (type(exc).__name__, str(exc)))
        return SemanticLayerError.create(
            error=f"Internal error listing metrics: {exc}",
            error_type="InternalError",
        )
