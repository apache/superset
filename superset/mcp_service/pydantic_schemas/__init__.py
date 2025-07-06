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
MCP Service Schemas Package

This package contains Pydantic schemas for the MCP service responses.
"""

from .dashboard_schemas import (
    DashboardInfoResponse,
    DashboardErrorResponse,
    DashboardListResponse,
    DashboardListItem,
    PaginationInfo,
    UserInfo,
    TagInfo,
    RoleInfo,
    ChartInfo,
    serialize_user_object,
    serialize_tag_object,
    serialize_role_object,
    serialize_chart_object,
    DashboardAvailableFiltersResponse,
)
from .system_schemas import (
    SupersetInstanceInfoResponse,
    InstanceSummary,
    RecentActivity,
    DashboardBreakdown,
    DatabaseBreakdown,
    PopularContent,
)
from .dataset_schemas import (
    DatasetListItem,
    DatasetListResponse,
    DatasetSimpleFilters,
    serialize_dataset_object,
    DatasetAvailableFiltersResponse,
    DatasetInfoResponse,
    DatasetErrorResponse,
)
from .chart_schemas import (
    ChartListResponse,
    ChartListItem,
    ChartSimpleFilters,
    ChartAvailableFiltersResponse,
    ChartInfoResponse,
    ChartErrorResponse,
    serialize_chart_object,
    CreateSimpleChartRequest,
    CreateSimpleChartResponse,
)

__all__ = [
    "DashboardInfoResponse",
    "DashboardErrorResponse",
    "DashboardListResponse",
    "DashboardListItem",
    "PaginationInfo",
    "UserInfo",
    "TagInfo",
    "RoleInfo",
    "ChartInfo",
    "serialize_user_object",
    "serialize_tag_object",
    "serialize_role_object",
    "serialize_chart_object",
    "DatasetListItem",
    "DatasetListResponse",
    "DatasetSimpleFilters",
    "serialize_dataset_object",
    "DashboardAvailableFiltersResponse",
    "SupersetInstanceInfoResponse",
    "InstanceSummary",
    "RecentActivity",
    "DashboardBreakdown",
    "DatabaseBreakdown",
    "PopularContent",
    "DatasetAvailableFiltersResponse",
    "DatasetInfoResponse",
    "DatasetErrorResponse",
    "ChartListResponse",
    "ChartListItem",
    "ChartSimpleFilters",
    "ChartAvailableFiltersResponse",
    "ChartInfoResponse",
    "ChartErrorResponse",
    "CreateSimpleChartRequest",
    "CreateSimpleChartResponse",
] 