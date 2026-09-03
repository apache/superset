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
from dataclasses import dataclass, field
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.common.tabular_query import (
    build_query_dict,
    execute_tabular_query,
    validate_query_names,
)
from superset.exceptions import OAuth2Error, OAuth2RedirectError, SupersetException
from superset.extensions import event_logger
from superset.mcp_service.chart.query_result import (
    query_result_data,
    response_json_failure,
    safe_exception_message,
)
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
from superset.mcp_service.utils.response_utils import format_data_columns
from superset.utils.core import GenericDataType

logger = logging.getLogger(__name__)


@dataclass
class _ResolvedDatasource:
    """Metadata needed to validate and query a resolved data source."""

    display_name: str
    time_col: str | None
    valid_columns: set[str]
    valid_metrics: set[str]
    warnings: list[str] = field(default_factory=list)


def _time_column_error(
    time_col: str, valid_columns: set[str], display_name: str, kind: str
) -> str:
    if time_col in valid_columns:
        return (
            f"time_column '{time_col}' on {kind} '{display_name}' is "
            "not marked as a datetime column."
        )
    return f"Unknown time_column: '{time_col}' on {kind} '{display_name}'."


def _resolve_builtin_dataset(
    request: GetTableRequest,
) -> _ResolvedDatasource | SemanticLayerError:
    """Resolve metadata for a built-in dataset."""
    from sqlalchemy.orm import subqueryload

    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dataset import DatasetDAO

    dataset_id = request.dataset_id
    assert dataset_id is not None

    with event_logger.log_context(action="mcp.get_table.resolve_dataset"):
        dataset = DatasetDAO.find_by_id(
            dataset_id,
            query_options=[
                subqueryload(SqlaTable.columns),
                subqueryload(SqlaTable.metrics),
            ],
        )
    if dataset is None:
        return SemanticLayerError.create(
            error=f"No dataset found with id: {dataset_id}.",
            error_type="NotFound",
        )

    display_name = dataset.table_name
    valid_columns = {c.column_name for c in dataset.columns}
    valid_dttm_columns = {c.column_name for c in dataset.columns if c.is_dttm}
    valid_metrics = {m.metric_name for m in dataset.metrics}

    time_col = request.time_column
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
        return SemanticLayerError.create(
            error=_time_column_error(time_col, valid_columns, display_name, "dataset"),
            error_type="ValidationError",
        )

    return _ResolvedDatasource(display_name, time_col, valid_columns, valid_metrics)


def _resolve_external_view(
    request: GetTableRequest,
) -> _ResolvedDatasource | SemanticLayerError:
    """Resolve metadata for an external semantic view."""
    from superset.daos.semantic_layer import SemanticViewDAO
    from superset.exceptions import SupersetSecurityException

    view_id = request.view_id
    assert view_id is not None

    with event_logger.log_context(action="mcp.get_table.resolve_view"):
        view = SemanticViewDAO.find_by_id(view_id)
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

    display_name = view.name
    valid_columns = {c.column_name for c in view.columns}
    valid_dttm_columns = {c.column_name for c in view.columns if c.is_dttm}
    valid_metrics = {m.metric_name for m in view.metrics}

    warnings: list[str] = []
    time_col = request.time_column
    if time_col is None and request.time_range:
        dttm_cols = [c for c in view.columns if c.is_dttm]
        if dttm_cols:
            time_col = dttm_cols[0].column_name
        else:
            return SemanticLayerError.create(
                error=(
                    f"time_range was provided but view '{display_name}' has "
                    "no datetime dimension. Set time_column explicitly or "
                    "omit time_range."
                ),
                error_type="ValidationError",
            )
    if time_col is not None and time_col not in valid_dttm_columns:
        return SemanticLayerError.create(
            error=_time_column_error(time_col, valid_columns, display_name, "view"),
            error_type="ValidationError",
        )

    return _ResolvedDatasource(
        display_name, time_col, valid_columns, valid_metrics, warnings
    )


