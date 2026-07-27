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
Streaming XLSX writer for multi-sheet dashboard exports.

Unlike :mod:`superset.utils.excel`, which builds an in-memory DataFrame per
sheet and hands the whole thing to ``xlsxwriter`` at once, this writer opens the
workbook in ``constant_memory`` mode and writes rows one at a time, so
``xlsxwriter`` keeps at most one row per sheet buffered on the writer side. The
source records may still be materialized upstream (e.g. by the chart query
response); this bounds only the writer's own footprint, not the caller's.
"""

from __future__ import annotations

import math
import numbers
import re
from collections.abc import Iterable, Sequence
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from typing import Any

import xlsxwriter

from superset.utils.excel import FORMULA_PREFIXES, NEUTRAL_DOCUMENT_PROPERTIES

# Excel limits a sheet name to 31 characters and forbids these characters.
MAX_SHEET_NAME_LEN = 31
_INVALID_SHEET_CHARS_RE = re.compile(r"[\[\]:*?/\\]")
# Excel reserves the sheet name "History" (case-insensitive).
_RESERVED_SHEET_NAME = "history"

# A worksheet holds at most 1,048,576 rows; one is reserved for the header.
MAX_DATA_ROWS_PER_SHEET = 1_048_576 - 1

# Excel cannot represent integers beyond 10**15 without precision loss.
_MAX_EXCEL_INT = 10**15


def _quote_if_formula(text: str) -> str:
    """
    Prefix formula-like text with an apostrophe so spreadsheet apps treat it as
    literal text (defense against formula injection).

    Leading whitespace is ignored when detecting a formula, because spreadsheet
    apps still evaluate a cell whose formula prefix is preceded by spaces or
    tabs (e.g. ``" =cmd"`` or ``"\\t=cmd"``).
    """
    stripped = text.lstrip()
    return f"'{text}" if stripped and stripped[0] in FORMULA_PREFIXES else text


def _coerce_float_cell(value: Any) -> Any:
    """
    Convert a ``Decimal``/real value to something ``xlsxwriter`` accepts.

    ``float()`` on a non-finite ``Decimal`` ("NaN"/"Infinity") yields a value
    xlsxwriter rejects, and an over-large value can raise ``OverflowError``;
    blank the former and stringify the latter, and stringify magnitudes Excel
    cannot represent precisely.
    """
    try:
        number = float(value)
    except (OverflowError, ValueError):
        return str(value)
    if not math.isfinite(number):
        return ""
    return str(number) if abs(number) > _MAX_EXCEL_INT else number


def sanitize_sheet_name(raw: str, used: set[str]) -> str:
    """
    Produce a valid, unique Excel sheet name from ``raw``.

    Replaces forbidden characters, strips surrounding apostrophes/whitespace,
    avoids the reserved name "History", truncates to 31 characters, and
    disambiguates case-insensitive collisions with ``~2``/``~3`` suffixes.
    The chosen name (lower-cased) is added to ``used``.

    :param raw: The desired sheet name (e.g. ``"42 - Sales by Region"``)
    :param used: Lower-cased names already taken; mutated with the result
    :returns: A sanitized, unique sheet name no longer than 31 characters
    """
    name = _INVALID_SHEET_CHARS_RE.sub("_", raw or "")
    name = name.strip().strip("'").strip()
    if not name:
        name = "Sheet"
    if name.lower() == _RESERVED_SHEET_NAME:
        name = f"{name}_"
    name = name[:MAX_SHEET_NAME_LEN]

    if name.lower() not in used:
        used.add(name.lower())
        return name

    suffix = 2
    while True:
        marker = f"~{suffix}"
        candidate = name[: MAX_SHEET_NAME_LEN - len(marker)] + marker
        if candidate.lower() not in used:
            used.add(candidate.lower())
            return candidate
        suffix += 1


def _sanitize_cell(value: Any) -> Any:
    """
    Coerce a single cell value into something safe for ``xlsxwriter``.

    Quotes formula-like strings (defense against formula injection), stringifies
    integers/floats Excel cannot represent precisely, renders temporal values as
    ISO strings (timezones are not natively supported), and blanks out ``None``
    and non-finite floats.
    """
    if value is None:
        return ""
    # bool is a subclass of int; preserve it before the numeric branches.
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return _quote_if_formula(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return _coerce_float_cell(value)
    if isinstance(value, numbers.Integral):
        number = int(value)
        return str(number) if abs(number) > _MAX_EXCEL_INT else number
    if isinstance(value, numbers.Real):
        return _coerce_float_cell(value)
    # Anything else (lists, dicts, custom objects) is stringified, still guarding
    # against formula injection on the resulting text.
    return _quote_if_formula(str(value))


class StreamingXlsxWriter:
    """
    A thin wrapper over ``xlsxwriter`` in constant-memory mode that writes one
    sheet per chart, row by row.

    Sheet names are sanitized and de-duplicated, cell values are sanitized for
    safety/compatibility, and per-sheet row counts are capped at Excel's limit.
    Always call :meth:`close` (e.g. in a ``finally`` block) to finalize the file.
    """

    def __init__(self, path: str) -> None:
        self._workbook = xlsxwriter.Workbook(path, {"constant_memory": True})
        # Reset document properties so the file carries no identifying details.
        self._workbook.set_properties(NEUTRAL_DOCUMENT_PROPERTIES)
        self._used_sheet_names: set[str] = set()
        self.sheet_count = 0

    def add_sheet(
        self,
        name: str,
        columns: Sequence[Any],
        rows: Iterable[Sequence[Any]],
    ) -> int:
        """
        Write a header row followed by data rows into a new sheet.

        :param name: Desired sheet name (sanitized/de-duplicated automatically)
        :param columns: Column headers
        :param rows: Iterable of row sequences, streamed one at a time
        :returns: The number of data rows actually written (capped just below
            Excel's per-sheet limit; when the data is larger a final notice row
            is appended and the dropped rows are not counted)
        """
        sheet_name = sanitize_sheet_name(name, self._used_sheet_names)
        worksheet = self._workbook.add_worksheet(sheet_name)
        worksheet.write_row(0, 0, [_sanitize_cell(col) for col in columns])

        # Reserve the final row for a truncation notice, so when the data
        # exceeds the sheet's capacity the user can see rows were dropped
        # instead of silently losing them.
        row_cap = MAX_DATA_ROWS_PER_SHEET - 1
        written = 0
        truncated = False
        for row in rows:
            if written >= row_cap:
                truncated = True
                break
            worksheet.write_row(written + 1, 0, [_sanitize_cell(cell) for cell in row])
            written += 1

        if truncated:
            worksheet.write_string(
                written + 1,
                0,
                f"[Truncated: only first {written:,} rows exported]",
            )

        self.sheet_count += 1
        return written

    def add_image_sheet(self, name: str, image_bytes: bytes) -> None:
        """
        Write a single sheet holding a rendered chart image.

        The image is embedded top-left; ``xlsxwriter`` buffers image data and
        writes it at :meth:`close`, so this composes with ``constant_memory``
        mode just like the row-streaming sheets.

        :param name: Desired sheet name (sanitized/de-duplicated automatically)
        :param image_bytes: PNG bytes to embed
        """
        sheet_name = sanitize_sheet_name(name, self._used_sheet_names)
        worksheet = self._workbook.add_worksheet(sheet_name)
        worksheet.insert_image(
            0,
            0,
            f"{sheet_name}.png",
            {"image_data": BytesIO(image_bytes)},
        )
        self.sheet_count += 1

    def add_summary_sheet(self, name: str, lines: Sequence[str]) -> None:
        """
        Write a single-column informational sheet (e.g. a list of skipped charts).

        Lines are written as string cells, so formula-like text is never executed.
        """
        sheet_name = sanitize_sheet_name(name, self._used_sheet_names)
        worksheet = self._workbook.add_worksheet(sheet_name)
        for index, line in enumerate(lines):
            worksheet.write_string(index, 0, str(line))
        self.sheet_count += 1

    def close(self) -> None:
        """Finalize and write the workbook to disk."""
        if self.sheet_count == 0:
            # Excel requires at least one worksheet for a valid file.
            self._workbook.add_worksheet("Export")
        self._workbook.close()
