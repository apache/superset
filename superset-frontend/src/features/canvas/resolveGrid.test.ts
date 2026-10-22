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
import { previewGrid, resolveGrid, type GridLayout } from './resolveGrid';
import gridCases from './gridCases.json';
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

const cases = gridCases.cases as Case[];

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
    'kpi',
    { ...KPI, col: 13 },
    24,
  );

  expect(preview).toBe(placements);
});
