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
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator, PositiveInt

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.pydantic_schemas.system_schemas import (
    PaginationInfo,
    TagInfo,
    UserInfo,
)


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
    changed_by_name: Optional[str] = Field(
        None, description="Last modifier (display name)"
    )
    changed_on: Optional[Union[str, datetime]] = Field(
        None, description="Last modification timestamp"
    )
    changed_on_humanized: Optional[str] = Field(
        None, description="Humanized modification time"
    )
    created_by: Optional[str] = Field(None, description="Chart creator (username)")
    created_on: Optional[Union[str, datetime]] = Field(
        None, description="Creation timestamp"
    )
    created_on_humanized: Optional[str] = Field(
        None, description="Humanized creation time"
    )
    tags: List[TagInfo] = Field(default_factory=list, description="Chart tags")
    owners: List[UserInfo] = Field(default_factory=list, description="Chart owners")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class ChartAvailableFiltersResponse(BaseModel):
    column_operators: Dict[str, Any] = Field(
        ..., description="Available filter operators and metadata for each column"
    )


class ChartError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[Union[str, datetime]] = Field(
        None, description="Error timestamp"
    )
    model_config = ConfigDict(ser_json_timedelta="iso8601")


def serialize_chart_object(chart: Any) -> Optional[ChartInfo]:
    if not chart:
        return None
    return ChartInfo(
        id=getattr(chart, "id", None),
        slice_name=getattr(chart, "slice_name", None),
        viz_type=getattr(chart, "viz_type", None),
        datasource_name=getattr(chart, "datasource_name", None),
        datasource_type=getattr(chart, "datasource_type", None),
        url=getattr(chart, "url", None),
        description=getattr(chart, "description", None),
        cache_timeout=getattr(chart, "cache_timeout", None),
        form_data=getattr(chart, "form_data", None),
        query_context=getattr(chart, "query_context", None),
        changed_by=getattr(chart, "changed_by_name", None)
        or (str(chart.changed_by) if getattr(chart, "changed_by", None) else None),
        changed_by_name=getattr(chart, "changed_by_name", None),
        changed_on=getattr(chart, "changed_on", None),
        changed_on_humanized=getattr(chart, "changed_on_humanized", None),
        created_by=getattr(chart, "created_by_name", None)
        or (str(chart.created_by) if getattr(chart, "created_by", None) else None),
        created_on=getattr(chart, "created_on", None),
        created_on_humanized=getattr(chart, "created_on_humanized", None),
        tags=[
            TagInfo.model_validate(tag, from_attributes=True)
            for tag in getattr(chart, "tags", [])
        ]
        if getattr(chart, "tags", None)
        else [],
        owners=[
            UserInfo.model_validate(owner, from_attributes=True)
            for owner in getattr(chart, "owners", [])
        ]
        if getattr(chart, "owners", None)
        else [],
    )


