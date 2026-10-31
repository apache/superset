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
Time-limit cancellation over real impyla Thrift transports.

A local HiveServer2 stand-in serves impyla's binary, SASL PLAIN and HTTP
transports. The time limit is raised right after a reply header is read, as a
signal landing at that point would, so the rest of the reply is left in the
client's buffers.
"""

from __future__ import annotations

import signal
import socket
import struct
import threading
from collections.abc import Iterator
from contextlib import closing
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import Mock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded

from superset.constants import QUERY_EARLY_CANCEL_KEY
from superset.db_engine_specs.impala import ImpalaEngineSpec as spec  # noqa: N813
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetTimeoutException
from superset.sql.execution.executor import _LimitedCursor

hs2 = pytest.importorskip("impala.hiveserver2")
ttypes = pytest.importorskip("impala._thrift_gen.TCLIService.ttypes")
TCLIService = pytest.importorskip("impala._thrift_gen.TCLIService.TCLIService")
TSocketModule = pytest.importorskip("thrift.transport.TSocket")
TTransportModule = pytest.importorskip("thrift.transport.TTransport")
TBinaryProtocol = pytest.importorskip("thrift.protocol.TBinaryProtocol")
TProtocol = pytest.importorskip("thrift.protocol.TProtocol")
THttpServer = pytest.importorskip("thrift.server.THttpServer")

OK = ttypes.TStatus(statusCode=ttypes.TStatusCode.SUCCESS_STATUS)
OPERATION_GUID = b"superset-op-guid"


@dataclass
class FakeHiveServer2:
    """The HiveServer2 RPCs impyla issues for one SQL Lab query."""

    state: int = ttypes.TOperationState.RUNNING_STATE
    has_more_rows: bool = False
    cancel_status: Any = field(default_factory=lambda: OK)
    calls: list[tuple[str, int, Any]] = field(default_factory=list)
    # Every request received, including methods this stand-in does not serve.
    requests: list[str] = field(default_factory=list)
    connection: int = 0

    def _record(self, method: str, req: Any) -> None:
        self.calls.append((method, self.connection, req))

    def OpenSession(self, req: Any) -> Any:  # noqa: N802
        self._record("OpenSession", req)
        return ttypes.TOpenSessionResp(
            status=OK,
            serverProtocolVersion=ttypes.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V6,
            sessionHandle=ttypes.TSessionHandle(
                sessionId=ttypes.THandleIdentifier(guid=b"s" * 16, secret=b"s" * 16)
            ),
            configuration={},
        )

    def ExecuteStatement(self, req: Any) -> Any:  # noqa: N802
        self._record("ExecuteStatement", req)
        return ttypes.TExecuteStatementResp(
            status=OK,
            operationHandle=ttypes.TOperationHandle(
                operationId=ttypes.THandleIdentifier(
                    guid=OPERATION_GUID, secret=b"o" * 16
                ),
                operationType=ttypes.TOperationType.EXECUTE_STATEMENT,
                hasResultSet=True,
            ),
        )

    def GetOperationStatus(self, req: Any) -> Any:  # noqa: N802
        self._record("GetOperationStatus", req)
        return ttypes.TGetOperationStatusResp(
            status=OK, operationState=self.state, hasResultSet=True
        )

    def GetLog(self, req: Any) -> Any:  # noqa: N802
        self._record("GetLog", req)
        # Longer than one 4 KiB transport buffer.
        return ttypes.TGetLogResp(status=OK, log="Query q: 5% Complete\n" * 1000)

    def GetResultSetMetadata(self, req: Any) -> Any:  # noqa: N802
        self._record("GetResultSetMetadata", req)
        string_type = ttypes.TTypeDesc(
            types=[
                ttypes.TTypeEntry(
                    primitiveEntry=ttypes.TPrimitiveTypeEntry(
                        type=ttypes.TTypeId.STRING_TYPE
                    )
                )
            ]
        )
        return ttypes.TGetResultSetMetadataResp(
            status=OK,
            schema=ttypes.TTableSchema(
                columns=[
                    ttypes.TColumnDesc(columnName="c", typeDesc=string_type, position=1)
                ]
            ),
        )

    def FetchResults(self, req: Any) -> Any:  # noqa: N802
        self._record("FetchResults", req)
        values = [b"row value " * 5] * 500
        return ttypes.TFetchResultsResp(
            status=OK,
            hasMoreRows=self.has_more_rows,
            results=ttypes.TRowSet(
                startRowOffset=0,
                rows=[],
                columns=[
                    ttypes.TColumn(
                        stringVal=ttypes.TStringColumn(
                            values=values, nulls=bytes(len(values) // 8 + 1)
                        )
                    )
                ],
            ),
        )

    def CancelOperation(self, req: Any) -> Any:  # noqa: N802
        self._record("CancelOperation", req)
        return ttypes.TCancelOperationResp(status=self.cancel_status)

    def CloseOperation(self, req: Any) -> Any:  # noqa: N802
        self._record("CloseOperation", req)
        return ttypes.TCloseOperationResp(status=OK)

    def CloseSession(self, req: Any) -> Any:  # noqa: N802
        self._record("CloseSession", req)
        return ttypes.TCloseSessionResp(status=OK)


def _recording_protocol(transport: Any, handler: FakeHiveServer2) -> Any:
    """Server-side protocol that records the name of every request."""
    protocol = TBinaryProtocol.TBinaryProtocol(transport)
    read_message_begin = protocol.readMessageBegin

    def recording_read_message_begin() -> Any:
        header = read_message_begin()
        handler.requests.append(header[0])
        return header

    protocol.readMessageBegin = recording_read_message_begin
    return protocol


class _RecordingProtocolFactory:
    def __init__(self, handler: FakeHiveServer2) -> None:
        self.handler = handler

    def getProtocol(self, transport: Any) -> Any:  # noqa: N802
        return _recording_protocol(transport, self.handler)


def _read_exactly(conn: socket.socket, size: int) -> bytes:
    data = b""
    while len(data) < size:
        chunk = conn.recv(size - len(data))
        if not chunk:
            raise EOFError
        data += chunk
    return data


def _sasl_plain_handshake(conn: socket.socket) -> None:
    """Accept thrift_sasl's PLAIN negotiation: START, OK, then COMPLETE."""
    for _ in range(2):
        _, length = struct.unpack(">BI", _read_exactly(conn, 5))
        _read_exactly(conn, length)
    conn.sendall(struct.pack(">BI", 5, 0))


