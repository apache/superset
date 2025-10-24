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
"""Default MCP service configuration for Apache Superset"""

from typing import Any, Dict

# MCP Service Configuration
MCP_ADMIN_USERNAME = "admin"
MCP_DEV_USERNAME = "admin"
SUPERSET_WEBSERVER_ADDRESS = "http://localhost:9001"

# WebDriver Configuration for screenshots
WEBDRIVER_BASEURL = "http://localhost:9001/"
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

# Feature flags for MCP
MCP_FEATURE_FLAGS: Dict[str, Any] = {
    "MCP_SERVICE": True,
}

# MCP Service Host/Port
MCP_SERVICE_HOST = "localhost"
MCP_SERVICE_PORT = 5008

# MCP Debug mode - shows suppressed initialization output in stdio mode
MCP_DEBUG = False

# Session configuration for local development
MCP_SESSION_CONFIG = {
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_SECURE": False,
    "SESSION_COOKIE_SAMESITE": "Lax",
    "SESSION_COOKIE_NAME": "superset_session",
    "PERMANENT_SESSION_LIFETIME": 86400,
}

# CSRF Protection
MCP_CSRF_CONFIG = {
    "WTF_CSRF_ENABLED": True,
    "WTF_CSRF_TIME_LIMIT": None,
}

# FastMCP Factory Configuration
MCP_FACTORY_CONFIG = {
    "name": "Superset MCP Server",
    "instructions": None,  # Will use default from app.py
    "auth": None,  # No authentication by default
    "lifespan": None,  # No custom lifespan
    "tools": None,  # Auto-discover tools
    "include_tags": None,  # Include all tags
    "exclude_tags": None,  # Exclude no tags
    "config": None,  # No additional config
}


def get_mcp_config(app_config: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    Get complete MCP configuration dictionary.

    Reads from app_config first, then falls back to defaults if values are not provided.

    Args:
        app_config: Optional Flask app configuration dict to read values from
    """
    app_config = app_config or {}

    # Default MCP configuration
    defaults = {
        "MCP_ADMIN_USERNAME": MCP_ADMIN_USERNAME,
        "MCP_DEV_USERNAME": MCP_DEV_USERNAME,
        "SUPERSET_WEBSERVER_ADDRESS": SUPERSET_WEBSERVER_ADDRESS,
        "WEBDRIVER_BASEURL": WEBDRIVER_BASEURL,
        "WEBDRIVER_BASEURL_USER_FRIENDLY": WEBDRIVER_BASEURL_USER_FRIENDLY,
        "MCP_SERVICE_HOST": MCP_SERVICE_HOST,
        "MCP_SERVICE_PORT": MCP_SERVICE_PORT,
        "MCP_DEBUG": MCP_DEBUG,
        **MCP_SESSION_CONFIG,
        **MCP_CSRF_CONFIG,
    }

    # Merge app_config over defaults - app_config takes precedence
    return {**defaults, **{k: v for k, v in app_config.items() if k in defaults}}


def get_mcp_config_with_overrides(
    app_config: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Alternative approach: Allow any app_config keys, not just predefined ones.

    This version lets users add custom MCP config keys in superset_config.py
    that aren't predefined in the defaults.
    """
    app_config = app_config or {}
    defaults = get_mcp_config()

    # Start with defaults, then overlay any app_config values
    return {**defaults, **app_config}


def get_mcp_factory_config() -> Dict[str, Any]:
    """
    Get FastMCP factory configuration.

    This can be customized by users to provide their own auth providers,
    middleware, lifespan handlers, and other FastMCP configuration.

    Returns:
        Dictionary of FastMCP factory configuration options
    """
    return MCP_FACTORY_CONFIG.copy()
