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
Get widget info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific saved widget by numeric ID or UUID.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.widget.schemas import (
    GetWidgetInfoRequest,
    serialize_widget_object,
    WidgetError,
    WidgetInfo,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Widget",
    annotations=ToolAnnotations(
        title="Get widget info",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_widget_info(
    request: GetWidgetInfoRequest, ctx: Context
) -> WidgetInfo | WidgetError:
    """Get a saved widget by numeric ID or UUID.

    Returns the widget's type, name, description (what it shows, its business
    meaning and any caveats), props and revision. Read the description first:
    it explains the widget without loading its full configuration.

    The identifier may be a numeric ID or a UUID string. To find a widget,
    use the list_widgets tool first.

    Example usage:
    ```json
    {
        "identifier": "6f1c2b7e-2d4a-4c1e-9a53-0f3b8d2e7a10"
    }
    ```
    """
    await ctx.info(
        "Retrieving widget information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset.daos.widget import WidgetDAO

        with event_logger.log_context(action="mcp.get_widget_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=WidgetDAO,
                output_schema=WidgetInfo,
                error_schema=WidgetError,
                serializer=serialize_widget_object,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.identifier)

        if isinstance(result, WidgetInfo):
            await ctx.info(
                "Widget information retrieved successfully: widget_id=%s, name=%s"
                % (result.id, result.name)
            )
        else:
            await ctx.warning(
                "Widget retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )
        return result

    except Exception as e:
        await ctx.error(
            "Widget information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, str(e), type(e).__name__)
        )
        return WidgetError(
            error=f"Failed to get widget info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
