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
"""
Time limits over real pyhive Thrift transports.

The HiveServer2 stand-in from ``test_impala_transport`` serves pyhive's NOSASL
and SASL PLAIN transports. The time limit is raised right after a reply header
is read, as a signal landing at that point would, so the rest of the reply is
left in the client's buffers.
"""

from __future__ import annotations

import socket
import threading
from collections.abc import Iterator
from contextlib import closing, contextmanager, ExitStack
from typing import Any
from unittest.mock import Mock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded

from superset.db_engine_specs.hive import HiveEngineSpec
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetTimeoutException

pytest.importorskip("pyhive.hive")
pytest.importorskip("thrift_sasl")
transport_tests = pytest.importorskip(
    "tests.unit_tests.db_engine_specs.test_impala_transport"
)
TTransportModule = pytest.importorskip("thrift.transport.TTransport")
reset_timeout_tracebacks = transport_tests.reset_timeout_tracebacks


@pytest.fixture(params=["NOSASL", "NONE", "HTTP"], ids=["binary", "sasl", "http"])
def hive_connection(
    request: pytest.FixtureRequest,
) -> Iterator[tuple[Any, Any]]:
    """A pyhive connection to a local HiveServer2 over each transport."""
    with hive_connection_for_mode(request.param) as connection:
        yield connection


@contextmanager
def hive_connection_for_mode(mode: str) -> Iterator[tuple[Any, Any]]:
    """Serve a PyHive connection, including replacements created by a pool."""
    from pyhive import hive

    handler = transport_tests.FakeHiveServer2()
    if mode == "HTTP":
        from thrift.transport.THttpClient import THttpClient

        server = transport_tests.THttpServer.THttpServer(
            transport_tests.TCLIService.Processor(handler),
            ("127.0.0.1", 0),
            transport_tests._RecordingProtocolFactory(handler),
        )
        thread = threading.Thread(target=server.serve, daemon=True)
        thread.start()
        transport = THttpClient(
            f"http://127.0.0.1:{server.httpd.server_address[1]}/cliservice"
        )
        transport.setTimeout(2000)
        conn = hive.connect(thrift_transport=transport, username="user")
        try:
            yield handler, conn
        finally:
            if transport.isOpen():
                transport.close()
            server.httpd.shutdown()
            server.httpd.server_close()
            thread.join(timeout=2)
        return

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    thread = threading.Thread(
        target=transport_tests._serve_socket,
        args=(handler, listener, mode == "NONE"),
        daemon=True,
    )
    thread.start()
    conn = hive.connect(
        "127.0.0.1", listener.getsockname()[1], auth=mode, username="user"
    )
    # pyhive sets no socket timeout, so a stale read would block forever.
    transport = conn._transport
    sock = getattr(transport, "_trans", None) or transport._TBufferedTransport__trans
    sock.setTimeout(2000)
    try:
        yield handler, conn
    finally:
        conn._transport.close()
        listener.shutdown(socket.SHUT_RDWR)
        listener.close()
        thread.join(timeout=2)


