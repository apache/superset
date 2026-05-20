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

"""List action logs MCP tool."""

import logging
from datetime import datetime, timedelta, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.extensions import event_logger
from superset.mcp_service.action_log.schemas import (
    ActionLogError,
    ActionLogFilter,
    ActionLogInfo,
    ActionLogList,
    ALL_LOG_COLUMNS,
    DEFAULT_LOG_COLUMNS,
    ListActionLogsRequest,
    LOG_SORTABLE_COLUMNS,
    serialize_action_log_object,
)
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)

_DEFAULT_LIST_ACTION_LOGS_REQUEST = ListActionLogsRequest()


@tool(
    tags=["core"],
    class_permission_name="Log",
    annotations=ToolAnnotations(
        title="List action logs",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_action_logs(
    request: ListActionLogsRequest | None = None,
    ctx: Context | None = None,
) -> ActionLogList | ActionLogError:
    """List Superset action logs with filtering and pagination.

    Returns audit log entries recording user interactions with dashboards and
    charts. Defaults to the last 7 days to avoid pulling large result sets.

    ADMIN-ONLY: This tool requires admin privileges. Non-admin users will
    receive a permission error.

    Sortable columns for order_column: id, dttm
    Filter columns: action, user_id, dashboard_id, slice_id, dttm

    When no dttm filter is provided the tool automatically applies
    dttm >= (now - 7 days). Add an explicit dttm filter to override.
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_action_logs")

    request = request or _DEFAULT_LIST_ACTION_LOGS_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing action logs: page=%s, page_size=%s" % (request.page, request.page_size)
    )
    await ctx.debug(
        "Action log parameters: filters=%s, order_column=%s, order_direction=%s"
        % (request.filters, request.order_column, request.order_direction)
    )

    try:
        from superset.daos.log import LogDAO

        # Inject default 7-day dttm filter unless caller already provides one
        filters: list[ColumnOperator] = list(request.filters)
        has_dttm_filter = any(getattr(f, "col", None) == "dttm" for f in filters)
        if not has_dttm_filter:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            default_filter = ColumnOperator(
                col="dttm",
                opr=ColumnOperatorEnum.gte,
                value=cutoff,
            )
            filters = [default_filter] + filters
            await ctx.debug("Applied default 7-day dttm filter: cutoff=%s" % (cutoff,))

        def _serialize(obj: object, cols: list[str] | None) -> ActionLogInfo | None:
            return serialize_action_log_object(obj)

        list_tool = ModelListCore(
            dao_class=LogDAO,
            output_schema=ActionLogInfo,
            item_serializer=_serialize,
            filter_type=ActionLogFilter,
            default_columns=DEFAULT_LOG_COLUMNS,
            search_columns=["action"],
            list_field_name="action_logs",
            output_list_schema=ActionLogList,
            all_columns=ALL_LOG_COLUMNS,
            sortable_columns=LOG_SORTABLE_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_action_logs.query"):
            result = list_tool.run_tool(
                filters=filters,
                select_columns=request.select_columns,
                order_column=request.order_column or "dttm",
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        await ctx.info(
            "Action logs listed: count=%s, total_count=%s"
            % (
                len(result.action_logs) if hasattr(result, "action_logs") else 0,
                getattr(result, "total_count", None),
            )
        )
        return result

    except Exception as e:
        await ctx.error(
            "Action log listing failed: page=%s, error=%s, error_type=%s"
            % (request.page, str(e), type(e).__name__)
        )
        raise
