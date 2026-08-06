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

"""Tests for MCP server EventStore creation."""

import contextlib
import os
from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch


def test_create_event_store_returns_none_when_no_redis_url():
    """EventStore returns None when no Redis URL configured (single-pod mode)."""
    config = {"CACHE_REDIS_URL": None}

    from superset.mcp_service.server import create_event_store

    result = create_event_store(config)

    assert result is None


def test_create_event_store_returns_none_when_empty_config():
    """EventStore returns None when config has no CACHE_REDIS_URL."""
    config = {}

    from superset.mcp_service.server import create_event_store

    result = create_event_store(config)

    assert result is None


def test_create_event_store_creates_event_store_with_redis():
    """EventStore is created with Redis backend when URL is configured."""
    config = {
        "CACHE_REDIS_URL": "redis://localhost:6379/0",
        "event_store_max_events": 50,
        "event_store_ttl": 1800,
    }

    mock_redis_store = MagicMock()
    mock_event_store = MagicMock()

    with patch(
        "superset.mcp_service.server._create_redis_store",
        return_value=mock_redis_store,
    ) as mock_create_store:
        with patch(
            "fastmcp.server.event_store.EventStore",
            return_value=mock_event_store,
        ) as mock_event_store_class:
            from superset.mcp_service.server import create_event_store

            result = create_event_store(config)

            # Verify EventStore was created
            assert result is mock_event_store
            # Verify _create_redis_store was called with prefix wrapper
            mock_create_store.assert_called_once_with(
                config, prefix="mcp_events_", wrap=True
            )
            # Verify EventStore was initialized with correct params
            mock_event_store_class.assert_called_once_with(
                storage=mock_redis_store,
                max_events_per_stream=50,
                ttl=1800,
            )


def test_create_event_store_uses_default_config_values():
    """EventStore uses default values when not specified in config."""
    config = {
        "CACHE_REDIS_URL": "redis://localhost:6379/0",
    }

    mock_redis_store = MagicMock()
    mock_event_store = MagicMock()

    with patch(
        "superset.mcp_service.server._create_redis_store",
        return_value=mock_redis_store,
    ):
        with patch(
            "fastmcp.server.event_store.EventStore",
            return_value=mock_event_store,
        ) as mock_event_store_class:
            from superset.mcp_service.server import create_event_store

            result = create_event_store(config)

            assert result is mock_event_store
            # Verify defaults are used
            mock_event_store_class.assert_called_once_with(
                storage=mock_redis_store,
                max_events_per_stream=100,  # default
                ttl=3600,  # default
            )


def test_suppress_third_party_warnings():
    """Third-party deprecation warnings filters are installed."""
    import re
    import warnings

    from superset.mcp_service.server import _suppress_third_party_warnings

    _suppress_third_party_warnings()

    # Verify marshmallow DeprecationWarning filter is installed
    marshmallow_filters = [
        f
        for f in warnings.filters
        if f[0] == "ignore"
        and f[2] is DeprecationWarning
        and isinstance(f[3], re.Pattern)
        and f[3].pattern == r"marshmallow\..*"
    ]
    assert len(marshmallow_filters) >= 1, (
        "Expected marshmallow DeprecationWarning filter"
    )

    # Verify google FutureWarning filter is installed
    google_filters = [
        f
        for f in warnings.filters
        if f[0] == "ignore"
        and f[2] is FutureWarning
        and isinstance(f[3], re.Pattern)
        and f[3].pattern == r"google\..*"
    ]
    assert len(google_filters) >= 1, "Expected google FutureWarning filter"


def test_create_event_store_returns_none_when_redis_store_fails():
    """EventStore returns None when Redis store creation fails."""
    config = {
        "CACHE_REDIS_URL": "redis://localhost:6379/0",
    }

    with patch(
        "superset.mcp_service.server._create_redis_store",
        return_value=None,  # Simulates Redis store creation failure
    ):
        from superset.mcp_service.server import create_event_store

        result = create_event_store(config)

        assert result is None


@contextlib.contextmanager
def _run_server_dependencies(
    flask_config: dict[str, Any],
) -> Iterator[MagicMock]:
    """Patch every ``run_server()`` collaborator except stateless_http resolution.

    Returns the ``mcp_instance`` mock so callers can assert on the kwargs its
    ``run()`` was called with -- everything else (auth, middleware, tool
    search, event store) is stubbed out since this is only exercising the
    ``flask_app.config.get("MCP_STATELESS_HTTP", ...)`` wiring, not those
    other startup steps.
    """
    from superset.mcp_service import server

    flask_app = MagicMock()
    flask_app.config = flask_config
    mcp_instance = MagicMock()

    with (
        patch.object(server, "configure_logging"),
        patch.object(server, "_suppress_third_party_warnings"),
        patch(
            "superset.mcp_service.flask_singleton.get_flask_app",
            return_value=flask_app,
        ),
        patch.object(server, "_create_auth_provider", return_value=None),
        patch.object(server, "build_middleware_list", return_value=[]),
        patch.object(
            server, "create_response_size_guard_middleware", return_value=None
        ),
        patch(
            "superset.mcp_service.caching.create_response_caching_middleware",
            return_value=None,
        ),
        patch.object(server, "init_fastmcp_server", return_value=mcp_instance),
        patch.object(server, "_apply_tool_search_transform"),
        patch.object(server, "create_event_store", return_value=None),
    ):
        yield mcp_instance


def test_run_server_defaults_stateless_http_to_true_when_unset() -> None:
    """run_server() must fall back to MCP_STATELESS_HTTP's True default when the
    operator's Flask config has no override.

    This pins the production wiring added to fix mid-workflow disconnects: if
    the ``flask_app.config.get("MCP_STATELESS_HTTP", MCP_STATELESS_HTTP)`` call
    in ``run_server()`` were reverted to a hardcoded ``True``, or the default
    were flipped, this test would still pass -- so it's the ``is True`` on the
    *resolved* value, not just the module constant, that catches a broken
    resolution.
    """
    from superset.mcp_service.server import run_server

    port = 59901
    os.environ.pop(f"FASTMCP_RUNNING_{port}", None)
    try:
        with _run_server_dependencies(flask_config={}) as mcp_instance:
            run_server(host="127.0.0.1", port=port)

        mcp_instance.run.assert_called_once()
        assert mcp_instance.run.call_args.kwargs["stateless_http"] is True
    finally:
        os.environ.pop(f"FASTMCP_RUNNING_{port}", None)


def test_run_server_respects_mcp_stateless_http_false_override() -> None:
    """An operator's MCP_STATELESS_HTTP=False (the value deployments actually run,
    per the docstring in mcp_config.py) must reach ``mcp_instance.run()`` rather
    than the module's True default."""
    from superset.mcp_service.server import run_server

    port = 59902
    os.environ.pop(f"FASTMCP_RUNNING_{port}", None)
    try:
        with _run_server_dependencies(
            flask_config={"MCP_STATELESS_HTTP": False}
        ) as mcp_instance:
            run_server(host="127.0.0.1", port=port)

        mcp_instance.run.assert_called_once()
        assert mcp_instance.run.call_args.kwargs["stateless_http"] is False
    finally:
        os.environ.pop(f"FASTMCP_RUNNING_{port}", None)
