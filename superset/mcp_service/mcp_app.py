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
FastMCP app instance and initialization for Superset MCP service.
This file provides the global FastMCP instance (mcp) and a function to initialize
middleware. All tool modules should import mcp from here and use @mcp.tool and
@mcp_auth_hook decorators.
"""

import logging

from fastmcp import FastMCP

from superset.mcp_service.middleware import LoggingMiddleware, PrivateToolMiddleware

mcp = FastMCP(
    "Superset MCP Server",
    instructions="""
You are connected to the Apache Superset MCP (Model Context Protocol) service.
This service provides programmatic access to Superset dashboards, charts, datasets,
and instance metadata via a set of high-level tools.

Available tools include:
- list_dashboards: Dashboard listing with advanced filters (use 'filters' for
  advanced queries, 1-based pagination)
- get_dashboard_info: Get detailed information about a dashboard by its integer ID
- get_superset_instance_info: Get high-level statistics and metadata about the
  Superset instance (no arguments)
- get_dashboard_available_filters: List all available dashboard filter fields and
  operators
- list_datasets: DatasetInfo listing with advanced filters (use 'filters' for
  advanced queries, 1-based pagination)
- get_dataset_info: Get detailed information about a dataset by its integer ID
- get_dataset_available_filters: List all available dataset filter fields and
  operators
- list_charts: Chart listing with advanced filters (use 'filters' for advanced
  queries, 1-based pagination)
- get_chart_info: Get detailed information about a chart by its integer ID
- get_chart_available_filters: List all available chart filter fields and operators


General usage tips:
- For listing tools, 'page' is 1-based (first page is 1)
- Use 'filters' to narrow down results (see get_dashboard_available_filters,
  get_dataset_available_filters, get_chart_available_filters for supported fields
  and operators)
- Use get_dashboard_info, get_dataset_info, get_chart_info with a valid ID from
  the listing tools
- For instance-wide stats, call get_superset_instance_info with no arguments
- All tools return structured, Pydantic-typed responses

If you are unsure which tool to use, start with list_dashboards or
get_superset_instance_info for a summary of the Superset instance.
""",
)

# Import all tool modules to ensure registration (must be after mcp is defined)
# These imports register the tools with the mcp instance
import superset.mcp_service.chart.tool  # noqa: F401, E402
import superset.mcp_service.dashboard.tool  # noqa: F401, E402
import superset.mcp_service.dataset.tool  # noqa: F401, E402
import superset.mcp_service.system.tool  # noqa: F401, E402


def init_fastmcp_server() -> FastMCP:
    """
    Initialize and configure the FastMCP server with all middleware.
    This should be called before running the server to ensure middleware is registered.
    """
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)
    mcp.add_middleware(LoggingMiddleware())
    mcp.add_middleware(PrivateToolMiddleware())
    logger.info("MCP Server initialized with modular tools structure (middleware only)")
    return mcp
