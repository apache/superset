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
Excel export of the spreadsheet chart (viz type ``univer_sheet``).

The chart shows the query result in a Univer spreadsheet that users can edit:
rename headers, add formulas, format cells, merge cells, add sheets. Those
edits are saved in ``form_data["univer_workbook"]`` as Univer workbook data.
This module rebuilds the sheet the chart shows from the query result and that
saved state, the same way the frontend does (see
``superset-frontend/plugins/plugin-chart-univer/src/utils/workbook.ts``), and
writes it as an .xlsx file with XlsxWriter, like Superset's other Excel
exports.
"""

from __future__ import annotations

import copy
import io
import math
import re
from datetime import date, datetime
from typing import Any, cast, Optional, TypedDict, Union

import numpy as np
import pandas as pd
import xlsxwriter
from openpyxl.formula.translate import Translator
from xlsxwriter.format import Format
from xlsxwriter.utility import xl_rowcol_to_cell
from xlsxwriter.worksheet import Worksheet

from superset.utils import json
from superset.utils.core import GenericDataType

VIZ_TYPE = "univer_sheet"
WORKBOOK_CONTROL = "univer_workbook"
LIVE_DATA_CONTROL = "univer_live_data"
PIVOT_MODE = "pivot"
PIVOT_ROWS_CONTROL = "univer_pivot_rows"
ROW_GROUPING_CONTROL = "univer_row_grouping"
# labels of the rows added when grouping rows, as in the frontend
PIVOT_TOTAL = "Total"
SUBTOTALS = "Subtotals"
GRAND_TOTAL = "Grand Total"

CellValue = Union[str, int, float, bool]
Grid = list[list[Optional[CellValue]]]
UniverWorkbook = dict[str, Any]
MergeRange = dict[str, int]


class _GridLayoutBase(TypedDict):
    headerRows: int
    frozenCols: int
    merges: list[MergeRange]


class GridLayout(_GridLayoutBase, total=False):
    """How the query result is laid out in the grid, as in the frontend."""

    # total rows added by group_rows, shown in bold
    subtotalRows: list[int]


def default_layout() -> GridLayout:
    """One header row, nothing frozen on the left, no merges."""
    return {"headerRows": 1, "frozenCols": 0, "merges": []}


class _OutlineGroupBase(TypedDict):
    start: int
    end: int


class OutlineGroup(_OutlineGroupBase, total=False):
    """Rows (or columns) ``start`` to ``end``, see the frontend's outline.ts."""

    collapsed: bool


class _OutlineBase(TypedDict):
    rows: list[OutlineGroup]
    columns: list[OutlineGroup]


class Outline(_OutlineBase, total=False):
    """Collapsible row and column groups of the first sheet."""

    # the total rows of row groups are above them, see group_rows
    summaryAbove: bool


# groups the user makes with Group rows / Group columns, turned off in the
# frontend while they clash with the automatic grouping (see MANUAL_GROUPS in
# outline.ts): saved ones are ignored
MANUAL_GROUPS = False

# where the first sheet's outline is kept for the writer
OUTLINE_KEY = "_superset_outline"


HEADER_STYLE_ID = "superset_header"
# style of grouped rows' totals and merged values, see group_rows
SUBTOTAL_STYLE_ID = "superset_subtotal"
SUBTOTAL_STYLE = {"bl": 1, "vt": 1}
# cell fields that hold the value, everything else (like style) is kept
DATA_KEYS = ("v", "t", "f", "si", "p")

# pixel widths used to fit columns to their content in a fresh workbook,
# as in the frontend
MIN_COL_WIDTH = 80
MAX_COL_WIDTH = 320
CHAR_WIDTH = 8
COL_PADDING = 16
WIDTH_SAMPLE_ROWS = 100
DEFAULT_COL_WIDTH = 88
DEFAULT_ROW_HEIGHT = 24

# Univer sizes are in pixels, Excel's row heights in points
PT_PER_PX = 0.75

# Univer BorderStyleTypes (from 0) as XlsxWriter border indexes
BORDER_STYLES = [0, 1, 7, 4, 3, 9, 11, 6, 2, 8, 10, 12, 13, 5]
# Univer HorizontalAlign and VerticalAlign, in order from 0
H_ALIGN: list[Optional[str]] = [
    None,
    "left",
    "center",
    "right",
    "justify",
    "justify",
    "distributed",
]
V_ALIGN: list[Optional[str]] = [None, "top", "vcenter", "bottom"]
WRAP = 3
CELL_TYPE_BOOLEAN = 3


def is_univer_chart(form_data: Optional[dict[str, Any]]) -> bool:
    """Whether the form data belongs to a spreadsheet chart."""
    return bool(form_data and form_data.get("viz_type") == VIZ_TYPE)


