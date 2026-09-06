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
import { HeaderGroupConfig } from './types';
import {
  canSaveHeaderGroup,
  collectHeaderGroupColumns,
  createHeaderGroup,
  headerGroupsHaveSameColumns,
  moveHeaderGroup,
  normalizeSelectedColumns,
  collectUsedHeaderGroupColumns,
  moveHeaderGroupAt,
  pruneStaleHeaderGroupColumns,
  removeHeaderGroupAt,
  syncTimeComparisonGroups,
  updateHeaderGroupAt,
} from './utils';

const groups: HeaderGroupConfig[] = [
  {
    id: 'sales',
    label: 'Sales',
    columns: ['SUM(sales)'],
    children: [
      {
        id: 'online',
        label: 'Online',
        columns: ['SUM(online_sales)'],
        children: [],
      },
    ],
  },
];

test('canSaveHeaderGroup requires a name and at least one column', () => {
  expect(canSaveHeaderGroup(createHeaderGroup())).toBe(false);
  expect(
    canSaveHeaderGroup({ id: '1', label: '   ', columns: ['SUM(sales)'] }),
  ).toBe(false);
  expect(canSaveHeaderGroup({ id: '1', label: 'Sales', columns: [] })).toBe(
    false,
  );
  expect(
    canSaveHeaderGroup({ id: '1', label: 'Sales', columns: ['SUM(sales)'] }),
  ).toBe(true);
  expect(
    canSaveHeaderGroup({
      id: '1',
      label: 'Sales',
      columns: ['SUM(sales)'],
      children: [{ id: '2', label: '', columns: [] }],
    }),
  ).toBe(false);
  expect(
    canSaveHeaderGroup({
      id: '1',
      label: 'Sales',
      columns: ['SUM(sales)'],
      children: [{ id: '2', label: 'Online', columns: ['SUM(cost)'] }],
    }),
  ).toBe(true);
});

test('createHeaderGroup returns an empty group with an id', () => {
  const group = createHeaderGroup();
  expect(group.id).toBeTruthy();
  expect(group.label).toBe('');
  expect(group.columns).toEqual([]);
  expect(group.labelAlign).toBe('center');
  expect(group.placement).toBe('right');
  expect(group.children).toEqual([]);
});

test('moveHeaderGroup reorders top-level groups', () => {
  const next = moveHeaderGroup(
    [
      { id: 'a', label: 'A', columns: [] },
      { id: 'b', label: 'B', columns: [] },
    ],
    0,
    1,
  );
  expect(next.map(group => group.id)).toEqual(['b', 'a']);
});

test('moveHeaderGroup returns the same list for invalid indexes', () => {
  const items: HeaderGroupConfig[] = [
    { id: 'a', label: 'A', columns: [] },
    { id: 'b', label: 'B', columns: [] },
  ];
  expect(moveHeaderGroup(items, 0, 0)).toBe(items);
  expect(moveHeaderGroup(items, -1, 1)).toBe(items);
  expect(moveHeaderGroup(items, 0, 2)).toBe(items);
});

test('updateHeaderGroupAt and removeHeaderGroupAt no-op on an empty path', () => {
  expect(updateHeaderGroupAt(groups, [], group => group)).toBe(groups);
  expect(removeHeaderGroupAt(groups, [])).toBe(groups);
});

test('normalizeSelectedColumns accepts strings and option objects', () => {
  expect(normalizeSelectedColumns(undefined)).toEqual([]);
  expect(normalizeSelectedColumns(['SUM(sales)'])).toEqual(['SUM(sales)']);
  expect(normalizeSelectedColumns([{ value: 'AVG(sales)' }])).toEqual([
    'AVG(sales)',
  ]);
});

test('collectHeaderGroupColumns defaults to an empty list', () => {
  expect(collectHeaderGroupColumns()).toEqual([]);
});

test('collectHeaderGroupColumns walks nested groups', () => {
  expect(collectHeaderGroupColumns(groups)).toEqual([
    'SUM(sales)',
    'SUM(online_sales)',
  ]);
});

test('collectUsedHeaderGroupColumns hides a base metric claimed by comparison columns', () => {
  const used = collectUsedHeaderGroupColumns(
    [
      {
        id: 'time-compare-sales',
        label: 'Sales',
        columns: ['Main SUM(sales)', '# SUM(sales)'],
        source: 'time_compare',
      },
    ],
    [
      { value: 'SUM(sales)', label: 'SUM(sales)' },
      { value: 'Main SUM(sales)', label: 'Main SUM(sales)' },
      { value: '# SUM(sales)', label: '# SUM(sales)' },
      { value: 'AVG(sales)', label: 'AVG(sales)' },
    ],
  );
  expect(used).toEqual(
    expect.arrayContaining(['SUM(sales)', 'Main SUM(sales)', '# SUM(sales)']),
  );
  expect(used).not.toContain('AVG(sales)');
});

test('moveHeaderGroupAt no-ops on an empty path', () => {
  expect(moveHeaderGroupAt(groups, [], 1)).toBe(groups);
});

test('moveHeaderGroupAt reorders top-level groups', () => {
  const items: HeaderGroupConfig[] = [
    { id: 'a', label: 'A', columns: [] },
    { id: 'b', label: 'B', columns: [] },
  ];
  expect(moveHeaderGroupAt(items, [0], 1).map(group => group.id)).toEqual([
    'b',
    'a',
  ]);
});

