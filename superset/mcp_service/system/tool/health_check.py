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

"""Simple health check tool for testing MCP service."""

import datetime
import logging
import platform

from flask import current_app
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.system.schemas import HealthCheckResponse
from superset.utils.version import get_version_metadata

logger = logging.getLogger(__name__)


@tool(tags=["core"])
async def health_check() -> HealthCheckResponse:
    """
    Simple health check tool for testing the MCP service.

    IMPORTANT: This tool takes NO parameters. Call it without any arguments.

    Returns basic system information and confirms the service is running.
    This is useful for testing connectivity and basic functionality.

    Parameters:
        None - This tool does not accept any parameters

    Returns:
        HealthCheckResponse: Health status and system information including:
            - status: "healthy" or "error"
            - timestamp: ISO format timestamp
            - service: Service name derived from APP_NAME config
            - version: Application version string
            - python_version: Python version
            - platform: Operating system platform

    Example:
        # Correct - no parameters
        health_check()

        # Incorrect - do not pass any arguments
        # health_check(request={})  # This will cause validation errors
    """
    # Get app name from config (safe to do outside try block)
    app_name = current_app.config.get("APP_NAME", "Superset")
    service_name = f"{app_name} MCP Service"

    try:
        with event_logger.log_context(action="mcp.health_check.status"):
            # Get version from Superset version metadata
            version_metadata = get_version_metadata()
            version = version_metadata.get("version_string", "unknown")

        response = HealthCheckResponse(
            status="healthy",
            timestamp=datetime.datetime.now().isoformat(),
            service=service_name,
            version=version,
            python_version=platform.python_version(),
            platform=platform.system(),
        )

        logger.info("Health check completed successfully")
        return response

    except Exception as e:
        logger.error("Health check failed: %s", e)
        # Return error status but don't raise to keep tool working
        response = HealthCheckResponse(
            status="error",
            timestamp=datetime.datetime.now().isoformat(),
            service=service_name,
            version="unknown",
            python_version=platform.python_version(),
            platform=platform.system(),
        )
        return response
