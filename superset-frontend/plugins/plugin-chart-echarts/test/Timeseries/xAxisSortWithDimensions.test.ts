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
import { StackControlsValue } from '../../src/constants';
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
): {
  series: Series[];
  seriesNames: string[];
  axisOrder: string[];
  stackedTotals: string[];
} {
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

test('sorts the axis by the sole displayed metric when truncate_metric drops its label', () => {
  // With a single displayed metric and `truncate_metric` on, the backend
  // pivots columns straight to the dimension values (`PS4`/`XOne`) with no
  // `count, ` prefix, so `label_map` never marks them as belonging to
  // `count`. Selecting the displayed metric itself as the sort target must
  // still sum those columns rather than leaving the axis in query order.
  const valueRows = rows.map(({ genre, PS4, XOne }) => ({ genre, PS4, XOne }));
  const { axisOrder } = transform(
    {
      x_axis_sort: 'count',
      xAxisSort: 'count',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
      timeseries_limit_metric: undefined,
    },
    {},
    valueRows,
  );
  // PS4 + XOne totals: Action 50, Puzzle 10, Sports 50.
  expect(axisOrder).toEqual(['Action', 'Sports', 'Puzzle']);
});

test('permutes percentage-threshold labels along with the sorted rows', () => {
  // Action/Puzzle/Sports stacked totals (PS4 + XOne) are 50/10/50, so a 50%
  // threshold requires 25/5/25 respectively. Sorting by SUM(na_sales) desc
  // reorders the axis to Puzzle, Action, Sports (see the sort-only-metric
  // test above); each row's threshold must travel with it rather than
  // staying keyed to its pre-sort position.
  const { series } = transform({
    x_axis_sort: 'SUM(na_sales)',
    xAxisSort: 'SUM(na_sales)',
    x_axis_sort_asc: false,
    xAxisSortAsc: false,
    onlyTotal: false,
    percentageThreshold: 50,
  });
  const xOneSeries = series.find(({ name }) => name === 'XOne')!;
  const labels = xOneSeries.data.map((value, dataIndex) =>
    xOneSeries.label.formatter({ value, dataIndex, seriesIndex: 0 }),
  );
  // XOne values in sorted order: Puzzle 5, Action 20, Sports 10. Only
  // Puzzle's own value (5) clears its own threshold (5); Action's (20) and
  // Sports' (10) both fall short of theirs (25 each).
  expect(labels).toEqual(['5', '', '']);
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

test('does not hide a two-dimension series whose truncated label collides with the sort-only metric', () => {
  // With two dimensions (`platform`, `region`) and a single displayed
  // metric, `truncate_metric` drops the metric prefix from the displayed
  // series, so their `label_map` entries are just the two dimension values
  // (2 parts). The sort-only metric keeps its own prefix, so its pivoted
  // columns always carry 3 parts (metric + the two dimension values). A
  // dimension value that happens to read like the sort-only metric's label
  // ("SUM(na_sales)") must not make a genuine 2-part displayed column look
  // like one of the sort-only metric's 3-part columns.
  const twoDimRows: DataRecord[] = [
    {
      genre: 'Action',
      'SUM(na_sales), US': 30,
      'PS4, US': 20,
      'SUM(na_sales), SUM(na_sales), US': 5,
      'SUM(na_sales), PS4, US': 3,
    },
    {
      genre: 'Puzzle',
      'SUM(na_sales), US': 5,
      'PS4, US': 5,
      'SUM(na_sales), SUM(na_sales), US': 20,
      'SUM(na_sales), PS4, US': 10,
    },
    {
      genre: 'Sports',
      'SUM(na_sales), US': 40,
      'PS4, US': 10,
      'SUM(na_sales), SUM(na_sales), US': 1,
      'SUM(na_sales), PS4, US': 1,
    },
  ];
  const twoDimLabelMap = {
    genre: ['genre'],
    'SUM(na_sales), US': ['SUM(na_sales)', 'US'],
    'PS4, US': ['PS4', 'US'],
    'SUM(na_sales), SUM(na_sales), US': [
      'SUM(na_sales)',
      'SUM(na_sales)',
      'US',
    ],
    'SUM(na_sales), PS4, US': ['SUM(na_sales)', 'PS4', 'US'],
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
      groupby: ['platform', 'region'],
      timeseries_limit_metric: naSales,
      truncate_metric: true,
      stack: true,
      showValue: true,
      onlyTotal: true,
      x_axis_sort: 'SUM(na_sales)',
      xAxisSort: 'SUM(na_sales)',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: twoDimRows,
        label_map: twoDimLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];

  // The two displayed (2-part) series render and keep their values; the
  // 3-part sort-only columns are not among them.
  expect(series.map(({ name }) => name).sort()).toEqual([
    'PS4, US',
    'SUM(na_sales), US',
  ]);
  // SUM(na_sales) totals (3-part sort-only columns): Puzzle 30, Action 8,
  // Sports 2.
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual([
      'Puzzle',
      'Action',
      'Sports',
    ]);
  });
  // Stacked totals use only the displayed (2-part) series: Action 50,
  // Puzzle 10, Sports 50, read off in the sorted order above.
  const stackedTotals = series
    .flatMap((entry, seriesIndex) =>
      entry.data.map((value, dataIndex) =>
        entry.label.formatter({ value, dataIndex, seriesIndex }),
      ),
    )
    .filter(label => label !== '');
  expect(stackedTotals).toEqual(['10', '50', '50']);
});

test('rolls up a MAX sort metric by MAX rather than summing per-dimension maxima', () => {
  // The ungrouped MAX of a metric equals the MAX of its per-dimension
  // maxima, not their sum. Category A has per-platform maxima 100 and 0
  // (overall max 100); category B has 60 and 60 (overall max 60). Without
  // a dimension, A sorts first (100 > 60); summing the pivoted columns
  // instead of taking their max would reverse that (100 vs 120).
  const maxMetric: QueryFormMetric = {
    expressionType: 'SIMPLE',
    aggregate: 'MAX',
    column: { column_name: 'na_sales' },
    label: 'MAX(na_sales)',
  };
  const maxRows: DataRecord[] = [
    {
      genre: 'A',
      PS4: 10,
      XOne: 10,
      'MAX(na_sales), PS4': 100,
      'MAX(na_sales), XOne': 0,
    },
    {
      genre: 'B',
      PS4: 10,
      XOne: 10,
      'MAX(na_sales), PS4': 60,
      'MAX(na_sales), XOne': 60,
    },
  ];
  const maxLabelMap = {
    genre: ['genre'],
    PS4: ['PS4'],
    XOne: ['XOne'],
    'MAX(na_sales), PS4': ['MAX(na_sales)', 'PS4'],
    'MAX(na_sales), XOne': ['MAX(na_sales)', 'XOne'],
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
      timeseries_limit_metric: maxMetric,
      truncate_metric: true,
      x_axis_sort: 'MAX(na_sales)',
      xAxisSort: 'MAX(na_sales)',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: maxRows,
        label_map: maxLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual(['A', 'B']);
  });
});

