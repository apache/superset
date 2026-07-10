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
import buildQuery from '../../src/plugin/buildQuery';
import { PivotTableQueryFormData } from '../../src/types';

const formData: PivotTableQueryFormData = {
  groupbyRows: ['row1', 'row2'],
  groupbyColumns: ['col1', 'col2'],
  metrics: ['metric1', 'metric2'],
  tableRenderer: 'Table With Subtotal',
  colOrder: 'key_a_to_z',
  rowOrder: 'key_a_to_z',
  transposePivot: true,
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

test('additive metrics use the fast-path: a single full-detail query', () => {
  const { queries } = buildQuery({
    ...formData,
    metrics: [
      {
        expressionType: 'SIMPLE',
        aggregate: 'SUM',
        column: { column_name: 'num' },
        label: 'sum_num',
      },
    ] as any,
  });
  expect(queries).toHaveLength(1);
  // The single leaf query carries all dimensions (2 rows + 2 cols).
  expect(queries[0].columns).toHaveLength(4);
});

test('non-additive metrics emit a single GROUPING SETS query with all levels', () => {
  // 2 row dims x 2 col dims -> (2+1) x (2+1) = 9 rollup levels, carried as
  // grouping_sets on a single query (saved-metric strings are non-additive).
  const queryContext = buildQuery(formData);
  expect(queryContext.queries).toHaveLength(1);
  const [query] = queryContext.queries;
  // The single query selects the full set of dimensions ...
  expect(query.columns).toHaveLength(4);
  // ... and requests every rollup level via grouping_sets (grand total = []).
  expect((query as any).grouping_sets).toHaveLength(9);
  expect((query as any).grouping_sets[0]).toEqual([]);
  expect((query as any).grouping_sets[8]).toHaveLength(4);
});

test('should build groupby with series in form data', () => {
  const queryContext = buildQuery(formData);
  // Single GROUPING SETS query: the sole query carries the full column set.
  const query = queryContext.queries[queryContext.queries.length - 1];
  expect(query.columns).toEqual([
    {
      columnType: 'BASE_AXIS',
      expressionType: 'SQL',
      label: 'col1',
      sqlExpression: 'col1',
      timeGrain: 'P1M',
    },
    'col2',
    'row1',
    'row2',
  ]);
});

test('should work with old charts', () => {
  const modifiedFormData = {
    ...formData,
    time_grain_sqla: TimeGranularity.MONTH,
    granularity_sqla: 'col1',
  };
  const queryContext = buildQuery(modifiedFormData);
  // Single GROUPING SETS query: the sole query carries the full column set.
  const query = queryContext.queries[queryContext.queries.length - 1];
  expect(query.columns).toEqual([
    {
      timeGrain: 'P1M',
      columnType: 'BASE_AXIS',
      sqlExpression: 'col1',
      label: 'col1',
      expressionType: 'SQL',
    },
    'col2',
    'row1',
    'row2',
  ]);
});

test('should prefer extra_form_data.time_grain_sqla over formData.time_grain_sqla', () => {
  const modifiedFormData = {
    ...formData,
    extra_form_data: { time_grain_sqla: TimeGranularity.QUARTER },
  };
  const queryContext = buildQuery(modifiedFormData);
  // Single GROUPING SETS query: the sole query carries the full column set.
  const query = queryContext.queries[queryContext.queries.length - 1];
  expect(query.columns?.[0]).toEqual({
    timeGrain: TimeGranularity.QUARTER,
    columnType: 'BASE_AXIS',
    sqlExpression: 'col1',
    label: 'col1',
    expressionType: 'SQL',
  });
});

test('should fallback to formData.time_grain_sqla if extra_form_data.time_grain_sqla is not set', () => {
  const queryContext = buildQuery(formData);
  // Single GROUPING SETS query: the sole query carries the full column set.
  const query = queryContext.queries[queryContext.queries.length - 1];
  expect(query.columns?.[0]).toEqual({
    timeGrain: formData.time_grain_sqla,
    columnType: 'BASE_AXIS',
    sqlExpression: 'col1',
    label: 'col1',
    expressionType: 'SQL',
  });
});

test('should not omit extras.time_grain_sqla from queryContext so dashboards apply them', () => {
  const modifiedFormData = {
    ...formData,
    extra_form_data: { time_grain_sqla: TimeGranularity.QUARTER },
  };
  const queryContext = buildQuery(modifiedFormData);
  // Single GROUPING SETS query: the sole query carries the full column set.
  const query = queryContext.queries[queryContext.queries.length - 1];
  expect(query.extras?.time_grain_sqla).toEqual(TimeGranularity.QUARTER);
});
