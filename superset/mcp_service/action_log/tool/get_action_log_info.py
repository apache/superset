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

"""Get action log info MCP tool."""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.log import LogDAO
from superset.extensions import event_logger
from superset.mcp_service.action_log.schemas import (
    ActionLogError,
    ActionLogInfo,
    GetActionLogInfoRequest,
    serialize_action_log_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Log",
    annotations=ToolAnnotations(
        title="Get action log info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_action_log_info(
    request: GetActionLogInfoRequest,
    ctx: Context,
) -> ActionLogInfo | ActionLogError:
    """Get a single action log entry by its integer ID.

    Returns the action, user_id, timestamp (dttm), dashboard_id, slice_id,
    and JSON payload for the specified log record.

    Requires the Log permission (controlled by Superset's RBAC). Users without
    that permission will receive a permission error.

    Use list_action_logs to discover log IDs.
    """
    await ctx.info("Retrieving action log: identifier=%s" % (request.identifier,))

    try:
        with event_logger.log_context(action="mcp.get_action_log_info.lookup"):
            get_tool = ModelGetInfoCore(
                dao_class=LogDAO,
                output_schema=ActionLogInfo,
                error_schema=ActionLogError,
                serializer=serialize_action_log_object,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.identifier)

        if isinstance(result, ActionLogInfo):
            await ctx.info(
                "Action log retrieved: id=%s, action=%s" % (result.id, result.action)
            )
        else:
            await ctx.warning(
                "Action log retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Action log retrieval failed: identifier=%s, error=%s, error_type=%s"
            % (request.identifier, str(e), type(e).__name__)
        )
        return ActionLogError(
            error=f"Failed to get action log info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
