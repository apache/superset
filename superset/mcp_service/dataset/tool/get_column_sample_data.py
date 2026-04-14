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
Get column sample data FastMCP tool

This module contains the FastMCP tool for retrieving distinct values
from a dataset column, useful for building filters in charts.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    ColumnSampleDataResponse,
    DatasetError,
    GetColumnSampleDataRequest,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Get column sample data",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_column_sample_data(
    request: GetColumnSampleDataRequest, ctx: Context
) -> ColumnSampleDataResponse | DatasetError:
    """Get distinct values for a dataset column.

    Returns up to `limit` distinct values from the specified column.
    Useful for discovering valid filter values when building charts.
    Respects row-level security and dataset fetch_values_predicate.

    IMPORTANT FOR LLM CLIENTS:
    - Use this tool BEFORE creating charts with filters to discover actual
      column values instead of guessing
    - Use get_dataset_info first to find column names and types
    - Low-cardinality columns (gender, status, category) work best

    Example usage:
    ```json
    {
        "dataset_id": 123,
        "column_name": "gender",
        "limit": 20
    }
    ```
    """
    await ctx.info(
        "Retrieving column sample data: dataset_id=%s, column=%s, limit=%s"
        % (request.dataset_id, request.column_name, request.limit)
    )

    try:
        from superset.daos.dataset import DatasetDAO

        with event_logger.log_context(action="mcp.get_column_sample_data.lookup"):
            dataset = DatasetDAO.find_by_id(request.dataset_id)

        if not dataset:
            await ctx.warning(
                "Dataset not found: dataset_id=%s" % (request.dataset_id,)
            )
            return DatasetError(
                error=f"Dataset with ID {request.dataset_id} not found",
                error_type="NotFound",
                timestamp=datetime.now(timezone.utc),
            )

        try:
            dataset.raise_for_access()
        except SupersetSecurityException as ex:
            await ctx.warning(
                "Permission denied for dataset_id=%s: %s"
                % (request.dataset_id, str(ex))
            )
            return DatasetError(
                error=f"Permission denied for dataset {request.dataset_id}",
                error_type="PermissionDenied",
                timestamp=datetime.now(timezone.utc),
            )

        # Fetch one extra value to detect truncation without a COUNT query
        fetch_limit = request.limit + 1
        denormalize_column = not dataset.normalize_columns

        with event_logger.log_context(action="mcp.get_column_sample_data.query"):
            raw_values = dataset.values_for_column(
                column_name=request.column_name,
                limit=fetch_limit,
                denormalize_column=denormalize_column,
            )

        truncated = len(raw_values) > request.limit
        values = raw_values[: request.limit]

        await ctx.info(
            "Column sample data retrieved: dataset_id=%s, column=%s, "
            "count=%s, truncated=%s"
            % (request.dataset_id, request.column_name, len(values), truncated)
        )

        return ColumnSampleDataResponse(
            dataset_id=request.dataset_id,
            column_name=request.column_name,
            values=values,
            count=len(values),
            truncated=truncated,
        )

    except KeyError:
        await ctx.warning(
            "Column not found: column=%s in dataset_id=%s"
            % (request.column_name, request.dataset_id)
        )
        return DatasetError(
            error=f"Column '{request.column_name}' does not exist "
            f"in dataset {request.dataset_id}",
            error_type="ColumnNotFound",
            timestamp=datetime.now(timezone.utc),
        )
    except Exception as e:
        await ctx.error(
            "Column sample data retrieval failed: dataset_id=%s, column=%s, "
            "error=%s, error_type=%s"
            % (request.dataset_id, request.column_name, str(e), type(e).__name__)
        )
        return DatasetError(
            error=f"Failed to get column sample data: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
