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
  BinaryAdhocFilter,
  ComparisonType,
  FreeFormAdhocFilter,
  RollingType,
  TimeGranularity,
} from '@superset-ui/core';
import buildQuery from '../../src/MixedTimeseries/buildQuery';

const formDataMixedChart = {
  datasource: 'dummy',
  viz_type: 'my_chart',
  // query
  //   -- common
  time_range: '1980 : 2000',
  time_grain_sqla: TimeGranularity.WEEK,
  granularity_sqla: 'ds',
  //   -- query a
  groupby: ['foo'],
  metrics: ['sum(sales)'],
  adhoc_filters: [
    {
      clause: 'WHERE',
      expressionType: 'SQL',
      sqlExpression: "foo in ('a', 'b')",
    } as FreeFormAdhocFilter,
  ],
  limit: 5,
  row_limit: 10,
  timeseries_limit_metric: 'count',
  order_desc: true,
  truncate_metric: true,
  show_empty_columns: true,
  //   -- query b
  groupby_b: [],
  metrics_b: ['count'],
  adhoc_filters_b: [
    {
      clause: 'WHERE',
      expressionType: 'SQL',
      sqlExpression: "name in ('c', 'd')",
    } as FreeFormAdhocFilter,
  ],
  limit_b: undefined,
  row_limit_b: 100,
  timeseries_limit_metric_b: undefined,
  order_desc_b: false,
  truncate_metric_b: true,
  show_empty_columns_b: true,
  // chart configs
  show_value: false,
  show_valueB: undefined,
};
const formDataMixedChartWithAA = {
  ...formDataMixedChart,
  rolling_type: RollingType.Cumsum,
  time_compare: ['1 years ago'],
  comparison_type: ComparisonType.Values,
  resample_rule: '1AS',
  resample_method: 'zerofill',

  rolling_type_b: RollingType.Sum,
  rolling_periods_b: 1,
  min_periods_b: 1,
  comparison_type_b: ComparisonType.Difference,
  time_compare_b: ['3 years ago'],
  resample_rule_b: '1A',
  resample_method_b: 'asfreq',
};

test('should compile query object A', () => {
  const query = buildQuery(formDataMixedChart).queries[0];
  expect(query).toEqual({
    time_range: '1980 : 2000',
    since: undefined,
    until: undefined,
    granularity: 'ds',
    filters: [],
    extras: {
      having: '',
      time_grain_sqla: 'P1W',
      where: "(foo in ('a', 'b'))",
    },
    applied_time_extras: {},
    columns: ['foo'],
    metrics: ['sum(sales)'],
    annotation_layers: [],
    row_limit: 10,
    row_offset: undefined,
    series_columns: ['foo'],
    series_limit: 5,
    series_limit_metric: 'count',
    order_desc: true,
    group_others_when_limit_reached: false,
    url_params: {},
    custom_params: {},
    custom_form_data: {},
    is_timeseries: true,
    time_offsets: [],
    post_processing: [
      {
        operation: 'pivot',
        options: {
          aggregates: {
            'sum(sales)': {
              operator: 'mean',
            },
          },
          columns: ['foo'],
          drop_missing_columns: false,
          index: ['__timestamp'],
        },
      },
      {
        operation: 'rename',
        options: {
          columns: {
            'sum(sales)': null,
          },
          inplace: true,
          level: 0,
        },
      },
      {
        operation: 'flatten',
      },
    ],
    orderby: [['count', false]],
  });
});

