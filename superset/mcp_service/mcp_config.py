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
"""Default MCP service configuration"""

import logging
import secrets
from typing import Any, Dict, Optional

from flask import Flask

logger = logging.getLogger(__name__)

# MCP Service Configuration
# Note: MCP_DEV_USERNAME MUST be configured in superset_config.py
# There is no default value - the service will fail if not set
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
    "name": None,  # Will derive from APP_NAME in app.py
    "branding": None,  # Will derive from APP_NAME in app.py
    "instructions": None,  # Will use default from app.py (parameterized with branding)
    "auth": None,  # No authentication by default
    "lifespan": None,  # No custom lifespan
    "tools": None,  # Auto-discover tools
    "include_tags": None,  # Include all tags
    "exclude_tags": None,  # Exclude no tags
    "config": None,  # No additional config
}

# =============================================================================
# MCP Storage and Caching Configuration
# =============================================================================
#
# Overview:
# ---------
# MCP caching uses FastMCP's ResponseCachingMiddleware to cache tool responses.
# By default, caching is DISABLED. When enabled, it can use either:
#   1. In-memory store (default) - no additional configuration needed
#   2. Redis store - requires MCP_STORE_CONFIG to be enabled
#
# Configuration Flow:
# -------------------
# - MCP_CACHE_CONFIG controls whether caching is enabled and its TTL settings
# - MCP_STORE_CONFIG controls the Redis store (optional)
#
# Scenarios:
# ----------
# 1. Caching disabled (default):
#    MCP_CACHE_CONFIG["enabled"] = False
#    → No caching, MCP_STORE_CONFIG is ignored
#
# 2. Caching with in-memory store:
#    MCP_CACHE_CONFIG["enabled"] = True
#    MCP_STORE_CONFIG["enabled"] = False (or not configured)
#    → Caching uses FastMCP's default in-memory store, no Prefix wrapper used
#
# 3. Caching with Redis store:
#    MCP_CACHE_CONFIG["enabled"] = True
#    MCP_STORE_CONFIG["enabled"] = True
#    MCP_STORE_CONFIG["CACHE_REDIS_URL"] = "redis://..."
#    → Caching uses Redis with PrefixKeysWrapper
#
# Redis Store Details:
# --------------------
# When MCP_STORE_CONFIG is enabled, it creates a RedisStore wrapped with
# PrefixKeysWrapper (configurable via WRAPPER_TYPE). The wrapper prepends a
# prefix to all keys, allowing multiple features to share the same Redis
# instance with isolated key namespaces. The prefix comes from the consumer
# (e.g., MCP_CACHE_CONFIG["CACHE_KEY_PREFIX"] for caching).
#
# Advanced Usage:
# ---------------
# The store factory (get_mcp_store) can be used independently for custom
# purposes like auth token storage or event logging. Import and call:
#
#   from superset.mcp_service.storage import get_mcp_store
#   my_store = get_mcp_store(prefix="my_feature_v1_")
#
# Currently, the store is only used by the caching layer when enabled.
# =============================================================================

# MCP Store Configuration - shared Redis infrastructure for all MCP storage needs
# (caching, auth, events, etc.). Only used when a consumer explicitly requests it.
MCP_STORE_CONFIG: Dict[str, Any] = {
    "enabled": False,  # Disabled by default - caching uses in-memory store
    "CACHE_REDIS_URL": None,  # Redis URL, e.g., "redis://localhost:6379/0"
    # Wrapper class that prefixes all keys. Each consumer provides their own prefix.
    "WRAPPER_TYPE": "key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper",
}

# MCP Response Caching Configuration - controls caching behavior and TTLs
# When enabled without MCP_STORE_CONFIG, uses in-memory store.
# When enabled with MCP_STORE_CONFIG, uses Redis store.
MCP_CACHE_CONFIG: Dict[str, Any] = {
    "enabled": False,  # Disabled by default
    "CACHE_KEY_PREFIX": None,  # Only needed when using the store
    "list_tools_ttl": 60 * 5,  # 5 minutes
    "list_resources_ttl": 60 * 5,  # 5 minutes
    "list_prompts_ttl": 60 * 5,  # 5 minutes
    "read_resource_ttl": 60 * 60,  # 1 hour
    "get_prompt_ttl": 60 * 60,  # 1 hour
    "call_tool_ttl": 60 * 60,  # 1 hour
    "max_item_size": 1024 * 1024,  # 1MB
    "excluded_tools": [  # Tools that should never be cached (side effects, dynamic)
        "execute_sql",
        "generate_dashboard",
        "generate_chart",
        "update_chart",
    ],
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


def default_user_resolver(app: Any, access_token: Any) -> Optional[str]:
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
    """Generate a secure random secret key."""
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
