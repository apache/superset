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

- An explicitly placed child (``col``/``row`` set) that overlaps a child
  resolved before it moves aside: along its own row while there is room to its
  right, and only down once the row is full, back at the column it asked for.
  Where it settles is written back to its layout.

  Sideways first because a row usually has room in it. Pushing straight down
  sent a neighbour to a row of its own while the space beside it stayed empty,
  so dropping one widget beside another took a drop and then a drag back.
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
    placed children that collided carry the ``col``/``row`` they settled on.
    """
    occupied: set[tuple[int, int]] = set()
    cursor_row, cursor_col = 1, 1
    rects: list[Rect] = []
    stored: list[dict[str, Any]] = []

    for layout in layouts:
        col_span = min(layout.get("colSpan") or columns, columns)
        row_span = layout.get("rowSpan") or 1

        if layout.get("col") is not None:
            home = layout["col"]
            rect = Rect(home, layout["row"], col_span, row_span)
            while rect.cells() & occupied:
                if rect.col + col_span - 1 < columns:
                    # Room beside it on this row: a widget dropped on the left
                    # half of a row should slide its neighbour into the free
                    # right half, not send it to a row of its own and leave
                    # that half empty.
                    rect = Rect(rect.col + 1, rect.row, col_span, row_span)
                else:
                    # The row is full to the right, so down it goes -- back at
                    # the column it asked for, since nothing on the next row
                    # is in its way yet.
                    rect = Rect(home, rect.row + 1, col_span, row_span)
            stored.append({**layout, "col": rect.col, "row": rect.row})
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


def _target_rect(layout: dict[str, Any], columns: int) -> Rect:
    """The rectangle ``layout`` asks for, before anything is resolved."""
    col_span = min(layout.get("colSpan") or columns, columns)
    return Rect(layout["col"], layout["row"], col_span, layout.get("rowSpan") or 1)


def place_index(
    sibling_layouts: list[dict[str, Any]],
    layout: dict[str, Any],
    columns: int,
) -> int:
    """
    Where a node placed at ``layout`` belongs among its siblings.

    ``sibling_layouts`` is every *other* child, in reading order. Resolving
    them first is what ``insert_index`` compares against: the dropped node is
    placed among where they actually sit, not where they asked to.
    """
    rects, _ = resolve_grid(sibling_layouts, columns)
    return insert_index(rects, _target_rect(layout, columns))


def replay_places(
    children: list[str],
    layouts: dict[str, dict[str, Any]],
    ops: list[tuple[str, dict[str, Any]]],
    columns: int,
) -> tuple[list[str], list[Rect]]:
    """
    Where a grid settles after ``ops`` are applied to it in order.

    Each operation gives a node a layout and moves it in reading order, and the
    next one runs against the grid that leaves behind -- which is why applying
    two of them is not the same as deciding both against the grid as it stands
    now. A client previewing a drop replays the very operations it is about to
    send through this, rather than predicting their combined effect, so what it
    draws is what the write produces.

    Returns the children in their settled order and their resolved rectangles,
    aligned with it.
    """
    order = list(children)
    settled = dict(layouts)

    for node_id, layout in ops:
        settled[node_id] = layout
        # Auto-placed nodes keep their order: they have no ``col`` to drop at.
        if layout.get("col") is None:
            continue
        others = [child for child in order if child != node_id]
        index = place_index(
            [settled.get(child) or {} for child in others], layout, columns
        )
        others.insert(index, node_id)
        order = others

    rects, _ = resolve_grid([settled.get(child) or {} for child in order], columns)
    return order, rects


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
