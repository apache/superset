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

from superset.mcp_service.constants import (
    DEFAULT_TOKEN_LIMIT,
    DEFAULT_WARN_THRESHOLD_PCT,
)

logger = logging.getLogger(__name__)

# MCP Service Configuration
# Note: MCP_DEV_USERNAME MUST be configured in superset_config.py
# There is no default value - the service will fail if not set
SUPERSET_WEBSERVER_ADDRESS = "http://localhost:9001"

# WebDriver Configuration for screenshots
WEBDRIVER_BASEURL = "http://localhost:9001/"
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

# MCP Service Host/Port
MCP_SERVICE_HOST = "localhost"
MCP_SERVICE_PORT = 5008

# MCP Debug mode - shows suppressed initialization output in stdio mode
MCP_DEBUG = False

# MCP JWT Debug Errors - controls server-side JWT debug logging.
# When False (default), uses the default JWTVerifier with minimal logging.
# When True, uses DetailedJWTVerifier with tiered logging:
#   - WARNING level: generic failure categories only (e.g. "Issuer mismatch")
#   - DEBUG level: detailed claim values for troubleshooting
#   - Secrets (e.g. HS256 keys) are NEVER logged at any level
# HTTP responses ALWAYS return generic errors regardless of this setting,
# per RFC 6750 Section 3.1. This flag NEVER affects client-facing output.
MCP_JWT_DEBUG_ERRORS = False

# Enable parse_request decorator for MCP tools.
# When True (default), tool requests are automatically parsed from JSON strings
# to Pydantic models, working around a Claude Code double-serialization bug
# (https://github.com/anthropics/claude-code/issues/5504).
# Set to False to disable and let FastMCP handle request parsing natively.
MCP_PARSE_REQUEST_ENABLED = True

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
# (caching, auth, events, session state, etc.).
#
# When CACHE_REDIS_URL is set:
# - Response caching uses Redis (if MCP_CACHE_CONFIG enabled)
# - EventStore uses Redis for multi-pod session management
#
# For multi-pod/Kubernetes deployments, setting CACHE_REDIS_URL automatically
# enables Redis-backed EventStore to share session state across pods.
MCP_STORE_CONFIG: Dict[str, Any] = {
    "enabled": False,  # Disabled by default - caching uses in-memory store
    "CACHE_REDIS_URL": None,  # Redis URL, e.g., "redis://localhost:6379/0"
    # Wrapper class that prefixes all keys. Each consumer provides their own prefix.
    "WRAPPER_TYPE": "key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper",
    # EventStore settings (for multi-pod session management)
    "event_store_max_events": 100,  # Keep last 100 events per session
    "event_store_ttl": 3600,  # Events expire after 1 hour
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

# =============================================================================
# MCP Response Size Guard Configuration
# =============================================================================
#
# Overview:
# ---------
# The Response Size Guard prevents oversized responses from overwhelming LLM
# clients (e.g., Claude Desktop). When a tool response exceeds the token limit,
# it returns a helpful error with suggestions for reducing the response size.
#
# How it works:
# -------------
# 1. After a tool executes, the middleware estimates the response's token count
# 2. If the response exceeds the configured limit, it blocks the response
# 3. Instead, it returns an error message with smart suggestions:
#    - Reduce page_size/limit
#    - Use select_columns to exclude large fields
#    - Add filters to narrow results
#    - Tool-specific recommendations
#
# Configuration:
# --------------
# - enabled: Toggle the guard on/off (default: True)
# - token_limit: Maximum estimated tokens per response (default: 25,000)
# - excluded_tools: Tools to skip checking (e.g., streaming tools)
# - warn_threshold_pct: Log warnings above this % of limit (default: 80%)
#
# Token Estimation:
# -----------------
# Uses character-based heuristic (~3.5 chars per token for JSON).
# This is intentionally conservative to avoid underestimating.
# =============================================================================
MCP_RESPONSE_SIZE_CONFIG: Dict[str, Any] = {
    "enabled": True,  # Enabled by default to protect LLM clients
    "token_limit": DEFAULT_TOKEN_LIMIT,
    "warn_threshold_pct": DEFAULT_WARN_THRESHOLD_PCT,
    "excluded_tools": [  # Tools to skip size checking
        "health_check",  # Always small
        "get_chart_preview",  # Returns URLs, not data
        "generate_explore_link",  # Returns URLs
        "open_sql_lab_with_context",  # Returns URLs
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
        debug_errors = app.config.get("MCP_JWT_DEBUG_ERRORS", False)

        common_kwargs: dict[str, Any] = {
            "issuer": app.config.get("MCP_JWT_ISSUER"),
            "audience": app.config.get("MCP_JWT_AUDIENCE"),
            "required_scopes": app.config.get("MCP_REQUIRED_SCOPES", []),
        }

        # For HS256 (symmetric), use the secret as the public_key parameter
        if app.config.get("MCP_JWT_ALGORITHM") == "HS256" and secret:
            common_kwargs["public_key"] = secret
            common_kwargs["algorithm"] = "HS256"
        else:
            # For RS256 (asymmetric), use public key or JWKS
            common_kwargs["jwks_uri"] = jwks_uri
            common_kwargs["public_key"] = public_key
            common_kwargs["algorithm"] = app.config.get("MCP_JWT_ALGORITHM", "RS256")

        if debug_errors:
            # DetailedJWTVerifier: detailed server-side logging of JWT
            # validation failures. HTTP responses are always generic per
            # RFC 6750 Section 3.1.
            from superset.mcp_service.jwt_verifier import DetailedJWTVerifier

            auth_provider = DetailedJWTVerifier(**common_kwargs)
        else:
            # Default JWTVerifier: minimal logging, generic error responses.
            from fastmcp.server.auth.providers.jwt import JWTVerifier

            auth_provider = JWTVerifier(**common_kwargs)

        return auth_provider
    except Exception:
        # Do not log the exception — it may contain the HS256 secret
        # from common_kwargs["public_key"]
        logger.error("Failed to create MCP auth provider")
        return None


def default_user_resolver(app: Any, access_token: Any) -> Optional[str]:
    """Extract username from JWT token claims."""
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
