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
from collections.abc import Awaitable, Callable, Iterator
from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest
from starlette.requests import Request
from starlette.responses import Response

# A Starlette-style ASGI endpoint, matching FastMCP's custom_route contract.
Endpoint = Callable[[Request], Awaitable[Response]]


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

    # Verify pkg_resources UserWarning filter is installed, scoped to
    # sqlalchemy_redshift (sqlalchemy-redshift triggers this via a late
    # import on Redshift-backed connections; see
    # superset/db_engine_specs/redshift.py for the full rationale). Scoping
    # by category+module keeps this from also swallowing the same
    # deprecation message from unrelated dependencies.
    pkg_resources_filters = [
        f
        for f in warnings.filters
        if f[0] == "ignore"
        and f[2] is UserWarning
        and isinstance(f[1], re.Pattern)
        and f[1].pattern == r"pkg_resources is deprecated as an API"
        and isinstance(f[3], re.Pattern)
        and f[3].pattern == r"sqlalchemy_redshift(?:\..*)?"
    ]
    assert len(pkg_resources_filters) >= 1, "Expected pkg_resources warning filter"


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


@pytest.mark.asyncio
async def test_register_health_endpoint_registers_get_health() -> None:
    """/health is registered as an HTTP GET custom route on the MCP instance."""
    from superset.mcp_service.server import _register_health_endpoint

    captured: dict[str, object] = {}

    def custom_route(path: str, methods: list[str]) -> Callable[[Endpoint], Endpoint]:
        captured["path"] = path
        captured["methods"] = methods

        def decorator(fn: Endpoint) -> Endpoint:
            captured["fn"] = fn
            return fn

        return decorator

    mcp_instance = MagicMock()
    mcp_instance.custom_route = custom_route

    _register_health_endpoint(mcp_instance)

    assert captured["path"] == "/health"
    assert captured["methods"] == ["GET"]


@pytest.mark.asyncio
async def test_health_endpoint_returns_ok() -> None:
    """The /health handler returns 200 with a JSON status body."""
    from superset.mcp_service.server import _register_health_endpoint
    from superset.utils import json

    captured: dict[str, object] = {}

    def custom_route(path: str, methods: list[str]) -> Callable[[Endpoint], Endpoint]:
        def decorator(fn: Endpoint) -> Endpoint:
            captured["fn"] = fn
            return fn

        return decorator

    mcp_instance = MagicMock()
    mcp_instance.custom_route = custom_route

    _register_health_endpoint(mcp_instance)

    handler = cast(Callable[..., Awaitable[Response]], captured["fn"])
    response = await handler(MagicMock(spec=Request))

    assert response.status_code == 200
    assert json.loads(response.body) == {"status": "ok"}


def test_create_auth_provider_uses_default_factory_for_mcp_api_key_only() -> None:
    """MCP_API_KEY_ENABLED=True should install auth even when FAB API keys are off."""
    from superset.mcp_service.server import _create_auth_provider

    flask_app = MagicMock()
    flask_app.config.get.side_effect = lambda key, default=None: {
        "MCP_AUTH_FACTORY": None,
        "MCP_AUTH_ENABLED": False,
        "MCP_API_KEY_ENABLED": True,
        "FAB_API_KEY_ENABLED": False,
    }.get(key, default)
    auth_provider = MagicMock()

    with patch(
        "superset.mcp_service.mcp_config.create_default_mcp_auth_factory",
        return_value=auth_provider,
    ) as create_default_mcp_auth_factory:
        result = _create_auth_provider(flask_app)

    assert result is auth_provider
    create_default_mcp_auth_factory.assert_called_once_with(flask_app)


def test_create_auth_provider_propagates_auth_config_error() -> None:
    """A fatal auth config error must propagate, not fall through to no auth.

    The default factory raises MCPAuthConfigError for an unusable auth
    configuration. _create_auth_provider must re-raise it so the service fails
    to start instead of silently returning None (which would run unauthenticated).
    """
    from superset.mcp_service.mcp_config import MCPAuthConfigError
    from superset.mcp_service.server import _create_auth_provider

    flask_app = MagicMock()
    flask_app.config.get.side_effect = lambda key, default=None: {
        "MCP_AUTH_FACTORY": None,
        "MCP_AUTH_ENABLED": True,
        "MCP_API_KEY_ENABLED": False,
        "FAB_API_KEY_ENABLED": False,
    }.get(key, default)

    with patch(
        "superset.mcp_service.mcp_config.create_default_mcp_auth_factory",
        side_effect=MCPAuthConfigError("MCP_JWT_AUDIENCE must be set"),
    ):
        with pytest.raises(MCPAuthConfigError):
            _create_auth_provider(flask_app)


def test_create_auth_provider_fails_closed_on_insecure_guest_secret() -> None:
    """Guest-only deployment with an insecure GUEST_TOKEN_JWT_SECRET must abort.

    When only MCP_EMBEDDED_GUEST_AUTH_ENABLED is on and the default factory
    raises MCPAuthConfigError (insecure default guest secret), _create_auth_provider
    must re-raise it — otherwise the server would boot with no authentication.
    """
    from superset.mcp_service.mcp_config import MCPAuthConfigError
    from superset.mcp_service.server import _create_auth_provider

    flask_app = MagicMock()
    flask_app.config.get.side_effect = lambda key, default=None: {
        "MCP_AUTH_FACTORY": None,
        "MCP_AUTH_ENABLED": False,
        "MCP_API_KEY_ENABLED": False,
        "FAB_API_KEY_ENABLED": False,
        "MCP_EMBEDDED_GUEST_AUTH_ENABLED": True,
    }.get(key, default)

    with patch(
        "superset.mcp_service.mcp_config.create_default_mcp_auth_factory",
        side_effect=MCPAuthConfigError(
            "GUEST_TOKEN_JWT_SECRET is the insecure default"
        ),
    ):
        with pytest.raises(MCPAuthConfigError):
            _create_auth_provider(flask_app)


@contextlib.contextmanager
def _run_server_dependencies(
    flask_config: dict[str, Any],
) -> Iterator[MagicMock]:
    """Patch every ``run_server()`` collaborator except stateless_http resolution.

    Returns the ``mcp_instance`` mock so callers can assert on the kwargs its
    ``run()`` was called with -- everything else (auth, middleware, event
    store, health endpoint) is stubbed out since this is only exercising the
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
        patch.object(server, "_register_health_endpoint"),
        patch.object(server, "create_event_store", return_value=None),
        patch.object(server, "_build_starlette_middleware", return_value=[]),
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
