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
List themes FastMCP tool

This module contains the FastMCP tool for listing themes with filtering,
search, and pagination support.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.theme.schemas import (
    ListThemesRequest,
    serialize_theme_object,
    ThemeError,
    ThemeFilter,
    ThemeInfo,
    ThemeList,
)

logger = logging.getLogger(__name__)

DEFAULT_THEME_COLUMNS = [
    "id",
    "theme_name",
    "is_system_default",
    "is_system_dark",
]
SORTABLE_THEME_COLUMNS = ["id", "theme_name", "changed_on", "created_on"]
ALL_THEME_COLUMNS = [
    "id",
    "theme_name",
    "json_data",
    "uuid",
    "is_system",
    "is_system_default",
    "is_system_dark",
    "changed_on",
    "changed_on_humanized",
    "created_on",
    "created_on_humanized",
]

_DEFAULT_LIST_THEMES_REQUEST = ListThemesRequest()


@tool(
    tags=["core"],
    class_permission_name="Theme",
    annotations=ToolAnnotations(
        title="List themes",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_themes(
    request: ListThemesRequest | None = None,
    ctx: Context | None = None,
) -> ThemeList | ThemeError:
    """List themes with filtering and search.

    Returns theme metadata including name, system flags, and the antd
    design-token configuration (json_data).

    Sortable columns for order_column: id, theme_name, changed_on, created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_themes")

    request = request or _DEFAULT_LIST_THEMES_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing themes: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )
    await ctx.debug(
        "Theme listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )

    try:
        from superset.daos.theme import ThemeDAO

        def _serialize_theme(obj: object, cols: list[str] | None) -> ThemeInfo | None:
            return serialize_theme_object(obj)

        list_tool = ModelListCore(
            dao_class=ThemeDAO,
            output_schema=ThemeInfo,
            item_serializer=_serialize_theme,
            filter_type=ThemeFilter,
            default_columns=DEFAULT_THEME_COLUMNS,
            search_columns=["theme_name"],
            list_field_name="themes",
            output_list_schema=ThemeList,
            all_columns=ALL_THEME_COLUMNS,
            sortable_columns=SORTABLE_THEME_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_themes.query"):
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
            "Themes listed successfully: count=%s, total_count=%s, total_pages=%s"
            % (
                len(result.themes) if hasattr(result, "themes") else 0,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_themes.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Theme listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (request.page, request.page_size, str(e), type(e).__name__)
        )
        raise
