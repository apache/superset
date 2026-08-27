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
Get theme info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific theme by numeric ID or UUID.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.theme.schemas import (
    GetThemeInfoRequest,
    serialize_theme_object,
    ThemeError,
    ThemeInfo,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Theme",
    annotations=ToolAnnotations(
        title="Get theme info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_theme_info(
    request: GetThemeInfoRequest, ctx: Context
) -> ThemeInfo | ThemeError:
    """Get theme metadata by numeric ID or UUID.

    Returns theme details including name, system flags, and the antd
    design-token configuration (json_data).

    The identifier may be a numeric ID or a UUID string. To find a theme
    ID, use the list_themes tool first.

    Example usage:
    ```json
    {
        "identifier": 1
    }
    ```
    """
    await ctx.info(
        "Retrieving theme information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset.daos.theme import ThemeDAO

        with event_logger.log_context(action="mcp.get_theme_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=ThemeDAO,
                output_schema=ThemeInfo,
                error_schema=ThemeError,
                serializer=serialize_theme_object,
                supports_slug=False,
                logger=logger,
            )

            result = get_tool.run_tool(request.identifier)

        if isinstance(result, ThemeInfo):
            await ctx.info(
                "Theme information retrieved successfully: theme_id=%s, name=%s"
                % (result.id, result.theme_name)
            )
        else:
            await ctx.warning(
                "Theme retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Theme information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, str(e), type(e).__name__)
        )
        return ThemeError(
            error=f"Failed to get theme info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