_NO_METRICS_HINT = (
    "This data source has no metrics defined. Use list_metrics to "
    "discover data sources that expose metrics."
)


def _validate_request_names(
    request: GetTableRequest, valid_columns: set[str], valid_metrics: set[str]
) -> list[str]:
    """Validate requested dimensions, metrics, filters, and order_by names."""
    return validate_query_names(
        valid_metrics,
        valid_columns,
        metrics=request.metrics,
        dimensions=request.dimensions,
        filters=[{"col": f.col} for f in request.filters],
        order_names=request.order_by,
        metrics_empty_hint=_NO_METRICS_HINT,
        # get_table also serves semantic views, which get_dataset_info
        # cannot resolve.
        metrics_full_list_hint="call list_metrics for the full list",
    )


def _build_query_dict(
    request: GetTableRequest,
    time_col: str | None,
) -> dict[str, Any]:
    """Assemble the query dict for QueryContextFactory."""
    return build_query_dict(
        time_column=time_col,
        metrics=request.metrics,
        dimensions=request.dimensions,
        filters=[{"col": f.col, "op": f.op, "val": f.val} for f in request.filters],
        time_range=request.time_range,
        limit=request.row_limit,
        order=[(name, request.order_desc) for name in request.order_by],
        order_desc=request.order_desc,
        rewrite_one_sided_time_range=request.view_id is not None,
    )