def parse_saved_state(raw: Any) -> Optional[dict[str, Any]]:
    """The chart's saved state, or None when nothing (valid) is saved."""
    if not raw:
        return None
    try:
        state = json.loads(raw) if isinstance(raw, str) else raw
    except ValueError:
        return None
    if (
        isinstance(state, dict)
        and state.get("version") == 1
        and (state.get("workbook") or {}).get("sheetOrder")
    ):
        return state
    return None


def _format_temporal(value: Any) -> str:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_convert("UTC").tz_localize(None)
    # drop the time part for whole days
    if timestamp == timestamp.normalize():
        return timestamp.strftime("%Y-%m-%d")
    return timestamp.strftime("%Y-%m-%d %H:%M:%S")


def _temporal_value(value: Any) -> str:
    try:
        if isinstance(value, (int, float)):
            return _format_temporal(pd.Timestamp(value, unit="ms"))
        return _format_temporal(value)
    except (ValueError, TypeError):
        return str(value)


def _float_value(value: float) -> CellValue:
    if not math.isfinite(value):
        return str(value)
    if not value.is_integer():
        # drop floating point noise such as 524.999999999985
        return float(f"{value:.12g}")
    return value


def to_cell_value(
    value: Any, coltype: Optional[GenericDataType] = None
) -> Optional[CellValue]:
    """A query value as the chart shows it in a cell."""
    if isinstance(value, np.generic):
        value = value.item()
    if value is None or value is pd.NaT:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if coltype == GenericDataType.TEMPORAL and isinstance(
        value, (int, float, str, datetime, date)
    ):
        return _temporal_value(value)
    if isinstance(value, float):
        return _float_value(value)
    if isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, (datetime, date)):
        return _format_temporal(value)
    return json.dumps(value, default=str)


def _data_rows(df: pd.DataFrame, coltypes: list[GenericDataType]) -> Grid:
    types: list[Optional[GenericDataType]] = list(coltypes) + [None] * (
        len(df.columns) - len(coltypes)
    )
    return [
        [to_cell_value(value, types[i]) for i, value in enumerate(row)]
        for row in df.itertuples(index=False, name=None)
    ]


def build_grid(
    df: pd.DataFrame,
    coltypes: list[GenericDataType],
    labels: Optional[dict[str, str]] = None,
) -> Grid:
    """The query result as a grid: the header row followed by the data rows."""
    labels = labels or {}
    header: list[Optional[CellValue]] = [
        labels.get(str(column), str(column)) for column in df.columns
    ]
    return [header, *_data_rows(df, coltypes)]


def _split_flat_name(name: str) -> list[str]:
    """Levels of a flattened pivot column name, e.g. "SUM(sales), Action"."""
    return [part.replace("\\,", ",") for part in re.split(r"(?<!\\), ", name)]


def _header_merges(
    levels: list[list[str]], header: Grid, row_fields: int
) -> list[MergeRange]:
    header_rows = len(header)
    merges: list[MergeRange] = []
    if header_rows > 1:
        merges.extend(
            {"startRow": 0, "endRow": header_rows - 1, "startColumn": c, "endColumn": c}
            for c in range(row_fields)
        )
    # a header spans the columns below it that share all levels above
    total = row_fields + len(levels)
    for r in range(header_rows - 1):
        start = row_fields
        for c in range(row_fields + 1, total + 1):
            same = (
                c < total
                and levels[c - row_fields][: r + 1]
                == levels[start - row_fields][: r + 1]
            )
            if not same:
                if c - 1 > start and header[r][start] is not None:
                    merges.append(
                        {
                            "startRow": r,
                            "endRow": r,
                            "startColumn": start,
                            "endColumn": c - 1,
                        }
                    )
                start = c
    return merges


def build_pivot_grid(
    df: pd.DataFrame,
    coltypes: list[GenericDataType],
    labels: dict[str, str],
    row_fields: int,
) -> tuple[Grid, GridLayout]:
    """
    Lays out a pivoted query result like the frontend's ``buildPivotGrid``:
    the first ``row_fields`` columns are the pivot's row fields, the others are
    named "metric, value, ..." by the ``flatten`` post-processing. Each level
    gets a header row, equal neighbouring headers are merged. The row fields'
    names go in the top header row, merged down over the others.
    """
    columns = [str(column) for column in df.columns]
    levels = [_split_flat_name(name) for name in columns[row_fields:]]
    header_rows = max([1, *[len(parts) for parts in levels]])
    header: Grid = []
    for r in range(header_rows):
        row: list[Optional[CellValue]] = []
        for c, column in enumerate(columns):
            if c < row_fields:
                row.append(labels.get(column, column) if r == 0 else None)
                continue
            parts = levels[c - row_fields]
            value = parts[r] if r < len(parts) else ""
            if not value:
                row.append(None)
            else:
                # the top level is the metric
                row.append(labels.get(value, value) if r == 0 else value)
        header.append(row)
    layout: GridLayout = {
        "headerRows": header_rows,
        "frozenCols": row_fields,
        "merges": _header_merges(levels, header, row_fields),
    }
    return [*header, *_data_rows(df, coltypes)], layout


