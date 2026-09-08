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
  AnnotationData,
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
  AxisType,
  ChartProps,
  ComparisonType,
  ContributionType,
  DataRecord,
  EventAnnotationLayer,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  SqlaFormData,
  TimeseriesAnnotationLayer,
  ChartDataResponseResult,
  TimeGranularity,
  TooltipTruncationMode,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import { init, type SeriesOption } from 'echarts';
import type { GridComponentOption } from 'echarts/components';
import transformProps from '../../src/Timeseries/transformProps';
import {
  EchartsTimeseriesSeriesType,
  OrientationType,
  EchartsTimeseriesFormData,
} from '../../src/Timeseries/types';
import { StackControlsValue, TIMESERIES_CONSTANTS } from '../../src/constants';
import {
  ForecastSeriesEnum,
  LegendOrientation,
  LegendType,
  EchartsTimeseriesChartProps,
  LabelPositionEnum,
} from '../../src/types';
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

type TooltipFormatterOptions = {
  tooltip: {
    formatter: (params: unknown) => string;
  };
};

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

type CustomLegendResult = {
  customLegend?: {
    grid: {
      bottom: number | string;
      top: number | string;
    };
    items: {
      color: string;
      interactive: boolean;
      name: string;
      selected: boolean;
    }[];
    orientation: LegendOrientation.Top | LegendOrientation.Bottom;
    showSelectors: boolean;
  };
};

