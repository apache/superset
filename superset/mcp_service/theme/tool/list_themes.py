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
"""

import logging
from typing import TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.models.core import Theme

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

    Returns theme metadata including name and UUID.

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
        from superset.mcp_service.common.schema_discovery import (
            get_all_column_names,
            get_theme_columns,
            THEME_DEFAULT_COLUMNS,
            THEME_SORTABLE_COLUMNS,
        )

        all_columns = get_all_column_names(get_theme_columns())

        def _serialize_theme(
            obj: "Theme | None", cols: list[str] | None
        ) -> ThemeInfo | None:
            return serialize_theme_object(obj)

        list_tool = ModelListCore(
            dao_class=ThemeDAO,
            output_schema=ThemeInfo,
            item_serializer=_serialize_theme,
            filter_type=ThemeFilter,
            default_columns=THEME_DEFAULT_COLUMNS,
            search_columns=["theme_name"],
            list_field_name="themes",
            output_list_schema=ThemeList,
            all_columns=all_columns,
            sortable_columns=THEME_SORTABLE_COLUMNS,
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
            "Themes listed successfully: count=%s, total_count=%s"
            % (
                len(result.themes) if hasattr(result, "themes") else 0,
                getattr(result, "total_count", None),
            )
        )

        columns_to_filter = result.columns_requested
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
