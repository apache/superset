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
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
  ComparisonType,
  DataRecord,
  EventAnnotationLayer,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  SqlaFormData,
  TimeseriesAnnotationLayer,
  ChartDataResponseResult,
} from '@superset-ui/core';
import { EchartsTimeseriesChartProps } from '../../src/types';
import type { SeriesOption } from 'echarts';
import transformProps from '../../src/Timeseries/transformProps';
import {
  EchartsTimeseriesSeriesType,
  OrientationType,
  EchartsTimeseriesFormData,
} from '../../src/Timeseries/types';
import { StackControlsValue } from '../../src/constants';
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';
import { createEchartsTimeseriesTestChartProps } from '../helpers';
import { BASE_TIMESTAMP, createTestData } from './helpers';

/**
 * Creates a partial ChartDataResponseResult for testing.
 * Only includes the fields needed for tests, with sensible defaults for required fields.
 */
function createTestQueryData(
  data: unknown[],
  overrides?: Partial<ChartDataResponseResult> & {
    label_map?: Record<string, string[]>;
  },
): ChartDataResponseResult {
  return {
    annotation_data: null,
    cache_key: null,
    cache_timeout: null,
    cached_dttm: null,
    queried_dttm: null,
    data: data as DataRecord[],
    colnames: [],
    coltypes: [],
    error: null,
    is_cached: false,
    query: '',
    rowcount: data.length,
    sql_rowcount: data.length,
    stacktrace: null,
    status: 'success',
    from_dttm: null,
    to_dttm: null,
    label_map: {},
    ...overrides,
  } as ChartDataResponseResult & { label_map?: Record<string, string[]> };
}

type YAxisFormatter = (value: number, index: number) => string;

function getYAxisFormatter(
  transformed: ReturnType<typeof transformProps>,
): YAxisFormatter {
  const yAxis = transformed.echartOptions.yAxis as {
    axisLabel?: { formatter?: YAxisFormatter };
  };
  expect(yAxis).toBeDefined();
  expect(yAxis.axisLabel).toBeDefined();
  expect(yAxis.axisLabel?.formatter).toBeDefined();
  return yAxis.axisLabel!.formatter!;
}

const queriesData: ChartDataResponseResult[] = [
  createTestQueryData(
    createTestData(
      [
        { 'San Francisco': 1, 'New York': 2 },
        { 'San Francisco': 3, 'New York': 4 },
      ],
      { intervalMs: 300000000 },
    ),
  ),
];

/**
 * Creates a properly typed EchartsTimeseriesChartProps for testing.
 * Uses shared createEchartsTimeseriesTestChartProps with Timeseries defaults.
 */
function createTestChartProps(config: {
  formData?: Partial<EchartsTimeseriesFormData>;
  queriesData?: ChartDataResponseResult[];
  annotationData?: Record<string, unknown>;
  datasource?: {
    verboseMap?: Record<string, string>;
    columnFormats?: Record<string, string>;
    currencyFormats?: Record<
      string,
      { symbol: string; symbolPosition: string }
    >;
    currencyCodeColumn?: string;
  };
  width?: number;
  height?: number;
}): EchartsTimeseriesChartProps {
  return createEchartsTimeseriesTestChartProps<
    EchartsTimeseriesFormData,
    EchartsTimeseriesChartProps
  >({
    defaultFormData: DEFAULT_FORM_DATA,
    defaultVizType: 'my_viz',
    defaultQueriesData: queriesData,
    ...config,
  });
}

const formData: SqlaFormData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: 'ds',
  metric: 'sum__num',
  groupby: ['foo', 'bar'],
  viz_type: 'my_viz',
};

