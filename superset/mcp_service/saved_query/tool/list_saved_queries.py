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
List saved queries FastMCP tool

This module contains the FastMCP tool for listing saved SQL queries
with filtering, search, and pagination.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.saved_query.schemas import (
    DEFAULT_SAVED_QUERY_COLUMNS,
    ListSavedQueriesRequest,
    SavedQueryError,
    SavedQueryFilter,
    SavedQueryInfo,
    SavedQueryList,
    serialize_saved_query_object,
    SORTABLE_SAVED_QUERY_COLUMNS,
)

logger = logging.getLogger(__name__)

_DEFAULT_LIST_SAVED_QUERIES_REQUEST = ListSavedQueriesRequest()


@tool(
    tags=["core"],
    class_permission_name="SavedQuery",
    annotations=ToolAnnotations(
        title="List saved queries",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_saved_queries(
    request: ListSavedQueriesRequest | None = None,
    ctx: Context | None = None,
) -> SavedQueryList | SavedQueryError:
    """List saved SQL queries with filtering and search.

    Returns saved queries owned by the current user, including label, SQL,
    database ID, and schema.

    Sortable columns for order_column: id, label, db_id, schema,
    changed_on, created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_saved_queries")

    request = request or _DEFAULT_LIST_SAVED_QUERIES_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing saved queries: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Saved query listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )

    try:
        from superset.daos.query import SavedQueryDAO

        def _serialize_saved_query(
            obj: object, cols: list[str] | None
        ) -> SavedQueryInfo | None:
            return serialize_saved_query_object(obj)

        list_tool = ModelListCore(
            dao_class=SavedQueryDAO,
            output_schema=SavedQueryInfo,
            item_serializer=_serialize_saved_query,
            filter_type=SavedQueryFilter,
            default_columns=DEFAULT_SAVED_QUERY_COLUMNS,
            search_columns=["label", "description", "sql"],
            list_field_name="saved_queries",
            output_list_schema=SavedQueryList,
            all_columns=list(SavedQueryInfo.model_fields.keys()),
            sortable_columns=SORTABLE_SAVED_QUERY_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_saved_queries.query"):
            result = list_tool.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=request.select_columns,
                order_column=request.order_column,
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        await ctx.info(
            "Saved queries listed successfully: count=%s, total_count=%s, "
            "total_pages=%s"
            % (
                len(result.saved_queries) if hasattr(result, "saved_queries") else 0,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_saved_queries.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Saved query listing failed: page=%s, page_size=%s, error=%s, "
            "error_type=%s"
            % (
                request.page,
                request.page_size,
                str(e),
                type(e).__name__,
            )
        )
        raise