TIMEOUTS = [
    pytest.param(SoftTimeLimitExceeded(), id="async"),
    pytest.param(
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="The query exceeded the 30 seconds timeout.",
            level=ErrorLevel.ERROR,
        ),
        id="sync",
    ),
]


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "entry, interrupted",
    [
        ("handle_cursor", "GetOperationStatus"),
        ("handle_cursor", "GetLog"),
        ("fetch_data", "GetOperationStatus"),
        ("fetch_data", "FetchResults"),
    ],
    ids=["poll", "get_log", "fetch_poll", "rows"],
)
def test_cleanup_sends_nothing_after_an_interrupted_reply(
    entry: str,
    interrupted: str,
    timeout: Exception,
    hive_connection: tuple[Any, Any],
    app_context: None,
) -> None:
    """
    Closing the cursor and the connection must not read leftover reply bytes.

    The executor closes the cursor through ``closing()``, which sends
    CloseOperation, and the connection pool closes the connection, which sends
    CloseSession.
    """
    handler, conn = hive_connection
    if entry == "fetch_data":
        handler.state = transport_tests.ttypes.TOperationState.FINISHED_STATE
    cursor = conn.cursor()
    cursor.execute("SELECT 1", async_=True)
    transport_tests._interrupt_replies(conn._client._iprot, [(interrupted, timeout)])
    query = Mock(id=1, status="running", progress=0)

    def run() -> None:
        if entry == "fetch_data":
            HiveEngineSpec.fetch_data(cursor)
        else:
            HiveEngineSpec.handle_cursor(cursor, query)

    with patch("superset.db_engine_specs.hive.db"):
        with pytest.raises(type(timeout)) as raised, closing(cursor):
            run()
    # Closing a discarded connection is local-only, including in the pool.
    conn.close()

    assert raised.value is timeout
    assert handler.requests[-1] == interrupted, handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "drop_failure", [OSError("close failed"), SoftTimeLimitExceeded("close")]
)
def test_failed_transport_drop_preserves_timeout_and_disables_session_close(
    timeout: Exception,
    drop_failure: Exception,
    hive_connection: tuple[Any, Any],
    app_context: None,
) -> None:
    """A failed local close must not restore CloseSession or mask the timeout."""
    handler, conn = hive_connection
    cursor = conn.cursor()
    cursor.execute("SELECT 1", async_=True)
    protocol = conn._client._iprot
    read = protocol.readMessageBegin
    reply_interrupted = False

    def interrupted_read() -> Any:
        """Arm the local-drop failure only after the reply has been interrupted."""
        nonlocal reply_interrupted
        header = read()
        if header[0] == "GetOperationStatus":
            reply_interrupted = True
            raise timeout
        return header

    protocol.readMessageBegin = interrupted_read
    close = conn._transport.close
    attempts = 0

    def interrupted_close() -> None:
        nonlocal attempts
        if reply_interrupted:
            attempts += 1
            if attempts == 1:
                raise drop_failure
        close()

    with patch.object(conn._transport, "close", side_effect=interrupted_close):
        with pytest.raises(type(timeout)) as raised, closing(cursor):
            HiveEngineSpec.fetch_data(cursor)
        conn.close()

    assert raised.value is timeout
    assert attempts == 2
    assert handler.requests[-1] == "GetOperationStatus", handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
def test_connection_close_sends_no_rpc_after_an_interrupted_reply(
    timeout: Exception,
    hive_connection: tuple[Any, Any],
    app_context: None,
) -> None:
    """Connection.close must not send CloseSession on an interrupted transport."""
    handler, conn = hive_connection
    cursor = conn.cursor()
    cursor.execute("SELECT 1", async_=True)
    transport_tests._interrupt_replies(
        conn._client._iprot, [("GetOperationStatus", timeout)]
    )
    with pytest.raises(type(timeout)) as raised:
        HiveEngineSpec.fetch_data(cursor)
    # Isolate connection cleanup from cursor cleanup, even before the fix.
    cursor._operationHandle = None
    cursor.close()
    conn.close()

    assert raised.value is timeout
    assert handler.requests[-1] == "GetOperationStatus", handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize("interrupted", ["ExecuteStatement", "GetResultSetMetadata"])
def test_execute_and_metadata_abandon_before_cursor_and_connection_cleanup(
    interrupted: str,
    timeout: Exception,
    hive_connection: tuple[Any, Any],
    app_context: None,
) -> None:
    """Execution and lazy metadata must be abandoned before any cleanup RPC."""
    handler, conn = hive_connection
    cursor = conn.cursor()
    if interrupted != "ExecuteStatement":
        HiveEngineSpec.execute(cursor, "SELECT 1", None, async_=True)  # type: ignore[arg-type]
    transport_tests._interrupt_replies(conn._client._iprot, [(interrupted, timeout)])

    def run() -> None:
        """Read a reply, leaving its body unread when the limit fires."""
        if interrupted == "ExecuteStatement":
            HiveEngineSpec.execute(cursor, "SELECT 1", None, async_=True)  # type: ignore[arg-type]
        else:
            assert cursor.description

    with pytest.raises(type(timeout)) as raised, closing(cursor):
        run()
    conn.close()
    assert raised.value is timeout
    assert handler.requests[-1] == interrupted, handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
def test_sqlalchemy_ping_abandons_before_dialect_cursor_cleanup(
    timeout: Exception,
    hive_connection: tuple[Any, Any],
    app_context: None,
) -> None:
    """Connection validation must not reuse an interrupted transport either."""
    from sqlalchemy import create_engine
    from sqlalchemy.pool import NullPool

    handler, conn = hive_connection
    engine = create_engine("hive://", creator=lambda: conn, poolclass=NullPool)
    HiveEngineSpec.register_engine_events(engine)
    transport_tests._interrupt_replies(
        conn._client._iprot, [("ExecuteStatement", timeout)]
    )

    def run() -> None:
        """Exercise the raw-connection ping, without calling spec.execute()."""
        with closing(engine.raw_connection()) as raw:
            engine.dialect.do_ping(raw)

    try:
        with pytest.raises(type(timeout)) as raised:
            run()
    finally:
        engine.dispose()
    assert raised.value is timeout
    assert handler.requests[-1] == "ExecuteStatement", handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
