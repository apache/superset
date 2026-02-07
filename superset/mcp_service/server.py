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
MCP server for Apache Superset

Supports both single-pod (in-memory) and multi-pod (Redis) deployments.
For multi-pod deployments, configure MCP_EVENT_STORE_CONFIG with Redis URL.
"""

import logging
import os
from typing import Any

import uvicorn

from superset.mcp_service.app import create_mcp_app, init_fastmcp_server
from superset.mcp_service.mcp_config import get_mcp_factory_config, MCP_STORE_CONFIG
from superset.mcp_service.middleware import create_response_size_guard_middleware
from superset.mcp_service.storage import _create_redis_store


def configure_logging(debug: bool = False) -> None:
    """Configure logging for the MCP service."""
    import sys

    if debug or os.environ.get("SQLALCHEMY_DEBUG"):
        # Only configure basic logging if no handlers exist (respects logging.ini)
        root_logger = logging.getLogger()
        if not root_logger.handlers:
            logging.basicConfig(
                level=logging.INFO,
                format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                stream=sys.stderr,  # Always log to stderr, not stdout
            )

        # Only override SQLAlchemy logger levels if they're not explicitly configured
        for logger_name in [
            "sqlalchemy.engine",
            "sqlalchemy.pool",
            "sqlalchemy.dialects",
        ]:
            logger = logging.getLogger(logger_name)
            # Only set level if it's still at default (WARNING for SQLAlchemy)
            if logger.level == logging.WARNING or logger.level == logging.NOTSET:
                logger.setLevel(logging.INFO)

        # Use logging instead of print to avoid stdout contamination
        logging.info("🔍 SQL Debug logging enabled")


def create_event_store(config: dict[str, Any] | None = None) -> Any | None:
    """
    Create an EventStore for MCP session management.

    For multi-pod deployments, uses Redis-backed storage to share session state
    across pods. For single-pod deployments, returns None (uses in-memory).

    Args:
        config: Optional config dict. If None, reads from MCP_STORE_CONFIG.

    Returns:
        EventStore instance if Redis URL is configured, None otherwise.
    """
    if config is None:
        config = MCP_STORE_CONFIG

    redis_url = config.get("CACHE_REDIS_URL")
    if not redis_url:
        logging.info("EventStore: Using in-memory storage (single-pod mode)")
        return None

    try:
        from fastmcp.server.event_store import EventStore

        # Get prefix from config (allows Preset to customize for multi-tenancy)
        # Default prefix prevents key collisions in shared Redis environments
        prefix = config.get("event_store_prefix", "mcp_events_")

        # Create wrapped Redis store with prefix for key namespacing
        redis_store = _create_redis_store(config, prefix=prefix, wrap=True)
        if redis_store is None:
            logging.warning("Failed to create Redis store, falling back to in-memory")
            return None

        # Create EventStore with Redis backend
        event_store = EventStore(
            storage=redis_store,
            max_events_per_stream=config.get("event_store_max_events", 100),
            ttl=config.get("event_store_ttl", 3600),
        )

        logging.info("EventStore: Using Redis storage (multi-pod mode)")
        return event_store

    except ImportError as e:
        logging.error(
            "Failed to import EventStore dependencies: %s. "
            "Ensure fastmcp package is installed.",
            e,
        )
        return None
    except Exception as e:
        logging.error("Failed to create Redis EventStore: %s", e)
        return None


def run_server(
    host: str = "127.0.0.1",
    port: int = 5008,
    debug: bool = False,
    use_factory_config: bool = False,
    event_store_config: dict[str, Any] | None = None,
) -> None:
    """
    Run the MCP service server with FastMCP endpoints.
    Uses streamable-http transport for HTTP server mode.

    For multi-pod deployments, configure MCP_EVENT_STORE_CONFIG with Redis URL
    to share session state across pods.

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug logging
        use_factory_config: Use configuration from get_mcp_factory_config()
        event_store_config: Optional EventStore configuration dict.
            If None, reads from MCP_EVENT_STORE_CONFIG.
    """

    configure_logging(debug)

    # DO NOT IMPORT TOOLS HERE!! IMPORT THEM IN app.py!!!!!

    if use_factory_config:
        # Use factory configuration for customization
        logging.info("Creating MCP app from factory configuration...")
        factory_config = get_mcp_factory_config()
        mcp_instance = create_mcp_app(**factory_config)
    else:
        # Use default initialization with auth from Flask config
        logging.info("Creating MCP app with default configuration...")
        from superset.mcp_service.caching import create_response_caching_middleware
        from superset.mcp_service.flask_singleton import get_flask_app

        flask_app = get_flask_app()

        # Get auth factory from config and create auth provider
        auth_provider = None
        auth_factory = flask_app.config.get("MCP_AUTH_FACTORY")
        if auth_factory:
            try:
                auth_provider = auth_factory(flask_app)
                logging.info(
                    "Auth provider created: %s",
                    type(auth_provider).__name__ if auth_provider else "None",
                )
            except Exception as e:
                logging.error("Failed to create auth provider: %s", e)

        # Build middleware list
        middleware_list = []

        # Add response size guard (protects LLM clients from huge responses)
        if size_guard_middleware := create_response_size_guard_middleware():
            middleware_list.append(size_guard_middleware)

        # Add caching middleware
        caching_middleware = create_response_caching_middleware()
        if caching_middleware:
            middleware_list.append(caching_middleware)

        mcp_instance = init_fastmcp_server(
            auth=auth_provider,
            middleware=middleware_list or None,
        )

    # Create EventStore for session management (Redis for multi-pod, None for in-memory)
    event_store = create_event_store(event_store_config)

    env_key = f"FASTMCP_RUNNING_{port}"
    if not os.environ.get(env_key):
        os.environ[env_key] = "1"
        try:
            logging.info("Starting FastMCP on %s:%s", host, port)

            if event_store is not None:
                # Multi-pod: Use http_app with Redis EventStore, run with uvicorn
                logging.info("Running in multi-pod mode with Redis EventStore")
                app = mcp_instance.http_app(
                    transport="streamable-http",
                    event_store=event_store,
                    stateless_http=True,
                )
                uvicorn.run(app, host=host, port=port)
            else:
                # Single-pod mode: Use built-in run() with in-memory sessions
                logging.info("Running in single-pod mode with in-memory sessions")
                mcp_instance.run(
                    transport="streamable-http",
                    host=host,
                    port=port,
                    stateless_http=True,
                )
        except Exception as e:
            logging.error("FastMCP failed: %s", e)
            os.environ.pop(env_key, None)
    else:
        logging.info("FastMCP already running on %s:%s", host, port)


if __name__ == "__main__":
    run_server()
