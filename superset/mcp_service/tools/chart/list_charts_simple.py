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
MCP tool: list_charts_simple (simple filtering)
"""
from datetime import datetime, timezone
from typing import Annotated, Optional

from pydantic import Field

from superset.daos.chart import ChartDAO
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas import ChartListResponse, ChartSimpleFilters, \
    PaginationInfo
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object


def list_charts_simple(
    filters: Annotated[
        Optional[ChartSimpleFilters],
        Field(description="Simple filter object for chart fields")
    ] = None,
    order_column: Annotated[
        Optional[str],
        Field(description="Column to order results by")
    ] = None,
    order_direction: Annotated[
        Optional[str],
        Field(description="Direction to order results ('asc' or 'desc')")
    ] = "asc",
    page: Annotated[
        int,
        Field(description="Page number for pagination (1-based)")
    ] = 1,
    page_size: Annotated[
        int,
        Field(description="Number of items per page")
    ] = 100,
    search: Annotated[
        Optional[str],
        Field(description="Text search string to match against chart fields")
    ] = None,
) -> ChartListResponse:
    """
    List charts with simple filtering (MCP tool).
    Returns a ChartListResponse Pydantic model (not a dict), matching list_dashboards_simple and list_datasets_simple.
    """
    filter_dict = filters.model_dump() if filters else {}
    chart_wrapper = MCPDAOWrapper(ChartDAO, "chart")
    charts, total_count = chart_wrapper.list(
        filters=filter_dict,
        order_column=order_column or "changed_on",
        order_direction=order_direction or "desc",
        page=max(page - 1, 0),
        page_size=page_size,
        search=search,
        search_columns=["slice_name", "viz_type", "datasource_name"] if search else None,
    )
    chart_items = [serialize_chart_object(chart) for chart in charts]
    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
    pagination_info = PaginationInfo(
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_next=(page * page_size) < total_count,
        has_previous=page > 1,
    )
    response = ChartListResponse(
        charts=chart_items,
        count=len(chart_items),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=pagination_info.has_previous,
        has_next=pagination_info.has_next,
        columns_requested=[],
        columns_loaded=[],
        filters_applied=filter_dict,
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc),
    )
    return response 
