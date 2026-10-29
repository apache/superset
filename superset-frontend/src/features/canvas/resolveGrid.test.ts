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
import fs from 'fs';
import path from 'path';
import {
  previewGrid,
  resolveGrid,
  swapped,
  type GridLayout,
} from './resolveGrid';
import type { GridPlacement } from './types';

/**
 * These cases are generated from the server's `resolve_grid`, the authority
 * for these rules, and its test suite reads this same file. A rule that
 * changes on one side without the other fails here.
 *
 * The file sits in the frontend tree because this suite runs in an image that
 * carries only `superset-frontend`; the Python tests run on a full checkout
 * and can read up into it.
 */
interface Case {
  name: string;
  columns: number;
  layouts: GridLayout[];
  expected: GridPlacement[];
}

/** A drop: where the grid settles when `moving` is let go at `target`. */
interface PreviewCase {
  name: string;
  columns: number;
  childIds: string[];
  layouts: Record<string, GridLayout>;
  moving: string;
  target: GridPlacement;
  /** Reading order after the drop, which is what decides who yields. */
  order: string[];
  expected: Record<string, GridPlacement>;
}

// Read rather than imported: `tsconfig.json`'s `include` does not take
// `.json` files into the program, and widening it for one test fixture would
// pull every JSON under `src` in with it.
const { cases, previewCases } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'gridCases.json'), 'utf8'),
) as { cases: Case[]; previewCases: PreviewCase[] };

test('the shared cases are present, so this file cannot pass vacuously', () => {
  expect(cases.length).toBeGreaterThan(5);
});

test.each(cases.map(c => [c.name, c] as const))(
  'matches the server: %s',
  (_name, testCase) => {
    expect(resolveGrid(testCase.layouts, testCase.columns)).toEqual(
      testCase.expected,
    );
  },
);

test('the shared preview cases are present too', () => {
  expect(previewCases.length).toBeGreaterThan(5);
});

test.each(previewCases.map(c => [c.name, c] as const))(
  'matches the server on a drop: %s',
  (_name, testCase) => {
    const preview = previewGrid(
      testCase.childIds,
      testCase.layouts,
      // No prior placements to fall back to: every case resolves.
      {},
      testCase.moving,
      testCase.target,
      testCase.columns,
    );

    expect(preview).toEqual(testCase.expected);
    // The reorder itself, not only where everything ended up: two different
    // orders can settle on the same placements, so asserting the geometry
    // alone would let the rule drift. `previewGrid` builds its result in
    // reading order, which string keys preserve.
    expect(Object.keys(preview)).toEqual(testCase.order);
  },
);

const KPI: GridPlacement = { col: 1, row: 1, colSpan: 12, rowSpan: 4 };
const TREND: GridPlacement = { col: 13, row: 1, colSpan: 12, rowSpan: 4 };

test('a preview pushes the widgets a drop lands on out of the way', () => {
  const placements = { kpi: KPI, trend: TREND };

  // Dropping 'kpi' on top of 'trend'. 'kpi' comes first in reading order, so
  // it keeps the spot and 'trend' moves below it.
  const preview = previewGrid(
    ['kpi', 'trend'],
    placements,
    placements,
    'kpi',
    { ...KPI, col: 13 },
    24,
  );

  expect(preview.kpi).toEqual({ col: 13, row: 1, colSpan: 12, rowSpan: 4 });
  expect(preview.trend).toEqual({ col: 13, row: 5, colSpan: 12, rowSpan: 4 });
});

test('a preview leaves untouched neighbours where they are', () => {
  const placements = { kpi: KPI, trend: TREND };

  const preview = previewGrid(
    ['kpi', 'trend'],
    placements,
    placements,
    'kpi',
    { ...KPI, row: 9 },
    24,
  );

  expect(preview.kpi).toEqual({ col: 1, row: 9, colSpan: 12, rowSpan: 4 });
  expect(preview.trend).toEqual(TREND);
});

test('a preview is skipped when a child has no placement to reason about', () => {
  const placements = { kpi: KPI };

  // 'ghost' is a child of the grid but has no resolved placement.
  const preview = previewGrid(
    ['kpi', 'ghost'],
    placements,
    placements,
    'kpi',
    { ...KPI, col: 13 },
    24,
  );

  expect(preview).toBe(placements);
});

test('an auto-placed sibling is previewed as the server will resolve it', () => {
  // Two full-width auto-placed widgets land at rows 1 and 2. Dragging the
  // first to row 3 frees row 1, and the server -- which resolves from the
  // stored (auto) layouts -- moves the second up into it. Feeding back the
  // rectangle it currently occupies would pin it at row 2 in the preview and
  // the layout would jump after the save.
  const layouts = { first: { rowSpan: 1 }, second: { rowSpan: 1 } };
  const placements = {
    first: { col: 1, row: 1, colSpan: 24, rowSpan: 1 },
    second: { col: 1, row: 2, colSpan: 24, rowSpan: 1 },
  };

  const preview = previewGrid(
    ['first', 'second'],
    layouts,
    placements,
    'first',
    { col: 1, row: 3, colSpan: 24, rowSpan: 1 },
    24,
  );

  expect(preview.first).toEqual({ col: 1, row: 3, colSpan: 24, rowSpan: 1 });
  expect(preview.second).toEqual({ col: 1, row: 1, colSpan: 24, rowSpan: 1 });
});

/**
 * Three full-width widgets stacked in reading order, which is the shape the
 * reorder matters for: who yields is decided by position in `children`, not
 * by where the pointer is.
 */
