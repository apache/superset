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
List dashboards FastMCP tool (Advanced with metadata cache control)

This module contains the FastMCP tool for listing dashboards using
advanced filtering with clear, unambiguous request schema and metadata cache control.
"""

import logging
from typing import TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp import tool

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    DashboardFilter,
    DashboardInfo,
    DashboardList,
    ListDashboardsRequest,
    serialize_dashboard_object,
)
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)

# Minimal defaults for reduced token usage - users can request more via select_columns
DEFAULT_DASHBOARD_COLUMNS = [
    "id",
    "dashboard_title",
    "slug",
    "uuid",
]

SORTABLE_DASHBOARD_COLUMNS = [
    "id",
    "dashboard_title",
    "slug",
    "published",
    "changed_on",
    "created_on",
]


@tool(tags=["core"])
@parse_request(ListDashboardsRequest)
async def list_dashboards(
    request: ListDashboardsRequest, ctx: Context
) -> DashboardList:
    """List dashboards with filtering and search. Returns dashboard metadata
    including title, slug, and UUID. Use select_columns to request additional fields.

    Sortable columns for order_column: id, dashboard_title, slug, published,
    changed_on, created_on
    """
    await ctx.info(
        "Listing dashboards: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Dashboard listing filters: filters=%s, order_column=%s, order_direction=%s"
        % (
            len(request.filters),
            request.order_column,
            request.order_direction,
        )
    )

    from superset.daos.dashboard import DashboardDAO
    from superset.mcp_service.common.schema_discovery import (
        DASHBOARD_SORTABLE_COLUMNS,
        get_all_column_names,
        get_dashboard_columns,
    )

    # Get all column names dynamically from the model
    all_columns = get_all_column_names(get_dashboard_columns())

    def _serialize_dashboard(
        obj: "Dashboard | None", cols: list[str] | None
    ) -> DashboardInfo | None:
        """Serialize dashboard object (field filtering handled by model_serializer)."""
        return serialize_dashboard_object(obj)

    tool = ModelListCore(
        dao_class=DashboardDAO,
        output_schema=DashboardInfo,
        item_serializer=_serialize_dashboard,
        filter_type=DashboardFilter,
        default_columns=DEFAULT_DASHBOARD_COLUMNS,
        search_columns=[
            "dashboard_title",
            "slug",
            "uuid",
        ],
        list_field_name="dashboards",
        output_list_schema=DashboardList,
        all_columns=all_columns,
        sortable_columns=DASHBOARD_SORTABLE_COLUMNS,
        logger=logger,
    )

    with event_logger.log_context(action="mcp.list_dashboards.query"):
        result = tool.run_tool(
            filters=request.filters,
            search=request.search,
            select_columns=request.select_columns,
            order_column=request.order_column,
            order_direction=request.order_direction,
            page=max(request.page - 1, 0),
            page_size=request.page_size,
        )
    count = len(result.dashboards) if hasattr(result, "dashboards") else 0
    total_pages = getattr(result, "total_pages", None)
    await ctx.info(
        "Dashboards listed successfully: count=%s, total_pages=%s"
        % (count, total_pages)
    )

    # Apply field filtering via serialization context
    # Always use columns_requested (either explicit select_columns or defaults)
    # This triggers DashboardInfo._filter_fields_by_context for each dashboard
    columns_to_filter = result.columns_requested
    await ctx.debug(
        "Applying field filtering via serialization context: columns=%s"
        % (columns_to_filter,)
    )
    with event_logger.log_context(action="mcp.list_dashboards.serialization"):
        return result.model_dump(
            mode="json", context={"select_columns": columns_to_filter}
        )
