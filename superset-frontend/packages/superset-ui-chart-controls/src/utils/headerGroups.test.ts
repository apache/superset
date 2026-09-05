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
import { t } from '@apache-superset/core/translation';
import {
  expandGroupColumnKey,
  getHeaderGroupsControlProps,
  nestColDefsInHeaderGroups,
  resolveHeaderGroups,
  syncTimeComparisonGroups,
  type HeaderGroupConfig,
} from './headerGroups';

const comparisonRevenueColumns = [
  `${t('Main')} revenue`,
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

test('expandGroupColumnKey maps a metric to its time comparison columns', () => {
  const visible = [
    'region',
    `${t('Main')} revenue`,
    '# revenue',
    '△ revenue',
    '% revenue',
  ];
  expect(expandGroupColumnKey('revenue', visible)).toEqual([
    `${t('Main')} revenue`,
    '# revenue',
    '△ revenue',
    '% revenue',
  ]);
});

test('nestColDefsInHeaderGroups wraps time comparison columns for a metric group', () => {
  const nested = nestColDefsInHeaderGroups(
    [
      { key: 'region' },
      { key: `${t('Main')} revenue`, metricName: 'revenue' },
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
        { field: `${t('Main')} revenue` },
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
      { key: `${t('Main')} revenue`, metricName: 'revenue' },
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
      children: [{ field: `${t('Main')} revenue` }, { field: '# revenue' }],
    },
  ]);
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
      columns: [`${t('Main')} revenue`],
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
      columns: [`${t('Main')} profit`],
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
      columns: [`${t('Main')} revenue`, '# revenue', '△ revenue', '% revenue'],
    }),
  ]);
  expect(result.columnOptions.map(option => option.value)).toEqual([
    'region',
    `${t('Main')} revenue`,
    '# revenue',
    '△ revenue',
    '% revenue',
  ]);
});
