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
- generate_dashboard: Create a dashboard from chart IDs
- add_chart_to_existing_dashboard: Add a chart to an existing dashboard

Database Connections:
- list_databases: List database connections with advanced filters (1-based pagination)
- get_database_info: Get detailed database connection info by ID (backend, capabilities)

Dataset Management:
- list_datasets: List datasets with advanced filters (1-based pagination)
- get_dataset_info: Get detailed dataset information by ID (includes columns/metrics)
- create_virtual_dataset: Save a SQL query as a virtual dataset for charting

Chart Management:
- list_charts: List charts with advanced filters (1-based pagination)
- get_chart_info: Get detailed chart information by ID
- get_chart_preview: Get a visual preview of a chart with image URL
- get_chart_data: Get underlying chart data in text-friendly format
- get_chart_sql: Get the rendered SQL query for a chart (without executing it)
- generate_chart: Create and save a new chart permanently
- generate_explore_link: Create an interactive explore URL (preferred for exploration)
- update_chart: Update existing saved chart configuration
- update_chart_preview: Update cached chart preview without saving

SQL Lab Integration:
- execute_sql: Execute SQL queries and get results (requires database_id)
- save_sql_query: Save a SQL query to Saved Queries list
- open_sql_lab_with_context: Generate SQL Lab URL with pre-filled sql

Schema Discovery:
- get_schema: Get schema metadata for chart/dataset/dashboard (columns, filters)

System Information:
- get_instance_info: Get instance-wide statistics, metadata, and current user identity
- health_check: Simple health check tool (takes NO parameters, call without arguments)
- generate_bug_report: Build a PII-sanitized bug report to send to Preset support
  (use when the user says the MCP is broken or asks how to report an issue)

Available Resources:
- instance://metadata: Instance configuration, stats, and available dataset IDs
- chart://configs: Valid chart configuration examples and best practices

Available Prompts:
- quickstart: Interactive guide for getting started with the MCP service
- create_chart_guided: Step-by-step chart creation wizard

IMPORTANT - Using Saved Metrics vs Columns:
When get_dataset_info returns a dataset, it includes both 'columns' and 'metrics'.
- 'columns' are raw database columns (e.g., order_date, product_name, revenue)
- 'metrics' are pre-defined saved metrics with SQL expressions
  (e.g., count, total_revenue)

