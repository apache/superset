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
  buildTimeComparisonHeaderGroups,
  expandGroupColumnKey,
  getHeaderGroupDepth,
  getHeaderGroupsControlProps,
  getHeaderGroupsMaxDepth,
  headerGroupsHaveSameColumns,
  hasRenderableHeaderGroups,
  nestColDefsInHeaderGroups,
  resolveHeaderGroups,
  syncTimeComparisonGroups,
  type HeaderGroupConfig,
} from './headerGroups';

const comparisonRevenueColumns = [
  'Main revenue',
  '# revenue',
  '△ revenue',
  '% revenue',
];

const chartGroups: HeaderGroupConfig[] = [
  {
    id: 'sales',
    label: 'Sales',
    columns: ['revenue', 'profit'],
    placement: 'right',
  },
];

test('nestColDefsInHeaderGroups places left-side groups before ungrouped columns', () => {
  const nested = nestColDefsInHeaderGroups(
    [{ key: 'region' }, { key: 'revenue' }],
    [
      {
        id: 'sales',
        label: 'Sales',
        columns: ['revenue'],
        placement: 'left',
      },
    ],
    column => ({ field: column.key }),
  );
  expect(nested).toEqual([
    {
      headerName: 'Sales',
      marryChildren: true,
      openByDefault: true,
      headerClass: 'ag-header-align-center',
      children: [{ field: 'revenue' }],
    },
    { field: 'region' },
  ]);
});

test('nestColDefsInHeaderGroups wraps matching leaves and leaves ungrouped columns in place', () => {
  const columns = [{ key: 'region' }, { key: 'revenue' }, { key: 'profit' }];
  const nested = nestColDefsInHeaderGroups(columns, chartGroups, column => ({
    field: column.key,
  }));
  expect(nested).toEqual([
    { field: 'region' },
    {
      headerName: 'Sales',
      marryChildren: true,
      openByDefault: true,
      headerClass: 'ag-header-align-center',
      children: [{ field: 'revenue' }, { field: 'profit' }],
    },
  ]);
});

test('getHeaderGroupDepth and getHeaderGroupsMaxDepth walk nested groups', () => {
  expect(getHeaderGroupDepth(chartGroups[0])).toBe(1);
  expect(
    getHeaderGroupDepth({
      id: 'parent',
      label: 'Parent',
      columns: [],
      children: chartGroups,
    }),
  ).toBe(2);
  expect(getHeaderGroupsMaxDepth([])).toBe(0);
  expect(getHeaderGroupsMaxDepth(chartGroups)).toBe(1);
});

test('buildHeaderGroupRows returns no rows without groups or columns', () => {
  expect(buildHeaderGroupRows([], ['revenue'])).toEqual([]);
  expect(buildHeaderGroupRows(chartGroups, [])).toEqual([]);
  expect(buildHeaderGroupRows(chartGroups, ['region'])).toEqual([]);
});

test('hasRenderableHeaderGroups ignores label-only and stale groups', () => {
  expect(hasRenderableHeaderGroups([])).toBe(false);
  expect(hasRenderableHeaderGroups([{ id: '1', label: '', columns: [] }])).toBe(
    false,
  );
  expect(
    hasRenderableHeaderGroups([{ id: '1', label: 'Sales', columns: [] }]),
  ).toBe(false);
  expect(
    hasRenderableHeaderGroups([
      { id: '1', label: 'Sales', columns: ['revenue'] },
    ]),
  ).toBe(true);
  expect(
    hasRenderableHeaderGroups(
      [{ id: '1', label: 'Sales', columns: ['revenue'] }],
      ['region'],
    ),
  ).toBe(false);
  expect(
    hasRenderableHeaderGroups(
      [
        {
          id: '1',
          label: 'Sales',
          columns: [],
          children: [{ id: '2', label: 'Web', columns: ['online'] }],
        },
      ],
      ['online'],
    ),
  ).toBe(true);
  expect(
    hasRenderableHeaderGroups(
      [{ id: '1', label: 'Sales', columns: ['revenue'] }],
      [{ key: 'custom_rev', metricName: 'revenue' }],
    ),
  ).toBe(true);
});

test('nestColDefsInHeaderGroups skips groups that match no columns', () => {
  expect(
    nestColDefsInHeaderGroups(
      [{ key: 'region' }],
      [{ id: 'sales', label: 'Sales', columns: ['missing'] }],
      column => ({ field: column.key }),
    ),
  ).toEqual([{ field: 'region' }]);
});

test('buildTimeComparisonHeaderGroups uses the metric key as the default label', () => {
  expect(buildTimeComparisonHeaderGroups(['revenue'])).toEqual([
    expect.objectContaining({
      id: 'time-compare-revenue',
      label: 'revenue',
      source: 'time_compare',
    }),
  ]);
});

test('expandGroupColumnKey matches a percent metric without a space', () => {
  expect(expandGroupColumnKey('revenue', ['region', '%revenue'])).toEqual([
    '%revenue',
  ]);
});

