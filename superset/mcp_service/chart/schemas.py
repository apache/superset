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

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Literal, Protocol

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
    PositiveInt,
)

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.cache_schemas import MetadataCacheControl
from superset.mcp_service.system.schemas import (
    PaginationInfo,
    TagInfo,
    UserInfo,
)


class ChartLike(Protocol):
    """Protocol for chart-like objects with expected attributes."""

    id: int
    slice_name: str | None
    viz_type: str | None
    datasource_name: str | None
    datasource_type: str | None
    url: str | None
    description: str | None
    cache_timeout: int | None
    form_data: Dict[str, Any] | None
    query_context: Any | None
    changed_by: Any | None  # User object
    changed_by_name: str | None
    changed_on: str | datetime | None
    changed_on_humanized: str | None
    created_by: Any | None  # User object
    created_by_name: str | None
    created_on: str | datetime | None
    created_on_humanized: str | None
    uuid: str | None
    tags: List[Any] | None
    owners: List[Any] | None


class ChartInfo(BaseModel):
    """Full chart model with all possible attributes."""

    id: int = Field(..., description="Chart ID")
    slice_name: str = Field(..., description="Chart name")
    viz_type: str | None = Field(None, description="Visualization type")
    datasource_name: str | None = Field(None, description="Datasource name")
    datasource_type: str | None = Field(None, description="Datasource type")
    url: str | None = Field(None, description="Chart URL")
    description: str | None = Field(None, description="Chart description")
    cache_timeout: int | None = Field(None, description="Cache timeout")
    form_data: Dict[str, Any] | None = Field(None, description="Chart form data")
    query_context: Any | None = Field(None, description="Query context")
    changed_by: str | None = Field(None, description="Last modifier (username)")
    changed_by_name: str | None = Field(
        None, description="Last modifier (display name)"
    )
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    changed_on_humanized: str | None = Field(
        None, description="Humanized modification time"
    )
    created_by: str | None = Field(None, description="Chart creator (username)")
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    created_on_humanized: str | None = Field(
        None, description="Humanized creation time"
    )
    uuid: str | None = Field(None, description="Chart UUID")
    tags: List[TagInfo] = Field(default_factory=list, description="Chart tags")
    owners: List[UserInfo] = Field(default_factory=list, description="Chart owners")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class ChartError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Error timestamp",
    )
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class GetChartInfoRequest(BaseModel):
    """Request schema for get_chart_info with support for ID or UUID."""

    identifier: Annotated[
        int | str,
        Field(description="Chart identifier - can be numeric ID or UUID string"),
    ]


def serialize_chart_object(chart: ChartLike | None) -> ChartInfo | None:
    if not chart:
        return None

    # TODO (Phase 3): Generate MCP service screenshot URL
    # For now, use chart's native URL instead of screenshot URL
    # Screenshot functionality will be added in Phase 3 PR

    chart_id = getattr(chart, "id", None)
    chart_url = getattr(chart, "url", None)

    return ChartInfo(
        id=chart_id,
        slice_name=getattr(chart, "slice_name", None),
        viz_type=getattr(chart, "viz_type", None),
        datasource_name=getattr(chart, "datasource_name", None),
        datasource_type=getattr(chart, "datasource_type", None),
        url=chart_url,
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
        uuid=str(getattr(chart, "uuid", "")) if getattr(chart, "uuid", None) else None,
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
    value: str | int | float | bool | List[str | int | float | bool] = Field(
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
    columns_requested: List[str] | None = None
    columns_loaded: List[str] | None = None
    filters_applied: List[ChartFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListChartsRequest(MetadataCacheControl):
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
                "uuid",
            ],
            description="List of columns to select. Defaults to common columns if not "
            "specified.",
        ),
    ]
    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search string to match against chart fields. Cannot be "
            "used together with 'filters'.",
        ),
    ]
    order_column: Annotated[
        str | None, Field(default=None, description="Column to order results by")
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
        PositiveInt, Field(default=10, description="Number of items per page")
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