When building chart configurations
(generate_chart, generate_explore_link, update_chart):
- For raw columns: use {{"name": "col_name", "aggregate": "SUM"}}
- For saved metrics: use {{"name": "metric", "saved_metric": true}}
  Do NOT add an aggregate when using saved_metric=true
  (it's already defined in the metric).
  Do NOT use a saved metric name as if it were a column — it will fail.

Example: If get_dataset_info returns metrics=[{{"metric_name": "count", ...}}], use:
  {{"name": "count", "saved_metric": true}}  ← CORRECT
  {{"name": "count", "aggregate": "COUNT"}}  ← WRONG (count is not a column)

IMPORTANT - Request Wrapper:
For tools whose schema includes a top-level 'request' parameter, wrap all fields under request:
  list_charts(request={{"filters": [...], "page": 1}})
  get_chart_info(request={{"identifier": 123}})
  get_dataset_info(request={{"identifier": 456}})
  execute_sql(request={{"database_id": 1, "sql": "SELECT 1"}})
Some tools do not use a request wrapper, so follow each tool's schema
(for example: get_chart_type_schema(chart_type="xy")).

Recommended Workflows:

To add a chart to an existing dashboard:
1. add_chart_to_existing_dashboard(dashboard_id, chart_id) -> updates dashboard directly
   - If permission_denied=True is returned: inform the user they lack edit rights,
     then ask if they want a new dashboard created instead. Only call generate_dashboard
     after they confirm. Never silently create a new dashboard without asking first.

To create a chart:
1. list_datasets(request={{}}) -> find a dataset
2. get_dataset_info(request={{"identifier": <id>}})
   -> examine columns AND metrics
3. generate_explore_link(request={{
     "dataset_id": <id>,
     "config": {{"chart_type": "xy", ...}}
   }}) -> preview interactively
4. generate_chart(request={{
     "dataset_id": <id>,
     "config": {{...}}, "save_chart": true
   }}) -> save permanently

To find your own charts/dashboards/databases:
1. get_instance_info -> get current_user.id
2. list_charts(request={{"filters": [{{"col": "created_by_fk",
   "opr": "eq", "value": current_user.id}}]}})
3. Or: list_dashboards(request={{"filters": [{{"col": "created_by_fk",
   "opr": "eq", "value": current_user.id}}]}})
4. Or: list_databases(request={{"filters": [{{"col": "created_by_fk",
   "opr": "eq", "value": current_user.id}}]}})

To explore data with SQL:
1. list_datasets(request={{}}) -> find a dataset and note its database_id
2. execute_sql(request={{"database_id": <id>, "sql": "SELECT ..."}})
3. save_sql_query(request={{
     "database_id": <id>, "label": "name", "sql": "..."
   }})
4. open_sql_lab_with_context(request={{
     "database_id": <id>
   }})

To chart from a SQL query (JOIN, CTE, aggregation):
1. execute_sql(request={{"database_id": <id>, "sql": "..."}})
   -> verify the query returns expected data
2. Ask the user if they want to save it as a dataset
3. create_virtual_dataset(request={{
     "database_id": <id>, "sql": "...",
     "dataset_name": "name"
   }}) -> save as chartable dataset
4. generate_explore_link or generate_chart with the new dataset

generate_explore_link vs generate_chart:
- Use generate_explore_link for exploration (no permanent chart created)
- Use generate_chart with save_chart=True only when user wants to save permanently

Chart Types You Can CREATE with generate_chart/generate_explore_link:
- chart_type="xy", kind="line": Line chart for time series and trends
- chart_type="xy", kind="bar": Bar chart for category comparison
- chart_type="xy", kind="area": Area chart for volume visualization
- chart_type="xy", kind="scatter": Scatter plot for correlation analysis
- chart_type="big_number": Big Number display (single metric, header only)
- chart_type="big_number", show_trendline=True,
  temporal_column="<date_col>": Big Number with trendline
- chart_type="table": Data table for detailed views
- chart_type="table", viz_type="ag-grid-table": Interactive AG Grid table
- chart_type="pie": Pie chart for proportional data (set donut=True for donut)
- chart_type="pivot_table": Interactive pivot table for cross-tabulation
- chart_type="mixed_timeseries": Dual-series chart combining two chart types
- chart_type="handlebars": Custom HTML template chart (KPI cards, leaderboards, reports)
  Requires handlebars_template with Handlebars HTML template string.
  Supports query_mode="aggregate" (with metrics/groupby) or "raw" (with columns).
  Data available as {{{{data}}}} array; helpers: dateFormat, formatNumber, stringify.

Time grain for temporal x-axis (time_grain parameter):
- PT1H (hourly), P1D (daily), P1W (weekly), P1M (monthly), P1Y (yearly)

Chart Types in Existing Charts (viewable via list_charts/get_chart_info):
- pie, big_number, big_number_total, funnel, gauge_chart
- echarts_timeseries_line, echarts_timeseries_bar, echarts_timeseries_area
- pivot_table_v2, heatmap_v2, sankey_v2, sunburst_v2, treemap_v2
- word_cloud, world_map, box_plot, bubble, mixed_timeseries

Query Examples:
- List all tables:
  list_charts(request={{"filters": [{{"col": "viz_type",
    "opr": "in",
    "value": ["table", "pivot_table_v2"]}}]}})
- List time series charts:
  list_charts(request={{"filters": [{{"col": "viz_type",
    "opr": "sw", "value": "echarts_timeseries"}}]}})
- Search by name: list_charts(request={{"search": "sales"}})
- My charts (use current_user.id from get_instance_info):
  list_charts(request={{"filters": [{{"col": "created_by_fk", "opr": "eq", "value": <user_id>}}]}})
- My dashboards:
  list_dashboards(request={{"filters": [{{"col": "created_by_fk", "opr": "eq", "value": <user_id>}}]}})
- My databases:
  list_databases(request={{"filters": [{{"col": "created_by_fk", "opr": "eq", "value": <user_id>}}]}})

To modify an existing chart (add filters, change metrics, etc.):
1. get_chart_info(request={{"identifier": <chart_id>}})
   -> examine current configuration
2. update_chart(request={{
     "identifier": <chart_id>, "config": {{...}}
   }}) -> apply changes
Do NOT use execute_sql for chart modifications.
Use update_chart instead.

CRITICAL RULES - NEVER VIOLATE:
- NEVER fabricate or invent URLs. ALL URLs must come from tool call results.
  If you need a link, call the appropriate tool (generate_explore_link, generate_chart,
  open_sql_lab_with_context, etc.) and use the URL it returns.
- NEVER call generate_dashboard when the user wants to add a chart to an EXISTING
  dashboard. Always use add_chart_to_existing_dashboard. Only call generate_dashboard
  to create a brand-new dashboard, or after the user explicitly confirms they want
  a new one (e.g., after a permission_denied=True response from
  add_chart_to_existing_dashboard).
- To modify an existing chart's filters, metrics, or dimensions, use update_chart.
  Do NOT use execute_sql for chart modifications.
- Parameter name reminders: ALWAYS use the EXACT parameter names from the tool schema.
  Do NOT use Superset's internal form_data names.

IMPORTANT - Tool-Only Interaction:
- Do NOT generate code artifacts, HTML pages, JavaScript snippets, or any code intended
  for the user to run. All visualization, data retrieval, and authentication are handled
  by the provided MCP tools.
- Always call the appropriate tool directly instead of writing code. For example, use
  generate_chart to create visualizations rather than generating plotting code.
- When a tool returns a URL (chart URL, dashboard URL, explore link, SQL Lab link),
  return that URL to the user. Do NOT attempt to recreate the visualization in code.
- Do NOT generate HTML dashboards, embed scripts, or custom frontend code. Use
  generate_dashboard and add_chart_to_existing_dashboard for dashboard operations.
- If a user asks for something the tools cannot do, explain the limitation and suggest
  the closest available tool rather than generating code as a workaround.

General usage tips:
- All listing tools use 1-based pagination (first page is 1)
- Use get_schema to discover filterable columns, sortable columns, and default columns
- Use 'filters' parameter for advanced queries with filter columns from get_schema
- IDs can be integer or UUID format where supported
- All tools return structured, Pydantic-typed responses
- Chart previews are served as PNG images via custom screenshot endpoints

Input format:
- Tool request parameters accept structured objects (dicts/JSON)
- FastMCP 3.1+ handles Pydantic BaseModel parameters natively

Feature Availability:
- Call get_instance_info to discover accessible menus for the current user.
- Do NOT assume features exist; always check get_instance_info first.

Permission Awareness:
- get_instance_info returns current_user.roles (e.g., ["Admin"], ["Alpha"], ["Viewer"]).
- ALWAYS check the user's roles BEFORE suggesting write operations (creating datasets,
  charts, dashboards, or running SQL).