describe('EchartsTimeseries transformProps', () => {
  test('should transform chart props for viz', () => {
    const chartProps = createTestChartProps({});
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['San Francisco', 'New York'],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                [BASE_TIMESTAMP, 1],
                [BASE_TIMESTAMP + 300000000, 3],
              ],
              name: 'San Francisco',
            }),
            expect.objectContaining({
              data: [
                [BASE_TIMESTAMP, 2],
                [BASE_TIMESTAMP + 300000000, 4],
              ],
              name: 'New York',
            }),
          ]),
        }),
      }),
    );
  });

  test('should transform chart props for horizontal viz', () => {
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        orientation: OrientationType.Horizontal,
      },
    });
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['San Francisco', 'New York'],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                [1, BASE_TIMESTAMP],
                [3, BASE_TIMESTAMP + 300000000],
              ],
              name: 'San Francisco',
            }),
            expect.objectContaining({
              data: [
                [2, BASE_TIMESTAMP],
                [4, BASE_TIMESTAMP + 300000000],
              ],
              name: 'New York',
            }),
          ]),
        }),
      }),
    );
  });

  test('should add a formula annotation to viz', () => {
    const formula: FormulaAnnotationLayer = {
      name: 'My Formula',
      annotationType: AnnotationType.Formula,
      value: 'x+1',
      style: AnnotationStyle.Solid,
      show: true,
      showLabel: true,
    };
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        annotationLayers: [formula],
      },
    });
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['San Francisco', 'New York', 'My Formula'],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                [BASE_TIMESTAMP, 1],
                [BASE_TIMESTAMP + 300000000, 3],
              ],
              name: 'San Francisco',
            }),
            expect.objectContaining({
              data: [
                [BASE_TIMESTAMP, 2],
                [BASE_TIMESTAMP + 300000000, 4],
              ],
              name: 'New York',
            }),
            expect.objectContaining({
              data: [
                [BASE_TIMESTAMP, BASE_TIMESTAMP + 1],
                [BASE_TIMESTAMP + 300000000, BASE_TIMESTAMP + 300000000 + 1],
              ],
              name: 'My Formula',
            }),
          ]),
        }),
      }),
    );
  });

  test('should add a formula annotation when X-axis column has dataset-level label', () => {
    const formula: FormulaAnnotationLayer = {
      name: 'My Formula',
      annotationType: AnnotationType.Formula,
      value: 'x*2',
      style: AnnotationStyle.Solid,
      show: true,
      showLabel: true,
    };
    const timeColumnName = 'ds';
    const timeColumnLabel = 'Time Label';
    const testData = [
      {
        [timeColumnLabel]: new Date(BASE_TIMESTAMP).toISOString(),
        'San Francisco': 1,
        'New York': 2,
      },
      {
        [timeColumnLabel]: new Date(BASE_TIMESTAMP + 300000000).toISOString(),
        'San Francisco': 3,
        'New York': 4,
      },
    ];
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        x_axis: timeColumnName,
        granularity_sqla: timeColumnName,
        annotationLayers: [formula],
      },
      queriesData: [createTestQueryData(testData)],
      datasource: {
        verboseMap: {
          [timeColumnName]: timeColumnLabel,
        },
        columnFormats: {},
        currencyFormats: {},
      },
    });
    const result = transformProps(chartProps);
    const formulaSeries = (
      result.echartOptions.series as SeriesOption[] | undefined
    )?.find((s: SeriesOption) => s.name === 'My Formula');
    expect(formulaSeries).toBeDefined();
    expect(formulaSeries?.data).toBeDefined();
    expect(Array.isArray(formulaSeries?.data)).toBe(true);
    expect((formulaSeries?.data as unknown[])?.length).toBeGreaterThan(0);
    const firstDataPoint = (formulaSeries?.data as [number, number][])?.[0];
    expect(firstDataPoint).toBeDefined();
    expect(firstDataPoint[1]).toBe(firstDataPoint[0] * 2);
  });

  test('should add a formula annotation when X-axis column has dataset-level label and verboseMap is empty (backward compatibility)', () => {
    const formula: FormulaAnnotationLayer = {
      name: 'My Formula',
      annotationType: AnnotationType.Formula,
      value: 'x+1',
      style: AnnotationStyle.Solid,
      show: true,
      showLabel: true,
    };
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        annotationLayers: [formula],
      },
      datasource: {
        verboseMap: {},
        columnFormats: {},
        currencyFormats: {},
      },
    });
    const result = transformProps(chartProps);
    const formulaSeries = (
      result.echartOptions.series as SeriesOption[] | undefined
    )?.find((s: SeriesOption) => s.name === 'My Formula');
    expect(formulaSeries).toBeDefined();
    expect(formulaSeries?.data).toBeDefined();
    expect(Array.isArray(formulaSeries?.data)).toBe(true);
  });

  test('should add a formula annotation when X-axis column has dataset-level label in horizontal orientation', () => {
    const formula: FormulaAnnotationLayer = {
      name: 'My Formula',
      annotationType: AnnotationType.Formula,
      value: 'x*2',
      style: AnnotationStyle.Solid,
      show: true,
      showLabel: true,
    };
    const timeColumnName = 'ds';
    const timeColumnLabel = 'Time Label';
    const testData = [
      {
        [timeColumnLabel]: new Date(BASE_TIMESTAMP).toISOString(),
        'San Francisco': 1,
        'New York': 2,
      },
      {
        [timeColumnLabel]: new Date(BASE_TIMESTAMP + 300000000).toISOString(),
        'San Francisco': 3,
        'New York': 4,
      },
    ];
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        x_axis: timeColumnName,
        granularity_sqla: timeColumnName,
        orientation: OrientationType.Horizontal,
        annotationLayers: [formula],
      },
      queriesData: [createTestQueryData(testData)],
      datasource: {
        verboseMap: {
          [timeColumnName]: timeColumnLabel,
        },
        columnFormats: {},
        currencyFormats: {},
      },
    });
    const result = transformProps(chartProps);
    const formulaSeries = (
      result.echartOptions.series as SeriesOption[] | undefined
    )?.find((s: SeriesOption) => s.name === 'My Formula');
    expect(formulaSeries).toBeDefined();
    const firstDataPoint = (formulaSeries?.data as [number, number][])?.[0];
    expect(firstDataPoint).toBeDefined();
    expect(firstDataPoint[0]).toBe(firstDataPoint[1] * 2);
  });

  test('should add an interval, event and timeseries annotation to viz', () => {
    const event: EventAnnotationLayer = {
      annotationType: AnnotationType.Event,
      name: 'My Event',
      show: true,
      showLabel: true,
      sourceType: AnnotationSourceType.Native,
      style: AnnotationStyle.Solid,
      value: 1,
    };

    const interval: IntervalAnnotationLayer = {
      annotationType: AnnotationType.Interval,
      name: 'My Interval',
      show: true,
      showLabel: true,
      sourceType: AnnotationSourceType.Table,
      titleColumn: '',
      timeColumn: 'start',
      intervalEndColumn: '',
      descriptionColumns: [],
      style: AnnotationStyle.Dashed,
      value: 2,
    };

    const timeseries: TimeseriesAnnotationLayer = {
      annotationType: AnnotationType.Timeseries,
      name: 'My Timeseries',
      show: true,
      showLabel: true,
      sourceType: AnnotationSourceType.Line,
      style: AnnotationStyle.Solid,
      titleColumn: '',
      value: 3,
    };
    const annotationData = {
      'My Event': {
        columns: [
          'start_dttm',
          'end_dttm',
          'short_descr',
          'long_descr',
          'json_metadata',
        ],
        records: [
          {
            start_dttm: 0,
            end_dttm: 1000,
            short_descr: '',
            long_descr: '',
            json_metadata: null,
          },
        ],
      },
      'My Interval': {
        columns: ['start', 'end', 'title'],
        records: [
          {
            start: 2000,
            end: 3000,
            title: 'My Title',
          },
        ],
      },
      'My Timeseries': {
        records: [
          { x: 10000, y: 11000 },
          { x: 20000, y: 21000 },
        ],
      },
    };
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        annotationLayers: [event, interval, timeseries],
      },
      annotationData,
      queriesData: [
        {
          ...(queriesData[0] as ChartDataResponseResult),
          annotation_data: annotationData,
        },
      ],
    });
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        echartOptions: expect.objectContaining({
          legend: expect.objectContaining({
            data: ['San Francisco', 'New York', 'My Timeseries'],
          }),
          series: expect.arrayContaining([
            expect.objectContaining({
              type: 'line',
              id: 'My Timeseries',
            }),
            expect.objectContaining({
              type: 'line',
              id: 'Event - My Event',
            }),
            expect.objectContaining({
              type: 'line',
              id: 'Interval - My Interval',
            }),
          ]),
        }),
      }),
    );
  });

  test('Should add a baseline series for stream graph', () => {
    const streamQueriesDataTyped: ChartDataResponseResult[] = [
      createTestQueryData(
        createTestData(
          [
            {
              'San Francisco': 120,
              'New York': 220,
              Boston: 150,
              Miami: 270,
              Denver: 800,
            },
            {
              'San Francisco': 150,
              'New York': 190,
              Boston: 240,
              Miami: 350,
              Denver: 700,
            },
            {
              'San Francisco': 130,
              'New York': 300,
              Boston: 250,
              Miami: 410,
              Denver: 650,
            },
            {
              'San Francisco': 90,
              'New York': 340,
              Boston: 300,
              Miami: 480,
              Denver: 590,
            },
            {
              'San Francisco': 260,
              'New York': 200,
              Boston: 420,
              Miami: 490,
              Denver: 760,
            },
            {
              'San Francisco': 250,
              'New York': 250,
              Boston: 380,
              Miami: 360,
              Denver: 400,
            },
            {
              'San Francisco': 160,
              'New York': 210,
              Boston: 330,
              Miami: 440,
              Denver: 580,
            },
          ],
          { intervalMs: 1 },
        ),
      ),
    ];
    const streamFormData: Partial<EchartsTimeseriesFormData> = {
      ...formData,
      stack: StackControlsValue.Stream,
    };
    const chartProps = createTestChartProps({
      formData: streamFormData,
      queriesData: streamQueriesDataTyped,
    });
    expect(
      (transformProps(chartProps).echartOptions.series as any[])[0],
    ).toEqual({
      areaStyle: {
        opacity: 0,
      },
      lineStyle: {
        opacity: 0,
      },
      name: 'baseline',
      showSymbol: false,
      silent: true,
      smooth: false,
      stack: 'obs',
      stackStrategy: 'all',
      step: undefined,
      tooltip: {
        show: false,
      },
      type: 'line',
      data: [
        [BASE_TIMESTAMP, -415.7692307692308],
        [BASE_TIMESTAMP + 1, -403.6219915054271],
        [BASE_TIMESTAMP + 2, -476.32314093071443],
        [BASE_TIMESTAMP + 3, -514.2120298196033],
        [BASE_TIMESTAMP + 4, -485.7378514158475],
        [BASE_TIMESTAMP + 5, -419.6402904402378],
        [BASE_TIMESTAMP + 6, -442.9833136960517],
      ],
    });
  });
});