def _build_response(
    request: GetTableRequest,
    is_builtin: bool,
    display_name: str,
    query_result: dict[str, Any],
    data: list[dict[str, Any]],
    raw_columns: list[str],
    coltypes: list[int | GenericDataType],
    query_duration_ms: int,
    warnings: list[str],
) -> GetTableResponse:
    """Format the query result into a GetTableResponse."""
    cache_status = get_cache_status_from_result(
        query_result, force_refresh=request.force_refresh
    )
    columns_meta = format_data_columns(data, raw_columns, coltypes)

    if not data:
        return GetTableResponse(
            columns=columns_meta,
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
            cache_status=cache_status,
            warnings=warnings,
        )

    cache_label = "cached" if cache_status and cache_status.cache_hit else "fresh"
    summary = (
        f"'{display_name}': {len(data)} rows, "
        f"{len(raw_columns)} columns ({cache_label})."
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


async def _run_get_table_query(
    request: GetTableRequest,
    ctx: Context,
    is_builtin: bool,
    datasource_id: int,
    datasource_type: str,
) -> GetTableResponse | SemanticLayerError:
    """Resolve, validate, execute, and format a get_table request."""
    await ctx.report_progress(1, 5, "Resolving data source")
    resolved = (
        _resolve_builtin_dataset(request)
        if is_builtin
        else _resolve_external_view(request)
    )
    if isinstance(resolved, SemanticLayerError):
        return resolved

    await ctx.report_progress(2, 5, "Validating metrics and dimensions")
    validation_errors = _validate_request_names(
        request, resolved.valid_columns, resolved.valid_metrics
    )
    if validation_errors:
        error_msg = "; ".join(validation_errors)
        await ctx.error("Validation failed: %s" % (error_msg,))
        return SemanticLayerError.create(
            error=error_msg,
            error_type="ValidationError",
        )

    await ctx.report_progress(3, 5, "Building query")
    query_dict = _build_query_dict(request, resolved.time_col)

    await ctx.debug("Query dict: %s" % (sorted(query_dict.keys()),))
    await ctx.report_progress(4, 5, "Executing query")
    start_time = time.time()

    with event_logger.log_context(action="mcp.get_table.execute"):
        result = execute_tabular_query(
            datasource_id,
            datasource_type,
            query_dict,
            use_cache=request.use_cache,
            force=request.force_refresh,
        )
    queries_data, query_failure = query_result_data(result)
    if query_failure is not None:
        return SemanticLayerError.create(
            error=query_failure.error,
            error_type=query_failure.error_type,
        )
    if queries_data is None or type(result) is not dict:
        return SemanticLayerError.create(
            error="Malformed chart query result after validation",
            error_type="MalformedQueryResult",
        )
    queries = dict.get(result, "queries")
    if type(queries) is not list or not queries:
        return SemanticLayerError.create(
            error="Malformed chart query result after validation",
            error_type="MalformedQueryResult",
        )
    query_result = list.__getitem__(queries, 0)
    if type(query_result) is not dict:
        return SemanticLayerError.create(
            error="Malformed chart query result after validation",
            error_type="MalformedQueryResult",
        )
    data = list.__getitem__(queries_data, 0)
    raw_columns = dict.get(query_result, "colnames", [])
    coltypes = dict.get(query_result, "coltypes", [])
    if type(raw_columns) is not list or type(coltypes) is not list:
        return SemanticLayerError.create(
            error="Malformed chart query metadata after validation",
            error_type="MalformedQueryResult",
        )

    query_duration_ms = int((time.time() - start_time) * 1000)

    await ctx.report_progress(5, 5, "Formatting results")
    response = _build_response(
        request,
        is_builtin,
        resolved.display_name,
        query_result,
        data,
        raw_columns,
        coltypes,
        query_duration_ms,
        resolved.warnings,
    )
    if response_failure := response_json_failure(response):
        return SemanticLayerError.create(
            error=response_failure.error,
            error_type=response_failure.error_type,
        )

    await ctx.info(
        "get_table complete: rows=%d, columns=%d, duration=%dms"
        % (
            response.row_count,
            len(raw_columns),
            query_duration_ms,
        )
    )
    return response


def _validate_datasource_selection(
    request: GetTableRequest,
) -> SemanticLayerError | None:
    """Validate that exactly one of dataset_id/view_id was provided."""
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
    return None


@tool(
    tags=["data", "semantic"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Get table",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
@requires_data_model_metadata_access
async def get_table(
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

    selection_error = _validate_datasource_selection(request)
    if selection_error is not None:
        return selection_error

    is_builtin = request.dataset_id is not None
    datasource_type = "table" if is_builtin else "semantic_view"
    if is_builtin:
        assert request.dataset_id is not None
        datasource_id = request.dataset_id
    else:
        assert request.view_id is not None
        datasource_id = request.view_id

    try:
        return await _run_get_table_query(
            request, ctx, is_builtin, datasource_id, datasource_type
        )

    except OAuth2RedirectError as exc:
        redirect_msg = build_oauth2_redirect_message(exc)
        await ctx.error("OAuth2 redirect required: %s" % redirect_msg)
        return SemanticLayerError.create(
            error=redirect_msg,
            error_type="OAuth2Redirect",
        )

    except OAuth2Error as exc:
        error_text = safe_exception_message(exc)
        await ctx.error("OAuth2 error: %s" % error_text)
        return SemanticLayerError.create(
            error=f"OAuth2 authentication error: {error_text}",
            error_type="OAuth2Error",
        )

    except (CommandException, SupersetException) as exc:
        error_text = safe_exception_message(exc)
        await ctx.error("Query failed: %s" % error_text)
        return SemanticLayerError.create(
            error=f"Query execution failed: {error_text}",
            error_type="QueryError",
        )

    except SQLAlchemyError as exc:
        error_text = safe_exception_message(exc)
        await ctx.error("Database error: %s" % error_text)
        return SemanticLayerError.create(
            error=f"Database error: {error_text}",
            error_type="DatabaseError",
        )

    except Exception as exc:
        error_text = safe_exception_message(exc)
        logger.exception(
            "Unexpected error in get_table: %s: %s",
            type(exc).__name__,
            error_text,
        )
        await ctx.error("Unexpected error: %s: %s" % (type(exc).__name__, error_text))
        return SemanticLayerError.create(
            error=f"Internal error executing get_table: {error_text}",
            error_type="InternalError",
        )
