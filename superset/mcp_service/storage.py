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
MCP Redis storage factory.

Provides get_mcp_store(prefix) factory for creating stores with feature-specific
prefixes. Uses shared MCP_STORE_CONFIG for Redis URL and wrapper type.

Reusable across caching middleware, OAuth providers, EventStore, etc.
"""

import logging
from importlib import import_module
from typing import Any, Callable, Dict

logger = logging.getLogger(__name__)


def get_mcp_store(
    prefix: str | Callable[[], str],
) -> Any | None:
    """
    Create a store instance with the specified prefix.

    Uses shared MCP_STORE_CONFIG for Redis URL and wrapper type.
    Each caller provides their own prefix (cache, auth, events, etc.).

    Args:
        prefix: Feature-specific prefix (string or callable for multi-tenancy)

    Returns:
        Wrapped RedisStore instance or None if not configured/disabled

    Examples:
        # Caching
        cache_store = get_mcp_store(prefix=cache_prefix_lambda)

        # Auth (future)
        auth_store = get_mcp_store(prefix="mcp_auth_v1_")

        # EventStore (future)
        event_store = get_mcp_store(prefix=event_prefix_lambda)
    """
    from flask import has_app_context

    from superset.mcp_service.flask_singleton import get_flask_app

    flask_app = get_flask_app()

    def _get_store() -> Any | None:
        store_config = flask_app.config.get("MCP_STORE_CONFIG", {})

        # Check if store is enabled
        if not store_config.get("enabled", False):
            logger.debug("MCP store disabled via config")
            return None

        return _create_redis_store(store_config, prefix)

    # Use existing app context if available, otherwise push one
    if has_app_context():
        return _get_store()
    else:
        with flask_app.app_context():
            return _get_store()


def _create_redis_store(
    store_config: Dict[str, Any],
    prefix: str | Callable[[], str],
) -> Any | None:
    """
    Create a RedisStore with the given prefix.

    Args:
        store_config: MCP_STORE_CONFIG dict (Redis URL, wrapper type)
        prefix: Feature-specific prefix

    Returns:
        Wrapped RedisStore instance or None if not configured
    """
    redis_url = store_config.get("CACHE_REDIS_URL")
    if not redis_url:
        logger.debug("MCP storage disabled - no CACHE_REDIS_URL configured")
        return None

    try:
        from key_value.aio.stores.redis import RedisStore
    except ImportError:
        logger.warning(
            "key_value package not available for Redis storage. "
            "Install with: pip install py-key-value-aio[redis]"
        )
        return None

    try:
        wrapper_type = store_config.get("WRAPPER_TYPE")
        if not wrapper_type:
            logger.error("MCP store WRAPPER_TYPE not configured")
            return None

        wrapper_class = _import_wrapper_class(wrapper_type)
        redis_store = RedisStore(url=redis_url)
        store = wrapper_class(key_value=redis_store, prefix=prefix)
        logger.info("✅ MCP RedisStore created")
        return store
    except Exception as e:
        logger.error("Failed to create MCP store: %s", e)
        return None


def _import_wrapper_class(class_path: str) -> type:
    """
    Import a wrapper class from a dotted path.

    Args:
        class_path: Dotted path like
            'key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper'

    Returns:
        The imported class

    Raises:
        ImportError: If the class cannot be imported
    """
    module_path, class_name = class_path.rsplit(".", 1)
    module = import_module(module_path)
    return getattr(module, class_name)
