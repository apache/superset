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
Get RLS filter info FastMCP tool.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.rls.schemas import (
    GetRlsFilterInfoRequest,
    RlsFilterError,
    RlsFilterInfo,
    serialize_rls_filter_object,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Row Level Security",
    annotations=ToolAnnotations(
        title="Get RLS filter info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_rls_filter_info(
    request: GetRlsFilterInfoRequest, ctx: Context
) -> RlsFilterInfo | RlsFilterError:
    """Get row level security filter details by ID. Requires admin access.

    Returns full RLS filter configuration including name, type, tables, subjects,
    and clause.

    Example usage:
    ```json
    {"identifier": 1}
    ```
    """
    from superset import security_manager

    # An RLS clause exposes tables/columns and roles; deny guests explicitly so
    # it holds even with MCP_RBAC_ENABLED off.
    if security_manager.is_guest_user():
        return RlsFilterError(
            error="RLS filters are not available to embedded guests.",
            error_type="Forbidden",
        )

    await ctx.info(
        "Retrieving RLS filter information: identifier=%s" % (request.identifier,)
    )

    try:
        from superset.daos.security import RLSDAO

        with event_logger.log_context(action="mcp.get_rls_filter_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=RLSDAO,
                output_schema=RlsFilterInfo,
                error_schema=RlsFilterError,
                serializer=serialize_rls_filter_object,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.identifier)

        if isinstance(result, RlsFilterInfo):
            await ctx.info(
                "RLS filter retrieved: id=%s, name=%s" % (result.id, result.name)
            )
        else:
            await ctx.warning(
                "RLS filter retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "RLS filter info retrieval failed: identifier=%s, error=%s"
            % (request.identifier, str(e))
        )
        return RlsFilterError(
            error=f"Failed to get RLS filter info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
