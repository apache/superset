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
URL utilities for MCP service
"""

import logging
from urllib.parse import urlparse

from flask import current_app

logger = logging.getLogger(__name__)

# Hostnames that indicate a development/local environment
LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0"}  # noqa: S104


def _is_local_url(url: str) -> bool:
    """Check if a URL points to a local/development host."""
    try:
        parsed = urlparse(url)
        return parsed.hostname in LOCAL_HOSTNAMES if parsed.hostname else True
    except Exception:
        return True


def get_superset_base_url() -> str:
    """
    Get the Superset base URL from configuration.

    Returns:
        Base URL for Superset web server (e.g., "http://localhost:9001")
    """
    default_url = "http://localhost:9001"

    try:
        config = current_app.config
        if user_friendly_url := config["WEBDRIVER_BASEURL_USER_FRIENDLY"]:
            return user_friendly_url.rstrip("/")
        return default_url
    except Exception:
        return default_url


def get_mcp_service_url() -> str:
    """
    Get the MCP service base URL where screenshot endpoints are served.

    In production, the MCP service is typically accessed via the main
    Superset URL with /mcp prefix. In development,
    it's accessed directly on port 5008.

    Returns:
        Base URL for MCP service endpoints
    """
    try:
        config = current_app.config

        # Check for explicit MCP_SERVICE_URL first (allows override)
        mcp_service_url = config.get("MCP_SERVICE_URL")
        if mcp_service_url:
            return mcp_service_url

        # In production, MCP service is accessed via main URL with /mcp prefix
        # WEBDRIVER_BASEURL_USER_FRIENDLY is the user-facing URL for the instance
        if (
            user_friendly_url := config["WEBDRIVER_BASEURL_USER_FRIENDLY"]
        ) and not _is_local_url(user_friendly_url):
            base_url = user_friendly_url.rstrip("/")
            return f"{base_url}/mcp"

    except Exception as e:
        logger.debug("Config access failed: %s", e)

    # Development fallback - direct access to MCP service on port 5008
    return "http://localhost:5008"


def get_chart_screenshot_url(chart_id: int | str) -> str:
    """
    Generate a screenshot URL for a chart using the MCP service.

    Args:
        chart_id: Chart ID (numeric or string)

    Returns:
        Complete URL to the chart screenshot endpoint
    """
    mcp_base = get_mcp_service_url()
    return f"{mcp_base}/screenshot/chart/{chart_id}.png"


def get_explore_screenshot_url(form_data_key: str) -> str:
    """
    Generate a screenshot URL for an explore view using the MCP service.

    Args:
        form_data_key: Form data key for the explore view

    Returns:
        Complete URL to the explore screenshot endpoint
    """
    mcp_base = get_mcp_service_url()
    return f"{mcp_base}/screenshot/explore/{form_data_key}.png"