class CreateChartResponse(BaseModel):
    """
    Response schema for create_chart tool.
    """

    chart: Optional[ChartInfo] = Field(
        None, description="The created chart info, if successful"
    )
    embed_url: Optional[str] = Field(
        None, description="URL to view or embed the chart, if requested."
    )
    thumbnail_url: Optional[str] = Field(
        None, description="URL to a thumbnail image of the chart, if requested."
    )
    embed_html: Optional[str] = Field(
        None,
        description="HTML snippet (e.g., iframe) to embed the chart, if requested.",
    )
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
    ] = Field(
        ...,
        description="Column to filter on. See get_chart_available_filters for "
        "allowed values.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. See get_chart_available_filters for "
        "allowed values.",
    )
    value: Any = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


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
    filters_applied: List[ChartFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: Optional[PaginationInfo] = None
    timestamp: Optional[datetime] = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


# --- Simplified schemas for create_chart tool ---


# Common pieces
class ColumnRef(BaseModel):
    name: str = Field(..., description="Column name")
    label: Optional[str] = Field(None, description="Display label for the column")
    dtype: Optional[str] = Field(None, description="Data type hint")
    aggregate: Optional[str] = Field(
        None, description="SQL aggregation function (SUM, COUNT, AVG, MIN, MAX, etc.)"
    )


class AxisConfig(BaseModel):
    title: Optional[str] = Field(None, description="Axis title")
    scale: Optional[Literal["linear", "log"]] = Field(
        "linear", description="Axis scale type"
    )
    format: Optional[str] = Field(None, description="Format string (e.g. '$,.2f')")


class LegendConfig(BaseModel):
    show: bool = Field(True, description="Whether to show legend")
    position: Optional[Literal["top", "bottom", "left", "right"]] = Field(
        "right", description="Legend position"
    )


class FilterConfig(BaseModel):
    column: str = Field(..., description="Column to filter on")
    op: Literal["=", ">", "<", ">=", "<=", "!="] = Field(
        ..., description="Filter operator"
    )
    value: Union[str, int, float, bool] = Field(..., description="Filter value")


# Actual chart types
class TableChartConfig(BaseModel):
    chart_type: Literal["table"] = Field("table", description="Chart type")
    columns: List[ColumnRef] = Field(..., description="Columns to display")
    filters: Optional[List[FilterConfig]] = Field(None, description="Filters to apply")
    sort_by: Optional[List[str]] = Field(None, description="Columns to sort by")


class XYChartConfig(BaseModel):
    chart_type: Literal["xy"] = Field("xy", description="Chart type")
    x: ColumnRef = Field(..., description="X-axis column")
    y: List[ColumnRef] = Field(..., description="Y-axis columns")
    kind: Literal["line", "bar", "area", "scatter"] = Field(
        "line", description="Chart visualization type"
    )
    group_by: Optional[ColumnRef] = Field(None, description="Column to group by")
    x_axis: Optional[AxisConfig] = Field(None, description="X-axis configuration")
    y_axis: Optional[AxisConfig] = Field(None, description="Y-axis configuration")
    legend: Optional[LegendConfig] = Field(None, description="Legend configuration")
    filters: Optional[List[FilterConfig]] = Field(None, description="Filters to apply")


# Discriminated union entry point
ChartConfig = Union[TableChartConfig, XYChartConfig]


class ListChartsRequest(BaseModel):
    """Request schema for list_charts with clear, unambiguous types."""

    filters: Annotated[
        List[ChartFilter],
        Field(
            default_factory=list,
            description="List of filter objects (column, operator, value). Each "
            "filter is an object with 'col', 'opr', and 'value' "
            "properties. Cannot be used together with 'search'.",
        ),
    ]
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=lambda: [
                "id",
                "slice_name",
                "viz_type",
                "datasource_name",
                "description",
                "changed_by_name",
                "created_by_name",
                "changed_on",
                "created_on",
            ],
            description="List of columns to select. Defaults to common columns if not "
            "specified.",
        ),
    ]
    search: Annotated[
        Optional[str],
        Field(
            default=None,
            description="Text search string to match against chart fields. Cannot be "
            "used together with 'filters'.",
        ),
    ]
    order_column: Annotated[
        Optional[str], Field(default=None, description="Column to order results by")
    ]
    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(
            default="asc", description="Direction to order results ('asc' or 'desc')"
        ),
    ]
    page: Annotated[
        PositiveInt,
        Field(default=1, description="Page number for pagination (1-based)"),
    ]
    page_size: Annotated[
        PositiveInt, Field(default=100, description="Number of items per page")
    ]

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListChartsRequest":
        """Prevent using both search and filters simultaneously to avoid query
        conflicts."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


# The tool input models
class CreateChartRequest(BaseModel):
    dataset_id: str = Field(..., description="ID of the dataset to use")
    config: ChartConfig = Field(..., description="Chart configuration")


class GenerateExploreLinkRequest(BaseModel):
    dataset_id: str = Field(..., description="ID of the dataset to explore")
    config: ChartConfig = Field(..., description="Chart configuration")
