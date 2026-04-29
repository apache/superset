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
MCP tool: query_dataset

Query a dataset using its semantic layer (saved metrics, calculated columns,
dimensions) without requiring a saved chart.
"""

import difflib
import logging
import time
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload, subqueryload
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.exceptions import OAuth2Error, OAuth2RedirectError, SupersetException
from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import DataColumn, PerformanceMetadata
from superset.mcp_service.dataset.schemas import (
    DatasetError,
    QueryDatasetFilter,
    QueryDatasetRequest,
    QueryDatasetResponse,
)
from superset.mcp_service.privacy import (
    DATA_MODEL_METADATA_ERROR_TYPE,
    requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.utils import _is_uuid
from superset.mcp_service.utils.cache_utils import get_cache_status_from_result
from superset.mcp_service.utils.oauth2_utils import build_oauth2_redirect_message

logger = logging.getLogger(__name__)


def _resolve_dataset(identifier: int | str, eager_options: list[Any]) -> Any | None:
    """Resolve a dataset by int ID or UUID string.

    Replicates the identifier resolution logic from ModelGetInfoCore._find_object().
    """
    from superset.daos.dataset import DatasetDAO

    opts = eager_options or None

    if isinstance(identifier, int):
        return DatasetDAO.find_by_id(identifier, query_options=opts)

    # Try parsing as int
    try:
        id_val = int(identifier)
        return DatasetDAO.find_by_id(id_val, query_options=opts)
    except (ValueError, TypeError):
        pass

    # Try UUID
    if _is_uuid(str(identifier)):
        return DatasetDAO.find_by_id(identifier, id_column="uuid", query_options=opts)

    return None


def _validate_names(
    requested: list[str],
    valid: set[str],
    kind: str,
) -> list[str]:
    """Return list of error messages for names not found in *valid*.

    Includes close-match suggestions when available.
    """
    errors: list[str] = []
    for name in requested:
        if name not in valid:
            suggestions = difflib.get_close_matches(name, valid, n=3, cutoff=0.6)
            msg = f"Unknown {kind}: '{name}'"
            if suggestions:
                msg += f". Did you mean: {', '.join(suggestions)}?"
            errors.append(msg)
    return errors


@requires_data_model_metadata_access
@tool(
    tags=["data"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Query dataset",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def query_dataset(  # noqa: C901
    request: QueryDatasetRequest, ctx: Context
) -> QueryDatasetResponse | DatasetError:
    """Query a dataset using its semantic layer (saved metrics, dimensions, filters).

    Returns tabular data without requiring a saved chart. Use this when you want
    to compute saved metrics, group by dimensions, or apply filters directly
    against a dataset's curated semantic layer.

    Workflow:
    1. list_datasets -> find a dataset
    2. get_dataset_info -> discover available columns and metrics
    3. query_dataset -> query using metric names and column names

    Example:
    ```json
    {
        "dataset_id": 123,
        "metrics": ["count", "avg_revenue"],
        "columns": ["product_category"],
        "time_range": "Last 7 days",
        "row_limit": 100
    }
    ```
    """
    await ctx.info(
        "Starting dataset query: dataset_id=%s, metrics=%s, columns=%s, "
        "row_limit=%s"
        % (
            request.dataset_id,
            request.metrics,
            request.columns,
            request.row_limit,
        )
    )

    try:
        from superset.commands.chart.data.get_data_command import ChartDataCommand
        from superset.common.query_context_factory import QueryContextFactory
        from superset.connectors.sqla.models import SqlaTable

        # ------------------------------------------------------------------
        # Step 1: Resolve dataset
        # ------------------------------------------------------------------
        await ctx.report_progress(1, 5, "Looking up dataset")
        eager_options = [
            subqueryload(SqlaTable.columns),
            subqueryload(SqlaTable.metrics),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.query_dataset.lookup"):
            dataset = _resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            await ctx.error("Dataset not found: identifier=%s" % (request.dataset_id,))
            return DatasetError.create(
                error=f"No dataset found with identifier: {request.dataset_id}",
                error_type="NotFound",
            )

        dataset_name = getattr(dataset, "table_name", None) or f"Dataset {dataset.id}"
        await ctx.info(
            "Dataset found: id=%s, name=%s, columns=%s, metrics=%s"
            % (
                dataset.id,
                dataset_name,
                len(dataset.columns),
                len(dataset.metrics),
            )
        )

        # ------------------------------------------------------------------
        # Step 1b: Check data-model metadata access before returning schema info.
        # The decorator hides this tool from search; this check enforces direct calls.
        # ------------------------------------------------------------------
        if not user_can_view_data_model_metadata():
            await ctx.warning("Dataset metadata access blocked by privacy controls")
            return DatasetError.create(
                error=(
                    "You don't have permission to access dataset details for your role."
                ),
                error_type=DATA_MODEL_METADATA_ERROR_TYPE,
            )

        # ------------------------------------------------------------------
        # Step 2: Validate requested columns and metrics
        # ------------------------------------------------------------------
        await ctx.report_progress(2, 5, "Validating columns and metrics")
        valid_columns = {c.column_name for c in dataset.columns}
        valid_metrics = {m.metric_name for m in dataset.metrics}

        validation_errors: list[str] = []
        validation_errors.extend(
            _validate_names(request.columns, valid_columns, "column")
        )
        validation_errors.extend(
            _validate_names(request.metrics, valid_metrics, "metric")
        )
        # Validate filter column names against dataset columns
        filter_cols = [f.col for f in request.filters]
        validation_errors.extend(
            _validate_names(filter_cols, valid_columns, "filter column")
        )
        # Validate order_by names against columns + metrics
        if request.order_by:
            valid_orderby = valid_columns | valid_metrics
            validation_errors.extend(
                _validate_names(request.order_by, valid_orderby, "order_by")
            )

        if validation_errors:
            error_msg = "; ".join(validation_errors)
            await ctx.error("Validation failed: %s" % (error_msg,))
            return DatasetError.create(
                error=error_msg,
                error_type="ValidationError",
            )

        # ------------------------------------------------------------------
        # Step 3: Build filters and time range
        # ------------------------------------------------------------------
        warnings: list[str] = []
        query_filters: list[dict[str, Any]] = [
            {"col": f.col, "op": f.op, "val": f.val} for f in request.filters
        ]
        # Track all applied filters (including synthesized ones) for the response.
        effective_filters: list[QueryDatasetFilter] = list(request.filters)
        granularity: str | None = None

        if request.time_range:
            temporal_col = request.time_column or getattr(
                dataset, "main_dttm_col", None
            )
            if not temporal_col:
                await ctx.error("time_range provided but no temporal column available")
                return DatasetError.create(
                    error=(
                        "time_range was provided but no temporal column is available. "
                        "Either set time_column explicitly or ensure the dataset has "
                        "a main datetime column configured."
                    ),
                    error_type="ValidationError",
                )
            # Validate that the temporal column actually exists on the dataset
            if temporal_col not in valid_columns:
                await ctx.error("time_column '%s' not found on dataset" % temporal_col)
                return DatasetError.create(
                    error=(
                        f"time_column '{temporal_col}' does not exist on this dataset."
                    ),
                    error_type="ValidationError",
                )
            # Warn if the chosen temporal column isn't marked as datetime
            dttm_cols = {c.column_name for c in dataset.columns if c.is_dttm}
            if temporal_col not in dttm_cols:
                warnings.append(
                    f"Column '{temporal_col}' is not marked as a datetime "
                    f"column on this dataset. Time filtering may not work "
                    f"as expected."
                )

            query_filters.append(
                {
                    "col": temporal_col,
                    "op": "TEMPORAL_RANGE",
                    "val": request.time_range,
                }
            )
            effective_filters.append(
                QueryDatasetFilter(
                    col=temporal_col,
                    op="TEMPORAL_RANGE",
                    val=request.time_range,
                )
            )
            granularity = temporal_col
            await ctx.debug(
                "Time filter: column=%s, range=%s" % (temporal_col, request.time_range)
            )

        # ------------------------------------------------------------------
        # Step 4: Build query dict
        # ------------------------------------------------------------------
        await ctx.report_progress(3, 5, "Building query")
        query_dict: dict[str, Any] = {
            "filters": query_filters,
            "columns": request.columns,
            "metrics": request.metrics,
            "row_limit": request.row_limit,
            "order_desc": request.order_desc,
        }
        if granularity:
            query_dict["granularity"] = granularity
        if request.order_by:
            # OrderBy = tuple[Metric | Column, bool] where bool is ascending
            query_dict["orderby"] = [
                (col, not request.order_desc) for col in request.order_by
            ]

        await ctx.debug("Query dict keys: %s" % (sorted(query_dict.keys()),))

        # ------------------------------------------------------------------
        # Step 5: Create QueryContext and execute
        # ------------------------------------------------------------------
        await ctx.report_progress(4, 5, "Executing query")
        start_time = time.time()

        with event_logger.log_context(action="mcp.query_dataset.execute"):
            factory = QueryContextFactory()
            # datasource_type is "table" because this tool queries SqlaTable
            # datasets (Superset's built-in semantic layer). External semantic
            # layers (dbt, Snowflake Cortex, etc.) use "semantic_view" and have
            # a different query path — see SemanticView + mapper.py.
            query_context = factory.create(
                datasource={"id": dataset.id, "type": "table"},
                queries=[query_dict],
                form_data={},
                force=not request.use_cache or request.force_refresh,
                custom_cache_timeout=request.cache_timeout,
            )

            command = ChartDataCommand(query_context)
            command.validate()
            result = command.run()

        query_duration_ms = int((time.time() - start_time) * 1000)

        if not result or "queries" not in result or len(result["queries"]) == 0:
            await ctx.warning("Query returned no results for dataset %s" % dataset.id)
            return DatasetError.create(
                error="Query returned no results.",
                error_type="EmptyQuery",
            )

        # ------------------------------------------------------------------
        # Step 6: Format response
        # ------------------------------------------------------------------
        await ctx.report_progress(5, 5, "Formatting results")
        query_result = result["queries"][0]
        data = query_result.get("data", [])
        raw_columns = query_result.get("colnames", [])

        if not data:
            return QueryDatasetResponse(
                dataset_id=dataset.id,
                dataset_name=dataset_name,
                columns=[],
                data=[],
                row_count=0,
                total_rows=0,
                summary=f"Query on '{dataset_name}' returned no data.",
                performance=PerformanceMetadata(
                    query_duration_ms=query_duration_ms,
                    cache_status="no_data",
                ),
                cache_status=get_cache_status_from_result(
                    query_result, force_refresh=request.force_refresh
                ),
                applied_filters=effective_filters,
                warnings=warnings,
            )

        # Build column metadata in a single pass per column.
        # Cap stats computation at STATS_SAMPLE rows to avoid O(rows*cols)
        # overhead on large result sets (row_limit allows up to 50k).
        stats_sample_size = 5000
        stats_rows = data[:stats_sample_size]

        columns_meta: list[DataColumn] = []
        for col_name in raw_columns:
            sample_values = [
                row.get(col_name) for row in data[:3] if row.get(col_name) is not None
            ]
            data_type = "string"
            if sample_values:
                if all(isinstance(v, bool) for v in sample_values):
                    data_type = "boolean"
                elif all(isinstance(v, (int, float)) for v in sample_values):
                    data_type = "numeric"

            # Compute null_count and unique non-null values in one pass
            null_count = 0
            unique_vals: set[str] = set()
            for row in stats_rows:
                val = row.get(col_name)
                if val is None:
                    null_count += 1
                else:
                    unique_vals.add(str(val))

            columns_meta.append(
                DataColumn(
                    name=col_name,
                    display_name=col_name.replace("_", " ").title(),
                    data_type=data_type,
                    sample_values=sample_values[:3],
                    null_count=null_count,
                    unique_count=len(unique_vals),
                )
            )

        cache_status = get_cache_status_from_result(
            query_result, force_refresh=request.force_refresh
        )

        cache_label = "cached" if cache_status and cache_status.cache_hit else "fresh"
        summary = (
            f"Dataset '{dataset_name}': {len(data)} rows, "
            f"{len(raw_columns)} columns ({cache_label})."
        )

        await ctx.info(
            "Query complete: rows=%s, columns=%s, duration=%sms"
            % (len(data), len(raw_columns), query_duration_ms)
        )

        return QueryDatasetResponse(
            dataset_id=dataset.id,
            dataset_name=dataset_name,
            columns=columns_meta,
            data=data,
            row_count=len(data),
            total_rows=query_result.get("rowcount"),
            summary=summary,
            performance=PerformanceMetadata(
                query_duration_ms=query_duration_ms,
                cache_status=cache_label,
            ),
            cache_status=cache_status,
            applied_filters=request.filters,
            warnings=warnings,
        )

    except OAuth2RedirectError as exc:
        redirect_msg = build_oauth2_redirect_message(exc)
        await ctx.error("OAuth2 redirect required: %s" % (redirect_msg,))
        return DatasetError.create(
            error=redirect_msg,
            error_type="OAuth2Redirect",
        )

    except OAuth2Error as exc:
        await ctx.error("OAuth2 error: %s" % (str(exc),))
        return DatasetError.create(
            error=f"OAuth2 authentication error: {exc}",
            error_type="OAuth2Error",
        )

    except (CommandException, SupersetException) as exc:
        await ctx.error("Query failed: %s" % (str(exc),))
        return DatasetError.create(
            error=f"Query execution failed: {exc}",
            error_type="QueryError",
        )

    except SQLAlchemyError as exc:
        await ctx.error("Database error: %s" % (str(exc),))
        return DatasetError.create(
            error=f"Database error: {exc}",
            error_type="DatabaseError",
        )

    except Exception as exc:
        logger.exception(
            "Unexpected error while querying dataset: %s: %s",
            type(exc).__name__,
            str(exc),
        )
        await ctx.error("Unexpected error: %s: %s" % (type(exc).__name__, str(exc)))
        return DatasetError.create(
            error="An unexpected error occurred while querying the dataset.",
            error_type="UnexpectedError",
        )
