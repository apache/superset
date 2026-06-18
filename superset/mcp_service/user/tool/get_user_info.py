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

"""Get user info FastMCP tool."""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.user.schemas import (
    GetUserInfoRequest,
    serialize_user_object,
    UserError,
    UserInfo,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="User",
    annotations=ToolAnnotations(
        title="Get user info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_user_info(
    request: GetUserInfoRequest, ctx: Context
) -> UserInfo | UserError:
    """Get user details by ID. Admin only.

    Returns user metadata including username, name, and active status.
    Sensitive fields (email, roles) are only included when the caller has
    data model metadata access.

    Example usage:
    ```json
    {
        "identifier": 1
    }
    ```
    """
    await ctx.info("Retrieving user information: identifier=%s" % (request.identifier,))

    try:
        from superset.daos.user import UserDAO

        can_view_sensitive = user_can_view_data_model_metadata()

        if not can_view_sensitive:
            await ctx.debug(
                "Sensitive fields (email, roles) will be redacted for this caller"
            )

        def _serializer(obj: object) -> UserInfo | None:
            return serialize_user_object(obj, include_sensitive=can_view_sensitive)

        with event_logger.log_context(action="mcp.get_user_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=UserDAO,
                output_schema=UserInfo,
                error_schema=UserError,
                serializer=_serializer,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.identifier)

        if isinstance(result, UserInfo):
            await ctx.info(
                "User information retrieved successfully: user_id=%s, username=%s"
                % (result.id, result.username)
            )
        else:
            await ctx.warning(
                "User retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "User information retrieval failed: identifier=%s, error=%s, error_type=%s"
            % (request.identifier, str(e), type(e).__name__)
        )
        raise
