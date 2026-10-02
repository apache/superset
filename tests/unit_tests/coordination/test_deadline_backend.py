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
from unittest.mock import AsyncMock, Mock, patch

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
    with patch("superset.coordination.deadline_backend.Redis") as client:
        with pytest.raises(RedisTimeoutError):
            backend.get("owned-key")
        client.assert_not_called()


@pytest.mark.parametrize("close_method", ["close", "aclose"])
def test_sentinel_and_tls_configuration_use_private_clients_without_retries(
    close_method: str,
) -> None:
    from unittest.mock import AsyncMock, Mock

    client: Mock = Mock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.execute_command = AsyncMock(return_value=b"observed")
    sentinel_client: Mock = Mock(spec=[close_method])
    close: AsyncMock = AsyncMock()
    setattr(sentinel_client, close_method, close)
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
        close.assert_awaited_once()
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

    with patch("superset.coordination.deadline_backend.Redis") as client:
        asyncio.run(unsupported())
        client.assert_not_called()


def test_call_deadline_does_not_mutate_or_extend_the_backend_budget() -> None:
    async def slow(*args: object, **kwargs: object) -> None:
        await asyncio.sleep(2)

    started: float = time.monotonic()
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        {"CACHE_TYPE": "RedisCache"}, deadline=started + 0.2
    )
    short: DeadlineRedisBackend = backend.with_deadline(started + 0.03)
    with patch("redis.asyncio.Redis.execute_command", slow):
        with pytest.raises(RedisTimeoutError):
            short.get("owned-key")
        assert time.monotonic() - started < 0.15
        # An attempted extension stays within the original transport ceiling.
        with pytest.raises(RedisTimeoutError):
            backend.with_deadline(started + 5).get("owned-key")
    assert time.monotonic() - started < 0.4
    with pytest.raises(ValueError, match="finite"):
        backend.with_deadline(float("nan"))


def test_implausible_budget_never_starts_redis_command() -> None:
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        {"CACHE_TYPE": "RedisCache"}, deadline=time.monotonic() + 301
    )
    command: AsyncMock
    with patch.object(backend, "_command", new_callable=AsyncMock) as command:
        with pytest.raises(RedisTimeoutError):
            backend.get("owned-key")
        command.assert_not_awaited()


@pytest.mark.parametrize(
    "configured,expected",
    [
        (0.05, 0.05),
        (50.0, 1.0),
        (1, 1.0),
        (None, 1.0),
        ("0.05", 1.0),
        (0, 1.0),
        (-1, 1.0),
        (True, 1.0),
        (False, 1.0),
        (float("nan"), 1.0),
        (float("inf"), 1.0),
        (float("-inf"), 1.0),
        ({}, 1.0),
        ([], 1.0),
    ],
)
def test_sentinel_node_timeouts_respect_configuration_and_operation_ceiling(
    configured: object,
    expected: float,
) -> None:
    """A short per-node timeout leaves time for Sentinel fallback."""
    client: Mock = Mock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.execute_command = AsyncMock(return_value=b"observed")
    manager: Mock = Mock()
    manager.sentinels = []
    manager.master_for.return_value = client
    factory: Mock
    with patch(
        "superset.coordination.deadline_backend.Sentinel", return_value=manager
    ) as factory:
        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            {
                "CACHE_TYPE": "RedisSentinelCache",
                "CACHE_REDIS_SOCKET_TIMEOUT": configured,
                "CACHE_REDIS_SOCKET_CONNECT_TIMEOUT": configured,
            },
            deadline=time.monotonic() + 1,
        )
        with patch.object(backend, "_remaining", return_value=1.0):
            assert backend.get("owned") == b"observed"
    option: str
    for option in ("socket_timeout", "socket_connect_timeout"):
        actual: float = factory.call_args.kwargs["sentinel_kwargs"][option]
        assert actual == expected
        assert factory.call_args.kwargs[option] == actual


@pytest.mark.parametrize("patched", [False, True])
def test_concurrent_greenlets_have_isolated_redis_loops(patched: bool) -> None:
    """Two synchronous requests may yield Redis I/O on the same native thread."""
    import subprocess
    import sys
    import textwrap

    pytest.importorskip("gevent")
    script: str = textwrap.dedent(
        """
        import sys
        if sys.argv[1] == "True":
            from gevent import monkey
            monkey.patch_all()
        import asyncio
        import time
        import gevent
        from unittest.mock import patch
        from superset.coordination.deadline_backend import DeadlineRedisBackend

        async def slow(self: object, *args: object, **kwargs: object) -> bytes:
            await asyncio.sleep(0.03)
            return str(args[-1]).encode()

        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            {"CACHE_TYPE": "RedisCache"}, deadline=time.monotonic() + 2
        )
        with patch("redis.asyncio.Redis.execute_command", slow):
            requests: list[gevent.Greenlet] = [
                gevent.spawn(backend.get, "first"),
                gevent.spawn(backend.get, "second"),
            ]
            gevent.joinall(requests, timeout=3, raise_error=True)
            assert [request.value for request in requests] == [b"first", b"second"]
        print("two concurrent requests passed")
        """
    )
    # Execute only fixed test source and parametrized literals, with no shell.
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script, str(patched)],
        text=True,
        capture_output=True,
        timeout=10,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "two concurrent requests passed" in result.stdout


@pytest.mark.parametrize("mode", ["deadline", "caller_cancelled", "queued"])
def test_gevent_transport_cancels_without_late_commands(mode: str) -> None:
    """Native isolation preserves queue deadlines and cancels abandoned I/O."""
    import subprocess
    import sys
    import textwrap

    pytest.importorskip("gevent")
    script: str = textwrap.dedent(
        """
        from gevent import monkey
        monkey.patch_all()
        import asyncio
        import sys
        import time
        import gevent
        from unittest.mock import patch
        from superset.coordination.deadline_backend import DeadlineRedisBackend
        from redis.exceptions import TimeoutError as RedisTimeoutError

        mode: str = sys.argv[1]
        events: list[str] = []
        async def slow(self: object, *args: object, **kwargs: object) -> bytes:
            events.append("started")
            try:
                await asyncio.sleep(3)
                events.append("published")
                return b"late"
            finally:
                events.append("cancelled")

        from gevent.hub import Hub

        hub: Hub = gevent.get_hub()
        if mode == "queued":
            hub.threadpool.maxsize = 1
            hub.threadpool.spawn(monkey.get_original("time", "sleep"), 0.3)
        started: float = time.monotonic()
        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            {"CACHE_TYPE": "RedisCache"},
            deadline=started + (2 if mode == "caller_cancelled" else 0.1),
        )
        with patch("redis.asyncio.Redis.execute_command", slow):
            request: gevent.Greenlet = gevent.spawn(backend.get, "owned")
            if mode == "caller_cancelled":
                with gevent.Timeout(1):
                    while "started" not in events:
                        gevent.sleep(0.001)
                request.kill(block=True)
            else:
                request.join(timeout=0.5)
                assert isinstance(request.exception, RedisTimeoutError), (
                    request.exception
                )
                assert time.monotonic() - started < 0.5
            assert request.ready()
            # Wait for cleanup/queued expiry; an abandoned command cannot publish.
            with gevent.Timeout(1):
                hub.threadpool.join()
            if mode == "queued":
                assert events == [], events
            else:
                assert events == ["started", "cancelled"], events
        print("bounded cancellation passed")
        """
    )
    # Execute only fixed test source and parametrized literals, with no shell.
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script, mode],
        text=True,
        capture_output=True,
        timeout=10,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "bounded cancellation passed" in result.stdout