function getCustomLegend(transformed: ReturnType<typeof transformProps>) {
  return (transformed as unknown as CustomLegendResult).customLegend;
}

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
    const series = formulaSeries as SeriesOption;
    const data = series.data as [number, number][];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const firstDataPoint = data[0];
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
    const series = formulaSeries as SeriesOption;
    const data = series.data as [number, number][];
    const firstDataPoint = data[0];
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

  // Regression for #36401: query results containing integers beyond
  // Number.MAX_SAFE_INTEGER are parsed as native BigInt (see
  // packages/superset-ui-core/src/connection/callApi/parseResponse.ts).
  // In Stream mode, per-datum values are not routed through the Expand
  // normalization, so a raw BigInt reaching getBaselineSeriesForStream's
  // `0.5 * delta` weighting throws before the baseline series can render.
  test('does not throw computing a stream baseline series with a BigInt metric value', () => {
    const streamQueriesDataTyped: ChartDataResponseResult[] = [
      createTestQueryData([
        {
          __timestamp: BASE_TIMESTAMP,
          'San Francisco': BigInt('9007199254740993'),
          'New York': 220,
        },
        {
          __timestamp: BASE_TIMESTAMP + 1,
          'San Francisco': 150,
          'New York': 190,
        },
      ]),
    ];
    const streamFormData: Partial<EchartsTimeseriesFormData> = {
      ...formData,
      stack: StackControlsValue.Stream,
    };
    const chartProps = createTestChartProps({
      formData: streamFormData,
      queriesData: streamQueriesDataTyped,
    });
    expect(() => transformProps(chartProps)).not.toThrow();
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

  test('should respect labelPosition configuration', () => {
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        labelPosition: LabelPositionEnum.InsideBottom,
      },
      queriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as any[];

    transformedSeries.forEach(series => {
      expect(series.label.position).toBe('insideBottom');
      expect(series.label.overflow).toBeUndefined();
    });
  });

  test('should default to top when labelPosition is auto and orientation is vertical', () => {
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        labelPosition: 'auto',
        orientation: OrientationType.Vertical,
      },
      queriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as any[];

    transformedSeries.forEach(series => {
      expect(series.label.position).toBe('top');
      expect(series.label.overflow).toBeUndefined();
    });
  });

  test('should default to right when labelPosition is auto and orientation is horizontal', () => {
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        labelPosition: 'auto',
        orientation: OrientationType.Horizontal,
      },
      queriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as any[];

    transformedSeries.forEach(series => {
      expect(series.label.position).toBe('right');
      expect(series.label.overflow).toBeUndefined();
    });
  });

  test('should default to right when labelPosition is unset and orientation is horizontal', () => {
    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        labelPosition: undefined,
        orientation: OrientationType.Horizontal,
      },
      queriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as any[];

    transformedSeries.forEach(series => {
      expect(series.label.position).toBe('right');
      expect(series.label.overflow).toBeUndefined();
    });
  });

  test('should set overflow: truncate only for bar series', () => {
    const barChartProps = createTestChartProps({
      formData: {
        ...formData,
        seriesType: EchartsTimeseriesSeriesType.Bar,
      },
      queriesData,
    });
    const lineChartProps = createTestChartProps({
      formData: {
        ...formData,
        seriesType: EchartsTimeseriesSeriesType.Line,
      },
      queriesData,
    });

    const barSeries = transformProps(barChartProps).echartOptions
      .series as any[];
    const lineSeries = transformProps(lineChartProps).echartOptions
      .series as any[];

    barSeries.forEach(series => {
      expect(series.label.overflow).toBe('truncate');
    });
    lineSeries.forEach(series => {
      expect(series.label.overflow).toBeUndefined();
    });
  });

  test('should respect labelPosition for negative values in unstacked bar charts', () => {
    const negativeQueriesData = [
      createTestQueryData(
        createTestData(
          [
            {
              'San Francisco': -1,
              'New York': 2,
            },
          ],
          { intervalMs: 300000000 },
        ),
      ),
    ];

    const chartProps = createTestChartProps({
      formData: {
        ...formData,
        seriesType: EchartsTimeseriesSeriesType.Bar,
        stack: false,
        labelPosition: LabelPositionEnum.Inside,
      },
      queriesData: negativeQueriesData,
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as any[];

    expect(transformedSeries[0].data[0]).toEqual({
      value: [expect.any(Number), -1],
      label: {
        position: 'inside',
      },
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

  test('should exclude a verbose-named sort-only metric from the stacked total (#42881)', () => {
    // rebaseForecastDatum renames a data column to its verboseMap entry when
    // one is configured, so extraMetricLabels (derived from raw metric
    // labels) must be resolved through the same verboseMap to still match —
    // otherwise the sort-only metric's value leaks back into the total.
    const sortMetricVerboseMap = { sort_metric: 'Sort By Metric' };
    const sortFormData: SqlaFormData = {
      ...formData,
      onlyTotal: true,
      groupby: [],
      metrics: ['San Francisco', 'New York', 'Boston'],
      timeseries_limit_metric: 'sort_metric',
      x_axis_sort: 'sort_metric',
    };
    const sortQueriesData: ChartDataResponseResult[] = [
      createTestQueryData(
        createTestData(
          [
            {
              'San Francisco': 32,
              'New York': 0,
              Boston: 0,
              'Sort By Metric': 2,
            },
          ],
          { intervalMs: 300000000 },
        ),
      ),
    ];
    const chartProps = createTestChartProps({
      formData: sortFormData,
      queriesData: sortQueriesData,
      datasource: { verboseMap: sortMetricVerboseMap },
    });

    const transformedSeries = transformProps(chartProps).echartOptions
      .series as seriesType[];

    const totalLabels = transformedSeries
      .flatMap((series, seriesIndex) =>
        series.data.map((value, dataIndex) =>
          series.label.formatter({ value, dataIndex, seriesIndex }),
        ),
      )
      .filter(label => label !== '');

    expect(totalLabels).toEqual(['32']);
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

test('honors an explicit List selection for zoomable top legends even when toolbox space reduces available width', () => {
  const narrowLegendData = [
    createTestQueryData(
      createTestData(
        [
          {
            Alpha: 1,
            Beta: 2,
            Gamma: 3,
          },
        ],
        { intervalMs: 300000000 },
      ),
    ),
  ];
  const chartProps = createTestChartProps({
    width: 190 + TIMESERIES_CONSTANTS.legendTopRightOffset,
    formData: {
      ...formData,
      legendType: LegendType.Plain,
      legendOrientation: LegendOrientation.Top,
      showLegend: true,
      zoomable: true,
    },
    queriesData: narrowLegendData,
  });

  const transformed = transformProps(chartProps);

  expect((transformed.echartOptions.legend as any).type).toBe(LegendType.Plain);
});

test('moves a visible horizontal Plain legend into a custom HTML legend and restores normal plot padding', () => {
  const chartProps = createTestChartProps({
    width: 800,
    height: 400,
    formData: {
      ...formData,
      legendOrientation: LegendOrientation.Top,
      legendType: LegendType.Plain,
      showLegend: true,
      yAxisTitleMargin: 0,
      yAxisTitlePosition: 'Left',
    },
  });

  const transformed = transformProps(chartProps);
  const legend = transformed.echartOptions.legend as {
    show?: boolean;
    type?: LegendType;
  };
  const grid = transformed.echartOptions.grid as GridComponentOption;
  const customLegend = getCustomLegend(transformed);

  expect(legend).toMatchObject({ show: false, type: LegendType.Plain });
  expect(grid).toMatchObject({ top: 20, bottom: 20 });
  expect(customLegend).toMatchObject({
    orientation: LegendOrientation.Top,
    showSelectors: true,
  });
  expect(customLegend?.items.map(item => item.name)).toEqual([
    'San Francisco',
    'New York',
  ]);
  expect(customLegend?.items.every(item => item.interactive)).toBe(true);
  expect(customLegend?.items.every(item => item.selected)).toBe(true);
  expect(customLegend?.items.every(item => Boolean(item.color))).toBe(true);
  expect('contentHeight' in transformed).toBe(false);
});

test.each([LegendOrientation.Top, LegendOrientation.Bottom])(
  'uses the custom HTML legend for a %s-oriented Plain legend',
  legendOrientation => {
    const transformed = transformProps(
      createTestChartProps({
        formData: {
          ...formData,
          legendOrientation,
          legendType: LegendType.Plain,
          showLegend: true,
        },
      }),
    );

    expect(getCustomLegend(transformed)?.orientation).toBe(legendOrientation);
    expect((transformed.echartOptions.legend as { show?: boolean }).show).toBe(
      false,
    );
  },
);

test.each([
  [LegendType.Scroll, LegendOrientation.Top],
  [LegendType.Plain, LegendOrientation.Left],
  [LegendType.Plain, LegendOrientation.Right],
] as const)(
  'keeps %s/%s legends on the native ECharts path',
  (legendType, legendOrientation) => {
    const transformed = transformProps(
      createTestChartProps({
        formData: {
          ...formData,
          legendOrientation,
          legendType,
          showLegend: true,
        },
      }),
    );

    expect(getCustomLegend(transformed)).toBeUndefined();
    expect((transformed.echartOptions.legend as { show?: boolean }).show).toBe(
      true,
    );
  },
);

test('keeps the custom legend absent when a compact chart hides the Plain legend', () => {
  const transformed = transformProps(
    createTestChartProps({
      height: 80,
      formData: {
        ...formData,
        legendOrientation: LegendOrientation.Top,
        legendType: LegendType.Plain,
        showLegend: true,
      },
    }),
  );
  const grid = transformed.echartOptions.grid as GridComponentOption;

  expect(getCustomLegend(transformed)).toBeUndefined();
  expect((transformed.echartOptions.legend as { show?: boolean }).show).toBe(
    false,
  );
  expect(grid).toMatchObject({ top: 12, bottom: 5 });
  expect(80 - Number(grid.top) - Number(grid.bottom)).toBeGreaterThan(0);
});

test.each([
  [10, 9, 0.25, 9, 0],
  [13, 12, 0.25, 12, 0],
  [20, 12, 0.25, 12, 7],
  [30, 12, 1, 12, 17],
  [99, 12, 7, 12, 80],
  [100, 12, 8, 12, 80],
])(
  'keeps the hidden-legend zoomable ECharts grid within a %ipx canvas',
  (height, expectedGridY, expectedGridHeight, expectedTop, expectedBottom) => {
    const getContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        measureText: (text: string) => ({ width: text.length * 7 }),
      } as never);
    const transformed = transformProps(
      createTestChartProps({
        height,
        formData: {
          ...formData,
          legendOrientation: LegendOrientation.Top,
          legendType: LegendType.Plain,
          showLegend: true,
          zoomable: true,
        },
      }),
    );
    const chart = init(null, null, {
      height,
      renderer: 'svg',
      ssr: true,
      width: transformed.width,
    });

    try {
      chart.setOption(transformed.echartOptions);
      const gridModel = (
        chart as unknown as {
          getModel: () => {
            getComponent: (component: string) => {
              coordinateSystem: {
                getRect: () => { height: number; y: number };
              };
            };
          };
        }
      )
        .getModel()
        .getComponent('grid');

      expect(getCustomLegend(transformed)).toBeUndefined();
      expect(transformed.echartOptions.grid).toMatchObject({
        bottom: expectedBottom,
        top: expectedTop,
      });
      const gridRect = gridModel.coordinateSystem.getRect();
      expect(gridRect).toMatchObject({
        height: expectedGridHeight,
        y: expectedGridY,
      });
      expect(gridRect.y).toBeGreaterThanOrEqual(0);
      expect(gridRect.y + gridRect.height).toBeLessThanOrEqual(height);
    } finally {
      chart.dispose();
      getContext.mockRestore();
    }
  },
);

test('passes final axis-title grid reservations to the custom legend', () => {
  const transformed = transformProps(
    createTestChartProps({
      height: 300,
      formData: {
        ...formData,
        legendOrientation: LegendOrientation.Top,
        legendType: LegendType.Plain,
        showLegend: true,
        xAxisTitle: 'Time',
        xAxisTitleMargin: 60,
        yAxisTitle: 'Value',
        yAxisTitleMargin: 40,
        yAxisTitlePosition: 'Top',
        zoomable: true,
      },
    }),
  );
  const grid = transformed.echartOptions.grid as GridComponentOption;

  expect(getCustomLegend(transformed)?.grid).toEqual({
    bottom: grid.bottom,
    top: grid.top,
  });
});

test('derives custom legend items from a single-object custom series override', () => {
  const transformed = transformProps(
    createTestChartProps({
      formData: {
        ...formData,
        echartOptions: `{
          series: {
            name: 'San Francisco',
            type: 'line',
            data: [[0, 9]],
            itemStyle: { color: '#123456' }
          }
        }`,
        legendOrientation: LegendOrientation.Top,
        legendType: LegendType.Plain,
        showLegend: true,
      },
    }),
  );

  expect(getCustomLegend(transformed)?.items).toEqual([
    expect.objectContaining({
      color: '#123456',
      name: 'San Francisco',
    }),
  ]);
});

test('keeps a hidden native legend model active for custom legend dispatch actions', () => {
  const transformed = transformProps(
    createTestChartProps({
      formData: {
        ...formData,
        legendOrientation: LegendOrientation.Top,
        legendType: LegendType.Plain,
        showLegend: true,
      },
    }),
  );
  const chart = init(null, null, {
    height: transformed.height,
    renderer: 'svg',
    ssr: true,
    width: transformed.width,
  });

  try {
    chart.setOption(transformed.echartOptions);
    const toggled = jest.fn();
    const inverted = jest.fn();
    const selectedAll = jest.fn();
    chart.on('legendselectchanged', toggled);
    chart.on('legendinverseselect', inverted);
    chart.on('legendselectall', selectedAll);
    chart.dispatchAction({
      name: 'San Francisco',
      type: 'legendToggleSelect',
    });

    expect((transformed.echartOptions.legend as { show?: boolean }).show).toBe(
      false,
    );
    expect(toggled).toHaveBeenCalledWith(
      expect.objectContaining({
        selected: expect.objectContaining({
          'New York': true,
          'San Francisco': false,
        }),
      }),
    );

    chart.dispatchAction({ type: 'legendInverseSelect' });
    expect(inverted).toHaveBeenCalledWith(
      expect.objectContaining({
        selected: expect.objectContaining({
          'New York': false,
          'San Francisco': true,
        }),
      }),
    );

    chart.dispatchAction({ type: 'legendAllSelect' });
    expect(selectedAll).toHaveBeenCalledWith(
      expect.objectContaining({
        selected: expect.objectContaining({
          'New York': true,
          'San Francisco': true,
        }),
      }),
    );
  } finally {
    chart.dispose();
  }
});

test('derives custom legend visuals from the final reordered Forecast series', () => {
  const legendNames = ['Forecast Alpha', 'Forecast Beta'];
  const forecastValues = Object.fromEntries(
    legendNames.flatMap((name, index) => [
      [name, index + 1],
      [`${name}${ForecastSeriesEnum.ForecastLower}`, index],
      [`${name}${ForecastSeriesEnum.ForecastUpper}`, index + 2],
      [`${name}${ForecastSeriesEnum.ForecastTrend}`, index + 1.5],
    ]),
  );
  const transformed = transformProps(
    createTestChartProps({
      formData: {
        ...formData,
        forecastEnabled: true,
        legendOrientation: LegendOrientation.Top,
        legendType: LegendType.Plain,
        showLegend: true,
      },
      queriesData: [
        createTestQueryData(
          createTestData([forecastValues], { intervalMs: 300000000 }),
        ),
      ],
    }),
  );
  const renderedSeries = transformed.echartOptions.series as SeriesOption[];
  const customLegend = getCustomLegend(transformed);

  legendNames.forEach(name => {
    const representative = renderedSeries.find(series => series.name === name);
    const item = customLegend?.items.find(candidate => candidate.name === name);

    expect(representative?.id).toBe(
      `${name}${ForecastSeriesEnum.ForecastLower}`,
    );
    expect(item?.color).toBe(
      (representative as { itemStyle?: { color?: string } } | undefined)
        ?.itemStyle?.color,
    );
  });
});

test('honors user-selected plain legend type for top orientation when space allows (#39540)', () => {
  // Regression test for issue #39540: switching the legend type control from
  // scroll to plain must reach the rendered ECharts config. Horizontal legends
  // were once unconditionally forced to scroll; scroll should be a fallback
  // reserved for legends that do not fit the available space.
  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      legendType: LegendType.Plain,
      legendOrientation: LegendOrientation.Top,
      showLegend: true,
    },
  });

  const { legend } = transformProps(chartProps).echartOptions as {
    legend: { show?: boolean; type?: LegendType };
  };

  expect(legend.show).toBe(false);
  expect(legend.type).toBe(LegendType.Plain);
  expect(getCustomLegend(transformProps(chartProps))).toBeDefined();
});

test('honors user-selected plain legend type for bottom orientation when space allows (#39540)', () => {
  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      legendType: LegendType.Plain,
      legendOrientation: LegendOrientation.Bottom,
      showLegend: true,
    },
  });

  const { legend } = transformProps(chartProps).echartOptions as {
    legend: { show?: boolean; type?: LegendType };
  };

  expect(legend.show).toBe(false);
  expect(legend.type).toBe(LegendType.Plain);
  expect(getCustomLegend(transformProps(chartProps))).toBeDefined();
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
      timeShiftColor: true,
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
  expect(mainSeries?.lineStyle?.type).not.toBe('dotted');
  // Comparison series should have a visible dash pattern
  expect(comparisonSeries?.lineStyle?.type).toBe('dotted');
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
      timeShiftColor: true,
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
  // Comparison series should have a visible dash pattern
  expect(comparisonSeries?.lineStyle?.type).toBe('dotted');
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

test('should not clip small segments when row-contribution percentages float above 1 in horizontal stacked bar charts', () => {
  // These three shares are individually normalized (each column sums to 1),
  // but due to floating point rounding their sum can land fractionally
  // over 1. See https://github.com/apache/superset/issues/30914
  //
  // The margin above 1 is chosen large enough (~1e-7) that the sum stays
  // above 1 no matter which order the underlying series get summed in
  // (series are sorted by name for stacking, not in the order declared
  // here), unlike a single-ULP overflow which can round differently
  // depending on summation order and make this assertion order-dependent.
  const shareA = 0.42;
  const shareB = 0.38;
  const shareC = 0.2000001;
  expect(shareA + shareB + shareC).toBeGreaterThan(1);

  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': shareA, 'Series B': shareB, 'Series C': shareC }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...baseFormDataHorizontalBar,
      contributionMode: ContributionType.Row,
      stack: StackControlsValue.Stack,
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  // In horizontal orientation, axes are swapped, so yAxis becomes xAxis.
  // The axis max must not be hard-capped at exactly 1, otherwise echarts
  // clips the topmost stacked segment entirely instead of just rendering
  // a negligible sub-pixel overflow.
  const xAxisRaw = transformedProps.echartOptions.xAxis as any;
  expect(xAxisRaw.max).toBeGreaterThanOrEqual(shareA + shareB + shareC);
});

test('keeps the 0-1 axis range for Expand (100% stacked) charts instead of padding to the raw row total', () => {
  // Unlike row-contribution mode, an Expand stack is not pre-normalized in
  // the query result -- these are raw values (summing to 100, not 1) that
  // get divided down to a 0-1 range internally. The un-normalized row total
  // must not be used to pad the axis max, or the chart would only occupy a
  // sliver of the plot.
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData([{ 'Series A': 42, 'Series B': 38, 'Series C': 20 }], {
        intervalMs: 300000000,
      }),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...baseFormDataHorizontalBar,
      stack: StackControlsValue.Expand,
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  const xAxisRaw = transformedProps.echartOptions.xAxis as any;
  expect(xAxisRaw.max).toBe(1);
});

test('computes row-contribution axis padding per stack when time_compare splits a row into multiple normalized stacks', () => {
  // With time_compare, each comparison period is normalized and stacked
  // independently (see getTimeCompareStackId), so the current-period
  // columns sum to ~1 in their own stack and the comparison-period columns
  // (suffixed with the offset) sum to ~1 in a separate stack. The combined
  // row total across both stacks is therefore ~2, but the axis max must be
  // computed per stack, not from that combined total, or a 100% bar would
  // only occupy about half the plot.
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [
          {
            'Series A': 0.6,
            'Series B': 0.4,
            'Series A__1 year ago': 0.55,
            'Series B__1 year ago': 0.45,
          },
        ],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...baseFormDataHorizontalBar,
      contributionMode: ContributionType.Row,
      stack: StackControlsValue.Stack,
      time_compare: ['1 year ago'],
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);

  const xAxisRaw = transformedProps.echartOptions.xAxis as any;
  expect(xAxisRaw.max).toBeGreaterThanOrEqual(1);
  expect(xAxisRaw.max).toBeLessThan(1.5);
});

test('clamps series values to the yAxis max instead of dropping out-of-range points (#27449)', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [
          { 'Series A': 1 },
          { 'Series A': 2 },
          { 'Series A': 3 },
          { 'Series A': 4 },
          { 'Series A': 1000 },
          { 'Series A': 4 },
          { 'Series A': 2 },
        ],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      groupby: [],
      seriesType: EchartsTimeseriesSeriesType.Line,
      truncateYAxis: true,
      yAxisBounds: [0, 10],
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);
  const series = transformedProps.echartOptions.series as SeriesOption[];
  const seriesA = series.find(s => s.name === 'Series A');
  expect(seriesA).toBeDefined();
  const data = seriesA!.data as [number, number][];

  // The point that was 1000 should be present (not dropped) and clamped to
  // the configured yAxis max of 10, rather than disappearing entirely.
  expect(data).toHaveLength(7);
  expect(data[4][1]).toBe(10);
});

