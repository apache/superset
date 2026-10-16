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
): GridPlacement {
  const room = columns - placement.col + 1;
  const maxColSpan = Math.min(constraints.maxColSpan ?? columns, room);
  // The stored placement already satisfies the widget's minimum, so this
  // range is non-empty; the guard only keeps it that way if limits change.
  const minColSpan = Math.min(constraints.minColSpan ?? 1, maxColSpan);
  const maxRowSpan = constraints.maxRowSpan ?? Number.MAX_SAFE_INTEGER;
  const minRowSpan = Math.min(constraints.minRowSpan ?? 1, maxRowSpan);
  return {
    ...placement,
    colSpan: clamp(placement.colSpan + delta.cols, minColSpan, maxColSpan),
    rowSpan: clamp(placement.rowSpan + delta.rows, minRowSpan, maxRowSpan),
  };
}

/** Whether two placements describe the same cells. */
export const samePlacement = (a: GridPlacement, b: GridPlacement): boolean =>
  a.col === b.col &&
  a.row === b.row &&
  a.colSpan === b.colSpan &&
  a.rowSpan === b.rowSpan;

/** Whether two placements share at least one cell. */
export const placementsOverlap = (
  a: GridPlacement,
  b: GridPlacement,
): boolean =>
  a.col < b.col + b.colSpan &&
  b.col < a.col + a.colSpan &&
  a.row < b.row + b.rowSpan &&
  b.row < a.row + a.rowSpan;

/**
 * The siblings `target` would land on top of, ignoring `moving` itself.
 *
 * Used to warn before a drop, not to resolve it: the server decides what
 * actually happens to an overlap (it pushes whichever widget comes later in
 * reading order straight down).
 */
export function overlappedSiblings(
  target: GridPlacement,
  siblingIds: string[],
  placements: Record<string, GridPlacement>,
  moving: string,
): string[] {
  return siblingIds.filter(nodeId => {
    if (nodeId === moving) return false;
    const other = placements[nodeId];
    return other !== undefined && placementsOverlap(target, other);
  });
}
