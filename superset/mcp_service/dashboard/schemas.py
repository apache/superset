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
Schema definitions for dashboard-related MCP tools and responses.

This module defines the Pydantic schemas that will be used for:
- Dashboard creation and management
- Dashboard layout configuration
- Adding/removing charts from dashboards
- Dashboard sharing and permissions

These schemas establish the contract for dashboard-related MCP tools.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class DashboardStatus(str, Enum):
    """Dashboard status options."""

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class LayoutType(str, Enum):
    """Dashboard layout types."""

    GRID = "grid"
    TABS = "tabs"
    # Additional layout types will be added


class DashboardCreateRequest(BaseModel):
    """Request schema for creating a dashboard."""

    dashboard_title: str = Field(..., description="Dashboard title")
    description: Optional[str] = Field(None, description="Dashboard description")
    chart_ids: Optional[List[int]] = Field(None, description="Charts to include")
    published: bool = Field(True, description="Whether to publish the dashboard")
    # Additional fields will be added in implementation PRs


class DashboardResponse(BaseModel):
    """Response schema for dashboard operations."""

    dashboard_id: Union[int, str] = Field(..., description="Dashboard identifier")
    dashboard_title: str = Field(..., description="Dashboard title")
    status: DashboardStatus = Field(..., description="Dashboard status")
    url: Optional[str] = Field(None, description="Dashboard URL")
    # Additional fields will be added


class DashboardInfo(BaseModel):
    """Detailed dashboard information."""

    id: Union[int, str] = Field(..., description="Dashboard identifier")
    title: str = Field(..., description="Dashboard title")
    description: Optional[str] = Field(None, description="Dashboard description")
    status: DashboardStatus = Field(..., description="Dashboard status")
    chart_count: int = Field(..., description="Number of charts in dashboard")
    created_on: Optional[str] = Field(None, description="Creation timestamp")
    changed_on: Optional[str] = Field(None, description="Last modified timestamp")
    # Additional fields will be added


class DashboardListRequest(BaseModel):
    """Request schema for listing dashboards."""

    page: int = Field(1, description="Page number")
    page_size: int = Field(100, description="Items per page")
    search: Optional[str] = Field(None, description="Search term")
    status: Optional[DashboardStatus] = Field(None, description="Filter by status")
    # Additional fields will be added


class DashboardListResponse(BaseModel):
    """Response schema for dashboard listing."""

    dashboards: List[DashboardInfo] = Field(..., description="List of dashboards")
    total_count: int = Field(..., description="Total number of dashboards")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Items per page")


class AddChartToDashboardRequest(BaseModel):
    """Request schema for adding a chart to a dashboard."""

    dashboard_id: Union[int, str] = Field(..., description="Dashboard identifier")
    chart_id: Union[int, str] = Field(..., description="Chart identifier")
    position: Optional[Dict[str, Any]] = Field(
        None, description="Chart position and size"
    )


class AddChartToDashboardResponse(BaseModel):
    """Response schema for adding chart to dashboard."""

    dashboard_id: Union[int, str] = Field(..., description="Dashboard identifier")
    chart_id: Union[int, str] = Field(..., description="Chart identifier")
    status: str = Field(..., description="Operation status")
    position: Optional[Dict[str, Any]] = Field(None, description="Final chart position")


class DashboardFilter(BaseModel):
    """Dashboard filter configuration."""

    column: str = Field(..., description="Column name")
    operator: str = Field(..., description="Filter operator")
    value: Union[str, int, float, List[Union[str, int, float]]] = Field(
        ..., description="Filter value(s)"
    )


class DashboardAvailableFiltersResponse(BaseModel):
    """Response schema for available dashboard filters."""

    columns: List[str] = Field(..., description="Available filter columns")
    operators: Dict[str, List[str]] = Field(
        ..., description="Available operators per column type"
    )
