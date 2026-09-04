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
    mock_redis_client = MagicMock()
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
                    with patch(
                        "superset.mcp_service.storage.Redis",
                        return_value=mock_redis_client,
                    ):
                        from superset.mcp_service.storage import get_mcp_store

                        result = get_mcp_store(prefix="test_prefix_")

                        # Verify store was created
                        assert result is mock_wrapper_instance
                        # Verify wrapper was called with correct args
                        mock_wrapper_class.assert_called_once_with(
                            key_value=mock_redis_store, prefix="test_prefix_"
                        )


def test_create_redis_store_wrap_false_returns_raw_store():
    """_create_redis_store with wrap=False returns unwrapped RedisStore."""
    store_config = {
        "CACHE_REDIS_URL": "redis://localhost:6379/0",
        "WRAPPER_TYPE": "key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper",
    }

    mock_redis_store = MagicMock()
    mock_redis_client = MagicMock()

    with patch(
        "key_value.aio.stores.redis.RedisStore",
        return_value=mock_redis_store,
    ) as mock_redis_store_class:
        with patch(
            "superset.mcp_service.storage.Redis",
            return_value=mock_redis_client,
        ) as mock_redis_class:
            from superset.mcp_service.storage import _create_redis_store

            result = _create_redis_store(store_config, wrap=False)

            # Verify raw store is returned (not wrapped)
            assert result is mock_redis_store
            # Verify Redis client was created with correct params
            mock_redis_class.assert_called_once()
            call_kwargs = mock_redis_class.call_args[1]
            assert call_kwargs["host"] == "localhost"
            assert call_kwargs["port"] == 6379
            # Verify RedisStore was called with the client
            mock_redis_store_class.assert_called_once_with(client=mock_redis_client)


def test_create_redis_store_wrap_true_requires_prefix():
    """_create_redis_store with wrap=True requires prefix parameter."""
    store_config = {
        "CACHE_REDIS_URL": "redis://localhost:6379/0",
        "WRAPPER_TYPE": "key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper",
    }

    mock_redis_store = MagicMock()

    with patch(
        "key_value.aio.stores.redis.RedisStore",
        return_value=mock_redis_store,
    ):
        from superset.mcp_service.storage import _create_redis_store

        # wrap=True (default) with no prefix should return None
        result = _create_redis_store(store_config, prefix=None, wrap=True)

        assert result is None


def test_create_redis_store_handles_ssl_url():
    """_create_redis_store handles rediss:// URLs with SSL configuration."""
    store_config = {
        "CACHE_REDIS_URL": "rediss://:password@redis.example.com:6380/1",
        "WRAPPER_TYPE": "key_value.aio.wrappers.prefix_keys.PrefixKeysWrapper",
    }

    mock_redis_store = MagicMock()
    mock_redis_client = MagicMock()

    with patch(
        "key_value.aio.stores.redis.RedisStore",
        return_value=mock_redis_store,
    ):
        with patch(
            "superset.mcp_service.storage.Redis",
            return_value=mock_redis_client,
        ) as mock_redis_class:
            from superset.mcp_service.storage import _create_redis_store

            result = _create_redis_store(store_config, wrap=False)

            # Verify store was created
            assert result is mock_redis_store
            # Verify Redis client was created with SSL params
            call_kwargs = mock_redis_class.call_args[1]
            assert call_kwargs["ssl"] is True
            assert call_kwargs["ssl_cert_reqs"] == "none"
            assert call_kwargs["host"] == "redis.example.com"
            assert call_kwargs["port"] == 6380
            assert call_kwargs["db"] == 1


def test_create_redis_store_non_ssl_url_no_ssl_param():
    """_create_redis_store with redis:// URL doesn't pass SSL params."""
    store_config = {
        "CACHE_REDIS_URL": "redis://localhost:6379/0",
    }

    mock_redis_store = MagicMock()
    mock_redis_client = MagicMock()

    with patch(
        "key_value.aio.stores.redis.RedisStore",
        return_value=mock_redis_store,
    ):
        with patch(
            "superset.mcp_service.storage.Redis",
            return_value=mock_redis_client,
        ) as mock_redis_class:
            from superset.mcp_service.storage import _create_redis_store

            result = _create_redis_store(store_config, wrap=False)

            assert result is mock_redis_store
            # Verify SSL params were NOT passed for non-SSL URL
            call_kwargs = mock_redis_class.call_args[1]
            assert "ssl" not in call_kwargs
            assert "ssl_cert_reqs" not in call_kwargs


def test_create_redis_store_handles_url_with_username_and_password():
    """_create_redis_store properly handles URL with username and password."""
    test_password = "mypassword"  # noqa: S105
    store_config = {
        "CACHE_REDIS_URL": f"redis://myuser:{test_password}@redis.example.com:6379/0",
    }

    mock_redis_store = MagicMock()
    mock_redis_client = MagicMock()

    with patch(
        "key_value.aio.stores.redis.RedisStore",
        return_value=mock_redis_store,
    ):
        with patch(
            "superset.mcp_service.storage.Redis",
            return_value=mock_redis_client,
        ) as mock_redis_class:
            from superset.mcp_service.storage import _create_redis_store

            result = _create_redis_store(store_config, wrap=False)

            assert result is mock_redis_store
            # Verify Redis client was created with password from URL
            call_kwargs = mock_redis_class.call_args[1]
            assert call_kwargs["host"] == "redis.example.com"
            assert call_kwargs["password"] == test_password


def test_create_redis_store_handles_url_with_only_username():
    """_create_redis_store handles URL with username but no password."""
    store_config = {
        "CACHE_REDIS_URL": "redis://myuser@redis.example.com:6379/0",
    }

    mock_redis_store = MagicMock()
    mock_redis_client = MagicMock()

    with patch(
        "key_value.aio.stores.redis.RedisStore",
        return_value=mock_redis_store,
    ):
        with patch(
            "superset.mcp_service.storage.Redis",
            return_value=mock_redis_client,
        ) as mock_redis_class:
            from superset.mcp_service.storage import _create_redis_store

            result = _create_redis_store(store_config, wrap=False)

            assert result is mock_redis_store
            # Verify Redis client was created with correct params
            call_kwargs = mock_redis_class.call_args[1]
            assert call_kwargs["host"] == "redis.example.com"
            # No password in URL means password should be None
            assert call_kwargs["password"] is None
