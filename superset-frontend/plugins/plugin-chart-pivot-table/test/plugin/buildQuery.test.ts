// DODO was here

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
  aggregateFunction: 'Sum',
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
  datasourceDescriptions: {}, // DODO added 44728892
};

test('should build groupby with series in form data', () => {
  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;
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
  const [query] = queryContext.queries;
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
  const [query] = queryContext.queries;
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
  const [query] = queryContext.queries;
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
  const [query] = queryContext.queries;
  expect(query.extras?.time_grain_sqla).toEqual(TimeGranularity.QUARTER);
});
