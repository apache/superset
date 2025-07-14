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

This module contains Pydantic models for serializing Superset instance metadata and system-level info.
"""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict

class InstanceSummary(BaseModel):
    total_dashboards: int = Field(..., description="Total number of dashboards")
    total_charts: int = Field(..., description="Total number of charts")
    total_datasets: int = Field(..., description="Total number of datasets")
    total_databases: int = Field(..., description="Total number of databases")
    total_users: int = Field(..., description="Total number of users")
    total_roles: int = Field(..., description="Total number of roles")
    total_tags: int = Field(..., description="Total number of tags")
    avg_charts_per_dashboard: float = Field(..., description="Average number of charts per dashboard")

class RecentActivity(BaseModel):
    dashboards_created_last_30_days: int = Field(..., description="Dashboards created in the last 30 days")
    charts_created_last_30_days: int = Field(..., description="Charts created in the last 30 days")
    datasets_created_last_30_days: int = Field(..., description="Datasets created in the last 30 days")
    dashboards_modified_last_7_days: int = Field(..., description="Dashboards modified in the last 7 days")
    charts_modified_last_7_days: int = Field(..., description="Charts modified in the last 7 days")
    datasets_modified_last_7_days: int = Field(..., description="Datasets modified in the last 7 days")

class DashboardBreakdown(BaseModel):
    published: int = Field(..., description="Number of published dashboards")
    unpublished: int = Field(..., description="Number of unpublished dashboards")
    certified: int = Field(..., description="Number of certified dashboards")
    with_charts: int = Field(..., description="Number of dashboards with charts")
    without_charts: int = Field(..., description="Number of dashboards without charts")

class DatabaseBreakdown(BaseModel):
    by_type: Dict[str, int] = Field(..., description="Breakdown of databases by type")

class PopularContent(BaseModel):
    top_tags: List[str] = Field(..., description="Most popular tags")
    top_creators: List[str] = Field(..., description="Most active creators")

class InstanceInfo(BaseModel):
    instance_summary: InstanceSummary = Field(..., description="Instance summary information")
    recent_activity: RecentActivity = Field(..., description="Recent activity information")
    dashboard_breakdown: DashboardBreakdown = Field(..., description="Dashboard breakdown information")
    database_breakdown: DatabaseBreakdown = Field(..., description="Database breakdown by type")
    popular_content: PopularContent = Field(..., description="Popular content information")
    timestamp: datetime = Field(..., description="Response timestamp")

class UserInfo(BaseModel):
    id: Optional[int] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    active: Optional[bool] = None

class TagInfo(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None

class RoleInfo(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    permissions: Optional[List[str]] = None

class PaginationInfo(BaseModel):
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_count: int = Field(..., description="Total number of items")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_previous: bool = Field(..., description="Whether there is a previous page")
    model_config = ConfigDict(ser_json_timedelta="iso8601") 
