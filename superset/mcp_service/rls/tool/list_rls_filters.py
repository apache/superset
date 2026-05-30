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
List RLS filters FastMCP tool.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.privacy import USER_DIRECTORY_FIELDS
from superset.mcp_service.rls.schemas import (
    ALL_RLS_COLUMNS,
    DEFAULT_RLS_COLUMNS,
    ListRlsFiltersRequest,
    RlsColumnFilter,
    RlsFilterError,
    RlsFilterInfo,
    RlsFilterList,
    serialize_rls_filter_object,
    SORTABLE_RLS_COLUMNS,
)

logger = logging.getLogger(__name__)

_DEFAULT_LIST_RLS_FILTERS_REQUEST = ListRlsFiltersRequest()


@tool(
    tags=["core"],
    class_permission_name="Row Level Security",
    annotations=ToolAnnotations(
        title="List RLS filters",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_rls_filters(
    request: ListRlsFiltersRequest | None = None,
    ctx: Context | None = None,
) -> RlsFilterList | RlsFilterError:
    """List row level security filters. Requires admin access.

    Returns RLS filter metadata including name, filter type, tables, roles, and clause.

    Sortable columns for order_column: id, name, filter_type, changed_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_rls_filters")

    request = request or _DEFAULT_LIST_RLS_FILTERS_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing RLS filters: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )

    try:
        from superset.daos.security import RLSDAO

        def _serialize_rls_filter(obj: object, cols: list[str]) -> RlsFilterInfo | None:
            return serialize_rls_filter_object(obj)

        list_tool = ModelListCore(
            dao_class=RLSDAO,
            output_schema=RlsFilterInfo,
            item_serializer=_serialize_rls_filter,
            filter_type=RlsColumnFilter,
            default_columns=DEFAULT_RLS_COLUMNS,
            search_columns=["name"],
            list_field_name="rls_filters",
            output_list_schema=RlsFilterList,
            all_columns=ALL_RLS_COLUMNS,
            sortable_columns=SORTABLE_RLS_COLUMNS,
            logger=logger,
        )

        # Strip USER_DIRECTORY_FIELDS (e.g. 'roles') before handing off to
        # run_tool, which would raise ValueError if all requested columns are
        # privacy-filtered. Roles are restored in the model_dump context below.
        run_select_columns: list[str] | None = None
        if request.select_columns:
            filtered = [
                c for c in request.select_columns if c not in USER_DIRECTORY_FIELDS
            ]
            run_select_columns = filtered or None

        with event_logger.log_context(action="mcp.list_rls_filters.query"):
            result = list_tool.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=run_select_columns,
                order_column=request.order_column,
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        await ctx.info(
            "RLS filters listed: count=%s, total_count=%s"
            % (len(result.rls_filters), result.total_count)
        )

        # Build column selection using ALL_RLS_COLUMNS as the source of truth,
        # bypassing the USER_DIRECTORY_FIELDS privacy filter applied by
        # ModelListCore. 'roles' in an RLS filter is which roles the filter
        # applies to — core filter data — not user-directory metadata (like
        # dashboard.roles, which exposes who has access to the resource).
        if request.select_columns:
            columns_to_filter = [
                c for c in request.select_columns if c in ALL_RLS_COLUMNS
            ]
            if not columns_to_filter:
                columns_to_filter = list(DEFAULT_RLS_COLUMNS)
        else:
            columns_to_filter = list(DEFAULT_RLS_COLUMNS)

        with event_logger.log_context(action="mcp.list_rls_filters.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "RLS filter listing failed: error=%s, error_type=%s"
            % (str(e), type(e).__name__)
        )
        raise
