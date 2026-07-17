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

from pytest_mock import MockerFixture


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
