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
import socket
import ssl
import time
from collections.abc import Iterator
from contextlib import contextmanager, ExitStack
from pathlib import Path
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


@pytest.mark.parametrize("outcome", ["success", "error", "timeout"])
@pytest.mark.parametrize("external", [True, False])
def test_sentinel_disconnects_its_external_master_pool(
    outcome: str, external: bool
) -> None:
    """redis-py 5.0 Sentinel clients do not own their supplied connection pool."""
    from redis.asyncio import ConnectionPool, Redis
    from redis.asyncio.sentinel import Sentinel
    from redis.exceptions import RedisError

    pool: ConnectionPool = ConnectionPool()
    client: Redis = Redis(connection_pool=pool)
    assert not client.auto_close_connection_pool
    if not external:
        client = Sentinel([]).master_for("owned-master")
        pool = client.connection_pool
    manager: Mock = Mock(sentinels=[], master_for=Mock(return_value=client))

    async def execute(*args: object, **kwargs: object) -> bytes:
        if outcome == "error":
            raise RedisError("test failure")
        if outcome == "timeout":
            await asyncio.sleep(2)
        return b"observed"

    disconnect: AsyncMock
    with (
        patch("superset.coordination.deadline_backend.Sentinel", return_value=manager),
        patch.object(client, "execute_command", execute),
        patch.object(pool, "disconnect", new_callable=AsyncMock) as disconnect,
    ):
        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            {"CACHE_TYPE": "RedisSentinelCache"}, deadline=time.monotonic() + 0.05
        )
        if outcome == "success":
            assert backend.get("owned") == b"observed"
        else:
            with pytest.raises(RedisError):
                backend.get("owned")
        if outcome == "timeout":
            # No graceful wait remains; the private loop aborts owned transports.
            disconnect.assert_not_awaited()
        elif external:
            disconnect.assert_awaited_once()
        else:
            disconnect.assert_awaited()


@pytest.mark.parametrize("close_method", ["close", "aclose"])
def test_sentinel_and_tls_configuration_use_private_clients_without_retries(
    close_method: str,
) -> None:
    from unittest.mock import AsyncMock, Mock

    client: Mock = Mock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.connection_pool.disconnect = AsyncMock()
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
    client.connection_pool.disconnect = AsyncMock()
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

        from gevent.threadpool import ThreadPool
        from superset.coordination.deadline_backend import _metadata_threadpool

        pool: ThreadPool = _metadata_threadpool()
        if mode == "queued":
            pool.maxsize = 1
            pool.spawn(monkey.get_original("time", "sleep"), 0.3)
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
                pool.join()
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


