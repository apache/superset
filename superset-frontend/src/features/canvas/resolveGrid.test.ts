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
import { previewGrid, resolveGrid, type GridLayout } from './resolveGrid';
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

// Read rather than imported: `tsconfig.json`'s `include` does not take
// `.json` files into the program, and widening it for one test fixture would
// pull every JSON under `src` in with it.
const { cases } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'gridCases.json'), 'utf8'),
) as { cases: Case[] };

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
