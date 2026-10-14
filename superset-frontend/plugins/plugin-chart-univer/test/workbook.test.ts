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
import { GenericDataType } from '@apache-superset/core/common';
import {
  applyGrid,
  buildGrid,
  buildPivotGrid,
  buildWorkbook,
  createWorkbookData,
  fitSheetSize,
  hideHeaders,
  HEADER_STYLE_ID,
  parseSavedState,
  serializeState,
  stretchColumns,
  toCellValue,
  unstretchColumns,
} from '../src/utils/workbook';

const cells = (workbook: ReturnType<typeof createWorkbookData>) =>
  workbook.sheets!.data.cellData!;

const grid = buildGrid(
  [
    { name: 'a', total: 1 },
    { name: 'b', total: 2 },
  ],
  ['name', 'total'],
  [GenericDataType.String, GenericDataType.Numeric],
  { total: 'Total' },
);

test('buildGrid adds a header row with verbose names', () => {
  expect(grid).toEqual([
    ['name', 'Total'],
    ['a', 1],
    ['b', 2],
  ]);
});

test('toCellValue formats dates and keeps primitives', () => {
  expect(toCellValue(Date.UTC(2024, 0, 31), GenericDataType.Temporal)).toBe(
    '2024-01-31',
  );
  expect(
    toCellValue(Date.UTC(2024, 0, 31, 13, 5, 9), GenericDataType.Temporal),
  ).toBe('2024-01-31 13:05:09');
  expect(toCellValue(null)).toBeNull();
  expect(toCellValue(true)).toBe(true);
  expect(toCellValue({ a: 1 })).toBe('{"a":1}');
  expect(toCellValue(524.999999999985)).toBe(525);
  expect(toCellValue(0.1 + 0.2)).toBe(0.3);
  expect(toCellValue(42)).toBe(42);
});

test('createWorkbookData styles the header and freezes it', () => {
  const workbook = createWorkbookData(grid);
  expect(cells(workbook)[0][1]).toEqual({ v: 'Total', s: HEADER_STYLE_ID });
  expect(cells(workbook)[2][1]).toEqual({ v: 2 });
  expect(workbook.sheets!.data.freeze!.ySplit).toBe(1);
});

test('createWorkbookData widens columns with long content', () => {
  const workbook = createWorkbookData([
    ['SUM(global_sales)', 'n'],
    ['x', 1],
  ]);
  expect(workbook.sheets!.data.columnData).toEqual({
    0: { w: 152 },
    1: { w: 80 },
  });
});

test('createWorkbookData sizes the sheet to the data', () => {
  const sheet = createWorkbookData(grid).sheets!.data;
  expect(sheet.rowCount).toBe(3);
  expect(sheet.columnCount).toBe(2);
});

test('fitSheetSize keeps cells added outside the data', () => {
  const workbook = createWorkbookData(grid);
  workbook.sheets!.data.rowCount = 40;
  cells(workbook)[5] = { 3: { f: '=SUM(B2:B3)' } };
  const sheet = fitSheetSize(workbook, grid).sheets!.data;
  expect(sheet.rowCount).toBe(6);
  expect(sheet.columnCount).toBe(4);
});

test('stretchColumns fills the width and unstretchColumns restores it', () => {
  // 46px row header + 12px scrollbar + two 160px columns
  const workbook = createWorkbookData([['a', 'b']]);
  const { workbook: wide, stretched } = stretchColumns(workbook, 378);
  expect(wide.sheets!.data.columnData).toEqual({
    0: { w: 160 },
    1: { w: 160 },
  });

  // the user widened the second column
  wide.sheets!.data.columnData![1].w = 200;
  expect(unstretchColumns(wide, stretched).sheets!.data.columnData).toEqual({
    0: { w: 80 },
    1: { w: 200 },
  });
});

test('stretchColumns leaves overflowing columns alone', () => {
  const workbook = createWorkbookData([['a', 'b']]);
  expect(stretchColumns(workbook, 150)).toEqual({ workbook, stretched: {} });
});

test('applyGrid refreshes values, keeps styles and clears old cells', () => {
  const workbook = createWorkbookData(grid);
  cells(workbook)[1][0].s = 'red';
  cells(workbook)[2][0].f = '=1+1';
  cells(workbook)[0][5] = { v: 'my note' };

  const smaller = applyGrid(workbook, [['name'], ['z']], { rows: 3, cols: 2 });
  expect(cells(smaller)[1][0]).toEqual({ v: 'z', s: 'red' });
  expect(cells(smaller)[2]).toBeUndefined();
  expect(cells(smaller)[0][1]).toEqual({ s: HEADER_STYLE_ID });
  expect(cells(smaller)[0][5]).toEqual({ v: 'my note' });
  // the input is not modified
  expect(cells(workbook)[2][0].v).toBe('b');
});