test('clamps series values to the yAxis min when a value falls below it', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': -1000 }, { 'Series A': 2 }, { 'Series A': 3 }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      groupby: [],
      seriesType: EchartsTimeseriesSeriesType.Line,
      truncateYAxis: true,
      yAxisBounds: [0, 10],
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);
  const series = transformedProps.echartOptions.series as SeriesOption[];
  const seriesA = series.find(s => s.name === 'Series A');
  expect(seriesA).toBeDefined();
  const data = seriesA!.data as [number, number][];

  expect(data).toHaveLength(3);
  expect(data[0][1]).toBe(0);
});

test('clamps series values to the yAxis bounds when colorByPrimaryAxis wraps points in objects (#27449)', () => {
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData(
        [{ 'Series A': 1 }, { 'Series A': 1000 }, { 'Series A': 2 }],
        { intervalMs: 300000000 },
      ),
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      groupby: [],
      seriesType: EchartsTimeseriesSeriesType.Line,
      truncateYAxis: true,
      yAxisBounds: [0, 10],
      colorByPrimaryAxis: true,
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);
  const series = transformedProps.echartOptions.series as SeriesOption[];
  const seriesA = series.find(s => s.name === 'Series A');
  expect(seriesA).toBeDefined();
  const data = seriesA!.data as { value: [number, number] }[];

  // colorByPrimaryAxis wraps each point as `{ value: [x, y], itemStyle }`
  // rather than a bare tuple; the wrapped value must still be clamped
  // instead of being skipped and left for ECharts to drop.
  expect(data).toHaveLength(3);
  expect(data[1].value[1]).toBe(10);
});

test('does not clamp a timeseries annotation series to the Y axis bounds (#27449)', () => {
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
    'My Timeseries': {
      records: [
        { x: 0, y: 11000 },
        { x: 300000000, y: 21000 },
      ],
    },
  };
  const queriesData: ChartDataResponseResult[] = [
    createTestQueryData(
      createTestData([{ 'Series A': 1 }, { 'Series A': 2 }], {
        intervalMs: 300000000,
      }),
      { annotation_data: annotationData },
    ),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      groupby: [],
      seriesType: EchartsTimeseriesSeriesType.Line,
      truncateYAxis: true,
      yAxisBounds: [0, 10],
      annotationLayers: [timeseries],
    },
    annotationData,
    queriesData,
  });

  const transformedProps = transformProps(chartProps);
  const series = transformedProps.echartOptions.series as SeriesOption[];
  const annotationSeries = series.find(s => s.id === 'My Timeseries');
  expect(annotationSeries).toBeDefined();
  const data = annotationSeries!.data as [number, number][];

  // The annotation carries its own configured values (11000, 21000), which
  // are unrelated to the chart's own out-of-range-data problem this PR
  // fixes. They must be left untouched by the Y axis clamp rather than
  // rewritten to the yAxisBounds max of 10.
  expect(data[0][1]).toBe(11000);
  expect(data[1][1]).toBe(21000);
});

