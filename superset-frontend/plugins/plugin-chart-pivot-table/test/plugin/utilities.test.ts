/*
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

import { TimeGranularity } from '@superset-ui/core';
import buildGroupbyCombinations from '../../src/plugin/utilities';
import { PivotTableQueryFormData, MetricsLayoutEnum } from '../../src/types';

const baseFormData: PivotTableQueryFormData = {
  groupbyRows: ['row1', 'row2'],
  groupbyColumns: ['col1', 'col2'],
  metrics: ['metric1', 'metric2'],
  tableRenderer: 'Table With Subtotal',
  colOrder: 'key_a_to_z',
  rowOrder: 'key_a_to_z',
  metricsLayout: MetricsLayoutEnum.ROWS,
  transposePivot: false,
  rowSubtotalPosition: true,
  colSubtotalPosition: true,
  colTotals: true,
  colSubTotals: true,
  rowTotals: true,
  rowSubTotals: true,
  valueFormat: 'SMART_NUMBER',
  datasource: '5__table',
  viz_type: 'my_chart',
  width: 800,
  height: 600,
  combineMetric: false,
  verboseMap: {},
  columnFormats: {},
  currencyFormats: {},
  metricColorFormatters: [],
  dateFormatters: {},
  setDataMask: () => {},
  legacy_order_by: 'count',
  order_desc: true,
  margin: 0,
  time_grain_sqla: TimeGranularity.MONTH,
  temporal_columns_lookup: { col1: true },
  currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
};

test('should build all combinations for basic pivot table', () => {
  const combinations = buildGroupbyCombinations(baseFormData);

  expect(combinations).toEqual([
    { rows: [], columns: [] },
    { rows: [], columns: ['col1'] },
    { rows: [], columns: ['col1', 'col2'] },
    { rows: ['row1'], columns: [] },
    { rows: ['row1'], columns: ['col1'] },
    { rows: ['row1'], columns: ['col1', 'col2'] },
    { rows: ['row1', 'row2'], columns: [] },
    { rows: ['row1', 'row2'], columns: ['col1'] },
    { rows: ['row1', 'row2'], columns: ['col1', 'col2'] },
  ]);

  expect(combinations).toHaveLength(9);
});

test('should handle transposed pivot correctly', () => {
  const modifiedFormData = {
    ...baseFormData,
    transposePivot: true,
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([
    { rows: [], columns: [] },
    { rows: [], columns: ['row1'] },
    { rows: [], columns: ['row1', 'row2'] },
    { rows: ['col1'], columns: [] },
    { rows: ['col1'], columns: ['row1'] },
    { rows: ['col1'], columns: ['row1', 'row2'] },
    { rows: ['col1', 'col2'], columns: [] },
    { rows: ['col1', 'col2'], columns: ['row1'] },
    { rows: ['col1', 'col2'], columns: ['row1', 'row2'] },
  ]);
});

test('should filter combinations when combineMetric is true with ROWS layout', () => {
  const modifiedFormData = {
    ...baseFormData,
    combineMetric: true,
    metricsLayout: MetricsLayoutEnum.ROWS,
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([
    { rows: ['row1', 'row2'], columns: [] },
    { rows: ['row1', 'row2'], columns: ['col1'] },
    { rows: ['row1', 'row2'], columns: ['col1', 'col2'] },
  ]);

  expect(combinations).toHaveLength(3);
});

test('should filter combinations when combineMetric is true with COLUMNS layout', () => {
  const modifiedFormData = {
    ...baseFormData,
    combineMetric: true,
    metricsLayout: MetricsLayoutEnum.COLUMNS,
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([
    { rows: [], columns: ['col1', 'col2'] },
    { rows: ['row1'], columns: ['col1', 'col2'] },
    { rows: ['row1', 'row2'], columns: ['col1', 'col2'] },
  ]);

  expect(combinations).toHaveLength(3);
});

test('should handle single dimension in rows only', () => {
  const modifiedFormData = {
    ...baseFormData,
    groupbyRows: ['row'],
    groupbyColumns: [],
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([
    { rows: [], columns: [] },
    { rows: ['row'], columns: [] },
  ]);

  expect(combinations).toHaveLength(2);
});

test('should handle single dimension in columns only', () => {
  const modifiedFormData = {
    ...baseFormData,
    groupbyRows: [],
    groupbyColumns: ['col'],
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([
    { rows: [], columns: [] },
    { rows: [], columns: ['col'] },
  ]);

  expect(combinations).toHaveLength(2);
});

test('should handle empty groupby arrays', () => {
  const modifiedFormData = {
    ...baseFormData,
    groupbyRows: [],
    groupbyColumns: [],
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([{ rows: [], columns: [] }]);

  expect(combinations).toHaveLength(1);
});

test('should work with combineMetric and transposed pivot', () => {
  const modifiedFormData = {
    ...baseFormData,
    transposePivot: true,
    combineMetric: true,
    metricsLayout: MetricsLayoutEnum.COLUMNS,
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([
    { rows: [], columns: ['row1', 'row2'] },
    { rows: ['col1'], columns: ['row1', 'row2'] },
    { rows: ['col1', 'col2'], columns: ['row1', 'row2'] },
  ]);
});

test('should handle combineMetric with empty arrays correctly', () => {
  const modifiedFormData = {
    ...baseFormData,
    groupbyRows: [],
    groupbyColumns: ['col'],
    combineMetric: true,
    metricsLayout: MetricsLayoutEnum.ROWS,
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toEqual([
    { rows: [], columns: [] },
    { rows: [], columns: ['col'] },
  ]);
});

test('should work with large number of dimensions', () => {
  const modifiedFormData = {
    ...baseFormData,
    groupbyRows: ['r1', 'r2', 'r3', 'r4'],
    groupbyColumns: ['c1', 'c2', 'c3'],
  };

  const combinations = buildGroupbyCombinations(modifiedFormData);

  expect(combinations).toHaveLength(20);

  expect(combinations).toContainEqual({ rows: [], columns: [] });
  expect(combinations).toContainEqual({
    rows: ['r1', 'r2', 'r3', 'r4'],
    columns: ['c1', 'c2', 'c3'],
  });
});
