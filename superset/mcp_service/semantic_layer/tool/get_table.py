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

"""MCP tool: get_table

Query a data source (built-in dataset or external semantic view) using
metric and dimension names, returning tabular results.
"""

import logging
import time
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.exceptions import OAuth2Error, OAuth2RedirectError, SupersetException
from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import PerformanceMetadata
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.semantic_layer.schemas import (
    GetTableRequest,
    GetTableResponse,
    SemanticLayerError,
)
from superset.mcp_service.utils.cache_utils import get_cache_status_from_result
from superset.mcp_service.utils.oauth2_utils import build_oauth2_redirect_message
from superset.mcp_service.utils.query_utils import validate_names
from superset.mcp_service.utils.response_utils import format_data_columns

logger = logging.getLogger(__name__)


def _build_query_dict(
    request: GetTableRequest,
    time_col: str | None,
) -> dict[str, Any]:
    """Assemble the query dict for QueryContextFactory."""
    filters: list[dict[str, Any]] = [
        {"col": f.col, "op": f.op, "val": f.val} for f in request.filters
    ]
    if request.time_range and time_col:
        filters.append(
            {"col": time_col, "op": "TEMPORAL_RANGE", "val": request.time_range}
        )

    query_dict: dict[str, Any] = {
        "filters": filters,
        "columns": request.dimensions,
        "metrics": request.metrics,
        "row_limit": request.row_limit,
        "order_desc": request.order_desc,
    }
    if time_col:
        query_dict["granularity"] = time_col
    if request.order_by:
        query_dict["orderby"] = [
            (col, not request.order_desc) for col in request.order_by
        ]
    return query_dict