describe('Does transformProps transform series correctly', () => {
  type seriesDataType = [Date, number];
  type labelFormatterType = (params: {
    value: seriesDataType;
    dataIndex: number;
    seriesIndex: number;
  }) => string;
  type seriesType = {
    label: { show: boolean; formatter: labelFormatterType };
    data: seriesDataType[];
    name: string;
  };

  const formData: SqlaFormData = {
    viz_type: 'my_viz',
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['foo', 'bar'],
    showValue: true,
    stack: true,
    onlyTotal: false,
    percentageThreshold: 50,
  };
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [
          {
            'San Francisco': 1,
            'New York': 2,
            Boston: 1,
          },
          {
            'San Francisco': 3,
            'New York': 4,
            Boston: 1,
          },
          {
            'San Francisco': 5,
            'New York': 8,
            Boston: 6,
          },
          {
            'San Francisco': 2,
            'New York': 7,
            Boston: 2,
          },
        ],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const totalStackedValues = queriesData[0].data.reduce(
    (totals, currentStack) => {
      const total = Object.keys(currentStack).reduce((stackSum, key) => {
        if (key === '__timestamp') return stackSum;
        const val = currentStack[key as keyof typeof currentStack];
        return stackSum + (typeof val === 'number' ? val : 0);
      }, 0);
      totals.push(total);
      return totals;
    },
    [] as number[],
  );

  test('should show labels when showValue is true', () => {
    const chartProps = createTestChartProps({ formData, queriesData });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as seriesType[];

    transformedSeries.forEach(series => {
      expect(series.label.show).toBe(true);
    });
  });

  test('should not show labels when showValue is false', () => {
    const chartProps = createTestChartProps({
      formData: { ...formData, showValue: false },
      queriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as seriesType[];

    transformedSeries.forEach(series => {
      expect(series.label.show).toBe(false);
    });
  });

  test('should show only totals when onlyTotal is true', () => {
    const chartProps = createTestChartProps({
      formData: { ...formData, onlyTotal: true },
      queriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as seriesType[];

    const showValueIndexes: number[] = [];

    transformedSeries.forEach((entry, seriesIndex) => {
      const { data = [] } = entry;
      (data as [Date, number][]).forEach((datum, dataIndex) => {
        if (datum[1] !== null) {
          showValueIndexes[dataIndex] = seriesIndex;
        }
      });
    });

    transformedSeries.forEach((series, seriesIndex) => {
      expect(series.label.show).toBe(true);
      series.data.forEach((value, dataIndex) => {
        const params = {
          value,
          dataIndex,
          seriesIndex,
        };

        let expectedLabel: string;

        if (seriesIndex === showValueIndexes[dataIndex]) {
          expectedLabel = String(totalStackedValues[dataIndex]);
        } else {
          expectedLabel = '';
        }

        expect(series.label.formatter(params)).toBe(expectedLabel);
      });
    });
  });

  test('should show labels on values >= percentageThreshold if onlyTotal is false', () => {
    const chartProps = createTestChartProps({ formData, queriesData });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as seriesType[];

    const expectedThresholds = totalStackedValues.map(
      total => ((formData.percentageThreshold || 0) / 100) * total,
    );

    transformedSeries.forEach((series, seriesIndex) => {
      expect(series.label.show).toBe(true);
      series.data.forEach((value, dataIndex) => {
        const params = {
          value,
          dataIndex,
          seriesIndex,
        };
        const expectedLabel =
          value[1] >= expectedThresholds[dataIndex] ? String(value[1]) : '';
        expect(series.label.formatter(params)).toBe(expectedLabel);
      });
    });
  });

  test('should not apply percentage threshold when showValue is true and stack is false', () => {
    const chartProps = createTestChartProps({
      formData: { ...formData, stack: false },
      queriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as seriesType[];

    transformedSeries.forEach((series, seriesIndex) => {
      expect(series.label.show).toBe(true);
      series.data.forEach((value, dataIndex) => {
        const params = {
          value,
          dataIndex,
          seriesIndex,
        };
        const expectedLabel = String(value[1]);
        expect(series.label.formatter(params)).toBe(expectedLabel);
      });
    });
  });

  test('should remove time shift labels from label_map', () => {
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        timeCompare: ['1 year ago'],
      },
      queriesData: [
        createTestQueryData(queriesData[0].data as DataRecord[], {
          label_map: {
            '1 year ago, foo1, bar1': ['1 year ago', 'foo1', 'bar1'],
            '1 year ago, foo2, bar2': ['1 year ago', 'foo2', 'bar2'],
            'foo1, bar1': ['foo1', 'bar1'],
            'foo2, bar2': ['foo2', 'bar2'],
          },
        }),
      ],
    });
    const transformedProps = transformProps(chartProps);
    expect(transformedProps.labelMap).toEqual({
      '1 year ago, foo1, bar1': ['foo1', 'bar1'],
      '1 year ago, foo2, bar2': ['foo2', 'bar2'],
      'foo1, bar1': ['foo1', 'bar1'],
      'foo2, bar2': ['foo2', 'bar2'],
    });
  });
});

describe('legend sorting', () => {
  const legendSortData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [
          {
            Milton: 40,
            'San Francisco': 1,
            'New York': 2,
            Boston: 1,
          },
          {
            Milton: 20,
            'San Francisco': 3,
            'New York': 4,
            Boston: 1,
          },
          {
            Milton: 60,
            'San Francisco': 5,
            'New York': 8,
            Boston: 6,
          },
          {
            Milton: 10,
            'San Francisco': 2,
            'New York': 7,
            Boston: 2,
          },
        ],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const getChartProps = (formDataOverrides: Partial<SqlaFormData>) =>
    createTestChartProps({
      formData: { ...formData, ...formDataOverrides },
      queriesData: legendSortData,
    });

  test('sort legend by data', () => {
    const chartProps = getChartProps({
      legendSort: null,
      sortSeriesType: 'min',
      sortSeriesAscending: true,
    });
    const transformed = transformProps(chartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'Boston',
      'San Francisco',
      'New York',
      'Milton',
    ]);
  });

  test('sort legend by label ascending', () => {
    const chartProps = getChartProps({
      legendSort: 'asc',
      sortSeriesType: 'min',
      sortSeriesAscending: true,
    });
    const transformed = transformProps(chartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'Boston',
      'Milton',
      'New York',
      'San Francisco',
    ]);
  });

  test('sort legend by label descending', () => {
    const chartProps = getChartProps({
      legendSort: 'desc',
      sortSeriesType: 'min',
      sortSeriesAscending: true,
    });
    const transformed = transformProps(chartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'San Francisco',
      'New York',
      'Milton',
      'Boston',
    ]);
  });
});

