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

import logging
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

from superset.db_engine_specs.impala import ImpalaEngineSpec as spec  # noqa: N813
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetTimeoutException

hs2 = pytest.importorskip("impala.hiveserver2")
ttypes = pytest.importorskip("impala._thrift_gen.TCLIService.ttypes")
TCLIService = pytest.importorskip("impala._thrift_gen.TCLIService.TCLIService")
TSocketModule = pytest.importorskip("thrift.transport.TSocket")
TTransportModule = pytest.importorskip("thrift.transport.TTransport")
TBinaryProtocol = pytest.importorskip("thrift.protocol.TBinaryProtocol")
THttpServer = pytest.importorskip("thrift.server.THttpServer")

OK = ttypes.TStatus(statusCode=ttypes.TStatusCode.SUCCESS_STATUS)
OPERATION_GUID = b"superset-op-guid"


@dataclass
class FakeHiveServer2:
    """The HiveServer2 RPCs impyla issues for one SQL Lab query."""

    state: int = ttypes.TOperationState.RUNNING_STATE
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
            hasMoreRows=False,
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
        return ttypes.TCancelOperationResp(status=OK)

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
        listener.close()


def _interrupt_after_header(cursor: Any, reply: str, timeout: Exception) -> None:
    """Raise ``timeout`` once the header of the first ``reply`` has been read."""
    protocol = cursor.session.service.client._iprot
    read_message_begin = protocol.readMessageBegin
    armed = [True]

    def interrupted_read_message_begin() -> Any:
        header = read_message_begin()
        if armed[0] and header[0] == reply:
            armed[0] = False
            raise timeout
        return header

    protocol.readMessageBegin = interrupted_read_message_begin


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


def _assert_cancelled_cleanly(
    mode: str,
    handler: FakeHiveServer2,
    interrupted: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    methods = [method for method, _, _ in handler.calls]
    # A cancel that read leftover bytes as its reply blocks until the socket
    # timeout, after which impyla sends it again on a reopened transport.
    assert methods.count("CancelOperation") == 1, methods
    cancel_index = methods.index("CancelOperation")
    _, cancel_connection, cancel = handler.calls[cancel_index]
    assert cancel.operationHandle.operationId.guid == OPERATION_GUID
    assert "CloseOperation" in methods[cancel_index:], methods
    interrupted_connection = max(
        connection
        for method, connection, _ in handler.calls[:cancel_index]
        if method == interrupted
    )
    if mode != "http":
        # The interrupted reply's connection is dropped, not reused.
        assert cancel_connection > interrupted_connection
    # Every cancellation RPC read its own reply.
    failures = [
        record.getMessage()
        for record in caplog.records
        if record.name == "superset.db_engine_specs.impala"
        and record.levelno >= logging.WARNING
    ]
    assert failures == []


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
def test_handle_cursor_cancels_on_a_clean_transport_after_interrupted_reply(
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
    _assert_cancelled_cleanly(mode, handler, interrupted, caplog)


@pytest.mark.parametrize("timeout", TIMEOUTS)
@pytest.mark.parametrize(
    "interrupted, state",
    [
        ("GetOperationStatus", ttypes.TOperationState.RUNNING_STATE),
        ("FetchResults", ttypes.TOperationState.FINISHED_STATE),
    ],
    ids=["status", "rows"],
)
def test_fetch_data_cancels_on_a_clean_transport_after_interrupted_reply(
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
    _assert_cancelled_cleanly(mode, handler, interrupted, caplog)


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


def test_reset_transport_refuses_an_unknown_transport() -> None:
    """An unrecognised buffering layer is left untouched and reported unclean."""
    cursor = Mock()
    transport = cursor.session.service.client._iprot.trans

    assert spec._reset_transport(cursor) is False
    transport.close.assert_not_called()
    transport.open.assert_not_called()
