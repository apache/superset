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
Map Explore d3 number/time formats onto Excel cell formats after a workbook
has been written.

The export path keeps values numeric (JSON reports stringify them). This module
only changes how Excel *displays* those values so the sheet matches the chart.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Mapping

from openpyxl.reader.excel import load_workbook
from openpyxl.styles import Alignment

# Same grammar as ``superset.utils.number_format.D3_FORMAT_RE``.
D3_FORMAT_RE = re.compile(
    r"^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(?:\.(\d+))?(~)?([a-z%])?$",
    re.IGNORECASE,
)
SMART_NUMBER = "SMART_NUMBER"
SMART_NUMBER_SIGNED = "SMART_NUMBER_SIGNED"

ALLOWED_ALIGNMENTS = frozenset({"left", "center", "right"})

# strftime tokens used by Table/Pivot time format controls → Excel format codes.
_STRFTIME_TO_EXCEL: tuple[tuple[str, str], ...] = (
    ("%Y", "yyyy"),
    ("%y", "yy"),
    ("%m", "mm"),
    ("%d", "dd"),
    ("%H", "hh"),
    ("%I", "hh"),
    ("%M", "mm"),
    ("%S", "ss"),
    ("%p", "AM/PM"),
    ("%b", "mmm"),
    ("%B", "mmmm"),
)

_CURRENCY_EXCEL_SYMBOL = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "CNY": "¥",
    "INR": "₹",
    "RUB": "₽",
    "MXN": "MX$",
}


@dataclass(frozen=True)
class ExcelColumnDisplay:
    """Display options for one exported column, keyed by header text."""

    number_format: str | None = None
    alignment: str | None = None


def d3_number_to_excel(
    d3_format: str | None,
    currency: Mapping[str, Any] | None = None,
) -> str | None:
    """
    Translate a d3-format specifier into an Excel ``numFmt``.

    SMART_NUMBER / SI (``s``) have no Excel equivalent and return ``None`` so
    the cell stays General. Unknown specifiers also return ``None``.
    """
    if not d3_format or d3_format in {SMART_NUMBER, SMART_NUMBER_SIGNED}:
        return _currency_excel_format("#,##0.00", currency) if currency else None

    stripped = d3_format.replace("$", "")
    match = D3_FORMAT_RE.fullmatch(stripped)
    if not match:
        return None

    comma, precision, ntype = match.group(7), match.group(8), (match.group(10) or "f")
    ntype = ntype.lower()
    if ntype in {"s", "e"}:
        return None

    digits = int(precision) if precision is not None else (0 if ntype in {"d", "i"} else 2)
    decimals = "" if digits == 0 else "." + ("0" * digits)
    grouped = "#,##0" if comma else "0"
    body = f"{grouped}{decimals}"

    if ntype == "%":
        body = f"{body}%"

    sign = match.group(3)
    if sign == "+":
        body = f"+{body};-{body}"
    elif sign == "(":
        body = f"{body};({body})"

    return _currency_excel_format(body, currency)


def d3_time_to_excel(d3_time_format: str | None) -> str | None:
    """Translate a Python/d3 strftime string into an Excel date format."""
    if not d3_time_format:
        return None
    excel = d3_time_format
    for token, replacement in _STRFTIME_TO_EXCEL:
        excel = excel.replace(token, replacement)
    if "%" in excel:
        return None
    return excel or None


def _currency_excel_format(
    number_body: str, currency: Mapping[str, Any] | None
) -> str:
    if not currency:
        return number_body
    code = str(currency.get("symbol") or "")
    if not code or code == "AUTO":
        return number_body
    symbol = _CURRENCY_EXCEL_SYMBOL.get(code, code)
    quoted = f'"{symbol}"'
    if str(currency.get("symbolPosition") or "prefix").lower() == "suffix":
        return f"{number_body}{quoted}"
    return f"{quoted}{number_body}"


