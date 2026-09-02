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

"""Unit tests for RedisCacheBackend/RedisSentinelCacheBackend.

Pins the pre-redis-py-8 connection defaults (RESP2 protocol, no socket
timeout) explicitly, so bumping the ``redis`` library doesn't silently
change production connection behavior (redis-py 8 defaults to RESP3 on
the wire and a 5s socket timeout).
"""

from unittest import mock

import pytest
from pytest_mock import MockerFixture
from redis.exceptions import ConnectionError as RedisConnectionError


def test_redis_cache_backend_pins_protocol_and_timeout_defaults(
    mocker: MockerFixture,
) -> None:
    """RedisCacheBackend must default to RESP2 and no socket timeout."""
    from superset.async_events.cache_backend import RedisCacheBackend

    redis_mock = mocker.patch("superset.async_events.cache_backend.redis")

    RedisCacheBackend(host="localhost", port=6379)

    redis_mock.Redis.assert_called_once()
    kwargs = redis_mock.Redis.call_args.kwargs
    assert kwargs["protocol"] == 2
    assert kwargs["socket_timeout"] is None
    assert kwargs["socket_connect_timeout"] is None


def test_redis_cache_backend_allows_explicit_timeout_override(
    mocker: MockerFixture,
) -> None:
    """Callers can still opt into an explicit timeout if they want one."""
    from superset.async_events.cache_backend import RedisCacheBackend

    redis_mock = mocker.patch("superset.async_events.cache_backend.redis")

    RedisCacheBackend(
        host="localhost",
        port=6379,
        socket_timeout=10,
        socket_connect_timeout=3,
    )

    kwargs = redis_mock.Redis.call_args.kwargs
    assert kwargs["protocol"] == 2
    assert kwargs["socket_timeout"] == 10
    assert kwargs["socket_connect_timeout"] == 3


def test_redis_cache_backend_from_config_reads_timeout_keys(
    mocker: MockerFixture,
) -> None:
    """from_config should surface the new CACHE_REDIS_SOCKET_* keys."""
    from superset.async_events.cache_backend import RedisCacheBackend

    redis_mock = mocker.patch("superset.async_events.cache_backend.redis")

    RedisCacheBackend.from_config(
        {
            "CACHE_REDIS_HOST": "localhost",
            "CACHE_REDIS_PORT": 6379,
            "CACHE_REDIS_SOCKET_TIMEOUT": 15,
            "CACHE_REDIS_SOCKET_CONNECT_TIMEOUT": 5,
        }
    )

    kwargs = redis_mock.Redis.call_args.kwargs
    assert kwargs["protocol"] == 2
    assert kwargs["socket_timeout"] == 15
    assert kwargs["socket_connect_timeout"] == 5


def test_redis_sentinel_cache_backend_pins_protocol_and_timeout_defaults(
    mocker: MockerFixture,
) -> None:
    """RedisSentinelCacheBackend must default to RESP2/no timeout on both
    the sentinel-node connections and the master data connection."""
    from superset.async_events.cache_backend import RedisSentinelCacheBackend

    sentinel_mock = mocker.patch("superset.async_events.cache_backend.Sentinel")
    master_mock = mock.Mock()
    sentinel_mock.return_value.master_for.return_value = master_mock

    RedisSentinelCacheBackend(
        sentinels=[("localhost", 26379)],
        master="mymaster",
    )

    # Sentinel-node connections (used to talk to the sentinels themselves)
    sentinel_kwargs = sentinel_mock.call_args.kwargs["sentinel_kwargs"]
    assert sentinel_kwargs["protocol"] == 2
    assert sentinel_kwargs["socket_timeout"] is None
    assert sentinel_kwargs["socket_connect_timeout"] is None

    # Master data connection (used for the actual application traffic)
    master_kwargs = sentinel_mock.return_value.master_for.call_args.kwargs
    assert master_kwargs["protocol"] == 2
    assert master_kwargs["socket_timeout"] is None
    assert master_kwargs["socket_connect_timeout"] is None


def test_redis_sentinel_cache_backend_from_config_reads_timeout_keys(
    mocker: MockerFixture,
) -> None:
    """from_config should surface the new CACHE_REDIS_SOCKET_* keys."""
    from superset.async_events.cache_backend import RedisSentinelCacheBackend

    sentinel_mock = mocker.patch("superset.async_events.cache_backend.Sentinel")
    master_mock = mock.Mock()
    sentinel_mock.return_value.master_for.return_value = master_mock

    RedisSentinelCacheBackend.from_config(
        {
            "CACHE_REDIS_SENTINELS": [("localhost", 26379)],
            "CACHE_REDIS_SENTINEL_MASTER": "mymaster",
            "CACHE_REDIS_SOCKET_TIMEOUT": 20,
            "CACHE_REDIS_SOCKET_CONNECT_TIMEOUT": 4,
        }
    )

    sentinel_kwargs = sentinel_mock.call_args.kwargs["sentinel_kwargs"]
    assert sentinel_kwargs["protocol"] == 2
    assert sentinel_kwargs["socket_timeout"] == 20
    assert sentinel_kwargs["socket_connect_timeout"] == 4

    master_kwargs = sentinel_mock.return_value.master_for.call_args.kwargs
    assert master_kwargs["protocol"] == 2
    assert master_kwargs["socket_timeout"] == 20
    assert master_kwargs["socket_connect_timeout"] == 4