const timeCompareFormData: SqlaFormData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: 'ds',
  metric: 'sum__num',
  viz_type: 'my_viz',
};

test('should apply dashed line style to time comparison series with single metric', () => {
  const queriesDataWithTimeCompare = [
    createTestQueryData([
      { sum__num: 100, '1 week ago': 80, __timestamp: 599616000000 },
      { sum__num: 150, '1 week ago': 120, __timestamp: 599916000000 },
    ]),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...timeCompareFormData,
      time_compare: ['1 week ago'],
      comparison_type: ComparisonType.Values,
    },
    queriesData: queriesDataWithTimeCompare,
  });

  const transformed = transformProps(chartProps);
  const series = (transformed.echartOptions.series as SeriesOption[]) || [];

  const mainSeries = series.find(s => s.name === 'sum__num') as
    | (SeriesOption & { lineStyle?: { type?: number[] | string } })
    | undefined;
  const comparisonSeries = series.find(s => s.name === '1 week ago') as
    | (SeriesOption & { lineStyle?: { type?: number[] | string } })
    | undefined;

  expect(mainSeries).toBeDefined();
  expect(comparisonSeries).toBeDefined();
  // Main series should not have a dash pattern array
  expect(Array.isArray(mainSeries?.lineStyle?.type)).toBe(false);
  // Comparison series should have a visible dash pattern array [dash, gap]
  expect(Array.isArray(comparisonSeries?.lineStyle?.type)).toBe(true);
  expect(
    Array.isArray(comparisonSeries?.lineStyle?.type)
      ? comparisonSeries.lineStyle.type[0]
      : undefined,
  ).toBeGreaterThanOrEqual(4);
  expect(
    Array.isArray(comparisonSeries?.lineStyle?.type)
      ? comparisonSeries.lineStyle.type[1]
      : undefined,
  ).toBeGreaterThanOrEqual(3);
});

