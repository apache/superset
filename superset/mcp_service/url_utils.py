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

from flask import current_app


def get_superset_base_url() -> str:
    """
    Get the Superset base URL from configuration.

    Returns:
        Base URL for Superset web server (e.g., "http://localhost:8088")
    """
    # Default fallback to localhost:8088
    default_url = "http://localhost:8088"

    try:
        # Try to get from configuration
        config = current_app.config

        # Check for SUPERSET_WEBSERVER_ADDRESS first
        webserver_address = config.get("SUPERSET_WEBSERVER_ADDRESS")
        if webserver_address:
            return webserver_address

        # Fallback to other potential config keys
        public_role_like_gamma = config.get("PUBLIC_ROLE_LIKE_GAMMA", False)
        if public_role_like_gamma:
            # If public access is enabled, might be on a different host
            webserver_protocol = config.get("ENABLE_PROXY_FIX", False)
            protocol = "https" if webserver_protocol else "http"
            host = config.get("WEBSERVER_HOST", "localhost")
            port = config.get("WEBSERVER_PORT", 8088)
            return f"{protocol}://{host}:{port}"

        return default_url

    except Exception:
        # If we can't access Flask config (e.g., outside app context),
        # return default
        return default_url


def get_mcp_service_url() -> str:
    """
    Get the MCP service base URL where screenshot endpoints are served.

    The MCP service auto-detects its own host and port since it's running
    this code. Falls back to explicit configuration or default port.

    Returns:
        Base URL for MCP service (always independent of Superset URL)
    """
    try:
        # Try to auto-detect from Flask request context
        from flask import request

        if request:
            # Get the host and port from the current request
            scheme = request.scheme  # http or https
            host = request.host  # includes port if non-standard
            return f"{scheme}://{host}"

    except (RuntimeError, AttributeError):
        # Not in request context or Flask not available
        pass

    try:
        # Check for explicit MCP_SERVICE_URL in config
        config = current_app.config
        mcp_service_url = config.get("MCP_SERVICE_URL")
        if mcp_service_url:
            return mcp_service_url

    except Exception as e:
        # Log and fall back if config access fails
        import logging

        logging.getLogger(__name__).debug(f"Config access failed: {e}")

    # Always fallback to MCP service default port (never use Superset URL)
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
