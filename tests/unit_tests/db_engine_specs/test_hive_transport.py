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
from contextlib import closing
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


@pytest.fixture(params=["NOSASL", "NONE"], ids=["binary", "sasl"])
def hive_connection(
    request: pytest.FixtureRequest,
) -> Iterator[tuple[Any, Any]]:
    """A pyhive connection to a local HiveServer2 over each transport."""
    from pyhive import hive

    handler = transport_tests.FakeHiveServer2()
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    thread = threading.Thread(
        target=transport_tests._serve_socket,
        args=(handler, listener, request.param == "NONE"),
        daemon=True,
    )
    thread.start()
    conn = hive.connect(
        "127.0.0.1", listener.getsockname()[1], auth=request.param, username="user"
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
    transport_tests._interrupt_replies(
        conn._client._iprot, [("GetOperationStatus", timeout)]
    )
    close = conn._transport.close
    attempts = 0

    def interrupted_close() -> None:
        nonlocal attempts
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
def test_execute_abandons_before_cursor_and_connection_cleanup(
    timeout: Exception,
    hive_connection: tuple[Any, Any],
    app_context: None,
) -> None:
    """An interrupted ExecuteStatement must not be followed by CloseSession."""
    handler, conn = hive_connection
    cursor = conn.cursor()
    transport_tests._interrupt_replies(
        conn._client._iprot, [("ExecuteStatement", timeout)]
    )
    with pytest.raises(type(timeout)) as raised, closing(cursor):
        HiveEngineSpec.execute(cursor, "SELECT 1", None, async_=True)  # type: ignore[arg-type]
    conn.close()
    assert raised.value is timeout
    assert handler.requests[-1] == "ExecuteStatement", handler.requests