def _grid_size(grid: Grid) -> tuple[int, int]:
    return len(grid), len(grid[0]) if grid else 0


def _first_sheet(workbook: UniverWorkbook) -> Optional[dict[str, Any]]:
    order = workbook.get("sheetOrder") or []
    return (workbook.get("sheets") or {}).get(order[0]) if order else None


def apply_grid(
    workbook: UniverWorkbook,
    grid: Grid,
    previous: Optional[tuple[int, int]],
    header_rows: int = 1,
) -> UniverWorkbook:
    """
    Writes the query result into the top-left corner of the first sheet.
    Styles of existing cells are kept, cells that belonged to the previous
    (bigger) result are cleared. Returns a new workbook.
    """
    result = copy.deepcopy(workbook)
    sheet = _first_sheet(result)
    if sheet is None:
        return result

    rows, cols = _grid_size(grid)
    cell_data: dict[str, Any] = sheet.setdefault("cellData", {})
    max_rows = max(rows, previous[0] if previous else 0)
    max_cols = max(cols, previous[1] if previous else 0)
    has_header_style = HEADER_STYLE_ID in (result.get("styles") or {})

    for r in range(max_rows):
        row: dict[str, Any] = cell_data.setdefault(str(r), {})
        for c in range(max_cols):
            existing = row.get(str(c)) or {}
            cell = {k: v for k, v in existing.items() if k not in DATA_KEYS}
            value = grid[r][c] if r < rows and c < cols else None
            if value is not None:
                cell["v"] = value
            is_header = r < header_rows
            if (
                is_header
                and value is not None
                and not cell.get("s")
                and has_header_style
            ):
                cell["s"] = HEADER_STYLE_ID
            if cell:
                row[str(c)] = cell
            else:
                row.pop(str(c), None)
        if not row:
            cell_data.pop(str(r), None)
    return result


def _fit_column_widths(grid: Grid) -> dict[str, dict[str, int]]:
    sample = grid[:WIDTH_SAMPLE_ROWS]
    widths: dict[str, dict[str, int]] = {}
    for c in range(_grid_size(grid)[1]):
        chars = max(len(str(row[c] if row[c] is not None else "")) for row in sample)
        width = min(MAX_COL_WIDTH, max(MIN_COL_WIDTH, chars * CHAR_WIDTH + COL_PADDING))
        widths[str(c)] = {"w": width}
    return widths


def _layout_freeze(layout: GridLayout) -> dict[str, int]:
    return {
        "xSplit": layout["frozenCols"],
        "ySplit": layout["headerRows"],
        "startRow": layout["headerRows"],
        "startColumn": layout["frozenCols"],
    }


def _apply_layout(
    workbook: UniverWorkbook, previous: GridLayout, layout: GridLayout
) -> None:
    """
    Replaces the header merges and frozen panes of the previous layout with
    those of the new one, keeping merges and freezing the user changed.
    """
    sheet = _first_sheet(workbook)
    if sheet is None:
        return

    def crosses(a: MergeRange, b: MergeRange) -> bool:
        return (
            a["startRow"] <= b["endRow"]
            and b["startRow"] <= a["endRow"]
            and a["startColumn"] <= b["endColumn"]
            and b["startColumn"] <= a["endColumn"]
        )

    # merged cells overlapping the new layout's would hide its data
    sheet["mergeData"] = [
        merge
        for merge in sheet.get("mergeData") or []
        if merge not in previous["merges"]
        and not any(crosses(new, merge) for new in layout["merges"])
    ] + layout["merges"]
    freeze = sheet.get("freeze")
    if not freeze or (
        freeze.get("ySplit") == previous["headerRows"]
        and freeze.get("xSplit") == previous["frozenCols"]
    ):
        sheet["freeze"] = _layout_freeze(layout)


def create_workbook_data(
    grid: Grid, layout: Optional[GridLayout] = None
) -> UniverWorkbook:
    """The workbook the chart shows when the user hasn't saved any edits."""
    layout = layout or default_layout()
    rows, cols = _grid_size(grid)
    workbook = {
        "id": "superset-univer",
        "name": "Superset",
        "sheetOrder": ["data"],
        "styles": {HEADER_STYLE_ID: {"bl": 1, "bg": {"rgb": "#F2F2F2"}}},
        "sheets": {
            "data": {
                "id": "data",
                "name": "Data",
                "rowCount": rows,
                "columnCount": cols,
                "defaultColumnWidth": MIN_COL_WIDTH,
                "freeze": _layout_freeze(layout),
                "columnData": _fit_column_widths(grid),
                "mergeData": layout["merges"],
                "cellData": {},
            }
        },
    }
    result = apply_grid(workbook, grid, None, layout["headerRows"])
    _apply_group_styles(result, layout)
    return result


