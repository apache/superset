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
import time
from typing import Any, Dict, Optional, Tuple

from fastmcp import FastMCP
from fastmcp.server.auth.providers.bearer import BearerAuthProvider
from starlette.exceptions import HTTPException
from starlette.responses import Response

from superset.mcp_service.middleware import (
    FieldPermissionsMiddleware,
    GlobalErrorHandlerMiddleware,
    LoggingMiddleware,
    PrivateToolMiddleware,
    RateLimitMiddleware,
)

logger = logging.getLogger(__name__)

# Simple in-memory cache for screenshots (chart_id -> (timestamp, image_data))
_screenshot_cache: Dict[str, Tuple[float, bytes]] = {}
SCREENSHOT_CACHE_TTL = 300  # 5 minutes cache


def _create_auth_provider() -> Optional[BearerAuthProvider]:
    """
    Create a BearerAuthProvider using the configured factory function.
    Uses app.config["MCP_AUTH_FACTORY"](app) pattern as suggested by @dpgaspar.
    """
    try:
        from superset.app import create_app
        from superset.mcp_service.config import DEFAULT_CONFIG

        # Create Flask app instance to access config
        superset_app = create_app()

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

# Import all tool modules to ensure registration (must be after mcp is defined)
# These imports register the tools with the mcp instance
import superset.mcp_service.chart.prompts  # noqa: F401, E402
import superset.mcp_service.chart.resources  # noqa: F401, E402
import superset.mcp_service.chart.tool  # noqa: F401, E402
import superset.mcp_service.dashboard.prompts  # noqa: F401, E402
import superset.mcp_service.dashboard.resources  # noqa: F401, E402
import superset.mcp_service.dashboard.tool  # noqa: F401, E402
import superset.mcp_service.dataset.prompts  # noqa: F401, E402
import superset.mcp_service.dataset.resources  # noqa: F401, E402
import superset.mcp_service.dataset.tool  # noqa: F401, E402
import superset.mcp_service.explore.tool  # noqa: F401, E402
import superset.mcp_service.sql_lab.tool  # noqa: F401, E402

# Import prompts and resources modules (must be after mcp is defined)
# These imports register the prompts and resources with the mcp instance
import superset.mcp_service.system.prompts  # noqa: F401, E402
import superset.mcp_service.system.resources  # noqa: F401, E402
import superset.mcp_service.system.tool  # noqa: F401, E402