test('should apply dashed line style to time comparison series with metric__offset pattern', () => {
  const queriesDataWithTimeCompare = [
    createTestQueryData([
      {
        sum__num: 100,
        'sum__num__1 week ago': 80,
        __timestamp: 599616000000,
      },
      {
        sum__num: 150,
        'sum__num__1 week ago': 120,
        __timestamp: 599916000000,
      },
    ]),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...timeCompareFormData,
      time_compare: ['1 week ago'],
      comparison_type: ComparisonType.Values,
    },
    queriesData: queriesDataWithTimeCompare,
  });

  const transformed = transformProps(chartProps);
  const series = (transformed.echartOptions.series as SeriesOption[]) || [];

  const mainSeries = series.find(s => s.name === 'sum__num') as
    | (SeriesOption & { lineStyle?: { type?: number[] | string } })
    | undefined;
  const comparisonSeries = series.find(
    s => s.name === 'sum__num__1 week ago',
  ) as
    | (SeriesOption & { lineStyle?: { type?: number[] | string } })
    | undefined;

  expect(mainSeries).toBeDefined();
  expect(comparisonSeries).toBeDefined();
  // Main series should not have a dash pattern array
  expect(Array.isArray(mainSeries?.lineStyle?.type)).toBe(false);
  // Comparison series should have a visible dash pattern array [dash, gap]
  expect(Array.isArray(comparisonSeries?.lineStyle?.type)).toBe(true);
  expect(
    Array.isArray(comparisonSeries?.lineStyle?.type)
      ? comparisonSeries.lineStyle.type[0]
      : undefined,
  ).toBeGreaterThanOrEqual(4);
  expect(
    Array.isArray(comparisonSeries?.lineStyle?.type)
      ? comparisonSeries.lineStyle.type[1]
      : undefined,
  ).toBeGreaterThanOrEqual(3);
});