test('rolls up a MIN sort metric by MIN rather than summing per-dimension minima', () => {
  // The ungrouped MIN of a metric equals the MIN of its per-dimension
  // minima, not their sum. Category A has per-platform minima 0 and 100
  // (overall min 0); category B has 40 and 40 (overall min 40). Ascending,
  // A sorts first (0 < 40); summing the pivoted columns instead would
  // reverse that (100 vs 80).
  const minMetric: QueryFormMetric = {
    expressionType: 'SIMPLE',
    aggregate: 'MIN',
    column: { column_name: 'na_sales' },
    label: 'MIN(na_sales)',
  };
  const minRows: DataRecord[] = [
    {
      genre: 'A',
      PS4: 10,
      XOne: 10,
      'MIN(na_sales), PS4': 0,
      'MIN(na_sales), XOne': 100,
    },
    {
      genre: 'B',
      PS4: 10,
      XOne: 10,
      'MIN(na_sales), PS4': 40,
      'MIN(na_sales), XOne': 40,
    },
  ];
  const minLabelMap = {
    genre: ['genre'],
    PS4: ['PS4'],
    XOne: ['XOne'],
    'MIN(na_sales), PS4': ['MIN(na_sales)', 'PS4'],
    'MIN(na_sales), XOne': ['MIN(na_sales)', 'XOne'],
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
      timeseries_limit_metric: minMetric,
      truncate_metric: true,
      x_axis_sort: 'MIN(na_sales)',
      xAxisSort: 'MIN(na_sales)',
      x_axis_sort_asc: true,
      xAxisSortAsc: true,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: minRows,
        label_map: minLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual(['A', 'B']);
  });
});

