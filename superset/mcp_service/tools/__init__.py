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
MCP Service Tools Package

This package contains individual FastMCP tools for the Superset MCP service.
Each tool is implemented in its own module for better organization and maintainability.
"""

from .dataset import (
    list_datasets,
    get_dataset_info,
    get_dataset_available_filters,
)
from .dashboard import (
    list_dashboards,
    get_dashboard_info,
    get_dashboard_available_filters,
)
from .chart import (
    list_charts,
    get_chart_info,
    get_chart_available_filters,
    create_chart_simple,
)
from .system import get_superset_instance_info

# Do not import tool functions at the top level to avoid circular imports.

MCP_TOOLS = {
    # dashboard
    "list_dashboards": __import__("superset.mcp_service.tools.dashboard", fromlist=["list_dashboards"]).list_dashboards,
    "get_dashboard_info": __import__("superset.mcp_service.tools.dashboard", fromlist=["get_dashboard_info"]).get_dashboard_info,
    "get_dashboard_available_filters": __import__("superset.mcp_service.tools.dashboard", fromlist=["get_dashboard_available_filters"]).get_dashboard_available_filters,
    # dataset
    "list_datasets": __import__("superset.mcp_service.tools.dataset", fromlist=["list_datasets"]).list_datasets,
    "get_dataset_info": __import__("superset.mcp_service.tools.dataset", fromlist=["get_dataset_info"]).get_dataset_info,
    "get_dataset_available_filters": __import__("superset.mcp_service.tools.dataset", fromlist=["get_dataset_available_filters"]).get_dataset_available_filters,
    # chart
    "list_charts": __import__("superset.mcp_service.tools.chart", fromlist=["list_charts"]).list_charts,
    "get_chart_info": __import__("superset.mcp_service.tools.chart", fromlist=["get_chart_info"]).get_chart_info,
    "get_chart_available_filters": __import__("superset.mcp_service.tools.chart", fromlist=["get_chart_available_filters"]).get_chart_available_filters,
    # system
    "get_superset_instance_info": __import__("superset.mcp_service.tools.system", fromlist=["get_superset_instance_info"]).get_superset_instance_info,
}

__all__ = [
    # dashboard
    "list_dashboards",
    "get_dashboard_info",
    "get_dashboard_available_filters",
    # dataset
    "list_datasets",
    "get_dataset_info",
    "get_dataset_available_filters",
    # chart
    "list_charts",
    "get_chart_info",
    "get_chart_available_filters",
    "create_chart_simple",
    # system
    "get_superset_instance_info",
] 
