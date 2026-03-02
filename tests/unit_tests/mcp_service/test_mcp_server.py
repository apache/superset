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