test('excludes forecast-derived columns from a sort-only metric sum', () => {
  // `label_map` is built from the cached DataFrame's final columns, after
  // Prophet has run, so a forecast's `<metric>, <dim>__yhat` column has the
  // same shape as one of the sort-only metric's own pivoted columns. If it
  // were summed in, the axis order would depend on the forecast trend
  // rather than the selected metric.
  const forecastRows: DataRecord[] = [
    {
      genre: 'Action',
      US: 30,
      EU: 20,
      'SUM(na_sales), US': 5,
      'SUM(na_sales), EU': 3,
      'SUM(na_sales), US__yhat': 1000,
    },
    {
      genre: 'Puzzle',
      US: 5,
      EU: 5,
      'SUM(na_sales), US': 20,
      'SUM(na_sales), EU': 10,
      'SUM(na_sales), US__yhat': 1,
    },
    {
      genre: 'Sports',
      US: 40,
      EU: 10,
      'SUM(na_sales), US': 1,
      'SUM(na_sales), EU': 1,
      'SUM(na_sales), US__yhat': 2000,
    },
  ];
  const forecastLabelMap = {
    genre: ['genre'],
    US: ['US'],
    EU: ['EU'],
    'SUM(na_sales), US': ['SUM(na_sales)', 'US'],
    'SUM(na_sales), EU': ['SUM(na_sales)', 'EU'],
    'SUM(na_sales), US__yhat': ['SUM(na_sales)', 'US__yhat'],
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
      groupby: ['region'],
      timeseries_limit_metric: naSales,
      truncate_metric: true,
      x_axis_sort: 'SUM(na_sales)',
      xAxisSort: 'SUM(na_sales)',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: forecastRows,
        label_map: forecastLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];
  // The sort-only metric's forecast column stays hidden: it is neither
  // rendered as a series nor counted in the stacked totals.
  expect(series.map(({ name }) => name)).not.toContain(
    'SUM(na_sales), US__yhat',
  );
  // SUM(na_sales) totals excluding the forecast column: Puzzle 30, Action
  // 8, Sports 2. Including the forecast column would instead put Sports
  // first (2000 + 2 = 2002).
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual([
      'Puzzle',
      'Action',
      'Sports',
    ]);
  });
});

test('sorts by a displayed metric that a Difference comparison replaced with its offset column', () => {
  // With two displayed metrics, no dimensions, and a Difference comparison,
  // `compare` drops each metric's own base column and `renameOperator`
  // renames its offset variant to `<metric>, <offset>` (metrics.length > 1).
  // Selecting one of those metrics as the sort target has to resolve to
  // that renamed column instead of leaving the axis in query order.
  const comparisonRows: DataRecord[] = [
    { genre: 'X', 'A, 1 week ago': 5, 'B, 1 week ago': 1 },
    { genre: 'Y', 'A, 1 week ago': 10, 'B, 1 week ago': 2 },
  ];
  const comparisonLabelMap = {
    genre: ['genre'],
    'A, 1 week ago': ['A', '1 week ago'],
    'B, 1 week ago': ['B', '1 week ago'],
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
      metrics: ['A', 'B'],
      groupby: [],
      comparison_type: 'difference',
      comparisonType: 'difference',
      time_compare: ['1 week ago'],
      timeCompare: ['1 week ago'],
      x_axis_sort: 'A',
      xAxisSort: 'A',
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
  // A's difference values are 5 (X) then 10 (Y); sorted descending by A
  // puts Y first, which query order (X, Y) does not.
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual(['Y', 'X']);
  });
});

