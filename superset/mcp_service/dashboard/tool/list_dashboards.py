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

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

from superset.extensions import event_logger
from superset.mcp_service.common.popularity import (
    attach_popularity_scores,
    compute_dashboard_popularity,
    get_popularity_sorted_ids,
)
from superset.mcp_service.dashboard.schemas import (
    DashboardFilter,
    DashboardInfo,
    DashboardList,
    ListDashboardsRequest,
    serialize_dashboard_object,
)
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.system.schemas import PaginationInfo
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)

# Minimal defaults for reduced token usage - users can request more via select_columns
DEFAULT_DASHBOARD_COLUMNS = [
    "id",
    "dashboard_title",
    "slug",
    "description",
    "certified_by",
    "certification_details",
    "url",
    "changed_on",
    "changed_on_humanized",
]

DASHBOARD_SEARCH_COLUMNS = [
    "dashboard_title",
    "slug",
    "uuid",
]


def _attach_popularity_scores(dashboards: list[Any], scores: dict[int, float]) -> None:
    """Attach popularity scores to serialized dashboard objects in-place."""
    for dash in dashboards:
        if dash.id is not None and dash.id in scores:
            dash.popularity_score = scores[dash.id]


@tool(
    tags=["core"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="List dashboards",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def list_dashboards(
    request: ListDashboardsRequest, ctx: Context
) -> DashboardList:
    """List dashboards with filtering and search. Returns dashboard metadata
    including title, slug, URL, and last modified time. Use select_columns to
    request additional fields.

    Sortable columns for order_column: id, dashboard_title, slug, published,
    changed_on, created_on, popularity_score
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

    # Avoid circular imports: DAO and schema_discovery depend on models
    # that import from mcp_service during app initialization
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

    # Two-pass approach when sorting by popularity_score
    if request.order_column == "popularity_score":
        with event_logger.log_context(action="mcp.list_dashboards.popularity_sort"):
            result = _list_dashboards_by_popularity(
                request, DashboardDAO, _serialize_dashboard, all_columns, ctx
            )
    else:
        list_core = ModelListCore(
            dao_class=DashboardDAO,
            output_schema=DashboardInfo,
            item_serializer=_serialize_dashboard,
            filter_type=DashboardFilter,
            default_columns=DEFAULT_DASHBOARD_COLUMNS,
            search_columns=DASHBOARD_SEARCH_COLUMNS,
            list_field_name="dashboards",
            output_list_schema=DashboardList,
            all_columns=all_columns,
            sortable_columns=DASHBOARD_SORTABLE_COLUMNS,
            logger=logger,
        )

        # Strip computed fields before passing to DAO query
        dao_columns = request.select_columns
        if dao_columns:
            dao_columns = [c for c in dao_columns if c != "popularity_score"]
            # Ensure id is loaded when popularity_score was requested
            # (scores are keyed by id)
            if "popularity_score" in request.select_columns and "id" not in dao_columns:
                dao_columns = ["id"] + dao_columns

        with event_logger.log_context(action="mcp.list_dashboards.query"):
            result = list_core.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=dao_columns,
                order_column=request.order_column,
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        # Attach popularity scores if requested in select_columns
        if request.select_columns and "popularity_score" in request.select_columns:
            if dash_ids := [d.id for d in result.dashboards if d.id is not None]:
                scores = compute_dashboard_popularity(dash_ids)
                attach_popularity_scores(result.dashboards, scores)

    count = len(result.dashboards) if hasattr(result, "dashboards") else 0
    total_pages = getattr(result, "total_pages", None)
    await ctx.info(
        "Dashboards listed successfully: count=%s, total_pages=%s"
        % (count, total_pages)
    )

    # Apply field filtering via serialization context
    columns_to_filter = result.columns_requested
    # Re-add popularity_score if it was originally requested
    # (it was stripped before the DAO query since it's computed)
    if (
        request.select_columns
        and "popularity_score" in request.select_columns
        and columns_to_filter
        and "popularity_score" not in columns_to_filter
    ):
        columns_to_filter = list(columns_to_filter) + ["popularity_score"]
    await ctx.debug(
        "Applying field filtering via serialization context: columns=%s"
        % (columns_to_filter,)
    )
    with event_logger.log_context(action="mcp.list_dashboards.serialization"):
        return result.model_dump(
            mode="json", context={"select_columns": columns_to_filter}
        )


def _list_dashboards_by_popularity(
    request: ListDashboardsRequest,
    dao_class: Any,
    serializer: Callable[..., dict[str, Any] | None],
    all_columns: list[str],
    ctx: Context,
) -> DashboardList:
    """Two-pass listing: sort all matching dashboards by popularity score."""
    from superset.mcp_service.common.schema_discovery import (
        DASHBOARD_SORTABLE_COLUMNS,
    )

    sorted_ids, scores, total_count = get_popularity_sorted_ids(
        compute_fn=compute_dashboard_popularity,
        dao_class=dao_class,
        filters=request.filters,
        search=request.search,
        search_columns=DASHBOARD_SEARCH_COLUMNS,
        order_direction=request.order_direction,
    )

    # Apply pagination to sorted IDs
    page = max(request.page - 1, 0)
    page_size = request.page_size
    start = page * page_size
    end = start + page_size

    # Fetch full models for page IDs
    if page_ids := sorted_ids[start:end]:
        items = dao_class.find_by_ids(page_ids)
        id_to_item = {item.id: item for item in items}
        ordered_items = [id_to_item[pid] for pid in page_ids if pid in id_to_item]
    else:
        ordered_items = []

    # Serialize
    select_columns = request.select_columns or DEFAULT_DASHBOARD_COLUMNS
    if "popularity_score" not in select_columns:
        select_columns = list(select_columns) + ["popularity_score"]

    dash_objs = []
    for item in ordered_items:
        obj = serializer(item, select_columns)
        if obj is not None:
            dash_objs.append(obj)

    attach_popularity_scores(dash_objs, scores)

    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
    pagination_info = PaginationInfo(
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=page < total_pages - 1,
        has_previous=page > 0,
    )

    return DashboardList(
        dashboards=dash_objs,
        count=len(dash_objs),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 0,
        has_next=page < total_pages - 1,
        columns_requested=select_columns,
        columns_loaded=select_columns,
        columns_available=all_columns,
        sortable_columns=DASHBOARD_SORTABLE_COLUMNS,
        filters_applied=request.filters if isinstance(request.filters, list) else [],
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc),
    )
