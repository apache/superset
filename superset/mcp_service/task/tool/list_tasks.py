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

"""List tasks MCP tool."""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.tasks import TaskDAO
from superset.extensions import event_logger
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.task.schemas import (
    ALL_TASK_COLUMNS,
    DEFAULT_TASK_COLUMNS,
    ListTasksRequest,
    serialize_task_object,
    TASK_SORTABLE_COLUMNS,
    TaskColumnFilter,
    TaskError,
    TaskInfo,
    TaskList,
)

logger = logging.getLogger(__name__)

_DEFAULT_LIST_TASKS_REQUEST = ListTasksRequest()


@tool(
    tags=["core"],
    class_permission_name="Task",
    annotations=ToolAnnotations(
        title="List tasks",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_tasks(
    request: ListTasksRequest | None = None,
    ctx: Context | None = None,
) -> TaskList | TaskError:
    """List async tasks with filtering and pagination.

    Returns tasks visible to the current user. Non-admin users only see tasks
    they are subscribed to (task creators are auto-subscribed). Admins see all
    tasks.

    Sortable columns for order_column: task_type, scope, status, created_on, changed_on, started_at, ended_at
    Filter columns: task_type, status, scope
    Search columns (via search=): task_type, task_key, task_name, status, scope

    Common task_type values: sql_execution, thumbnail, report
    Common status values: pending, in_progress, success, failure, aborted
    Common scope values: private, shared, system
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_tasks")

    request = request or _DEFAULT_LIST_TASKS_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing tasks: page=%s, page_size=%s" % (request.page, request.page_size)
    )
    await ctx.debug(
        "Task parameters: filters=%s, order_column=%s, order_direction=%s"
        % (request.filters, request.order_column, request.order_direction)
    )

    try:

        def _serialize(obj: object, cols: list[str] | None) -> TaskInfo | None:
            return serialize_task_object(obj)

        # TaskDAO.base_filter = TaskFilter automatically scopes results:
        # non-admins only see their subscribed tasks; admins see all.
        list_tool = ModelListCore(
            dao_class=TaskDAO,
            output_schema=TaskInfo,
            item_serializer=_serialize,
            filter_type=TaskColumnFilter,
            default_columns=DEFAULT_TASK_COLUMNS,
            search_columns=["task_type", "task_key", "task_name", "status", "scope"],
            list_field_name="tasks",
            output_list_schema=TaskList,
            all_columns=ALL_TASK_COLUMNS,
            sortable_columns=TASK_SORTABLE_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_tasks.query"):
            result = list_tool.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=request.select_columns,
                order_column=request.order_column or "created_on",
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        await ctx.info(
            "Tasks listed: count=%s, total_count=%s"
            % (
                len(result.tasks) if hasattr(result, "tasks") else 0,
                getattr(result, "total_count", None),
            )
        )
        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_tasks.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Task listing failed: page=%s, error=%s, error_type=%s"
            % (request.page, str(e), type(e).__name__)
        )
        raise
