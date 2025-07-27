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
from typing import Any, Optional

from fastmcp import FastMCP
from fastmcp.server.auth.providers.bearer import BearerAuthProvider

from superset.mcp_service.middleware import LoggingMiddleware, PrivateToolMiddleware


def _create_auth_provider() -> Optional[BearerAuthProvider]:
    """
    Create a BearerAuthProvider using the configured factory function.
    Uses app.config["MCP_AUTH_FACTORY"](app) pattern as suggested by @dpgaspar.
    """
    try:
        from superset import app as superset_app
        from superset.mcp_service.config import DEFAULT_CONFIG

        # Apply defaults to app.config if not already set
        for key, value in DEFAULT_CONFIG.items():
            if key not in superset_app.config:
                superset_app.config[key] = value

        # Call the factory using app.config pattern
        auth_factory = superset_app.config.get("MCP_AUTH_FACTORY")
        if auth_factory and callable(auth_factory):
            return auth_factory(superset_app)

        return None
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to create auth provider: {e}")
        return None


# Create MCP instance without auth initially - auth will be configured in
# init_fastmcp_server()
mcp = FastMCP(
    "Superset MCP Server",
    auth=None,  # Will be set later via factory
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
- get_chart_preview: Get a visual preview of a chart with image URL for display
- get_chart_data: Get the underlying data for a chart in text-friendly format
- get_chart_available_filters: List all available chart filter fields and operators
- generate_explore_link: Generate a pre-configured explore URL with specified
  dataset, metrics, dimensions, and filters for direct navigation


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
import superset.mcp_service.sql_lab.tool  # noqa: F401, E402
import superset.mcp_service.system.tool  # noqa: F401, E402


# Add custom route for serving screenshot images
async def serve_chart_screenshot(chart_id: str) -> Any:
    """
    Serve chart screenshot images directly as PNG files.
    This endpoint provides public access to chart screenshots without authentication.
    """
    # Import Starlette components which are available in FastMCP
    try:
        from starlette.exceptions import HTTPException
        from starlette.responses import Response
    except ImportError:
        # Fallback error
        raise Exception("Starlette components not available") from None

    logger = logging.getLogger(__name__)

    try:
        from flask import g

        from superset import app as superset_app
        from superset.daos.chart import ChartDAO
        from superset.utils.screenshots import ChartScreenshot
        from superset.utils.urls import get_url_path

        # Set up Flask app context for database access
        with superset_app.app_context():
            # Create a mock user context - you might need to adjust this
            from flask_appbuilder.security.sqla.models import User

            from superset.extensions import db

            mock_user = db.session.query(User).filter_by(username="amin").first()
            if mock_user:
                g.user = mock_user

            # Find the chart
            chart = None
            if chart_id.isdigit():
                chart = ChartDAO.find_by_id(int(chart_id))
            else:
                # Try UUID lookup using DAO flexible method
                chart = ChartDAO.find_by_id(chart_id, id_column="uuid")

            if not chart:
                raise HTTPException(
                    status_code=404, detail=f"Chart {chart_id} not found"
                )

            logger.info(f"Serving screenshot for chart {chart.id}: {chart.slice_name}")

            # Create chart URL for screenshot
            chart_url = get_url_path("Superset.slice", slice_id=chart.id)

            # Create screenshot object
            screenshot = ChartScreenshot(chart_url, chart.digest)

            # Generate screenshot (800x600 default)
            window_size = (800, 600)
            image_data = screenshot.get_screenshot(user=g.user, window_size=window_size)

            if image_data:
                # Return the PNG image directly
                return Response(
                    content=image_data,
                    media_type="image/png",
                    headers={
                        "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                        "Content-Disposition": f"inline; filename=chart_{chart.id}.png",
                    },
                )
            else:
                raise HTTPException(
                    status_code=500, detail="Failed to generate screenshot"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving screenshot for chart {chart_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# Register the custom route using decorator syntax
@mcp.custom_route("/screenshot/chart/{chart_id}.png", methods=["GET"])
async def serve_chart_screenshot_endpoint(request: Any) -> Any:
    """
    Custom HTTP endpoint for serving chart screenshots.
    """
    # Extract chart_id from path parameters
    chart_id = request.path_params["chart_id"]

    # Call our screenshot function
    return await serve_chart_screenshot(chart_id)


def init_fastmcp_server(enable_auth_configuration: bool = True) -> FastMCP:
    """
    Initialize and configure the FastMCP server with all middleware.
    This should be called before running the server to ensure middleware is registered.

    Args:
        enable_auth_configuration: If True, configure auth using the factory pattern
    """
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)

    # Configure authentication using factory pattern
    if enable_auth_configuration:
        try:
            auth_provider = _create_auth_provider()
            if auth_provider:
                logger.info("Configuring MCP authentication using factory pattern")
                # Set the auth provider on the mcp instance
                mcp.auth = auth_provider
                logger.info(
                    f"Authentication configured: {type(auth_provider).__name__}"
                )
            else:
                logger.info(
                    "No authentication configured - MCP service will run without auth"
                )
        except Exception as e:
            logger.error(f"Auth configuration failed: {e}")
            logger.info("MCP service will run without authentication")

    # Add middleware
    mcp.add_middleware(LoggingMiddleware())
    mcp.add_middleware(PrivateToolMiddleware())

    logger.info("MCP Server initialized with modular tools structure")
    return mcp
