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
  addGroup,
  anchorOutline,
  collapseToLevel,
  combineGroups,
  groupLevels,
  hiddenIndexes,
  insertIndexes,
  outlineDepth,
  removeGroups,
  removeIndexes,
  resolveOutline,
} from '../src/utils/outline';
import {
  applyOutline,
  createWorkbookData,
  DEFAULT_LAYOUT,
  groupRows,
} from '../src/utils/workbook';

test('groups nest but do not cross', () => {
  const groups = addGroup([], 2, 8)!;
  const nested = addGroup(groups, 3, 4)!;
  expect(nested).toEqual([
    { start: 2, end: 8 },
    { start: 3, end: 4 },
  ]);
  expect(groupLevels(nested)).toEqual([0, 1]);
  expect(outlineDepth(nested)).toBe(2);
  expect(addGroup(nested, 4, 10)).toBeNull();
  expect(addGroup(nested, 3, 4)).toBeNull();
});

test('ungroup removes the groups inside the selection or the innermost one', () => {
  const groups = addGroup(addGroup([], 2, 8)!, 3, 4)!;
  expect(removeGroups(groups, 3, 3).removed).toEqual([{ start: 3, end: 4 }]);
  expect(removeGroups(groups, 1, 9).groups).toEqual([]);
});

test('collapsed groups hide their rows', () => {
  expect([...hiddenIndexes([{ start: 2, end: 3, collapsed: true }])]).toEqual([
    2, 3,
  ]);
});

test('groups move with inserted and removed rows', () => {
  const groups = [{ start: 2, end: 5 }];
  expect(insertIndexes(groups, 3, 2)).toEqual([{ start: 2, end: 7 }]);
  expect(insertIndexes(groups, 0, 1)).toEqual([{ start: 3, end: 6 }]);
  expect(removeIndexes(groups, 0, 0)).toEqual([{ start: 1, end: 4 }]);
  expect(removeIndexes(groups, 4, 9)).toEqual([{ start: 2, end: 3 }]);
  expect(removeIndexes(groups, 2, 5)).toEqual([]);
});

test('saved groups follow their rows when the data changes', () => {
  const grid = [
    ['genre', 'sales'],
    ['Action', 1],
    ['Puzzle', 2],
    ['Racing', 3],
  ];
  const saved = anchorOutline(
    {
      rows: [{ start: 2, end: 3, collapsed: true }],
      columns: [{ start: 1, end: 1 }],
    },
    grid,
    1,
    1,
  );
  expect(saved.rows[0]).toEqual({
    start: { key: 'Puzzle' },
    end: { key: 'Racing' },
    collapsed: true,
  });

  // a new first row moves Puzzle and Racing down
  const refreshed = [
    ['genre', 'sales'],
    ['Action', 1],
    ['Adventure', 5],
    ['Puzzle', 2],
    ['Racing', 3],
  ];
  const outline = resolveOutline(saved, refreshed, 1, 1);
  expect(outline.rows).toEqual([{ start: 3, end: 4, collapsed: true }]);
  expect(outline.columns).toEqual([{ start: 1, end: 1 }]);
  // a group whose rows are gone is dropped
  expect(resolveOutline(saved, refreshed.slice(0, 3), 1, 1).rows).toEqual([]);

  const sheet = applyOutline(createWorkbookData(refreshed), outline, refreshed)
    .sheets!.data;
  expect(sheet.rowData).toEqual({ 3: { hd: 1 }, 4: { hd: 1 } });
});

test('groupRows adds a merged Subtotals row on top of each group', () => {
  const { grid, layout, groups } = groupRows(
    [
      ['genre', 'platform', 'sales'],
      ['Action', 'PS4', 1],
      ['Puzzle', 'PS4', 2],
      ['Action', 'Wii', 3.1],
    ],
    DEFAULT_LAYOUT,
    2,
    true,
  );
  expect(grid).toEqual([
    ['genre', 'platform', 'sales'],
    ['Action', 'Subtotals', 4.1],
    ['Action', 'PS4', 1],
    ['Action', 'Wii', 3.1],
    ['Puzzle', 'Subtotals', 2],
    ['Puzzle', 'PS4', 2],
    ['Grand Total', null, 6.1],
  ]);
  expect(layout.merges).toEqual([
    { startRow: 1, endRow: 3, startColumn: 0, endColumn: 0 },
    { startRow: 4, endRow: 5, startColumn: 0, endColumn: 0 },
  ]);
  expect(groups).toEqual([
    { start: 2, end: 3 },
    { start: 5, end: 5 },
  ]);
});

test('level buttons collapse the groups below that level', () => {
  const groups = [
    { start: 1, end: 9 },
    { start: 2, end: 4 },
  ];
  expect(collapseToLevel(groups, 1).map(g => g.collapsed)).toEqual([
    true,
    true,
  ]);
  expect(collapseToLevel(groups, 2).map(g => g.collapsed)).toEqual([
    false,
    true,
  ]);
  expect(collapseToLevel(groups, 3).map(g => g.collapsed)).toEqual([
    false,
    false,
  ]);
});

test('saved collapsed state carries over to the automatic groups', () => {
  expect(
    combineGroups(
      [{ start: 2, end: 3 }],
      [
        { start: 2, end: 3, collapsed: true },
        { start: 8, end: 9 },
      ],
    ),
  ).toEqual([
    { start: 2, end: 3, collapsed: true },
    { start: 8, end: 9, collapsed: undefined },
  ]);
});
