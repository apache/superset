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

"""Get task info MCP tool."""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.tasks import TaskDAO
from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.task.schemas import (
    GetTaskInfoRequest,
    serialize_task_object,
    TaskError,
    TaskInfo,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["discovery"],
    class_permission_name="Task",
    annotations=ToolAnnotations(
        title="Get task info",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_task_info(
    request: GetTaskInfoRequest,
    ctx: Context,
) -> TaskInfo | TaskError:
    """Get details for a single async task by ID or UUID.

    Returns task_type, status, scope, and timestamps for the specified task.
    Non-admin users can only retrieve tasks they are subscribed to.

    Use list_tasks to discover task IDs and UUIDs.

    Example usage:
    ```json
    {"identifier": 42}
    ```

    Or with UUID:
    ```json
    {"identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"}
    ```
    """
    await ctx.info("Retrieving task: identifier=%s" % (request.identifier,))

    try:
        with event_logger.log_context(action="mcp.get_task_info.lookup"):
            # ModelGetInfoCore handles int ID and UUID string automatically.
            # TaskDAO.base_filter (TaskFilter) enforces subscription-based access.
            get_tool = ModelGetInfoCore(
                dao_class=TaskDAO,
                output_schema=TaskInfo,
                error_schema=TaskError,
                serializer=serialize_task_object,
                supports_slug=False,
                logger=logger,
            )
            result = get_tool.run_tool(request.identifier)

        if isinstance(result, TaskInfo):
            await ctx.info(
                "Task retrieved: id=%s, task_type=%s, status=%s"
                % (result.id, result.task_type, result.status)
            )
        else:
            await ctx.warning(
                "Task retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Task retrieval failed: identifier=%s, error=%s, error_type=%s"
            % (request.identifier, str(e), type(e).__name__)
        )
        return TaskError(
            error=f"Failed to get task info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