def styles_from_table_form_data(
    column_headers: list[Any],
    form_data: Mapping[str, Any],
) -> dict[str, ExcelColumnDisplay]:
    """Build header → display map from Table ``column_config``."""
    column_config = form_data.get("column_config") or {}
    if not isinstance(column_config, dict):
        return {}

    styles: dict[str, ExcelColumnDisplay] = {}
    header_set = {str(header) for header in column_headers}
    for name, config in column_config.items():
        if not isinstance(config, dict):
            continue
        header = str(name)
        if header not in header_set:
            continue
        alignment = config.get("horizontalAlign")
        alignment = (
            alignment.lower()
            if isinstance(alignment, str) and alignment.lower() in ALLOWED_ALIGNMENTS
            else None
        )
        currency = config.get("currencyFormat")
        currency = currency if isinstance(currency, dict) else None
        number_format = d3_number_to_excel(
            config.get("d3NumberFormat"), currency
        ) or d3_time_to_excel(config.get("d3TimeFormat"))
        if number_format or alignment:
            styles[header] = ExcelColumnDisplay(
                number_format=number_format, alignment=alignment
            )
    return styles


def styles_from_pivot_form_data(
    column_headers: list[Any],
    form_data: Mapping[str, Any],
) -> dict[str, ExcelColumnDisplay]:
    """
    Apply ``valueFormat`` / per-metric ``columnFormats`` to pivoted headers.

    Flattened export headers are ``" ".join(levels)``, so a metric name is
    matched when it is the header or appears as a suffix/prefix token.
    """
    value_format = form_data.get("valueFormat") or form_data.get("number_format")
    column_formats = form_data.get("columnFormats") or {}
    currency = form_data.get("currencyFormat") or form_data.get("currency_format")
    currency = currency if isinstance(currency, dict) else None

    styles: dict[str, ExcelColumnDisplay] = {}
    for header in column_headers:
        text = str(header)
        d3 = None
        if isinstance(column_formats, dict):
            for metric, fmt in column_formats.items():
                if metric and (text == metric or text.endswith(metric) or text.startswith(metric)):
                    d3 = fmt
                    break
        d3 = d3 or value_format
        excel_fmt = d3_number_to_excel(d3, currency)
        if excel_fmt:
            styles[text] = ExcelColumnDisplay(number_format=excel_fmt)
    return styles


_NUMERIC_CELL_TYPES = frozenset({"n", "f"})


def refresh_sheet_bounds(sheet: Any) -> None:
    """Drop a stale used-range so max_row/max_column match written cells."""
    reset = getattr(sheet, "reset_dimensions", None)
    if callable(reset):
        reset()
        return
    sheet._max_row = None  # noqa: SLF001
    sheet._max_column = None  # noqa: SLF001


def apply_column_display(
    workbook_bytes: bytes,
    styles_by_header: Mapping[str, ExcelColumnDisplay],
    header_rows: int = 1,
) -> bytes:
    """Stamp number formats and alignment onto data cells of the first sheet."""
    if not styles_by_header:
        return workbook_bytes

    workbook = load_workbook(io.BytesIO(workbook_bytes))
    sheet = workbook.active
    # xlsxwriter often omits a complete dimension; without this, only the
    # header row is visible to openpyxl and data cells stay unstyled.
    refresh_sheet_bounds(sheet)
    header_row = max(header_rows, 1)
    for col_idx in range(1, sheet.max_column + 1):
        header_label = ""
        for row in range(header_row, 0, -1):
            value = sheet.cell(row=row, column=col_idx).value
            if value not in (None, ""):
                header_label = str(value)
                break
        style = styles_by_header.get(header_label)
        if style is None:
            continue
        alignment = (
            Alignment(horizontal=style.alignment) if style.alignment else None
        )
        for row in range(header_row + 1, sheet.max_row + 1):
            cell = sheet.cell(row=row, column=col_idx)
            if style.number_format and (
                cell.data_type in _NUMERIC_CELL_TYPES
                or isinstance(cell.value, (int, float, datetime, date))
            ):
                cell.number_format = style.number_format
            if alignment is not None:
                cell.alignment = alignment

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()
