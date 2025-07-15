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
import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import conlist, constr, Field, PositiveInt

from superset.daos.dashboard import DashboardDAO
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas import (
    DashboardFilter, DashboardInfo, DashboardList)
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    serialize_chart_object, )
from superset.mcp_service.pydantic_schemas.system_schemas import (
    PaginationInfo, TagInfo, UserInfo)

logger = logging.getLogger(__name__)


def list_dashboards(
    filters: Annotated[
        Optional[conlist(DashboardFilter, min_length=0)],
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
) -> DashboardList:
    """
    ADVANCED FILTERING: List dashboards using complex filter objects and JSON payload
    Returns a DashboardList Pydantic model (not a dict), matching
    list_dashboards_simple.
    """
    # If filters is a string (e.g., from a test), parse it as JSON
    if isinstance(filters, str):
        filters = json.loads(filters)
    dao_wrapper = MCPDAOWrapper(DashboardDAO, "dashboard")
    search_columns = (
        "dashboard_title",
        "owners",
        "published",
        "roles",
        "slug",
        "tags",
        "uuid",
    )
    dashboards, total_count = dao_wrapper.list(
        column_operators=filters,
        order_column=order_column or "changed_on",
        order_direction=order_direction or "desc",
        page=max(page - 1, 0),
        page_size=page_size,
        search=search,
        search_columns=search_columns
    )
    columns_to_load = []
    if select_columns:
        if isinstance(select_columns, str):
            select_columns = [col.strip() for col in select_columns.split(",") if
                              col.strip()]
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
        dashboard_item = DashboardInfo(
            id=dashboard.id,
            dashboard_title=dashboard.dashboard_title or "Untitled",
            slug=dashboard.slug or "",
            url=dashboard.url,
            published=dashboard.published,
            changed_by=getattr(dashboard, "changed_by_name", None) or (
                str(dashboard.changed_by) if dashboard.changed_by else None),
            changed_by_name=getattr(dashboard, "changed_by_name", None) or (
                str(dashboard.changed_by) if dashboard.changed_by else None),
            changed_on=dashboard.changed_on if getattr(
                dashboard, "changed_on", None) else None,
            changed_on_humanized=getattr(dashboard, "changed_on_humanized", None),
            created_by=getattr(dashboard, "created_by_name", None) or (
                str(dashboard.created_by) if dashboard.created_by else None),
            created_on=dashboard.created_on if getattr(
                dashboard, "created_on", None) else None,
            created_on_humanized=getattr(dashboard, "created_on_humanized", None),
            tags=[TagInfo.model_validate(tag, from_attributes=True) for tag in
                  dashboard.tags] if dashboard.tags else [],
            owners=[UserInfo.model_validate(owner, from_attributes=True) for owner in
                    dashboard.owners] if dashboard.owners else [],
            charts=[serialize_chart_object(chart) for chart in
                    getattr(dashboard, 'slices', [])] if getattr(
                dashboard, 'slices', None) else [],
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
    response = DashboardList(
        dashboards=dashboard_items,
        count=len(dashboard_items),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 1,
        has_next=page < total_pages - 1,
        columns_requested=columns or [],
        columns_loaded=columns or [],
        filters_applied=filters if isinstance(filters, list) else [],
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc)
    )
    logger.info(f"Successfully retrieved {len(dashboard_items)} dashboards")
    return response