const STACK = {
  a: { col: 1, row: 1, colSpan: 24, rowSpan: 4 },
  b: { col: 1, row: 5, colSpan: 24, rowSpan: 4 },
  c: { col: 1, row: 9, colSpan: 24, rowSpan: 4 },
};

test('a widget dropped on an earlier sibling wins the spot', () => {
  // Without the reorder `a` keeps row 1 because it comes first in `children`,
  // and `c` is pushed back under it -- so dragging a widget upwards looked
  // like it bounced back.
  const preview = previewGrid(
    ['a', 'b', 'c'],
    STACK,
    STACK,
    'c',
    { ...STACK.c, row: 1 },
    24,
  );

  expect(preview.c).toEqual({ col: 1, row: 1, colSpan: 24, rowSpan: 4 });
  expect(preview.a).toEqual({ col: 1, row: 5, colSpan: 24, rowSpan: 4 });
  expect(preview.b).toEqual({ col: 1, row: 9, colSpan: 24, rowSpan: 4 });
});

test('a widget can be dropped between two others', () => {
  // `c` lands on `b`, so it goes ahead of `b` and behind `a`.
  const preview = previewGrid(
    ['a', 'b', 'c'],
    STACK,
    STACK,
    'c',
    { ...STACK.c, row: 5 },
    24,
  );

  expect(preview.a).toEqual({ col: 1, row: 1, colSpan: 24, rowSpan: 4 });
  expect(preview.c).toEqual({ col: 1, row: 5, colSpan: 24, rowSpan: 4 });
  expect(preview.b).toEqual({ col: 1, row: 9, colSpan: 24, rowSpan: 4 });
});

test('a widget dropped past every sibling goes last and pushes nobody', () => {
  // The insert-at-the-end path: nothing starts after row 13, so `a` goes to
  // the back of reading order and the others keep the rows they hold. They
  // are not compacted upwards -- an explicitly placed child is only ever
  // pushed down.
  const preview = previewGrid(
    ['a', 'b', 'c'],
    STACK,
    STACK,
    'a',
    { ...STACK.a, row: 13 },
    24,
  );

  expect(preview.b).toEqual({ col: 1, row: 5, colSpan: 24, rowSpan: 4 });
  expect(preview.c).toEqual({ col: 1, row: 9, colSpan: 24, rowSpan: 4 });
  expect(preview.a).toEqual({ col: 1, row: 13, colSpan: 24, rowSpan: 4 });
});

test('a drop onto an auto-placed sibling moves it aside, not down', () => {
  // The reorder and auto placement together. Going first, the auto-placed
  // sibling takes the slot and the drop is pushed under it; going second it
  // flows into the next free slot instead, which is beside the drop rather
  // than below it.
  const layouts = {
    auto: { colSpan: 12, rowSpan: 2 },
    dropped: { col: 13, row: 1, colSpan: 12, rowSpan: 2 },
  };
  const placements = {
    auto: { col: 1, row: 1, colSpan: 12, rowSpan: 2 },
    dropped: { col: 13, row: 1, colSpan: 12, rowSpan: 2 },
  };

  const preview = previewGrid(
    ['auto', 'dropped'],
    layouts,
    placements,
    'dropped',
    { col: 1, row: 1, colSpan: 12, rowSpan: 2 },
    24,
  );

  expect(preview.dropped).toEqual({ col: 1, row: 1, colSpan: 12, rowSpan: 2 });
  expect(preview.auto).toEqual({ col: 13, row: 1, colSpan: 12, rowSpan: 2 });
});

test('a side-by-side drop goes ahead of the sibling to its right', () => {
  // Same row, so the column breaks the tie: dropping into the left half puts
  // the widget ahead of the one already on the right.
  const pair = {
    left: { col: 1, row: 1, colSpan: 12, rowSpan: 4 },
    right: { col: 13, row: 1, colSpan: 12, rowSpan: 4 },
  };

  const preview = previewGrid(
    ['left', 'right'],
    pair,
    pair,
    'right',
    { col: 1, row: 1, colSpan: 12, rowSpan: 4 },
    24,
  );

  expect(preview.right).toEqual({ col: 1, row: 1, colSpan: 12, rowSpan: 4 });
  // `left` lost its spot and is pushed down rather than sideways.
  expect(preview.left).toEqual({ col: 1, row: 5, colSpan: 12, rowSpan: 4 });
});

test('a widget swapped into a narrower slot is pulled back onto the grid', () => {
  // A swap exchanges places, not shapes, so the wider widget keeps its span.
  // Starting it where the narrow one began would run it off the right edge,
  // and the server rejects the whole swap -- which the user sees as a drag
  // that undoes itself.
  const wide = { col: 1, row: 13, colSpan: 24, rowSpan: 8 };
  const narrowSlot = { col: 13, row: 21, colSpan: 12, rowSpan: 8 };

  const landed = swapped(wide, narrowSlot, 24);

  expect(landed).toEqual({ col: 1, row: 21, colSpan: 24, rowSpan: 8 });
  expect(landed.col + landed.colSpan - 1).toBeLessThanOrEqual(24);
});

test('a swap that already fits is left where it lands', () => {
  const narrow = { col: 13, row: 21, colSpan: 12, rowSpan: 8 };

  expect(
    swapped(narrow, { col: 1, row: 13, colSpan: 24, rowSpan: 8 }, 24),
  ).toEqual({ col: 1, row: 13, colSpan: 12, rowSpan: 8 });
});
