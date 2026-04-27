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
Pydantic schemas for system-level (instance/info) responses

This module contains Pydantic models for serializing Superset instance metadata and
system-level info.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List

from pydantic import BaseModel, ConfigDict, Field, field_validator

from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE


class HealthCheckResponse(BaseModel):
    """Response model for health check.

    Used by health check tool to return service status and system information.
    """

    status: str
    timestamp: str
    service: str
    version: str
    python_version: str
    platform: str
    uptime_seconds: float | None = None


class GetSupersetInstanceInfoRequest(BaseModel):
    """
    Request schema for get_instance_info tool.

    Currently has no parameters but provides consistent API for future extensibility.
    """

    model_config = ConfigDict(
        extra="forbid",
    )


class InstanceSummary(BaseModel):
    total_dashboards: int
    total_charts: int
    total_datasets: int
    total_databases: int
    total_users: int
    total_roles: int
    total_tags: int
    avg_charts_per_dashboard: float


class RecentActivity(BaseModel):
    dashboards_created_last_30_days: int
    charts_created_last_30_days: int
    datasets_created_last_30_days: int
    dashboards_modified_last_7_days: int
    charts_modified_last_7_days: int
    datasets_modified_last_7_days: int


class DashboardBreakdown(BaseModel):
    published: int
    unpublished: int
    certified: int
    with_charts: int
    without_charts: int


class DatabaseBreakdown(BaseModel):
    by_type: Dict[str, int]


class PopularContent(BaseModel):
    top_tags: List[str] = Field(default_factory=list)
    top_creators: List[str] = Field(default_factory=list)


class FeatureAvailability(BaseModel):
    """Dynamic feature availability for the current user and deployment.

    Menus are detected at request time from the security manager,
    so they reflect the actual permissions of the requesting user.
    """

    accessible_menus: List[str] = Field(
        default_factory=list,
        description=(
            "UI menu items accessible to the current user, "
            "derived from FAB role permissions"
        ),
    )


class InstanceInfo(BaseModel):
    instance_summary: InstanceSummary
    recent_activity: RecentActivity
    dashboard_breakdown: DashboardBreakdown
    database_breakdown: DatabaseBreakdown
    popular_content: PopularContent
    current_user: UserInfo | None = Field(
        None,
        description="Information about the authenticated user.",
    )
    feature_availability: FeatureAvailability
    data_model_metadata_redacted: bool = Field(
        default=False,
        description=(
            "True when dataset/database summary fields were removed because "
            "the current user cannot inspect data model metadata."
        ),
    )
    timestamp: datetime


class UserInfo(BaseModel):
    id: int | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    active: bool | None = None
    roles: List[str] = Field(
        default_factory=list,
        description=(
            "Role names assigned to the user (e.g., Admin, Alpha, Gamma, Viewer). "
            "Use this to determine what actions the user can perform."
        ),
    )


def serialize_user_object(user: Any) -> UserInfo | None:
    """Serialize a user ORM object to UserInfo, extracting role names as strings."""
    if not user:
        return None

    user_roles: list[str] = []
    if (raw_roles := getattr(user, "roles", None)) is not None:
        try:
            user_roles = [role.name for role in raw_roles if hasattr(role, "name")]
        except TypeError:
            user_roles = []

    return UserInfo(
        id=getattr(user, "id", None),
        username=getattr(user, "username", None),
        first_name=getattr(user, "first_name", None),
        last_name=getattr(user, "last_name", None),
        email=getattr(user, "email", None),
        active=getattr(user, "active", None),
        roles=user_roles,
    )


class FindUsersRequest(BaseModel):
    """Request schema for find_users tool.

    Resolves a person's name (or partial name, username, or email) to user IDs
    so they can be passed to listing tools as filter values for created_by_fk
    or changed_by_fk. This is the only sanctioned path for "show me what
    <person> is working on" queries.
    """

    model_config = ConfigDict(extra="forbid")

    query: Annotated[
        str,
        Field(
            min_length=1,
            max_length=200,
            description=(
                "Substring to match (case-insensitive) against username, "
                "first_name, last_name, and email. Required and non-empty: "
                "this tool does not enumerate the full user directory."
            ),
        ),
    ]
    page_size: Annotated[
        int,
        Field(
            default=DEFAULT_PAGE_SIZE,
            gt=0,
            le=MAX_PAGE_SIZE,
            description=f"Maximum number of matches to return (max {MAX_PAGE_SIZE}).",
        ),
    ]

    @field_validator("query")
    @classmethod
    def _reject_blank_query(cls, value: str) -> str:
        # min_length=1 alone admits whitespace-only strings, which strip to "" and
        # produce a "%%" LIKE pattern that matches every user. Strip and require
        # at least one non-space character.
        stripped = value.strip()
        if not stripped:
            raise ValueError("query must contain at least one non-whitespace character")
        return stripped


class FindUsersResponse(BaseModel):
    """Response schema for find_users tool."""

    users: List["UserInfo"] = Field(
        default_factory=list,
        description=(
            "Matching users. Pass user.id as the value for created_by_fk or "
            "changed_by_fk filters on list_dashboards, list_charts, and "
            "list_datasets."
        ),
    )
    count: int = Field(..., description="Number of users returned in this response.")
    truncated: bool = Field(
        default=False,
        description="True when the query matched more rows than page_size allows.",
    )


class TagInfo(BaseModel):
    id: int | None = None
    name: str | None = None
    type: str | None = None
    description: str | None = None


class RoleInfo(BaseModel):
    id: int | None = None
    name: str | None = None
    permissions: List[str] | None = None


class PaginationInfo(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int
    has_next: bool
    has_previous: bool
    model_config = ConfigDict(ser_json_timedelta="iso8601")
