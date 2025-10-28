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
FastMCP app factory and initialization for Superset MCP service.
This file provides a configurable factory function to create FastMCP instances
following the Flask application factory pattern. All tool modules should import
mcp from here and use @mcp.tool decorators.
"""

import logging
from typing import Any, Callable, Dict, List, Set

from fastmcp import FastMCP

logger = logging.getLogger(__name__)

# Default instructions for the Superset MCP service
DEFAULT_INSTRUCTIONS = """
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
"""


def _build_mcp_kwargs(
    name: str,
    instructions: str,
    auth: Any | None,
    lifespan: Callable[..., Any] | None,
    tools: List[Any] | None,
    include_tags: Set[str] | None,
    exclude_tags: Set[str] | None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Build FastMCP constructor arguments."""
    mcp_kwargs: Dict[str, Any] = {
        "name": name,
        "instructions": instructions,
    }

    # Add optional parameters if provided
    if auth is not None:
        mcp_kwargs["auth"] = auth
    if lifespan is not None:
        mcp_kwargs["lifespan"] = lifespan
    if tools is not None:
        mcp_kwargs["tools"] = tools
    if include_tags is not None:
        mcp_kwargs["include_tags"] = include_tags
    if exclude_tags is not None:
        mcp_kwargs["exclude_tags"] = exclude_tags

    # Add any additional kwargs
    mcp_kwargs.update(kwargs)
    return mcp_kwargs


def _apply_config(mcp_instance: FastMCP, config: Dict[str, Any] | None) -> None:
    """Apply additional configuration to FastMCP instance."""
    if config:
        for key, value in config.items():
            setattr(mcp_instance, key, value)


def _log_instance_creation(
    name: str,
    auth: Any | None,
    include_tags: Set[str] | None,
    exclude_tags: Set[str] | None,
) -> None:
    """Log FastMCP instance creation details."""
    logger.info("Created FastMCP instance: %s", name)
    if auth:
        logger.info("Authentication enabled")
    if include_tags or exclude_tags:
        logger.info(
            "Tag filtering enabled - include: %s, exclude: %s",
            include_tags,
            exclude_tags,
        )


def create_mcp_app(
    name: str = "Superset MCP Server",
    instructions: str | None = None,
    auth: Any | None = None,
    lifespan: Callable[..., Any] | None = None,
    tools: List[Any] | None = None,
    include_tags: Set[str] | None = None,
    exclude_tags: Set[str] | None = None,
    config: Dict[str, Any] | None = None,
    **kwargs: Any,
) -> FastMCP:
    """
    Application factory for creating FastMCP instances.

    This follows the Flask application factory pattern, allowing users to
    configure the FastMCP instance with custom authentication, middleware,
    and other settings.

    Args:
        name: Human-readable server name
        instructions: Server description and usage instructions
        auth: Authentication provider for securing HTTP transports
        lifespan: Async context manager for startup/shutdown logic
        tools: List of tools or functions to add to the server
        include_tags: Set of tags to include (whitelist)
        exclude_tags: Set of tags to exclude (blacklist)
        config: Additional configuration dictionary
        **kwargs: Additional FastMCP constructor arguments

    Returns:
        Configured FastMCP instance
    """
    # Use default instructions if none provided
    if instructions is None:
        instructions = DEFAULT_INSTRUCTIONS

    # Build FastMCP constructor arguments
    mcp_kwargs = _build_mcp_kwargs(
        name, instructions, auth, lifespan, tools, include_tags, exclude_tags, **kwargs
    )

    # Create the FastMCP instance
    mcp_instance = FastMCP(**mcp_kwargs)

    # Apply any additional configuration
    _apply_config(mcp_instance, config)

    # Log instance creation
    _log_instance_creation(name, auth, include_tags, exclude_tags)

    return mcp_instance


# Create default MCP instance for backward compatibility
# Tool modules can import this and use @mcp.tool decorators
mcp = create_mcp_app()

from superset.mcp_service.system.tool import health_check  # noqa: F401, E402


def init_fastmcp_server(
    name: str = "Superset MCP Server",
    instructions: str | None = None,
    auth: Any | None = None,
    lifespan: Callable[..., Any] | None = None,
    tools: List[Any] | None = None,
    include_tags: Set[str] | None = None,
    exclude_tags: Set[str] | None = None,
    config: Dict[str, Any] | None = None,
    **kwargs: Any,
) -> FastMCP:
    """
    Initialize and configure the FastMCP server.

    This function provides a way to create a custom FastMCP instance
    instead of using the default global one. If parameters are provided,
    a new instance will be created with those settings.

    Args:
        Same as create_mcp_app()

    Returns:
        FastMCP instance (either the global one or a new custom one)
    """
    # If any custom parameters are provided, create a new instance
    custom_params_provided = any(
        [
            name != "Superset MCP Server",
            instructions is not None,
            auth is not None,
            lifespan is not None,
            tools is not None,
            include_tags is not None,
            exclude_tags is not None,
            config is not None,
            kwargs,
        ]
    )

    if custom_params_provided:
        logger.info("Creating custom FastMCP instance with provided configuration")
        return create_mcp_app(
            name=name,
            instructions=instructions,
            auth=auth,
            lifespan=lifespan,
            tools=tools,
            include_tags=include_tags,
            exclude_tags=exclude_tags,
            config=config,
            **kwargs,
        )
    else:
        # Use the default global instance
        logger.setLevel(logging.DEBUG)
        logger.info("Using default FastMCP instance - scaffold version without auth")
        return mcp