test('nestColDefsInHeaderGroups puts direct columns before nested child groups', () => {
  const nested = nestColDefsInHeaderGroups(
    [{ key: 'direct' }, { key: 'nested' }],
    [
      {
        id: 'parent',
        label: 'Parent',
        columns: ['direct'],
        children: [{ id: 'child', label: 'Child', columns: ['nested'] }],
      },
    ],
    column => ({ field: column.key }),
  );

  expect(nested).toEqual([
    expect.objectContaining({
      headerName: 'Parent',
      children: [
        { field: 'direct' },
        expect.objectContaining({
          headerName: 'Child',
          children: [{ field: 'nested' }],
        }),
      ],
    }),
  ]);
});

test('nestColDefsInHeaderGroups nests child groups that have matching columns', () => {
  const nested = nestColDefsInHeaderGroups(
    [{ key: 'online' }],
    [
      {
        id: 'sales',
        label: 'Sales',
        columns: [],
        children: [{ id: 'web', label: 'Web', columns: ['online'] }],
      },
    ],
    column => ({ field: column.key }),
  );

  expect(nested).toEqual([
    expect.objectContaining({
      headerName: 'Sales',
      children: [
        expect.objectContaining({
          headerName: 'Web',
          children: [{ field: 'online' }],
        }),
      ],
    }),
  ]);
});

test('expandGroupColumnKey maps a metric to its time comparison columns', () => {
  const visible = [
    'region',
    `Main revenue`,
    '# revenue',
    '△ revenue',
    '% revenue',
  ];
  expect(expandGroupColumnKey('revenue', visible)).toEqual([
    `Main revenue`,
    '# revenue',
    '△ revenue',
    '% revenue',
  ]);
});

test('nestColDefsInHeaderGroups wraps time comparison columns for a metric group', () => {
  const nested = nestColDefsInHeaderGroups(
    [
      { key: 'region' },
      { key: `Main revenue`, metricName: 'revenue' },
      { key: '# revenue', metricName: 'revenue' },
      { key: '△ revenue', metricName: 'revenue' },
      { key: '% revenue', metricName: 'revenue' },
    ],
    [
      {
        id: 'time-compare-revenue',
        label: 'Revenue',
        columns: comparisonRevenueColumns,
        source: 'time_compare',
        placement: 'right',
      },
    ],
    column => ({ field: column.key }),
  );

  expect(nested).toEqual([
    { field: 'region' },
    {
      headerName: 'Revenue',
      marryChildren: true,
      openByDefault: true,
      headerClass: 'ag-header-align-center',
      children: [
        { field: `Main revenue` },
        { field: '# revenue' },
        { field: '△ revenue' },
        { field: '% revenue' },
      ],
    },
  ]);
});

test('nestColDefsInHeaderGroups expands a user group onto comparison columns', () => {
  const nested = nestColDefsInHeaderGroups(
    [
      { key: `Main revenue`, metricName: 'revenue' },
      { key: '# revenue', metricName: 'revenue' },
    ],
    [{ id: 'sales', label: 'Sales', columns: ['revenue'], placement: 'right' }],
    column => ({ field: column.key }),
  );

  expect(nested).toEqual([
    {
      headerName: 'Sales',
      marryChildren: true,
      openByDefault: true,
      headerClass: 'ag-header-align-center',
      children: [{ field: `Main revenue` }, { field: '# revenue' }],
    },
  ]);
});

test('syncTimeComparisonGroups defaults missing auto groups to an empty list', () => {
  expect(
    syncTimeComparisonGroups([
      {
        id: 'time-compare-revenue',
        label: 'Revenue',
        columns: comparisonRevenueColumns,
        source: 'time_compare',
      },
    ]),
  ).toEqual([]);
});

test('syncTimeComparisonGroups adds missing auto groups and keeps edits', () => {
  const existing: HeaderGroupConfig[] = [
    {
      id: 'custom',
      label: 'Custom',
      columns: ['region'],
    },
    {
      id: 'time-compare-revenue',
      label: 'Renamed',
      columns: [`Main revenue`],
      source: 'time_compare',
    },
  ];
  const next = syncTimeComparisonGroups(existing, [
    {
      id: 'time-compare-revenue',
      label: 'Revenue',
      columns: comparisonRevenueColumns,
      source: 'time_compare',
    },
    {
      id: 'time-compare-profit',
      label: 'Profit',
      columns: [`Main profit`],
      source: 'time_compare',
    },
  ]);

  expect(next.map(group => group.id)).toEqual([
    'custom',
    'time-compare-revenue',
    'time-compare-profit',
  ]);
  expect(next[1].label).toBe('Renamed');
});

test('resolveHeaderGroups labels percent metrics after stripping the prefix', () => {
  expect(
    resolveHeaderGroups([], {
      timeCompareEnabled: true,
      metricKeys: ['%profit'],
      verboseMap: { profit: 'Profit' },
    }),
  ).toEqual([
    expect.objectContaining({
      id: 'time-compare-%profit',
      label: '%Profit',
      source: 'time_compare',
    }),
  ]);
});