test('clamps series values at the correct tuple index for horizontal bar charts (#27449)', () => {
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
      yAxisBounds: [0, 16000],
    },
    queriesData,
  });

  const transformedProps = transformProps(chartProps);
  const series = transformedProps.echartOptions.series as SeriesOption[];
  const seriesA = series.find(s => s.name === 'Series A');
  expect(seriesA).toBeDefined();
  const data = seriesA!.data as [number, number][];

  // In horizontal orientation the value sits at tuple index 0 (the axes are
  // swapped), so the clamp must target that index rather than index 1.
  expect(data).toHaveLength(3);
  expect(data[1][0]).toBe(16000);
});

test('legend is visible on tall charts when enabled by the user', () => {
  const chartProps = createTestChartProps({
    height: 400,
    formData: { showLegend: true },
  });
  const { legend } = transformProps(chartProps).echartOptions as any;

  expect(legend.show).toBe(true);
});

test('legend is hidden on small charts even when enabled by the user', () => {
  const chartProps = createTestChartProps({
    height: 80,
    formData: { showLegend: true },
  });
  const { legend } = transformProps(chartProps).echartOptions as any;

  expect(legend.show).toBe(false);
});

test('y-axis labels remain visible on small charts for scale reference', () => {
  const chartProps = createTestChartProps({ height: 80 });
  const { yAxis } = transformProps(chartProps).echartOptions as any;

  expect(yAxis.axisLabel.show).toBe(true);
});

test('y-axis labels are hidden on micro charts for a sparkline view', () => {
  const chartProps = createTestChartProps({ height: 40 });
  const { yAxis } = transformProps(chartProps).echartOptions as any;

  expect(yAxis.axisLabel.show).toBe(false);
});

test('y-axis tick count scales with chart height', () => {
  const short = transformProps(createTestChartProps({ height: 200 }));
  const tall = transformProps(createTestChartProps({ height: 500 }));
  const shortYAxis = short.echartOptions.yAxis as any;
  const tallYAxis = tall.echartOptions.yAxis as any;

  expect(tallYAxis.splitNumber).toBeGreaterThan(shortYAxis.splitNumber);
});

test('small chart y-axis uses splitNumber=1 to show only boundary labels', () => {
  const chartProps = createTestChartProps({ height: 80 });
  const { yAxis } = transformProps(chartProps).echartOptions as any;

  expect(yAxis.splitNumber).toBe(1);
});

test('zoomable small chart preserves bottom padding for the dataZoom slider', () => {
  const chartProps = createTestChartProps({
    height: 80,
    formData: { zoomable: true },
  });
  const result = transformProps(chartProps);
  const grid = result.echartOptions.grid as any;

  expect(grid.bottom).toBeGreaterThan(5);
});

test('boundary: height at exactly 100px uses full axis behavior', () => {
  const chartProps = createTestChartProps({ height: 100 });
  const { yAxis } = transformProps(chartProps).echartOptions as any;

  expect(yAxis.axisLabel.show).toBe(true);
  expect(yAxis.splitNumber).toBeGreaterThanOrEqual(3);
});

test('boundary: height at 99px triggers small chart behavior', () => {
  const chartProps = createTestChartProps({
    height: 99,
    formData: { showLegend: true },
  });
  const { yAxis, legend } = transformProps(chartProps).echartOptions as any;

  expect(yAxis.splitNumber).toBe(1);
  expect(legend.show).toBe(false);
});

test('boundary: height at exactly 60px shows labels but uses compact axis', () => {
  const chartProps = createTestChartProps({ height: 60 });
  const { yAxis } = transformProps(chartProps).echartOptions as any;

  expect(yAxis.axisLabel.show).toBe(true);
  expect(yAxis.splitNumber).toBe(1);
});

test('boundary: height at 59px triggers micro chart behavior', () => {
  const chartProps = createTestChartProps({ height: 59 });
  const { yAxis } = transformProps(chartProps).echartOptions as any;

  expect(yAxis.axisLabel.show).toBe(false);
});