test('should apply connectNulls to time comparison series', () => {
  const queriesDataWithNulls = [
    createTestQueryData([
      { sum__num: 100, '1 week ago': null, __timestamp: 599616000000 },
      { sum__num: 150, '1 week ago': 120, __timestamp: 599916000000 },
      { sum__num: 200, '1 week ago': null, __timestamp: 600216000000 },
    ]),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...timeCompareFormData,
      time_compare: ['1 week ago'],
      comparison_type: ComparisonType.Values,
    },
    queriesData: queriesDataWithNulls,
  });

  const transformed = transformProps(chartProps);
  const series = (transformed.echartOptions.series as SeriesOption[]) || [];

  const comparisonSeries = series.find(s => s.name === '1 week ago') as
    | (SeriesOption & { connectNulls?: boolean })
    | undefined;

  expect(comparisonSeries).toBeDefined();
  expect(comparisonSeries?.connectNulls).toBe(true);
});

test('should not apply dashed line style for non-Values comparison types', () => {
  const queriesDataWithTimeCompare = [
    createTestQueryData([
      { sum__num: 100, '1 week ago': 80, __timestamp: 599616000000 },
      { sum__num: 150, '1 week ago': 120, __timestamp: 599916000000 },
    ]),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...timeCompareFormData,
      time_compare: ['1 week ago'],
      comparison_type: ComparisonType.Difference,
    },
    queriesData: queriesDataWithTimeCompare,
  });

  const transformed = transformProps(chartProps);
  const series = (transformed.echartOptions.series as SeriesOption[]) || [];

  const comparisonSeries = series.find(s => s.name === '1 week ago') as
    | (SeriesOption & {
        lineStyle?: { type?: number[] | string };
        connectNulls?: boolean;
      })
    | undefined;

  expect(comparisonSeries).toBeDefined();
  // Non-Values comparison types don't get dashed styling (isDerivedSeries returns false)
  expect(Array.isArray(comparisonSeries?.lineStyle?.type)).toBe(false);
  expect(comparisonSeries?.connectNulls).toBeFalsy();
});

