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
  pruneStaleHeaderGroupColumns,
  removeHeaderGroupAt,
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
  expect(group.children).toEqual([]);
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

test('headerGroupsHaveSameColumns compares ids and columns', () => {
  expect(headerGroupsHaveSameColumns(groups, groups)).toBe(true);
  expect(
    headerGroupsHaveSameColumns(groups, [
      { ...groups[0], columns: ['AVG(sales)'] },
    ]),
  ).toBe(false);
});
