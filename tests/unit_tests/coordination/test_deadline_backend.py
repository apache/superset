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

"""The native Redis transport must cancel within the original remaining budget."""

from __future__ import annotations

import asyncio
import time
from unittest.mock import Mock, patch

import pytest
from redis.exceptions import TimeoutError as RedisTimeoutError

from superset.coordination.deadline_backend import DeadlineRedisBackend


def test_deadline_includes_waiting_for_the_transport() -> None:
    async def slow(*args: object, **kwargs: object) -> None:
        await asyncio.sleep(2)

    started: float = time.monotonic()
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        {"CACHE_TYPE": "RedisCache"},
        deadline=started + 0.05,
    )
    with patch("redis.asyncio.Redis.execute_command", slow):
        with pytest.raises(RedisTimeoutError):
            backend.get("owned-key")
    assert time.monotonic() - started < 0.5


def test_expired_budget_never_opens_a_connection() -> None:
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        {"CACHE_TYPE": "RedisCache"},
        deadline=time.monotonic() - 1,
    )
    client: Mock
    with patch("redis.asyncio.Redis") as client:
        with pytest.raises(RedisTimeoutError):
            backend.get("owned-key")
        client.assert_not_called()


def test_sentinel_and_tls_configuration_use_private_clients_without_retries() -> None:
    from unittest.mock import AsyncMock, Mock

    client: Mock = Mock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.execute_command = AsyncMock(return_value=b"observed")
    sentinel_client: Mock = Mock()
    sentinel_client.aclose = AsyncMock()
    manager: Mock = Mock()
    manager.sentinels = [sentinel_client]
    manager.master_for.return_value = client
    config: dict[str, object] = {
        "CACHE_TYPE": "RedisSentinelCache",
        "CACHE_REDIS_SENTINELS": [("sentinel", 26379)],
        "CACHE_REDIS_SENTINEL_MASTER": "owned-master",
        "CACHE_REDIS_DB": 4,
        "CACHE_REDIS_SSL": True,
        "CACHE_REDIS_SSL_CA_CERTS": "/test/ca.pem",
    }
    factory: Mock
    with patch(
        "superset.coordination.deadline_backend.Sentinel", return_value=manager
    ) as factory:
        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            config, deadline=time.monotonic() + 5
        )
        assert backend.get("owned") == b"observed"
        assert factory.call_args.kwargs["db"] == 4
        assert factory.call_args.kwargs["ssl"] is True
        assert factory.call_args.kwargs["ssl_ca_certs"] == "/test/ca.pem"
        assert factory.call_args.kwargs["retry"]._retries == 0
        assert factory.call_args.kwargs["sentinel_kwargs"]["retry"]._retries == 0
        manager.master_for.assert_called_once_with("owned-master")
        sentinel_client.aclose.assert_awaited_once()
        client.__aexit__.assert_awaited_once()


def test_slow_system_dns_does_not_extend_the_caller_deadline() -> None:
    def slow_dns(*args: object, **kwargs: object) -> object:
        time.sleep(0.4)
        raise OSError("test resolver failure")

    started: float = time.monotonic()
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        {"CACHE_TYPE": "RedisCache", "CACHE_REDIS_HOST": "metadata.invalid"},
        deadline=started + 0.05,
    )
    with patch("socket.getaddrinfo", side_effect=slow_dns):
        with pytest.raises(RedisTimeoutError):
            backend.get("owned-key")
    assert time.monotonic() - started < 0.25


def test_async_host_caller_requires_a_synchronous_worker() -> None:
    from redis.exceptions import RedisError

    client: Mock
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        {"CACHE_TYPE": "RedisCache"}, deadline=time.monotonic() + 1
    )

    async def unsupported() -> None:
        with pytest.raises(RedisError, match="synchronous caller"):
            backend.get("owned-key")

    with patch("redis.asyncio.Redis") as client:
        asyncio.run(unsupported())
        client.assert_not_called()
