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
import time

from superset.mcp_service.app import mcp
from superset.mcp_service.system.schemas import HealthCheckResponse

logger = logging.getLogger(__name__)


@mcp.tool
async def health_check() -> HealthCheckResponse:
    """
    Simple health check tool for testing the MCP service.

    Returns basic system information and confirms the service is running.
    This is useful for testing connectivity and basic functionality.

    Returns:
        HealthCheckResponse: Health status and system information
    """
    try:
        response = HealthCheckResponse(
            status="healthy",
            timestamp=datetime.datetime.now().isoformat(),
            service="Superset MCP Service",
            version="1.0.0",
            python_version=platform.python_version(),
            platform=platform.system(),
            uptime_seconds=time.time(),  # Simple uptime approximation
        )

        logger.info("Health check completed successfully")
        return response

    except Exception as e:
        logger.error("Health check failed: %s", e)
        # Return error status but don't raise to keep tool working
        return HealthCheckResponse(
            status="error",
            timestamp=datetime.datetime.now().isoformat(),
            service="Superset MCP Service",
            version="1.0.0",
            python_version=platform.python_version(),
            platform=platform.system(),
            uptime_seconds=0.0,
        )
