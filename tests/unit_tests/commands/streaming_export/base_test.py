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
"""Unit tests for the shared streaming CSV export helpers."""

import codecs
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.streaming_export.base import (
    BaseStreamingCSVExportCommand,
    encode_csv_stream,
)


def test_encode_csv_stream_writes_bom_once() -> None:
    """utf-8-sig writes a single BOM at the start, not one per chunk."""
    chunks = ["name;city\r\n", "Müller;Köln\r\n", "Weiß;Zürich\r\n"]

    data = b"".join(encode_csv_stream(chunks, "utf-8-sig"))

    assert data.startswith(codecs.BOM_UTF8)
    assert data.count(codecs.BOM_UTF8) == 1
    assert data == codecs.BOM_UTF8 + "".join(chunks).encode("utf-8")


def test_encode_csv_stream_skips_empty_chunks() -> None:
    """Empty chunks don't produce empty byte chunks in the response body."""
    encoded = list(encode_csv_stream(["", "a,b\r\n", ""], "utf-8"))

    assert encoded == [b"a,b\r\n"]


@pytest.mark.parametrize("encoding", ["utf-8", "latin-1", "cp1252", "utf-16"])
def test_encode_csv_stream_uses_configured_encoding(encoding: str) -> None:
    """The streamed bytes match encoding the whole file in one go."""
    chunks = ["name,city\r\n", "Müller,Köln\r\n"]

    data = b"".join(encode_csv_stream(chunks, encoding))

    assert data == "".join(chunks).encode(encoding)


class _FakeResultProxy:
    """A server-side cursor over a fixed set of rows."""

    def __init__(self, rows: list[tuple[int, ...]], columns: list[str]) -> None:
        self._rows = rows
        self._columns = columns
        self._position = 0

    def keys(self) -> list[str]:
        return self._columns

    def fetchmany(self, size: int) -> list[tuple[int, ...]]:
        batch = self._rows[self._position : self._position + size]
        self._position += len(batch)
        return batch


class _Command(BaseStreamingCSVExportCommand):
    """The smallest command the base class can drive."""

    def validate(self) -> None:
        pass

    def _get_sql_and_database(self) -> tuple[str, Any, str | None, str | None]:
        raise NotImplementedError()

    def _get_row_limit(self) -> int | None:
        return None


def _stream_rows(command: BaseStreamingCSVExportCommand, rows: int) -> list[str]:
    """Drive ``_execute_query_and_stream`` over a fake cursor.

    Everything between the command and the warehouse is mocked; what is under
    test is the bookkeeping the command does around the rows it reads.
    """
    proxy = _FakeResultProxy([(index,) for index in range(rows)], ["n"])
    database = MagicMock()
    connection = database.get_sqla_engine.return_value.__enter__.return_value
    connection = connection.connect.return_value.__enter__.return_value
    connection.execution_options.return_value.exec_driver_sql.return_value = proxy

    with patch("superset.commands.streaming_export.base.db"):
        return list(
            command._execute_query_and_stream(  # noqa: SLF001
                "SELECT n FROM t", database, None
            )
        )


@pytest.mark.parametrize("rows", [0, 1, 25])
def test_progress_callback_reports_the_row_count_it_wrote(rows: int) -> None:
    """The stream carries no row count, and a consumer that keeps the file
    needs one -- for the audit log, and to tell the requester what they got.
    It fires even for an empty result, so "no rows" is not read as "never
    ran"."""
    seen: list[tuple[int, int]] = []
    command = _Command(
        chunk_size=10, progress_callback=lambda r, b: seen.append((r, b))
    )

    _stream_rows(command, rows)

    assert seen
    assert seen[-1][0] == rows


def test_the_streamed_file_holds_every_row_with_no_limit() -> None:
    """A null row limit is what an uncapped export relies on: nothing after
    the SQL may bound the rows either."""
    command = _Command(chunk_size=10)

    chunks = _stream_rows(command, 25)

    body = "".join(chunks)
    assert body.splitlines()[0] == "n"
    assert len(body.splitlines()) == 26


def test_progress_callback_is_optional() -> None:
    """Every existing caller streams to a response and passes none."""
    command = _Command(chunk_size=10)

    assert command._progress_callback is None  # noqa: SLF001
    assert command._raise_on_error is False  # noqa: SLF001


def test_a_strict_consumer_gets_the_exception_not_an_error_marker() -> None:
    """Writing the ``__STREAM_ERROR__`` marker into a file would store a
    truncated export as a complete one."""
    command = _Command(raise_on_error=True)
    with (
        patch.object(
            _Command,
            "_get_sql_and_database",
            return_value=("SELECT 1", None, None, None),
        ),
        patch.object(
            _Command,
            "_execute_query_and_stream",
            side_effect=RuntimeError("the warehouse said no"),
        ),
    ):
        stream = command.run()
        with pytest.raises(RuntimeError, match="the warehouse said no"):
            list(stream())


def test_a_browser_consumer_still_gets_the_error_marker() -> None:
    """The frontend detects a failed stream by the marker, since the response
    headers are long gone by the time the query fails."""
    command = _Command()
    with (
        patch.object(
            _Command,
            "_get_sql_and_database",
            return_value=("SELECT 1", None, None, None),
        ),
        patch.object(
            _Command, "_execute_query_and_stream", side_effect=RuntimeError("boom")
        ),
    ):
        stream = command.run()
        assert "__STREAM_ERROR__" in "".join(stream())
