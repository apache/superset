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
Apply Table/Pivot Explore conditional formatting to an exported workbook.

Excel color-scale rules paint every cell in a range, including blanks and
labels. The chart only colors matching numeric cells, so this module fills
those cells directly instead of attaching a sheet-wide color scale.
"""

from __future__ import annotations

import io
from typing import Any, Mapping, Sequence

from openpyxl.reader.excel import load_workbook
from openpyxl.styles import Font, PatternFill

# Comparators from ``@superset-ui/chart-controls`` Comparator enum.
OP_GT = ">"
OP_LT = "<"
OP_GTE = "≥"
OP_LTE = "≤"
OP_EQ = "="
OP_NEQ = "≠"
OP_BETWEEN = "< x <"
OP_BETWEEN_EQ = "≤ x ≤"
OP_BETWEEN_LEFT = "≤ x <"
OP_BETWEEN_RIGHT = "< x ≤"
OP_NONE = "None"

_NAMED_COLORS = {
    "Green": (99, 190, 123),
    "Red": (248, 105, 107),
    "Yellow": (255, 235, 132),
}


def _rgb(color: Any) -> tuple[int, int, int] | None:
    if isinstance(color, dict) and {"r", "g", "b"} <= set(color):
        return int(color["r"]), int(color["g"]), int(color["b"])
    if isinstance(color, str) and color.startswith("#") and len(color) in {7, 9}:
        return int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
    if isinstance(color, str):
        return _NAMED_COLORS.get(color)
    return None


def _hex(rgb: tuple[int, int, int]) -> str:
    return f"{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"


def _blend(rgb: tuple[int, int, int], opacity: float) -> tuple[int, int, int]:
    opacity = min(1.0, max(0.0, opacity))
    red, green, blue = rgb
    return (
        int(red * opacity + 255 * (1 - opacity)),
        int(green * opacity + 255 * (1 - opacity)),
        int(blue * opacity + 255 * (1 - opacity)),
    )


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:  # NaN
        return None
    return number


def cell_matches_rule(value: float, rule: Mapping[str, Any]) -> bool:
    """Whether ``value`` satisfies a chart conditional-formatting comparator."""
    operator = rule.get("operator") or OP_NONE
    target = rule.get("targetValue")
    left = rule.get("targetValueLeft")
    right = rule.get("targetValueRight")
    if operator in {OP_NONE, None, ""}:
        return True
    if operator == OP_GT:
        return target is not None and value > target
    if operator == OP_LT:
        return target is not None and value < target
    if operator == OP_GTE:
        return target is not None and value >= target
    if operator == OP_LTE:
        return target is not None and value <= target
    if operator == OP_EQ:
        return target is not None and value == target
    if operator == OP_NEQ:
        return target is not None and value != target
    if left is None or right is None:
        return False
    if operator == OP_BETWEEN:
        return left < value < right
    if operator == OP_BETWEEN_EQ:
        return left <= value <= right
    if operator == OP_BETWEEN_LEFT:
        return left <= value < right
    if operator == OP_BETWEEN_RIGHT:
        return left < value <= right
    return False


def _fill_color(value: float, rule: Mapping[str, Any], column_values: Sequence[float]) -> str | None:
    rgb = _rgb(rule.get("colorScheme") or rule.get("highColor") or rule.get("lowColor"))
    if rgb is None:
        return None
    use_gradient = rule.get("useGradient")
    if use_gradient is False:
        return _hex(rgb)
    if not column_values:
        return _hex(rgb)
    lo, hi = min(column_values), max(column_values)
    span = hi - lo
    opacity = 1.0 if span == 0 else 0.15 + 0.85 * abs(value - lo) / span
    return _hex(_blend(rgb, opacity))


def apply_conditional_formatting(
    workbook_bytes: bytes,
    rules: Sequence[Mapping[str, Any]] | None,
    header_rows: int = 1,
) -> bytes:
    """Paint matching numeric cells on the first sheet."""
    if not rules:
        return workbook_bytes

    workbook = load_workbook(io.BytesIO(workbook_bytes))
    sheet = workbook.active
    header_row = max(header_rows, 1)
    headers: dict[int, str] = {}
    for col_idx in range(1, sheet.max_column + 1):
        for row in range(header_row, 0, -1):
            value = sheet.cell(row=row, column=col_idx).value
            if value not in (None, ""):
                headers[col_idx] = str(value)
                break

    for rule in rules:
        column_name = rule.get("column")
        if not column_name:
            continue
        columns = [
            col for col, header in headers.items()
            if header == column_name or header.endswith(str(column_name))
        ]
        for col_idx in columns:
            numeric_cells: list[tuple[Any, float]] = []
            for row in range(header_row + 1, sheet.max_row + 1):
                cell = sheet.cell(row=row, column=col_idx)
                number = _as_float(cell.value)
                if number is None:
                    continue
                if cell_matches_rule(number, rule):
                    numeric_cells.append((cell, number))
            matching_values = [number for _, number in numeric_cells]
            for cell, number in numeric_cells:
                color = _fill_color(number, rule, matching_values)
                if color is None:
                    continue
                if rule.get("toTextColor"):
                    cell.font = Font(color=color)
                else:
                    cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()