test('resolveHeaderGroups derives time comparison groups without saved header_groups', () => {
  expect(
    resolveHeaderGroups([], {
      timeCompareEnabled: true,
      metricKeys: ['revenue'],
      verboseMap: { revenue: 'Revenue' },
    }),
  ).toEqual([
    expect.objectContaining({
      id: 'time-compare-revenue',
      label: 'Revenue',
      source: 'time_compare',
      columns: comparisonRevenueColumns,
    }),
  ]);
  expect(
    resolveHeaderGroups(
      [
        {
          id: 'time-compare-revenue',
          label: 'Renamed',
          columns: comparisonRevenueColumns,
          source: 'time_compare',
        },
      ],
      { timeCompareEnabled: false, metricKeys: ['revenue'] },
    ),
  ).toEqual([]);
});

test('resolveHeaderGroups keeps user groups and renamed auto groups', () => {
  const next = resolveHeaderGroups(
    [
      { id: 'custom', label: 'Custom', columns: ['region'] },
      {
        id: 'time-compare-revenue',
        label: 'Renamed',
        columns: comparisonRevenueColumns,
        source: 'time_compare',
      },
    ],
    {
      timeCompareEnabled: true,
      metricKeys: ['revenue', 'profit'],
      verboseMap: { revenue: 'Revenue', profit: 'Profit' },
    },
  );

  expect(next.map(group => group.id)).toEqual([
    'custom',
    'time-compare-revenue',
    'time-compare-profit',
  ]);
  expect(next[1].label).toBe('Renamed');
  expect(next[2].label).toBe('Profit');
});

test('headerGroupsHaveSameColumns compares ids and nested columns', () => {
  expect(headerGroupsHaveSameColumns(chartGroups, chartGroups)).toBe(true);
  expect(
    headerGroupsHaveSameColumns(chartGroups, [
      { ...chartGroups[0], columns: ['profit'] },
    ]),
  ).toBe(false);
});

test('getHeaderGroupsControlProps builds time comparison groups', () => {
  const result = getHeaderGroupsControlProps(
    {
      datasource: { verbose_map: { revenue: 'Revenue' } },
      form_data: { metrics: ['revenue'], groupby: ['region'] },
      controls: { time_compare: { value: '1 year ago' } },
    },
    { queriesResponse: [{ colnames: ['region', 'revenue'] }] },
  );

  expect(result.timeComparisonGroups).toEqual([
    expect.objectContaining({
      id: 'time-compare-revenue',
      label: 'Revenue',
      source: 'time_compare',
      columns: [`Main revenue`, '# revenue', '△ revenue', '% revenue'],
    }),
  ]);
  expect(result.columnOptions.map(option => option.value)).toEqual([
    'region',
    `Main revenue`,
    '# revenue',
    '△ revenue',
    '% revenue',
  ]);
});

test('getHeaderGroupsControlProps returns no auto groups without time comparison', () => {
  const result = getHeaderGroupsControlProps(
    {
      form_data: { metrics: ['revenue'] },
      controls: { time_compare: { value: [] } },
    },
    { queriesResponse: null },
  );

  expect(result.timeComparisonGroups).toEqual([]);
  expect(result.columnOptions.map(option => option.value)).toEqual(['revenue']);
});

test('getHeaderGroupsControlProps skips unprefixed percent metrics', () => {
  const result = getHeaderGroupsControlProps(
    {
      form_data: { metrics: [], percent_metrics: ['profit'] },
      controls: { time_compare: { value: '1 year ago' } },
    },
    { queriesResponse: [{ colnames: ['profit', '%profit'] }] },
  );

  expect(result.columnOptions.map(option => option.value)).toEqual([
    `Main %profit`,
    '# %profit',
    '△ %profit',
    '% %profit',
  ]);
});

test('getHeaderGroupsControlProps uses array verbose maps and skips offset columns', () => {
  const result = getHeaderGroupsControlProps(
    {
      datasource: { verbose_map: ['revenue'] },
      form_data: {
        metrics: ['revenue'],
        groupby: ['region'],
        all_columns: ['unused'],
      },
      controls: { time_compare: { value: '1 year ago' } },
    },
    {
      queriesResponse: [
        { colnames: ['region', 'revenue', 'revenue__1 year ago'] },
      ],
    },
  );

  expect(result.columnOptions.map(option => option.value)).toEqual([
    'region',
    `Main revenue`,
    '# revenue',
    '△ revenue',
    '% revenue',
  ]);
  expect(result.columnOptions[1].label).toBe(`Main revenue`);
});

test('getHeaderGroupsControlProps includes percent metrics in auto groups', () => {
  const result = getHeaderGroupsControlProps({
    datasource: { verbose_map: { revenue: 'Revenue', profit: 'Profit' } },
    form_data: { metrics: ['revenue'], percent_metrics: ['profit'] },
    controls: { time_compare: { value: '1 year ago' } },
  });

  expect(result.timeComparisonGroups).toEqual([
    expect.objectContaining({
      id: 'time-compare-revenue',
      label: 'Revenue',
    }),
    expect.objectContaining({
      id: 'time-compare-%profit',
      label: '%Profit',
    }),
  ]);
});