@pytest.mark.parametrize("patched", [False, True])
def test_saturated_metadata_pool_leaves_hub_resolver_pool_free(patched: bool) -> None:
    """A metadata outage must not occupy the hub's shared DNS worker pool."""
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
        from gevent.hub import Hub
        from unittest.mock import patch
        from superset.coordination import deadline_backend as module

        hub: Hub = gevent.get_hub()
        hub.threadpool.maxsize = 1
        from gevent.threadpool import ThreadPool
        pool: ThreadPool = getattr(
            module, "_metadata_threadpool", lambda: hub.threadpool
        )()
        pool.maxsize = 1
        started: list[str] = []
        async def blocked(self: object, *args: object, **kwargs: object) -> bytes:
            started.append("entered")
            await asyncio.sleep(1)
            return b"late"

        backend: module.DeadlineRedisBackend = module.DeadlineRedisBackend(
            {"CACHE_TYPE": "RedisCache"}, deadline=time.monotonic() + 3
        )
        requests: list[gevent.Greenlet] = []
        with patch("redis.asyncio.Redis.execute_command", blocked):
            try:
                requests = [gevent.spawn(backend.get, "owned")]
                with gevent.Timeout(1):
                    while not started:
                        gevent.sleep(0.001)
                with gevent.Timeout(0.2):
                    resolver_result: str = hub.threadpool.spawn(
                        lambda: "resolver-slot"
                    ).get()
                    assert resolver_result == "resolver-slot"
                assert not any(request.ready() for request in requests)
            finally:
                gevent.killall(requests, block=True)
        print("resolver pool remains free")
        """
    )
    # Execute fixed test source and boolean literals without a shell.
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script, str(patched)],
        text=True,
        capture_output=True,
        timeout=10,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "resolver pool remains free" in result.stdout


@pytest.mark.parametrize("mode", ["native_threads", "fork"])
def test_metadata_pool_preserves_native_ownership_and_fork_lifecycle(mode: str) -> None:
    """A dedicated pool stays with its hub and survives worker fork reinitialization."""
    import subprocess
    import sys
    import textwrap

    pytest.importorskip("gevent")
    script: str = textwrap.dedent(
        """
        import sys
        mode: str = sys.argv[1]
        if mode == "fork":
            from gevent import monkey
            monkey.patch_all()
        import os
        import time
        import traceback
        import gevent
        import gevent.os
        from threading import Thread
        from gevent.threadpool import ThreadPool
        from unittest.mock import patch
        from superset.coordination import deadline_backend as module

        pools: list[ThreadPool] = []
        async def command(self: object, *args: object, **kwargs: object) -> bytes:
            return b"observed"

        def request() -> None:
            pool: ThreadPool = module._metadata_threadpool()
            assert pool is module._metadata_threadpool()
            assert pool.hub is gevent.get_hub()
            backend: module.DeadlineRedisBackend = module.DeadlineRedisBackend(
                {"CACHE_TYPE": "RedisCache"}, deadline=time.monotonic() + 2
            )
            task: gevent.Greenlet = gevent.spawn(backend.get, "owned")
            assert task.get(timeout=3) == b"observed"
            assert pool.pid == os.getpid()
            pools.append(pool)

        with patch("redis.asyncio.Redis.execute_command", command):
            if mode == "native_threads":
                threads: list[Thread] = [Thread(target=request) for _ in range(2)]
                thread: Thread
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join(timeout=4)
                    assert not thread.is_alive()
                assert len(pools) == 2 and pools[0] is not pools[1]
            else:
                request()
                pid: int = gevent.os.fork()
                if pid == 0:
                    try:
                        request()
                    except BaseException:
                        traceback.print_exc()
                        os._exit(1)
                    os._exit(0)
                completed: bool = False
                status: int
                try:
                    with gevent.Timeout(4):
                        _, status = gevent.os.waitpid(pid, 0)
                        completed = True
                        assert os.waitstatus_to_exitcode(status) == 0
                finally:
                    if not completed:
                        os.kill(pid, 9)
                        gevent.os.waitpid(pid, 0)
        print("pool lifecycle passed")
        """
    )
    # Execute fixed test source and parametrized literals without a shell.
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script, mode],
        text=True,
        capture_output=True,
        timeout=12,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "pool lifecycle passed" in result.stdout


@pytest.mark.parametrize("patched", [False, True])
def test_timed_out_system_dns_retains_bounded_admission(patched: bool) -> None:
    """Stalled native lookups retain capacity after their callers have timed out."""
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
        import socket
        import time
        import gevent
        from gevent.monkey import get_original
        from unittest.mock import patch
        from redis.exceptions import TimeoutError as RedisTimeoutError
        from superset.coordination.deadline_backend import DeadlineRedisBackend

        from _thread import LockType
        gate: LockType = get_original("_thread", "allocate_lock")()
        gate.acquire()
        guard: LockType = get_original("_thread", "allocate_lock")()
        started: list[int] = []
        finished: list[int] = []
        published: list[bytes] = []

        def dns(*args: object, **kwargs: object) -> list[object]:
            with guard:
                started.append(1)
            with gate:
                pass
            with guard:
                finished.append(1)
            return []

        async def command(self: object, *args: object) -> bytes:
            await asyncio.get_running_loop().getaddrinfo("stalled.invalid", 6379)
            published.append(b"unexpected")
            return b"resolved"

        def request() -> None:
            backend: DeadlineRedisBackend = DeadlineRedisBackend(
                {"CACHE_TYPE": "RedisCache"}, deadline=time.monotonic() + 0.04
            )
            try:
                backend.get("owned")
            except RedisTimeoutError:
                return
            raise AssertionError("request did not time out")

        # Patch the underlying system resolver in either monkey-patching mode.
        if sys.argv[1] == "True":
            from gevent.monkey import saved
            saved["socket"]["getaddrinfo"] = dns
        with (
            patch("socket.getaddrinfo", dns),
            patch("redis.asyncio.Redis.execute_command", command),
        ):
            try:
                for _ in range(9):
                    if sys.argv[1] == "True":
                        gevent.spawn(request).get(timeout=2)
                    else:
                        request()
                assert 1 <= len(started) <= 4, len(started)
                assert not finished
                assert not published
                if sys.argv[1] == "False":
                    import os
                    import traceback
                    pid: int = os.fork()
                    if pid == 0:
                        # Inherited blocked parent lookups do not exist here.
                        gate.release()
                        try:
                            child: DeadlineRedisBackend = DeadlineRedisBackend(
                                {"CACHE_TYPE": "RedisCache"},
                                deadline=time.monotonic() + 1,
                            )
                            assert child.get("child") == b"resolved"
                        except BaseException:
                            traceback.print_exc()
                            os._exit(1)
                        os._exit(0)
                    status: int
                    _, status = os.waitpid(pid, 0)
                    assert status == 0
            finally:
                gate.release()
                deadline: float = time.monotonic() + 2
                while len(finished) != len(started) and time.monotonic() < deadline:
                    gevent.sleep(0.01)
            assert len(finished) == len(started)
            assert not published
            backend: DeadlineRedisBackend = DeadlineRedisBackend(
                {"CACHE_TYPE": "RedisCache"}, deadline=time.monotonic() + 1
            )
            if sys.argv[1] == "True":
                healthy: gevent.Greenlet = gevent.spawn(backend.get, "healthy")
                assert healthy.get(timeout=2) == b"resolved"
            else:
                assert backend.get("healthy") == b"resolved"
            assert published == [b"unexpected"]
        print("bounded outstanding DNS; no late publication; capacity recovered")
        """
    )
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script, str(patched)],
        text=True,
        capture_output=True,
        timeout=15,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture
def tls_contexts(tmp_path: Path) -> tuple[ssl.SSLContext, ssl.SSLContext]:
    """Create a private certificate and TLS contexts for socket-pair regressions."""
    from datetime import datetime, timedelta, timezone

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID

    key: ec.EllipticCurvePrivateKey = ec.generate_private_key(ec.SECP256R1())
    name: x509.Name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now: datetime = datetime.now(timezone.utc)
    certificate: x509.Certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    (tmp_path / "cert.pem").write_bytes(
        certificate.public_bytes(serialization.Encoding.PEM)
    )
    (tmp_path / "key.pem").write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    server_context: ssl.SSLContext = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_context.load_cert_chain(tmp_path / "cert.pem", tmp_path / "key.pem")
    client_context: ssl.SSLContext = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    client_context.check_hostname = False
    client_context.verify_mode = ssl.CERT_NONE
    return server_context, client_context


@contextmanager
def _stalled_tls_socket(server_context: ssl.SSLContext) -> Iterator[socket.socket]:
    """Handshake with a peer that withholds its TLS close_notify response."""
    from threading import Event, Thread

    local_socket: socket.socket
    peer_socket: socket.socket
    local_socket, peer_socket = socket.socketpair()
    peer_socket.settimeout(2)
    release: Event = Event()
    errors: list[Exception] = []

    def peer() -> None:
        """Leave graceful shutdown waiting until the test releases the peer."""
        try:
            with server_context.wrap_socket(peer_socket, server_side=True):
                release.wait(5)
        except Exception as error:
            errors.append(error)

    worker: Thread = Thread(target=peer)
    worker.start()
    try:
        yield local_socket
    finally:
        local_socket.close()
        release.set()
        worker.join(3)
        peer_socket.close()
        assert not worker.is_alive()
        assert not errors