# Add custom route for serving screenshot images
async def serve_chart_screenshot(chart_id: str) -> Any:  # noqa: C901
    """
    Serve chart screenshot images directly as PNG files.
    This endpoint provides public access to chart screenshots without authentication.
    """

    # Check cache first
    current_time = time.time()
    cache_key = f"chart_{chart_id}"

    if cache_key in _screenshot_cache:
        timestamp, cached_data = _screenshot_cache[cache_key]
        if current_time - timestamp < SCREENSHOT_CACHE_TTL:
            logger.info(f"Serving cached screenshot for chart {chart_id}")
            return Response(
                content=cached_data,
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=300",  # 5 min cache
                    "Content-Disposition": f"inline; filename=chart_{chart_id}.png",
                    "X-Cache": "HIT",
                },
            )

    try:
        from flask import current_app, g

        from superset.daos.chart import ChartDAO
        from superset.mcp_service.screenshot.pooled_screenshot import (
            PooledChartScreenshot,
        )
        from superset.utils.urls import get_url_path

        # Use current Flask app context for database access
        # Note: This assumes we're already in a Flask app context
        superset_app = current_app

        # Create a mock user context - you might need to adjust this
        from flask_appbuilder.security.sqla.models import User

        from superset.extensions import db

        # Get username from config, fallback to "admin"
        username = superset_app.config.get("MCP_ADMIN_USERNAME", "admin")
        mock_user = db.session.query(User).filter_by(username=username).first()
        if mock_user:
            g.user = mock_user
        else:
            logger.warning(f"User '{username}' not found, screenshot may fail")

        # Find the chart
        chart = None
        try:
            if chart_id.isdigit():
                chart = ChartDAO.find_by_id(int(chart_id))
            else:
                # Try UUID lookup using DAO flexible method
                chart = ChartDAO.find_by_id(chart_id, id_column="uuid")
        except Exception as e:
            logger.error(f"Error looking up chart {chart_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=(f"Database error while looking up chart {chart_id}: {str(e)}"),
            ) from e

        if not chart:
            logger.warning(f"Chart {chart_id} not found in database")
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Chart with ID '{chart_id}' not found. "
                    f"Please verify the chart ID exists."
                ),
            )

        logger.info(f"Serving screenshot for chart {chart.id}: {chart.slice_name}")

        # Create chart URL for screenshot
        chart_url = get_url_path("Superset.slice", slice_id=chart.id)

        # Create screenshot object
        screenshot = PooledChartScreenshot(chart_url, chart.digest)

        # Generate screenshot (800x600 default)
        window_size = (800, 600)
        try:
            image_data = screenshot.get_screenshot(user=g.user, window_size=window_size)
        except Exception as e:
            logger.error(f"Screenshot generation failed for chart {chart_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Failed to generate screenshot for chart {chart_id}. "
                    f"Error: {str(e)}"
                ),
            ) from e

        if image_data:
            # Cache the screenshot
            _screenshot_cache[cache_key] = (current_time, image_data)

            # Clean up old cache entries (simple cleanup)
            keys_to_remove = []
            for key, (ts, _) in _screenshot_cache.items():
                if current_time - ts > SCREENSHOT_CACHE_TTL:
                    keys_to_remove.append(key)
            for key in keys_to_remove:
                del _screenshot_cache[key]

            logger.info(f"Generated and cached screenshot for chart {chart_id}")

            # Return the PNG image directly
            return Response(
                content=image_data,
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=300",  # 5 min cache
                    "Content-Disposition": f"inline; filename=chart_{chart.id}.png",
                    "X-Cache": "MISS",
                },
            )
        else:
            logger.error(f"Screenshot returned None for chart {chart_id}")
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Screenshot generation returned empty result for "
                    f"chart {chart_id}. The chart may have rendering issues."
                ),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving screenshot for chart {chart_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


def _get_form_data_from_cache(form_data_key: str) -> str:
    """Retrieve form data from cache using the form data key."""
    from superset.commands.explore.form_data.get import GetFormDataCommand
    from superset.commands.explore.form_data.parameters import (
        CommandParameters as FormDataCommandParameters,
    )

    try:
        parameters = FormDataCommandParameters(key=form_data_key)
        form_data_json = GetFormDataCommand(parameters).run()
        if not form_data_json:
            logger.warning(f"Form data key not found in cache: {form_data_key}")
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Form data key '{form_data_key}' not found or expired. "
                    f"Please generate a new explore link."
                ),
            )
        return form_data_json
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve form data for key {form_data_key}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving form data for key '{form_data_key}': {str(e)}",
        ) from e


def _parse_datasource_from_form_data(form_data_json: str) -> tuple[str, str]:
    """Parse datasource info from form data JSON."""
    from superset.utils import json

    try:
        form_data = json.loads(form_data_json)
        datasource = form_data.get("datasource", "")
        if datasource and "__" in datasource:
            datasource_id, datasource_type = datasource.split("__", 1)
        else:
            # Try to extract from other fields
            datasource_id = form_data.get("datasource_id", "")
            datasource_type = form_data.get("datasource_type", "table")
        return datasource_id, datasource_type
    except Exception:
        logger.warning("Could not parse form data to get datasource info")
        return "", "table"


