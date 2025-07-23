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

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.pydantic_schemas.chart_schemas import ChartInfo
from superset.mcp_service.pydantic_schemas.system_schemas import (
    PaginationInfo,
    RoleInfo,
    TagInfo,
    UserInfo,
)


class DashboardError(BaseModel):
    """Error response for dashboard operations"""

    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[Union[str, datetime]] = Field(
        None, description="Error timestamp"
    )

    model_config = ConfigDict(ser_json_timedelta="iso8601")


def serialize_user_object(user: Any) -> Optional[UserInfo]:
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


def serialize_tag_object(tag: Any) -> Optional[TagInfo]:
    """Serialize a tag object to TagInfo"""
    if not tag:
        return None

    return TagInfo(
        id=getattr(tag, "id", None),
        name=getattr(tag, "name", None),
        type=getattr(tag, "type", None),
        description=getattr(tag, "description", None),
    )


def serialize_role_object(role: Any) -> Optional[RoleInfo]:
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


def serialize_chart_object(chart: Any) -> Optional[ChartInfo]:
    """Serialize a chart object to Chart"""
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
        created_by=serialize_user_object(getattr(chart, "created_by", None)),
        changed_by=serialize_user_object(getattr(chart, "changed_by", None)),
        created_on=getattr(chart, "created_on", None),
        changed_on=getattr(chart, "changed_on", None),
    )


class DashboardAvailableFilters(BaseModel):
    column_operators: Dict[str, Any] = Field(
        ..., description="Available filter operators and metadata for each column"
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
        "owner",
        "favorite",
        "tags",
    ] = Field(
        ...,
        description="Column to filter on. See get_dashboard_available_filters for "
        "allowed values.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. See get_dashboard_available_filters for "
        "allowed values.",
    )
    value: Any = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class DashboardInfo(BaseModel):
    id: int = Field(..., description="Dashboard ID")
    dashboard_title: str = Field(..., description="Dashboard title")
    slug: Optional[str] = Field(None, description="Dashboard slug")
    description: Optional[str] = Field(None, description="Dashboard description")
    css: Optional[str] = Field(None, description="Custom CSS for the dashboard")
    certified_by: Optional[str] = Field(None, description="Who certified the dashboard")
    certification_details: Optional[str] = Field(
        None, description="Certification details"
    )
    json_metadata: Optional[str] = Field(
        None, description="Dashboard metadata (JSON string)"
    )
    position_json: Optional[str] = Field(
        None, description="Chart positions (JSON string)"
    )
    published: Optional[bool] = Field(
        None, description="Whether the dashboard is published"
    )
    is_managed_externally: Optional[bool] = Field(
        None, description="Whether managed externally"
    )
    external_url: Optional[str] = Field(None, description="External URL")
    created_on: Optional[Union[str, datetime]] = Field(
        None, description="Creation timestamp"
    )
    changed_on: Optional[Union[str, datetime]] = Field(
        None, description="Last modification timestamp"
    )
    created_by: Optional[str] = Field(None, description="Dashboard creator (username)")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    uuid: Optional[str] = Field(
        None, description="Dashboard UUID (converted to string)"
    )
    url: Optional[str] = Field(None, description="Dashboard URL")
    thumbnail_url: Optional[str] = Field(None, description="Thumbnail URL")
    created_on_humanized: Optional[str] = Field(
        None, description="Humanized creation time"
    )
    changed_on_humanized: Optional[str] = Field(
        None, description="Humanized modification time"
    )
    chart_count: int = Field(0, description="Number of charts in the dashboard")
    owners: List[UserInfo] = Field(default_factory=list, description="Dashboard owners")
    tags: List[TagInfo] = Field(default_factory=list, description="Dashboard tags")
    roles: List[RoleInfo] = Field(default_factory=list, description="Dashboard roles")
    charts: List[ChartInfo] = Field(
        default_factory=list, description="Dashboard charts"
    )
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class DashboardList(BaseModel):
    dashboards: List[DashboardInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: Optional[List[str]] = None
    columns_loaded: Optional[List[str]] = None
    filters_applied: List[DashboardFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: Optional[PaginationInfo] = None
    timestamp: Optional[datetime] = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")
