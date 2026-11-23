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

    @property
    def right(self) -> int:
        """The first column past this rectangle."""
        return self.col + self.col_span

    @property
    def bottom(self) -> int:
        """The first row past this rectangle."""
        return self.row + self.row_span

    def overlaps(self, other: Rect) -> bool:
        return (
            self.col < other.right
            and other.col < self.right
            and self.row < other.bottom
            and other.row < self.bottom
        )


def _blocker(rect: Rect, placed: list[Rect]) -> Rect | None:
    return next((other for other in placed if rect.overlaps(other)), None)


def _next_row(row: int, row_span: int, placed: list[Rect]) -> int:
    """
    The first row past ``row`` where a ``row_span``-tall band can have room
    that it has none of at ``row``: where something in that band ends.

    Every position blocked at ``row`` stays blocked until its blocker ends, so
    the rows in between need no checking. Without the jump a tall widget is
    stepped down one row at a time past everything above it.
    """
    return min(
        (
            other.bottom
            for other in placed
            if other.row < row + row_span and other.bottom > row
        ),
        default=row + 1,
    )


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
    placed: list[Rect] = []
    cursor_row, cursor_col = 1, 1
    rects: list[Rect] = []
    stored: list[dict[str, Any]] = []

    for layout in layouts:
        col_span = min(layout.get("colSpan") or columns, columns)
        row_span = layout.get("rowSpan") or 1

        if layout.get("col") is not None:
            home = layout["col"]
            rect = Rect(home, layout["row"], col_span, row_span)
            while blocker := _blocker(rect, placed):
                # Every column short of the blocker's right edge still
                # overlaps it, so the slide skips straight past it.
                if blocker.right + col_span - 1 <= columns:
                    # Room beside it on this row: a widget dropped on the left
                    # half of a row should slide its neighbour into the free
                    # right half, not send it to a row of its own and leave
                    # that half empty.
                    rect = Rect(blocker.right, rect.row, col_span, row_span)
                else:
                    # The row is full to the right, so down it goes -- back at
                    # the column it asked for.
                    row = _next_row(rect.row, row_span, placed)
                    rect = Rect(home, row, col_span, row_span)
            stored.append({**layout, "col": rect.col, "row": rect.row})
        else:
            row, col = cursor_row, cursor_col
            # Only a row scanned from its first column is known to be full.
            whole_row = col == 1
            while True:
                if col + col_span - 1 > columns:
                    row = _next_row(row, row_span, placed) if whole_row else row + 1
                    col, whole_row = 1, True
                    continue
                rect = Rect(col, row, col_span, row_span)
                if (blocker := _blocker(rect, placed)) is None:
                    break
                col = blocker.right
            cursor_row, cursor_col = rect.row, rect.col + col_span
            stored.append(dict(layout))

        placed.append(rect)
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


def swap_places(
    children: list[str],
    layouts: dict[str, dict[str, Any]],
    columns: int,
    node_id: str,
    partner_id: str,
) -> tuple[dict[str, dict[str, Any]], list[str], list[Rect]]:
    """
    Where a grid settles once two of its children exchange places.

    Resolved first, so a child that was auto-placed exchanges where it
    actually sits rather than the nothing its layout says. Each takes the
    other's slot at its own size, and only the one being moved is reordered --
    the one it displaces is going where that child just was, which is free.

    Returns the two new layouts, and the order and rectangles the grid settles
    on. One function because the client mirrors it: split across two calls,
    the two sides could agree on each half and still disagree on the result.
    """
    rects, _ = resolve_grid([layouts.get(child) or {} for child in children], columns)
    at = dict(zip(children, rects, strict=True))

    def taking(child: str, slot: Rect) -> dict[str, Any]:
        # Far enough left for its own width to fit: a wider child changing
        # places with a narrower one would otherwise start where the narrow
        # one did and run off the grid, which ``span_errors`` rejects --
        # taking the whole exchange with it.
        col = max(1, min(slot.col, columns - at[child].col_span + 1))
        return {**(layouts.get(child) or {}), "col": col, "row": slot.row}

    exchanged = {
        node_id: taking(node_id, at[partner_id]),
        partner_id: taking(partner_id, at[node_id]),
    }
    order, settled = replay_places(
        children,
        {**layouts, **exchanged},
        [(node_id, exchanged[node_id])],
        columns,
    )
    return exchanged, order, settled


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
        if rect.overlaps(target):
            if target.row < rect.row + rect.row_span / 2:
                return i
            continue
        if (rect.row, rect.col) >= (target.row, target.col):
            return i
    return len(rects)
