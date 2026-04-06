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
List databases FastMCP tool (Advanced with metadata cache control)

This module contains the FastMCP tool for listing databases using
advanced filtering with clear, unambiguous request schema and metadata cache control.
"""

import logging
from typing import TYPE_CHECKING

from fastmcp import Context

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

if TYPE_CHECKING:
    from superset.models.core import Database

from superset.extensions import event_logger
from superset.mcp_service.database.schemas import (
    DatabaseFilter,
    DatabaseInfo,
    DatabaseList,
    ListDatabasesRequest,
    serialize_database_object,
)
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook(class_permission_name="Database")
async def list_databases(request: ListDatabasesRequest, ctx: Context) -> DatabaseList:
    """List database connections with filtering and search.

    Returns database metadata including name, backend type, and permissions.

    Sortable columns for order_column: id, database_name, changed_on,
    created_on
    """
    await ctx.info(
        "Listing databases: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Database listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )
    await ctx.debug(
        "Metadata cache settings: use_cache=%s, refresh_metadata=%s, force_refresh=%s"
        % (
            request.use_cache,
            request.refresh_metadata,
            request.force_refresh,
        )
    )

    try:
        from superset.daos.database import DatabaseDAO
        from superset.mcp_service.common.schema_discovery import (
            DATABASE_DEFAULT_COLUMNS,
            DATABASE_SORTABLE_COLUMNS,
            get_all_column_names,
            get_database_columns,
        )

        # Get all column names dynamically from the model
        all_columns = get_all_column_names(get_database_columns())

        def _serialize_database(
            obj: "Database | None", cols: list[str] | None
        ) -> DatabaseInfo | None:
            """Serialize database (filtering via model_serializer)."""
            return serialize_database_object(obj)

        # Create tool with standard serialization
        list_tool = ModelListCore(
            dao_class=DatabaseDAO,
            output_schema=DatabaseInfo,
            item_serializer=_serialize_database,
            filter_type=DatabaseFilter,
            default_columns=DATABASE_DEFAULT_COLUMNS,
            search_columns=["database_name"],
            list_field_name="databases",
            output_list_schema=DatabaseList,
            all_columns=all_columns,
            sortable_columns=DATABASE_SORTABLE_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_databases.query"):
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
            "Databases listed successfully: count=%s, total_count=%s, total_pages=%s"
            % (
                len(result.databases) if hasattr(result, "databases") else 0,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        # Apply field filtering via serialization context
        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_databases.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Database listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (
                request.page,
                request.page_size,
                str(e),
                type(e).__name__,
            )
        )
        raise
