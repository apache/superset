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
Unit tests for MCPTransportDisconnectFilter.

Tests verify that:
- streamable_http ERROR records carrying a ClientDisconnect exc_info are
  downgraded to WARNING
- streamable_http ERROR records carrying an unrelated exception stay at ERROR
- lowlevel.server ERROR records with the exact "Received exception from
  stream: " message are downgraded to WARNING
- lowlevel.server ERROR records with a different message stay at ERROR
- records below ERROR level pass through unchanged regardless of logger name
"""

import logging
from types import TracebackType

from starlette.requests import ClientDisconnect

from superset.mcp_service.server import MCPTransportDisconnectFilter

_SysExcInfo = (
    tuple[type[BaseException], BaseException, TracebackType | None]
    | tuple[None, None, None]
)


def _make_record(
    name: str,
    level: int,
    msg: str,
    exc_info: _SysExcInfo | None = None,
) -> logging.LogRecord:
    return logging.getLogger(name).makeRecord(
        name, level, "test_file.py", 1, msg, (), exc_info
    )


def _get_client_disconnect_exc_info() -> _SysExcInfo:
    try:
        raise ClientDisconnect()
    except ClientDisconnect:
        import sys

        return sys.exc_info()


def _get_value_error_exc_info() -> _SysExcInfo:
    try:
        raise ValueError("boom")
    except ValueError:
        import sys

        return sys.exc_info()


class TestMCPTransportDisconnectFilterStreamableHttp:
    """Tests for the mcp.server.streamable_http branch of the filter."""

    def test_client_disconnect_downgraded_to_warning(self) -> None:
        record = _make_record(
            "mcp.server.streamable_http",
            logging.ERROR,
            "Error handling POST request",
            exc_info=_get_client_disconnect_exc_info(),
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.WARNING
        assert record.levelname == "WARNING"

    def test_other_exception_stays_at_error(self) -> None:
        record = _make_record(
            "mcp.server.streamable_http",
            logging.ERROR,
            "Error handling POST request",
            exc_info=_get_value_error_exc_info(),
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.ERROR
        assert record.levelname == "ERROR"

    def test_no_exc_info_stays_at_error(self) -> None:
        record = _make_record(
            "mcp.server.streamable_http",
            logging.ERROR,
            "Error handling POST request",
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.ERROR


class TestMCPTransportDisconnectFilterLowlevelServer:
    """Tests for the mcp.server.lowlevel.server branch of the filter."""

    def test_empty_exception_message_downgraded_to_warning(self) -> None:
        record = _make_record(
            "mcp.server.lowlevel.server",
            logging.ERROR,
            "Received exception from stream: ",
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.WARNING
        assert record.levelname == "WARNING"

    def test_different_message_stays_at_error(self) -> None:
        record = _make_record(
            "mcp.server.lowlevel.server",
            logging.ERROR,
            "Received exception from stream: something else",
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.ERROR

    def test_unrelated_message_stays_at_error(self) -> None:
        record = _make_record(
            "mcp.server.lowlevel.server",
            logging.ERROR,
            "Some unrelated error",
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.ERROR


class TestMCPTransportDisconnectFilterPassthrough:
    """Records below ERROR level are always left unchanged."""

    def test_warning_level_passes_through_unchanged(self) -> None:
        record = _make_record(
            "mcp.server.lowlevel.server",
            logging.WARNING,
            "Received exception from stream: ",
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.WARNING

    def test_info_level_passes_through_unchanged(self) -> None:
        record = _make_record(
            "mcp.server.streamable_http",
            logging.INFO,
            "Error handling POST request",
            exc_info=_get_client_disconnect_exc_info(),
        )

        assert MCPTransportDisconnectFilter().filter(record) is True
        assert record.levelno == logging.INFO
