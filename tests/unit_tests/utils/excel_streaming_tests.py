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
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from superset.utils import excel_streaming
from superset.utils.excel_streaming import (
    _sanitize_cell,
    sanitize_sheet_name,
    StreamingXlsxWriter,
)

# --- sanitize_sheet_name ---


def test_sheet_name_replaces_forbidden_chars() -> None:
    assert sanitize_sheet_name("a/b:c*d?e[f]g\\h", set()) == "a_b_c_d_e_f_g_h"


def test_sheet_name_truncated_to_31() -> None:
    assert sanitize_sheet_name("x" * 40, set()) == "x" * 31


def test_sheet_name_dedupes_case_insensitively() -> None:
    used: set[str] = set()
    assert sanitize_sheet_name("Sales", used) == "Sales"
    assert sanitize_sheet_name("sales", used) == "sales~2"
    assert sanitize_sheet_name("SALES", used) == "SALES~3"


def test_sheet_name_dedupe_marker_respects_length_cap() -> None:
    used: set[str] = set()
    long_name = "y" * 31
    assert sanitize_sheet_name(long_name, used) == long_name
    assert sanitize_sheet_name(long_name, used) == "y" * 29 + "~2"


def test_sheet_name_blank_falls_back() -> None:
    assert sanitize_sheet_name("   ", set()) == "Sheet"


def test_sheet_name_reserved_history_is_escaped() -> None:
    assert sanitize_sheet_name("History", set()) == "History_"


def test_sheet_name_strips_surrounding_apostrophes() -> None:
    assert sanitize_sheet_name("'quoted'", set()) == "quoted"


# --- _sanitize_cell ---


@pytest.mark.parametrize(
    "value,expected",
    [
        (None, ""),
        ("=SUM(A1)", "'=SUM(A1)"),
        ("+1", "'+1"),
        ("-1", "'-1"),
        ("@handle", "'@handle"),
        ("normal", "normal"),
        (True, True),
        (5, 5),
        (1.5, 1.5),
        (Decimal("2.5"), 2.5),
        (datetime(2020, 1, 2, 3, 4, 5), "2020-01-02T03:04:05"),
        (date(2020, 1, 2), "2020-01-02"),
    ],
)
def test_sanitize_cell(value: object, expected: object) -> None:
    assert _sanitize_cell(value) == expected


def test_sanitize_cell_large_int_becomes_string() -> None:
    assert _sanitize_cell(10**16) == str(10**16)


def test_sanitize_cell_non_finite_floats_blanked() -> None:
    assert _sanitize_cell(float("nan")) == ""
    assert _sanitize_cell(float("inf")) == ""


# --- StreamingXlsxWriter (round-trip via openpyxl) ---


def _read_workbook(path: str) -> dict[str, list[list[object]]]:
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.load_workbook(path, read_only=True)
    sheets = {
        ws.title: [list(row) for row in ws.iter_rows(values_only=True)]
        for ws in workbook.worksheets
    }
    workbook.close()
    return sheets


def test_writer_writes_one_sheet_per_chart(tmp_path: Path) -> None:
    path = str(tmp_path / "out.xlsx")
    writer = StreamingXlsxWriter(path)
    assert writer.add_sheet("10 - First", ["a", "b"], [[1, 2], [3, 4]]) == 2
    assert writer.add_sheet("20 - Second", ["c"], [["x"]]) == 1
    writer.close()

    sheets = _read_workbook(path)
    assert list(sheets.keys()) == ["10 - First", "20 - Second"]
    assert sheets["10 - First"] == [["a", "b"], [1, 2], [3, 4]]
    assert sheets["20 - Second"] == [["c"], ["x"]]


def test_writer_quotes_formula_cells(tmp_path: Path) -> None:
    path = str(tmp_path / "out.xlsx")
    writer = StreamingXlsxWriter(path)
    writer.add_sheet("data", ["col"], [["=cmd()"]])
    writer.close()

    sheets = _read_workbook(path)
    assert sheets["data"][1][0] == "'=cmd()"


def test_writer_caps_rows_per_sheet(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(excel_streaming, "MAX_DATA_ROWS_PER_SHEET", 2)
    path = str(tmp_path / "out.xlsx")
    writer = StreamingXlsxWriter(path)
    written = writer.add_sheet("data", ["col"], [[i] for i in range(5)])
    writer.close()

    assert written == 2
    sheets = _read_workbook(path)
    # header + 2 data rows
    assert len(sheets["data"]) == 3


def test_writer_empty_workbook_is_valid(tmp_path: Path) -> None:
    path = str(tmp_path / "out.xlsx")
    writer = StreamingXlsxWriter(path)
    writer.close()

    sheets = _read_workbook(path)
    assert list(sheets.keys()) == ["Export"]


def test_writer_summary_sheet(tmp_path: Path) -> None:
    path = str(tmp_path / "out.xlsx")
    writer = StreamingXlsxWriter(path)
    writer.add_summary_sheet("Export Summary", ["Skipped charts:", "10 - Broken"])
    writer.close()

    sheets = _read_workbook(path)
    assert sheets["Export Summary"] == [["Skipped charts:"], ["10 - Broken"]]
