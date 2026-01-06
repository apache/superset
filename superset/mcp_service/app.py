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
FastMCP app factory and initialization for the MCP service.
This file provides a configurable factory function to create FastMCP instances
following the Flask application factory pattern. All tool modules should import
mcp from here and use @mcp.tool decorators.
"""

import logging
from typing import Any, Callable, Dict, List, Sequence, Set

from fastmcp import FastMCP
from fastmcp.server.middleware import Middleware

logger = logging.getLogger(__name__)


def get_default_instructions(branding: str = "Apache Superset") -> str:
    """Get default instructions with configurable branding.

    Args:
        branding: Product name to use in instructions
            (e.g., "ACME Analytics", "Apache Superset")

    Returns:
        Formatted instructions string with branding applied
    """
    return f"""
You are connected to the {branding} MCP (Model Context Protocol) service.
This service provides programmatic access to {branding} dashboards, charts, datasets,
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
- get_instance_info: Get instance-wide statistics and metadata
- health_check: Simple health check tool (takes NO parameters, call without arguments)

Available Resources:
- instance/metadata: Access instance configuration and metadata
- chart/templates: Access chart configuration templates

Available Prompts:
- quickstart: Interactive guide for getting started with the MCP service
- create_chart_guided: Step-by-step chart creation wizard

Common Chart Types (viz_type) and Behaviors:

Interactive Charts (support sorting, filtering, drill-down):
- table: Standard table view with sorting and filtering
- pivot_table_v2: Pivot table with grouping and aggregations
- echarts_timeseries_line: Time series line chart
- echarts_timeseries_bar: Time series bar chart
- echarts_timeseries_area: Time series area chart
- echarts_timeseries_scatter: Time series scatter plot
- mixed_timeseries: Combined line/bar time series

Common Visualization Types:
- big_number: Single metric display
- big_number_total: Total value display
- pie: Pie chart for proportions
- echarts_timeseries: Generic time series chart
- funnel: Funnel chart for conversion analysis
- gauge_chart: Gauge/speedometer visualization
- heatmap_v2: Heat map for correlation analysis
- sankey_v2: Sankey diagram for flow visualization
- sunburst_v2: Sunburst chart for hierarchical data
- treemap_v2: Tree map for hierarchical proportions
- word_cloud: Word cloud visualization
- world_map: Geographic world map
- box_plot: Box plot for distribution analysis
- bubble: Bubble chart for 3-dimensional data

Query Examples:
- List all interactive tables:
  filters=[{{"col": "viz_type", "opr": "in", "value": ["table", "pivot_table_v2"]}}]
- List time series charts:
  filters=[{{"col": "viz_type", "opr": "sw", "value": "echarts_timeseries"}}]
- Search by name: search="sales"

General usage tips:
- All listing tools use 1-based pagination (first page is 1)
- Use 'filters' parameter for advanced queries (see *_available_filters tools)
- IDs can be integer or UUID format where supported
- All tools return structured, Pydantic-typed responses
- Chart previews are served as PNG images via custom screenshot endpoints

If you are unsure which tool to use, start with get_instance_info
or use the quickstart prompt for an interactive guide.
"""


# For backwards compatibility, keep DEFAULT_INSTRUCTIONS pointing to default branding
DEFAULT_INSTRUCTIONS = get_default_instructions()


def _build_mcp_kwargs(
    name: str,
    instructions: str,
    auth: Any | None,
    lifespan: Callable[..., Any] | None,
    tools: List[Any] | None,
    include_tags: Set[str] | None,
    exclude_tags: Set[str] | None,
    middleware: Sequence[Middleware] | None = None,
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
    if middleware is not None:
        mcp_kwargs["middleware"] = middleware

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
    name: str | None = None,
    instructions: str | None = None,
    branding: str | None = None,
    auth: Any | None = None,
    lifespan: Callable[..., Any] | None = None,
    tools: List[Any] | None = None,
    include_tags: Set[str] | None = None,
    exclude_tags: Set[str] | None = None,
    config: Dict[str, Any] | None = None,
    middleware: Sequence[Middleware] | None = None,
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
        branding: Product name for instructions (e.g., "ACME Analytics")
        auth: Authentication provider for securing HTTP transports
        lifespan: Async context manager for startup/shutdown logic
        tools: List of tools or functions to add to the server
        include_tags: Set of tags to include (whitelist)
        exclude_tags: Set of tags to exclude (blacklist)
        config: Additional configuration dictionary
        middleware: Sequence of middleware to apply to the server
        **kwargs: Additional FastMCP constructor arguments

    Returns:
        Configured FastMCP instance
    """
    # Default name if not provided
    if name is None:
        name = "MCP Server"

    # Use default instructions if none provided
    if instructions is None:
        # If branding is provided, use it to generate instructions
        if branding is not None:
            instructions = get_default_instructions(branding)
        else:
            instructions = DEFAULT_INSTRUCTIONS

    # Build FastMCP constructor arguments
    mcp_kwargs = _build_mcp_kwargs(
        name,
        instructions,
        auth,
        lifespan,
        tools,
        include_tags,
        exclude_tags,
        middleware,
        **kwargs,
    )

    # Create the FastMCP instance
    mcp_instance = FastMCP(**mcp_kwargs)

    # Apply any additional configuration
    _apply_config(mcp_instance, config)

    # Log instance creation
    _log_instance_creation(name, auth, include_tags, exclude_tags)

    return mcp_instance


