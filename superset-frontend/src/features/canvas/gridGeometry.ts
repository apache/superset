/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * @fileoverview Turning pointer movement into grid placement.
 *
 * A drag or resize is a pointer delta in pixels; a placement is in whole grid
 * units. These helpers convert between the two and clamp the result to the
 * grid and to the widget's declared span limits, so a gesture can only ever
 * produce a layout the server also accepts.
 *
 * Collision resolution is deliberately absent: the server owns push-down (see
 * `superset/canvas/definition/grid.py`) and returns resolved placements after
 * the write, so nothing here guesses where other widgets end up.
 */

import type { GridPlacement, SpanConstraints } from './types';

export interface GridMetrics {
  columns: number;
  gap: number;
  rowUnit: number;
}

/** A gesture's movement, in whole grid units. */
export interface GridDelta {
  cols: number;
  rows: number;
}

export const NO_DELTA: GridDelta = { cols: 0, rows: 0 };

/** Which corner of a widget a resize is being dragged by. */
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export const RESIZE_CORNERS: ResizeCorner[] = ['nw', 'ne', 'sw', 'se'];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Width in pixels of one column on a grid of `width` pixels.
 *
 * Mirrors `grid-template-columns: repeat(columns, minmax(0, 1fr))` with
 * `gap`: the columns share whatever the gaps leave.
 */
export function columnWidth(width: number, metrics: GridMetrics): number {
  const { columns, gap } = metrics;
  if (columns <= 0) return 0;
  // A grid narrower than its own gaps would give a negative column, which
  // would then invert the direction of every gesture.
  return Math.max(0, (width - gap * (columns - 1)) / columns);
}

/**
 * A pointer delta in pixels as whole grid units, rounded to the nearest cell
 * so a gesture snaps rather than drifting.
 */
export function gridDelta(
  dx: number,
  dy: number,
  width: number,
  metrics: GridMetrics,
): GridDelta {
  // An unmeasured grid has no cells to snap to, so nothing has moved yet.
  if (width <= 0) return NO_DELTA;
  const colPitch = columnWidth(width, metrics) + metrics.gap;
  const rowPitch = metrics.rowUnit + metrics.gap;
  return {
    cols: colPitch > 0 ? Math.round(dx / colPitch) : 0,
    rows: rowPitch > 0 ? Math.round(dy / rowPitch) : 0,
  };
}

/**
 * `placement` moved by `delta`, kept inside the grid.
 *
 * The spans don't change, so the widget stays whole: it stops at the right
 * edge rather than being clipped, and can't move above the first row.
 */
export function movedPlacement(
  placement: GridPlacement,
  delta: GridDelta,
  columns: number,
): GridPlacement {
  const lastCol = Math.max(1, columns - placement.colSpan + 1);
  return {
    ...placement,
    col: clamp(placement.col + delta.cols, 1, lastCol),
    row: Math.max(1, placement.row + delta.rows),
  };
}

/**
 * `placement` resized by `delta`, kept inside the grid and within the
 * widget's declared limits.
 *
 * `col`/`row` stay put, so resizing grows or shrinks towards the bottom
 * right. A column span can't reach past the grid's last column, whatever the
 * widget's own maximum allows.
 */
export function resizedPlacement(
  placement: GridPlacement,
  delta: GridDelta,
  columns: number,
  constraints: SpanConstraints = {},
  corner: ResizeCorner = 'se',
): GridPlacement {
  // The corner being dragged moves; the one opposite it stays put. Dragging a
  // west or north edge outwards means a negative delta, so the span grows as
  // the delta shrinks.
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const right = placement.col + placement.colSpan - 1;
  const bottom = placement.row + placement.rowSpan - 1;

  // Room for the span, measured from whichever edge is anchored: to the
  // grid's last column going east, or back to column 1 going west.
  const colRoom = west ? right : columns - placement.col + 1;
  const maxColSpan = Math.min(constraints.maxColSpan ?? columns, colRoom);
  // The stored placement already satisfies the widget's minimum, so this
  // range is non-empty; the guard only keeps it that way if limits change.
  const minColSpan = Math.min(constraints.minColSpan ?? 1, maxColSpan);
  const colSpan = clamp(
    placement.colSpan + (west ? -delta.cols : delta.cols),
    minColSpan,
    maxColSpan,
  );

  // Rows are unbounded downwards; going north they stop at row 1.
  const rowRoom = north ? bottom : Number.MAX_SAFE_INTEGER;
  const maxRowSpan = Math.min(
    constraints.maxRowSpan ?? Number.MAX_SAFE_INTEGER,
    rowRoom,
  );
  const minRowSpan = Math.min(constraints.minRowSpan ?? 1, maxRowSpan);
  const rowSpan = clamp(
    placement.rowSpan + (north ? -delta.rows : delta.rows),
    minRowSpan,
    maxRowSpan,
  );

  // The anchored edge is what fixes col/row, so a span stopped by a limit
  // stops the dragged edge with it rather than sliding the widget.
  return {
    col: west ? right - colSpan + 1 : placement.col,
    row: north ? bottom - rowSpan + 1 : placement.row,
    colSpan,
    rowSpan,
  };
}

/** Whether two placements describe the same cells. */
export const samePlacement = (a: GridPlacement, b: GridPlacement): boolean =>
  a.col === b.col &&
  a.row === b.row &&
  a.colSpan === b.colSpan &&
  a.rowSpan === b.rowSpan;

/** Where a grid sits on screen, and how wide its content box is. */
export interface GridBox {
  left: number;
  top: number;
  width: number;
}

/**
 * Where a widget lands in a grid it did not start in.
 *
 * `offsetX`/`offsetY` are where inside the widget it was grabbed, in pixels,
 * so it keeps that relationship to the pointer rather than jumping its own
 * corner under it.
 *
 * The column span is carried over as a *proportion* of the grid it came
 * from, not as a number of columns: a widget filling a twelve-column group
 * fills the twenty-four-column canvas it is dragged onto, rather than
 * arriving at half the width it had a moment ago. Rows are the same height
 * everywhere, so the row span is kept as it is.
 */
export function placementAt(
  clientX: number,
  clientY: number,
  offsetX: number,
  offsetY: number,
  box: GridBox,
  metrics: GridMetrics,
  spans: { colSpan: number; rowSpan: number },
  fromColumns: number,
): GridPlacement {
  const { columns, gap, rowUnit } = metrics;
  const colPitch = columnWidth(box.width, metrics) + gap;
  const rowPitch = rowUnit + gap;
  const colSpan = clamp(
    fromColumns > 0
      ? Math.round((spans.colSpan / fromColumns) * columns)
      : spans.colSpan,
    1,
    columns,
  );
  const lastCol = Math.max(1, columns - colSpan + 1);
  const col =
    colPitch > 0
      ? Math.round((clientX - offsetX - box.left) / colPitch) + 1
      : 1;
  const row =
    rowPitch > 0 ? Math.round((clientY - offsetY - box.top) / rowPitch) + 1 : 1;
  return {
    col: clamp(col, 1, lastCol),
    row: Math.max(1, row),
    colSpan,
    rowSpan: spans.rowSpan,
  };
}