test('EchartsTimeseries AUTO mode should detect single currency and format with $ for USD', () => {
  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      metrics: ['sum__num'],
      currencyFormat: { symbol: 'AUTO', symbolPosition: 'prefix' },
    },
    datasource: {
      currencyCodeColumn: 'currency_code',
      columnFormats: {},
      currencyFormats: {},
      verboseMap: {},
    },
    queriesData: [
      createTestQueryData(
        [
          {
            'San Francisco': 1000,
            __timestamp: 599616000000,
            currency_code: 'USD',
          },
          {
            'San Francisco': 2000,
            __timestamp: 599916000000,
            currency_code: 'USD',
          },
        ],
        { detected_currency: 'USD' },
      ),
    ],
  });

  const transformed = transformProps(chartProps);

  const formatter = getYAxisFormatter(transformed);
  expect(formatter(1000, 0)).toContain('$');
});

test('EchartsTimeseries AUTO mode should use neutral formatting for mixed currencies', () => {
  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      metrics: ['sum__num'],
      currencyFormat: { symbol: 'AUTO', symbolPosition: 'prefix' },
    },
    datasource: {
      currencyCodeColumn: 'currency_code',
      columnFormats: {},
      currencyFormats: {},
      verboseMap: {},
    },
    queriesData: [
      createTestQueryData([
        {
          'San Francisco': 1000,
          __timestamp: 599616000000,
          currency_code: 'USD',
        },
        {
          'San Francisco': 2000,
          __timestamp: 599916000000,
          currency_code: 'EUR',
        },
      ]),
    ],
  });

  const transformed = transformProps(chartProps);

  // With mixed currencies, Y-axis should use neutral formatting
  const formatter = getYAxisFormatter(transformed);
  const formatted = formatter(1000, 0);
  expect(formatted).not.toContain('$');
  expect(formatted).not.toContain('€');
});

test('EchartsTimeseries should preserve static currency format with £ for GBP', () => {
  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      metrics: ['sum__num'],
      currencyFormat: { symbol: 'GBP', symbolPosition: 'prefix' },
    },
    datasource: {
      currencyCodeColumn: 'currency_code',
      columnFormats: {},
      currencyFormats: {},
      verboseMap: {},
    },
    queriesData: [
      createTestQueryData([
        {
          'San Francisco': 1000,
          __timestamp: 599616000000,
          currency_code: 'USD',
        },
        {
          'San Francisco': 2000,
          __timestamp: 599916000000,
          currency_code: 'EUR',
        },
      ]),
    ],
  });

  const transformed = transformProps(chartProps);

  // Static mode should always show £
  const formatter = getYAxisFormatter(transformed);
  expect(formatter(1000, 0)).toContain('£');
});

const baseFormDataHorizontalBar: SqlaFormData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: '__timestamp',
  metric: 'sum__num',
  groupby: [],
  viz_type: 'echarts_timeseries',
  seriesType: EchartsTimeseriesSeriesType.Bar,
  orientation: OrientationType.Horizontal,
  truncateYAxis: true,
  yAxisBounds: [null, null],
};

test('should set yAxis max to actual data max for horizontal bar charts', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': 15000 }, { 'Series A': 20000 }, { 'Series A': 18000 }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: baseFormDataHorizontalBar,
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  // In horizontal orientation, axes are swapped, so yAxis becomes xAxis
  const xAxisRaw = transformedProps.echartOptions.xAxis as any;
  expect(xAxisRaw.max).toBe(20000); // Should be the actual max value, not rounded
});

test('should set yAxis min and max for diverging horizontal bar charts', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': -21000 }, { 'Series A': 20000 }, { 'Series A': 18000 }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: baseFormDataHorizontalBar,
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  // In horizontal orientation, axes are swapped, so yAxis becomes xAxis
  const xAxisRaw = transformedProps.echartOptions.xAxis as any;
  expect(xAxisRaw.max).toBe(20000); // Should be the actual max value
  expect(xAxisRaw.min).toBe(-21000); // Should be the actual min value for diverging bars
});

test('should not override explicit yAxisBounds for horizontal bar charts', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': 15000 }, { 'Series A': 20000 }, { 'Series A': 18000 }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...baseFormDataHorizontalBar,
      yAxisBounds: [0, 25000], // Explicit bounds
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  // In horizontal orientation, axes are swapped, so yAxis becomes xAxis
  const xAxisRaw = transformedProps.echartOptions.xAxis as any;
  expect(xAxisRaw.max).toBe(25000); // Should respect explicit bound
  expect(xAxisRaw.min).toBe(0); // Should respect explicit bound
});

test('should not apply axis bounds calculation when truncateYAxis is false for horizontal bar charts', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': 15000 }, { 'Series A': 20000 }, { 'Series A': 18000 }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...baseFormDataHorizontalBar,
      truncateYAxis: false,
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  // In horizontal orientation, axes are swapped, so yAxis becomes xAxis
  const xAxis = transformedProps.echartOptions.xAxis as any;
  // Should not have explicit max set when truncateYAxis is false
  expect(xAxis.max).toBeUndefined();
});

test('should not apply axis bounds calculation when seriesType is not Bar for horizontal charts', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': 15000 }, { 'Series A': 20000 }, { 'Series A': 18000 }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...baseFormDataHorizontalBar,
      seriesType: EchartsTimeseriesSeriesType.Line,
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  // In horizontal orientation, axes are swapped, so yAxis becomes xAxis
  const xAxisRaw = transformedProps.echartOptions.xAxis as any;
  // Should not have explicit max set when seriesType is not Bar
  expect(xAxisRaw.max).toBeUndefined();
});
