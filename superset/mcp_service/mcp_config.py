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

import logging
import secrets
from typing import Any, Dict, Optional

from flask import Flask

logger = logging.getLogger(__name__)

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

# Authentication Configuration
MCP_AUTH_CONFIG: Dict[str, Any] = {
    "MCP_AUTH_ENABLED": True,
    "MCP_JWKS_URI": None,
    "MCP_JWT_PUBLIC_KEY": None,
    "MCP_JWT_SECRET": "dev_secret_for_mcp_tokens_change_in_production",
    "MCP_JWT_ISSUER": "superset-mcp-dev",
    "MCP_JWT_AUDIENCE": "superset-mcp-api",
    "MCP_JWT_ALGORITHM": "HS256",
    "MCP_REQUIRED_SCOPES": [],
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


def create_default_mcp_auth_factory(app: Flask) -> Optional[Any]:
    """Default MCP auth factory using app.config values."""
    if not app.config.get("MCP_AUTH_ENABLED", False):
        return None

    jwks_uri = app.config.get("MCP_JWKS_URI")
    public_key = app.config.get("MCP_JWT_PUBLIC_KEY")
    secret = app.config.get("MCP_JWT_SECRET")

    if not (jwks_uri or public_key or secret):
        logger.warning("MCP_AUTH_ENABLED is True but no JWT keys/secret configured")
        return None

    try:
        from fastmcp.server.auth.providers.bearer import BearerAuthProvider

        # For HS256 (symmetric), use the secret as the public_key parameter
        if app.config.get("MCP_JWT_ALGORITHM") == "HS256" and secret:
            auth_provider = BearerAuthProvider(
                public_key=secret,  # HS256 uses secret as key
                issuer=app.config.get("MCP_JWT_ISSUER"),
                audience=app.config.get("MCP_JWT_AUDIENCE"),
                algorithm="HS256",
                required_scopes=app.config.get("MCP_REQUIRED_SCOPES", []),
            )
            logger.info("Created BearerAuthProvider with HS256 secret")
        else:
            # For RS256 (asymmetric), use public key or JWKS
            auth_provider = BearerAuthProvider(
                jwks_uri=jwks_uri,
                public_key=public_key,
                issuer=app.config.get("MCP_JWT_ISSUER"),
                audience=app.config.get("MCP_JWT_AUDIENCE"),
                algorithm=app.config.get("MCP_JWT_ALGORITHM", "RS256"),
                required_scopes=app.config.get("MCP_REQUIRED_SCOPES", []),
            )
            logger.info(
                "Created BearerAuthProvider with jwks_uri=%s, public_key=%s",
                jwks_uri,
                "***" if public_key else None,
            )

        return auth_provider
    except Exception as e:
        logger.error("Failed to create MCP auth provider: %s", e)
        return None


def default_user_resolver(access_token: Any) -> Optional[str]:
    """Extract username from JWT token claims."""
    logger.info(
        "Resolving user from token: type=%s, token=%s",
        type(access_token),
        access_token,
    )
    if hasattr(access_token, "subject"):
        return access_token.subject
    if hasattr(access_token, "client_id"):
        return access_token.client_id
    if hasattr(access_token, "payload") and isinstance(access_token.payload, dict):
        return (
            access_token.payload.get("sub")
            or access_token.payload.get("email")
            or access_token.payload.get("username")
        )
    return None


def generate_secret_key() -> str:
    """Generate a secure random secret key for Superset"""
    return secrets.token_urlsafe(42)


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
        "MCP_AUTH_FACTORY": create_default_mcp_auth_factory,
        "MCP_USER_RESOLVER": default_user_resolver,
        **MCP_SESSION_CONFIG,
        **MCP_CSRF_CONFIG,
        **MCP_AUTH_CONFIG,
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


# Example MCP Authentication Configuration for superset_config.py
# Add these settings to your superset_config.py to enable MCP authentication.

# Example 1: Simple Configuration (Recommended)
# MCP_AUTH_ENABLED = True
# MCP_ADMIN_USERNAME = "your_admin_username"  # Must exist in Superset users

# Example 2: JWT-based Authentication
# def custom_user_resolver(access_token):
#     """Extract username from JWT token."""
#     return access_token.get("username") or access_token.get("sub")
#
# MCP_AUTH_ENABLED = True
# MCP_USER_RESOLVER = custom_user_resolver
# MCP_JWT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
# YOUR_RSA_PUBLIC_KEY_HERE
# -----END PUBLIC KEY-----"""
# MCP_JWT_ISSUER = "your-auth-provider"
# MCP_JWT_AUDIENCE = "superset-mcp"

# Example 3: JWKS URI Configuration
# MCP_AUTH_ENABLED = True
# MCP_JWKS_URI = "https://your-auth-provider.com/.well-known/jwks.json"
# MCP_JWT_ISSUER = "your-auth-provider"
# MCP_JWT_AUDIENCE = "superset-mcp"