test('sorts the x-axis column case-sensitively, not by series name', () => {
  const caseRows: DataRecord[] = [
    {
      genre: 'a',
      PS4: 1,
      XOne: 1,
      'SUM(na_sales), PS4': 1,
      'SUM(na_sales), XOne': 1,
    },
    {
      genre: 'B',
      PS4: 1,
      XOne: 1,
      'SUM(na_sales), PS4': 1,
      'SUM(na_sales), XOne': 1,
    },
  ];
  const { axisOrder } = transform(
    {
      x_axis_sort: 'genre',
      xAxisSort: 'genre',
      x_axis_sort_asc: true,
      xAxisSortAsc: true,
    },
    {},
    caseRows,
  );
  expect(axisOrder).toEqual(['B', 'a']);
});

test('excludes forecast columns from the truncated-metric sort fallback', () => {
  // With one displayed metric and `truncate_metric`, the metric's pivoted
  // columns carry no metric prefix, so the sort falls back to summing every
  // series column. Forecast trend columns must stay out of that sum.
  const forecastRows: DataRecord[] = [
    { genre: 'Action', US: 20, US__yhat: 1 },
    { genre: 'Puzzle', US: 10, US__yhat: 100 },
  ];
  const sortBy = (ascending: boolean) =>
    transform(
      {
        x_axis_sort: 'count',
        xAxisSort: 'count',
        x_axis_sort_asc: ascending,
        xAxisSortAsc: ascending,
        timeseries_limit_metric: undefined,
        forecastEnabled: true,
      },
      {},
      forecastRows,
    ).axisOrder;
  // Observed values alone: Action 20, Puzzle 10. Including the forecast
  // column would rank Puzzle (110) above Action (21) when descending.
  expect(sortBy(false)).toEqual(['Action', 'Puzzle']);
  expect(sortBy(true)).toEqual(['Puzzle', 'Action']);
});

test('keeps a NULL x-axis value last when sorting by the x-axis column', () => {
  const nullRows: DataRecord[] = [
    { genre: 'A', PS4: 1, XOne: 1 },
    { genre: null, PS4: 2, XOne: 2 },
    { genre: 'B', PS4: 3, XOne: 3 },
  ];
  const sortBy = (ascending: boolean) =>
    transform(
      {
        x_axis_sort: 'genre',
        xAxisSort: 'genre',
        x_axis_sort_asc: ascending,
        xAxisSortAsc: ascending,
        timeseries_limit_metric: undefined,
      },
      {},
      nullRows,
    ).axisOrder;
  expect(sortBy(true)).toEqual(['A', 'B', '<NULL>']);
  expect(sortBy(false)).toEqual(['B', 'A', '<NULL>']);
});

test('keeps a displayed series visible when its dimension value reads like the sort-only metric', () => {
  // One dimension with `truncate_metric`: the displayed column for the
  // dimension value `SUM(na_sales)` is a bare 1-part tuple, while the
  // sort-only metric's own columns carry the metric prefix. Matching on the
  // bare label alone would hide the displayed series and fold it into the
  // sort key.
  const collisionRows: DataRecord[] = [
    {
      genre: 'X',
      'SUM(na_sales)': 100,
      Y: 1,
      'SUM(na_sales), SUM(na_sales)': 1,
      'SUM(na_sales), Y': 0,
    },
    {
      genre: 'Z',
      'SUM(na_sales)': 1,
      Y: 1,
      'SUM(na_sales), SUM(na_sales)': 10,
      'SUM(na_sales), Y': 0,
    },
  ];
  const collisionLabelMap = {
    genre: ['genre'],
    'SUM(na_sales)': ['SUM(na_sales)'],
    Y: ['Y'],
    'SUM(na_sales), SUM(na_sales)': ['SUM(na_sales)', 'SUM(na_sales)'],
    'SUM(na_sales), Y': ['SUM(na_sales)', 'Y'],
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
      x_axis_sort: 'SUM(na_sales)',
      xAxisSort: 'SUM(na_sales)',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: collisionRows,
        label_map: collisionLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];
  expect(series.map(({ name }) => name).sort()).toEqual(['SUM(na_sales)', 'Y']);
  // Hidden totals: Z 10, X 1. The displayed `SUM(na_sales)` column (X 100)
  // must not leak into the sort key.
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual(['Z', 'X']);
  });
});

test('keeps a hidden sort metric labeled like a comparison series hidden', () => {
  // A sort-only metric whose own label is `sales, 1 year ago` is a bare
  // column, not a derived comparison series of `sales`, and it stays hidden.
  const salesMetric: QueryFormMetric = {
    expressionType: 'SQL',
    sqlExpression: 'SUM(sales)',
    label: 'sales, 1 year ago',
  };
  const compareRows: DataRecord[] = [
    { genre: 'A', count: 5, 'count, 1 year ago': 4, 'sales, 1 year ago': 1 },
    { genre: 'B', count: 6, 'count, 1 year ago': 5, 'sales, 1 year ago': 10 },
  ];
  const compareLabelMap = {
    genre: ['genre'],
    count: ['count'],
    'count, 1 year ago': ['count, 1 year ago'],
    'sales, 1 year ago': ['sales, 1 year ago'],
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
      groupby: [],
      timeseries_limit_metric: salesMetric,
      comparison_type: 'values',
      comparisonType: 'values',
      time_compare: ['1 year ago'],
      timeCompare: ['1 year ago'],
      x_axis_sort: 'sales, 1 year ago',
      xAxisSort: 'sales, 1 year ago',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: compareRows,
        label_map: compareLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];
  expect(series.map(({ name }) => name)).not.toContain('sales, 1 year ago');
});

test('sorts by a hidden metric labeled exactly like the comparison offset', () => {
  // The hidden sort metric is labeled `1 year ago`, so its label_map entry
  // leads with the offset. Because a sort-only metric means several metrics
  // are pivoted, that leading part is the metric, not a stripped offset, and
  // the column must stay hidden and drive the axis order.
  const offsetNamedMetric: QueryFormMetric = {
    expressionType: 'SQL',
    sqlExpression: 'SUM(sales)',
    label: '1 year ago',
  };
  const compareRows: DataRecord[] = [
    {
      genre: 'A',
      'count, East': 5,
      'count, 1 year ago, East': 4,
      '1 year ago, East': 1,
    },
    {
      genre: 'B',
      'count, East': 6,
      'count, 1 year ago, East': 5,
      '1 year ago, East': 10,
    },
  ];
  const compareLabelMap = {
    genre: ['genre'],
    'count, East': ['count', 'East'],
    'count, 1 year ago, East': ['count, 1 year ago', 'East'],
    '1 year ago, East': ['1 year ago', 'East'],
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
      timeseries_limit_metric: offsetNamedMetric,
      comparison_type: 'values',
      comparisonType: 'values',
      time_compare: ['1 year ago'],
      timeCompare: ['1 year ago'],
      x_axis_sort: '1 year ago',
      xAxisSort: '1 year ago',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: compareRows,
        label_map: compareLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];
  expect(series.map(({ name }) => name).sort()).toEqual([
    'count, 1 year ago, East',
    'count, East',
  ]);
  // hidden totals: B 10, A 1
  expect(series[0].data.map(([genre]) => genre)).toEqual(['B', 'A']);
});

