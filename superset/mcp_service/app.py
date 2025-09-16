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
the server. All tool modules should import mcp from here and use @mcp.tool decorators.
"""

import logging

from fastmcp import FastMCP

logger = logging.getLogger(__name__)

# Create MCP instance without auth for scaffold
mcp = FastMCP(
    "Superset MCP Server",
    instructions="""
You are connected to the Apache Superset MCP (Model Context Protocol) service.
This service provides programmatic access to Superset dashboards, charts, datasets,
SQL Lab, and instance metadata via a comprehensive set of tools.

Available tools:

Dashboard Management:
- list_dashboards: List dashboards with advanced filters (1-based pagination)
- get_dashboard_info: Get detailed dashboard information by ID
- get_dashboard_available_filters: List available dashboard filter fields/operators
- generate_dashboard: Automatically create a dashboard from datasets with AI
- add_chart_to_existing_dashboard: Add a chart to an existing dashboard

Dataset Management:
- list_datasets: List datasets with advanced filters (1-based pagination)
- get_dataset_info: Get detailed dataset information by ID
- get_dataset_available_filters: List available dataset filter fields/operators

Chart Management:
- list_charts: List charts with advanced filters (1-based pagination)
- get_chart_info: Get detailed chart information by ID
- get_chart_preview: Get a visual preview of a chart with image URL
- get_chart_data: Get underlying chart data in text-friendly format
- get_chart_available_filters: List available chart filter fields/operators
- generate_chart: Create a new chart with AI assistance
- update_chart: Update existing chart configuration
- update_chart_preview: Update chart and get preview in one operation

SQL Lab Integration:
- execute_sql: Execute SQL queries and get results
- open_sql_lab_with_context: Generate SQL Lab URL with pre-filled query

Explore & Analysis:
- generate_explore_link: Create pre-configured explore URL with dataset/metrics/filters

System Information:
- get_superset_instance_info: Get instance-wide statistics and metadata

Available Resources:
- superset://instance/metadata: Access instance configuration and metadata
- superset://chart/templates: Access chart configuration templates

Available Prompts:
- superset_quickstart: Interactive guide for getting started with the MCP service
- create_chart_guided: Step-by-step chart creation wizard

General usage tips:
- All listing tools use 1-based pagination (first page is 1)
- Use 'filters' parameter for advanced queries (see *_available_filters tools)
- IDs can be integer or UUID format where supported
- All tools return structured, Pydantic-typed responses
- Chart previews are served as PNG images via custom screenshot endpoints

If you are unsure which tool to use, start with get_superset_instance_info
or use the superset_quickstart prompt for an interactive guide.
""",
)


def init_fastmcp_server() -> FastMCP:
    """
    Initialize and configure the FastMCP server.
    This should be called before running the server.
    """
    logger.setLevel(logging.DEBUG)
    logger.info("MCP Server initialized - scaffold version without auth")
    return mcp
