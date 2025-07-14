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
    DashboardInfo,
    DashboardError,
    DashboardList,
    DashboardAvailableFilters,
    DashboardFilter,
)
from .system_schemas import (
    InstanceInfo,
    InstanceSummary,
    RecentActivity,
    DashboardBreakdown,
    DatabaseBreakdown,
    PopularContent,
    UserInfo,
    TagInfo,
    RoleInfo,
    PaginationInfo,
)
from .dataset_schemas import (
    DatasetInfo,
    DatasetList,
    serialize_dataset_object,
    DatasetAvailableFilters,
    DatasetError,
    DatasetFilter,
)
from .chart_schemas import (
    ChartList,
    ChartInfo,
    ChartAvailableFiltersResponse,
    ChartError,
    serialize_chart_object,
    ChartFilter,
)

__all__ = [
    "ChartAvailableFiltersResponse",
    "ChartError",
    "ChartFilter",
    "ChartInfo",
    "ChartList",
    "DashboardAvailableFilters",
    "DashboardBreakdown",
    "DashboardError",
    "DashboardFilter",
    "DashboardInfo",
    "DashboardList",
    "DatabaseBreakdown",
    "DatasetAvailableFilters",
    "DatasetError",
    "DatasetFilter",
    "DatasetInfo",
    "DatasetList",
    "InstanceInfo",
    "InstanceSummary",
    "PaginationInfo",
    "PopularContent",
    "RecentActivity",
    "RoleInfo",
    "TagInfo",
    "UserInfo",
    "serialize_chart_object",
    "serialize_dataset_object",
] 