test('should compile query object B', () => {
  const query = buildQuery(formDataMixedChart).queries[1];
  expect(query).toEqual({
    time_range: '1980 : 2000',
    since: undefined,
    until: undefined,
    granularity: 'ds',
    filters: [],
    extras: {
      having: '',
      time_grain_sqla: 'P1W',
      where: "(name in ('c', 'd'))",
    },
    applied_time_extras: {},
    columns: [],
    metrics: ['count'],
    annotation_layers: [],
    row_limit: 100,
    row_offset: undefined,
    series_columns: [],
    series_limit: 0,
    series_limit_metric: undefined,
    order_desc: false,
    group_others_when_limit_reached: false,
    url_params: {},
    custom_params: {},
    custom_form_data: {},
    is_timeseries: true,
    time_offsets: [],
    post_processing: [
      {
        operation: 'pivot',
        options: {
          aggregates: {
            count: {
              operator: 'mean',
            },
          },
          columns: [],
          drop_missing_columns: false,
          index: ['__timestamp'],
        },
      },
      {
        operation: 'flatten',
      },
    ],
    orderby: [['count', true]],
  });
});

test('should compile Matrixify filters for both mixed timeseries queries', () => {
  // Matrixify injects a per-cell dimension filter into `adhoc_filters` and every
  // query-specific `adhoc_filters_*` collection. Query A reads `adhoc_filters`
  // and query B reads `adhoc_filters_b`, so both queries must end up filtered.
  const matrixifyCountryFilter: BinaryAdhocFilter = {
    clause: 'WHERE',
    expressionType: 'SIMPLE',
    subject: 'country',
    operator: '==',
    comparator: 'USA',
    isExtra: false,
  };
  const formData = {
    ...formDataMixedChart,
    adhoc_filters: [
      ...formDataMixedChart.adhoc_filters,
      matrixifyCountryFilter,
    ],
    adhoc_filters_b: [
      ...formDataMixedChart.adhoc_filters_b,
      matrixifyCountryFilter,
    ],
  };

  const [queryA, queryB] = buildQuery(formData).queries;

  expect(queryA.filters).toEqual([{ col: 'country', op: '==', val: 'USA' }]);
  expect(queryB.filters).toEqual([{ col: 'country', op: '==', val: 'USA' }]);
  // The pre-existing free-form filter on query B is preserved in `extras`.
  expect(queryB.extras?.where).toBe("(name in ('c', 'd'))");
});

test('should compile AA in query A', () => {
  const query = buildQuery(formDataMixedChartWithAA).queries[0];
  // time comparison
  expect(query.time_offsets).toEqual(['1 years ago']);

  // pivot
  expect(
    query.post_processing?.find(operator => operator?.operation === 'pivot'),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['__timestamp'],
      columns: ['foo'],
      drop_missing_columns: false,
      aggregates: {
        'sum(sales)': { operator: 'mean' },
        'sum(sales)__1 years ago': { operator: 'mean' },
      },
    },
  });
  // cumsum
  expect(
    query.post_processing?.find(operator => operator?.operation === 'cum')
      ?.operation,
  ).toEqual('cum');

  // resample
  expect(
    query.post_processing?.find(operator => operator?.operation === 'resample'),
  ).toEqual({
    operation: 'resample',
    options: {
      method: 'asfreq',
      rule: '1AS',
      fill_value: 0,
    },
  });
});

test('should compile AA in query B', () => {
  const query = buildQuery(formDataMixedChartWithAA).queries[1];
  // time comparison
  expect(query.time_offsets).toEqual(['3 years ago']);

  // rolling total
  expect(
    query.post_processing?.find(operator => operator?.operation === 'rolling'),
  ).toEqual({
    operation: 'rolling',
    options: {
      rolling_type: 'sum',
      window: 1,
      min_periods: 1,
      columns: {
        count: 'count',
        'count__3 years ago': 'count__3 years ago',
      },
    },
  });

  // resample
  expect(
    query.post_processing?.find(operator => operator?.operation === 'resample'),
  ).toEqual({
    operation: 'resample',
    options: {
      method: 'asfreq',
      rule: '1A',
      fill_value: null,
    },
  });
});