@tool(
    tags=["data", "semantic"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Get table",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
@requires_data_model_metadata_access
async def get_table(  # noqa: C901
    request: GetTableRequest,
    ctx: Context,
) -> GetTableResponse | SemanticLayerError:
    """Query a data source using metrics and dimensions, returning tabular results.

    Works with both built-in datasets and external semantic views. The
    ``dataset_id`` or ``view_id`` comes from the ``list_metrics`` response.

    Workflow:
    1. list_metrics -> discover metrics and their compatible_dimensions
    2. get_table -> query with chosen metrics and dimensions

    Example (built-in):
    ```json
    {
        "dataset_id": 42,
        "metrics": ["revenue"],
        "dimensions": ["region", "product_category"],
        "time_range": "Last 30 days",
        "row_limit": 500
    }
    ```

    Example (external):
    ```json
    {
        "view_id": 5,
        "metrics": ["bookings"],
        "dimensions": ["listing__country_name"],
        "row_limit": 100
    }
    ```
    """
    await ctx.info(
        "Starting get_table: dataset_id=%s, view_id=%s, metrics=%s, "
        "dimensions=%s, row_limit=%s"
        % (
            request.dataset_id,
            request.view_id,
            request.metrics,
            request.dimensions,
            request.row_limit,
        )
    )

    if not user_can_view_data_model_metadata():
        return SemanticLayerError.create(
            error="You don't have permission to access dataset details for your role.",
            error_type=DATA_MODEL_METADATA_ERROR_TYPE,
        )

    if request.dataset_id is None and request.view_id is None:
        return SemanticLayerError.create(
            error=(
                "Provide either dataset_id (built-in dataset) or view_id "
                "(external semantic view). Both are in the list_metrics response."
            ),
            error_type="ValidationError",
        )
    if request.dataset_id is not None and request.view_id is not None:
        return SemanticLayerError.create(
            error="Provide only one of dataset_id or view_id, not both.",
            error_type="ValidationError",
        )

    try:
        from superset.commands.chart.data.get_data_command import ChartDataCommand
        from superset.common.query_context_factory import QueryContextFactory

        is_builtin = request.dataset_id is not None
        datasource_type = "table" if is_builtin else "semantic_view"
        if is_builtin:
            assert request.dataset_id is not None
            datasource_id = request.dataset_id
        else:
            assert request.view_id is not None
            datasource_id = request.view_id

        # ------------------------------------------------------------------
        # Resolve datasource for metadata (time column, display name)
        # ------------------------------------------------------------------
        await ctx.report_progress(1, 5, "Resolving data source")
        display_name: str = f"{'Dataset' if is_builtin else 'View'} {datasource_id}"
        time_col: str | None = request.time_column
        warnings: list[str] = []
        valid_columns: set[str] = set()
        valid_metrics: set[str] = set()

        if is_builtin:
            from sqlalchemy.orm import subqueryload

            from superset.connectors.sqla.models import SqlaTable
            from superset.daos.dataset import DatasetDAO

            with event_logger.log_context(action="mcp.get_table.resolve_dataset"):
                dataset = DatasetDAO.find_by_id(
                    datasource_id,
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
            display_name = dataset.table_name
            valid_columns = {c.column_name for c in dataset.columns}
            valid_dttm_columns = {c.column_name for c in dataset.columns if c.is_dttm}
            valid_metrics = {m.metric_name for m in dataset.metrics}
            if time_col is None and request.time_range:
                time_col = getattr(dataset, "main_dttm_col", None)
                if not time_col:
                    return SemanticLayerError.create(
                        error=(
                            "time_range was provided but no temporal column is "
                            "configured. Set time_column explicitly."
                        ),
                        error_type="ValidationError",
                    )
            if time_col is not None and time_col not in valid_dttm_columns:
                if time_col in valid_columns:
                    error_msg = (
                        f"time_column '{time_col}' on dataset '{display_name}' is "
                        "not marked as a datetime column."
                    )
                else:
                    error_msg = (
                        f"Unknown time_column: '{time_col}' on dataset "
                        f"'{display_name}'."
                    )
                return SemanticLayerError.create(
                    error=error_msg,
                    error_type="ValidationError",
                )
        else:
            from superset.daos.semantic_layer import SemanticViewDAO
            from superset.exceptions import SupersetSecurityException

            with event_logger.log_context(action="mcp.get_table.resolve_view"):
                view = SemanticViewDAO.find_by_id(datasource_id)
            if view is None:
                return SemanticLayerError.create(
                    error=f"No semantic view found with id: {request.view_id}.",
                    error_type="NotFound",
                )
            try:
                view.raise_for_access()
            except SupersetSecurityException as ex:
                return SemanticLayerError.create(
                    error=str(ex.error.message),
                    error_type="AccessDenied",
                )
            display_name = view.name
            valid_columns = {c.column_name for c in view.columns}
            valid_dttm_columns = {c.column_name for c in view.columns if c.is_dttm}
            valid_metrics = {m.metric_name for m in view.metrics}
            if time_col is None and request.time_range:
                # Use first datetime dimension as the time column
                dttm_cols = [c for c in view.columns if c.is_dttm]
                if dttm_cols:
                    time_col = dttm_cols[0].column_name
                else:
                    warnings.append(
                        "time_range provided but no datetime dimension found; "
                        "time filter will not be applied."
                    )
                    time_col = None
            if time_col is not None and time_col not in valid_dttm_columns:
                if time_col in valid_columns:
                    error_msg = (
                        f"time_column '{time_col}' on view '{display_name}' is "
                        "not marked as a datetime column."
                    )
                else:
                    error_msg = (
                        f"Unknown time_column: '{time_col}' on view '{display_name}'."
                    )
                return SemanticLayerError.create(
                    error=error_msg,
                    error_type="ValidationError",
                )

        # ------------------------------------------------------------------
        # Validate requested metrics and dimensions against the datasource
        # ------------------------------------------------------------------
        await ctx.report_progress(2, 5, "Validating metrics and dimensions")
        validation_errors: list[str] = []
        validation_errors.extend(
            validate_names(request.dimensions, valid_columns, "dimension")
        )
        validation_errors.extend(
            validate_names(request.metrics, valid_metrics, "metric")
        )
        filter_cols = [f.col for f in request.filters]
        validation_errors.extend(
            validate_names(filter_cols, valid_columns, "filter column")
        )
        if request.order_by:
            valid_orderby = valid_columns | valid_metrics
            validation_errors.extend(
                validate_names(request.order_by, valid_orderby, "order_by")
            )
        if validation_errors:
            error_msg = "; ".join(validation_errors)
            await ctx.error("Validation failed: %s" % (error_msg,))
            return SemanticLayerError.create(
                error=error_msg,
                error_type="ValidationError",
            )

        # ------------------------------------------------------------------
        # Build and execute query
        # ------------------------------------------------------------------
        await ctx.report_progress(3, 5, "Building query")
        query_dict = _build_query_dict(request, time_col)

        await ctx.debug("Query dict: %s" % (sorted(query_dict.keys()),))
        await ctx.report_progress(4, 5, "Executing query")
        start_time = time.time()

        with event_logger.log_context(action="mcp.get_table.execute"):
            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={"id": datasource_id, "type": datasource_type},
                queries=[query_dict],
                form_data={},
                force=not request.use_cache or request.force_refresh,
            )
            command = ChartDataCommand(query_context)
            command.validate()
            result = command.run()

        query_duration_ms = int((time.time() - start_time) * 1000)

        if not result or "queries" not in result or not result["queries"]:
            return SemanticLayerError.create(
                error="Query returned no results.",
                error_type="EmptyQuery",
            )

        # ------------------------------------------------------------------
        # Format response
        # ------------------------------------------------------------------
        await ctx.report_progress(5, 5, "Formatting results")
        query_result = result["queries"][0]
        data = query_result.get("data", [])
        raw_columns = query_result.get("colnames", [])

        if not data:
            return GetTableResponse(
                columns=[],
                data=[],
                row_count=0,
                total_rows=0,
                summary=f"'{display_name}': query returned no data.",
                source="builtin" if is_builtin else "external",
                dataset_id=request.dataset_id,
                dataset_name=display_name if is_builtin else None,
                view_id=request.view_id,
                view_name=display_name if not is_builtin else None,
                performance=PerformanceMetadata(
                    query_duration_ms=query_duration_ms,
                    cache_status="no_data",
                ),
                cache_status=get_cache_status_from_result(
                    query_result, force_refresh=request.force_refresh
                ),
                warnings=warnings,
            )

        columns_meta = format_data_columns(data, raw_columns)
        cache_status = get_cache_status_from_result(
            query_result, force_refresh=request.force_refresh
        )
        cache_label = "cached" if cache_status and cache_status.cache_hit else "fresh"
        summary = (
            f"'{display_name}': {len(data)} rows, "
            f"{len(raw_columns)} columns ({cache_label})."
        )

        await ctx.info(
            "get_table complete: rows=%d, columns=%d, duration=%dms"
            % (len(data), len(raw_columns), query_duration_ms)
        )

        return GetTableResponse(
            columns=columns_meta,
            data=data,
            row_count=len(data),
            total_rows=query_result.get("rowcount"),
            summary=summary,
            source="builtin" if is_builtin else "external",
            dataset_id=request.dataset_id,
            dataset_name=display_name if is_builtin else None,
            view_id=request.view_id,
            view_name=display_name if not is_builtin else None,
            performance=PerformanceMetadata(
                query_duration_ms=query_duration_ms,
                cache_status=cache_label,
            ),
            cache_status=cache_status,
            warnings=warnings,
        )

    except OAuth2RedirectError as exc:
        redirect_msg = build_oauth2_redirect_message(exc)
        await ctx.error("OAuth2 redirect required: %s" % redirect_msg)
        return SemanticLayerError.create(
            error=redirect_msg,
            error_type="OAuth2Redirect",
        )

    except OAuth2Error as exc:
        await ctx.error("OAuth2 error: %s" % str(exc))
        return SemanticLayerError.create(
            error=f"OAuth2 authentication error: {exc}",
            error_type="OAuth2Error",
        )

    except (CommandException, SupersetException) as exc:
        await ctx.error("Query failed: %s" % str(exc))
        return SemanticLayerError.create(
            error=f"Query execution failed: {exc}",
            error_type="QueryError",
        )

    except SQLAlchemyError as exc:
        await ctx.error("Database error: %s" % str(exc))
        return SemanticLayerError.create(
            error=f"Database error: {exc}",
            error_type="DatabaseError",
        )

    except Exception as exc:
        logger.exception(
            "Unexpected error in get_table: %s: %s", type(exc).__name__, str(exc)
        )
        await ctx.error("Unexpected error: %s: %s" % (type(exc).__name__, str(exc)))
        return SemanticLayerError.create(
            error=f"Internal error executing get_table: {exc}",
            error_type="InternalError",
        )
