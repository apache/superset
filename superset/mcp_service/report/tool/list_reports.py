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
List reports (alerts & reports) FastMCP tool.
"""

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.reports.models import ReportSchedule

from superset.extensions import event_logger
from superset.mcp_service.common.schema_discovery import (
    REPORT_DEFAULT_COLUMNS,
    REPORT_SEARCH_COLUMNS,
    REPORT_SORTABLE_COLUMNS,
)
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.report.schemas import (
    ListReportsRequest,
    ReportError,
    ReportFilter,
    ReportInfo,
    ReportList,
    serialize_report_object,
)

logger = logging.getLogger(__name__)


_DEFAULT_LIST_REPORTS_REQUEST = ListReportsRequest()


@tool(
    tags=["core"],
    class_permission_name="ReportSchedule",
    annotations=ToolAnnotations(
        title="List reports",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_reports(
    request: ListReportsRequest | None = None,
    ctx: Context | None = None,
) -> ReportList | ReportError:
    """List alerts and reports with filtering and search.

    Returns schedule metadata including name, type (Alert/Report), active
    status, and cron expression.

    Sortable columns for order_column: id, name, type, active, last_eval_dttm,
    changed_on, created_on
    """
    if ctx is None:
        raise RuntimeError("FastMCP context is required for list_reports")

    request = request or _DEFAULT_LIST_REPORTS_REQUEST.model_copy(deep=True)

    await ctx.info(
        "Listing reports: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Report listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )

    try:
        from superset import is_feature_enabled
        from superset.daos.report import ReportScheduleDAO

        if not is_feature_enabled("ALERT_REPORTS"):
            return ReportError.create(
                error="The Alerts & Reports feature is disabled on this instance.",
                error_type="FeatureDisabled",
            )

        def _serialize_report(
            obj: "ReportSchedule | None", _cols: list[str] | None
        ) -> ReportInfo | None:
            return serialize_report_object(obj)

        list_tool = ModelListCore(
            dao_class=ReportScheduleDAO,
            output_schema=ReportInfo,
            item_serializer=_serialize_report,
            filter_type=ReportFilter,
            default_columns=REPORT_DEFAULT_COLUMNS,
            search_columns=REPORT_SEARCH_COLUMNS,
            list_field_name="reports",
            output_list_schema=ReportList,
            all_columns=list(ReportInfo.model_fields.keys()),
            sortable_columns=REPORT_SORTABLE_COLUMNS,
            editor_filter_column="editor",
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_reports.query"):
            result = list_tool.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=request.select_columns,
                order_column=request.order_column,
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
                created_by_me=request.created_by_me,
                edited_by_me=request.edited_by_me,
            )

        await ctx.info(
            "Reports listed successfully: count=%s, total_count=%s, total_pages=%s"
            % (
                len(result.reports) if hasattr(result, "reports") else 0,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        columns_to_filter = result.columns_requested
        with event_logger.log_context(action="mcp.list_reports.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:  # noqa: BLE001
        await ctx.error(
            "Report listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (
                request.page,
                request.page_size,
                str(e),
                type(e).__name__,
            )
        )
        return ReportError(
            error=f"Failed to list reports: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
