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

"""Get role info FastMCP tool."""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.role.schemas import (
    GetRoleInfoRequest,
    RoleError,
    RoleInfo,
    serialize_role_object,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Role",
    # FAB's security API views register can_get/can_info/... — never
    # can_read — so the default "read" method permission can never be
    # granted on User/Role, not even to Admin.
    method_permission_name="get",
    annotations=ToolAnnotations(
        title="Get role info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_role_info(
    request: GetRoleInfoRequest, ctx: Context
) -> RoleInfo | RoleError:
    """Get role details by ID. Admin only.

    Returns role metadata including id and name.

    Example usage:
    ```json
    {
        "identifier": 1
    }
    ```
    """
    await ctx.info("Retrieving role information: identifier=%s" % (request.identifier,))

    try:
        from superset.daos.role import RoleDAO

        def _serializer(obj: object) -> RoleInfo | None:
            return serialize_role_object(obj, include_permissions=True)

        with event_logger.log_context(action="mcp.get_role_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=RoleDAO,
                output_schema=RoleInfo,
                error_schema=RoleError,
                serializer=_serializer,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.identifier)

        if isinstance(result, RoleInfo):
            await ctx.info(
                "Role information retrieved successfully: role_id=%s, name=%s"
                % (result.id, result.name)
            )
        else:
            await ctx.warning(
                "Role retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Role information retrieval failed: identifier=%s, error=%s, error_type=%s"
            % (request.identifier, str(e), type(e).__name__)
        )
        raise