test('x-axis formatter deduplicates consecutive identical labels for coarse time grains', () => {
  const yearData = [
    { __timestamp: Date.UTC(2003, 0, 1), sales: 100 },
    { __timestamp: Date.UTC(2004, 0, 1), sales: 200 },
    { __timestamp: Date.UTC(2005, 0, 1), sales: 300 },
  ];

  const chartProps = createTestChartProps({
    formData: {
      granularity_sqla: 'ds',
      timeGrainSqla: TimeGranularity.YEAR,
      xAxisTimeFormat: '%Y',
    },
    queriesData: [
      createTestQueryData(yearData, {
        colnames: ['__timestamp', 'sales'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      }),
    ],
  });

  const transformedProps = transformProps(chartProps);
  const xAxisResult = transformedProps.echartOptions.xAxis as any;
  const { formatter } = xAxisResult.axisLabel;

  expect(typeof formatter).toBe('function');
  expect(xAxisResult.axisLabel.showMaxLabel).toBe(true);

  const label1 = formatter(Date.UTC(2003, 0, 1));
  const label2 = formatter(Date.UTC(2004, 0, 1));
  const label3 = formatter(Date.UTC(2005, 0, 1));
  const label4 = formatter(Date.UTC(2005, 6, 1));

  expect(label1).toBe('2003');
  expect(label2).toBe('2004');
  expect(label3).toBe('2005');
  expect(label4).toBe('');
});

test('x-axis dedup keeps the forced min label when the endpoints format identically', () => {
  // A May→May range renders "May" at both boundaries. ECharts formats labels in
  // repeated ascending passes; the dedup must reset per pass so the forced min
  // label isn't blanked by the previous pass's (identical) max label.
  const data = [
    { __timestamp: Date.UTC(2003, 4, 1), sales: 100 },
    { __timestamp: Date.UTC(2004, 0, 1), sales: 200 },
    { __timestamp: Date.UTC(2005, 4, 1), sales: 300 },
  ];

  const chartProps = createTestChartProps({
    formData: {
      granularity_sqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      xAxisTimeFormat: '%b',
    },
    queriesData: [
      createTestQueryData(data, {
        colnames: ['__timestamp', 'sales'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      }),
    ],
  });

  const { formatter } = (transformProps(chartProps).echartOptions.xAxis as any)
    .axisLabel;
  const min = Date.UTC(2003, 4, 1);
  const mid = Date.UTC(2004, 0, 1);
  const max = Date.UTC(2005, 4, 1);

  // First pass fills the dedup state, ending on the max label ("May").
  formatter(min);
  formatter(mid);
  formatter(max);

  // Second pass restarts at the min; it must not be blanked by the prior "May".
  expect(formatter(min)).toBe('May');
});

test('x-axis does not force showMaxLabel when no time grain is set', () => {
  const data = [
    { __timestamp: Date.UTC(2003, 0, 6), sales: 100 },
    { __timestamp: Date.UTC(2004, 5, 15), sales: 200 },
    { __timestamp: Date.UTC(2005, 4, 31), sales: 300 },
  ];

  const chartProps = createTestChartProps({
    formData: {
      granularity_sqla: 'ds',
      timeGrainSqla: undefined,
    },
    queriesData: [
      createTestQueryData(data, {
        colnames: ['__timestamp', 'sales'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      }),
    ],
  });

  const xAxisResult = transformProps(chartProps).echartOptions.xAxis as any;
  expect(xAxisResult.axisLabel.showMaxLabel).not.toBe(true);
  expect(xAxisResult.axisLabel.showMinLabel).not.toBe(true);
});

test('x-axis forces showMinLabel for time grains so the beginning date stays visible', () => {
  // When the first data point is not on a coarse boundary (e.g. a mid-year
  // month), ECharts places its first label on the next "nice" tick and leaves
  // the axis-min date unlabeled. showMinLabel forces the beginning date to
  // render, symmetric to showMaxLabel on the trailing edge.
  const monthData = [
    { __timestamp: Date.UTC(2003, 4, 1), sales: 100 },
    { __timestamp: Date.UTC(2003, 5, 1), sales: 200 },
    { __timestamp: Date.UTC(2003, 6, 1), sales: 300 },
  ];

  const chartProps = createTestChartProps({
    formData: {
      granularity_sqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      xAxisTimeFormat: 'smart_date',
    },
    queriesData: [
      createTestQueryData(monthData, {
        colnames: ['__timestamp', 'sales'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      }),
    ],
  });

  const xAxisResult = transformProps(chartProps).echartOptions.xAxis as any;
  expect(xAxisResult.axisLabel.showMinLabel).toBe(true);
});

test('numeric x coltype routes through the number formatter (not the time formatter)', () => {
  // Regression guard for echarts-timeseries-epoch-x-axis-labels investigation.
  // When the query reports a Numeric x-axis coltype (including epoch-ms-like
  // values), Timeseries transformProps must pick the Value axis and run the
  // label through getNumberFormatter, not the time formatter. If this ever
  // changes, epoch-ms values that arrive as Numeric would suddenly be treated
  // as Date instances and could render "NaN" — the symptom that prompted this
  // investigation.
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const chartProps = createTestChartProps({
    formData: {
      metrics: ['metric'],
      granularity_sqla: 'ds',
      x_axis: '__timestamp',
    },
    queriesData: [
      createTestQueryData(
        [
          { __timestamp: ts1, metric: 10 },
          { __timestamp: ts2, metric: 20 },
        ],
        {
          colnames: ['__timestamp', 'metric'],
          coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
        },
      ),
    ],
  });

  const { echartOptions } = transformProps(chartProps);
  const xAxis = echartOptions.xAxis as {
    type: string;
    axisLabel: { formatter: (v: number) => string };
  };

  expect(xAxis.type).toBe(AxisType.Value);
  const label = xAxis.axisLabel.formatter(ts1);
  expect(typeof label).toBe('string');
  expect(label).not.toMatch(/NaN/);
});

test('xAxisForceCategorical forces Category axis regardless of Numeric coltype', () => {
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const chartProps = createTestChartProps({
    formData: {
      metrics: ['metric'],
      granularity_sqla: 'ds',
      x_axis: '__timestamp',
      xAxisForceCategorical: true,
    },
    queriesData: [
      createTestQueryData(
        [
          { __timestamp: ts1, metric: 10 },
          { __timestamp: ts2, metric: 20 },
        ],
        {
          colnames: ['__timestamp', 'metric'],
          coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
        },
      ),
    ],
  });

  const { echartOptions } = transformProps(chartProps);
  const xAxis = echartOptions.xAxis as {
    triggerEvent?: boolean;
    type: string;
  };

  expect(xAxis.type).toBe(AxisType.Category);
  expect(xAxis.triggerEvent).toBe(true);
});

test('temporal x-axis enables trigger events when no dimensions are set', () => {
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const chartProps = createTestChartProps({
    formData: {
      metrics: ['metric'],
      granularity_sqla: 'ds',
      x_axis: '__timestamp',
    },
    queriesData: [
      createTestQueryData(
        [
          { __timestamp: ts1, metric: 10 },
          { __timestamp: ts2, metric: 20 },
        ],
        {
          colnames: ['__timestamp', 'metric'],
          coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
        },
      ),
    ],
  });

  const { echartOptions } = transformProps(chartProps);
  const xAxis = echartOptions.xAxis as {
    triggerEvent?: boolean;
    type: string;
  };

  expect(xAxis.type).toBe(AxisType.Time);
  expect(xAxis.triggerEvent).toBe(true);
});

test('temporal x coltype forced categorical yields a Category axis with date labels', () => {
  // Issue #28204: with a temporal x-axis (e.g. weekly grain) the default Time
  // scale places ticks at "nice" intervals that don't line up with the buckets.
  // Forcing categorical maps each bucket to a discrete, tick-aligned category
  // while still formatting the labels as dates rather than raw timestamps.
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const chartProps = createTestChartProps({
    formData: {
      metrics: ['metric'],
      granularity_sqla: 'ds',
      x_axis: '__timestamp',
      xAxisForceCategorical: true,
    },
    queriesData: [
      createTestQueryData(
        [
          { __timestamp: ts1, metric: 10 },
          { __timestamp: ts2, metric: 20 },
        ],
        {
          colnames: ['__timestamp', 'metric'],
          coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
        },
      ),
    ],
  });

  const { echartOptions } = transformProps(chartProps);
  const xAxis = echartOptions.xAxis as {
    type: string;
    axisLabel: { formatter: (v: Date) => string };
  };

  expect(xAxis.type).toBe(AxisType.Category);
  const label = xAxis.axisLabel.formatter(new Date(ts1));
  expect(typeof label).toBe('string');
  expect(label).not.toMatch(/NaN/);
  expect(label).not.toBe(String(ts1));
});

test('temporal x coltype wires the time formatter and Time axis', () => {
  // Regression guard: the happy path for time-series charts. Ensures that
  // Temporal coltype keeps routing through the TimeFormatter so a refactor
  // does not accidentally drop Date handling (the feared regression that
  // sparked this investigation).
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const chartProps = createTestChartProps({
    formData: {
      metrics: ['metric'],
      granularity_sqla: 'ds',
      x_axis: '__timestamp',
    },
    queriesData: [
      createTestQueryData(
        [
          { __timestamp: ts1, metric: 10 },
          { __timestamp: ts2, metric: 20 },
        ],
        {
          colnames: ['__timestamp', 'metric'],
          coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
        },
      ),
    ],
  });

  const { echartOptions } = transformProps(chartProps);
  const xAxis = echartOptions.xAxis as {
    type: string;
    axisLabel: { formatter: (v: Date) => string };
  };

  expect(xAxis.type).toBe(AxisType.Time);
  const label = xAxis.axisLabel.formatter(new Date(ts1));
  expect(typeof label).toBe('string');
  expect(label).not.toMatch(/NaN/);
  expect(label).not.toBe(String(ts1));
});

test('should assign distinct dash patterns for multiple time offsets consistently', () => {
  const queriesDataWithMultipleOffsets = [
    createTestQueryData([
      {
        sum__num: 100,
        '1 year ago': 80,
        '2 years ago': 60,
        __timestamp: 599616000000,
      },
      {
        sum__num: 150,
        '1 year ago': 120,
        '2 years ago': 90,
        __timestamp: 599916000000,
      },
    ]),
  ];

  const chartProps = createTestChartProps({
    formData: {
      ...timeCompareFormData,
      time_compare: ['1 year ago', '2 years ago'],
      comparison_type: ComparisonType.Values,
      timeShiftColor: true,
    },
    queriesData: queriesDataWithMultipleOffsets,
  });

  const transformed = transformProps(chartProps);
  const series = (transformed.echartOptions.series as SeriesOption[]) || [];

  const series1 = series.find(s => s.name === '1 year ago') as any;
  const series2 = series.find(s => s.name === '2 years ago') as any;

  expect(series1).toBeDefined();
  expect(series2).toBeDefined();

  const pattern1 = series1.lineStyle?.type;
  const symbol1 = series1.symbol;
  const pattern2 = series2.lineStyle?.type;
  const symbol2 = series2.symbol;

  // must be different patterns
  expect(pattern1).not.toEqual(pattern2);

  // must be different patterns
  expect(symbol1).not.toEqual(symbol2);
});

describe('Tooltip with long labels', () => {
  test('should use axisValue for tooltip when available (richTooltip)', () => {
    const longLabelData: ChartDataResponseResult[] = [
      createTestQueryData([
        {
          'This is a very long category name that would normally be truncated': 100,
          __timestamp: 599616000000,
        },
        {
          'Another extremely long category name for testing purposes': 200,
          __timestamp: 599916000000,
        },
      ]),
    ];

    const chartProps = createTestChartProps({
      formData: {
        richTooltip: true,
      },
      queriesData: longLabelData,
    });

    const transformedProps = transformProps(chartProps);

    // Get the tooltip formatter function
    const tooltipFormatter = (transformedProps.echartOptions as any).tooltip
      .formatter;

    // Simulate params from ECharts with axisValue containing full label
    // Use distinct values for axisValue and seriesName to verify axisValue is used
    const mockParams = [
      {
        axisValue:
          'This is a very long category name that would normally be truncated',
        value: [599616000000, 100],
        seriesName: 'Some Series Name',
      },
    ];

    // Call the formatter and check it uses the full label from axisValue
    const result = tooltipFormatter(mockParams);
    expect(result).toContain(
      'This is a very long category name that would normally be truncated',
    );
  });

  test('should fallback to value when axisValue is not available', () => {
    const chartProps = createTestChartProps({
      formData: {
        richTooltip: true,
      },
    });

    const transformedProps = transformProps(chartProps);

    const tooltipFormatter = (transformedProps.echartOptions as any).tooltip
      .formatter;

    // Simulate params without axisValue
    const mockParams = [
      {
        value: [599616000000, 1],
        seriesName: 'San Francisco',
      },
    ];

    // Should fall back to the x-value (value[xIndex]) and render it in the title
    const result = tooltipFormatter(mockParams);
    expect(typeof result).toBe('string');
    expect(result).toContain('599616000000');
  });

  test('should handle item tooltips correctly', () => {
    const chartProps = createTestChartProps({
      formData: {
        richTooltip: false,
      },
    });

    const transformedProps = transformProps(chartProps);

    const tooltipFormatter = (transformedProps.echartOptions as any).tooltip
      .formatter;

    // For item tooltips, params is a single object
    const mockParams = {
      value: [599616000000, 1],
      seriesName: 'San Francisco',
    };

    // The item-tooltip x-value (value[xIndex]) should appear in the title
    const result = tooltipFormatter(mockParams);
    expect(typeof result).toBe('string');
    expect(result).toContain('599616000000');
  });
});

test('tooltip time grain wiring: dashboard-level extraFormData time grain overrides the chart-level grain in the tooltip', () => {
  const ts = Date.UTC(2021, 0, 7);
  const chartProps = createTestChartProps({
    formData: {
      granularity_sqla: 'ds',
      richTooltip: false,
      // The chart itself is configured with a Day grain...
      timeGrainSqla: TimeGranularity.DAY,
      // ...but a dashboard-level filter/override resolves to Month.
      extraFormData: { time_grain_sqla: TimeGranularity.MONTH },
    },
    queriesData: [
      createTestQueryData([{ __timestamp: ts, sales: 100 }], {
        colnames: ['__timestamp', 'sales'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      }),
    ],
  });

  const transformedProps = transformProps(chartProps);
  expect(transformedProps.resolvedTimeGrain).toBe(TimeGranularity.MONTH);
  const tooltipFormatter = (
    transformedProps.echartOptions as unknown as TooltipFormatterOptions
  ).tooltip.formatter;

  const result = tooltipFormatter({
    value: [ts, 100],
    seriesName: 'sales',
  });

  // Month grain (the dashboard override) should win, so the tooltip title
  // reads "Jan 2021" rather than the Day-grain "2021-01-07".
  expect(result).toContain('Jan');
  expect(result).toContain('2021');
  expect(result).not.toContain('2021-01-07');
});

test('tooltip time grain wiring: chart-level time grain drives the tooltip when there is no dashboard override', () => {
  const ts = Date.UTC(2021, 0, 7);
  const chartProps = createTestChartProps({
    formData: {
      granularity_sqla: 'ds',
      richTooltip: false,
      timeGrainSqla: TimeGranularity.YEAR,
    },
    queriesData: [
      createTestQueryData([{ __timestamp: ts, sales: 100 }], {
        colnames: ['__timestamp', 'sales'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      }),
    ],
  });

  const transformedProps = transformProps(chartProps);
  expect(transformedProps.resolvedTimeGrain).toBe(TimeGranularity.YEAR);
  const tooltipFormatter = (
    transformedProps.echartOptions as unknown as TooltipFormatterOptions
  ).tooltip.formatter;

  const result = tooltipFormatter({
    value: [ts, 100],
    seriesName: 'sales',
  });

  expect(result).toContain('2021');
  expect(result).not.toContain('2021-01-07');
});

test('rebases each series to its percent change when the flag is enabled', () => {
  const chartProps = createTestChartProps({
    formData: {
      ...formData,
      rebasePercentChange: true,
    } as unknown as Partial<EchartsTimeseriesFormData>,
  });
  const transformed = transformProps(chartProps);

  // SF: 1 -> 3 rebases to 0 -> 2; NY: 2 -> 4 rebases to 0 -> 1
  expect(transformed.echartOptions).toEqual(
    expect.objectContaining({
      series: expect.arrayContaining([
        expect.objectContaining({
          name: 'San Francisco',
          data: [
            [BASE_TIMESTAMP, 0],
            [BASE_TIMESTAMP + 300000000, 2],
          ],
        }),
        expect.objectContaining({
          name: 'New York',
          data: [
            [BASE_TIMESTAMP, 0],
            [BASE_TIMESTAMP + 300000000, 1],
          ],
        }),
      ]),
    }),
  );

  // percent-change view forces a percent axis format
  expect(getYAxisFormatter(transformed)(1, 0)).toContain('%');
});

test('honors the snake_case flag the compare-chart migration stores in params', () => {
  // MigrateCompareChart writes `rebase_percent_change` into slice params;
  // ChartProps camelizes stored form data before transformProps reads it, so
  // this exercises the full migrated-chart path rather than the camelized
  // key the test helper injects directly.
  const chartProps = new ChartProps({
    formData: {
      datasource: '3__table',
      viz_type: 'echarts_timeseries_line',
      granularity_sqla: 'ds',
      rebase_percent_change: true,
    },
    width: 800,
    height: 600,
    queriesData,
    theme: supersetTheme,
    datasource: {},
  }) as unknown as EchartsTimeseriesChartProps;
  const { echartOptions } = transformProps(chartProps);

  const { series } = echartOptions as unknown as { series: SeriesOption[] };
  const sanFrancisco = series.find(s => s.name === 'San Francisco');
  expect(sanFrancisco?.data).toEqual([
    [BASE_TIMESTAMP, 0],
    [BASE_TIMESTAMP + 300000000, 2],
  ]);
});
describe('EchartsTimeseries tooltip truncation', () => {
  const longSeriesName = 'prod-us-east-1-service-checkout-latency-p99';
  const marker = '<span style="background-color:#1f77b4;"></span>';

  const buildTooltip = (
    tooltipTruncation?: TooltipTruncationMode,
    xValue: string | number = 599616000000,
  ) => {
    const chartProps = new ChartProps({
      formData: {
        colorScheme: 'bnbColors',
        datasource: '3__table',
        granularity_sqla: 'ds',
        metric: 'sum__num',
        groupby: ['foo'],
        viz_type: 'my_viz',
        ...(tooltipTruncation ? { tooltipTruncation } : {}),
      } as SqlaFormData,
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { [longSeriesName]: 1, __timestamp: 599616000000 },
            { [longSeriesName]: 3, __timestamp: 599916000000 },
          ],
        },
      ],
      theme: supersetTheme,
    });
    const { echartOptions } = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const { formatter } = echartOptions.tooltip as {
      formatter: (params: unknown) => string;
    };
    return formatter([
      {
        seriesId: longSeriesName,
        seriesName: longSeriesName,
        value: [xValue, 1],
        marker,
      },
    ]);
  };

  test('applies the CSS cap and keeps full text by default', () => {
    const html = buildTooltip();
    expect(html).toContain(longSeriesName);
    // sanitizeHtml normalizes spacing inside style attributes, so compare with
    // whitespace stripped rather than hard-coding one version's formatting.
    expect(html.replace(/\s/g, '')).toContain('max-width:300px');
  });

  test('removes the cap and keeps full text when off', () => {
    const html = buildTooltip('off');
    expect(html).not.toContain('max-width');
    expect(html).toContain(longSeriesName);
  });

  test('drops the shared prefix when truncating from the start', () => {
    const html = buildTooltip('start');
    expect(html).not.toContain('prod-us-east');
    expect(html).toContain('latency-p99');
    expect(html.replace(/\s/g, '')).toContain('white-space:nowrap');
  });

  test('keeps both ends when truncating the middle', () => {
    const html = buildTooltip('middle');
    expect(html).toContain('prod-us-east-1-servi…heckout-latency-p99');
    expect(html).not.toContain(longSeriesName);
  });

  test('preserves the echarts marker in every mode', () => {
    (['off', 'end', 'start', 'middle'] as const).forEach(mode => {
      expect(buildTooltip(mode)).toContain('background-color:#1f77b4');
    });
  });

  test('truncates a long non-temporal x-axis title', () => {
    const longCategory = 'prod-us-east-1-service-checkout-cohort-2026';
    const html = buildTooltip('start', longCategory);
    expect(html).not.toContain(longCategory);
    expect(html).toContain('cohort-2026');
  });

  test('leaves a long title alone in the default mode', () => {
    const longCategory = 'prod-us-east-1-service-checkout-cohort-2026';
    expect(buildTooltip(undefined, longCategory)).toContain(longCategory);
  });
});

describe('weekly x-axis tick alignment', () => {
  // 13 Monday-aligned weekly buckets, the shape produced by a dataset that is
  // pre-aggregated to weeks.
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  const MONDAYS = Array.from(
    { length: 13 },
    (_, i) => Date.UTC(2026, 3, 6) + i * WEEK_MS,
  );

  const weeklyChartProps = (
    formDataOverrides: Partial<EchartsTimeseriesFormData> = {},
    annotationData?: AnnotationData,
  ) =>
    createTestChartProps({
      annotationData,
      formData: {
        granularity_sqla: 'ds',
        timeGrainSqla: TimeGranularity.WEEK_STARTING_MONDAY,
        xAxisTimeFormat: '%m-%d',
        ...formDataOverrides,
      },
      queriesData: [
        createTestQueryData(
          MONDAYS.map((__timestamp, i) => ({ __timestamp, sales: 100 + i })),
          {
            colnames: ['__timestamp', 'sales'],
            coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
            // transformProps reads annotations off the query, not chartProps.
            ...(annotationData && { annotation_data: annotationData }),
          },
        ),
      ],
    });

  test('pins ticks, labels and gridlines to the weekly buckets', () => {
    const { xAxis } = transformProps(weeklyChartProps()).echartOptions as any;

    expect(xAxis.type).toBe(AxisType.Time);
    expect(xAxis.axisLabel.customValues).toEqual(MONDAYS);
    // Gridlines follow axisTick.customValues, so splitLine needs no own copy.
    expect(xAxis.axisTick.customValues).toEqual(MONDAYS);
    expect(xAxis.splitLine).toBeUndefined();
  });

  const manyMondaysChartProps = (overrides: Record<string, unknown> = {}) => {
    const manyMondays = Array.from(
      { length: 261 },
      (_, i) => Date.UTC(2021, 0, 4) + i * WEEK_MS,
    );
    return {
      manyMondays,
      chartProps: createTestChartProps({
        formData: {
          granularity_sqla: 'ds',
          timeGrainSqla: TimeGranularity.WEEK_STARTING_MONDAY,
          xAxisTimeFormat: '%m-%d',
          ...overrides,
        },
        queriesData: [
          createTestQueryData(
            manyMondays.map((__timestamp, i) => ({
              __timestamp,
              sales: 100 + i,
            })),
            {
              colnames: ['__timestamp', 'sales'],
              coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
            },
          ),
        ],
      }),
    };
  };

  test('caps both axisTick and axisLabel customValues on a non-zoomable axis', () => {
    // customValues never recomputes, so on a non-zoomable axis (no dataZoom
    // to reach hidden buckets) axisLabel is capped to the same subset as
    // axisTick: a label surviving hideOverlap thinning then always lands on
    // a real tick and gridline rather than a capped-away bucket.
    const { manyMondays, chartProps } = manyMondaysChartProps();
    const { xAxis } = transformProps(chartProps).echartOptions as any;

    expect(xAxis.axisTick.customValues.length).toBeLessThan(manyMondays.length);
    expect(xAxis.axisLabel.customValues).toEqual(xAxis.axisTick.customValues);
  });

  test('keeps the full bucket set for axisLabel on a zoomable axis', () => {
    // A capped, uncapped label set would freeze the visible labels to the
    // pre-zoom subset since customValues never recomputes on dataZoom, so a
    // zoomable axis keeps the full set for axisLabel and lets hideOverlap
    // thin it dynamically; only axisTick (no such thinning) stays capped.
    const { manyMondays, chartProps } = manyMondaysChartProps({
      zoomable: true,
    });
    const { xAxis } = transformProps(chartProps).echartOptions as any;

    expect(xAxis.axisTick.customValues.length).toBeLessThan(manyMondays.length);
    expect(xAxis.axisLabel.customValues).toEqual(manyMondays);
  });

  test('keeps the showMaxLabel override at 0° rotation on pinned axes', () => {
    // hideOverlap stays on for pinned ticks (they label every bucket), but
    // showMaxLabel still shields the boundary label's immediate neighbour
    // so the last bucket isn't silently dropped (#39899).
    const { xAxis } = transformProps(weeklyChartProps()).echartOptions as any;

    expect(xAxis.axisLabel.showMaxLabel).toBe(true);
    expect(xAxis.axisLabel.hideOverlap).toBe(true);
  });

  test('pins ticks when the bucket column holds ISO date strings', () => {
    // A dataset can arrive with __timestamp serialized as an ISO string
    // rather than a Date/epoch-ms value.
    const chartProps = createTestChartProps({
      formData: {
        granularity_sqla: 'ds',
        timeGrainSqla: TimeGranularity.WEEK_STARTING_MONDAY,
      },
      queriesData: [
        createTestQueryData(
          MONDAYS.map((__timestamp, i) => ({
            __timestamp: new Date(__timestamp).toISOString(),
            sales: 100 + i,
          })),
          {
            colnames: ['__timestamp', 'sales'],
            coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
          },
        ),
      ],
    });
    const { xAxis } = transformProps(chartProps).echartOptions as any;

    expect(xAxis.axisLabel.customValues).toEqual(MONDAYS);
  });

  test('keeps label thinning on when the labels are rotated', () => {
    // Rotation normally turns hideOverlap off, but pinned ticks put a label on
    // every bucket, so without thinning a multi-year range draws hundreds.
    const { xAxis } = transformProps(
      weeklyChartProps({ xAxisLabelRotation: 45 }),
    ).echartOptions as any;

    expect(xAxis.axisLabel.customValues).toEqual(MONDAYS);
    expect(xAxis.axisLabel.hideOverlap).toBe(true);
  });

  test('leaves rotation thinning alone when the ticks are not pinned', () => {
    const { xAxis } = transformProps(
      weeklyChartProps({
        timeGrainSqla: TimeGranularity.MONTH,
        xAxisLabelRotation: 45,
      }),
    ).echartOptions as any;

    expect(xAxis.axisLabel.customValues).toBeUndefined();
    expect(xAxis.axisLabel.hideOverlap).toBe(false);
  });

  const timeseriesLayer = (show: boolean) =>
    ({
      name: 'my annotation',
      annotationType: AnnotationType.Timeseries,
      sourceType: AnnotationSourceType.Line,
      style: AnnotationStyle.Solid,
      show,
      value: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  // The annotation's own timestamps run a year past the last bucket.
  const annotationRecords = {
    'my annotation': {
      records: [
        { ds: MONDAYS[0], y: 1 },
        { ds: MONDAYS[12] + 52 * WEEK_MS, y: 2 },
      ],
    },
  };

  test('does not pin ticks when a timeseries annotation widens the axis', () => {
    // A Time axis takes no min/max, so it stretches to cover the annotation
    // while ECharts clips pinned ticks to the extent — that span would be bare.
    const { xAxis } = transformProps(
      weeklyChartProps(
        { annotationLayers: [timeseriesLayer(true)] },
        annotationRecords,
      ),
    ).echartOptions as any;

    expect(xAxis.axisLabel.customValues).toBeUndefined();
    expect(xAxis.axisTick?.customValues).toBeUndefined();
  });

  test('still pins ticks for a hidden timeseries annotation', () => {
    const { xAxis } = transformProps(
      weeklyChartProps(
        { annotationLayers: [timeseriesLayer(false)] },
        annotationRecords,
      ),
    ).echartOptions as any;

    expect(xAxis.axisLabel.customValues).toEqual(MONDAYS);
  });

  test.each([
    TimeGranularity.WEEK,
    TimeGranularity.WEEK_STARTING_SUNDAY,
    TimeGranularity.WEEK_STARTING_MONDAY,
    TimeGranularity.WEEK_ENDING_SATURDAY,
    TimeGranularity.WEEK_ENDING_SUNDAY,
  ])('applies to the %s grain', grain => {
    const { xAxis } = transformProps(weeklyChartProps({ timeGrainSqla: grain }))
      .echartOptions as any;

    expect(xAxis.axisLabel.customValues).toEqual(MONDAYS);
  });

  test('a dashboard time-grain override drives the alignment', () => {
    const { xAxis } = transformProps(
      weeklyChartProps({
        timeGrainSqla: TimeGranularity.DAY,
        extraFormData: { time_grain_sqla: TimeGranularity.WEEK },
      }),
    ).echartOptions as any;

    expect(xAxis.axisLabel.customValues).toEqual(MONDAYS);
  });

  test('deduplicates and sorts the bucket timestamps', () => {
    // A grouped query repeats each bucket once per series, and the rows are
    // not necessarily ordered.
    const chartProps = createTestChartProps({
      formData: {
        granularity_sqla: 'ds',
        timeGrainSqla: TimeGranularity.WEEK,
        groupby: ['region'],
      },
      queriesData: [
        createTestQueryData(
          [
            { __timestamp: MONDAYS[1], region: 'b', sales: 2 },
            { __timestamp: MONDAYS[0], region: 'a', sales: 1 },
            { __timestamp: MONDAYS[1], region: 'a', sales: 3 },
            { __timestamp: MONDAYS[0], region: 'b', sales: 4 },
          ],
          {
            colnames: ['__timestamp', 'region', 'sales'],
            coltypes: [
              GenericDataType.Temporal,
              GenericDataType.String,
              GenericDataType.Numeric,
            ],
          },
        ),
      ],
    });
    const { xAxis } = transformProps(chartProps).echartOptions as any;

    expect(xAxis.axisLabel.customValues).toEqual([MONDAYS[0], MONDAYS[1]]);
  });

  test('leaves grains ECharts places correctly untouched', () => {
    (
      [
        TimeGranularity.DAY,
        TimeGranularity.MONTH,
        TimeGranularity.QUARTER,
        TimeGranularity.YEAR,
        undefined,
      ] as const
    ).forEach(grain => {
      const { xAxis } = transformProps(
        weeklyChartProps({ timeGrainSqla: grain }),
      ).echartOptions as any;

      expect(xAxis.axisLabel.customValues).toBeUndefined();
      expect(xAxis.axisTick?.customValues).toBeUndefined();
    });
  });

  test('leaves a categorical x-axis untouched', () => {
    const { xAxis } = transformProps(
      weeklyChartProps({ xAxisForceCategorical: true }),
    ).echartOptions as any;

    expect(xAxis.type).toBe(AxisType.Category);
    expect(xAxis.axisLabel.customValues).toBeUndefined();
  });
});

describe('tooltip for metrics whose labels end in forecast suffixes', () => {
  const marker = '<span style="background-color:#1f77b4;"></span>';
  const seriesIds = ['ci__yhat', 'ci__yhat_lower', 'ci__yhat_upper'];
  const values = [1.5, 0.5, 2.0];

  // Metrics can be labelled `ci__yhat*` with no forecast enabled and no plain
  // observation series. Every series then collapses onto the same
  // forecast-stripped tooltip key, so no raw series id matches itself.
  const buildTooltip = (tooltipSortByMetric = false) => {
    const chartProps = createTestChartProps({
      formData: {
        x_axis: 'dt',
        metrics: seriesIds,
        groupby: [],
        richTooltip: true,
        tooltipSortByMetric,
      } as Partial<EchartsTimeseriesFormData>,
      queriesData: [
        createTestQueryData([
          {
            dt: 599616000000,
            ci__yhat: 1.5,
            ci__yhat_lower: 0.5,
            ci__yhat_upper: 2.5,
          },
        ]),
      ],
    });
    const tooltipFormatter = (transformProps(chartProps).echartOptions as any)
      .tooltip.formatter;
    return tooltipFormatter(
      seriesIds.map((id, i) => ({
        seriesId: id,
        seriesName: id,
        value: [599616000000, values[i]],
        data: [599616000000, values[i]],
        marker,
      })),
    );
  };

  test('renders the collapsed series rather than falling back to "No data"', () => {
    const html = buildTooltip();
    expect(html).not.toContain('No data');
    expect(html).toContain('>ci<');
    expect(html).toContain('ŷ = 1.5 (0.5, 2.5)');
  });

  test('renders a single row rather than one per forecast suffix', () => {
    const html = buildTooltip();
    expect(html.match(/<tr/g)).toHaveLength(1);
    expect(html).toContain('>ci<');
  });

  test('still renders the row when the tooltip is sorted by metric', () => {
    const html = buildTooltip(true);
    expect(html).not.toContain('No data');
    expect(html).toContain('>ci<');
  });
});

test('shows gridlines and axis ticks by default', () => {
  const { echartOptions } = transformProps(createTestChartProps({}));
  const xAxis = echartOptions.xAxis as any;
  const yAxis = echartOptions.yAxis as any;

  expect(yAxis.splitLine.show).toBe(true);
  expect(yAxis.axisTick.show).toBe(true);
  // Left to ECharts, which draws no ticks on a banded category axis. Forcing
  // true would add ticks the chart does not have today.
  expect(xAxis.axisTick.show).toBe('auto');
});

test('hides gridlines without touching the minor split lines', () => {
  const { echartOptions } = transformProps(
    createTestChartProps({ formData: { gridlines: false } }),
  );
  const yAxis = echartOptions.yAxis as any;

  expect(yAxis.splitLine.show).toBe(false);
  expect(yAxis.minorSplitLine.show).toBe(DEFAULT_FORM_DATA.minorSplitLine);
  expect(yAxis.axisTick.show).toBe(true);
});

test('leaves the category axis split lines alone until gridlines are turned off', () => {
  const shown = transformProps(createTestChartProps({}));
  // Writing show:true here would draw gridlines on axis types that default to
  // none, so the key is only ever added to hide them.
  expect((shown.echartOptions.xAxis as any).splitLine).toBeUndefined();

  const hidden = transformProps(
    createTestChartProps({ formData: { gridlines: false } }),
  );
  expect((hidden.echartOptions.xAxis as any).splitLine.show).toBe(false);
});

test('hides the ticks on both axes', () => {
  const { echartOptions } = transformProps(
    createTestChartProps({ formData: { axisTicks: false } }),
  );

  expect((echartOptions.yAxis as any).axisTick.show).toBe(false);
  expect((echartOptions.xAxis as any).axisTick.show).toBe(false);
  expect((echartOptions.yAxis as any).splitLine.show).toBe(true);
});

test('keeps gridlines and ticks off on a compact chart even when both are enabled', () => {
  const { echartOptions } = transformProps(
    createTestChartProps({
      height: TIMESERIES_CONSTANTS.compactChartHeight - 1,
      formData: { gridlines: true, axisTicks: true },
    }),
  );
  const yAxis = echartOptions.yAxis as any;

  expect(yAxis.splitLine.show).toBe(false);
  expect(yAxis.axisTick.show).toBe(false);
});

test('applies gridlines to the value axis after a horizontal orientation swaps it', () => {
  const { echartOptions } = transformProps(
    createTestChartProps({
      formData: {
        orientation: OrientationType.Horizontal,
        gridlines: false,
      },
    }),
  );

  // The transform swaps the axes for a horizontal chart, so the value axis —
  // and the gridlines belonging to it — end up on xAxis.
  expect((echartOptions.xAxis as any).splitLine.show).toBe(false);
});

test('#39899 - horizontal orientation does not over-thin the time axis labels', () => {
  // The spacing formatter estimates label collisions using horizontal plot
  // geometry (width, 7px/char). A horizontal chart swaps the time axis onto
  // the side of the chart, where that geometry no longer applies, so the
  // spacing formatter must not be used there.
  const monthData = Array.from({ length: 24 }, (_, i) => ({
    __timestamp: Date.UTC(2020, i, 1),
    sales: i,
  }));
  const { echartOptions } = transformProps(
    createTestChartProps({
      formData: {
        granularity_sqla: 'ds',
        timeGrainSqla: TimeGranularity.MONTH,
        xAxisTimeFormat: '%Y-%m',
        seriesType: EchartsTimeseriesSeriesType.Bar,
        orientation: OrientationType.Horizontal,
      },
      width: 800,
      queriesData: [
        createTestQueryData(monthData, {
          colnames: ['__timestamp', 'sales'],
          coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
        }),
      ],
    }),
  );
  // Horizontal swaps the axes, so the time axis ends up as yAxis.
  const { axisLabel } = echartOptions.yAxis as Record<string, any>;
  const labels = monthData.map(({ __timestamp }) =>
    axisLabel.formatter(__timestamp),
  );

  // Every month is a distinct label, so none should be blanked by the
  // spacing/dedup formatter on a horizontal chart.
  expect(labels.filter(label => label === '')).toHaveLength(0);
});

test('boundary label alignment is dropped when the orientation moves the time axis to the side', () => {
  // The alignments position labels against the left and right edges of a
  // bottom axis. A horizontal chart swaps the axes, so applying them there
  // shifts the first label out of line with the rest (#43428 follow-up).
  const monthData = [
    { __timestamp: Date.UTC(2003, 4, 1), sales: 100 },
    { __timestamp: Date.UTC(2003, 5, 1), sales: 200 },
  ];
  const build = (orientation: OrientationType) =>
    transformProps(
      createTestChartProps({
        formData: {
          granularity_sqla: 'ds',
          timeGrainSqla: TimeGranularity.MONTH,
          xAxisTimeFormat: 'smart_date',
          seriesType: EchartsTimeseriesSeriesType.Bar,
          orientation,
        },
        queriesData: [
          createTestQueryData(monthData, {
            colnames: ['__timestamp', 'sales'],
            coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
          }),
        ],
      }),
    ).echartOptions;

  const vertical = build(OrientationType.Vertical).xAxis as any;
  expect(vertical.axisLabel.alignMinLabel).toBe('left');
  expect(vertical.axisLabel.alignMaxLabel).toBe('right');

  // Horizontal swaps the axes, so the time axis is now yAxis.
  const horizontal = build(OrientationType.Horizontal).yAxis as any;
  expect(horizontal.axisLabel.alignMinLabel).toBeUndefined();
  expect(horizontal.axisLabel.alignMaxLabel).toBeUndefined();

  // The boundary labels themselves stay forced in both orientations.
  expect(vertical.axisLabel.showMinLabel).toBe(true);
  expect(vertical.axisLabel.showMaxLabel).toBe(true);
  expect(horizontal.axisLabel.showMinLabel).toBe(true);
  expect(horizontal.axisLabel.showMaxLabel).toBe(true);
});
