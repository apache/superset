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
  collectHeaderGroupColumns,
  createHeaderGroup,
  headerGroupsHaveSameColumns,
  moveHeaderGroup,
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

test('collectHeaderGroupColumns walks nested groups', () => {
  expect(collectHeaderGroupColumns(groups)).toEqual([
    'SUM(sales)',
    'SUM(online_sales)',
  ]);
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
