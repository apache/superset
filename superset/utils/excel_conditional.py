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
"""Stamp Explore Table / Pivot Table v2 highlights onto an Excel workbook.

Explore paints matching cells in the browser. Chart XLSX download is written
in ``QueryContextProcessor.get_data`` before client post-processing, so this
module is applied there as well as on the reports path.

Rules from ``form_data["conditional_formatting"]`` become native Excel
conditional formatting (CellIs / formula / color scale / data bar).
``columnFormatting`` paints a different column (or the entire row) from
the column named in ``column``. When ``show_cell_bars`` is on, numeric
columns still get data bars so the download matches the Table chart's
default gradient; a rule on another column does not suppress them.
Per-column ``column_config.showCellBars`` overrides the global checkbox
the same way Explore does.
"""

from __future__ import annotations

import io
import operator
from datetime import date, datetime
from typing import Any, Mapping, Optional

import pandas as pd
from openpyxl import load_workbook
from openpyxl.formatting.rule import (
    CellIsRule,
    ColorScaleRule,
    DataBarRule,
    FormulaRule,
)
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.workbook import Workbook
from openpyxl.worksheet.worksheet import Worksheet

from superset.constants import SHOW_VALUES_AS_PERCENT_MODES
from superset.utils.excel_display import (
    apply_column_display,
    refresh_sheet_bounds,
    styles_from_pivot_form_data,
    styles_from_table_form_data,
)

# Theme tokens used by Table / Pivot Table v2 pickers, plus CSS names.
_NAMED_COLORS = {
    "success": "52C41A",
    "warning": "FAAD14",
    "error": "FF4D4F",
    "red": "FF4D4F",
    "green": "52C41A",
    "blue": "1890FF",
    "yellow": "FAAD14",
    "orange": "FA8C16",
    "purple": "722ED1",
    "cyan": "13C2C2",
    "colorsuccess": "52C41A",
    "colorwarning": "FAAD14",
    "colorerror": "FF4D4F",
    "colorsuccessbg": "F6FFED",
    "colorwarningbg": "FFFBE6",
    "colorerrorbg": "FFF2F0",
}

_CELL_IS_OPERATORS = {
    ">": "greaterThan",
    "<": "lessThan",
    ">=": "greaterThanOrEqual",
    "<=": "lessThanOrEqual",
    "=": "equal",
    "==": "equal",
    "!=": "notEqual",
    "≠": "notEqual",
    "≥": "greaterThanOrEqual",
    "≤": "lessThanOrEqual",
}

_RANGE_OPERATORS = {
    "< x <": (">", "<"),
    "< x ≤": (">", "<="),
    "≤ x <": (">=", "<"),
    "≤ x ≤": (">=", "<="),
}
_NUMERIC_COMPARE = {
    "greaterThan": operator.gt,
    "lessThan": operator.lt,
    "greaterThanOrEqual": operator.ge,
    "lessThanOrEqual": operator.le,
    "equal": operator.eq,
    "notEqual": operator.ne,
}

_DEFAULT_RULE_COLOR = _NAMED_COLORS["success"]
# Explore default bars use theme.colorFill; Color +/- uses colorSuccess.
# Excel data bars cannot carry alpha, so these are solid stand-ins.
_DATA_BAR_NEUTRAL = "BFBFBF"
_DATA_BAR_POSITIVE = _NAMED_COLORS["success"]
_SCALE_LOW = "FFFFFF"
_GREATER_OPERATORS = {">", ">=", "≥"}
_LESS_OPERATORS = {"<", "<=", "≤"}
_MIN_GRADIENT_OPACITY = 0.05
_OBJECT_CELL_BAR = "CELL_BAR"
_OBJECT_TEXT = "TEXT_COLOR"
_ENTIRE_ROW = "ENTIRE_ROW"
_FORMULA_COMPARE = {
    ">": ">",
    "<": "<",
    ">=": ">=",
    "<=": "<=",
    "=": "=",
    "==": "=",
    "!=": "<>",
    "≠": "<>",
    "≥": ">=",
    "≤": "<=",
}
# First non-blank cells used to decide whether a column is numeric for
# default ``show_cell_bars``. Scanning the whole sheet is unnecessary for
# typical Table downloads; blank leading rows still skip until a value.
_NUMERIC_SAMPLE_ROWS = 20


