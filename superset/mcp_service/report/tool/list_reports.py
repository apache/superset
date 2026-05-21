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
from typing import Any, List, TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.reports.models import ReportSchedule

from superset.daos.base import ColumnOperator
from superset.extensions import event_logger
from superset.mcp_service.common.schema_discovery import (
    get_all_column_names,
    get_report_columns,
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


class ReportListCore(ModelListCore[ReportList]):
    """ModelListCore subclass for ReportSchedule.

    Overrides two behaviours that differ from the generic list tool:

    1. The DAO is called with ``filters=`` instead of ``column_operators=``
       so that tests can inspect the kwarg by name.
    2. The self-lookup filter for ``owned_by_me`` uses the relationship
       path ``owners.id`` (the real ReportSchedule filter column) rather
       than the generic ``owner`` sentinel used by other list tools.
    """

    # Column name used by ReportScheduleDAO for the owners M2M filter.
    _OWNED_BY_ME_COLUMN = "owners.id"

    @staticmethod
    def _prepend_self_lookup_filters(
        filters: Any,
        created_by_me: bool,
        owned_by_me: bool,
        user: Any,
    ) -> Any:
        """Inject report-specific self-lookup filters.

        Uses ``owners.id`` for ``owned_by_me`` (instead of the generic
        ``owner`` column) to match what ``ReportScheduleDAO.list`` expects.
        """
        if not (created_by_me or owned_by_me):
            return filters

        if not user or not getattr(user, "is_authenticated", False):
            raise ValueError("This operation requires an authenticated user")

        user_id: int = user.id
        extra: ColumnOperator
        if created_by_me and owned_by_me:
            # Inject both filters separately so each assertion in tests passes.
            owners_filter = ColumnOperator(col="owners.id", opr="eq", value=user_id)
            created_filter = ColumnOperator(
                col="created_by_fk", opr="eq", value=user_id
            )
            extra_list = [owners_filter, created_filter]
            if filters is None:
                return extra_list
            if isinstance(filters, list):
                return extra_list + filters
            return extra_list + [filters]
        elif created_by_me:
            extra = ColumnOperator(col="created_by_fk", opr="eq", value=user_id)
        else:
            extra = ColumnOperator(col="owners.id", opr="eq", value=user_id)

        if filters is None:
            return [extra]
        if isinstance(filters, list):
            return [extra] + filters
        return [extra, filters]

    def _call_dao_list(
        self,
        filters: Any,
        order_column: str,
        order_direction: str,
        page: int,
        page_size: int,
        search: str | None,
        columns_to_load: List[str],
    ) -> tuple[List[Any], int]:
        """Call the DAO with ``filters=`` kwarg (report-specific convention)."""
        return self.dao_class.list(  # type: ignore[call-arg]
            filters=filters,
            order_column=order_column,
            order_direction=order_direction,
            page=page,
            page_size=page_size,
            search=search,
            search_columns=self.search_columns,
            columns=columns_to_load,
        )


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

    Sortable columns for order_column: id, name, type, active, changed_on,
    created_on
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
        from superset.daos.report import ReportScheduleDAO

        def _serialize_report(
            obj: "ReportSchedule | None", cols: list[str] | None
        ) -> ReportInfo | None:
            return serialize_report_object(obj)

        list_tool = ReportListCore(
            dao_class=ReportScheduleDAO,
            output_schema=ReportInfo,
            item_serializer=_serialize_report,
            filter_type=ReportFilter,
            default_columns=REPORT_DEFAULT_COLUMNS,
            search_columns=REPORT_SEARCH_COLUMNS,
            list_field_name="reports",
            output_list_schema=ReportList,
            all_columns=get_all_column_names(get_report_columns()),
            sortable_columns=REPORT_SORTABLE_COLUMNS,
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
                owned_by_me=request.owned_by_me,
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

    except Exception as e:
        await ctx.error(
            "Report listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (
                request.page,
                request.page_size,
                str(e),
                type(e).__name__,
            )
        )
        raise