@pytest.mark.parametrize("backend_name", ["redis", "sentinel"])
def test_owner_token_acquire_uses_atomic_set_nx_with_ttl(
    backend_name: str,
) -> None:
    from superset.async_events.cache_backend import (
        RedisCacheBackend,
        RedisSentinelCacheBackend,
    )

    backend_type: type[RedisCacheBackend] | type[RedisSentinelCacheBackend] = (
        RedisCacheBackend if backend_name == "redis" else RedisSentinelCacheBackend
    )
    backend: RedisCacheBackend | RedisSentinelCacheBackend = object.__new__(
        backend_type
    )
    cache: mock.Mock = mock.Mock()
    cache.set.return_value = True
    backend._cache = cache

    acquired: bool = backend.acquire_owner_token("bucket", "owner-a", 15)

    assert acquired is True
    cache.set.assert_called_once_with("bucket", "owner-a", nx=True, ex=15)


@pytest.mark.parametrize("backend_name", ["redis", "sentinel"])
def test_owner_token_release_is_atomic_compare_and_delete(
    backend_name: str,
) -> None:
    from superset.async_events.cache_backend import (
        RedisCacheBackend,
        RedisSentinelCacheBackend,
    )

    backend_type: type[RedisCacheBackend] | type[RedisSentinelCacheBackend] = (
        RedisCacheBackend if backend_name == "redis" else RedisSentinelCacheBackend
    )
    backend: RedisCacheBackend | RedisSentinelCacheBackend = object.__new__(
        backend_type
    )
    cache: mock.Mock = mock.Mock()
    cache.eval.return_value = 0
    backend._cache = cache

    released: bool = backend.release_owner_token("bucket", "stale-owner")

    assert released is False
    script: str = cache.eval.call_args.args[0]
    assert "redis.call('get', KEYS[1]) == ARGV[1]" in script
    assert "redis.call('del', KEYS[1])" in script
    assert cache.eval.call_args.args[1:] == (1, "bucket", "stale-owner")


@pytest.mark.parametrize("backend_name", ["redis", "sentinel"])
def test_owner_token_refresh_is_atomic_compare_and_expire(
    backend_name: str,
) -> None:
    from superset.async_events.cache_backend import (
        RedisCacheBackend,
        RedisSentinelCacheBackend,
    )

    backend_type: type[RedisCacheBackend] | type[RedisSentinelCacheBackend] = (
        RedisCacheBackend if backend_name == "redis" else RedisSentinelCacheBackend
    )
    backend: RedisCacheBackend | RedisSentinelCacheBackend = object.__new__(
        backend_type
    )
    cache: mock.Mock = mock.Mock()
    cache.eval.return_value = 1
    backend._cache = cache

    refreshed: bool = backend.refresh_owner_token("bucket", "owner-a", 15)

    assert refreshed is True
    script: str = cache.eval.call_args.args[0]
    assert "redis.call('get', KEYS[1]) == ARGV[1]" in script
    assert "redis.call('expire', KEYS[1], ARGV[2])" in script
    assert cache.eval.call_args.args[1:] == (1, "bucket", "owner-a", 15)


class _OwnerStore:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def set(
        self,
        key: str,
        value: str,
        *,
        nx: bool,
        ex: int,
    ) -> bool:
        if nx and key in self.values:
            return False
        self.values[key] = value
        return ex > 0

    def eval(
        self,
        script: str,
        key_count: int,
        key: str,
        owner_token: str,
    ) -> int:
        assert script
        assert key_count == 1
        if self.values.get(key) != owner_token:
            return 0
        del self.values[key]
        return 1


def test_expired_owner_cannot_release_successor_token() -> None:
    from superset.async_events.cache_backend import RedisCacheBackend

    backend: RedisCacheBackend = object.__new__(RedisCacheBackend)
    cache: _OwnerStore = _OwnerStore()
    backend._cache = cache

    assert backend.acquire_owner_token("bucket", "owner-a", 1)
    assert backend.acquire_owner_token("bucket", "owner-b", 1) is False
    del cache.values["bucket"]
    assert backend.acquire_owner_token("bucket", "owner-b", 1)
    assert backend.release_owner_token("bucket", "owner-a") is False
    assert cache.values["bucket"] == "owner-b"
    assert backend.release_owner_token("bucket", "owner-b") is True


@pytest.mark.parametrize("operation", ["acquire", "release", "refresh"])
def test_owner_token_backend_errors_propagate(operation: str) -> None:
    from superset.async_events.cache_backend import RedisCacheBackend

    backend: RedisCacheBackend = object.__new__(RedisCacheBackend)
    cache: mock.Mock = mock.Mock()
    getattr(
        cache, "set" if operation == "acquire" else "eval"
    ).side_effect = RedisConnectionError("unavailable")
    backend._cache = cache

    def operation_call() -> bool:
        if operation == "acquire":
            return backend.acquire_owner_token("bucket", "owner", 1)
        if operation == "refresh":
            return backend.refresh_owner_token("bucket", "owner", 1)
        return backend.release_owner_token("bucket", "owner")

    with pytest.raises(RedisConnectionError, match="unavailable"):
        operation_call()
