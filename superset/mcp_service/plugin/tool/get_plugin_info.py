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
Get plugin info FastMCP tool.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.plugin.schemas import (
    GetPluginInfoRequest,
    PluginError,
    PluginInfo,
    serialize_plugin_object,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="DynamicPlugin",
    annotations=ToolAnnotations(
        title="Get plugin info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_plugin_info(
    request: GetPluginInfoRequest, ctx: Context
) -> PluginInfo | PluginError:
    """Get dynamic plugin details by ID. Requires admin access.

    Returns full plugin configuration including name, key, and bundle URL.

    Example usage:
    ```json
    {"identifier": 1}
    ```
    """
    await ctx.info(
        "Retrieving plugin information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset.mcp_service.plugin.dao import DynamicPluginDAO

        with event_logger.log_context(action="mcp.get_plugin_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=DynamicPluginDAO,
                output_schema=PluginInfo,
                error_schema=PluginError,
                serializer=serialize_plugin_object,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.identifier)

        if isinstance(result, PluginInfo):
            await ctx.info(
                "Plugin retrieved: id=%s, name=%s, key=%s"
                % (result.id, result.name, result.key)
            )
        else:
            await ctx.warning(
                "Plugin retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Plugin info retrieval failed: identifier=%s, error=%s"
            % (request.identifier, str(e))
        )
        return PluginError(
            error=f"Failed to get plugin info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
