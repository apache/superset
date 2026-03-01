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
Pydantic schemas for dashboard-related responses

This module contains Pydantic models for serializing dashboard data
in a consistent and type-safe manner.

Example usage:
    # For detailed dashboard info
    dashboard_info = DashboardInfo(
        id=1,
        dashboard_title="Sales Dashboard",
        published=True,
        owners=[UserInfo(id=1, username="admin")],
        charts=[ChartInfo(id=1, slice_name="Sales Chart")]
    )

    # For dashboard list responses
    dashboard_list = DashboardList(
        dashboards=[
            DashboardInfo(
                id=1,
                dashboard_title="Sales Dashboard",
                published=True,
                tags=[TagInfo(id=1, name="sales")]
            )
        ],
        count=1,
        total_count=1,
        page=0,
        page_size=10,
        total_pages=1,
        has_next=False,
        has_previous=False,
        columns_requested=["id", "dashboard_title"],
        columns_loaded=["id", "dashboard_title", "published"],
        filters_applied={"published": True},
        pagination=PaginationInfo(
            page=0,
            page_size=10,
            total_count=1,
            total_pages=1,
            has_next=False,
            has_previous=False
        ),
        timestamp=datetime.now(timezone.utc)
    )
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, TYPE_CHECKING

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
    model_validator,
    PositiveInt,
)

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.chart.schemas import ChartInfo, serialize_chart_object
from superset.mcp_service.common.cache_schemas import MetadataCacheControl
from superset.mcp_service.system.schemas import (
    PaginationInfo,
    RoleInfo,
    TagInfo,
    UserInfo,
)


class DashboardError(BaseModel):
    """Error response for dashboard operations"""

    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")

    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "DashboardError":
        """Create a standardized DashboardError with timestamp."""
        from datetime import datetime

        return cls(error=error, error_type=error_type, timestamp=datetime.now())


def serialize_user_object(user: Any) -> UserInfo | None:
    """Serialize a user object to UserInfo"""
    if not user:
        return None

    return UserInfo(
        id=getattr(user, "id", None),
        username=getattr(user, "username", None),
        first_name=getattr(user, "first_name", None),
        last_name=getattr(user, "last_name", None),
        email=getattr(user, "email", None),
        active=getattr(user, "active", None),
    )


def serialize_tag_object(tag: Any) -> TagInfo | None:
    """Serialize a tag object to TagInfo"""
    if not tag:
        return None

    return TagInfo(
        id=getattr(tag, "id", None),
        name=getattr(tag, "name", None),
        type=getattr(tag, "type", None),
        description=getattr(tag, "description", None),
    )


def serialize_role_object(role: Any) -> RoleInfo | None:
    """Serialize a role object to RoleInfo"""
    if not role:
        return None

    return RoleInfo(
        id=getattr(role, "id", None),
        name=getattr(role, "name", None),
        permissions=[perm.name for perm in getattr(role, "permissions", [])]
        if hasattr(role, "permissions")
        else None,
    )


class DashboardFilter(ColumnOperator):
    """
    Filter object for dashboard listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "dashboard_title",
        "published",
        "favorite",
        "created_by_fk",
    ] = Field(
        ...,
        description=(
            "Column to filter on. Use "
            "get_schema(model_type='dashboard') for available "
            "filter columns. Use created_by_fk with the user "
            "ID from get_instance_info's current_user to find "
            "dashboards created by a specific user."
        ),
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Use get_schema(model_type='dashboard') for "
        "available operators.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class ListDashboardsRequest(MetadataCacheControl):
    """Request schema for list_dashboards with clear, unambiguous types."""

    filters: Annotated[
        List[DashboardFilter],
        Field(
            default_factory=list,
            description="List of filter objects (column, operator, value). Each "
            "filter is an object with 'col', 'opr', and 'value' properties. "
            "Cannot be used together with 'search'.",
        ),
    ]
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=list,
            description="List of columns to select. Defaults to common columns "
            "if not specified.",
        ),
    ]

    @field_validator("filters", mode="before")
    @classmethod
    def parse_filters(cls, v: Any) -> List[DashboardFilter]:
        """
        Parse filters from JSON string or list.

        Handles Claude Code bug where objects are double-serialized as strings.
        See: https://github.com/anthropics/claude-code/issues/5504
        """
        from superset.mcp_service.utils.schema_utils import parse_json_or_model_list

        return parse_json_or_model_list(v, DashboardFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_select_columns(cls, v: Any) -> List[str]:
        """
        Parse select_columns from JSON string, list, or CSV string.

        Handles Claude Code bug where arrays are double-serialized as strings.
        See: https://github.com/anthropics/claude-code/issues/5504
        """
        from superset.mcp_service.utils.schema_utils import parse_json_or_list

        return parse_json_or_list(v, "select_columns")

    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search string to match against dashboard fields. "
            "Cannot be used together with 'filters'.",
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
    def validate_search_and_filters(self) -> "ListDashboardsRequest":
        """Prevent using both search and filters simultaneously to avoid query
        conflicts."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class GetDashboardInfoRequest(MetadataCacheControl):
    """Request schema for get_dashboard_info with support for ID, UUID, or slug.

    When permalink_key is provided, the tool will retrieve the dashboard's filter
    state from the permalink, allowing you to see what filters the user has applied
    (not just the default filter state). This is useful when a user applies filters
    in a dashboard but the URL contains a permalink_key.
    """

    identifier: Annotated[
        int | str,
        Field(
            description="Dashboard identifier - can be numeric ID, UUID string, or slug"
        ),
    ]
    permalink_key: str | None = Field(
        default=None,
        description=(
            "Optional permalink key for retrieving dashboard filter state. When a "
            "user applies filters in a dashboard, the state can be persisted in a "
            "permalink. If provided, the tool returns the filter configuration "
            "from that permalink."
        ),
    )


