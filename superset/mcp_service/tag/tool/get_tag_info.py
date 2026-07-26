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
Get tag info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific tag.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.tag.schemas import (
    GetTagInfoRequest,
    serialize_tag_object,
    TagError,
    TagInfo,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Tag",
    annotations=ToolAnnotations(
        title="Get tag info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_tag_info(request: GetTagInfoRequest, ctx: Context) -> TagInfo | TagError:
    """Get tag metadata by numeric ID.

    Returns tag details including name, type, and description.

    Tag types: custom (user-created), type (implicit by object type),
    editor (implicit by editorship), favorited_by (implicit by favorites).

    To find a tag ID, use the list_tags tool first.

    Example usage:
    ```json
    {
        "identifier": 1
    }
    ```
    """
    await ctx.info("Retrieving tag information: identifier=%s" % (request.identifier,))

    try:
        from superset.daos.tag import TagDAO

        with event_logger.log_context(action="mcp.get_tag_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=TagDAO,
                output_schema=TagInfo,
                error_schema=TagError,
                serializer=serialize_tag_object,
                supports_slug=False,
                logger=logger,
            )

            result = get_tool.run_tool(request.identifier)

        if isinstance(result, TagInfo):
            await ctx.info(
                "Tag information retrieved successfully: tag_id=%s, name=%s, type=%s"
                % (result.id, result.name, result.type)
            )
        else:
            await ctx.warning(
                "Tag retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Tag information retrieval failed: identifier=%s, error=%s, error_type=%s"
            % (request.identifier, str(e), type(e).__name__)
        )
        return TagError(
            error=f"Failed to get tag info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
