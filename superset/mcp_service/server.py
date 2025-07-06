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
Merged MCP server for Apache Superset (replaces both server.py and fastmcp_server.py)

This file provides:
- FastMCP server setup, tool registration, and middleware (init_fastmcp_server)
- Unified entrypoint for running the MCP service (HTTP)
"""
import logging
import os

def init_fastmcp_server() -> 'FastMCP':
    """
    Initialize and configure the FastMCP server with all tools and middleware.
    Returns a configured FastMCP instance (not running).
    """
    from fastmcp import FastMCP
    from superset.mcp_service.middleware import LoggingMiddleware, PrivateToolMiddleware
    from superset.mcp_service.dao_wrapper import mcp_auth_hook
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)

    mcp = FastMCP(
        "Superset MCP Server",
        instructions="""
You are connected to the Apache Superset MCP (Model Context Protocol) service. This service provides programmatic access to Superset dashboards, charts, datasets, and instance metadata via a set of high-level tools. 

Available tools include:
- list_dashboards: Advanced dashboard listing with complex filters (use 'filters' for advanced queries, 1-based pagination)
- list_dashboards_simple: Simple dashboard listing with basic filters (1-based pagination)
- get_dashboard_info: Get detailed information about a dashboard by its integer ID
- get_superset_instance_info: Get high-level statistics and metadata about the Superset instance (no arguments)
- get_dashboard_available_filters: List all available dashboard filter fields and operators

General usage tips:
- For listing tools, 'page' is 1-based (first page is 1)
- Use 'filters' to narrow down results (see get_dashboard_available_filters for supported fields and operators)
- Use get_dashboard_info with a valid dashboard ID from the listing tools
- For instance-wide stats, call get_superset_instance_info with no arguments
- All tools return structured, Pydantic-typed responses

If you are unsure which tool to use, start with list_dashboards_simple to see available dashboards, or get_superset_instance_info for a summary of the Superset instance.
"""
    )

    # Import and register all FastMCP tools
    from superset.mcp_service.tools import (
        list_dashboards,
        list_dashboards_simple,
        get_dashboard_info,
        get_superset_instance_info,
        get_dashboard_available_filters,
        get_dataset_available_filters,
        list_datasets,
        list_datasets_simple,
        list_charts,
        list_charts_simple,
        get_chart_info,
        get_chart_available_filters,
        get_dataset_info,
        create_chart_simple,
    )

    mcp.add_tool(mcp.tool()(mcp_auth_hook(list_dashboards)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(list_dashboards_simple)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(get_dashboard_info)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(get_superset_instance_info)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(get_dashboard_available_filters)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(get_dataset_available_filters)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(list_datasets)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(list_datasets_simple)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(list_charts)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(list_charts_simple)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(get_chart_info)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(get_chart_available_filters)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(get_dataset_info)))
    mcp.add_tool(mcp.tool()(mcp_auth_hook(create_chart_simple)))

    mcp.add_middleware(LoggingMiddleware())
    mcp.add_middleware(PrivateToolMiddleware())

    logger.info("MCP Server initialized with modular tools structure")
    return mcp

def configure_logging(debug: bool = False) -> None:
    """Configure logging for the MCP service."""
    if debug or os.environ.get("SQLALCHEMY_DEBUG"):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        for logger_name in ['sqlalchemy.engine', 'sqlalchemy.pool', 'sqlalchemy.dialects']:
            logging.getLogger(logger_name).setLevel(logging.INFO)
        print("🔍 SQL Debug logging enabled")

def run_server(host: str = "0.0.0.0", port: int = 5008, debug: bool = False) -> None:
    """
    Run the MCP service server with REST API and FastMCP endpoints.
    Only supports HTTP (streamable-http) transport.
    """
    configure_logging(debug)
    print(f"Creating MCP app...")
    # init_flask_app()
    mcp = init_fastmcp_server()

    env_key = f"FASTMCP_RUNNING_{port}"
    if not os.environ.get(env_key):
        os.environ[env_key] = "1"
        try:
            print(f"Starting FastMCP on {host}:{port}")
            mcp.run(transport="streamable-http", host=host, port=port)
        except Exception as e:
            print(f"FastMCP failed: {e}")
            os.environ.pop(env_key, None)
    else:
        print(f"FastMCP already running on {host}:{port}")

if __name__ == "__main__":
    run_server()

