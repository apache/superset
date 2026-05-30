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
List plugins FastMCP tool.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.plugin.schemas import (
    ALL_PLUGIN_COLUMNS,
    DEFAULT_PLUGIN_COLUMNS,
    ListPluginsRequest,
    PluginColumnFilter,
    PluginError,
    PluginInfo,
    PluginList,
    serialize_plugin_object,
    SORTABLE_PLUGIN_COLUMNS,
)

logger = logging.getLogger(__name__)

_DEFAULT_LIST_PLUGINS_REQUEST = ListPluginsRequest()


@tool(
    tags=["core"],
    class_permission_name="DynamicPlugin",
    annotations=ToolAnnotations(
        title="List plugins",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_plugins(
    request: ListPluginsRequest | None = None,
    ctx: Context | None = None,
) -> PluginList | PluginError:
    """List dynamic plugins registered in this Superset instance. Requires admin access.

    Returns plugin metadata including name, key, and bundle URL.

    Sortable columns for order_column: id, name, key, changed_on, created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_plugins")

    request = request or _DEFAULT_LIST_PLUGINS_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing plugins: page=%s, page_size=%s, search=%s"
        % (request.page, request.page_size, request.search)
    )

    try:
        from superset.mcp_service.plugin.dao import DynamicPluginDAO

        def _serialize_plugin(obj: object, cols: list[str]) -> PluginInfo | None:
            return serialize_plugin_object(obj)

        list_tool = ModelListCore(
            dao_class=DynamicPluginDAO,
            output_schema=PluginInfo,
            item_serializer=_serialize_plugin,
            filter_type=PluginColumnFilter,
            default_columns=DEFAULT_PLUGIN_COLUMNS,
            search_columns=["name", "key"],
            list_field_name="plugins",
            output_list_schema=PluginList,
            all_columns=ALL_PLUGIN_COLUMNS,
            sortable_columns=SORTABLE_PLUGIN_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_plugins.query"):
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
            "Plugins listed: count=%s, total_count=%s"
            % (len(result.plugins), result.total_count)
        )

        columns_to_filter = result.columns_requested
        with event_logger.log_context(action="mcp.list_plugins.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Plugin listing failed: error=%s, error_type=%s"
            % (str(e), type(e).__name__)
        )
        raise
