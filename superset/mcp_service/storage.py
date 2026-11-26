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
import ssl
from importlib import import_module
from typing import Any, Callable, Dict
from urllib.parse import urlparse

from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# Bounded defaults so an unreachable or stalled Redis fails the request
# instead of hanging it indefinitely.
DEFAULT_REDIS_SOCKET_TIMEOUT = 5.0
DEFAULT_REDIS_SOCKET_CONNECT_TIMEOUT = 5.0

_VALID_SSL_CERT_REQS = frozenset({"required", "optional", "none"})


def _ssl_kwargs(store_config: Dict[str, Any]) -> dict[str, Any]:
    """
    Build the TLS keyword arguments for a rediss:// connection.

    The server certificate and hostname are verified by default. Operators
    whose Redis presents a certificate from a private CA should point
    CACHE_REDIS_SSL_CA_CERTS at that CA bundle; disabling verification with
    CACHE_REDIS_SSL_CERT_REQS = "none" is an explicit opt-out.

    Raises:
        ValueError: If CACHE_REDIS_SSL_CERT_REQS is not a known value.
    """
    cert_reqs = store_config.get("CACHE_REDIS_SSL_CERT_REQS")
    if cert_reqs is None:
        cert_reqs = "required"
    elif isinstance(cert_reqs, int):
        cert_reqs_names: dict[int, str] = {
            ssl.CERT_NONE: "none",
            ssl.CERT_OPTIONAL: "optional",
            ssl.CERT_REQUIRED: "required",
        }
        cert_reqs = cert_reqs_names.get(cert_reqs, cert_reqs)
    if cert_reqs not in _VALID_SSL_CERT_REQS:
        raise ValueError(
            "Invalid MCP_STORE_CONFIG CACHE_REDIS_SSL_CERT_REQS "
            f"{cert_reqs!r}; expected one of {sorted(_VALID_SSL_CERT_REQS)}"
        )
    if cert_reqs == "none":
        logger.warning(
            "MCP Redis TLS certificate verification is disabled "
            "(CACHE_REDIS_SSL_CERT_REQS='none')"
        )
    return {
        "ssl": True,
        "ssl_cert_reqs": cert_reqs,
        "ssl_ca_certs": store_config.get("CACHE_REDIS_SSL_CA_CERTS"),
    }


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
    prefix: str | Callable[[], str] | None = None,
    wrap: bool = True,
) -> Any | None:
    """
    Create a RedisStore, optionally wrapped with a prefix.

    Handles SSL/TLS connections (rediss:// scheme) for cloud deployments,
    verifying the server certificate unless explicitly disabled.

    Args:
        store_config: MCP_STORE_CONFIG dict (Redis URL, wrapper type)
        prefix: Feature-specific prefix (required if wrap=True)
        wrap: If True, wrap store with prefix. If False, return raw RedisStore.

    Returns:
        RedisStore instance (wrapped or raw) or None if not configured
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
        # Parse URL to handle SSL properly
        parsed = urlparse(redis_url)
        use_ssl = parsed.scheme == "rediss"

        # RedisStore doesn't handle SSL from URL - it parses URL manually
        # and ignores the scheme. We must create the Redis client ourselves.

        db = 0
        if parsed.path and parsed.path != "/":
            try:
                db = int(parsed.path.strip("/"))
            except ValueError:
                db = 0

        redis_kwargs: dict[str, Any] = {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 6379,
            "db": db,
            "username": parsed.username,  # Support Redis 6+ ACLs
            "password": parsed.password,
            "decode_responses": True,
            "socket_timeout": store_config.get(
                "CACHE_REDIS_SOCKET_TIMEOUT", DEFAULT_REDIS_SOCKET_TIMEOUT
            ),
            "socket_connect_timeout": store_config.get(
                "CACHE_REDIS_SOCKET_CONNECT_TIMEOUT",
                DEFAULT_REDIS_SOCKET_CONNECT_TIMEOUT,
            ),
            # Pin RESP2 (redis-py<8 behavior) so a library bump doesn't
            # silently require RESP3 server support.
            "protocol": 2,
        }
        if use_ssl:
            redis_kwargs.update(_ssl_kwargs(store_config))

        # redis-py 8 dropped the generic type parameter from the async
        # client (it now uses distinct sync/async overloads internally).
        redis_client: Redis = Redis(**redis_kwargs)
        logger.info(
            "Created async Redis client%s",
            " with SSL" if use_ssl else "",
        )

        # Pass pre-configured client to RedisStore
        redis_store = RedisStore(client=redis_client)

        # Return raw store if wrapping not requested
        if not wrap:
            return redis_store

        # Wrap with prefix
        if prefix is None:
            logger.error("prefix is required when wrap=True")
            return None

        wrapper_type = store_config.get("WRAPPER_TYPE")
        if not wrapper_type:
            logger.error("MCP store WRAPPER_TYPE not configured")
            return None

        wrapper_class = _import_wrapper_class(wrapper_type)
        store = wrapper_class(key_value=redis_store, prefix=prefix)
        logger.info("Created wrapped MCP RedisStore")
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