test('moveHeaderGroupAt reorders a nested subgroup', () => {
  const next = moveHeaderGroupAt(
    [
      {
        id: 'parent',
        label: 'Sales',
        columns: ['SUM(sales)'],
        children: [
          { id: 'online', label: 'Online', columns: ['SUM(cost)'] },
          { id: 'offline', label: 'Offline', columns: ['AVG(sales)'] },
        ],
      },
    ],
    [0, 0],
    1,
  );
  expect(next[0].children?.map(group => group.id)).toEqual([
    'offline',
    'online',
  ]);
});

test('updateHeaderGroupAt leaves sibling groups unchanged', () => {
  const siblings: HeaderGroupConfig[] = [
    { id: 'keep', label: 'Keep', columns: [] },
    {
      id: 'parent',
      label: 'Parent',
      columns: [],
      children: [{ id: 'child', label: 'Child', columns: [] }],
    },
  ];
  const next = updateHeaderGroupAt(siblings, [1, 0], group => ({
    ...group,
    label: 'Changed',
  }));
  expect(next[0]).toEqual(siblings[0]);
  expect(next[1].children?.[0].label).toBe('Changed');
});

test('removeHeaderGroupAt leaves sibling groups unchanged', () => {
  const siblings: HeaderGroupConfig[] = [
    { id: 'keep', label: 'Keep', columns: [] },
    {
      id: 'parent',
      label: 'Parent',
      columns: [],
      children: [{ id: 'child', label: 'Child', columns: [] }],
    },
  ];
  const next = removeHeaderGroupAt(siblings, [1, 0]);
  expect(next[0]).toEqual(siblings[0]);
  expect(next[1].children).toEqual([]);
});

test('updateHeaderGroupAt updates a nested group', () => {
  const next = updateHeaderGroupAt(groups, [0, 0], group => ({
    ...group,
    label: 'Web',
  }));
  expect(next[0].children?.[0].label).toBe('Web');
  expect(groups[0].children?.[0].label).toBe('Online');
});

test('removeHeaderGroupAt removes a nested group', () => {
  const next = removeHeaderGroupAt(groups, [0, 0]);
  expect(next[0].children).toEqual([]);
});

test('pruneStaleHeaderGroupColumns drops unknown columns', () => {
  const pruned = pruneStaleHeaderGroupColumns(groups, [
    { value: 'SUM(sales)', label: 'SUM(sales)' },
  ]);
  expect(pruned[0].columns).toEqual(['SUM(sales)']);
  expect(pruned[0].children?.[0].columns).toEqual([]);
});

test('pruneStaleHeaderGroupColumns keeps base keys that expand to comparison columns', () => {
  const pruned = pruneStaleHeaderGroupColumns(
    [{ id: 'sales', label: 'Sales', columns: ['revenue', 'missing'] }],
    [
      { value: 'Main revenue', label: 'Main revenue' },
      { value: '# revenue', label: '# revenue' },
      { value: '△ revenue', label: '△ revenue' },
      { value: '% revenue', label: '% revenue' },
    ],
  );
  expect(pruned[0].columns).toEqual(['revenue']);
});

test('pruneStaleHeaderGroupColumns keeps time comparison groups intact', () => {
  const pruned = pruneStaleHeaderGroupColumns(
    [
      {
        id: 'time-compare-sales',
        label: 'Sales',
        columns: ['Main SUM(sales)', '# SUM(sales)'],
        source: 'time_compare',
      },
    ],
    [{ value: 'SUM(cost)', label: 'SUM(cost)' }],
  );
  expect(pruned[0].columns).toEqual(['Main SUM(sales)', '# SUM(sales)']);
});

test('syncTimeComparisonGroups adds missing and drops stale auto groups', () => {
  const userGroup: HeaderGroupConfig = {
    id: 'custom',
    label: 'Custom',
    columns: ['SUM(cost)'],
  };
  const existingAuto: HeaderGroupConfig = {
    id: 'time-compare-sales',
    label: 'Renamed sales',
    columns: ['Main SUM(sales)'],
    source: 'time_compare',
  };
  const staleAuto: HeaderGroupConfig = {
    id: 'time-compare-old',
    label: 'Old',
    columns: ['Main old'],
    source: 'time_compare',
  };
  const nextAuto: HeaderGroupConfig[] = [
    {
      id: 'time-compare-sales',
      label: 'Sales',
      columns: ['Main SUM(sales)', '# SUM(sales)'],
      source: 'time_compare',
    },
    {
      id: 'time-compare-profit',
      label: 'Profit',
      columns: ['Main SUM(profit)'],
      source: 'time_compare',
    },
  ];

  const next = syncTimeComparisonGroups(
    [userGroup, existingAuto, staleAuto],
    nextAuto,
  );

  expect(next.map(group => group.id)).toEqual([
    'custom',
    'time-compare-sales',
    'time-compare-profit',
  ]);
  expect(next[1].label).toBe('Renamed sales');
});

test('headerGroupsHaveSameColumns compares ids and columns', () => {
  expect(headerGroupsHaveSameColumns(groups, groups)).toBe(true);
  expect(
    headerGroupsHaveSameColumns(groups, [
      { ...groups[0], columns: ['AVG(sales)'] },
    ]),
  ).toBe(false);
});
