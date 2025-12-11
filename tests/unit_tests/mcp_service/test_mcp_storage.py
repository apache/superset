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

"""Tests for MCP storage factory."""

from unittest.mock import MagicMock, patch


def test_get_mcp_store_returns_none_when_disabled():
    """Storage returns None when MCP_STORE_CONFIG.enabled is False."""
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = {"enabled": False}

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=mock_flask_app,
    ):
        with patch("flask.has_app_context", return_value=True):
            from superset.mcp_service.storage import get_mcp_store

            result = get_mcp_store(prefix="test_")

            assert result is None


def test_get_mcp_store_returns_none_when_no_redis_url():
    """Storage returns None when CACHE_REDIS_URL is not configured."""
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = {
        "enabled": True,
        "CACHE_REDIS_URL": None,
        "WRAPPER_TYPE": "key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper",
    }

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=mock_flask_app,
    ):
        with patch("flask.has_app_context", return_value=True):
            from superset.mcp_service.storage import get_mcp_store

            result = get_mcp_store(prefix="test_")

            assert result is None


def test_get_mcp_store_creates_store_when_enabled():
    """Storage creates wrapped RedisStore when properly configured."""
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = {
        "enabled": True,
        "CACHE_REDIS_URL": "redis://localhost:6379/0",
        "WRAPPER_TYPE": "key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper",
    }

    mock_redis_store = MagicMock()
    mock_wrapper_instance = MagicMock()
    mock_wrapper_class = MagicMock(return_value=mock_wrapper_instance)

    with patch(
        "superset.mcp_service.flask_singleton.get_flask_app",
        return_value=mock_flask_app,
    ):
        with patch("flask.has_app_context", return_value=True):
            with patch(
                "superset.mcp_service.storage._import_wrapper_class",
                return_value=mock_wrapper_class,
            ):
                with patch(
                    "key_value.aio.stores.redis.RedisStore",
                    return_value=mock_redis_store,
                ):
                    from superset.mcp_service.storage import get_mcp_store

                    result = get_mcp_store(prefix="test_prefix_")

                    # Verify store was created
                    assert result is mock_wrapper_instance
                    # Verify wrapper was called with correct args
                    mock_wrapper_class.assert_called_once_with(
                        key_value=mock_redis_store, prefix="test_prefix_"
                    )
