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
from typing import Any, Dict, List, Literal, Optional, Union, Annotated

from pydantic import BaseModel, ConfigDict, Field
from superset.daos.base import ColumnOperator
from superset.mcp_service.pydantic_schemas.system_schemas import PaginationInfo, \
    TagInfo, UserInfo


class ChartInfo(BaseModel):
    """Full chart model with all possible attributes."""
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

class ChartAvailableFiltersResponse(BaseModel):
    column_operators: Dict[str, Any] = Field(..., description="Available filter operators and metadata for each column")

class ChartError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[Union[str, datetime]] = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

def serialize_chart_object(chart) -> Optional[ChartInfo]:
    if not chart:
        return None
    return ChartInfo(
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
    chart: Optional[ChartInfo] = Field(None, description="The created chart info, if successful")
    embed_url: Optional[str] = Field(None, description="URL to view or embed the chart, if requested.")
    thumbnail_url: Optional[str] = Field(None, description="URL to a thumbnail image of the chart, if requested.")
    embed_html: Optional[str] = Field(None, description="HTML snippet (e.g., iframe) to embed the chart, if requested.")
    error: Optional[str] = Field(None, description="Error message, if creation failed") 

class ChartFilter(ColumnOperator):
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

class ChartList(BaseModel):
    charts: List[ChartInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: Optional[List[str]] = None
    columns_loaded: Optional[List[str]] = None
    filters_applied: List[ChartFilter] = Field(default_factory=list, description="List of advanced filter dicts applied to the query.")
    pagination: Optional[PaginationInfo] = None
    timestamp: Optional[datetime] = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")

# --- New schemas for create_chart tool (polymorphic, viz_type-discriminated) ---

class BaseChartCreateRequest(BaseModel):
    viz_type: str = Field(..., description="Visualization type")
    slice_name: str = Field(..., description="Chart name")
    datasource_id: int = Field(..., description="ID of the datasource (dataset) to use")
    datasource_type: Literal["table"] = Field("table", description="Datasource type (usually 'table')")
    description: Optional[str] = Field(None, description="Chart description")
    owners: Optional[List[int]] = Field(None, description="List of owner user IDs")
    dashboards: Optional[List[int]] = Field(None, description="List of dashboard IDs to add this chart to")
    return_embed: Optional[bool] = Field(False, description="If true, return embeddable chart assets")

# --- DRY base for ECharts timeseries charts ---
class EchartsTimeseriesBaseChartCreateRequest(BaseChartCreateRequest):
    """
    Base schema for ECharts timeseries charts (line, bar, area).
    Now includes additional ECharts options for full frontend compatibility.
    """
    x_axis: str = Field(..., description="Column name or custom SQL for x-axis")
    x_axis_sort: Optional[str] = Field(None, description="Column or metric to sort x-axis by")
    metrics: List[str] = Field(..., description="List of metric names to display")
    groupby: Optional[List[str]] = Field(None, description="List of columns to group by (series)")
    contribution_mode: Optional[Literal["row", "series"]] = Field(None, description="Contribution mode (row or series)")
    filters: Optional[List[Dict[str, Any]]] = Field(None, description="List of filter objects (column or metric)")
    series_limit: Optional[int] = Field(None, description="Series limit")
    orderby: Optional[List[Any]] = Field(None, description="Sort query by columns or metrics")
    row_limit: Optional[int] = Field(None, description="Row limit")
    truncate_metric: Optional[bool] = Field(None, description="Truncate metric (boolean)")
    show_empty_columns: Optional[bool] = Field(None, description="Show empty columns (boolean)")
    # --- New ECharts frontend options ---
    stack: Optional[bool] = Field(None, description="Stack series (ECharts option)")
    area: Optional[bool] = Field(None, description="Show area under line/bar (ECharts option)")
    smooth: Optional[bool] = Field(None, description="Smooth lines (ECharts option)")
    show_value: Optional[bool] = Field(None, description="Show values on chart (ECharts option)")
    color_scheme: Optional[str] = Field(None, description="Color scheme (ECharts option)")
    legend_type: Optional[str] = Field(None, description="Legend type (ECharts option)")
    legend_orientation: Optional[str] = Field(None, description="Legend orientation (ECharts option)")
    tooltip_sorting: Optional[str] = Field(None, description="Tooltip sorting (ECharts option)")
    y_axis_format: Optional[str] = Field(None, description="Y axis format (ECharts option)")
    y_axis_bounds: Optional[List[float]] = Field(None, description="Y axis bounds (ECharts option)")
    x_axis_time_format: Optional[str] = Field(None, description="X axis time format (ECharts option)")
    rich_tooltip: Optional[bool] = Field(None, description="Enable rich tooltip (ECharts option)")
    extra_options: Optional[Dict[str, Any]] = Field(None, description="Additional ECharts options not yet modeled (future-proof)")

class EchartsTimeseriesLineChartCreateRequest(EchartsTimeseriesBaseChartCreateRequest):
    viz_type: Literal["echarts_timeseries_line"] = Field("echarts_timeseries_line", description="Visualization type")

class EchartsTimeseriesBarChartCreateRequest(EchartsTimeseriesBaseChartCreateRequest):
    viz_type: Literal["echarts_timeseries_bar"] = Field("echarts_timeseries_bar", description="Visualization type")

class EchartsAreaChartCreateRequest(EchartsTimeseriesBaseChartCreateRequest):
    viz_type: Literal["echarts_area"] = Field("echarts_area", description="Visualization type")

class TableChartCreateRequest(BaseChartCreateRequest):
    viz_type: Literal["table"] = Field("table", description="Visualization type")
    all_columns: List[str] = Field(..., description="List of columns to display")
    metrics: Optional[List[str]] = Field(None, description="List of metric names to display")
    groupby: Optional[List[str]] = Field(None, description="List of columns to group by")
    adhoc_filters: Optional[List[Dict[str, Any]]] = Field(None, description="List of adhoc filter objects")
    order_by_cols: Optional[List[Any]] = Field(None, description="Order by columns")
    row_limit: Optional[int] = Field(None, description="Row limit")
    order_desc: Optional[bool] = Field(None, description="Order descending")

