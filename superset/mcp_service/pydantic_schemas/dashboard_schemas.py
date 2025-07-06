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
    dashboard_info = DashboardInfoResponse(
        id=1,
        dashboard_title="Sales Dashboard",
        published=True,
        owners=[UserInfo(id=1, username="admin")],
        charts=[ChartInfo(id=1, slice_name="Sales Chart")]
    )
    
    # For dashboard list responses
    dashboard_list = DashboardListResponse(
        dashboards=[
            DashboardListItem(
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
from typing import Any, Dict, List, Optional, Union, Mapping
from pydantic import BaseModel, Field, ConfigDict


class UserInfo(BaseModel):
    """User information for dashboard owners and creators"""
    id: Optional[int] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    active: Optional[bool] = None


class TagInfo(BaseModel):
    """Tag information for dashboard tags"""
    id: Optional[int] = None
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None


class RoleInfo(BaseModel):
    """Role information for dashboard roles"""
    id: Optional[int] = None
    name: Optional[str] = None
    permissions: Optional[List[str]] = None


class ChartInfo(BaseModel):
    """Chart information for dashboard charts"""
    id: Optional[int] = None
    slice_name: Optional[str] = None
    viz_type: Optional[str] = None
    datasource_name: Optional[str] = None
    datasource_type: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    cache_timeout: Optional[int] = None
    form_data: Optional[Dict[str, Any]] = None
    query_context: Optional[Any] = None
    created_by: Optional[UserInfo] = None
    changed_by: Optional[UserInfo] = None
    created_on: Optional[Union[str, datetime]] = None
    changed_on: Optional[Union[str, datetime]] = None
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class DashboardListItem(BaseModel):
    """Dashboard item for list responses - simplified version of DashboardInfoResponse"""
    id: int = Field(..., description="Dashboard ID")
    dashboard_title: str = Field(..., description="Dashboard title")
    slug: Optional[str] = Field(None, description="Dashboard slug")
    url: Optional[str] = Field(None, description="Dashboard URL")
    published: Optional[bool] = Field(None, description="Whether the dashboard is published")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    changed_by_name: Optional[str] = Field(None, description="Last modifier (display name)")
    changed_on: Optional[Union[str, datetime]] = Field(None, description="Last modification timestamp")
    changed_on_humanized: Optional[str] = Field(None, description="Humanized modification time")
    created_by: Optional[str] = Field(None, description="Dashboard creator (username)")
    created_on: Optional[Union[str, datetime]] = Field(None, description="Creation timestamp")
    created_on_humanized: Optional[str] = Field(None, description="Humanized creation time")
    tags: List[TagInfo] = Field(default_factory=list, description="Dashboard tags")
    owners: List[UserInfo] = Field(default_factory=list, description="Dashboard owners")
    
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class PaginationInfo(BaseModel):
    """Pagination information for list responses"""
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_count: int = Field(..., description="Total number of items")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_previous: bool = Field(..., description="Whether there is a previous page")
    
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class DashboardListResponse(BaseModel):
    """Response for dashboard list operations"""
    dashboards: List[DashboardListItem] = Field(..., description="List of dashboards")
    count: int = Field(..., description="Number of dashboards in current page")
    total_count: int = Field(..., description="Total number of dashboards")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Page size")
    total_pages: int = Field(..., description="Total number of pages")
    has_previous: bool = Field(..., description="Whether there is a previous page")
    has_next: bool = Field(..., description="Whether there is a next page")
    columns_requested: List[str] = Field(..., description="Columns that were requested")
    columns_loaded: List[str] = Field(..., description="Columns that were actually loaded")
    filters_applied: Dict[str, Any] = Field(..., description="Filters that were applied")
    pagination: PaginationInfo = Field(..., description="Pagination information")
    timestamp: datetime = Field(..., description="Response timestamp")
    
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class DashboardInfoResponse(BaseModel):
    """Detailed dashboard information response - maps exactly to Dashboard model"""
    
    # Core Dashboard model fields
    id: int = Field(..., description="Dashboard ID")
    dashboard_title: str = Field(..., description="Dashboard title")
    slug: Optional[str] = Field(None, description="Dashboard slug")
    description: Optional[str] = Field(None, description="Dashboard description")
    css: Optional[str] = Field(None, description="Custom CSS for the dashboard")
    certified_by: Optional[str] = Field(None, description="Who certified the dashboard")
    certification_details: Optional[str] = Field(None, description="Certification details")
    json_metadata: Optional[str] = Field(None, description="Dashboard metadata (JSON string)")
    position_json: Optional[str] = Field(None, description="Chart positions (JSON string)")
    published: Optional[bool] = Field(None, description="Whether the dashboard is published")
    is_managed_externally: Optional[bool] = Field(None, description="Whether managed externally")
    external_url: Optional[str] = Field(None, description="External URL")
    
    # AuditMixinNullable fields
    created_on: Optional[Union[str, datetime]] = Field(None, description="Creation timestamp")
    changed_on: Optional[Union[str, datetime]] = Field(None, description="Last modification timestamp")
    created_by: Optional[str] = Field(None, description="Dashboard creator (username)")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    
    # ImportExportMixin fields
    uuid: Optional[str] = Field(None, description="Dashboard UUID (converted to string)")
    
    # Computed properties
    url: Optional[str] = Field(None, description="Dashboard URL")
    thumbnail_url: Optional[str] = Field(None, description="Thumbnail URL")
    created_on_humanized: Optional[str] = Field(None, description="Humanized creation time")
    changed_on_humanized: Optional[str] = Field(None, description="Humanized modification time")
    chart_count: int = Field(0, description="Number of charts in the dashboard")
    
    # Related entities
    owners: List[UserInfo] = Field(default_factory=list, description="Dashboard owners")
    tags: List[TagInfo] = Field(default_factory=list, description="Dashboard tags")
    roles: List[RoleInfo] = Field(default_factory=list, description="Dashboard roles")
    charts: List[ChartInfo] = Field(default_factory=list, description="Dashboard charts")
    
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class DashboardErrorResponse(BaseModel):
    """Error response for dashboard operations"""
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[Union[str, datetime]] = Field(None, description="Error timestamp")
    
    model_config = ConfigDict(ser_json_timedelta="iso8601")


def serialize_user_object(user) -> Optional[UserInfo]:
    """Serialize a user object to UserInfo"""
    if not user:
        return None
    
    return UserInfo(
        id=getattr(user, 'id', None),
        username=getattr(user, 'username', None),
        first_name=getattr(user, 'first_name', None),
        last_name=getattr(user, 'last_name', None),
        email=getattr(user, 'email', None),
        active=getattr(user, 'active', None)
    )


def serialize_tag_object(tag) -> Optional[TagInfo]:
    """Serialize a tag object to TagInfo"""
    if not tag:
        return None
    
    return TagInfo(
        id=getattr(tag, 'id', None),
        name=getattr(tag, 'name', None),
        type=getattr(tag, 'type', None),
        description=getattr(tag, 'description', None)
    )


def serialize_role_object(role) -> Optional[RoleInfo]:
    """Serialize a role object to RoleInfo"""
    if not role:
        return None
    
    return RoleInfo(
        id=getattr(role, 'id', None),
        name=getattr(role, 'name', None),
        permissions=[perm.name for perm in getattr(role, 'permissions', [])] if hasattr(role, 'permissions') else None
    )


def serialize_chart_object(chart) -> Optional[ChartInfo]:
    """Serialize a chart object to ChartInfo"""
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
        created_by=serialize_user_object(getattr(chart, 'created_by', None)),
        changed_by=serialize_user_object(getattr(chart, 'changed_by', None)),
        created_on=getattr(chart, 'created_on', None),
        changed_on=getattr(chart, 'changed_on', None)
    )


class DashboardAvailableFiltersResponse(BaseModel):
    filters: Dict[str, Any] = Field(..., description="Available filters and their metadata")
    operators: List[str] = Field(..., description="Supported filter operators")
    columns: List[str] = Field(..., description="Available columns for filtering")


class DashboardSimpleFilters(BaseModel):
    dashboard_title: Optional[str] = Field(None, description="Filter by dashboard title (partial match)")
    published: Optional[bool] = Field(None, description="Filter by published status")
    changed_by: Optional[str] = Field(None, description="Filter by last modifier (username)")
    created_by: Optional[str] = Field(None, description="Filter by creator (username)")
    owner: Optional[str] = Field(None, description="Filter by owner (username)")
    certified: Optional[bool] = Field(None, description="Filter by certified status")
    favorite: Optional[bool] = Field(None, description="Filter by favorite status")
    chart_count: Optional[int] = Field(None, description="Filter by number of charts")
    chart_count_min: Optional[int] = Field(None, description="Filter by minimum number of charts")
    chart_count_max: Optional[int] = Field(None, description="Filter by maximum number of charts")
    tags: Optional[str] = Field(None, description="Filter by tags (comma-separated)")


# ... rest of the file remains unchanged ... 