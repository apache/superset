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
List dashboards simple FastMCP tool

This module contains the FastMCP tool for listing dashboards using
simple filtering with individual query parameters.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional, Literal, Annotated

from superset.daos.dashboard import DashboardDAO
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
    DashboardListResponse,
    DashboardListItem,
    PaginationInfo,
    UserInfo,
    TagInfo,
    DashboardSimpleFilters,
)
from pydantic import PositiveInt, Field

logger = logging.getLogger(__name__)


def list_dashboards_simple(
    filters: Annotated[
        Optional[DashboardSimpleFilters],
        Field(description="Simple filter object for dashboard fields")
    ] = None,
    order_column: Annotated[
        Optional[str],
        Field(description="Column to order results by")
    ] = None,
    order_direction: Annotated[
        Literal["asc", "desc"],
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
    search: Annotated[
        Optional[str],
        Field(description="Text search string to match against dataset fields")
    ] = None,
) -> DashboardListResponse:
    """
    SIMPLE FILTERING: List dashboards using individual query parameters
    Args:
        filters: DashboardSimpleFilters model with all filter fields (optional)
        order_column: Column to order by
        order_direction: Order direction ('asc' or 'desc')
        page: Page number for pagination (1-based)
        page_size: Number of items per page
    Returns:
        DashboardListResponse
    """
    if filters is None:
        filters = DashboardSimpleFilters()

    try:
        # Build filters dictionary from model
        filters_dict = filters.model_dump(exclude_none=True)
        dao_wrapper = MCPDAOWrapper(DashboardDAO, "dashboard")
        dashboards, total_count = dao_wrapper.list(
            filters=filters_dict,
            order_column=order_column or "changed_on",
            order_direction=order_direction or "desc",
            page=page-1,
            page_size=page_size,
            search=search,
            search_columns=["dashboard_title", "slug"]
        )
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
            has_previous=page > 1
        )
        response = DashboardListResponse(
            dashboards=dashboard_items,
            count=len(dashboard_items),
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_previous=page > 1,
            has_next=page < total_pages - 1,
            columns_requested=[
                "id", "dashboard_title", "slug", "url", "published",
                "changed_by", "changed_by_name", "changed_on", "changed_on_humanized",
                "created_by", "created_on", "created_on_humanized", "tags", "owners"
            ],
            columns_loaded=list(set([col for item in dashboard_items for col in item.model_dump().keys()])),
            filters_applied=filters_dict,
            pagination=pagination_info,
            timestamp=datetime.now(timezone.utc)
        )
        logger.info(f"Successfully retrieved {len(dashboard_items)} dashboards")
        return response
    except Exception as e:
        error_msg = f"Unexpected error in list_dashboards_simple: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise
