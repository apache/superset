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
    series_limit_metric: undefined,
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
    // prettier-ignore
    query
      .post_processing
      ?.find(operator => operator?.operation === 'cum')
      ?.operation,
  ).toEqual('cum');

  // resample
  expect(
    // prettier-ignore
    query
      .post_processing
      ?.find(operator => operator?.operation === 'resample'),
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
    // prettier-ignore
    query
      .post_processing
      ?.find(operator => operator?.operation === 'rolling'),
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
    // prettier-ignore
    query
      .post_processing
      ?.find(operator => operator?.operation === 'resample'),
  ).toEqual({
    operation: 'resample',
    options: {
      method: 'asfreq',
      rule: '1A',
      fill_value: null,
    },
  });
});

test('should convert a queryObject with x-axis although FF is disabled', () => {
  let windowSpy: any;

  beforeAll(() => {
    // @ts-ignore
    windowSpy = jest.spyOn(window, 'window', 'get').mockImplementation(() => ({
      featureFlags: {
        GENERIC_CHART_AXES: false,
      },
    }));
  });

  afterAll(() => {
    windowSpy.mockRestore();
  });

  const { queries } = buildQuery({
    ...formDataMixedChart,
    x_axis: 'my_index',
  });
  expect(queries[0]).toEqual({
    time_range: '1980 : 2000',
    since: undefined,
    until: undefined,
    granularity: 'ds',
    filters: [],
    extras: {
      having: '',
      where: "(foo in ('a', 'b'))",
      time_grain_sqla: 'P1W',
    },
    applied_time_extras: {},
    columns: [
      {
        columnType: 'BASE_AXIS',
        expressionType: 'SQL',
        label: 'my_index',
        sqlExpression: 'my_index',
        timeGrain: 'P1W',
      },
      'foo',
    ],
    metrics: ['sum(sales)'],
    annotation_layers: [],
    row_limit: 10,
    row_offset: undefined,
    series_columns: ['foo'],
    series_limit: 5,
    series_limit_metric: undefined,
    url_params: {},
    custom_params: {},
    custom_form_data: {},
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
          index: ['my_index'],
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

  // check the main props on the second query
  expect(queries[1]).toEqual(
    expect.objectContaining({
      columns: [
        {
          columnType: 'BASE_AXIS',
          expressionType: 'SQL',
          label: 'my_index',
          sqlExpression: 'my_index',
          timeGrain: 'P1W',
        },
      ],
      granularity: 'ds',
      series_columns: [],
      metrics: ['count'],
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
            index: ['my_index'],
          },
        },
        {
          operation: 'flatten',
        },
      ],
    }),
  );
});

test("shouldn't convert a queryObject with axis although FF is enabled", () => {
  const windowSpy = jest
    .spyOn(window, 'window', 'get')
    // @ts-ignore
    .mockImplementation(() => ({
      featureFlags: {
        GENERIC_CHART_AXES: true,
      },
    }));

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

  windowSpy.mockRestore();
});

test('ensure correct pivot columns with GENERIC_CHART_AXES enabled', () => {
  const windowSpy = jest
    .spyOn(window, 'window', 'get')
    // @ts-ignore
    .mockImplementation(() => ({
      featureFlags: {
        GENERIC_CHART_AXES: true,
      },
    }));

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

  windowSpy.mockRestore();
});
