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
Grid placement shared by the root and grid containers.

Children are resolved in reading order (their order in ``children``):

- An explicitly placed child (``col``/``row`` set) keeps its column. If it
  overlaps a child resolved before it, it is pushed straight down until clear,
  and the pushed ``row`` is written back to its layout.
- An auto-placed child (``col``/``row`` omitted) takes the first free slot that
  fits its span, scanning row by row from a cursor that only moves forward.
  Its layout keeps ``col``/``row`` omitted.

Reading order is also what decides who yields, so dropping a widget moves it
within that order: see ``insert_index``.

Clients don't re-implement these rules, with one exception: a drag has to show
where the neighbours will end up *before* the write, so the client mirrors them
in ``resolveGrid.ts``. The two are kept in step by ``gridCases.json``, which
both test suites read.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Rect:
    col: int
    row: int
    col_span: int
    row_span: int

    def cells(self) -> set[tuple[int, int]]:
        return {
            (row, col)
            for row in range(self.row, self.row + self.row_span)
            for col in range(self.col, self.col + self.col_span)
        }


def span_errors(layout: dict[str, Any], columns: int) -> list[str]:
    """Reasons ``layout`` does not fit a grid of ``columns`` columns."""
    col_span = layout.get("colSpan") or columns
    col = layout.get("col") or 1
    if col_span > columns:
        return [f"colSpan {col_span} exceeds the grid's {columns} columns"]
    if col + col_span - 1 > columns:
        return [f"col {col} with colSpan {col_span} overflows {columns} columns"]
    return []


def resolve_grid(
    layouts: list[dict[str, Any]], columns: int
) -> tuple[list[Rect], list[dict[str, Any]]]:
    """
    Resolve placement for children in reading order.

    Returns the resolved rectangles and the layouts to store, where explicitly
    placed children that collided carry their pushed-down ``row``.
    """
    occupied: set[tuple[int, int]] = set()
    cursor_row, cursor_col = 1, 1
    rects: list[Rect] = []
    stored: list[dict[str, Any]] = []

    for layout in layouts:
        col_span = min(layout.get("colSpan") or columns, columns)
        row_span = layout.get("rowSpan") or 1

        if layout.get("col") is not None:
            rect = Rect(layout["col"], layout["row"], col_span, row_span)
            while rect.cells() & occupied:
                rect = Rect(rect.col, rect.row + 1, col_span, row_span)
            stored.append({**layout, "row": rect.row})
        else:
            row, col = cursor_row, cursor_col
            while True:
                if col + col_span - 1 > columns:
                    row, col = row + 1, 1
                    continue
                rect = Rect(col, row, col_span, row_span)
                if not rect.cells() & occupied:
                    break
                col += 1
            cursor_row, cursor_col = rect.row, rect.col + col_span
            stored.append(dict(layout))

        occupied |= rect.cells()
        rects.append(rect)

    return rects, stored


def insert_index(rects: list[Rect], target: Rect) -> int:
    """
    Where a node dropped at ``target`` belongs in reading order.

    ``rects`` is the siblings it is being dropped among, already resolved and
    without the dropped node, in reading order.

    An overlap pushes the *later* child down, so a widget dropped onto earlier
    siblings would be pushed back under them and nothing could be dropped
    between two others. It goes before the first sibling it overlaps, or that
    starts after it by row and then column, and last if there is no such
    sibling.

    Landing on a sibling is above it or below it depending on where: past the
    sibling's middle is below it. Without that, aiming at the bottom of a tall
    neighbour -- a ten-row group, say -- still counts as landing on it, so the
    widget is inserted ahead and the whole group is pushed down underneath
    something dropped at its feet.
    """
    for i, rect in enumerate(rects):
        if rect.cells() & target.cells():
            if target.row < rect.row + rect.row_span / 2:
                return i
            continue
        if (rect.row, rect.col) >= (target.row, target.col):
            return i
    return len(rects)