@pytest.mark.parametrize("sentinel", [False, True])
def test_stalled_tls_shutdown_releases_socket_before_loop_close(
    tls_contexts: tuple[ssl.SSLContext, ssl.SSLContext], sentinel: bool
) -> None:
    """Deadline cleanup closes real TLS sockets without relying on collection."""
    from redis.asyncio import Redis
    from redis.asyncio.connection import SSLConnection
    from redis.asyncio.sentinel import Sentinel

    server_context: ssl.SSLContext
    client_context: ssl.SSLContext
    server_context, client_context = tls_contexts
    client: Redis = Sentinel([]).master_for("owned") if sentinel else Redis()
    writers: list[asyncio.StreamWriter] = []
    connections: list[SSLConnection] = []

    async def execute(*args: object, **kwargs: object) -> bytes:
        """Give the real Redis pool a real TLS stream to disconnect."""
        reader: asyncio.StreamReader
        writer: asyncio.StreamWriter
        reader, writer = await asyncio.open_connection(
            sock=local_socket,
            ssl=client_context,
            server_hostname="localhost",
            ssl_shutdown_timeout=30,
        )
        writers.append(writer)
        connection: SSLConnection = SSLConnection(socket_connect_timeout=0.15)
        connection._reader = reader
        connection._writer = writer
        connections.append(connection)
        client.connection_pool._available_connections.append(connection)
        return b"observed"

    manager: Mock = Mock(sentinels=[], master_for=Mock(return_value=client))
    local_socket: socket.socket
    with _stalled_tls_socket(server_context) as local_socket:
        started: float = time.monotonic()
        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            {"CACHE_TYPE": "RedisSentinelCache" if sentinel else "RedisCache"},
            deadline=started + 0.15,
        )
        with (
            patch("superset.coordination.deadline_backend.Redis", return_value=client),
            patch(
                "superset.coordination.deadline_backend.Sentinel", return_value=manager
            ),
            patch.object(client, "execute_command", execute),
            pytest.raises(RedisTimeoutError),
        ):
            backend.get("owned")
        assert time.monotonic() - started < 0.75
        assert len(writers) == 1
        assert writers[0].transport.is_closing()
        # Keep the writer alive: GC must not be what releases the descriptor.
        assert local_socket.fileno() == -1
        assert connections[0]._writer is None


@pytest.mark.parametrize("stalled_master", [False, True])
@pytest.mark.parametrize("command_timeout", [False, True])
def test_late_sentinel_cleanup_stays_within_absolute_deadline(
    tls_contexts: tuple[ssl.SSLContext, ssl.SSLContext],
    stalled_master: bool,
    command_timeout: bool,
) -> None:
    """Multiple stalled peers cannot each restart the command's cleanup budget."""
    from redis.asyncio import Redis
    from redis.asyncio.connection import SSLConnection
    from redis.asyncio.sentinel import Sentinel

    server_context: ssl.SSLContext
    client_context: ssl.SSLContext
    server_context, client_context = tls_contexts
    client: Redis = Sentinel([]).master_for("owned")
    discovery_clients: list[Redis] = [Redis(), Redis()]
    clients: list[Redis] = [*discovery_clients, *([client] if stalled_master else [])]
    writers: list[asyncio.StreamWriter] = []
    sockets: list[socket.socket] = []
    budget: float = 0.6
    completed: list[float] = []
    peers: ExitStack

    with ExitStack() as peers:
        _redis_client: Redis
        for _redis_client in clients:
            sockets.append(peers.enter_context(_stalled_tls_socket(server_context)))

        async def execute(*args: object, **kwargs: object) -> bytes:
            """Spend most of the budget before real Redis/TLS cleanup begins."""
            target: Redis
            local_socket: socket.socket
            for target, local_socket in zip(clients, sockets, strict=True):
                reader: asyncio.StreamReader
                writer: asyncio.StreamWriter
                reader, writer = await asyncio.open_connection(
                    sock=local_socket,
                    ssl=client_context,
                    server_hostname="localhost",
                    ssl_shutdown_timeout=30,
                )
                writers.append(writer)
                connection: SSLConnection = SSLConnection(socket_connect_timeout=budget)
                connection._reader = reader
                connection._writer = writer
                target.connection_pool._available_connections.append(connection)
            await asyncio.sleep(1.2 if command_timeout else 0.4)
            completed.append(time.monotonic())
            return b"observed"

        manager: Mock = Mock(
            sentinels=discovery_clients, master_for=Mock(return_value=client)
        )
        started: float = time.monotonic()
        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            {"CACHE_TYPE": "RedisSentinelCache"}, deadline=started + budget
        )
        with (
            patch(
                "superset.coordination.deadline_backend.Sentinel", return_value=manager
            ),
            patch.object(client, "execute_command", execute),
            pytest.raises(RedisTimeoutError),
        ):
            backend.get("owned")
        if command_timeout:
            assert not completed
        else:
            assert len(completed) == 1
            assert 0.4 <= completed[0] - started < budget
        # Scheduling headroom is smaller than a single restarted connect timeout.
        assert time.monotonic() - started < budget + 0.25
        assert len(writers) == len(clients)
        local_socket: socket.socket
        for local_socket in sockets:
            assert local_socket.fileno() == -1