- Common roles and their typical capabilities:
  - Admin: Full access to all features
  - Alpha: Can create and modify charts, dashboards, datasets, and run SQL
  - Gamma: Can view charts and dashboards they have been granted access to
  - Viewer: Read-only access to shared dashboards and charts
- If a user has a read-only role (Viewer, Gamma) and a listing tool returns 0 results,
  do NOT suggest they create resources. Instead:
  1. Explain that they may not have access to the requested resources
  2. Suggest they ask a workspace admin to grant them access or share content with them
  3. Offer to help with what they CAN do (e.g., viewing dashboards they have access to)
- If you are unsure about a user's capabilities, check their accessible_menus in
  feature_availability from get_instance_info.

If you are unsure which tool to use, start with get_instance_info
or use the quickstart prompt for an interactive guide.

When you first connect, call get_instance_info to learn the user's identity.
Greet them by their first name (from current_user) and offer to help.
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
mcp = create_mcp_app()

# Initialize MCP dependency injection BEFORE importing tools/prompts
# This replaces the abstract @tool and @prompt decorators in superset_core.api.mcp
# with concrete implementations that can register with the mcp instance
from superset.core.mcp.core_mcp_injection import (  # noqa: E402
    initialize_core_mcp_dependencies,
)

initialize_core_mcp_dependencies()