def test_limit_between_rpcs_preserves_session_cleanup(
    timeout: Exception, hive_connection: tuple[Any, Any]
) -> None:
    """A clean transport must still send CloseOperation and CloseSession."""
    handler, conn = hive_connection
    HiveEngineSpec.prepare_connection(conn)
    cursor = conn.cursor()
    cursor.execute("SELECT 1", async_=True)
    with pytest.raises(type(timeout)) as raised, closing(cursor):
        with HiveEngineSpec.cursor_context(cursor):
            raise timeout
    conn.close()

    assert raised.value is timeout
    assert handler.requests[-2:] == ["CloseOperation", "CloseSession"]
    assert not conn._client.interrupted


@pytest.mark.parametrize("mode", ["NOSASL", "NONE", "HTTP"])
@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "abandonment",
    [
        "poll",
        "rows",
        "execute",
        "cleanup",
        "direct_guard",
        "local_cursor",
        "local_connection",
    ],
)
def test_hive_pool_replaces_abandoned_connections(
    mode: str, timeout: Exception, abandonment: str, app_context: None
) -> None:
    """A pooled PyHive connection must not retain an unusable client or transport."""
    from sqlalchemy import create_engine
    from sqlalchemy.pool import QueuePool

    connections: list[Any] = []
    handlers: list[Any] = []
    with ExitStack() as stack:

        def connect() -> Any:
            """Create a replacement against a local HS2 server when requested."""
            handler, connection = stack.enter_context(hive_connection_for_mode(mode))
            handlers.append(handler)
            connections.append(connection)
            return connection

        engine = create_engine(
            "hive://", creator=connect, poolclass=QueuePool, pool_size=1, max_overflow=0
        )
        HiveEngineSpec.register_engine_events(engine)
        try:
            with closing(engine.raw_connection()) as raw:
                cursor = raw.cursor()
                cursor.execute("SELECT 1", async_=True)

                def abandon() -> None:
                    """Cover generated RPC interruptions and local abandonment."""
                    if abandonment == "direct_guard":
                        connections[0]._client.abandon(timeout)
                    elif abandonment == "local_cursor":
                        HiveEngineSpec._abandon_cursor(cursor)
                    elif abandonment == "local_connection":
                        HiveEngineSpec._abandon_connection(connections[0])
                    else:
                        reply = {
                            "poll": "GetOperationStatus",
                            "rows": "FetchResults",
                            "execute": "ExecuteStatement",
                            "cleanup": "CloseOperation",
                        }[abandonment]
                        transport_tests._interrupt_replies(
                            connections[0]._client._iprot, [(reply, timeout)]
                        )
                        if abandonment == "poll":
                            cursor.poll()
                        elif abandonment == "rows":
                            handlers[
                                0
                            ].state = (
                                transport_tests.ttypes.TOperationState.FINISHED_STATE
                            )
                            HiveEngineSpec.fetch_data(cursor)
                        elif abandonment == "execute":
                            cursor.execute("SELECT interrupted", async_=True)
                        else:
                            cursor.close()
                    raise timeout

                with pytest.raises(type(timeout)) as raised:
                    abandon()
                assert raised.value is timeout
                requests_after_limit = list(handlers[0].requests)

            with closing(engine.raw_connection()) as raw:
                assert raw.driver_connection is not connections[0]
                with closing(raw.cursor()) as cursor:
                    cursor.execute("SELECT 2", async_=True)

            assert len(connections) == 2
            assert handlers[0].requests == requests_after_limit
            assert "ExecuteStatement" in handlers[1].requests
        finally:
            engine.dispose()


def test_pool_reuses_healthy_hive_connections(hive_connection: tuple[Any, Any]) -> None:
    """Healthy PyHive sessions remain reusable rather than disabling pooling."""
    from sqlalchemy import create_engine
    from sqlalchemy.pool import QueuePool

    handler, conn = hive_connection
    creator = Mock(return_value=conn)
    engine = create_engine(
        "hive://", creator=creator, poolclass=QueuePool, pool_size=1, max_overflow=0
    )
    HiveEngineSpec.register_engine_events(engine)
    try:
        for _ in range(2):
            with (
                closing(engine.raw_connection()) as raw,
                closing(raw.cursor()) as cursor,
            ):
                cursor.execute("SELECT 1", async_=True)
        creator.assert_called_once_with()
        assert (
            sum(
                method == "ExecuteStatement" and req.statement == "SELECT 1"
                for method, _, req in handler.calls
            )
            == 2
        )
    finally:
        engine.dispose()