class DashboardInfo(BaseModel):
    id: int | None = Field(None, description="Dashboard ID")
    dashboard_title: str | None = Field(None, description="Dashboard title")
    slug: str | None = Field(None, description="Dashboard slug")
    description: str | None = Field(None, description="Dashboard description")
    css: str | None = Field(None, description="Custom CSS for the dashboard")
    certified_by: str | None = Field(None, description="Who certified the dashboard")
    certification_details: str | None = Field(None, description="Certification details")
    json_metadata: str | None = Field(
        None, description="Dashboard metadata (JSON string)"
    )
    position_json: str | None = Field(None, description="Chart positions (JSON string)")
    published: bool | None = Field(
        None, description="Whether the dashboard is published"
    )
    is_managed_externally: bool | None = Field(
        None, description="Whether managed externally"
    )
    external_url: str | None = Field(None, description="External URL")
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    created_by: str | None = Field(None, description="Dashboard creator (username)")
    changed_by: str | None = Field(None, description="Last modifier (username)")
    uuid: str | None = Field(None, description="Dashboard UUID (converted to string)")
    url: str | None = Field(None, description="Dashboard URL")
    created_on_humanized: str | None = Field(
        None, description="Humanized creation time"
    )
    changed_on_humanized: str | None = Field(
        None, description="Humanized modification time"
    )
    chart_count: int = Field(0, description="Number of charts in the dashboard")
    owners: List[UserInfo] = Field(default_factory=list, description="Dashboard owners")
    tags: List[TagInfo] = Field(default_factory=list, description="Dashboard tags")
    roles: List[RoleInfo] = Field(default_factory=list, description="Dashboard roles")
    charts: List[ChartInfo] = Field(
        default_factory=list, description="Dashboard charts"
    )

    # Fields for permalink/filter state support
    permalink_key: str | None = Field(
        None,
        description=(
            "Permalink key used to retrieve filter state. When present, indicates "
            "the filter_state came from a permalink rather than the default dashboard."
        ),
    )
    filter_state: Dict[str, Any] | None = Field(
        None,
        description=(
            "Filter state from permalink. Contains dataMask (native filter values), "
            "activeTabs, anchor, and urlParams. When present, represents the actual "
            "filters the user has applied to the dashboard."
        ),
    )
    is_permalink_state: bool = Field(
        default=False,
        description=(
            "True if the filter_state came from a permalink rather than the default "
            "dashboard configuration. When true, the filter_state reflects what the "
            "user sees in the dashboard, not the default filter state."
        ),
    )

    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")

    @model_serializer(mode="wrap", when_used="json")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Filter fields based on serialization context.

        If context contains 'select_columns', only include those fields.
        Otherwise, include all fields (default behavior).
        """
        # Get full serialization
        data = serializer(self)

        # Check if we have a context with select_columns
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                # Filter to only requested fields
                return {k: v for k, v in data.items() if k in select_columns}

        # No filtering - return all fields
        return data


class DashboardList(BaseModel):
    dashboards: List[DashboardInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: List[str] = Field(
        default_factory=list,
        description="Requested columns for the response",
    )
    columns_loaded: List[str] = Field(
        default_factory=list,
        description="Columns that were actually loaded for each dashboard",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[DashboardFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class AddChartToDashboardRequest(BaseModel):
    """Request schema for adding a chart to an existing dashboard."""

    dashboard_id: int = Field(
        ..., description="ID of the dashboard to add the chart to"
    )
    chart_id: int = Field(..., description="ID of the chart to add to the dashboard")
    target_tab: str | None = Field(
        None, description="Target tab name (if dashboard has tabs)"
    )


class AddChartToDashboardResponse(BaseModel):
    """Response schema for adding chart to dashboard."""

    dashboard: DashboardInfo | None = Field(
        None, description="The updated dashboard info, if successful"
    )
    dashboard_url: str | None = Field(
        None, description="URL to view the updated dashboard"
    )
    position: dict[str, Any] | None = Field(
        None, description="Position information for the added chart"
    )
    error: str | None = Field(None, description="Error message, if operation failed")


class GenerateDashboardRequest(BaseModel):
    """Request schema for generating a dashboard."""

    chart_ids: List[int] = Field(
        ..., description="List of chart IDs to include in the dashboard", min_length=1
    )
    dashboard_title: str = Field(..., description="Title for the new dashboard")
    description: str | None = Field(None, description="Description for the dashboard")
    published: bool = Field(
        default=True, description="Whether to publish the dashboard"
    )


class GenerateDashboardResponse(BaseModel):
    """Response schema for dashboard generation."""

    dashboard: DashboardInfo | None = Field(
        None, description="The created dashboard info, if successful"
    )
    dashboard_url: str | None = Field(None, description="URL to view the dashboard")
    error: str | None = Field(None, description="Error message, if creation failed")


def dashboard_serializer(dashboard: "Dashboard") -> DashboardInfo:
    return DashboardInfo(
        id=dashboard.id,
        dashboard_title=dashboard.dashboard_title or "Untitled",
        slug=dashboard.slug or "",
        description=dashboard.description,
        css=dashboard.css,
        certified_by=dashboard.certified_by,
        certification_details=dashboard.certification_details,
        json_metadata=dashboard.json_metadata,
        position_json=dashboard.position_json,
        published=dashboard.published,
        is_managed_externally=dashboard.is_managed_externally,
        external_url=dashboard.external_url,
        created_on=dashboard.created_on,
        changed_on=dashboard.changed_on,
        created_by=getattr(dashboard.created_by, "username", None)
        if dashboard.created_by
        else None,
        changed_by=getattr(dashboard.changed_by, "username", None)
        if dashboard.changed_by
        else None,
        uuid=str(dashboard.uuid) if dashboard.uuid else None,
        url=dashboard.url,
        created_on_humanized=dashboard.created_on_humanized,
        changed_on_humanized=dashboard.changed_on_humanized,
        chart_count=len(dashboard.slices) if dashboard.slices else 0,
        owners=[
            UserInfo.model_validate(owner, from_attributes=True)
            for owner in dashboard.owners
        ]
        if dashboard.owners
        else [],
        tags=[
            TagInfo.model_validate(tag, from_attributes=True) for tag in dashboard.tags
        ]
        if dashboard.tags
        else [],
        roles=[
            RoleInfo.model_validate(role, from_attributes=True)
            for role in dashboard.roles
        ]
        if dashboard.roles
        else [],
        charts=[serialize_chart_object(chart) for chart in dashboard.slices]
        if dashboard.slices
        else [],
    )


def serialize_dashboard_object(dashboard: Any) -> DashboardInfo:
    """Simple dashboard serializer that safely handles object attributes."""
    return DashboardInfo(
        id=getattr(dashboard, "id", None),
        dashboard_title=getattr(dashboard, "dashboard_title", None),
        slug=getattr(dashboard, "slug", None),
        url=getattr(dashboard, "url", None),
        published=getattr(dashboard, "published", None),
        changed_by_name=getattr(dashboard, "changed_by_name", None),
        changed_on=getattr(dashboard, "changed_on", None),
        changed_on_humanized=getattr(dashboard, "changed_on_humanized", None),
        created_by_name=getattr(dashboard, "created_by_name", None),
        created_on=getattr(dashboard, "created_on", None),
        created_on_humanized=getattr(dashboard, "created_on_humanized", None),
        description=getattr(dashboard, "description", None),
        css=getattr(dashboard, "css", None),
        certified_by=getattr(dashboard, "certified_by", None),
        certification_details=getattr(dashboard, "certification_details", None),
        json_metadata=getattr(dashboard, "json_metadata", None),
        position_json=getattr(dashboard, "position_json", None),
        is_managed_externally=getattr(dashboard, "is_managed_externally", None),
        external_url=getattr(dashboard, "external_url", None),
        uuid=str(getattr(dashboard, "uuid", ""))
        if getattr(dashboard, "uuid", None)
        else None,
        chart_count=len(getattr(dashboard, "slices", [])),
        owners=getattr(dashboard, "owners", []),
        tags=getattr(dashboard, "tags", []),
        roles=getattr(dashboard, "roles", []),
        charts=[
            serialize_chart_object(chart) for chart in getattr(dashboard, "slices", [])
        ]
        if getattr(dashboard, "slices", None)
        else [],
    )
