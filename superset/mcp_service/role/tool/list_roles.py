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

"""List roles FastMCP tool."""

import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.role.schemas import (
    DEFAULT_ROLE_COLUMNS,
    ListRolesRequest,
    ROLE_ALL_COLUMNS,
    ROLE_SORTABLE_COLUMNS,
    RoleError,
    RoleFilter,
    RoleInfo,
    RoleList,
    serialize_role_object,
)

logger = logging.getLogger(__name__)

_DEFAULT_LIST_ROLES_REQUEST = ListRolesRequest()


@tool(
    tags=["core"],
    class_permission_name="Role",
    annotations=ToolAnnotations(
        title="List roles",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_roles(
    request: ListRolesRequest | None = None,
    ctx: Context | None = None,
) -> RoleList | RoleError:
    """List roles with filtering and search. Admin only.

    Returns role metadata including id and name.

    Sortable columns for order_column: id, name
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_roles")

    request = request or _DEFAULT_LIST_ROLES_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing roles: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )
    await ctx.debug(
        "Role listing parameters: filters=%s, order_column=%s, order_direction=%s"
        % (request.filters, request.order_column, request.order_direction)
    )

    try:
        from superset.daos.role import RoleDAO

        def _serialize_role(obj: Any, _cols: list[str] | None) -> RoleInfo | None:
            return serialize_role_object(obj)

        list_tool = ModelListCore(
            dao_class=RoleDAO,
            output_schema=RoleInfo,
            item_serializer=_serialize_role,
            filter_type=RoleFilter,
            default_columns=DEFAULT_ROLE_COLUMNS,
            search_columns=["name"],
            list_field_name="roles",
            output_list_schema=RoleList,
            all_columns=ROLE_ALL_COLUMNS,
            sortable_columns=ROLE_SORTABLE_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_roles.query"):
            result = list_tool.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=request.select_columns,
                order_column=request.order_column or "id",
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        count = len(result.roles) if hasattr(result, "roles") else 0
        await ctx.info(
            "Roles listed successfully: count=%s, total_count=%s, total_pages=%s"
            % (
                count,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_roles.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Role listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (request.page, request.page_size, str(e), type(e).__name__)
        )
        raise
