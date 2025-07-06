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
MCP tool: list_charts (advanced filtering)
"""
from typing import Any, Dict, List, Optional, Literal, Annotated, Union
from superset.mcp_service.pydantic_schemas import ChartListResponse, ChartListItem
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object
from datetime import datetime, timezone
from pydantic import BaseModel, conlist, constr, PositiveInt, Field
from superset.mcp_service.pydantic_schemas.dashboard_schemas import PaginationInfo
from superset.daos.chart import ChartDAO


class ChartFilter(BaseModel):
    """
    Filter object for chart listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """
    col: Literal[
        "slice_name",
        "viz_type",
        "datasource_name",
        "changed_by",
        "created_by",
        "owner",
        "tags"
    ] = Field(..., description="Column to filter on. See get_chart_available_filters for allowed values.")
    opr: Literal[
        "eq", "ne", "sw", "in", "not_in", "like", "ilike", "gt", "lt", "gte", "lte", "is_null", "is_not_null"
    ] = Field(..., description="Operator to use. See get_chart_available_filters for allowed values.")
    value: Any = Field(..., description="Value to filter by (type depends on col and opr)")

def list_charts(
    filters: Annotated[
        Optional[conlist(ChartFilter, min_length=1)],
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
        Field(description="Text search string to match against chart fields")
    ] = None,
) -> ChartListResponse:
    """
    List charts with advanced filtering (MCP tool).
    Returns a ChartListResponse Pydantic model (not a dict), matching list_dashboards and list_datasets.
    """
    # Convert complex filters to simple filters for DAO
    simple_filters = {}
    if filters:
        for filter_obj in filters:
            if isinstance(filter_obj, ChartFilter):
                col = filter_obj.col
                value = filter_obj.value
                if filter_obj.opr == 'eq':
                    simple_filters[col] = value
                elif filter_obj.opr == 'sw':
                    simple_filters[col] = f"{value}%"
                else:
                    # Add support for other operators as needed
                    simple_filters[col] = value
    chart_wrapper = MCPDAOWrapper(ChartDAO, "chart")
    charts, total_count = chart_wrapper.list(
        filters=simple_filters,
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
        has_next=page < total_pages,
        has_previous=page > 1
    )
    response = ChartListResponse(
        charts=chart_items,
        count=len(chart_items),
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_previous=page > 1,
        has_next=page < total_pages,
        columns_requested=columns or [],
        columns_loaded=columns or [],
        filters_applied=simple_filters,
        pagination=pagination_info,
        timestamp=datetime.now(timezone.utc),
    )
    return response 