def _hex_rgb(color: Any) -> Optional[str]:
    """Normalize a picker payload to a 6-digit RGB hex string."""
    if isinstance(color, dict):
        hex_value = color.get("hex")
        if isinstance(hex_value, str):
            return _hex_rgb(hex_value)
        red, green, blue = color.get("r"), color.get("g"), color.get("b")
        if red is not None and green is not None and blue is not None:
            try:
                return f"{int(red):02X}{int(green):02X}{int(blue):02X}"
            except (TypeError, ValueError):
                return None
        return None
    if not isinstance(color, str) or not color:
        return None
    token = color.strip().lstrip("#")
    if named := _NAMED_COLORS.get(token.lower().replace("_", "").replace("-", "")):
        return named
    if len(token) == 3 and all(ch in "0123456789abcdefABCDEF" for ch in token):
        return "".join(ch * 2 for ch in token).upper()
    if len(token) >= 6 and all(ch in "0123456789abcdefABCDEF" for ch in token[:6]):
        return token[:6].upper()
    return None


def _rule_color(rule: dict[str, Any]) -> str:
    return _hex_rgb(rule.get("colorScheme")) or _DEFAULT_RULE_COLOR


def _as_number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", ""))
        except ValueError:
            return None
    return None


def _matches_cell_is(
    value: Any, number: Optional[float], operator_key: str, rule: dict[str, Any]
) -> bool:
    """Apply a CellIs comparator; fall back to string equality if not numeric."""
    target = rule.get("targetValue")
    target_number = _as_number(target)
    if number is not None and target_number is not None:
        compare = _NUMERIC_COMPARE.get(_CELL_IS_OPERATORS[operator_key])
        if compare is not None:
            return bool(compare(number, target_number))
    return str(value) == str(target)


def _matches_range(
    number: Optional[float], operator_key: str, rule: dict[str, Any]
) -> bool:
    """Apply a between-style Explore operator to a numeric cell."""
    left_op, right_op = _RANGE_OPERATORS[operator_key]
    left = _as_number(rule.get("targetValueLeft"))
    right = _as_number(rule.get("targetValueRight"))
    if number is None or left is None or right is None:
        return False
    left_ok = number >= left if left_op == ">=" else number > left
    right_ok = number <= right if right_op == "<=" else number < right
    return left_ok and right_ok


def _value_matches_rule(value: Any, rule: dict[str, Any]) -> bool:
    """Whether a cell should receive a CELL_BAR rule (Explore comparator)."""
    if value in (None, ""):
        return False
    operator_key = rule.get("operator")
    if operator_key in (None, "None", ""):
        return True
    number = _as_number(value)
    if operator_key in _CELL_IS_OPERATORS:
        return _matches_cell_is(value, number, operator_key, rule)
    if operator_key in _RANGE_OPERATORS:
        return _matches_range(number, operator_key, rule)
    return False


def _excel_literal(value: Any) -> str:
    """Quote a comparison target so Excel treats it as a constant."""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    text = str(value).replace('"', '""')
    return f'"{text}"'


def _header_matches(sheet_header: str, column: str) -> bool:
    """Match a rule column to a header, including Pivot ``SUM(col)`` titles."""
    left = sheet_header.strip()
    right = column.strip()
    if left == right or left.lower() == right.lower():
        return True
    return left.endswith(f"({right})") or left.endswith(f"({right.lower()})")


def _rule_column_aliases(
    column: str, verbose_map: Optional[Mapping[str, Any]]
) -> list[str]:
    """Raw and verbose names so rules still match after datasource rename."""
    aliases = [column]
    if not verbose_map:
        return aliases
    verbose = verbose_map.get(column)
    if verbose is not None and str(verbose) not in aliases:
        aliases.append(str(verbose))
    for raw, label in verbose_map.items():
        if str(label) == column and str(raw) not in aliases:
            aliases.append(str(raw))
    return aliases


def _header_at(sheet: Worksheet, header_row: int, col_idx: int) -> str:
    for row in range(header_row, 0, -1):
        value = sheet.cell(row=row, column=col_idx).value
        if value not in (None, ""):
            return str(value)
    return ""


