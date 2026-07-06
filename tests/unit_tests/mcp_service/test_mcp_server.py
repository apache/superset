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

from unittest.mock import MagicMock, patch

import pytest


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
