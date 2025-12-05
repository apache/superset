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
from typing import Any

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
MCP_FEATURE_FLAGS: dict[str, Any] = {
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

# Response Caching Configuration (FastMCP 2.13+)
# Enables TTL-based caching for tool/resource/prompt responses
# See: https://github.com/jlowin/fastmcp/releases/tag/v2.13.0
#
# IMPORTANT: Caching is DISABLED by default for the following reasons:
# 1. MCP tools typically perform small OLTP queries that are fast enough
# 2. In-memory caching doesn't work well with multi-process deployments
# 3. Cache invalidation adds complexity without clear benefits
#
# To enable caching, you MUST:
# 1. Set "enabled": True
# 2. Configure Redis backend using Superset's existing Redis infrastructure
#    (uses REDIS_HOST, REDIS_PORT from Superset config)
#
# Example in superset_config.py:
#   MCP_CACHE_CONFIG = {
#       "enabled": True,
#       "use_redis": True,  # Uses Superset's Redis config
#   }
#
# WARNING: There is no event-based cache invalidation. Cached data
# will remain stale until TTL expiration. This may cause issues if
# dashboards/charts are frequently updated.
MCP_CACHE_CONFIG: dict[str, Any] = {
    # Caching disabled by default - most MCP queries are fast OLTP operations
    "enabled": False,
    # Use Redis for caching (requires Superset's Redis to be configured)
    # When True, uses REDIS_HOST/REDIS_PORT from Superset config
    # When False and enabled=True, falls back to in-memory (not recommended)
    "use_redis": True,
    # Redis database number for MCP cache (default: same as Superset's cache DB)
    "redis_db": None,  # Uses Superset's REDIS_RESULTS_DB if not set
    # Key prefix for MCP cache entries
    "redis_key_prefix": "mcp_cache:",
    # Maximum size of cached items (1MB default)
    "max_item_size": 1024 * 1024,
    # List operations caching (5 minutes default)
    "list_tools_ttl": 300,
    "list_resources_ttl": 300,
    "list_prompts_ttl": 300,
    # Individual item caching (1 hour default)
    "read_resource_ttl": 3600,
    "get_prompt_ttl": 3600,
    "call_tool_ttl": 3600,
    # Tool-specific caching control
    # Cache all tools except these expensive/mutable operations
    "excluded_tools": [
        # Skip caching for tools that execute SQL or modify data
        "execute_sql",
        "generate_dashboard",
        "generate_chart",
        "update_chart",
        "update_chart_preview",
        "add_chart_to_existing_dashboard",
    ],
    # Only cache these tools (if specified, overrides excluded_tools)
    "included_tools": None,
}


def create_default_mcp_auth_factory(app: Flask) -> Any | None:
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


def default_user_resolver(app: Any, access_token: Any) -> str | None:
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


def get_mcp_config(app_config: dict[str, Any] | None = None) -> dict[str, Any]:
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
    app_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Alternative approach: Allow any app_config keys, not just predefined ones.

    This version lets users add custom MCP config keys in superset_config.py
    that aren't predefined in the defaults.
    """
    app_config = app_config or {}
    defaults = get_mcp_config()

    # Start with defaults, then overlay any app_config values
    return {**defaults, **app_config}


def _create_redis_cache_storage(
    app_config: dict[str, Any], cache_config: dict[str, Any]
) -> Any | None:
    """Create Redis-based cache storage using Superset's Redis config.

    Args:
        app_config: Flask app configuration dict
        cache_config: MCP cache configuration dict

    Returns:
        RedisStore instance or None if Redis is not configured/available
    """
    try:
        from key_value.aio.stores.redis import RedisStore
    except ImportError:
        logger.warning(
            "key_value package not available for Redis caching. "
            "Install with: pip install key-value[redis]"
        )
        return None

    # Get Redis config from Superset's standard config keys
    redis_host = app_config.get("REDIS_HOST", "localhost")
    redis_port = int(app_config.get("REDIS_PORT", 6379))
    redis_db = cache_config.get("redis_db") or app_config.get("REDIS_RESULTS_DB", 1)

    try:
        cache_storage = RedisStore(
            host=redis_host,
            port=redis_port,
            db=int(redis_db),
        )
        logger.info(
            "Created Redis cache storage: host=%s, port=%s, db=%s",
            redis_host,
            redis_port,
            redis_db,
        )
        return cache_storage
    except Exception as e:
        logger.warning("Failed to create Redis cache storage: %s", e)
        return None


def create_response_caching_middleware(
    app_config: dict[str, Any] | None = None,
) -> Any | None:
    """Create ResponseCachingMiddleware with configuration from app.config.

    Caching is DISABLED by default. To enable:
    1. Set MCP_CACHE_CONFIG["enabled"] = True in superset_config.py
    2. Ensure Redis is configured (REDIS_HOST, REDIS_PORT)

    The middleware will use Redis for distributed caching across
    multiple Superset processes/servers. In-memory caching is not
    recommended for production deployments.

    Args:
        app_config: Optional Flask app configuration dict

    Returns:
        ResponseCachingMiddleware instance or None if caching is disabled
    """
    app_config = app_config or {}

    # Get cache config from app.config or use defaults
    cache_config = {**MCP_CACHE_CONFIG, **app_config.get("MCP_CACHE_CONFIG", {})}

    # Default is disabled - must explicitly enable
    if not cache_config.get("enabled", False):
        logger.debug("MCP response caching disabled (default)")
        return None

    try:
        from fastmcp.server.middleware.caching import ResponseCachingMiddleware

        # Determine cache storage backend
        cache_storage = cache_config.get("cache_storage")
        if cache_storage is None and cache_config.get("use_redis", True):
            cache_storage = _create_redis_cache_storage(app_config, cache_config)
            if cache_storage is None:
                logger.warning(
                    "Redis cache storage not available. "
                    "MCP caching requires Redis for multi-process deployments. "
                    "Disabling caching."
                )
                return None

        if cache_storage is None:
            # In-memory fallback - warn about limitations
            logger.warning(
                "Using in-memory cache for MCP responses. "
                "This is NOT recommended for production with multiple processes. "
                "Configure Redis via REDIS_HOST/REDIS_PORT for distributed caching."
            )

        # Build settings dictionaries for each operation type
        list_tools_settings = {
            "ttl": cache_config.get("list_tools_ttl", 300),
            "enabled": True,
        }
        list_resources_settings = {
            "ttl": cache_config.get("list_resources_ttl", 300),
            "enabled": True,
        }
        list_prompts_settings = {
            "ttl": cache_config.get("list_prompts_ttl", 300),
            "enabled": True,
        }
        read_resource_settings = {
            "ttl": cache_config.get("read_resource_ttl", 3600),
            "enabled": True,
        }
        get_prompt_settings = {
            "ttl": cache_config.get("get_prompt_ttl", 3600),
            "enabled": True,
        }

        # Tool caching with include/exclude lists
        call_tool_settings: dict[str, Any] = {
            "ttl": cache_config.get("call_tool_ttl", 3600),
            "enabled": True,
        }
        if cache_config.get("included_tools"):
            call_tool_settings["included_tools"] = cache_config["included_tools"]
        if cache_config.get("excluded_tools"):
            call_tool_settings["excluded_tools"] = cache_config["excluded_tools"]

        middleware = ResponseCachingMiddleware(
            cache_storage=cache_storage,
            list_tools_settings=list_tools_settings,
            list_resources_settings=list_resources_settings,
            list_prompts_settings=list_prompts_settings,
            read_resource_settings=read_resource_settings,
            get_prompt_settings=get_prompt_settings,
            call_tool_settings=call_tool_settings,
            max_item_size=cache_config.get("max_item_size", 1024 * 1024),
        )

        storage_type = "Redis" if cache_storage else "in-memory"
        logger.info(
            "Created ResponseCachingMiddleware (%s) with TTLs: "
            "list=%ds, read=%ds, call=%ds",
            storage_type,
            cache_config.get("list_tools_ttl", 300),
            cache_config.get("read_resource_ttl", 3600),
            cache_config.get("call_tool_ttl", 3600),
        )

        if cache_config.get("excluded_tools"):
            logger.info(
                "Excluded tools from caching: %s",
                cache_config["excluded_tools"],
            )

        return middleware

    except ImportError:
        logger.warning(
            "ResponseCachingMiddleware not available - requires fastmcp 2.13+"
        )
        return None
    except Exception as e:
        logger.exception("Failed to create response caching middleware: %s", e)
        return None


def get_mcp_factory_config() -> dict[str, Any]:
    """
    Get FastMCP factory configuration.

    This can be customized by users to provide their own auth providers,
    middleware, lifespan handlers, and other FastMCP configuration.

    Returns:
        Dictionary of FastMCP factory configuration options
    """
    return MCP_FACTORY_CONFIG.copy()