def build_workbook(
    grid: Grid,
    saved: Optional[dict[str, Any]],
    live_data: bool,
    layout: Optional[GridLayout] = None,
) -> UniverWorkbook:
    """The workbook the chart shows, the query result with the user's edits."""
    layout = layout or default_layout()
    if saved is None:
        return create_workbook_data(grid, layout)
    # a stripped sheet has no values in the data area, they come from the query
    if not live_data and not saved.get("stripped"):
        return copy.deepcopy(saved["workbook"])

    header_rows = layout["headerRows"]
    workbook = apply_grid(
        saved["workbook"],
        [*_saved_headers(grid, saved, header_rows), *grid[header_rows:]],
        (saved.get("dataRows", 0), saved.get("dataCols", 0)),
        header_rows,
    )
    _apply_layout(workbook, saved.get("layout") or default_layout(), layout)
    _apply_group_styles(workbook, layout)
    return workbook


def _apply_group_styles(workbook: UniverWorkbook, layout: GridLayout) -> None:
    """
    Shows the totals and merged values of grouped rows in bold, like the
    frontend's ``applyGroupStyles``. Modifies ``workbook``.
    """
    sheet = _first_sheet(workbook)
    if sheet is None:
        return
    cell_data: dict[str, Any] = sheet.setdefault("cellData", {})
    styled: set[tuple[str, str]] = set()
    for subtotal_row in layout.get("subtotalRows") or []:
        styled.update(
            (str(subtotal_row), c) for c in (cell_data.get(str(subtotal_row)) or {})
        )
    styled.update(
        (str(merge["startRow"]), str(merge["startColumn"]))
        for merge in layout["merges"]
        if merge["startRow"] >= layout["headerRows"]
    )
    for r, row in cell_data.items():
        for c, cell in (row or {}).items():
            if (
                isinstance(cell, dict)
                and cell.get("s") == SUBTOTAL_STYLE_ID
                and (r, c) not in styled
            ):
                del cell["s"]
    for r, c in styled:
        cell = cell_data.setdefault(r, {}).setdefault(c, {})
        if not cell.get("s"):
            cell["s"] = SUBTOTAL_STYLE_ID
    if styled:
        workbook["styles"] = {
            **(workbook.get("styles") or {}),
            SUBTOTAL_STYLE_ID: SUBTOTAL_STYLE,
        }


def _saved_headers(grid: Grid, saved: dict[str, Any], header_rows: int) -> Grid:
    """
    The query's header rows, except where the user renamed a header. A renamed
    header is kept while the query's label for it stays the same.
    """
    cell_data = (_first_sheet(saved["workbook"]) or {}).get("cellData") or {}
    saved_grid = saved.get("headerGrid") or [saved.get("headers") or []]
    headers: Grid = []
    for r, row in enumerate(grid[:header_rows]):
        renamed = cell_data.get(str(r)) or {}
        saved_row = saved_grid[r] if r < len(saved_grid) else []
        headers.append(
            [
                value
                if (value := (renamed.get(str(c)) or {}).get("v")) is not None
                and c < len(saved_row)
                and saved_row[c] == label
                else label
                for c, label in enumerate(row)
            ]
        )
    return headers


def _subtotal(rows: Grid, column: int) -> Optional[CellValue]:
    numbers = [
        row[column]
        for row in rows
        if isinstance(row[column], (int, float)) and not isinstance(row[column], bool)
    ]
    if not numbers:
        return None
    total = sum(numbers)  # type: ignore
    return float(f"{total:.12g}") if isinstance(total, float) else total


def group_rows(
    grid: Grid, layout: GridLayout, dimensions: int, grand_total: bool
) -> tuple[Grid, GridLayout, list[OutlineGroup]]:
    """
    Groups the data rows by their first ``dimensions`` columns with a
    "Subtotals" row on top of each group, like the frontend's ``groupRows``.
    """
    header_rows = layout["headerRows"]
    cols = len(grid[0]) if grid else 0
    if dimensions < 2 or dimensions > cols:
        return grid, layout, []

    data = grid[header_rows:]
    tail: Grid = []
    if (
        data
        and data[-1][0] == PIVOT_TOTAL
        and all(value in (None, "") for value in data[-1][1:dimensions])
    ):
        tail, data = [data[-1]], data[:-1]

    out: Grid = []
    merges: list[MergeRange] = []
    groups: list[OutlineGroup] = []
    subtotal_rows: list[int] = []

    def build(rows: Grid, level: int) -> None:
        if level == dimensions - 1:
            out.extend(rows)
            return
        parts: dict[str, Grid] = {}
        for row in rows:
            parts.setdefault(_js_string(row[level]), []).append(row)
        for part in parts.values():
            top = header_rows + len(out)
            subtotal_rows.append(top)
            out.append(
                [
                    part[0][level]
                    if c == level
                    else SUBTOTALS
                    if c == level + 1
                    else None
                    if c < dimensions
                    else _subtotal(part, c)
                    for c in range(cols)
                ]
            )
            build(part, level + 1)
            end = header_rows + len(out) - 1
            merges.append(
                {
                    "startRow": top,
                    "endRow": end,
                    "startColumn": level,
                    "endColumn": level,
                }
            )
            groups.append({"start": top + 1, "end": end})

    build(data, 0)
    if grand_total and not tail:
        subtotal_rows.append(header_rows + len(out))
        out.append(
            [
                GRAND_TOTAL
                if c == 0
                else None
                if c < dimensions
                else _subtotal(data, c)
                for c in range(cols)
            ]
        )
    return (
        [*grid[:header_rows], *out, *tail],
        {
            **layout,
            "merges": [*layout["merges"], *merges],
            "subtotalRows": subtotal_rows,
        },
        groups,
    )


