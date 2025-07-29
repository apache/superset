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

    The screenshot service is served by the MCP service as a WSGI endpoint
    on the same port as Superset (not on a separate port).

    Returns:
        Base URL for MCP service (same as Superset base URL)
    """
    # Screenshot service is served by MCP service as WSGI endpoint
    # on the same port as Superset
    return get_superset_base_url()
