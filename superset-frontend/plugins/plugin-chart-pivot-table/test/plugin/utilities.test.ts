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
import buildGroupbyCombinations, {
  isAdditiveMetric,
  allMetricsAdditive,
  additiveReducerFor,
  synthesizeAdditiveLevels,
  splitGroupingSetsResult,
  groupingMarkerLabel,
} from '../../src/plugin/utilities';
import { PivotTableQueryFormData, MetricsLayoutEnum } from '../../src/types';

const baseFormData = {
  groupbyRows: ['row1', 'row2'],
  groupbyColumns: ['col1', 'col2'],
  metrics: ['metric1', 'metric2'],
  tableRenderer: 'Table With Subtotal',
  colOrder: 'key_a_to_z',
  rowOrder: 'key_a_to_z',
  aggregateFunction: 'Sum',
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
} as unknown as PivotTableQueryFormData;

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

test('isAdditiveMetric: SIMPLE metrics with additive aggregates are additive', () => {
  expect(
    isAdditiveMetric({
      expressionType: 'SIMPLE',
      aggregate: 'SUM',
      column: { column_name: 'num' },
      label: 'sum_num',
    } as any),
  ).toBe(true);
  expect(
    isAdditiveMetric({
      expressionType: 'SIMPLE',
      aggregate: 'COUNT',
      column: { column_name: 'num' },
      label: 'count_num',
    } as any),
  ).toBe(true);
});

test('isAdditiveMetric: non-additive aggregates, SQL, and saved metrics are not additive', () => {
  expect(
    isAdditiveMetric({
      expressionType: 'SIMPLE',
      aggregate: 'AVG',
      column: { column_name: 'num' },
      label: 'avg_num',
    } as any),
  ).toBe(false);
  expect(
    isAdditiveMetric({
      expressionType: 'SIMPLE',
      aggregate: 'COUNT_DISTINCT',
      column: { column_name: 'name' },
      label: 'distinct_names',
    } as any),
  ).toBe(false);
  expect(
    isAdditiveMetric({
      expressionType: 'SQL',
      sqlExpression: 'SUM(a) / SUM(b)',
      label: 'ratio',
    } as any),
  ).toBe(false);
  // saved-metric reference: aggregate unknown from form data -> non-additive
  expect(isAdditiveMetric('count' as any)).toBe(false);
});

test('allMetricsAdditive: all additive vs any non-additive vs empty', () => {
  const sum = {
    expressionType: 'SIMPLE',
    aggregate: 'SUM',
    column: { column_name: 'a' },
    label: 'a',
  } as any;
  const ratio = {
    expressionType: 'SQL',
    sqlExpression: 'SUM(a)/SUM(b)',
    label: 'r',
  } as any;
  expect(allMetricsAdditive([sum, sum])).toBe(true);
  expect(allMetricsAdditive([sum, ratio])).toBe(false);
  expect(allMetricsAdditive([])).toBe(false);
});

test('pruning: with all totals/subtotals off, only the leaf level is queried', () => {
  const combinations = buildGroupbyCombinations({
    ...baseFormData,
    colTotals: false,
    rowTotals: false,
    colSubTotals: false,
    rowSubTotals: false,
  });
  expect(combinations).toEqual([
    { rows: ['row1', 'row2'], columns: ['col1', 'col2'] },
  ]);
});

test('pruning: totals on, subtotals off -> only full + fully-collapsed prefixes', () => {
  const combinations = buildGroupbyCombinations({
    ...baseFormData,
    colTotals: true,
    rowTotals: true,
    colSubTotals: false,
    rowSubTotals: false,
  });
  // 2 row prefixes ([], full) x 2 col prefixes ([], full) = 4
  expect(combinations).toEqual([
    { rows: [], columns: [] },
    { rows: [], columns: ['col1', 'col2'] },
    { rows: ['row1', 'row2'], columns: [] },
    { rows: ['row1', 'row2'], columns: ['col1', 'col2'] },
  ]);
});

