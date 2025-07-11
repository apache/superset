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
Pydantic schemas for chart-related responses
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Literal
from pydantic import BaseModel, Field, ConfigDict
from .dashboard_schemas import UserInfo, TagInfo, PaginationInfo

class ChartListItem(BaseModel):
    """Chart item for list responses"""
    id: int = Field(..., description="Chart ID")
    slice_name: str = Field(..., description="Chart name")
    viz_type: Optional[str] = Field(None, description="Visualization type")
    datasource_name: Optional[str] = Field(None, description="Datasource name")
    datasource_type: Optional[str] = Field(None, description="Datasource type")
    url: Optional[str] = Field(None, description="Chart URL")
    description: Optional[str] = Field(None, description="Chart description")
    cache_timeout: Optional[int] = Field(None, description="Cache timeout")
    form_data: Optional[Dict[str, Any]] = Field(None, description="Chart form data")
    query_context: Optional[Any] = Field(None, description="Query context")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    changed_by_name: Optional[str] = Field(None, description="Last modifier (display name)")
    changed_on: Optional[Union[str, datetime]] = Field(None, description="Last modification timestamp")
    changed_on_humanized: Optional[str] = Field(None, description="Humanized modification time")
    created_by: Optional[str] = Field(None, description="Chart creator (username)")
    created_on: Optional[Union[str, datetime]] = Field(None, description="Creation timestamp")
    created_on_humanized: Optional[str] = Field(None, description="Humanized creation time")
    tags: List[TagInfo] = Field(default_factory=list, description="Chart tags")
    owners: List[UserInfo] = Field(default_factory=list, description="Chart owners")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")

class ChartSimpleFilters(BaseModel):
    slice_name: Optional[str] = Field(None, description="Filter by chart name (partial match)")
    viz_type: Optional[str] = Field(None, description="Filter by visualization type")
    datasource_name: Optional[str] = Field(None, description="Filter by datasource name")
    changed_by: Optional[str] = Field(None, description="Filter by last modifier (username)")
    created_by: Optional[str] = Field(None, description="Filter by creator (username)")
    owner: Optional[str] = Field(None, description="Filter by owner (username)")
    tags: Optional[str] = Field(None, description="Filter by tags (comma-separated)")

class ChartAvailableFiltersResponse(BaseModel):
    filters: Dict[str, Any] = Field(..., description="Available filters and their metadata")
    operators: List[str] = Field(..., description="Supported filter operators")
    columns: List[str] = Field(..., description="Available columns for filtering")

class ChartInfoResponse(BaseModel):
    chart: ChartListItem = Field(..., description="Detailed chart info")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")

class ChartListResponse(BaseModel):
    charts: List[ChartInfoResponse]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: Optional[List[str]] = None
    columns_loaded: Optional[List[str]] = None
    filters_applied: List[dict] = Field(default_factory=list, description="List of advanced filter dicts applied to the query.")
    pagination: Optional[PaginationInfo] = None
    timestamp: Optional[datetime] = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")

class ChartErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[Union[str, datetime]] = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

def serialize_chart_object(chart) -> Optional[ChartListItem]:
    if not chart:
        return None
    return ChartListItem(
        id=getattr(chart, 'id', None),
        slice_name=getattr(chart, 'slice_name', None),
        viz_type=getattr(chart, 'viz_type', None),
        datasource_name=getattr(chart, 'datasource_name', None),
        datasource_type=getattr(chart, 'datasource_type', None),
        url=getattr(chart, 'url', None),
        description=getattr(chart, 'description', None),
        cache_timeout=getattr(chart, 'cache_timeout', None),
        form_data=getattr(chart, 'form_data', None),
        query_context=getattr(chart, 'query_context', None),
        changed_by=getattr(chart, 'changed_by_name', None) or (str(chart.changed_by) if getattr(chart, 'changed_by', None) else None),
        changed_by_name=getattr(chart, 'changed_by_name', None) or (str(chart.changed_by) if getattr(chart, 'changed_by', None) else None),
        changed_on=getattr(chart, 'changed_on', None),
        changed_on_humanized=getattr(chart, 'changed_on_humanized', None),
        created_by=getattr(chart, 'created_by_name', None) or (str(chart.created_by) if getattr(chart, 'created_by', None) else None),
        created_on=getattr(chart, 'created_on', None),
        created_on_humanized=getattr(chart, 'created_on_humanized', None),
        tags=[TagInfo.model_validate(tag, from_attributes=True) for tag in getattr(chart, 'tags', [])] if getattr(chart, 'tags', None) else [],
        owners=[UserInfo.model_validate(owner, from_attributes=True) for owner in getattr(chart, 'owners', [])] if getattr(chart, 'owners', None) else [],
    ) 

class CreateSimpleChartRequest(BaseModel):
    """
    Request schema for creating a simple chart via MCP.
    """
    slice_name: str = Field(..., description="Chart name")
    viz_type: str = Field(..., description="Visualization type (e.g., bar, line, table, pie)")
    datasource_id: int = Field(..., description="ID of the datasource (dataset) to use")
    datasource_type: Literal["table"] = Field("table", description="Datasource type (usually 'table')")
    metrics: List[str] = Field(..., description="List of metric names to display")
    dimensions: List[str] = Field(..., description="List of dimension (column) names to group by")
    filters: Optional[List[Dict[str, Any]]] = Field(None, description="List of filter objects (column, operator, value)")
    description: Optional[str] = Field(None, description="Chart description")
    owners: Optional[List[int]] = Field(None, description="List of owner user IDs")
    dashboards: Optional[List[int]] = Field(None, description="List of dashboard IDs to add this chart to")
    return_embed: Optional[bool] = Field(False, description="If true, return embeddable chart assets (embed_url, thumbnail_url, embed_html) in the response.")

class CreateSimpleChartResponse(BaseModel):
    """
    Response schema for create_chart_simple tool.
    """
    chart: Optional[ChartListItem] = Field(None, description="The created chart info, if successful")
    embed_url: Optional[str] = Field(None, description="URL to view or embed the chart, if requested.")
    thumbnail_url: Optional[str] = Field(None, description="URL to a thumbnail image of the chart, if requested.")
    embed_html: Optional[str] = Field(None, description="HTML snippet (e.g., iframe) to embed the chart, if requested.")
    error: Optional[str] = Field(None, description="Error message, if creation failed") 

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