test("shouldn't convert a queryObject with axis", () => {
  const { queries } = buildQuery(formDataMixedChart);
  expect(queries[0]).toEqual(
    expect.objectContaining({
      granularity: 'ds',
      columns: ['foo'],
      series_columns: ['foo'],
      metrics: ['sum(sales)'],
      is_timeseries: true,
      extras: {
        time_grain_sqla: 'P1W',
        having: '',
        where: "(foo in ('a', 'b'))",
      },
      post_processing: [
        {
          operation: 'pivot',
          options: {
            aggregates: {
              'sum(sales)': {
                operator: 'mean',
              },
            },
            columns: ['foo'],
            drop_missing_columns: false,
            index: ['__timestamp'],
          },
        },
        {
          operation: 'rename',
          options: { columns: { 'sum(sales)': null }, inplace: true, level: 0 },
        },
        {
          operation: 'flatten',
        },
      ],
    }),
  );
  expect(queries[1]).toEqual(
    expect.objectContaining({
      granularity: 'ds',
      columns: [],
      series_columns: [],
      metrics: ['count'],
      is_timeseries: true,
      extras: {
        time_grain_sqla: 'P1W',
        having: '',
        where: "(name in ('c', 'd'))",
      },
      post_processing: [
        {
          operation: 'pivot',
          options: {
            aggregates: {
              count: {
                operator: 'mean',
              },
            },
            columns: [],
            drop_missing_columns: false,
            index: ['__timestamp'],
          },
        },
        {
          operation: 'flatten',
        },
      ],
    }),
  );
});

test('ensure correct pivot columns', () => {
  const query = buildQuery({ ...formDataMixedChartWithAA, x_axis: 'ds' })
    .queries[0];

  expect(query.time_offsets).toEqual(['1 years ago']);

  // pivot
  expect(
    query.post_processing?.find(operator => operator?.operation === 'pivot'),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['ds'],
      columns: ['foo'],
      drop_missing_columns: false,
      aggregates: {
        'sum(sales)': { operator: 'mean' },
        'sum(sales)__1 years ago': { operator: 'mean' },
      },
    },
  });
});

test('preserves order_desc and series_limit_metric for both queries', () => {
  // Regression for sc-107146: toggling "Sort Descending" off in a Mixed Chart
  // updated the displayed SQL but not the rendered result. The backend
  // series-limit subquery picks the top-N series from `order_desc`, so dropping
  // it (as `normalizeOrderBy` does) made the sort direction silently ignored.
  const ascendingFormData = {
    ...formDataMixedChart,
    order_desc: false,
    order_desc_b: false,
    timeseries_limit_metric_b: 'count',
  };
  const { queries } = buildQuery(ascendingFormData);

  // Query A: ascending sort by its explicit sort metric must survive.
  expect(queries[0]).toEqual(
    expect.objectContaining({
      order_desc: false,
      series_limit_metric: 'count',
      orderby: [['count', true]],
    }),
  );

  // Query B: the `_b` query must independently keep its own direction/metric.
  expect(queries[1]).toEqual(
    expect.objectContaining({
      order_desc: false,
      series_limit_metric: 'count',
      orderby: [['count', true]],
    }),
  );
});

/* ----------------------------------------------------------------------------
 * Multi-dataset mode (target-stamped requests)
 *
 * A chart-data request carries exactly one datasource, so a chart with a
 * secondary dataset sends two requests — one per target — each stamped with
 * `_mixed_target`. Each request must contain exactly its own half, bound to
 * its own datasource, with its own x-axis.
 * ------------------------------------------------------------------------- */

const formDataMultiDataset = {
  ...formDataMixedChart,
  datasource: '25__table',
  x_axis: 'ds',
  use_secondary_dataset: true,
  datasource_b: '42__table',
  x_axis_b: 'order_date',
};

