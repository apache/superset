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
List widgets FastMCP tool

This module contains the FastMCP tool for listing saved widgets with filtering,
search, and pagination support.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.widget.schemas import (
    ListWidgetsRequest,
    serialize_widget_object,
    WidgetError,
    WidgetInfo,
    WidgetList,
    WidgetListFilter,
)

logger = logging.getLogger(__name__)

DEFAULT_WIDGET_COLUMNS = ["id", "uuid", "widget_type", "name", "description"]
SORTABLE_WIDGET_COLUMNS = ["id", "name", "widget_type", "changed_on", "created_on"]
ALL_WIDGET_COLUMNS = [
    "id",
    "uuid",
    "widget_type",
    "schema_version",
    "name",
    "description",
    "props",
    "revision",
    "changed_on",
    "changed_on_humanized",
    "created_on",
    "created_on_humanized",
]

_DEFAULT_LIST_WIDGETS_REQUEST = ListWidgetsRequest()


@tool(
    tags=["core"],
    class_permission_name="Widget",
    annotations=ToolAnnotations(
        title="List widgets",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def list_widgets(
    request: ListWidgetsRequest | None = None,
    ctx: Context | None = None,
) -> WidgetList | WidgetError:
    """List saved widgets with filtering and search.

    Returns each widget's type, name and description by default; request
    'props' in select_columns to include its configuration. Only widgets the
    current user may read are returned.

    Sortable columns for order_column: id, name, widget_type, changed_on, created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_widgets")

    request = request or _DEFAULT_LIST_WIDGETS_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing widgets: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )

    try:
        from superset.daos.widget import WidgetDAO

        def _serialize_widget(obj: object, cols: list[str] | None) -> WidgetInfo | None:
            return serialize_widget_object(obj)

        list_tool = ModelListCore(
            dao_class=WidgetDAO,
            output_schema=WidgetInfo,
            item_serializer=_serialize_widget,
            filter_type=WidgetListFilter,
            default_columns=DEFAULT_WIDGET_COLUMNS,
            search_columns=["name", "description"],
            list_field_name="widgets",
            output_list_schema=WidgetList,
            all_columns=ALL_WIDGET_COLUMNS,
            sortable_columns=SORTABLE_WIDGET_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_widgets.query"):
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
            "Widgets listed successfully: count=%s, total_count=%s"
            % (
                len(result.widgets) if hasattr(result, "widgets") else 0,
                getattr(result, "total_count", None),
            )
        )

        with event_logger.log_context(action="mcp.list_widgets.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": result.columns_requested},
            )

    except Exception as e:
        await ctx.error(
            "Widget listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (request.page, request.page_size, str(e), type(e).__name__)
        )
        raise
