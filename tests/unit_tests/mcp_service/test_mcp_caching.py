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

"""Tests for MCP response caching middleware."""

from unittest.mock import MagicMock, patch

from superset.mcp_service.caching import _build_caching_settings


def test_build_caching_settings_empty_config():
    """Empty config returns empty settings."""
    result = _build_caching_settings({})
    assert result == {}


def test_build_caching_settings_list_ttls():
    """List operation TTLs are mapped to settings."""
    config = {
        "list_tools_ttl": 300,
        "list_resources_ttl": 300,
        "list_prompts_ttl": 300,
    }
    result = _build_caching_settings(config)

    assert result["list_tools_settings"] == {"ttl": 300}
    assert result["list_resources_settings"] == {"ttl": 300}
    assert result["list_prompts_settings"] == {"ttl": 300}


def test_build_caching_settings_item_ttls():
    """Individual item TTLs are mapped to settings."""
    config = {
        "read_resource_ttl": 3600,
        "get_prompt_ttl": 3600,
    }
    result = _build_caching_settings(config)

    assert result["read_resource_settings"] == {"ttl": 3600}
    assert result["get_prompt_settings"] == {"ttl": 3600}


def test_build_caching_settings_call_tool_with_exclusions():
    """Call tool settings include TTL and exclusions."""
    config = {
        "call_tool_ttl": 3600,
        "excluded_tools": ["execute_sql", "generate_chart"],
    }
    result = _build_caching_settings(config)

    assert result["call_tool_settings"] == {
        "ttl": 3600,
        "excluded_tools": ["execute_sql", "generate_chart"],
    }


def test_create_response_caching_middleware_returns_none_when_disabled():
    """Caching middleware returns None when disabled in config."""
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = {"enabled": False}

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=mock_flask_app,
    ):
        with patch("flask.has_app_context", return_value=True):
            from superset.mcp_service.caching import create_response_caching_middleware

            result = create_response_caching_middleware()

            assert result is None


def test_create_response_caching_middleware_falls_back_to_memory_when_no_prefix():
    """Caching middleware uses in-memory store when CACHE_KEY_PREFIX is not set."""
    mock_flask_app = MagicMock()
    mock_configs = {
        "MCP_CACHE_CONFIG": {"enabled": True, "list_tools_ttl": 300},
        "MCP_STORE_CONFIG": {"enabled": True},  # Store enabled but no CACHE_KEY_PREFIX
    }
    mock_flask_app.config.get.side_effect = lambda key, default=None: mock_configs.get(
        key, default
    )

    mock_middleware = MagicMock()

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=mock_flask_app,
    ):
        with patch("flask.has_app_context", return_value=True):
            with patch(
                "fastmcp.server.middleware.caching.ResponseCachingMiddleware",
                return_value=mock_middleware,
            ) as mock_middleware_class:
                from superset.mcp_service.caching import (
                    create_response_caching_middleware,
                )

                result = create_response_caching_middleware()

                # Middleware should be created with cache_storage=None (in-memory)
                assert result is mock_middleware
                mock_middleware_class.assert_called_once()
                call_kwargs = mock_middleware_class.call_args[1]
                assert call_kwargs["cache_storage"] is None


def test_create_response_caching_middleware_uses_memory_store_when_store_disabled():
    """Caching middleware uses in-memory store when MCP_STORE_CONFIG is disabled."""
    mock_flask_app = MagicMock()
    mock_configs = {
        "MCP_CACHE_CONFIG": {"enabled": True, "list_tools_ttl": 300},
        "MCP_STORE_CONFIG": {"enabled": False},
    }
    mock_flask_app.config.get.side_effect = lambda key, default=None: mock_configs.get(
        key, default
    )

    mock_middleware = MagicMock()

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=mock_flask_app,
    ):
        with patch("flask.has_app_context", return_value=True):
            with patch(
                "fastmcp.server.middleware.caching.ResponseCachingMiddleware",
                return_value=mock_middleware,
            ) as mock_middleware_class:
                from superset.mcp_service.caching import (
                    create_response_caching_middleware,
                )

                result = create_response_caching_middleware()

                # Middleware should be created with cache_storage=None (in-memory)
                assert result is mock_middleware
                mock_middleware_class.assert_called_once()
                call_kwargs = mock_middleware_class.call_args[1]
                assert call_kwargs["cache_storage"] is None


def test_create_response_caching_middleware_creates_middleware():
    """Caching middleware is created when properly configured."""
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = {
        "enabled": True,
        "CACHE_KEY_PREFIX": "mcp_cache_v1_",
        "list_tools_ttl": 300,
    }

    mock_store = MagicMock()
    mock_middleware = MagicMock()

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=mock_flask_app,
    ):
        with patch("flask.has_app_context", return_value=True):
            with patch(
                "superset.mcp_service.caching.get_mcp_store", return_value=mock_store
            ):
                with patch(
                    "fastmcp.server.middleware.caching.ResponseCachingMiddleware",
                    return_value=mock_middleware,
                ) as mock_middleware_class:
                    from superset.mcp_service.caching import (
                        create_response_caching_middleware,
                    )

                    result = create_response_caching_middleware()

                    assert result is mock_middleware
                    # Verify middleware was created with store and settings
                    mock_middleware_class.assert_called_once()
                    call_kwargs = mock_middleware_class.call_args[1]
                    assert call_kwargs["cache_storage"] is mock_store
                    assert call_kwargs["list_tools_settings"] == {"ttl": 300}
