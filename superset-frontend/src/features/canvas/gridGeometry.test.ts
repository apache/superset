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

import {
  columnWidth,
  gridDelta,
  movedPlacement,
  overlappedSiblings,
  placementsOverlap,
  resizedPlacement,
  samePlacement,
} from './gridGeometry';
import type { GridPlacement } from './types';

// A 24-column grid 1000px wide with the canvas defaults: the 23 gaps take
// 368px, so the columns share 632px — 26.33px each, a 42.33px column pitch.
// Rows are a flat 40px plus the gap, a 56px row pitch.
const metrics = { columns: 24, gap: 16, rowUnit: 40 };
const WIDTH = 1000;
const COL_PITCH = 632 / 24 + 16;

const placement = (
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
): GridPlacement => ({ col, row, colSpan, rowSpan });

test('a column is what the gaps leave, shared evenly', () => {
  expect(columnWidth(WIDTH, metrics)).toBeCloseTo(26.33);
  // One column and no gaps takes the whole width.
  expect(columnWidth(WIDTH, { ...metrics, columns: 1 })).toBe(WIDTH);
});

test('a pointer delta snaps to the nearest whole cell', () => {
  // Just under half a column pitch rounds back to no movement.
  expect(gridDelta(20, 0, WIDTH, metrics)).toEqual({ cols: 0, rows: 0 });
  // Just over half rounds on to the next column.
  expect(gridDelta(23, 0, WIDTH, metrics)).toEqual({ cols: 1, rows: 0 });
  expect(gridDelta(COL_PITCH * 3, 56 * 2, WIDTH, metrics)).toEqual({
    cols: 3,
    rows: 2,
  });
  // Dragging up and left gives negative units.
  expect(gridDelta(-COL_PITCH, -56, WIDTH, metrics)).toEqual({
    cols: -1,
    rows: -1,
  });
});

test('an unmeasured grid yields no movement, whatever the pointer did', () => {
  expect(gridDelta(500, 500, 0, metrics)).toEqual({ cols: 0, rows: 0 });
  expect(gridDelta(500, 500, -1, metrics)).toEqual({ cols: 0, rows: 0 });
});

test('a grid too narrow for its gaps still has non-negative columns', () => {
  // 10px across 24 columns with 16px gaps: the gaps alone want 368px.
  expect(columnWidth(10, metrics)).toBe(0);
});

test('moving keeps the widget whole inside the grid', () => {
  const widget = placement(1, 1, 6, 4);

  expect(movedPlacement(widget, { cols: 3, rows: 2 }, 24)).toEqual(
    placement(4, 3, 6, 4),
  );
  // Stops at the last column that still fits all 6 columns of span.
  expect(movedPlacement(widget, { cols: 100, rows: 0 }, 24)).toEqual(
    placement(19, 1, 6, 4),
  );
  // Can't be dragged off the top or the left.
  expect(movedPlacement(widget, { cols: -5, rows: -5 }, 24)).toEqual(
    placement(1, 1, 6, 4),
  );
});

test('moving never changes the spans', () => {
  const moved = movedPlacement(placement(2, 2, 8, 3), { cols: 4, rows: 1 }, 24);

  expect(moved.colSpan).toBe(8);
  expect(moved.rowSpan).toBe(3);
});

test('resizing grows towards the bottom right, stopping at the grid edge', () => {
  const widget = placement(19, 1, 6, 4);

  expect(resizedPlacement(widget, { cols: -3, rows: 2 }, 24)).toEqual(
    placement(19, 1, 3, 6),
  );
  // Only 6 columns remain from column 19, so the span can't exceed that.
  expect(resizedPlacement(widget, { cols: 50, rows: 0 }, 24)).toEqual(
    placement(19, 1, 6, 4),
  );
  // A span is always at least one cell.
  expect(resizedPlacement(widget, { cols: -50, rows: -50 }, 24)).toEqual(
    placement(19, 1, 1, 1),
  );
});

test("resizing honours the widget's declared span limits", () => {
  const widget = placement(1, 1, 6, 4);
  const limits = {
    minColSpan: 4,
    maxColSpan: 8,
    minRowSpan: 2,
    maxRowSpan: 6,
  };

  expect(
    resizedPlacement(widget, { cols: -10, rows: -10 }, 24, limits),
  ).toEqual(placement(1, 1, 4, 2));
  expect(resizedPlacement(widget, { cols: 10, rows: 10 }, 24, limits)).toEqual(
    placement(1, 1, 8, 6),
  );
});

test('the grid edge wins over a widget maximum that reaches past it', () => {
  // 20 columns of span would fit the widget's maximum but not the grid.
  const widget = placement(10, 1, 6, 2);

  expect(
    resizedPlacement(widget, { cols: 20, rows: 0 }, 24, { maxColSpan: 20 }),
  ).toEqual(placement(10, 1, 15, 2));
});

test('placements compare by the cells they take', () => {
  expect(samePlacement(placement(1, 2, 3, 4), placement(1, 2, 3, 4))).toBe(
    true,
  );
  expect(samePlacement(placement(1, 2, 3, 4), placement(1, 2, 3, 5))).toBe(
    false,
  );
});

test('placements overlap only when they share a cell', () => {
  const widget = placement(5, 5, 4, 4); // cols 5-8, rows 5-8

  expect(placementsOverlap(widget, placement(8, 8, 2, 2))).toBe(true);
  // Flush neighbours on each side touch but do not overlap.
  expect(placementsOverlap(widget, placement(9, 5, 4, 4))).toBe(false);
  expect(placementsOverlap(widget, placement(1, 5, 4, 4))).toBe(false);
  expect(placementsOverlap(widget, placement(5, 9, 4, 4))).toBe(false);
  expect(placementsOverlap(widget, placement(5, 1, 4, 4))).toBe(false);
  // A placement always overlaps itself.
  expect(placementsOverlap(widget, widget)).toBe(true);
});

test('overlapped siblings name what a drop would land on, never itself', () => {
  const placements = {
    a: placement(1, 1, 6, 4),
    b: placement(7, 1, 6, 4),
    c: placement(1, 5, 24, 4),
  };
  const siblings = ['a', 'b', 'c'];

  // Dragging 'a' onto 'b'.
  expect(
    overlappedSiblings(placement(7, 1, 6, 4), siblings, placements, 'a'),
  ).toEqual(['b']);
  // A wide drop can cover more than one.
  expect(
    overlappedSiblings(placement(1, 1, 24, 8), siblings, placements, 'a'),
  ).toEqual(['b', 'c']);
  // Free space collides with nothing.
  expect(
    overlappedSiblings(placement(13, 1, 6, 4), siblings, placements, 'a'),
  ).toEqual([]);
  // An id with no placement is ignored rather than throwing.
  expect(
    overlappedSiblings(
      placement(1, 1, 6, 4),
      [...siblings, 'gone'],
      placements,
      'a',
    ),
  ).toEqual([]);
});
