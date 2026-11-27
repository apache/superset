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
"""The file a full export is written as."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterator, Sequence
from unittest.mock import patch

import pytest
from flask import current_app

from superset.data_export.formats import (
    content_type,
    FORMAT_CSV,
    FORMAT_XLSX,
    resolve_format,
    XLSX_MIMETYPE,
)
from superset.data_export.sources import FullExportSource, KIND_CHART
from superset.exceptions import SupersetException
from superset.utils import excel_streaming


class _FakeCommand:
    """A streaming command with both shapes of output."""

    def __init__(
        self, columns: list[str], rows: list[list[Any]], chunks: list[str] | None = None
    ) -> None:
        self.columns = columns
        self.rows = rows
        self.chunks = chunks

    def run(self) -> Any:
        chunks = self.chunks if self.chunks is not None else []

        def stream() -> Iterator[str]:
            yield from chunks

        return stream

    def run_rows(self) -> Any:
        def stream() -> Iterator[Sequence[Any]]:
            if self.columns:
                yield self.columns
            yield from self.rows

        return stream


def _source(command: Any, label: str = "Sales by region") -> FullExportSource:
    return FullExportSource(kind=KIND_CHART, label=label, command=command)


def _read_workbook(path: str) -> dict[str, list[list[object]]]:
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.load_workbook(path, read_only=True)
    sheets = {
        sheet.title: [list(row) for row in sheet.iter_rows(values_only=True)]
        for sheet in workbook.worksheets
    }
    workbook.close()
    return sheets


def test_the_default_format_is_csv(app_context: None) -> None:
    assert resolve_format(None).name == FORMAT_CSV
    assert resolve_format(FORMAT_CSV).name == FORMAT_CSV


def test_excel_is_offered(app_context: None) -> None:
    assert resolve_format(FORMAT_XLSX).name == FORMAT_XLSX


def test_a_format_from_another_release_fails_loudly(app_context: None) -> None:
    """A job left in the broker must not be written as something the
    requester did not ask for."""
    with pytest.raises(SupersetException, match="Unknown full export format"):
        resolve_format("parquet")


def test_csv_is_served_with_its_configured_charset(app_context: None) -> None:
    with patch.dict(current_app.config, {"CSV_EXPORT": {"encoding": "utf-8-sig"}}):
        assert content_type(resolve_format(FORMAT_CSV)) == "text/csv; charset=utf-8-sig"


def test_excel_is_served_as_a_spreadsheet(app_context: None) -> None:
    assert content_type(resolve_format(FORMAT_XLSX)) == XLSX_MIMETYPE


def test_a_csv_export_writes_what_the_query_streamed(
    app_context: None, tmp_path: Path
) -> None:
    command = _FakeCommand(["n"], [], chunks=["n\r\n", "1\r\n", "2\r\n"])
    path = str(tmp_path / "out.csv")

    with patch.dict(current_app.config, {"CSV_EXPORT": {"encoding": "utf-8"}}):
        resolve_format(FORMAT_CSV).write(_source(command), path)

    assert Path(path).read_bytes() == b"n\r\n1\r\n2\r\n"


def test_an_excel_export_writes_the_rows_as_cells(
    app_context: None, tmp_path: Path
) -> None:
    """Not CSV text parsed back apart: the cells keep the types the query
    returned."""
    command = _FakeCommand(["n", "label"], [[1, "a"], [2, "b"]])
    path = str(tmp_path / "out.xlsx")

    resolve_format(FORMAT_XLSX).write(_source(command), path)

    assert _read_workbook(path) == {
        "Sales by region": [["n", "label"], [1, "a"], [2, "b"]]
    }


def test_an_excel_export_spills_past_a_worksheets_limit(
    app_context: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The reason xlsx is offered at all for an uncapped export: a result
    larger than one worksheet keeps every row instead of being cut off."""
    monkeypatch.setattr(excel_streaming, "MAX_DATA_ROWS_PER_SHEET", 2)
    command = _FakeCommand(["n"], [[index] for index in range(5)])
    path = str(tmp_path / "out.xlsx")

    resolve_format(FORMAT_XLSX).write(_source(command, label="Data"), path)

    sheets = _read_workbook(path)
    assert list(sheets) == ["Data", "Data~2", "Data~3"]
    assert [row for rows in sheets.values() for row in rows[1:]] == [
        [index] for index in range(5)
    ]


def test_an_excel_export_names_its_sheet_after_the_chart(
    app_context: None, tmp_path: Path
) -> None:
    """Sheet names are capped at 31 characters and forbid some punctuation, so
    a chart name goes through sanitizing rather than straight in."""
    command = _FakeCommand(["n"], [[1]])
    path = str(tmp_path / "out.xlsx")

    resolve_format(FORMAT_XLSX).write(
        _source(command, label="Revenue / cost: 2026 by region and segment"), path
    )

    (sheet_name,) = _read_workbook(path)
    assert sheet_name == "Revenue _ cost_ 2026 by region "


def test_an_excel_export_of_no_result_set_fails(
    app_context: None, tmp_path: Path
) -> None:
    """The row stream always yields a header first; nothing at all means the
    query produced no result set, which is not worth papering over with an
    empty workbook."""
    command = _FakeCommand([], [])
    path = str(tmp_path / "out.xlsx")

    with pytest.raises(SupersetException, match="no result set"):
        resolve_format(FORMAT_XLSX).write(_source(command), path)


def test_an_excel_export_of_an_empty_result_keeps_its_header(
    app_context: None, tmp_path: Path
) -> None:
    """ "No rows" is a legitimate answer, and the columns still say what was
    asked for."""
    command = _FakeCommand(["n", "label"], [])
    path = str(tmp_path / "out.xlsx")

    resolve_format(FORMAT_XLSX).write(_source(command), path)

    assert _read_workbook(path) == {"Sales by region": [["n", "label"]]}


def test_an_excel_export_streams_rather_than_buffering(
    app_context: None, tmp_path: Path
) -> None:
    """A worker's memory must not grow with the size of the result."""
    pulled = 0

    class _Counting(_FakeCommand):
        def run_rows(self) -> Any:
            def stream() -> Iterator[Sequence[Any]]:
                nonlocal pulled
                yield ["n"]
                for index in range(50):
                    pulled += 1
                    yield [index]

            return stream

    command = _Counting(["n"], [])
    path = str(tmp_path / "out.xlsx")
    assert pulled == 0

    resolve_format(FORMAT_XLSX).write(_source(command), path)

    assert pulled == 50


def test_the_format_table_covers_every_offered_name(app_context: None) -> None:
    """The request schemas validate against this table, so a format listed
    there has to be writable."""
    from superset.data_export.formats import FORMATS

    for name, export_format in FORMATS.items():
        assert export_format.name == name
        assert export_format.extension
        assert export_format.mimetype
        assert callable(export_format.write)