def combine_groups(
    automatic: list[OutlineGroup], saved: list[OutlineGroup]
) -> list[OutlineGroup]:
    """The automatic groups with the saved ones, like ``combineGroups``."""
    groups: list[OutlineGroup] = sorted(
        (dict(group) for group in automatic),  # type: ignore
        key=lambda group: (group["start"], -(group["end"] - group["start"])),
    )
    for group in saved:
        same = next(
            (
                other
                for other in groups
                if other["start"] == group["start"] and other["end"] == group["end"]
            ),
            None,
        )
        if same is not None:
            same["collapsed"] = bool(group.get("collapsed"))
            continue
        added = _add_group(groups, group["start"], group["end"])
        if added is None:
            continue
        for other in added:
            if other["start"] == group["start"] and other["end"] == group["end"]:
                other["collapsed"] = bool(group.get("collapsed"))
        groups = added
    return groups


def _js_string(value: Any) -> str:
    """A cell value as JavaScript's String() writes it, like the frontend."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else repr(value)
    return str(value)


def _outline_keys(
    grid: Grid, header_rows: int, key_columns: Optional[int]
) -> tuple[list[Optional[str]], list[Optional[str]]]:
    """Keys of the data rows and columns, see ``outlineKeys`` in outline.ts."""
    cols = len(grid[0]) if grid else 0
    rows = [
        None
        if r < header_rows
        else "\u0001".join(_js_string(v) for v in row[: key_columns or cols])
        for r, row in enumerate(grid)
    ]
    columns: list[Optional[str]] = [
        "\u0001".join(_js_string(row[c]) for row in grid[:header_rows])
        for c in range(cols)
    ]
    return rows, columns


def _add_group(
    groups: list[OutlineGroup], start: int, end: int
) -> Optional[list[OutlineGroup]]:
    """Adds a group unless it crosses or repeats another, see ``addGroup``."""
    start, end = min(start, end), max(start, end)
    for other in groups:
        same = other["start"] == start and other["end"] == end
        overlaps = other["start"] <= end and start <= other["end"]
        nested = (other["start"] <= start and end <= other["end"]) or (
            start <= other["start"] and other["end"] <= end
        )
        if same or (overlaps and not nested):
            return None
    return sorted(
        [*groups, {"start": start, "end": end}],
        key=lambda group: (group["start"], -(group["end"] - group["start"])),
    )


def _resolve_groups(
    saved: list[dict[str, Any]], keys: list[Optional[str]]
) -> list[OutlineGroup]:
    def resolve(anchor: dict[str, Any]) -> Optional[int]:
        if "key" in anchor:
            return keys.index(anchor["key"]) if anchor["key"] in keys else None
        if "after" in anchor:
            return len(keys) + int(anchor["after"])
        return int(anchor.get("index", 0))

    groups: list[OutlineGroup] = []
    for group in saved:
        start = resolve(group.get("start") or {})
        end = resolve(group.get("end") or {})
        if start is None or end is None:
            continue
        added = _add_group(groups, start, end)
        if added is None:
            continue
        for new in added:
            if (
                new["start"] == min(start, end)
                and new["end"] == max(start, end)
                and group.get("collapsed")
            ):
                new["collapsed"] = True
        groups = added
    return groups


def resolve_outline(
    saved: Optional[dict[str, Any]],
    grid: Grid,
    header_rows: int,
    key_columns: Optional[int],
) -> Outline:
    """The saved groups on the current query result, see ``resolveOutline``."""
    if not saved:
        return {"rows": [], "columns": []}
    row_keys, column_keys = _outline_keys(grid, header_rows, key_columns)
    return {
        "rows": _resolve_groups(saved.get("rows") or [], row_keys),
        "columns": _resolve_groups(saved.get("columns") or [], column_keys),
    }


def apply_outline(workbook: UniverWorkbook, outline: Outline, grid: Grid) -> None:
    """
    Hides the rows and columns of collapsed groups and shows the others of
    the query result, like the frontend's ``applyOutline``. Keeps the outline
    with the first sheet for the writer. Modifies ``workbook``.
    """
    sheet = _first_sheet(workbook)
    if sheet is None or not (outline["rows"] or outline["columns"]):
        return
    sheet[OUTLINE_KEY] = outline
    for key, groups, count in (
        ("rowData", outline["rows"], len(grid)),
        ("columnData", outline["columns"], len(grid[0]) if grid else 0),
    ):
        data = {
            str(i): dict(value or {}) for i, value in (sheet.get(key) or {}).items()
        }
        for i in range(count):
            if (data.get(str(i)) or {}).get("hd"):
                data[str(i)]["hd"] = 0
        for group in groups:
            if group.get("collapsed"):
                for i in range(group["start"], group["end"] + 1):
                    data.setdefault(str(i), {})["hd"] = 1
        sheet[key] = data


def _to_hex(color: Any) -> Optional[str]:
    """'#F2F2F2', '#FFF' or 'rgb(242, 242, 242)' as '#F2F2F2'."""
    rgb = str((color or {}).get("rgb") or "").strip()
    if not rgb:
        return None
    if match := re.match(r"^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", rgb, re.I):
        return "#" + "".join(f"{min(int(n), 255):02X}" for n in match.groups())
    hex_value = rgb.lstrip("#")
    if len(hex_value) == 3:
        hex_value = "".join(ch * 2 for ch in hex_value)
    if re.fullmatch(r"[0-9a-fA-F]{6}", hex_value):
        return "#" + hex_value.upper()
    return None


def _pick(values: list[Any], index: Any) -> Any:
    if isinstance(index, int) and 0 <= index < len(values):
        return values[index]
    return None


def _font_props(style: dict[str, Any]) -> dict[str, Any]:
    return {
        "font_name": style.get("ff") or None,
        "font_size": style.get("fs") or None,
        "bold": bool(style.get("bl")) or None,
        "italic": bool(style.get("it")) or None,
        "underline": 1 if (style.get("ul") or {}).get("s") else None,
        "font_strikeout": bool((style.get("st") or {}).get("s")) or None,
        "font_color": _to_hex(style.get("cl")),
    }


def _border_props(style: dict[str, Any]) -> dict[str, Any]:
    borders = style.get("bd")
    props: dict[str, Any] = {}
    if not isinstance(borders, dict):
        return props
    for name, key in (("top", "t"), ("right", "r"), ("bottom", "b"), ("left", "l")):
        border = borders.get(key)
        if isinstance(border, dict) and _pick(BORDER_STYLES, border.get("s")):
            props[name] = BORDER_STYLES[border["s"]]
            props[f"{name}_color"] = _to_hex(border.get("cl"))
    return props


def format_props(style: dict[str, Any]) -> dict[str, Any]:
    """A Univer cell style as XlsxWriter format properties."""
    fill = _to_hex(style.get("bg"))
    props = {
        **_font_props(style),
        "bg_color": fill,
        "pattern": 1 if fill else None,
        "align": _pick(H_ALIGN, style.get("ht")),
        "valign": _pick(V_ALIGN, style.get("vt")),
        "text_wrap": True if style.get("tb") == WRAP else None,
        "num_format": (style.get("n") or {}).get("pattern") or None,
        **_border_props(style),
    }
    return {key: value for key, value in props.items() if value is not None}


class _Writer:
    """Writes Univer workbook data with XlsxWriter, sharing equal formats."""

    def __init__(self, book: xlsxwriter.Workbook, styles: dict[str, Any]) -> None:
        self.book = book
        self.styles = styles
        self.formats: dict[str, Optional[Format]] = {}

    def cell_format(self, style: Any) -> Optional[Format]:
        if isinstance(style, str):
            style = self.styles.get(style)
        if not isinstance(style, dict):
            return None
        props = format_props(style)
        key = json.dumps(props, sort_keys=True)
        if key not in self.formats:
            self.formats[key] = self.book.add_format(props) if props else None
        return self.formats[key]

    def write_cell(
        self,
        ws: Worksheet,
        position: tuple[int, int],
        data: dict[str, Any],
        masters: dict[str, tuple[str, str]],
    ) -> None:
        row, col = position
        fmt = self.cell_format(data.get("s"))
        value = _cell_value(data)
        if formula := _cell_formula(data, xl_rowcol_to_cell(row, col), masters):
            ws.write_formula(row, col, formula, fmt, "" if value is None else value)
        elif isinstance(value, bool):
            ws.write_boolean(row, col, value, fmt)
        elif isinstance(value, (int, float)):
            ws.write_number(row, col, value, fmt)
        elif value is not None:
            # written as text even when it looks like a formula
            ws.write_string(row, col, str(value), fmt)
        elif fmt is not None:
            ws.write_blank(row, col, None, fmt)

    def add_sheet(self, sheet: dict[str, Any], name: str) -> None:
        ws = self.book.add_worksheet(name)
        _set_layout(ws, sheet)
        _set_dimensions(ws, sheet)

        cell_data = sheet.get("cellData") or {}
        masters = _shared_formulas(cell_data)
        merges = sheet.get("mergeData") or []
        for merge in merges:
            ws.merge_range(
                merge["startRow"],
                merge["startColumn"],
                merge["endRow"],
                merge["endColumn"],
                "",
                self.cell_format(
                    (
                        (cell_data.get(str(merge["startRow"])) or {}).get(
                            str(merge["startColumn"])
                        )
                        or {}
                    ).get("s")
                ),
            )
        hidden = {
            (r, c)
            for merge in merges
            for r in range(merge["startRow"], merge["endRow"] + 1)
            for c in range(merge["startColumn"], merge["endColumn"] + 1)
            if (r, c) != (merge["startRow"], merge["startColumn"])
        }
        for r, row in cell_data.items():
            for c, data in (row or {}).items():
                if isinstance(data, dict) and data and (int(r), int(c)) not in hidden:
                    self.write_cell(ws, (int(r), int(c)), data, masters)


def _rich_text(cell: dict[str, Any]) -> Optional[str]:
    text = ((cell.get("p") or {}).get("body") or {}).get("dataStream")
    if not isinstance(text, str):
        return None
    return re.sub(r"\r?\n$", "", text)


def _cell_value(data: dict[str, Any]) -> Optional[CellValue]:
    value = data.get("v")
    if value is None:
        value = _rich_text(data)
    if data.get("t") == CELL_TYPE_BOOLEAN and value is not None:
        return value is True or value == 1 or str(value).upper() == "TRUE"
    return value


def _shared_formulas(cell_data: dict[str, Any]) -> dict[str, tuple[str, str]]:
    """Shared formula id to its formula and the cell it is written for."""
    masters: dict[str, tuple[str, str]] = {}
    for r, row in cell_data.items():
        for c, cell in (row or {}).items():
            if isinstance(cell, dict) and cell.get("si") and cell.get("f"):
                address = xl_rowcol_to_cell(int(r), int(c))
                masters.setdefault(cell["si"], (cell["f"], address))
    return masters


def _cell_formula(
    data: dict[str, Any], address: str, masters: dict[str, tuple[str, str]]
) -> Optional[str]:
    formula = data.get("f")
    if not formula and data.get("si") in masters:
        master_formula, origin = masters[data["si"]]
        formula = Translator(master_formula, origin=origin).translate_formula(address)
    if not formula:
        return None
    return formula if formula.startswith("=") else f"={formula}"


def _set_layout(ws: Worksheet, sheet: dict[str, Any]) -> None:
    """Default row height, gridlines and frozen panes."""
    ws.set_default_row(
        (sheet.get("defaultRowHeight") or DEFAULT_ROW_HEIGHT) * PT_PER_PX
    )
    if sheet.get("showGridlines") == 0:
        ws.hide_gridlines(2)
    freeze = sheet.get("freeze") or {}
    x_split = max(int(freeze.get("xSplit") or 0), 0)
    y_split = max(int(freeze.get("ySplit") or 0), 0)
    if x_split or y_split:
        ws.freeze_panes(y_split, x_split)


def _outline_levels(
    groups: list[OutlineGroup], summary_above: bool = False
) -> tuple[dict[int, int], set[int]]:
    """
    Excel outline level of each row (or column) in a group, and the total
    rows (after the group, or before it) of collapsed groups, which Excel
    marks as collapsed.
    """
    levels: dict[int, int] = {}
    for group in groups:
        for i in range(group["start"], group["end"] + 1):
            # Excel has at most 7 levels
            levels[i] = min(levels.get(i, 0) + 1, 7)
    collapsed = {
        group["start"] - 1 if summary_above else group["end"] + 1
        for group in groups
        if group.get("collapsed")
    }
    return levels, collapsed


def _dimension_options(
    hidden: bool, level: int, collapsed: bool
) -> Optional[dict[str, Any]]:
    options = {"hidden": hidden, "level": level, "collapsed": collapsed}
    return {key: value for key, value in options.items() if value} or None


def _set_dimensions(ws: Worksheet, sheet: dict[str, Any]) -> None:
    """Column widths, row heights, hidden rows and columns, and groups."""
    outline = cast(Outline, sheet.get(OUTLINE_KEY) or {"rows": [], "columns": []})
    column_levels, collapsed_columns = _outline_levels(outline["columns"])
    summary_above = bool(outline.get("summaryAbove"))
    row_levels, collapsed_rows = _outline_levels(outline["rows"], summary_above)
    if summary_above:
        ws.outline_settings(True, False, True, False)

    default_width = sheet.get("defaultColumnWidth") or DEFAULT_COL_WIDTH
    columns = sheet.get("columnData") or {}
    count = max(
        [
            sheet.get("columnCount") or 0,
            *[int(c) + 1 for c in columns],
            *[c + 1 for c in column_levels],
        ]
    )
    for c in range(count):
        column = columns.get(str(c)) or {}
        ws.set_column_pixels(
            c,
            c,
            column.get("w") or default_width,
            None,
            _dimension_options(
                bool(column.get("hd")),
                column_levels.get(c, 0),
                c in collapsed_columns,
            ),
        )

    rows = sheet.get("rowData") or {}
    indexes = {
        int(r) for r, row in rows.items() if row and (row.get("h") or row.get("hd"))
    }
    for r in sorted(indexes | set(row_levels) | collapsed_rows):
        row = rows.get(str(r)) or {}
        ws.set_row_pixels(
            r,
            row.get("h") or sheet.get("defaultRowHeight") or DEFAULT_ROW_HEIGHT,
            None,
            _dimension_options(
                bool(row.get("hd")), row_levels.get(r, 0), r in collapsed_rows
            ),
        )


def _sheet_names(sheets: list[dict[str, Any]]) -> list[str]:
    """Sheet names Excel accepts: no []:*?/\\, at most 31 characters, unique."""
    names: list[str] = []
    for i, sheet in enumerate(sheets):
        base = re.sub(r"[\[\]:*?/\\]", "_", str(sheet.get("name") or ""))
        base = base.strip("'")[:31] or f"Sheet{i + 1}"
        name, n = base, 1
        while name.lower() in (existing.lower() for existing in names):
            n += 1
            name = f"{base[: 31 - len(str(n)) - 1]}_{n}"
        names.append(name)
    return names


def workbook_to_excel(workbook: UniverWorkbook) -> bytes:
    """Writes Univer workbook data as an .xlsx file."""
    output = io.BytesIO()
    book = xlsxwriter.Workbook(
        output,
        {
            "in_memory": True,
            # text in cells stays text, formulas come only from formula cells
            "strings_to_formulas": False,
            "strings_to_numbers": False,
            "strings_to_urls": False,
        },
    )
    writer = _Writer(book, workbook.get("styles") or {})
    all_sheets = workbook.get("sheets") or {}
    sheets = [
        all_sheets[sheet_id]
        for sheet_id in workbook.get("sheetOrder") or []
        if all_sheets.get(sheet_id)
    ]
    for sheet, name in zip(sheets, _sheet_names(sheets), strict=True):
        writer.add_sheet(sheet, name)
    if not sheets:
        book.add_worksheet("Data")
    _hide_sheets(book, sheets)
    book.close()
    return output.getvalue()


def _hide_sheets(book: xlsxwriter.Workbook, sheets: list[dict[str, Any]]) -> None:
    """Hides the sheets hidden in the chart, Excel needs one to stay visible."""
    visible = [i for i, sheet in enumerate(sheets) if not sheet.get("hidden")]
    if not visible:
        return
    worksheets = book.worksheets()
    worksheets[visible[0]].activate()
    for i, sheet in enumerate(sheets):
        if sheet.get("hidden"):
            worksheets[i].hide()


def df_to_univer_excel(
    df: pd.DataFrame,
    coltypes: list[GenericDataType],
    form_data: dict[str, Any],
    labels: Optional[dict[str, str]] = None,
) -> bytes:
    """
    The spreadsheet chart as an .xlsx file: the query result in ``df`` and the
    user's saved edits. ``labels`` are the verbose names shown in the headers.
    """
    labels = labels or {}
    if form_data.get("query_mode") == PIVOT_MODE:
        row_fields = len(form_data.get(PIVOT_ROWS_CONTROL) or [])
        grid, layout = build_pivot_grid(df, coltypes, labels, row_fields)
    else:
        grid, layout = build_grid(df, coltypes, labels), default_layout()
    saved = parse_saved_state(form_data.get(WORKBOOK_CONTROL))
    live_data = (
        True
        if form_data.get(LIVE_DATA_CONTROL) is None
        else bool(form_data.get(LIVE_DATA_CONTROL))
    )
    key_columns = _key_columns(form_data)
    automatic: list[OutlineGroup] = []
    if form_data.get(ROW_GROUPING_CONTROL) and (key_columns or 0) > 1:
        # a pivot has its own Total row
        grid, layout, automatic = group_rows(
            grid,
            layout,
            key_columns or 0,
            form_data.get("query_mode") != PIVOT_MODE,
        )
    workbook = build_workbook(grid, saved, live_data, layout)
    from_query = live_data or bool(saved and saved.get("stripped"))
    outline = resolve_outline(
        (saved or {}).get("outline"),
        grid if from_query else [],
        layout["headerRows"],
        key_columns,
    )
    if not MANUAL_GROUPS:
        # only the collapsed state of the automatic groups is kept
        outline["rows"] = [
            group
            for group in outline["rows"]
            if any(
                auto["start"] == group["start"] and auto["end"] == group["end"]
                for auto in automatic
            )
        ]
        outline["columns"] = []
    outline["rows"] = combine_groups(automatic, outline["rows"])
    if automatic:
        outline["summaryAbove"] = True
    apply_outline(workbook, outline, grid)
    return workbook_to_excel(workbook)


def _key_columns(form_data: dict[str, Any]) -> Optional[int]:
    """How many of the first columns identify a row, as in transformProps."""
    if form_data.get("query_mode") == PIVOT_MODE:
        return len(form_data.get(PIVOT_ROWS_CONTROL) or [])
    if form_data.get("query_mode") == "raw":
        return None
    return len(form_data.get("groupby") or []) or None
