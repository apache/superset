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
from typing import Any, TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp import tool

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

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

DEFAULT_DASHBOARD_COLUMNS = [
    "id",
    "dashboard_title",
    "slug",
    "uuid",
    "published",
    "changed_on",
    "created_on",
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
) -> dict[str, Any]:
    """List dashboards with filtering and search. Returns dashboard metadata
    including title, slug, and charts.

    Sortable columns for order_column: id, dashboard_title, slug, published,
    changed_on, created_on
    """
    from superset.daos.dashboard import DashboardDAO

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
        logger=logger,
    )

    result = tool.run_tool(
        filters=request.filters,
        search=request.search,
        select_columns=request.select_columns,
        order_column=request.order_column,
        order_direction=request.order_direction,
        page=max(request.page - 1, 0),
        page_size=request.page_size,
    )

    # Apply field filtering via serialization context if select_columns specified
    # This triggers DashboardInfo._filter_fields_by_context for each dashboard
    if request.select_columns:
        await ctx.debug(
            "Applying field filtering via serialization context: select_columns=%s"
            % (request.select_columns,)
        )
        # Return dict with context - FastMCP will serialize it
        return result.model_dump(
            mode="json", context={"select_columns": request.select_columns}
        )

    # No filtering - return full result as dict
    return result.model_dump(mode="json")