test('pruning: row subtotals on, everything else off', () => {
  const combinations = buildGroupbyCombinations({
    ...baseFormData,
    colTotals: false,
    rowTotals: false,
    colSubTotals: false,
    rowSubTotals: true,
  });
  // row prefixes: intermediate [row1] + full [row1,row2]; col prefixes: full only
  expect(combinations).toEqual([
    { rows: ['row1'], columns: ['col1', 'col2'] },
    { rows: ['row1', 'row2'], columns: ['col1', 'col2'] },
  ]);
});

test('pruning: empty column dims keep the [] (leaf) level regardless of rowTotals', () => {
  const combinations = buildGroupbyCombinations({
    ...baseFormData,
    groupbyColumns: [],
    colTotals: true, // bottom total row
    rowTotals: false,
    colSubTotals: false,
    rowSubTotals: false,
  });
  // columns is empty so [] is the leaf level (always kept); rows: [] (colTotals) + full
  expect(combinations).toEqual([
    { rows: [], columns: [] },
    { rows: ['row1', 'row2'], columns: [] },
  ]);
});

test('additiveReducerFor maps aggregates to reducers', () => {
  const mk = (aggregate: string) =>
    ({ expressionType: 'SIMPLE', aggregate, label: aggregate }) as any;
  expect(additiveReducerFor(mk('SUM'))).toBe('sum');
  expect(additiveReducerFor(mk('COUNT'))).toBe('sum');
  expect(additiveReducerFor(mk('MIN'))).toBe('min');
  expect(additiveReducerFor(mk('MAX'))).toBe('max');
  expect(additiveReducerFor('saved_metric' as any)).toBe('sum');
});

const LEAF = [
  { region: 'US', topic: 'a', value: 10 },
  { region: 'US', topic: 'b', value: 20 },
  { region: 'EU', topic: 'a', value: 5 },
];

test('synthesizeAdditiveLevels: sum reducer across rollup levels', () => {
  const [grand, perRegion, leaf] = synthesizeAdditiveLevels(
    LEAF,
    [
      { rows: [], columns: [] },
      { rows: ['region'], columns: [] },
      { rows: ['region', 'topic'], columns: [] },
    ],
    { value: 'sum' },
  );
  expect(grand).toEqual([{ value: 35 }]);
  expect(perRegion).toEqual([
    { region: 'US', value: 30 },
    { region: 'EU', value: 5 },
  ]);
  // leaf level reduces single-row groups -> identity
  expect(leaf).toEqual([
    { region: 'US', topic: 'a', value: 10 },
    { region: 'US', topic: 'b', value: 20 },
    { region: 'EU', topic: 'a', value: 5 },
  ]);
});

test('synthesizeAdditiveLevels: min/max reducers and null handling', () => {
  const rows = [...LEAF, { region: 'EU', topic: 'b', value: null }];
  const [grandMax] = synthesizeAdditiveLevels(
    rows,
    [{ rows: [], columns: [] }],
    { value: 'max' },
  );
  expect(grandMax).toEqual([{ value: 20 }]);
  const [grandMin] = synthesizeAdditiveLevels(
    rows,
    [{ rows: [], columns: [] }],
    { value: 'min' },
  );
  expect(grandMin).toEqual([{ value: 5 }]);
});

test('splitGroupingSetsResult splits by markers and strips them', () => {
  const gm = groupingMarkerLabel;
  const rows = [
    { region: 'US', topic: 'a', v: 10, [gm('region')]: 0, [gm('topic')]: 0 },
    { region: 'US', topic: 'b', v: 20, [gm('region')]: 0, [gm('topic')]: 0 },
    { region: 'US', topic: null, v: 30, [gm('region')]: 0, [gm('topic')]: 1 },
    { region: null, topic: null, v: 60, [gm('region')]: 1, [gm('topic')]: 1 },
  ];
  const [leaf, sub, grand] = splitGroupingSetsResult(
    rows,
    [['region', 'topic'], ['region'], []],
    ['region', 'topic'],
  );
  expect(leaf.map(r => r.v)).toEqual([10, 20]);
  expect(sub.map(r => r.v)).toEqual([30]);
  expect(grand.map(r => r.v)).toEqual([60]);
  // markers stripped
  [leaf, sub, grand].forEach(frame =>
    frame.forEach(r =>
      Object.keys(r).forEach(k =>
        expect(k.endsWith('__superset_grouping')).toBe(false),
      ),
    ),
  );
});