def _serve_socket(
    handler: FakeHiveServer2, listener: socket.socket, sasl: bool
) -> None:
    processor = TCLIService.Processor(handler)
    while True:
        try:
            conn, _ = listener.accept()
        except OSError:
            return
        handler.connection += 1
        sock = TSocketModule.TSocket()
        sock.handle = conn
        try:
            if sasl:
                _sasl_plain_handshake(conn)
                # PLAIN without a security layer frames each message with
                # its length.
                transport = TTransportModule.TFramedTransport(sock)
            else:
                transport = TTransportModule.TBufferedTransport(sock)
            protocol = _recording_protocol(transport, handler)
            while True:
                processor.process(protocol, protocol)
        except Exception:  # noqa: S110  # pylint: disable=broad-except
            pass
        finally:
            conn.close()


@pytest.fixture(params=["binary", "sasl", "http"])
def hs2_connection(
    request: pytest.FixtureRequest,
) -> Iterator[tuple[str, FakeHiveServer2, Any]]:
    """An impyla connection to a local HiveServer2 over each transport."""
    from impala.dbapi import connect

    mode = request.param
    handler = FakeHiveServer2()
    if mode == "http":
        server = THttpServer.THttpServer(
            TCLIService.Processor(handler),
            ("127.0.0.1", 0),
            _RecordingProtocolFactory(handler),
        )
        server.httpd.timeout = 2
        port = server.httpd.server_address[1]
        thread = threading.Thread(target=server.serve, daemon=True)
        thread.start()
        conn = connect(
            "127.0.0.1",
            port,
            use_http_transport=True,
            http_path="cliservice",
            auth_mechanism="NOSASL",
        )
        # The HTTP transport ignores ``connect(timeout=...)``.
        conn.service.client._iprot.trans._TBufferedTransport__trans.setTimeout(2000)
        try:
            yield mode, handler, conn
        finally:
            server.httpd.shutdown()
            server.httpd.server_close()
        return

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    thread = threading.Thread(
        target=_serve_socket, args=(handler, listener, mode == "sasl"), daemon=True
    )
    thread.start()
    conn = connect(
        "127.0.0.1",
        listener.getsockname()[1],
        timeout=2,
        auth_mechanism="PLAIN" if mode == "sasl" else "NOSASL",
        user="user",
        password="password",  # noqa: S106
    )
    try:
        yield mode, handler, conn
    finally:
        conn.close()
        listener.shutdown(socket.SHUT_RDWR)
        listener.close()
        thread.join(timeout=2)