test('saved state round trip with live data strips query values', () => {
  const workbook = createWorkbookData(grid);
  cells(workbook)[0][3] = { f: '=SUM(B2:B3)', v: 3 };
  const raw = serializeState(workbook, grid, true);
  const saved = parseSavedState(raw)!;

  expect(saved.stripped).toBe(true);
  expect(cells(saved.workbook)[1]).toBeUndefined();
  expect(cells(saved.workbook)[0][3]).toEqual({ f: '=SUM(B2:B3)', v: 3 });

  const newGrid = [
    ['name', 'Total'],
    ['x', 10],
  ];
  const restored = buildWorkbook(newGrid, saved, true);
  expect(cells(restored)[1]).toEqual({ 0: { v: 'x' }, 1: { v: 10 } });
  expect(cells(restored)[0][3].f).toBe('=SUM(B2:B3)');
});

test('without live data the saved sheet is used as is', () => {
  const workbook = createWorkbookData(grid);
  cells(workbook)[1][0].v = 'edited';
  const saved = parseSavedState(serializeState(workbook, grid, false))!;
  const restored = buildWorkbook([['name'], ['fresh']], saved, false);
  expect(cells(restored)[1][0].v).toBe('edited');
});

test('a stripped sheet gets data even when live data is off', () => {
  const saved = parseSavedState(
    serializeState(createWorkbookData(grid), grid, true),
  )!;
  expect(cells(buildWorkbook(grid, saved, false))[1][0].v).toBe('a');
});

test('parseSavedState rejects broken values', () => {
  expect(parseSavedState(null)).toBeNull();
  expect(parseSavedState('not json')).toBeNull();
  expect(parseSavedState('{"version":2}')).toBeNull();
});

test('hideHeaders hides row and column headers', () => {
  const sheet = hideHeaders(createWorkbookData(grid)).sheets!.data;
  expect(sheet.rowHeader!.hidden).toBe(1);
  expect(sheet.columnHeader!.hidden).toBe(1);
});

test('a renamed header is saved and kept with live data', () => {
  const workbook = createWorkbookData(grid);
  cells(workbook)[0][0].v = 'Genre';
  const raw = serializeState(workbook, grid, true);
  expect(raw).not.toBe(serializeState(createWorkbookData(grid), grid, true));

  const saved = parseSavedState(raw)!;
  expect(cells(saved.workbook)[0][0]).toEqual({
    v: 'Genre',
    s: HEADER_STYLE_ID,
  });
  expect(cells(saved.workbook)[0][1]).toEqual({ s: HEADER_STYLE_ID });
  expect(cells(buildWorkbook(grid, saved, true))[0][0].v).toBe('Genre');

  // the query now returns another column there, so its label is shown
  const other = buildWorkbook([['platform', 'Total']], saved, true);
  expect(cells(other)[0][0].v).toBe('platform');
});

test('stretchColumns adds up to exactly the width', () => {
  const workbook = createWorkbookData([['a', 'b', 'c']]);
  const { workbook: wide } = stretchColumns(workbook, 1000);
  const widths = Object.values(wide.sheets!.data.columnData!).map(c => c.w!);
  expect(widths).toEqual([314, 314, 314]);
  expect(widths.reduce((a, b) => a + b)).toBe(1000 - 46 - 12);
});

test('buildPivotGrid stacks and merges the pivot headers', () => {
  const { grid: pivot, layout } = buildPivotGrid(
    [
      { genre: 'Action', 'SUM(sales), PS4': 1, 'SUM(sales), Wii\\, U': 2 },
      { genre: 'Total', 'SUM(sales), PS4': 1, 'SUM(sales), Wii\\, U': 2 },
    ],
    ['genre', 'SUM(sales), PS4', 'SUM(sales), Wii\\, U'],
    [GenericDataType.String, GenericDataType.Numeric, GenericDataType.Numeric],
    { genre: 'Genre' },
    1,
  );
  expect(pivot).toEqual([
    ['Genre', 'SUM(sales)', 'SUM(sales)'],
    [null, 'PS4', 'Wii, U'],
    ['Action', 1, 2],
    ['Total', 1, 2],
  ]);
  expect(layout).toEqual({
    headerRows: 2,
    frozenCols: 1,
    merges: [
      { startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 },
      { startRow: 0, endRow: 0, startColumn: 1, endColumn: 2 },
    ],
  });

  const workbook = createWorkbookData(pivot, layout);
  const sheet = workbook.sheets!.data;
  expect(sheet.freeze).toMatchObject({ xSplit: 1, ySplit: 2 });
  expect(sheet.mergeData).toEqual(layout.merges);
  expect(cells(workbook)[1][1].s).toBe(HEADER_STYLE_ID);

  // a renamed lower header survives a refresh
  cells(workbook)[1][1].v = 'PlayStation';
  const saved = parseSavedState(serializeState(workbook, pivot, true, layout))!;
  const restored = buildWorkbook(pivot, saved, true, layout);
  expect(cells(restored)[1][1].v).toBe('PlayStation');
  expect(restored.sheets!.data.mergeData).toEqual(layout.merges);
});

test('buildPivotGrid without column fields has one header row', () => {
  const { grid: pivot, layout } = buildPivotGrid(
    [{ genre: 'Action', 'SUM(sales)': 1 }],
    ['genre', 'SUM(sales)'],
    [GenericDataType.String, GenericDataType.Numeric],
    {},
    1,
  );
  expect(pivot).toEqual([
    ['genre', 'SUM(sales)'],
    ['Action', 1],
  ]);
  expect(layout).toEqual({ headerRows: 1, frozenCols: 1, merges: [] });
});