async def serve_explore_screenshot(form_data_key: str) -> Any:
    """
    Serve explore screenshot images from form_data_key.

    Args:
        form_data_key: The form data key for the explore view

    Returns:
        StreamingResponse with PNG image data
    """
    try:
        from flask import g

        from superset.app import create_app
        from superset.utils.urls import get_url_path

        # Create Flask app instance and set up context
        superset_app = create_app()
        with superset_app.app_context():
            # Create a mock user context - you might need to adjust this
            from flask_appbuilder.security.sqla.models import User

            from superset.extensions import db

            # Get username from config, fallback to "admin"
            username = superset_app.config.get("MCP_ADMIN_USERNAME", "admin")
            mock_user = db.session.query(User).filter_by(username=username).first()
            if mock_user:
                g.user = mock_user
            else:
                logger.warning(f"User '{username}' not found, screenshot may fail")

            # Look up the form data from the cache
            form_data_json = _get_form_data_from_cache(form_data_key)

            # Parse form data to get datasource info
            datasource_id, datasource_type = _parse_datasource_from_form_data(
                form_data_json
            )

            # Create explore URL with all necessary parameters
            explore_url = get_url_path("Superset.explore")
            url_params = [f"form_data_key={form_data_key}"]

            # Add datasource parameters if available
            if datasource_id:
                url_params.append(f"datasource_id={datasource_id}")
                url_params.append(f"datasource_type={datasource_type}")

            explore_url += "?" + "&".join(url_params)

            logger.info(f"Generating screenshot for explore URL: {explore_url}")
            logger.info(
                f"Form data retrieved: "
                f"{form_data_json[:200] if form_data_json else 'None'}..."
            )  # Log first 200 chars

            # Use pooled screenshot for better performance
            import hashlib

            from superset.mcp_service.screenshot.pooled_screenshot import (
                PooledExploreScreenshot,
            )

            digest = hashlib.sha256(form_data_key.encode()).hexdigest()
            screenshot = PooledExploreScreenshot(explore_url, digest)

            # Generate screenshot with higher resolution
            window_size = (1600, 1200)  # Doubled resolution from 800x600
            try:
                image_data = screenshot.get_screenshot(
                    user=g.user, window_size=window_size
                )
            except Exception as e:
                logger.error(
                    f"Screenshot generation failed for explore view "
                    f"{form_data_key}: {e}"
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Failed to generate screenshot for explore view. "
                        f"Error: {str(e)}"
                    ),
                ) from e

            if image_data:
                # Return the PNG image directly
                return Response(
                    content=image_data,
                    media_type="image/png",
                    headers={
                        "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                        "Content-Disposition": (
                            f"inline; filename=explore_{form_data_key}.png"
                        ),
                    },
                )
            else:
                logger.error(
                    f"Screenshot returned None for explore view {form_data_key}"
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Screenshot generation returned empty result for explore view. "
                        "The view may have rendering issues or invalid parameters."
                    ),
                )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error serving screenshot for form_data_key {form_data_key}: {e}")
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


@mcp.custom_route("/screenshot/explore/{form_data_key}.png", methods=["GET"])
async def serve_explore_screenshot_endpoint(request: Any) -> Any:
    """
    Custom HTTP endpoint for serving explore screenshots from form_data_key.
    """
    # Extract form_data_key from path parameters
    form_data_key = request.path_params["form_data_key"]

    # Call our explore screenshot function
    return await serve_explore_screenshot(form_data_key)


def init_fastmcp_server(enable_auth_configuration: bool = True) -> FastMCP:
    """
    Initialize and configure the FastMCP server with all middleware.
    This should be called before running the server to ensure middleware is registered.

    Args:
        enable_auth_configuration: If True, configure auth using the factory pattern
    """
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

    # Add middleware (order matters - error handler should be first to catch all errors)
    mcp.add_middleware(GlobalErrorHandlerMiddleware())
    mcp.add_middleware(RateLimitMiddleware())  # Rate limiting before other middleware
    mcp.add_middleware(
        FieldPermissionsMiddleware()
    )  # Field filtering after rate limiting
    mcp.add_middleware(LoggingMiddleware())
    mcp.add_middleware(PrivateToolMiddleware())

    logger.info(
        "MCP Server initialized with modular tools structure, prompts, and resources"
    )
    return mcp
