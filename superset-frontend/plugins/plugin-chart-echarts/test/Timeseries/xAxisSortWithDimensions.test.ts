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
  ChartDataResponseResult,
  DataRecord,
  QueryFormMetric,
} from '@superset-ui/core';
import { SortSeriesType } from '@superset-ui/chart-controls';
import transformProps from '../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
} from '../../src/Timeseries/types';
import { createEchartsTimeseriesTestChartProps } from '../helpers';

// A bar chart of COUNT(*) per genre, split by platform, with the axis sorted
// by a metric that is neither the value metric nor a dimension (#34352).
// The rows are what the backend returns for that query: the value metric's
// columns lose their metric label (`truncate_metric`), the sort-only metric
// keeps it, and `label_map` records the structure behind each column.
const naSales: QueryFormMetric = {
  expressionType: 'SIMPLE',
  aggregate: 'SUM',
  column: { column_name: 'na_sales' },
  label: 'SUM(na_sales)',
};

const rows: DataRecord[] = [
  {
    genre: 'Action',
    PS4: 30,
    XOne: 20,
    'SUM(na_sales), PS4': 5,
    'SUM(na_sales), XOne': 3,
  },
  {
    genre: 'Puzzle',
    PS4: 5,
    XOne: 5,
    'SUM(na_sales), PS4': 20,
    'SUM(na_sales), XOne': 10,
  },
  {
    genre: 'Sports',
    PS4: 40,
    XOne: 10,
    'SUM(na_sales), PS4': 1,
    'SUM(na_sales), XOne': 1,
  },
];

const labelMap = {
  genre: ['genre'],
  PS4: ['PS4'],
  XOne: ['XOne'],
  'SUM(na_sales), PS4': ['SUM(na_sales)', 'PS4'],
  'SUM(na_sales), XOne': ['SUM(na_sales)', 'XOne'],
};

const queriesData = [
  {
    annotation_data: null,
    cache_key: null,
    cache_timeout: null,
    cached_dttm: null,
    queried_dttm: null,
    data: rows,
    colnames: [],
    coltypes: [],
    error: null,
    is_cached: false,
    query: '',
    rowcount: rows.length,
    sql_rowcount: rows.length,
    stacktrace: null,
    status: 'success',
    from_dttm: null,
    to_dttm: null,
    label_map: labelMap,
  } as unknown as ChartDataResponseResult,
];

type Series = {
  name: string;
  data: [string, number][];
  label: {
    formatter: (params: {
      value: [string, number];
      dataIndex: number;
      seriesIndex: number;
    }) => string;
  };
};

// transformProps reads camelCase keys from `formData` and snake_case keys
// from `rawFormData`; the test helper hands the same object to both.
function transform(
  overrides: Record<string, unknown>,
  verboseMap = {},
  data = rows,
) {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsTimeseriesFormData,
    EchartsTimeseriesChartProps
  >({
    defaultFormData: DEFAULT_FORM_DATA,
    defaultVizType: 'echarts_timeseries_bar',
    formData: {
      colorScheme: 'bnbColors',
      seriesType: EchartsTimeseriesSeriesType.Bar,
      x_axis: 'genre',
      xAxis: 'genre',
      metrics: ['count'],
      groupby: ['platform'],
      timeseries_limit_metric: naSales,
      truncate_metric: true,
      stack: true,
      showValue: true,
      onlyTotal: true,
      ...overrides,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData:
      data === rows
        ? queriesData
        : [{ ...queriesData[0], data } as ChartDataResponseResult],
    datasource: { verboseMap },
  });
  const transformed = transformProps(chartProps);
  const series = transformed.echartOptions.series as Series[];
  return {
    series,
    // Legend order is a separate control; only the set of series matters here.
    seriesNames: series.map(({ name }) => name).sort(),
    axisOrder: series[0].data.map(([genre]) => genre),
    // With `onlyTotal` the top series' label carries the stacked total.
    stackedTotals: series
      .flatMap((entry, seriesIndex) =>
        entry.data.map((value, dataIndex) =>
          entry.label.formatter({ value, dataIndex, seriesIndex }),
        ),
      )
      .filter(label => label !== ''),
  };
}

test('sorts the axis by the sort-only metric across its pivoted columns', () => {
  const { axisOrder, seriesNames, stackedTotals } = transform({
    x_axis_sort: 'SUM(na_sales)',
    xAxisSort: 'SUM(na_sales)',
    x_axis_sort_asc: false,
    xAxisSortAsc: false,
  });
  // SUM(na_sales) totals: Puzzle 30, Action 8, Sports 2. Sorting by the value
  // metric would put Action/Sports first, sorting by name would put Puzzle
  // second.
  expect(axisOrder).toEqual(['Puzzle', 'Action', 'Sports']);
  expect(seriesNames).toEqual(['PS4', 'XOne']);
  // COUNT(*) totals only, in the sorted order.
  expect(stackedTotals).toEqual(['10', '50', '50']);
});

test('sorts the axis by the sort-only metric ascending', () => {
  const { axisOrder } = transform({
    x_axis_sort: 'SUM(na_sales)',
    xAxisSort: 'SUM(na_sales)',
    x_axis_sort_asc: true,
    xAxisSortAsc: true,
  });
  expect(axisOrder).toEqual(['Sports', 'Action', 'Puzzle']);
});

test('sorts by the sort-only metric when it has a verbose name', () => {
  const { axisOrder, seriesNames } = transform(
    {
      x_axis_sort: 'SUM(na_sales)',
      xAxisSort: 'SUM(na_sales)',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    },
    { 'SUM(na_sales)': 'NA Sales' },
  );
  expect(axisOrder).toEqual(['Puzzle', 'Action', 'Sports']);
  expect(seriesNames).toEqual(['PS4', 'XOne']);
});

test('sorts the axis by the x-axis column with dimensions set', () => {
  expect(
    transform({
      x_axis_sort: 'genre',
      xAxisSort: 'genre',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    }).axisOrder,
  ).toEqual(['Sports', 'Puzzle', 'Action']);
  expect(
    transform({
      x_axis_sort: 'genre',
      xAxisSort: 'genre',
      x_axis_sort_asc: true,
      xAxisSortAsc: true,
    }).axisOrder,
  ).toEqual(['Action', 'Puzzle', 'Sports']);
});

test('still sorts the axis by a series aggregate with dimensions set', () => {
  // An aggregate sort does not query the sort-only metric, so its columns
  // are not in the response.
  const valueRows = rows.map(({ genre, PS4, XOne }) => ({ genre, PS4, XOne }));
  const { axisOrder, seriesNames } = transform(
    {
      x_axis_sort: SortSeriesType.Max,
      xAxisSort: SortSeriesType.Max,
      x_axis_sort_asc: true,
      xAxisSortAsc: true,
    },
    {},
    valueRows,
  );
  // Max per row: Puzzle 5, Action 30, Sports 40.
  expect(axisOrder).toEqual(['Puzzle', 'Action', 'Sports']);
  expect(seriesNames).toEqual(['PS4', 'XOne']);
});

test('leaves the query order alone when the sort field is not in the data', () => {
  const { axisOrder } = transform({
    x_axis_sort: 'jp_sales',
    xAxisSort: 'jp_sales',
    x_axis_sort_asc: false,
    xAxisSortAsc: false,
  });
  expect(axisOrder).toEqual(['Action', 'Puzzle', 'Sports']);
});

test('sorts the axis by the sort-only metric with a time comparison', () => {
  // With a time comparison the backend also returns the shifted value
  // metric, which `renameOperator` relabels to the bare offset, and
  // `label_map` leads those entries with the offset. The sort-only metric
  // is pivoted like the value metric; its own shifted column is dropped by
  // the pivot, so it never reaches the response.
  const comparisonRows: DataRecord[] = [
    {
      genre: 'Action',
      'count, PS4': 30,
      'count, XOne': 20,
      '1 year ago, PS4': 25,
      '1 year ago, XOne': 15,
      'SUM(na_sales), PS4': 5,
      'SUM(na_sales), XOne': 3,
    },
    {
      genre: 'Puzzle',
      'count, PS4': 5,
      'count, XOne': 5,
      '1 year ago, PS4': 4,
      '1 year ago, XOne': 6,
      'SUM(na_sales), PS4': 20,
      'SUM(na_sales), XOne': 10,
    },
    {
      genre: 'Sports',
      'count, PS4': 40,
      'count, XOne': 10,
      '1 year ago, PS4': 35,
      '1 year ago, XOne': 12,
      'SUM(na_sales), PS4': 1,
      'SUM(na_sales), XOne': 1,
    },
  ];
  const comparisonLabelMap = {
    genre: ['genre'],
    count: ['count'],
    'SUM(na_sales)': ['SUM(na_sales)'],
    'count, PS4': ['count', 'PS4'],
    'count, XOne': ['count', 'XOne'],
    '1 year ago, PS4': ['1 year ago', 'PS4'],
    '1 year ago, XOne': ['1 year ago', 'XOne'],
    'SUM(na_sales), PS4': ['SUM(na_sales)', 'PS4'],
    'SUM(na_sales), XOne': ['SUM(na_sales)', 'XOne'],
  };
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsTimeseriesFormData,
    EchartsTimeseriesChartProps
  >({
    defaultFormData: DEFAULT_FORM_DATA,
    defaultVizType: 'echarts_timeseries_bar',
    formData: {
      colorScheme: 'bnbColors',
      seriesType: EchartsTimeseriesSeriesType.Bar,
      x_axis: 'genre',
      xAxis: 'genre',
      metrics: ['count'],
      groupby: ['platform'],
      timeseries_limit_metric: naSales,
      truncate_metric: true,
      comparison_type: 'values',
      comparisonType: 'values',
      time_compare: ['1 year ago'],
      timeCompare: ['1 year ago'],
      x_axis_sort: 'SUM(na_sales)',
      xAxisSort: 'SUM(na_sales)',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: comparisonRows,
        label_map: comparisonLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];

  // SUM(na_sales) totals: Puzzle 30, Action 8, Sports 2.
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual([
      'Puzzle',
      'Action',
      'Sports',
    ]);
  });
  // The value metric and its comparison are rendered per platform; neither
  // the sort-only metric's columns nor a shifted variant of them are.
  expect(series.map(({ name }) => name).sort()).toEqual([
    '1 year ago, PS4',
    '1 year ago, XOne',
    'count, PS4',
    'count, XOne',
  ]);
});