def _interrupt_replies(
    protocol: Any, interrupts: list[tuple[str, BaseException]]
) -> None:
    """
    Raise each exception once the header of the next matching reply is read.

    The interrupts fire in order, each on the first matching reply after the
    previous one fired.
    """
    read_message_begin = protocol.readMessageBegin
    pending = list(interrupts)

    def interrupted_read_message_begin() -> Any:
        header = read_message_begin()
        if pending and header[0] == pending[0][0]:
            raise pending.pop(0)[1]
        return header

    protocol.readMessageBegin = interrupted_read_message_begin


def _interrupt_after_header(cursor: Any, reply: str, timeout: BaseException) -> None:
    """Raise ``timeout`` once the header of the first ``reply`` has been read."""
    _interrupt_replies(cursor.session.service.client._iprot, [(reply, timeout)])


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


@pytest.fixture(autouse=True)
def reset_timeout_tracebacks(request: pytest.FixtureRequest) -> None:
    """Keep parametrized exception instances from retaining previous cases."""
    if (callspec := getattr(request.node, "callspec", None)) is not None:
        for value in callspec.params.values():
            if isinstance(value, BaseException):
                value.__traceback__ = None
                value.__cause__ = None
                value.__context__ = None


def _assert_abandoned(
    handler: FakeHiveServer2,
    interrupted: str,
) -> None:
    """The interrupted reply must be the last RPC, without reconnection."""
    assert handler.requests[-1] == interrupted, handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "interrupted, state",
    [
        ("GetOperationStatus", ttypes.TOperationState.RUNNING_STATE),
        ("GetLog", ttypes.TOperationState.RUNNING_STATE),
    ],
    ids=["status", "get_log"],
)
@patch("superset.db_engine_specs.impala.time.sleep")
def test_handle_cursor_abandons_after_interrupted_reply(
    sleep_mock: Mock,
    interrupted: str,
    state: int,
    timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Leftover reply bytes must not be read as the CancelOperation reply."""
    mode, handler, conn = hs2_connection
    handler.state = state
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    _interrupt_after_header(cursor, interrupted, timeout)
    query = Mock(id=1, extra={}, status="running", progress=0)

    with patch("superset.db_engine_specs.impala.db"):
        with pytest.raises(type(timeout)) as raised:
            spec.handle_cursor(cursor, query)

    assert raised.value is timeout
    _assert_abandoned(handler, interrupted)


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "interrupted, state",
    [
        ("GetOperationStatus", ttypes.TOperationState.RUNNING_STATE),
        ("FetchResults", ttypes.TOperationState.FINISHED_STATE),
    ],
    ids=["status", "rows"],
)
def test_fetch_data_abandons_after_interrupted_reply(
    interrupted: str,
    state: int,
    timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Leftover status or row bytes must not be read as the cancel reply."""
    mode, handler, conn = hs2_connection
    handler.state = state
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    _interrupt_after_header(cursor, interrupted, timeout)

    with pytest.raises(type(timeout)) as raised:
        spec.fetch_data(cursor)

    assert raised.value is timeout
    _assert_abandoned(handler, interrupted)


@pytest.mark.parametrize(
    "reset_failure",
    [{"return_value": False}, {"side_effect": OSError("transport close failed")}],
    ids=["unknown_transport", "reset_raises"],
)
@patch("superset.db_engine_specs.impala.time.sleep")
def test_closing_the_cursor_sends_nothing_after_a_skipped_cancel(
    sleep_mock: Mock,
    reset_failure: dict[str, Any],
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """
    Without a clean transport, cursor cleanup must not read leftover bytes.

    Callers close the cursor through ``closing()``; impyla's ``close()`` and
    finalizer would otherwise send CloseOperation and CloseSession on the
    transport holding the interrupted reply.
    """
    _, handler, conn = hs2_connection
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    _interrupt_after_header(cursor, "GetOperationStatus", SoftTimeLimitExceeded())
    query = Mock(id=1, extra={}, status="running", progress=0)

    with (
        patch.object(spec, "_reset_transport", **reset_failure),
        patch("superset.db_engine_specs.impala.db"),
    ):
        with pytest.raises(SoftTimeLimitExceeded):
            with closing(cursor):
                spec.handle_cursor(cursor, query)
    cursor.__del__()

    # The first status poll is the interrupted RPC.
    interrupted = handler.requests.index("GetOperationStatus")
    assert handler.requests[interrupted + 1 :] == []


RESET_FAILURES = [
    pytest.param({"return_value": False}, id="unknown_transport"),
    pytest.param({"side_effect": OSError("transport close failed")}, id="reset_raises"),
]


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize("reset_failure", RESET_FAILURES)
@pytest.mark.parametrize("read", ["rows", "truncation_probe"])
def test_row_limited_fetch_sends_nothing_after_a_skipped_cancel(
    read: str,
    timeout: Exception,
    reset_failure: dict[str, Any],
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """
    SQL Lab's row-limit wrapper must mark the driver's cursor abandoned.

    The executor closes the real cursor, not the wrapper, through
    ``closing()``; a closed flag left on the wrapper would let impyla send
    CloseOperation and CloseSession on the transport holding the interrupted
    reply.
    """
    _, handler, conn = hs2_connection
    handler.state = ttypes.TOperationState.FINISHED_STATE
    handler.has_more_rows = True
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    limited = _LimitedCursor(cursor, 500)

    with patch.object(spec, "_reset_transport", **reset_failure):
        with closing(cursor):
            if read == "rows":
                _interrupt_after_header(cursor, "FetchResults", timeout)
                with pytest.raises(type(timeout)) as raised:
                    spec.fetch_data(limited)
                assert raised.value is timeout
            else:
                # The first batch fills the budget, so the probe fetches again.
                assert len(spec.fetch_data(limited)) == 500
                _interrupt_after_header(cursor, "FetchResults", timeout)
                # A time limit must propagate, not become a partial result.
                with pytest.raises(type(timeout)) as raised:
                    limited.check_truncated(spec)
                assert raised.value is timeout
    cursor.__del__()

    assert cursor._closed is True
    assert cursor.description is None
    with pytest.raises(hs2.ProgrammingError, match="Operation state is not available"):
        cursor.get_log()
    interrupted = (
        len(handler.requests) - 1 - handler.requests[::-1].index("FetchResults")
    )
    assert handler.requests[interrupted + 1 :] == []


SECOND_TIMEOUTS = [
    pytest.param(SoftTimeLimitExceeded("cleanup"), id="async"),
    pytest.param(
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Timed out during cleanup",
            level=ErrorLevel.ERROR,
        ),
        id="sync",
    ),
]


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize("second_timeout", SECOND_TIMEOUTS)
@pytest.mark.parametrize(
    "cleanup_reply", ["CancelOperation", "CloseOperation", "CloseSession"]
)
@pytest.mark.parametrize(
    "entry, interrupted",
    [
        ("handle_cursor", "GetOperationStatus"),
        ("handle_cursor", "GetLog"),
        ("fetch_data", "FetchResults"),
    ],
)
@patch("superset.db_engine_specs.impala.time.sleep")
def test_time_limit_prevents_cleanup_rpcs_and_second_reply_timeout(
    sleep_mock: Mock,
    entry: str,
    interrupted: str,
    timeout: Exception,
    cleanup_reply: str,
    second_timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """
    A first limit prevents entering cleanup, including an armed second limit.

    Nothing may be sent after the first interrupted reply: not by cancellation,
    the caller's ``closing()``, nor the cursor's finalizer.
    """
    _, handler, conn = hs2_connection
    if entry == "fetch_data":
        handler.state = ttypes.TOperationState.FINISHED_STATE
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    _interrupt_replies(
        cursor.session.service.client._iprot,
        [
            (interrupted, timeout),
            (cleanup_reply, second_timeout),
        ],
    )
    query = Mock(id=1, extra={}, status="running", progress=0)

    def run() -> None:
        if entry == "fetch_data":
            spec.fetch_data(cursor)
        else:
            spec.handle_cursor(cursor, query)

    with patch("superset.db_engine_specs.impala.db"):
        with pytest.raises(type(timeout)) as raised, closing(cursor):
            run()
    cursor.__del__()

    assert raised.value is timeout
    assert cursor._closed is True
    assert handler.requests[-1] == interrupted, handler.requests


@pytest.mark.parametrize(
    "cleanup_reply", ["CancelOperation", "CloseOperation", "CloseSession"]
)
@patch("superset.db_engine_specs.impala.time.sleep")
def test_failed_stop_cleanup_rpc_abandons_the_cursor(
    sleep_mock: Mock,
    cleanup_reply: str,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """
    A cleanup RPC that fails partway through its reply ends the cleanup.

    Its unread rest must not be read as the next reply. Metadata reads after
    a Stop and further polls must not send RPCs for the abandoned operation.
    """
    _, handler, conn = hs2_connection
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    # A reply that cannot be parsed, as leftover bytes read as a header would
    # be, fails without impyla retrying the call.
    _interrupt_after_header(
        cursor, cleanup_reply, TProtocol.TProtocolException(message="bad reply")
    )
    query = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)

    with patch("superset.db_engine_specs.impala.db"):
        with closing(cursor):
            spec.handle_cursor(cursor, query)
    cursor.__del__()

    assert cursor._closed is True
    assert handler.requests[-1] == cleanup_reply, handler.requests
    assert cursor.description is None
    with pytest.raises(hs2.ProgrammingError, match="Operation state is not available"):
        cursor.status()
    assert handler.requests[-1] == cleanup_reply, handler.requests


@patch("superset.db_engine_specs.impala.time.sleep")
def test_rejected_cancel_still_releases_the_operation(
    sleep_mock: Mock,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An error status is a whole reply, so the handles are still released."""
    _, handler, conn = hs2_connection
    handler.cancel_status = ttypes.TStatus(
        statusCode=ttypes.TStatusCode.ERROR_STATUS, errorMessage="already done"
    )
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    query = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)

    with patch("superset.db_engine_specs.impala.db"):
        spec.handle_cursor(cursor, query)

    methods = [method for method, _, _ in handler.calls]
    assert methods[-3:] == ["CancelOperation", "CloseOperation", "CloseSession"]
    assert cursor._closed is True
    assert "cancel_operation() failed" in caplog.text


def test_reset_transport_refuses_an_unknown_transport() -> None:
    """An unrecognised buffering layer is left untouched and reported unclean."""
    cursor = Mock()
    transport = cursor.session.service.client._iprot.trans

    assert spec._reset_transport(cursor) is False
    transport.close.assert_not_called()
    transport.open.assert_not_called()


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize("interrupted", ["ExecuteStatement", "GetResultSetMetadata"])
def test_execute_and_metadata_abandon_before_driver_cleanup(
    interrupted: str,
    timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """Every RPC, including lazy metadata, disables all subsequent cleanup RPCs."""
    _, handler, conn = hs2_connection
    cursor = conn.cursor()
    if interrupted != "ExecuteStatement":
        spec.execute(cursor, "SELECT 1", None)  # type: ignore[arg-type]
    _interrupt_after_header(cursor, interrupted, timeout)

    def run() -> None:
        """Issue the driver call that will be interrupted."""
        if interrupted == "ExecuteStatement":
            spec.execute(cursor, "SELECT 1", None)  # type: ignore[arg-type]
        else:
            assert cursor.description

    with pytest.raises(type(timeout)) as raised, closing(cursor):
        run()
    cursor.__del__()
    conn.close()
    assert raised.value is timeout
    assert handler.requests[-1] == interrupted, handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "cleanup_reply", ["CancelOperation", "CloseOperation", "CloseSession"]
)
def test_cleanup_rpc_timeout_abandons_before_driver_handlers(
    cleanup_reply: str,
    timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """A limit inside any cleanup reply must precede driver-internal cleanup."""
    _, handler, conn = hs2_connection
    cursor = conn.cursor()
    cursor.execute_async("SELECT 1")
    _interrupt_after_header(cursor, cleanup_reply, timeout)
    query = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)
    with patch("superset.db_engine_specs.impala.db"):
        with pytest.raises(type(timeout)) as raised, closing(cursor):
            spec.handle_cursor(cursor, query)
    cursor.__del__()
    conn.close()
    assert raised.value is timeout
    assert handler.requests[-1] == cleanup_reply, handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "drop_failure", [OSError("drop failed"), SoftTimeLimitExceeded("drop")]
)
def test_second_limit_during_local_drop_preserves_execute_timeout(
    drop_failure: Exception,
    timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """Even a second limit during local cleanup must not replace the first."""
    _, handler, conn = hs2_connection
    cursor = conn.cursor()
    _interrupt_after_header(cursor, "ExecuteStatement", timeout)
    transport = cursor.session.service.client._iprot.trans
    close = transport.close
    attempts = 0

    def interrupted_close() -> None:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise drop_failure
        close()

    with patch.object(transport, "close", side_effect=interrupted_close):
        with pytest.raises(type(timeout)) as raised, closing(cursor):
            spec.execute(cursor, "SELECT 1", None)  # type: ignore[arg-type]
        cursor.__del__()
        conn.close()
    assert raised.value is timeout
    assert attempts >= 2
    assert handler.requests[-1] == "ExecuteStatement", handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
def test_connection_factory_guards_open_session_and_raw_cursor_calls(
    timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """The connection scope covers OpenSession before a cursor can be returned."""
    _, handler, conn = hs2_connection
    spec.prepare_connection(conn)
    _interrupt_replies(conn.service.client._iprot, [("OpenSession", timeout)])
    with pytest.raises(type(timeout)) as raised:
        conn.cursor()
    conn.close()
    assert raised.value is timeout
    assert handler.requests[-1] == "OpenSession", handler.requests


@pytest.mark.skipif(not hasattr(signal, "SIGALRM"), reason="SIGALRM is unavailable")
def test_sigalrm_timeout_is_preserved_during_execute(
    hs2_connection: tuple[str, FakeHiveServer2, Any], app_context: None
) -> None:
    """Exercise utils.timeout's actual signal handler while a reply is unread."""
    from superset.utils import core as utils

    _, handler, conn = hs2_connection
    cursor = conn.cursor()
    protocol = cursor.session.service.client._iprot
    read = protocol.readMessageBegin
    original: list[BaseException] = []

    def interrupted_read() -> Any:
        """Deliver SIGALRM after consuming the ExecuteStatement reply header."""
        header = read()
        if header[0] == "ExecuteStatement":
            try:
                signal.raise_signal(signal.SIGALRM)
            except SupersetTimeoutException as ex:
                original.append(ex)
                raise
        return header

    protocol.readMessageBegin = interrupted_read

    def run() -> None:
        """Close the real cursor after leaving the active timeout context."""
        with closing(cursor), utils.timeout(seconds=30):
            spec.execute(cursor, "SELECT 1", None)  # type: ignore[arg-type]

    with pytest.raises(SupersetTimeoutException) as raised:
        run()
    conn.close()
    cursor.__del__()
    assert raised.value is original[0]
    assert handler.requests[-1] == "ExecuteStatement", handler.requests


def test_timer_timeout_abandons_before_keyboard_interrupt_conversion(
    hs2_connection: tuple[str, FakeHiveServer2, Any], app_context: None
) -> None:
    """Windows converts KeyboardInterrupt only after inner cursor cleanup."""
    from superset.utils import core as utils

    _, handler, conn = hs2_connection
    cursor = conn.cursor()
    interrupt = KeyboardInterrupt()
    _interrupt_after_header(cursor, "ExecuteStatement", interrupt)

    def run() -> None:
        """Use the timer context without waiting for its background thread."""
        with utils.TimerTimeout(seconds=30), closing(cursor):
            spec.execute(cursor, "SELECT 1", None)  # type: ignore[arg-type]

    with pytest.raises(SupersetTimeoutException, match="Timeout"):
        run()
    conn.close()
    cursor.__del__()
    assert handler.requests[-1] == "ExecuteStatement", handler.requests


@pytest.mark.parametrize("timeout", TIMEOUTS)
def test_sqlalchemy_ping_abandons_before_dialect_cursor_cleanup(
    timeout: Exception,
    hs2_connection: tuple[str, FakeHiveServer2, Any],
    app_context: None,
) -> None:
    """Direct engine users get the guard before the dialect creates a cursor."""
    from sqlalchemy import create_engine
    from sqlalchemy.pool import NullPool

    _, handler, conn = hs2_connection
    engine = create_engine("impala://", creator=lambda: conn, poolclass=NullPool)
    spec.register_engine_events(engine)
    _interrupt_replies(conn.service.client._iprot, [("ExecuteStatement", timeout)])

    def run() -> None:
        """Exercise the same raw-connection ping used by connection validation."""
        with closing(engine.raw_connection()) as raw:
            engine.dialect.do_ping(raw)

    try:
        with pytest.raises(type(timeout)) as raised:
            run()
    finally:
        engine.dispose()
    assert raised.value is timeout
    assert handler.requests[-1] == "ExecuteStatement", handler.requests