# Create default MCP instance for backward compatibility
mcp = create_mcp_app(stateless_http=True)

# Import all MCP tools to register them with the mcp instance
# NOTE: Always add new tool imports here when creating new MCP tools.
# Tools use the @tool decorator from `superset-core` and register automatically
# on import. Import prompts and resources to register them with the mcp instance
# NOTE: Always add new prompt/resource imports here when creating new prompts/resources.
# Prompts use @mcp.prompt decorators and resources use @mcp.resource decorators.
# They register automatically on import, similar to tools.
from superset.mcp_service.chart import (  # noqa: F401, E402
    prompts as chart_prompts,
    resources as chart_resources,
)
from superset.mcp_service.chart.tool import (  # noqa: F401, E402
    generate_chart,
    get_chart_available_filters,
    get_chart_data,
    get_chart_info,
    get_chart_preview,
    list_charts,
    update_chart,
    update_chart_preview,
)
from superset.mcp_service.dashboard.tool import (  # noqa: F401, E402
    add_chart_to_existing_dashboard,
    generate_dashboard,
    get_dashboard_available_filters,
    get_dashboard_info,
    list_dashboards,
)
from superset.mcp_service.dataset.tool import (  # noqa: F401, E402
    get_dataset_available_filters,
    get_dataset_info,
    list_datasets,
)
from superset.mcp_service.explore.tool import (  # noqa: F401, E402
    generate_explore_link,
)
from superset.mcp_service.sql_lab.tool import (  # noqa: F401, E402
    execute_sql,
    open_sql_lab_with_context,
)
from superset.mcp_service.system import (  # noqa: F401, E402
    prompts as system_prompts,
    resources as system_resources,
)
from superset.mcp_service.system.tool import (  # noqa: F401, E402
    get_instance_info,
    health_check,
)


def init_fastmcp_server(
    name: str | None = None,
    instructions: str | None = None,
    auth: Any | None = None,
    lifespan: Callable[..., Any] | None = None,
    tools: List[Any] | None = None,
    include_tags: Set[str] | None = None,
    exclude_tags: Set[str] | None = None,
    config: Dict[str, Any] | None = None,
    middleware: Sequence[Middleware] | None = None,
    **kwargs: Any,
) -> FastMCP:
    """
    Initialize and configure the FastMCP server.

    This function provides a way to create a custom FastMCP instance
    instead of using the default global one. If parameters are provided,
    a new instance will be created with those settings.

    Args:
        name: Server name (defaults to "{APP_NAME} MCP Server")
        instructions: Custom instructions (defaults to branded with APP_NAME)
        auth, lifespan, tools, include_tags, exclude_tags, config: FastMCP configuration
        middleware: Sequence of middleware to apply to the server
        **kwargs: Additional FastMCP configuration

    Returns:
        FastMCP instance (either the global one or a new custom one)
    """
    # Read branding from Flask config's APP_NAME
    from superset.mcp_service.flask_singleton import app as flask_app

    # Derive branding from Superset's APP_NAME config (defaults to "Superset")
    app_name = flask_app.config.get("APP_NAME", "Superset")
    branding = app_name
    default_name = f"{app_name} MCP Server"

    # Apply branding defaults if not explicitly provided
    if name is None:
        name = default_name
    if instructions is None:
        instructions = get_default_instructions(branding)

    # If any custom parameters are provided, create a new instance
    custom_params_provided = any(
        [
            name != default_name,
            instructions != get_default_instructions(branding),
            auth is not None,
            lifespan is not None,
            tools is not None,
            include_tags is not None,
            exclude_tags is not None,
            config is not None,
            middleware is not None,
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
            middleware=middleware,
            **kwargs,
        )
    else:
        # Use the default global instance
        logger.setLevel(logging.DEBUG)
        logger.info("Using default FastMCP instance - scaffold version without auth")
        return mcp