def _column_index(
    sheet: Worksheet,
    header_row: int,
    column: str,
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> Optional[int]:
    aliases = _rule_column_aliases(column, verbose_map)
    for col_idx in range(1, sheet.max_column + 1):
        header_label = _header_at(sheet, header_row, col_idx)
        if header_label and any(
            _header_matches(header_label, name) for name in aliases
        ):
            return col_idx
    return None


def _column_config_for_header(
    header: str,
    column_config: Optional[Mapping[str, Any]],
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """Resolve Table ``column_config`` for a sheet header, including aliases."""
    if not header or not isinstance(column_config, dict):
        return {}
    direct = column_config.get(header)
    if isinstance(direct, dict):
        return direct
    for key, candidate in column_config.items():
        if not isinstance(candidate, dict):
            continue
        if any(
            _header_matches(header, alias)
            for alias in _rule_column_aliases(str(key), verbose_map)
        ):
            return candidate
    return {}


def _column_config_flag(
    sheet: Worksheet,
    header_row: int,
    col_idx: int,
    key: str,
    default: bool,
    column_config: Optional[Mapping[str, Any]],
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> bool:
    """Match TableChart: per-column config flag if set, else the global default."""
    config = _column_config_for_header(
        _header_at(sheet, header_row, col_idx), column_config, verbose_map
    )
    if key not in config:
        return default
    return bool(config[key])


def _data_bar_color(color_pn: bool) -> str:
    """Neutral fill matches Color +/- off; success green matches it on."""
    return _DATA_BAR_POSITIVE if color_pn else _DATA_BAR_NEUTRAL


def _column_config_enables_bars(column_config: Optional[Mapping[str, Any]]) -> bool:
    if not isinstance(column_config, dict):
        return False
    return any(
        isinstance(config, dict) and config.get("showCellBars") is True
        for config in column_config.values()
    )


def _data_range(sheet: Worksheet, col_idx: int, header_row: int) -> Optional[str]:
    last_row = sheet.max_row
    first_row = header_row + 1
    if last_row < first_row:
        return None
    letter = get_column_letter(col_idx)
    return f"{letter}{first_row}:{letter}{last_row}"


def _used_data_range(sheet: Worksheet, header_row: int) -> Optional[str]:
    first_row = header_row + 1
    last_row = sheet.max_row
    last_col = sheet.max_column
    if last_row < first_row or last_col < 1:
        return None
    return f"A{first_row}:{get_column_letter(last_col)}{last_row}"


def _paints_entire_row(rule: dict[str, Any]) -> bool:
    """True for ``columnFormatting: ENTIRE_ROW`` and legacy ``toAllRow``."""
    return rule.get("columnFormatting") == _ENTIRE_ROW or bool(rule.get("toAllRow"))


def _paint_column_name(rule: dict[str, Any]) -> Optional[str]:
    """Column that receives fill/font/bars; None means the whole data row."""
    if _paints_entire_row(rule):
        return None
    target = rule.get("columnFormatting")
    if isinstance(target, str) and target:
        return target
    column = rule.get("column")
    return column if isinstance(column, str) else None


def _cell_ref(col_idx: int, row: int, *, abs_col: bool = False) -> str:
    letter = get_column_letter(col_idx)
    return f"${letter}{row}" if abs_col else f"{letter}{row}"


def _condition_formula(source_ref: str, rule: dict[str, Any]) -> Optional[str]:
    """Excel formula that evaluates the source cell against the Explore operator."""
    operator = rule.get("operator")
    if operator in _FORMULA_COMPARE:
        op_symbol = _FORMULA_COMPARE[operator]
        target = _excel_literal(rule.get("targetValue"))
        return f"AND(NOT(ISBLANK({source_ref})),{source_ref}{op_symbol}{target})"
    if operator in _RANGE_OPERATORS:
        left_op, right_op = _RANGE_OPERATORS[operator]
        left = _excel_literal(rule.get("targetValueLeft"))
        right = _excel_literal(rule.get("targetValueRight"))
        return (
            f"AND(NOT(ISBLANK({source_ref})),"
            f"{source_ref}{left_op}{left},"
            f"{source_ref}{right_op}{right})"
        )
    if operator in (None, "None", ""):
        return f"NOT(ISBLANK({source_ref}))"
    return None


def _solid_fill(rgb: str) -> PatternFill:
    return PatternFill(start_color=rgb, end_color=rgb, fill_type="solid")


def _add_formula_rule(
    sheet: Worksheet,
    cell_range: str,
    formula: str,
    rgb: str,
    *,
    text_color: bool,
) -> None:
    fill = None if text_color else _solid_fill(rgb)
    font = Font(color=rgb) if text_color else None
    sheet.conditional_formatting.add(
        cell_range,
        FormulaRule(formula=[formula], fill=fill, font=font),
    )


def _add_cell_is_rule(
    sheet: Worksheet,
    cell_range: str,
    operator: str,
    formula: list[str],
    rgb: str,
    *,
    text_color: bool,
) -> None:
    fill = None if text_color else _solid_fill(rgb)
    font = Font(color=rgb) if text_color else None
    sheet.conditional_formatting.add(
        cell_range,
        CellIsRule(operator=operator, formula=formula, fill=fill, font=font),
    )


def _add_data_bar(sheet: Worksheet, cell_range: str, rgb: str) -> None:
    sheet.conditional_formatting.add(
        cell_range,
        DataBarRule(
            start_type="min",
            end_type="max",
            color=rgb,
            showValue=True,
            minLength=None,
            maxLength=None,
        ),
    )


def _matching_cell_range(
    sheet: Worksheet,
    match_col_idx: int,
    header_row: int,
    rule: dict[str, Any],
    paint_col_idx: Optional[int] = None,
) -> Optional[str]:
    """Union of paint-column cells whose match-column value satisfies the rule."""
    paint_idx = match_col_idx if paint_col_idx is None else paint_col_idx
    operator = rule.get("operator")
    if operator in (None, "None", ""):
        return _data_range(sheet, paint_idx, header_row)
    letter = get_column_letter(paint_idx)
    first_row = header_row + 1
    last_row = sheet.max_row
    if last_row < first_row:
        return None
    runs: list[tuple[int, int]] = []
    run_start: Optional[int] = None
    for row in range(first_row, last_row + 1):
        matched = _value_matches_rule(
            sheet.cell(row=row, column=match_col_idx).value, rule
        )
        if matched and run_start is None:
            run_start = row
        elif not matched and run_start is not None:
            runs.append((run_start, row - 1))
            run_start = None
    if run_start is not None:
        runs.append((run_start, last_row))
    if not runs:
        return None
    parts = [
        f"{letter}{start}" if start == end else f"{letter}{start}:{letter}{end}"
        for start, end in runs
    ]
    return " ".join(parts)


def _apply_cell_bar_rule(
    sheet: Worksheet,
    header_row: int,
    rule: dict[str, Any],
    source_idx: int,
    paint_idx: Optional[int],
    rgb: str,
) -> None:
    """Stamp data bars on the painted column(s) for rows matching the source."""
    if _paints_entire_row(rule):
        for col_idx in range(1, sheet.max_column + 1):
            if not _is_numeric_header(sheet, col_idx, header_row):
                continue
            bar_range = _matching_cell_range(
                sheet, source_idx, header_row, rule, paint_col_idx=col_idx
            )
            if bar_range:
                _add_data_bar(sheet, bar_range, rgb)
        return
    if paint_idx is None:
        return
    bar_range = _matching_cell_range(
        sheet, source_idx, header_row, rule, paint_col_idx=paint_idx
    )
    if bar_range:
        _add_data_bar(sheet, bar_range, rgb)


def _resolve_paint_target(
    sheet: Worksheet,
    header_row: int,
    rule: dict[str, Any],
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> Optional[tuple[str, Optional[int]]]:
    """Return (Excel range, painted column index) for a rule, if both exist."""
    if _paints_entire_row(rule):
        cell_range = _used_data_range(sheet, header_row)
        return (cell_range, None) if cell_range else None
    paint_name = _paint_column_name(rule)
    if not isinstance(paint_name, str) or not paint_name:
        return None
    paint_idx = _column_index(sheet, header_row, paint_name, verbose_map)
    if paint_idx is None:
        return None
    cell_range = _data_range(sheet, paint_idx, header_row)
    if cell_range is None:
        return None
    return cell_range, paint_idx


def _apply_color_scale(
    sheet: Worksheet, cell_range: str, rule: dict[str, Any], rgb: str
) -> None:
    min_bound = _as_number(rule.get("minBound"))
    max_bound = _as_number(rule.get("maxBound"))
    start_type = "num" if min_bound is not None else "min"
    end_type = "num" if max_bound is not None else "max"
    sheet.conditional_formatting.add(
        cell_range,
        ColorScaleRule(
            start_type=start_type,
            start_value=min_bound if start_type == "num" else None,
            start_color=_SCALE_LOW,
            end_type=end_type,
            end_value=max_bound if end_type == "num" else None,
            end_color=rgb,
        ),
    )


def _wants_gradient(rule: dict[str, Any]) -> bool:
    """Explore Use gradient defaults on; only an explicit false is solid."""
    return rule.get("useGradient") is not False


def _gradient_opacity(value: Optional[float], cutoff: float, extreme: float) -> float:
    """Match ``getOpacity``: fade from 5% at the cutoff to 100% at the extreme."""
    if value is None or extreme == cutoff:
        return 1.0
    span = extreme - cutoff
    opacity = abs((1.0 - _MIN_GRADIENT_OPACITY) / span * (value - cutoff))
    opacity = opacity + _MIN_GRADIENT_OPACITY
    return min(1.0, round(opacity, 2))


def _blend_with_white(rgb: str, opacity: float) -> str:
    """Approximate Explore's alpha overlay as a solid fill on Excel's white sheet."""
    opacity = max(0.0, min(1.0, opacity))
    fade = 1.0 - opacity
    red = int(rgb[0:2], 16)
    green = int(rgb[2:4], 16)
    blue = int(rgb[4:6], 16)
    return (
        f"{round(red * opacity + 255 * fade):02X}"
        f"{round(green * opacity + 255 * fade):02X}"
        f"{round(blue * opacity + 255 * fade):02X}"
    )


def _column_numeric_extent(
    sheet: Worksheet, col_idx: int, header_row: int
) -> tuple[Optional[float], Optional[float]]:
    low: Optional[float] = None
    high: Optional[float] = None
    for row in range(header_row + 1, sheet.max_row + 1):
        number = _as_number(sheet.cell(row=row, column=col_idx).value)
        if number is None:
            continue
        low = number if low is None else min(low, number)
        high = number if high is None else max(high, number)
    return low, high


def _pair_or_none(
    cutoff: Optional[float], extreme: Optional[float]
) -> Optional[tuple[float, float]]:
    if cutoff is None or extreme is None:
        return None
    return cutoff, extreme


def _gradient_domain(
    sheet: Worksheet, source_idx: int, header_row: int, rule: dict[str, Any]
) -> Optional[tuple[float, float]]:
    """Cutoff and extreme used by Explore to scale background opacity."""
    operator = rule.get("operator")
    low, high = _column_numeric_extent(sheet, source_idx, header_row)
    if operator in _GREATER_OPERATORS:
        extreme = _as_number(rule.get("maxBound"))
        if extreme is None:
            extreme = high
        return _pair_or_none(_as_number(rule.get("targetValue")), extreme)
    if operator in _LESS_OPERATORS:
        extreme = _as_number(rule.get("minBound"))
        if extreme is None:
            extreme = low
        return _pair_or_none(_as_number(rule.get("targetValue")), extreme)
    if operator in _RANGE_OPERATORS:
        return _pair_or_none(
            _as_number(rule.get("targetValueLeft")),
            _as_number(rule.get("targetValueRight")),
        )
    if operator in (None, "None", ""):
        cutoff = _as_number(rule.get("minBound"))
        extreme = _as_number(rule.get("maxBound"))
        if cutoff is None:
            cutoff = low
        if extreme is None:
            extreme = high
        return _pair_or_none(cutoff, extreme)
    return None


def _apply_operator_color_scale(
    sheet: Worksheet, cell_range: str, rule: dict[str, Any], rgb: str
) -> bool:
    """Native Excel color scale for same-column Use gradient background fills."""
    operator = rule.get("operator")
    if operator in (None, "None", ""):
        _apply_color_scale(sheet, cell_range, rule, rgb)
        return True
    if operator in _GREATER_OPERATORS:
        target = _as_number(rule.get("targetValue"))
        if target is None:
            return False
        max_bound = _as_number(rule.get("maxBound"))
        sheet.conditional_formatting.add(
            cell_range,
            ColorScaleRule(
                start_type="num",
                start_value=target,
                start_color=_SCALE_LOW,
                end_type="num" if max_bound is not None else "max",
                end_value=max_bound,
                end_color=rgb,
            ),
        )
        return True
    if operator in _LESS_OPERATORS:
        target = _as_number(rule.get("targetValue"))
        if target is None:
            return False
        min_bound = _as_number(rule.get("minBound"))
        sheet.conditional_formatting.add(
            cell_range,
            ColorScaleRule(
                start_type="num" if min_bound is not None else "min",
                start_value=min_bound,
                start_color=rgb,
                end_type="num",
                end_value=target,
                end_color=_SCALE_LOW,
            ),
        )
        return True
    if operator in _RANGE_OPERATORS:
        left = _as_number(rule.get("targetValueLeft"))
        right = _as_number(rule.get("targetValueRight"))
        if left is None or right is None:
            return False
        sheet.conditional_formatting.add(
            cell_range,
            ColorScaleRule(
                start_type="num",
                start_value=left,
                start_color=_SCALE_LOW,
                end_type="num",
                end_value=right,
                end_color=rgb,
            ),
        )
        return True
    return False


def _apply_gradient_cell_fills(
    sheet: Worksheet,
    header_row: int,
    rule: dict[str, Any],
    source_idx: int,
    paint_idx: Optional[int],
    rgb: str,
) -> bool:
    """Bake opacity-scaled fills when ColorScale cannot follow another column."""
    domain = _gradient_domain(sheet, source_idx, header_row, rule)
    if domain is None:
        return False
    cutoff, extreme = domain
    entire_row = _paints_entire_row(rule)
    painted = False
    for row in range(header_row + 1, sheet.max_row + 1):
        value = sheet.cell(row=row, column=source_idx).value
        if not _value_matches_rule(value, rule):
            continue
        fill_rgb = _blend_with_white(
            rgb, _gradient_opacity(_as_number(value), cutoff, extreme)
        )
        fill = _solid_fill(fill_rgb)
        painted = True
        if entire_row:
            for col_idx in range(1, sheet.max_column + 1):
                sheet.cell(row=row, column=col_idx).fill = fill
            continue
        if paint_idx is not None:
            sheet.cell(row=row, column=paint_idx).fill = fill
    return painted


def _try_apply_gradient(
    sheet: Worksheet,
    header_row: int,
    rule: dict[str, Any],
    cell_range: str,
    source_idx: int,
    paint_idx: Optional[int],
    rgb: str,
    text_color: bool,
) -> bool:
    """Apply Explore Use gradient; False means the caller should use a solid rule."""
    if text_color or not _wants_gradient(rule):
        return False
    operator = rule.get("operator")
    if operator in ("=", "==", "!=", "≠"):
        return False
    same_column = paint_idx is not None and paint_idx == source_idx
    if same_column and paint_idx is not None:
        if not _is_numeric_header(sheet, paint_idx, header_row):
            return False
        return _apply_operator_color_scale(sheet, cell_range, rule, rgb)
    return _apply_gradient_cell_fills(
        sheet, header_row, rule, source_idx, paint_idx, rgb
    )


def _apply_fill_or_scale(
    sheet: Worksheet,
    header_row: int,
    rule: dict[str, Any],
    cell_range: str,
    source_idx: int,
    paint_idx: Optional[int],
    rgb: str,
    text_color: bool,
) -> None:
    operator = rule.get("operator")
    same_column = paint_idx is not None and paint_idx == source_idx
    source_ref = _cell_ref(source_idx, header_row + 1, abs_col=not same_column)
    if _try_apply_gradient(
        sheet,
        header_row,
        rule,
        cell_range,
        source_idx,
        paint_idx,
        rgb,
        text_color,
    ):
        return
    if operator in _CELL_IS_OPERATORS and same_column:
        _add_cell_is_rule(
            sheet,
            cell_range,
            _CELL_IS_OPERATORS[operator],
            [_excel_literal(rule.get("targetValue"))],
            rgb,
            text_color=text_color,
        )
        return
    if operator in _CELL_IS_OPERATORS or operator in _RANGE_OPERATORS:
        formula = _condition_formula(source_ref, rule)
        if formula:
            _add_formula_rule(sheet, cell_range, formula, rgb, text_color=text_color)
        return
    if operator not in (None, "None", ""):
        return
    numeric_scale = (
        same_column
        and not text_color
        and paint_idx is not None
        and _is_numeric_header(sheet, paint_idx, header_row)
    )
    if numeric_scale:
        _apply_color_scale(sheet, cell_range, rule, rgb)
        return
    formula = _condition_formula(source_ref, rule)
    if formula:
        _add_formula_rule(sheet, cell_range, formula, rgb, text_color=text_color)


def _apply_rule(
    sheet: Worksheet,
    header_row: int,
    rule: dict[str, Any],
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> None:
    column = rule.get("column")
    if not isinstance(column, str) or not column:
        return
    source_idx = _column_index(sheet, header_row, column, verbose_map)
    if source_idx is None:
        return
    target = _resolve_paint_target(sheet, header_row, rule, verbose_map)
    if target is None:
        return
    cell_range, paint_idx = target
    rgb = _rule_color(rule)
    object_fmt = rule.get("objectFormatting") or ""
    if object_fmt == _OBJECT_CELL_BAR:
        _apply_cell_bar_rule(sheet, header_row, rule, source_idx, paint_idx, rgb)
        return
    _apply_fill_or_scale(
        sheet,
        header_row,
        rule,
        cell_range,
        source_idx,
        paint_idx,
        rgb,
        object_fmt == _OBJECT_TEXT,
    )


def _is_numeric_header(sheet: Worksheet, col_idx: int, header_row: int) -> bool:
    sample_last = min(sheet.max_row, header_row + _NUMERIC_SAMPLE_ROWS)
    for row in range(header_row + 1, sample_last + 1):
        cell = sheet.cell(row=row, column=col_idx)
        if cell.value in (None, ""):
            continue
        # Explore only bars ``typeof value === 'number'``; Excel stores dates
        # as numeric serials, so skip datetime cells to match the chart.
        if isinstance(cell.value, (datetime, date)):
            return False
        if cell.data_type == "n" or isinstance(cell.value, (int, float)):
            return True
        return False
    return False


def _rule_hides_default_bars(rule: dict[str, Any]) -> bool:
    """Background / CELL_BAR CF on a column replaces Table default cell bars."""
    object_fmt = rule.get("objectFormatting") or ""
    return object_fmt != _OBJECT_TEXT


def _columns_skipping_default_bars(
    sheet: Worksheet,
    header_row: int,
    rules: list[dict[str, Any]],
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> set[int]:
    skipped: set[int] = set()
    for rule in rules:
        if not isinstance(rule, dict) or not _rule_hides_default_bars(rule):
            continue
        if _paints_entire_row(rule):
            skipped.update(range(1, sheet.max_column + 1))
            continue
        paint_name = _paint_column_name(rule)
        if not isinstance(paint_name, str) or not paint_name:
            continue
        col_idx = _column_index(sheet, header_row, paint_name, verbose_map)
        if col_idx is not None:
            skipped.add(col_idx)
    return skipped


def _apply_cell_bars(
    sheet: Worksheet,
    header_row: int,
    skip_columns: Optional[set[int]] = None,
    *,
    show_cell_bars: bool = True,
    color_pn: bool = True,
    column_config: Optional[Mapping[str, Any]] = None,
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> None:
    """Attach Excel data bars on numeric columns (Table ``show_cell_bars``)."""
    skipped = skip_columns or set()
    for col_idx in range(1, sheet.max_column + 1):
        if col_idx in skipped:
            continue
        if not _column_config_flag(
            sheet,
            header_row,
            col_idx,
            "showCellBars",
            show_cell_bars,
            column_config,
            verbose_map,
        ):
            continue
        if not _is_numeric_header(sheet, col_idx, header_row):
            continue
        cell_range = _data_range(sheet, col_idx, header_row)
        if cell_range is None:
            continue
        column_color_pn = _column_config_flag(
            sheet,
            header_row,
            col_idx,
            "colorPositiveNegative",
            color_pn,
            column_config,
            verbose_map,
        )
        _add_data_bar(sheet, cell_range, _data_bar_color(column_color_pn))


def apply_conditional_formatting(
    workbook_bytes: bytes,
    rules: list[dict[str, Any]],
    header_rows: int = 1,
    *,
    show_cell_bars: bool = False,
    color_pn: bool = True,
    verbose_map: Optional[Mapping[str, Any]] = None,
    column_config: Optional[Mapping[str, Any]] = None,
) -> bytes:
    """Attach native Excel CF for Explore rules and optional Table cell bars."""
    if (
        not rules
        and not show_cell_bars
        and not _column_config_enables_bars(column_config)
    ):
        return workbook_bytes

    workbook: Workbook = load_workbook(io.BytesIO(workbook_bytes))
    sheet = workbook.active
    # xlsxwriter omits a full dimension; without this openpyxl can see only
    # the header row and skip every highlight.
    refresh_sheet_bounds(sheet)
    header_row = max(header_rows, 1)
    for rule in rules:
        if isinstance(rule, dict):
            _apply_rule(sheet, header_row, rule, verbose_map)
    # Table Explore still paints default bars on numeric columns that do not
    # themselves have a background/CELL_BAR rule (valueRangeFlag is per-cell).
    # Per-column ``showCellBars`` overrides the global checkbox.
    _apply_cell_bars(
        sheet,
        header_row,
        skip_columns=_columns_skipping_default_bars(
            sheet, header_row, rules, verbose_map
        ),
        show_cell_bars=show_cell_bars,
        color_pn=color_pn,
        column_config=column_config,
        verbose_map=verbose_map,
    )

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def polish_explore_xlsx(
    workbook_bytes: bytes,
    df: pd.DataFrame,
    form_data: dict[str, Any],
    include_index: bool = False,
    verbose_map: Optional[Mapping[str, Any]] = None,
) -> bytes:
    """Apply Explore number formats and conditional formatting to an XLSX."""
    viz_type = form_data.get("viz_type")
    if viz_type not in ("table", "pivot_table_v2"):
        return workbook_bytes

    header_rows = getattr(df.columns, "nlevels", 1)
    if include_index:
        header_rows = max(header_rows, getattr(df.index, "nlevels", 1))

    skip_display = viz_type == "pivot_table_v2" and form_data.get("showValuesAs") in (
        SHOW_VALUES_AS_PERCENT_MODES
    )
    if not skip_display:
        headers = [str(column) for column in df.columns]
        if viz_type == "table":
            styles = styles_from_table_form_data(
                headers, form_data, verbose_map=verbose_map
            )
        else:
            styles = styles_from_pivot_form_data(headers, form_data)
        workbook_bytes = apply_column_display(
            workbook_bytes, styles, header_rows=header_rows
        )

    rules = form_data.get("conditionalFormatting") or form_data.get(
        "conditional_formatting"
    )
    if not isinstance(rules, list):
        rules = []
    show_cell_bars = form_data.get("show_cell_bars")
    if show_cell_bars is None and viz_type == "table":
        # Table control defaults to on; omitted keys still get bars.
        show_cell_bars = True
    column_config = form_data.get("column_config")
    if not isinstance(column_config, dict):
        column_config = None
    color_pn = form_data.get("color_pn")
    if color_pn is None and viz_type == "table":
        # Table Color +/- defaults to on; omitted keys keep the green bars.
        color_pn = True
    return apply_conditional_formatting(
        workbook_bytes,
        rules,
        header_rows=header_rows,
        show_cell_bars=bool(show_cell_bars),
        color_pn=bool(color_pn),
        verbose_map=verbose_map,
        column_config=column_config,
    )