test('target A emits a single-query context bound to the chart datasource', () => {
  const context = buildQuery({ ...formDataMultiDataset, _mixed_target: 'A' });

  expect(context.datasource).toEqual({ id: 25, type: 'table' });
  expect(context.queries).toHaveLength(1);

  const query = context.queries[0];
  // Query A's own fields survive; no _b field may leak into the request.
  // With x_axis set, normalizeTimeColumn promotes it to the BASE_AXIS
  // adhoc-column form carrying the shared time grain.
  expect(query.columns).toEqual([
    {
      columnType: 'BASE_AXIS',
      expressionType: 'SQL',
      isColumnReference: true,
      label: 'ds',
      sqlExpression: 'ds',
      timeGrain: 'P1W',
    },
    'foo',
  ]);
  expect(query.series_columns).toEqual(['foo']);
  expect(query.metrics).toEqual(['sum(sales)']);
  expect(query.extras?.where).toBe("(foo in ('a', 'b'))");
  expect(query.row_limit).toBe(10);
  expect(query.series_limit).toBe(5);
});

test('target B emits a single-query context bound to the secondary datasource', () => {
  const context = buildQuery({ ...formDataMultiDataset, _mixed_target: 'B' });

  expect(context.datasource).toEqual({ id: 42, type: 'table' });
  expect(context.queries).toHaveLength(1);

  const query = context.queries[0];
  // _b fields are promoted to their base names for the request.
  expect(query.metrics).toEqual(['count']);
  expect(query.extras?.where).toBe("(name in ('c', 'd'))");
  expect(query.row_limit).toBe(100);
  // The x-axis is B's own column, not the shared one — normalized to the
  // BASE_AXIS adhoc-column form with the shared time grain stamped on it
  // (the grain must reach Dataset B's own database for bucket alignment).
  expect(query.columns).toEqual([
    {
      columnType: 'BASE_AXIS',
      expressionType: 'SQL',
      isColumnReference: true,
      label: 'order_date',
      sqlExpression: 'order_date',
      timeGrain: 'P1W',
    },
  ]);
  // No groupby_b leakage: groupby_b was [], and it is now the base `groupby`.
  expect(query.series_columns).toEqual([]);
});

test('target B applies its own x-axis to the pivot index', () => {
  const formData = {
    ...formDataMultiDataset,
    groupby_b: ['region'],
    metrics_b: ['sum(spend)'],
  };
  const context = buildQuery({ ...formData, _mixed_target: 'B' });

  const pivot = context.queries[0].post_processing?.find(
    operator => operator?.operation === 'pivot',
  );
  expect(pivot).toEqual({
    operation: 'pivot',
    options: {
      index: ['order_date'],
      columns: ['region'],
      drop_missing_columns: false,
      aggregates: { 'sum(spend)': { operator: 'mean' } },
    },
  });
});

test('target B carries B-side advanced-analytics operators', () => {
  const formData = {
    ...formDataMultiDataset,
    ...formDataMixedChartWithAA,
  };
  const context = buildQuery({ ...formData, _mixed_target: 'B' });
  const query = context.queries[0];

  // B's time compare and resample settings (not A's) reach B's request.
  expect(query.time_offsets).toEqual(['3 years ago']);
  expect(
    query.post_processing?.find(operator => operator?.operation === 'resample'),
  ).toEqual({
    operation: 'resample',
    options: { method: 'asfreq', rule: '1A', fill_value: null },
  });
});

test('a target stamp without a secondary datasource falls back to the merged context', () => {
  // Defensive: a stale `_mixed_target` on a chart that no longer configures
  // Dataset B must produce the original single-request behavior, not a
  // single-target one bound to a missing datasource.
  const { datasource, queries } = buildQuery({
    ...formDataMixedChart,
    _mixed_target: 'B',
  });

  expect(datasource).toEqual({ id: NaN, type: 'table' }); // 'dummy' datasource, as the legacy tests use
  expect(queries).toHaveLength(2);
});

test('multi-dataset form data without a target stamp keeps the merged context', () => {
  // The feature's own form data flows through shared callers (dashboards,
  // exports, SQL Lab redirect) that do not stamp a target; those must see the
  // unchanged two-query merged context bound to the chart datasource.
  const { datasource, queries } = buildQuery(formDataMultiDataset);

  expect(datasource).toEqual({ id: 25, type: 'table' });
  expect(queries).toHaveLength(2);
});