# Suppress known third-party deprecation warnings that leak to MCP clients.
# The MCP SDK captures Python warnings and forwards them to clients via
# server log entries, wasting LLM tokens and causing clients to act on
# irrelevant internal warnings. These warnings come from transitive imports
# triggered by tool/schema registration below.
import warnings  # noqa: E402

warnings.filterwarnings(
    "ignore",
    category=DeprecationWarning,
    module=r"marshmallow\..*",
)
warnings.filterwarnings(
    "ignore",
    category=FutureWarning,
    module=r"google\..*",
)

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
    get_chart_data,
    get_chart_info,
    get_chart_preview,
    get_chart_sql,
    get_chart_type_schema,
    list_charts,
    update_chart,
    update_chart_preview,
)
from superset.mcp_service.dashboard.tool import (  # noqa: F401, E402
    add_chart_to_existing_dashboard,
    generate_dashboard,
    get_dashboard_info,
    list_dashboards,
)
from superset.mcp_service.database.tool import (  # noqa: F401, E402
    get_database_info,
    list_databases,
)
from superset.mcp_service.dataset.tool import (  # noqa: F401, E402
    create_virtual_dataset,
    get_dataset_info,
    list_datasets,
)
from superset.mcp_service.explore.tool import (  # noqa: F401, E402
    generate_explore_link,
)
from superset.mcp_service.sql_lab.tool import (  # noqa: F401, E402
    execute_sql,
    open_sql_lab_with_context,
    save_sql_query,
)
from superset.mcp_service.system import (  # noqa: F401, E402
    prompts as system_prompts,
    resources as system_resources,
)
from superset.mcp_service.system.tool import (  # noqa: F401, E402
    generate_bug_report,
    get_instance_info,
    get_schema,
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

    This function configures the global MCP instance (which has all tools
    already registered) with auth, middleware, and other settings.

    Args:
        name: Server name (defaults to "{APP_NAME} MCP Server")
        instructions: Custom instructions (defaults to branded with APP_NAME)
        auth, lifespan, tools, include_tags, exclude_tags, config: FastMCP configuration
        middleware: Sequence of middleware to apply to the server
        **kwargs: Additional FastMCP configuration

    Returns:
        The global FastMCP instance configured with the provided settings
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

    # Configure the global mcp instance with provided settings.
    # Tools are already registered on this instance via @tool decorator imports above.
    # name and instructions are read-only properties that delegate to _mcp_server
    mcp._mcp_server.name = name
    mcp._mcp_server.instructions = instructions

    if auth is not None:
        mcp.auth = auth
        logger.info("Authentication configured on MCP instance")

    if middleware is not None:
        for mw in middleware:
            mcp.add_middleware(mw)
        logger.info("Added %d middleware(s) to MCP instance", len(middleware))

    if lifespan is not None:
        mcp.lifespan = lifespan

    if include_tags is not None:
        mcp.include_tags = include_tags

    if exclude_tags is not None:
        mcp.exclude_tags = exclude_tags

    # Apply any additional configuration
    _apply_config(mcp, config)

    logger.info("Configured FastMCP instance: %s (auth=%s)", name, auth is not None)
    return mcp
