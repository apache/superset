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
List dashboards FastMCP tool (Advanced)

This module contains the FastMCP tool for listing dashboards using
advanced filtering with complex filter objects and JSON payload.
"""
import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Literal, Optional

from pydantic import BaseModel, conlist, constr, Field, PositiveInt
from superset.daos.dashboard import DashboardDAO
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
    DashboardListItem, DashboardListResponse, PaginationInfo, TagInfo, UserInfo, )

logger = logging.getLogger(__name__)


class DashboardFilter(BaseModel):
    """
    Filter object for dashboard listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """
    col: Literal[
        "dashboard_title",
        "published",
        "changed_by",
        "created_by",
        "owner",
        "certified",
        "favorite",
        "chart_count",
        "tags"
    ] = Field(..., description="Column to filter on. See get_dashboard_available_filters for allowed values.")
    opr: Literal[
        "eq", "ne", "in", "nin", "sw", "ew", "gte", "lte", "gt", "lt"
    ] = Field(..., description="Operator to use. See get_dashboard_available_filters for allowed values.")
    value: Any = Field(..., description="Value to filter by (type depends on col and opr)")


def list_dashboards(
    filters: Annotated[
        Optional[conlist(DashboardFilter, min_length=1)],
        Field(description="List of filter objects (column, operator, value)")
    ] = None,
    columns: Annotated[
        Optional[conlist(constr(strip_whitespace=True, min_length=1), min_length=1)],
        Field(description="List of columns to include in the response")
    ] = None,
    keys: Annotated[
        Optional[conlist(constr(strip_whitespace=True, min_length=1), min_length=1)],
        Field(description="List of keys to include in the response")
    ] = None,
    order_column: Annotated[
        Optional[constr(strip_whitespace=True, min_length=1)],
        Field(description="Column to order results by")
    ] = None,
    order_direction: Annotated[
        Optional[Literal["asc", "desc"]],
        Field(description="Direction to order results ('asc' or 'desc')")
    ] = "asc",
    page: Annotated[
        PositiveInt,
        Field(description="Page number for pagination (1-based)")
    ] = 1,
    page_size: Annotated[
        PositiveInt,
        Field(description="Number of items per page")
    ] = 100,
    select_columns: Annotated[
        Optional[conlist(constr(strip_whitespace=True, min_length=1), min_length=1)],
        Field(description="List of columns to select (overrides 'columns' and 'keys')")
    ] = None,
    search: Annotated[
        Optional[str],
        Field(description="Text search string to match against dataset fields")
    ] = None,
) -> DashboardListResponse:
    """
    ADVANCED FILTERING: List dashboards using complex filter objects and JSON payload
    Returns a DashboardListResponse Pydantic model (not a dict), matching list_dashboards_simple.
    """
    # Convert complex filters to simple filters for DAO
    simple_filters = {}
    if filters:
        for filter_obj in filters:
            if isinstance(filter_obj, DashboardFilter):
                col = filter_obj.col
                value = filter_obj.value
                if filter_obj.opr == 'eq':
                    simple_filters[col] = value
                elif filter_obj.opr == 'sw':
                    simple_filters[col] = f"{value}%"
    # Use the generic DAO wrapper
    dao_wrapper = MCPDAOWrapper(DashboardDAO, "dashboard")
    dashboards, total_count = dao_wrapper.list(
        filters=simple_filters,
        order_column=order_column or "changed_on",
        order_direction=order_direction or "desc",
        page=max(page - 1, 0),
        page_size=page_size,
        search=search,
        search_columns=["dashboard_title", "slug"]
    )
    columns_to_load = []
    if select_columns:
        if isinstance(select_columns, str):
            select_columns = [col.strip() for col in select_columns.split(",") if col.strip()]
        columns_to_load = select_columns
    elif columns:
        columns_to_load = columns
    elif keys:
        columns_to_load = keys
    else:
        columns_to_load = [
            "id", "dashboard_title", "slug", "url", "published",
            "changed_by_name", "changed_on", "created_by_name", "created_on"
        ]
    dashboard_items = []
    for dashboard in dashboards:
        dashboard_item = DashboardListItem(
            id=dashboard.id,
            dashboard_title=dashboard.dashboard_title or "Untitled",
            slug=dashboard.slug or "",
            url=dashboard.url,
            published=dashboard.published,
            changed_by=getattr(dashboard, "changed_by_name", None) or (
                str(dashboard.changed_by) if dashboard.changed_by else None),
            changed_by_name=getattr(dashboard, "changed_by_name", None) or (
                str(dashboard.changed_by) if dashboard.changed_by else None),
            changed_on=dashboard.changed_on if getattr(dashboard, "changed_on", None) else None,
            changed_on_humanized=getattr(dashboard, "changed_on_humanized", None),
            created_by=getattr(dashboard, "created_by_name", None) or (
                str(dashboard.created_by) if dashboard.created_by else None),
            created_on=dashboard.created_on if getattr(dashboard, "created_on", None) else None,
            created_on_humanized=getattr(dashboard, "created_on_humanized", None),
            tags=[TagInfo.model_validate(tag, from_attributes=True) for tag in dashboard.tags] if dashboard.tags else [],
            owners=[UserInfo.model_validate(owner, from_attributes=True) for owner in dashboard.owners] if dashboard.owners else []
        )
        dashboard_items.append(dashboard_item)
    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
    pagination_info = PaginationInfo(
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=page < total_pages - 1,
        has_previous=page > 0
    )
    response = DashboardListResponse(
        dashboards=dashboard_items,
        count=len(dashboard_items),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 0,
        has_next=page < total_pages - 1,
        columns_requested=columns_to_load,
        columns_loaded=list(set([col for item in dashboard_items for col in item.model_dump().keys()])),
        filters_applied=simple_filters,
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc)
    )
    logger.info(f"Successfully retrieved {len(dashboard_items)} dashboards")
    return response
