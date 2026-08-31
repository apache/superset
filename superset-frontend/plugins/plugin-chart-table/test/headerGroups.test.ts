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
  buildHeaderGroupRows,
  HeaderGroupConfig,
  hasRenderableHeaderGroups,
  orderColumnsByHeaderGroups,
} from '../src/utils/headerGroups';

const groups: HeaderGroupConfig[] = [
  {
    id: 'sales',
    label: 'Sales',
    columns: ['SUM(sales)', 'AVG(sales)'],
    children: [
      {
        id: 'online',
        label: 'Online',
        columns: ['SUM(online_sales)'],
      },
      {
        id: 'offline',
        label: 'Offline',
        columns: ['SUM(offline_sales)'],
      },
    ],
  },
  {
    id: 'costs',
    label: 'Costs',
    columns: ['SUM(cost)'],
  },
];

test('places left-side groups before ungrouped columns', () => {
  const columns = [
    { key: 'country' },
    { key: 'SUM(cost)' },
    { key: 'SUM(sales)' },
    { key: 'name' },
  ];
  const mixedGroups: HeaderGroupConfig[] = [
    {
      id: 'sales',
      label: 'Sales',
      columns: ['SUM(sales)'],
      placement: 'left',
    },
    {
      id: 'costs',
      label: 'Costs',
      columns: ['SUM(cost)'],
      placement: 'right',
    },
  ];

  expect(
    orderColumnsByHeaderGroups(columns, mixedGroups).map(col => col.key),
  ).toEqual(['SUM(sales)', 'country', 'name', 'SUM(cost)']);
});

test('orders grouped columns after ungrouped columns', () => {
  const columns = [
    { key: 'country' },
    { key: 'SUM(cost)' },
    { key: 'SUM(sales)' },
    { key: 'name' },
    { key: 'AVG(sales)' },
    { key: 'SUM(online_sales)' },
    { key: 'SUM(offline_sales)' },
  ];

  expect(
    orderColumnsByHeaderGroups(columns, groups).map(col => col.key),
  ).toEqual([
    'country',
    'name',
    'SUM(sales)',
    'AVG(sales)',
    'SUM(online_sales)',
    'SUM(offline_sales)',
    'SUM(cost)',
  ]);
});

test('builds nested header rows with colspan and rowspan', () => {
  const columnKeys = [
    'country',
    'SUM(sales)',
    'AVG(sales)',
    'SUM(online_sales)',
    'SUM(offline_sales)',
    'SUM(cost)',
  ];
  const rows = buildHeaderGroupRows(groups, columnKeys);

  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual([
    expect.objectContaining({
      label: '',
      colSpan: 1,
      rowSpan: 1,
      columnIndex: 0,
    }),
    expect.objectContaining({
      label: 'Sales',
      colSpan: 4,
      rowSpan: 1,
    }),
    expect.objectContaining({
      label: 'Costs',
      colSpan: 1,
      rowSpan: 2,
      isLastColumn: true,
    }),
  ]);
  expect(rows[1]).toEqual([
    expect.objectContaining({
      label: '',
      colSpan: 1,
      rowSpan: 1,
      columnIndex: 0,
      isLastColumn: false,
    }),
    expect.objectContaining({
      label: '',
      colSpan: 1,
      rowSpan: 1,
      isLastColumn: false,
    }),
    expect.objectContaining({
      label: '',
      colSpan: 1,
      rowSpan: 1,
      isLastColumn: false,
    }),
    expect.objectContaining({
      label: 'Online',
      colSpan: 1,
      rowSpan: 1,
      isLastColumn: false,
    }),
    expect.objectContaining({
      label: 'Offline',
      colSpan: 1,
      rowSpan: 1,
      isLastColumn: false,
    }),
  ]);
});

test('draws a placeholder cell on every extra header row for ungrouped columns', () => {
  const nested: HeaderGroupConfig[] = [
    {
      id: 'sales',
      label: 'Sales',
      columns: [],
      children: [
        {
          id: 'online',
          label: 'Online',
          columns: ['SUM(online_sales)'],
        },
      ],
    },
  ];
  const rows = buildHeaderGroupRows(nested, [
    'country',
    'name',
    'SUM(online_sales)',
  ]);

  expect(rows).toHaveLength(2);
  expect(rows[0].filter(cell => cell.label === '')).toEqual([
    expect.objectContaining({ columnIndex: 0, rowSpan: 1, colSpan: 1 }),
    expect.objectContaining({ columnIndex: 1, rowSpan: 1, colSpan: 1 }),
  ]);
  expect(rows[1].filter(cell => cell.label === '')).toEqual([
    expect.objectContaining({ columnIndex: 0, rowSpan: 1, colSpan: 1 }),
    expect.objectContaining({ columnIndex: 1, rowSpan: 1, colSpan: 1 }),
  ]);
});

test('keeps a separator between a subgroup and the next top-level group', () => {
  const nestedThenSibling: HeaderGroupConfig[] = [
    {
      id: 'sales',
      label: 'Sales',
      columns: [],
      children: [
        {
          id: 'online',
          label: 'Online',
          columns: ['SUM(online_sales)'],
        },
      ],
    },
    {
      id: 'costs',
      label: 'Costs',
      columns: ['SUM(cost)'],
    },
  ];
  const rows = buildHeaderGroupRows(nestedThenSibling, [
    'SUM(online_sales)',
    'SUM(cost)',
  ]);

  expect(rows[0]).toEqual([
    expect.objectContaining({
      label: 'Sales',
      isLastColumn: false,
    }),
    expect.objectContaining({
      label: 'Costs',
      isLastColumn: true,
      rowSpan: 2,
    }),
  ]);
  expect(rows[1]).toEqual([
    expect.objectContaining({
      label: 'Online',
      isLastColumn: false,
    }),
  ]);
});

test('uses the configured label alignment on group cells', () => {
  const rows = buildHeaderGroupRows(
    [
      {
        id: 'sales',
        label: 'Sales',
        columns: ['SUM(sales)'],
        labelAlign: 'left',
      },
    ],
    ['SUM(sales)'],
  );

  expect(rows[0][0]).toEqual(
    expect.objectContaining({
      label: 'Sales',
      labelAlign: 'left',
    }),
  );
});

test('hasRenderableHeaderGroups is false for empty groups', () => {
  expect(hasRenderableHeaderGroups([])).toBe(false);
  expect(hasRenderableHeaderGroups([{ id: '1', label: '', columns: [] }])).toBe(
    false,
  );
  expect(
    hasRenderableHeaderGroups([{ id: '1', label: 'Sales', columns: [] }]),
  ).toBe(true);
});
