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
MCP response caching using FastMCP's native ResponseCachingMiddleware.
"""

import logging
from typing import Any, Dict

from superset.mcp_service.storage import get_mcp_store

logger = logging.getLogger(__name__)


def _build_caching_settings(cache_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build FastMCP caching settings from MCP_CACHE_CONFIG.

    Maps our config format to FastMCP's settings objects:
    - list_tools_ttl -> list_tools_settings
    - list_resources_ttl -> list_resources_settings
    - list_prompts_ttl -> list_prompts_settings
    - read_resource_ttl -> read_resource_settings
    - get_prompt_ttl -> get_prompt_settings
    - call_tool_ttl + excluded_tools -> call_tool_settings

    TTL values are already integers (Python evaluates '60 * 5' at config load time).

    Args:
        cache_config: MCP_CACHE_CONFIG dict

    Returns:
        Dict of settings kwargs for ResponseCachingMiddleware
    """
    settings: Dict[str, Any] = {}

    # List operations (default 5 min)
    if "list_tools_ttl" in cache_config:
        settings["list_tools_settings"] = {"ttl": cache_config["list_tools_ttl"]}
    if "list_resources_ttl" in cache_config:
        settings["list_resources_settings"] = {
            "ttl": cache_config["list_resources_ttl"]
        }
    if "list_prompts_ttl" in cache_config:
        settings["list_prompts_settings"] = {"ttl": cache_config["list_prompts_ttl"]}

    # Individual item operations (default 1 hour)
    if "read_resource_ttl" in cache_config:
        settings["read_resource_settings"] = {"ttl": cache_config["read_resource_ttl"]}
    if "get_prompt_ttl" in cache_config:
        settings["get_prompt_settings"] = {"ttl": cache_config["get_prompt_ttl"]}

    # Tool calls with exclusions
    call_tool_settings: Dict[str, Any] = {}
    if "call_tool_ttl" in cache_config:
        call_tool_settings["ttl"] = cache_config["call_tool_ttl"]
    if "excluded_tools" in cache_config:
        call_tool_settings["excluded_tools"] = cache_config["excluded_tools"]
    if call_tool_settings:
        settings["call_tool_settings"] = call_tool_settings

    return settings


def create_response_caching_middleware() -> Any | None:
    """
    Create ResponseCachingMiddleware with optional RedisStore backend.

    Uses MCP_CACHE_CONFIG for caching settings.
    When MCP_STORE_CONFIG is enabled, uses Redis store with prefix.
    Otherwise, uses FastMCP's default in-memory store (no prefix needed).

    Returns:
        ResponseCachingMiddleware instance or None if not configured/disabled
    """
    from flask import has_app_context

    from superset.mcp_service.flask_singleton import get_flask_app

    flask_app = get_flask_app()

    def _create_middleware() -> Any | None:
        cache_config = flask_app.config.get("MCP_CACHE_CONFIG", {})
        store_config = flask_app.config.get("MCP_STORE_CONFIG", {})

        if not cache_config.get("enabled", False):
            logger.debug("MCP response caching disabled")
            return None

        try:
            from fastmcp.server.middleware.caching import ResponseCachingMiddleware
        except ImportError:
            logger.warning(
                "ResponseCachingMiddleware not available. Requires FastMCP >= 2.13.0"
            )
            return None

        # Determine which store to use
        store = None
        if store_config.get("enabled", False):
            # Redis store requires a prefix
            cache_prefix = cache_config.get("CACHE_KEY_PREFIX")
            if not cache_prefix:
                logger.warning(
                    "MCP_STORE_CONFIG enabled but no CACHE_KEY_PREFIX configured - "
                    "falling back to in-memory store"
                )
            else:
                store = get_mcp_store(prefix=cache_prefix)

        # Build per-operation settings from config
        settings = _build_caching_settings(cache_config)

        # Create middleware (store=None uses FastMCP's default in-memory store)
        middleware = ResponseCachingMiddleware(
            cache_storage=store,
            **settings,
        )
        logger.info("MCP caching middleware enabled")
        return middleware

    # Use existing app context if available, otherwise push one
    if has_app_context():
        return _create_middleware()
    else:
        with flask_app.app_context():
            return _create_middleware()
