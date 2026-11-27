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

import ssl
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from redis.asyncio import Redis


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
            assert call_kwargs["ssl_cert_reqs"] == "required"
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


def _build_real_client(store_config: dict[str, Any]) -> Redis:
    """Run _create_redis_store with a real redis-py client and return it.

    Only RedisStore is stubbed, so the assertions below read the TLS and
    timeout settings off the client redis-py actually builds, not off the
    keyword arguments passed to a mock.
    """
    captured: dict[str, Redis] = {}

    def _fake_store(client: Redis) -> MagicMock:
        captured["client"] = client
        return MagicMock()

    with patch("key_value.aio.stores.redis.RedisStore", side_effect=_fake_store):
        from superset.mcp_service.storage import _create_redis_store

        result = _create_redis_store(store_config, wrap=False)

    assert result is not None
    return captured["client"]


def _ssl_context(client: Redis) -> ssl.SSLContext:
    connection = client.connection_pool.make_connection()
    return connection.ssl_context.get()


def test_create_redis_store_ssl_verifies_certificate_by_default() -> None:
    """A rediss:// URL verifies the server certificate and hostname by default."""
    client = _build_real_client(
        {"CACHE_REDIS_URL": "rediss://:password@redis.example.com:6380/1"}
    )

    context = _ssl_context(client)
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True


def test_create_redis_store_ssl_uses_configured_ca_bundle() -> None:
    """CACHE_REDIS_SSL_CA_CERTS reaches the TLS context used to verify Redis."""
    ca_path = "/etc/superset/redis-ca.pem"
    client = _build_real_client(
        {
            "CACHE_REDIS_URL": "rediss://redis.example.com:6380/0",
            "CACHE_REDIS_SSL_CA_CERTS": ca_path,
        }
    )

    connection = client.connection_pool.make_connection()
    redis_ssl_context = connection.ssl_context
    assert redis_ssl_context.ca_certs == ca_path
    assert redis_ssl_context.cert_reqs == ssl.CERT_REQUIRED


def test_create_redis_store_ssl_verification_can_be_disabled(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Operators can opt out of verification explicitly with "none"."""
    client = _build_real_client(
        {
            "CACHE_REDIS_URL": "rediss://redis.example.com:6380/0",
            "CACHE_REDIS_SSL_CERT_REQS": "none",
        }
    )

    context = _ssl_context(client)
    assert context.verify_mode == ssl.CERT_NONE
    assert context.check_hostname is False
    assert "MCP Redis TLS certificate verification is disabled" in caplog.text


def test_create_redis_store_rejects_unknown_cert_reqs() -> None:
    """An unknown CACHE_REDIS_SSL_CERT_REQS value never yields a store."""
    with patch("key_value.aio.stores.redis.RedisStore") as mock_store:
        from superset.mcp_service.storage import _create_redis_store

        result = _create_redis_store(
            {
                "CACHE_REDIS_URL": "rediss://redis.example.com:6380/0",
                "CACHE_REDIS_SSL_CERT_REQS": "off",
            },
            wrap=False,
        )

    assert result is None
    mock_store.assert_not_called()


@pytest.mark.parametrize("url", ["redis://localhost:6379/0", "rediss://h:6380/0"])
def test_create_redis_store_applies_default_timeouts(url: str) -> None:
    """Socket and connect timeouts are bounded by default for both schemes."""
    client = _build_real_client({"CACHE_REDIS_URL": url})

    connection = client.connection_pool.make_connection()
    assert connection.socket_timeout == 5.0
    assert connection.socket_connect_timeout == 5.0
    assert connection.socket_timeout is not None
    assert connection.socket_connect_timeout is not None


def test_create_redis_store_applies_configured_timeouts() -> None:
    """Configured timeouts override the defaults."""
    client = _build_real_client(
        {
            "CACHE_REDIS_URL": "rediss://redis.example.com:6380/0",
            "CACHE_REDIS_SOCKET_TIMEOUT": 2.5,
            "CACHE_REDIS_SOCKET_CONNECT_TIMEOUT": 1.5,
        }
    )

    connection = client.connection_pool.make_connection()
    assert connection.socket_timeout == 2.5
    assert connection.socket_connect_timeout == 1.5


@pytest.mark.parametrize(
    "cert_reqs",
    [0, 1, 2, ssl.CERT_NONE, ssl.CERT_OPTIONAL, ssl.CERT_REQUIRED],
    ids=[
        "int-none",
        "int-optional",
        "int-required",
        "enum-none",
        "enum-optional",
        "enum-required",
    ],
)
def test_create_redis_store_accepts_numeric_cert_reqs(
    cert_reqs: int,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Integer and VerifyMode settings retain redis-py's verification semantics."""
    client = _build_real_client(
        {
            "CACHE_REDIS_URL": "rediss://redis.example.com:6380/0",
            "CACHE_REDIS_SSL_CERT_REQS": cert_reqs,
        }
    )

    context = _ssl_context(client)
    assert context.verify_mode == cert_reqs
    assert context.check_hostname is (cert_reqs != ssl.CERT_NONE)
    assert ("MCP Redis TLS certificate verification is disabled" in caplog.text) is (
        cert_reqs == ssl.CERT_NONE
    )


@pytest.mark.parametrize("cert_reqs", [True, False])
def test_ssl_kwargs_rejects_boolean_cert_reqs(cert_reqs: bool) -> None:
    """Booleans are invalid TLS modes even though bool subclasses int."""
    from superset.mcp_service.storage import _ssl_kwargs

    with pytest.raises(ValueError, match="CACHE_REDIS_SSL_CERT_REQS"):
        _ssl_kwargs({"CACHE_REDIS_SSL_CERT_REQS": cert_reqs})


@pytest.mark.parametrize("cert_reqs", [True, False])
@pytest.mark.parametrize("wrap", [True, False])
def test_create_redis_store_rejects_boolean_cert_reqs(
    cert_reqs: bool, wrap: bool, caplog: pytest.LogCaptureFixture
) -> None:
    """Invalid boolean TLS modes prevent both raw and wrapped store creation."""
    from superset.mcp_service.storage import _create_redis_store

    with (
        patch("superset.mcp_service.storage.Redis") as mock_client,
        patch("key_value.aio.stores.redis.RedisStore") as mock_store,
    ):
        result = _create_redis_store(
            {
                "CACHE_REDIS_URL": "rediss://redis.example.com:6380/0",
                "CACHE_REDIS_SSL_CERT_REQS": cert_reqs,
                "WRAPPER_TYPE": "key_value.aio.wrappers.prefix.PrefixWrapper",
            },
            prefix="test_",
            wrap=wrap,
        )

    assert result is None
    mock_client.assert_not_called()
    mock_store.assert_not_called()
    assert "Invalid MCP_STORE_CONFIG CACHE_REDIS_SSL_CERT_REQS" in caplog.text
