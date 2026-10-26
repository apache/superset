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
  RESIZE_CORNERS,
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

test('dragging the south-west corner keeps the right edge still', () => {
  // cols 10-15, rows 5-8. Pulling left widens without moving the right edge.
  const widget = placement(10, 5, 6, 4);

  expect(resizedPlacement(widget, { cols: -3, rows: 0 }, 24, {}, 'sw')).toEqual(
    placement(7, 5, 9, 4),
  );
  // Pushing right narrows it, right edge still at column 15.
  expect(resizedPlacement(widget, { cols: 2, rows: 0 }, 24, {}, 'sw')).toEqual(
    placement(12, 5, 4, 4),
  );
  // It can reach column 1 and no further.
  expect(
    resizedPlacement(widget, { cols: -50, rows: 0 }, 24, {}, 'sw'),
  ).toEqual(placement(1, 5, 15, 4));
});

test('dragging the north-east corner keeps the bottom edge still', () => {
  const widget = placement(10, 5, 6, 4);

  // Pulling up grows it upwards; bottom stays at row 8.
  expect(resizedPlacement(widget, { cols: 0, rows: -2 }, 24, {}, 'ne')).toEqual(
    placement(10, 3, 6, 6),
  );
  // It can reach row 1 and no further.
  expect(
    resizedPlacement(widget, { cols: 0, rows: -50 }, 24, {}, 'ne'),
  ).toEqual(placement(10, 1, 6, 8));
  // Columns still grow eastward from the same origin.
  expect(resizedPlacement(widget, { cols: 3, rows: 0 }, 24, {}, 'ne')).toEqual(
    placement(10, 5, 9, 4),
  );
});

test('dragging the north-west corner keeps the bottom-right still', () => {
  const widget = placement(10, 5, 6, 4);

  expect(
    resizedPlacement(widget, { cols: -2, rows: -1 }, 24, {}, 'nw'),
  ).toEqual(placement(8, 4, 8, 5));
  // Both edges stop at the grid's start.
  expect(
    resizedPlacement(widget, { cols: -50, rows: -50 }, 24, {}, 'nw'),
  ).toEqual(placement(1, 1, 15, 8));
});

test('a span stopped by its minimum stops the dragged edge with it', () => {
  // Shrinking from the west: once colSpan hits 4, `col` must stop too rather
  // than sliding the widget across the grid.
  const widget = placement(10, 5, 6, 4);
  const limits = { minColSpan: 4 };

  expect(
    resizedPlacement(widget, { cols: 50, rows: 0 }, 24, limits, 'sw'),
  ).toEqual(placement(12, 5, 4, 4));
});

test('every corner leaves a zero delta exactly where it was', () => {
  const widget = placement(10, 5, 6, 4);

  RESIZE_CORNERS.forEach(corner => {
    expect(
      resizedPlacement(widget, { cols: 0, rows: 0 }, 24, {}, corner),
    ).toEqual(widget);
  });
});

test('a container cannot be shrunk below the rows its content needs', () => {
  // The server grows a container to fit its children and never shrinks it, so
  // a span below that is replaced on write. Dragging a north corner anchors
  // the bottom edge, so computing the shrink against a minimum of 1 would send
  // a row the server keeps with a span it discards -- the container's bottom
  // edge would move *down* into the widgets below instead of shrinking.
  const group: GridPlacement = { col: 1, row: 1, colSpan: 24, rowSpan: 6 };
  const full = { minRowSpan: 6 };

  // Dragging the north-east corner down three rows: nothing gives.
  expect(resizedPlacement(group, { cols: 0, rows: 3 }, 24, full, 'ne')).toEqual(
    group,
  );

  // Without the content minimum it would report a shrink to three rows at
  // row 4, whose bottom edge sits at row 9 rather than the original 6.
  const unconstrained = resizedPlacement(
    group,
    { cols: 0, rows: 3 },
    24,
    {},
    'ne',
  );
  expect(unconstrained).toEqual({ col: 1, row: 4, colSpan: 24, rowSpan: 3 });

  // Growing upwards is still allowed, anchored on the bottom edge. Measured
  // on a container with room above it: one at row 1 is already against the
  // top of the grid, so it has nowhere to grow.
  const lower: GridPlacement = { col: 1, row: 3, colSpan: 24, rowSpan: 6 };
  expect(
    resizedPlacement(lower, { cols: 0, rows: -2 }, 24, full, 'ne'),
  ).toEqual({ col: 1, row: 1, colSpan: 24, rowSpan: 8 });
});