test('keeps a displayed series visible when a verbose name reads like its dimension tuple', () => {
  // The hidden saved metric `sales` has the verbose name `PS4, US`, which is
  // also the flat name of a displayed two-dimension series. The collision
  // guard must look the metric up by its verbose name so that displayed
  // series stays visible while the axis still orders by the hidden totals.
  const salesMetric: QueryFormMetric = {
    expressionType: 'SQL',
    sqlExpression: 'SUM(sales)',
    label: 'sales',
  };
  const twoDimRows: DataRecord[] = [
    {
      genre: 'A',
      'PS4, US': 30,
      'sales, PS4, US': 1,
    },
    {
      genre: 'B',
      'PS4, US': 5,
      'sales, PS4, US': 10,
    },
  ];
  const twoDimLabelMap = {
    genre: ['genre'],
    'PS4, US': ['PS4', 'US'],
    'sales, PS4, US': ['sales', 'PS4', 'US'],
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
      groupby: ['platform', 'region'],
      timeseries_limit_metric: salesMetric,
      truncate_metric: true,
      x_axis_sort: 'sales',
      xAxisSort: 'sales',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: twoDimRows,
        label_map: twoDimLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
    datasource: { verboseMap: { sales: 'PS4, US' } },
  });
  const series = transformProps(chartProps).echartOptions.series as Series[];
  expect(series.map(({ name }) => name)).toEqual(['PS4, US']);
  // hidden totals: B 10, A 1
  expect(series[0].data.map(([genre]) => genre)).toEqual(['B', 'A']);
});

test('stacks per region with one displayed metric, a hidden sort metric and a comparison', () => {
  // The comparison tuples keep the metric-offset prefix
  // (`['count, 1 year ago', region]`) while the displayed column is
  // truncated to `[region]`, so the dimension index cannot be derived from
  // the metric count.
  const stackRows: DataRecord[] = [
    {
      genre: 'A',
      East: 5,
      West: 7,
      'count, 1 year ago, East': 4,
      'count, 1 year ago, West': 6,
      'SUM(na_sales), East': 1,
      'SUM(na_sales), West': 1,
    },
    {
      genre: 'B',
      East: 6,
      West: 8,
      'count, 1 year ago, East': 5,
      'count, 1 year ago, West': 7,
      'SUM(na_sales), East': 10,
      'SUM(na_sales), West': 10,
    },
  ];
  const stackLabelMap = {
    genre: ['genre'],
    East: ['East'],
    West: ['West'],
    'count, 1 year ago, East': ['count, 1 year ago', 'East'],
    'count, 1 year ago, West': ['count, 1 year ago', 'West'],
    'SUM(na_sales), East': ['SUM(na_sales)', 'East'],
    'SUM(na_sales), West': ['SUM(na_sales)', 'West'],
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
      groupby: ['region'],
      timeseries_limit_metric: naSales,
      truncate_metric: true,
      comparison_type: 'values',
      comparisonType: 'values',
      time_compare: ['1 year ago'],
      timeCompare: ['1 year ago'],
      stack: StackControlsValue.Stack,
      stackDimension: 'region',
      x_axis_sort: 'SUM(na_sales)',
      xAxisSort: 'SUM(na_sales)',
      x_axis_sort_asc: false,
      xAxisSortAsc: false,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: stackRows,
        label_map: stackLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as (Series & {
    stack?: string;
  })[];
  const stackIds = Object.fromEntries(
    series.map(({ name, stack }) => [name, stack]),
  );
  expect(stackIds).toEqual({
    East: 'East',
    West: 'West',
    'count, 1 year ago, East': 'East',
    'count, 1 year ago, West': 'West',
  });
  series.forEach(entry => {
    expect(entry.data.map(([genre]) => genre)).toEqual(['B', 'A']);
  });
});

test('skips per-dimension stacking when the stack dimension is no longer grouped', () => {
  const staleRows: DataRecord[] = [
    { genre: 'A', 'sales, East': 10, 'profit, East': 20 },
  ];
  const staleLabelMap = {
    genre: ['genre'],
    'sales, East': ['sales', 'East'],
    'profit, East': ['profit', 'East'],
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
      metrics: ['sales', 'profit'],
      groupby: ['region'],
      stack: StackControlsValue.Stack,
      stackDimension: 'dept',
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      {
        ...queriesData[0],
        data: staleRows,
        label_map: staleLabelMap,
      } as unknown as ChartDataResponseResult,
    ],
  });
  const series = transformProps(chartProps).echartOptions.series as (Series & {
    stack?: string;
  })[];
  expect(series.length).toBe(2);
  expect(new Set(series.map(({ stack }) => stack)).size).toBe(1);
});
