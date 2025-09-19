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

import secrets
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


def generate_secret_key() -> str:
    """Generate a secure random secret key for Superset"""
    return secrets.token_urlsafe(42)


def get_mcp_config() -> Dict[str, Any]:
    """Get complete MCP configuration dictionary"""
    config = {}

    # Add MCP-specific settings
    config.update(
        {
            "MCP_ADMIN_USERNAME": MCP_ADMIN_USERNAME,
            "MCP_DEV_USERNAME": MCP_DEV_USERNAME,
            "SUPERSET_WEBSERVER_ADDRESS": SUPERSET_WEBSERVER_ADDRESS,
            "WEBDRIVER_BASEURL": WEBDRIVER_BASEURL,
            "WEBDRIVER_BASEURL_USER_FRIENDLY": WEBDRIVER_BASEURL_USER_FRIENDLY,
            "MCP_SERVICE_HOST": MCP_SERVICE_HOST,
            "MCP_SERVICE_PORT": MCP_SERVICE_PORT,
            "MCP_DEBUG": MCP_DEBUG,
        }
    )

    # Add session and CSRF config
    config.update(MCP_SESSION_CONFIG)
    config.update(MCP_CSRF_CONFIG)

    return config
