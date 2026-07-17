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
  AnnotationStyle,
  AnnotationType,
  AnnotationSourceType,
  AxisType,
  DataRecord,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  VizType,
  ChartDataResponseResult,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  LegendOrientation,
  LegendType,
  EchartsTimeseriesSeriesType,
} from '../../src';
import transformProps from '../../src/MixedTimeseries/transformProps';
import {
  DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesProps,
} from '../../src/MixedTimeseries/types';
import { createEchartsTimeseriesTestChartProps } from '../helpers';
import type { SeriesOption } from 'echarts';

type LabelFormatterParams = {
  value: [number, number];
  dataIndex: number;
  seriesIndex: number;
  seriesName: string;
};

type SeriesWithLabelFormatter = SeriesOption & {
  label?: {
    formatter?: (params: LabelFormatterParams) => string | number;
  };
};

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

/** Defaults for createEchartsTimeseriesTestChartProps in Mixed Timeseries tests. */
const MIXED_TIMESERIES_CHART_PROPS_DEFAULTS = {
  defaultFormData: DEFAULT_FORM_DATA,
  defaultVizType: 'mixed_timeseries' as const,
};

const formData: EchartsMixedTimeseriesFormData = {
  annotationLayers: [],
  area: false,
  areaB: false,
  legendMargin: null,
  logAxis: false,
  logAxisSecondary: false,
  markerEnabled: false,
  markerEnabledB: false,
  markerSize: 0,
  markerSizeB: 0,
  minorSplitLine: false,
  minorTicks: false,
  opacity: 0,
  opacityB: 0,
  orderDesc: false,
  orderDescB: false,
  richTooltip: false,
  rowLimit: 0,
  rowLimitB: 0,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: false,
  showValue: false,
  showValueB: false,
  stack: true,
  stackB: true,
  truncateYAxis: false,
  truncateYAxisSecondary: false,
  xAxisLabelRotation: 0,
  xAxisTitle: '',
  xAxisTitleMargin: 40,
  yAxisBounds: [undefined, undefined],
  yAxisBoundsSecondary: [undefined, undefined],
  yAxisTitle: '',
  yAxisTitleMargin: 50,
  yAxisTitlePosition: '',
  yAxisTitleSecondary: '',
  zoomable: false,
  colorScheme: 'bnbColors',
  datasource: '3__table',
  x_axis: 'ds',
  metrics: ['sum__num'],
  metricsB: ['sum__num'],
  groupby: ['gender'],
  groupbyB: ['gender'],
  seriesType: EchartsTimeseriesSeriesType.Line,
  seriesTypeB: EchartsTimeseriesSeriesType.Bar,
  viz_type: VizType.MixedTimeseries,
  forecastEnabled: false,
  forecastPeriods: [],
  forecastInterval: 0,
  forecastSeasonalityDaily: 0,
  legendSort: null,
};

const defaultQueryRows = [
  { boy: 1, girl: 2, ds: 599616000000 },
  { boy: 3, girl: 4, ds: 599916000000 },
];
const defaultLabelMap = { ds: ['ds'], boy: ['boy'], girl: ['girl'] };

const queriesData: ChartDataResponseResult[] = [
  createTestQueryData(defaultQueryRows, { label_map: defaultLabelMap }),
  createTestQueryData(defaultQueryRows, { label_map: defaultLabelMap }),
];

function getSeriesWithLabelFormatter(
  series: SeriesOption[],
  name: string,
): SeriesWithLabelFormatter {
  const result = series.find(seriesOption => seriesOption.name === name);
  expect(result).toBeDefined();
  expect((result as SeriesWithLabelFormatter).label?.formatter).toBeDefined();
  return result as SeriesWithLabelFormatter;
}

function formatSeriesLabel(
  series: SeriesWithLabelFormatter,
  value: [number, number],
) {
  const formatter = series.label?.formatter;
  expect(formatter).toBeDefined();
  return formatter?.({
    dataIndex: 0,
    seriesIndex: 0,
    seriesName: String(series.name),
    value,
  });
}

test('should transform chart props for viz with showQueryIdentifiers=false', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: { ...formData, showQueryIdentifiers: false },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  // Check that series IDs don't include query identifiers
  const seriesIds = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.id,
  );
  expect(seriesIds).toContain('sum__num, girl');
  expect(seriesIds).toContain('sum__num, boy');
  expect(seriesIds).not.toContain('sum__num (Query A), girl');
  expect(seriesIds).not.toContain('sum__num (Query A), boy');
  expect(seriesIds).not.toContain('sum__num (Query B), girl');
  expect(seriesIds).not.toContain('sum__num (Query B), boy');

  // Check that series name include query identifiers
  const seriesName = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.name,
  );
  expect(seriesName).toContain('sum__num, girl');
  expect(seriesName).toContain('sum__num, boy');
  expect(seriesName).not.toContain('sum__num (Query A), girl');
  expect(seriesName).not.toContain('sum__num (Query A), boy');
  expect(seriesName).not.toContain('sum__num (Query B), girl');
  expect(seriesName).not.toContain('sum__num (Query B), boy');

  expect((transformed.echartOptions.legend as any).data).toEqual([
    'sum__num, girl',
    'sum__num, boy',
    'sum__num, girl',
    'sum__num, boy',
  ]);
});

test('should transform chart props for viz with showQueryIdentifiers=true', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: { ...formData, showQueryIdentifiers: true },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  // Check that series IDs include query identifiers
  const seriesIds = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.id,
  );
  expect(seriesIds).toContain('sum__num (Query A), girl');
  expect(seriesIds).toContain('sum__num (Query A), boy');
  expect(seriesIds).toContain('sum__num (Query B), girl');
  expect(seriesIds).toContain('sum__num (Query B), boy');
  expect(seriesIds).not.toContain('sum__num, girl');
  expect(seriesIds).not.toContain('sum__num, boy');

  // Check that series name include query identifiers
  const seriesName = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.name,
  );
  expect(seriesName).toContain('sum__num (Query A), girl');
  expect(seriesName).toContain('sum__num (Query A), boy');
  expect(seriesName).toContain('sum__num (Query B), girl');
  expect(seriesName).toContain('sum__num (Query B), boy');
  expect(seriesName).not.toContain('sum__num, girl');
  expect(seriesName).not.toContain('sum__num, boy');

  expect((transformed.echartOptions.legend as any).data).toEqual([
    'sum__num (Query A), girl',
    'sum__num (Query A), boy',
    'sum__num (Query B), girl',
    'sum__num (Query B), boy',
  ]);
});

test('formats value labels with the formatter for the assigned y-axis', () => {
  const timestamp = 1704067200000;
  const queryAData = createTestQueryData(
    [{ __timestamp: timestamp, lineMetric: 0.25 }],
    {
      colnames: ['__timestamp', 'lineMetric'],
      coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      label_map: { lineMetric: ['lineMetric'] },
    },
  );
  const queryBData = createTestQueryData(
    [{ __timestamp: timestamp, barMetric: 0.5 }],
    {
      colnames: ['__timestamp', 'barMetric'],
      coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      label_map: { 'barMetric (1)': ['barMetric'] },
    },
  );
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [queryAData, queryBData],
    formData: {
      ...formData,
      groupby: [],
      groupbyB: [],
      metrics: ['lineMetric'],
      metricsB: ['barMetric'],
      showValue: true,
      showValueB: true,
      stack: null,
      stackB: null,
      x_axis: '__timestamp',
      yAxisFormat: '.0%',
      yAxisFormatSecondary: ',.1f',
      yAxisIndex: 1,
      yAxisIndexB: 0,
    },
    queriesData: [queryAData, queryBData],
  });

  const { echartOptions } = transformProps(chartProps);
  const series = echartOptions.series as SeriesOption[];
  const lineSeries = getSeriesWithLabelFormatter(series, 'lineMetric');
  const barSeries = getSeriesWithLabelFormatter(series, 'barMetric');

  expect(formatSeriesLabel(lineSeries, [timestamp, 0.25])).toBe('0.3');
  expect(formatSeriesLabel(barSeries, [timestamp, 0.5])).toBe('50%');
});

test('formats value labels correctly when y-axis assignments are reversed', () => {
  const timestamp = 1704067200000;
  const queryAData = createTestQueryData(
    [{ __timestamp: timestamp, lineMetric: 0.25 }],
    {
      colnames: ['__timestamp', 'lineMetric'],
      coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      label_map: { lineMetric: ['lineMetric'] },
    },
  );
  const queryBData = createTestQueryData(
    [{ __timestamp: timestamp, barMetric: 0.5 }],
    {
      colnames: ['__timestamp', 'barMetric'],
      coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      label_map: { 'barMetric (1)': ['barMetric'] },
    },
  );
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [queryAData, queryBData],
    formData: {
      ...formData,
      groupby: [],
      groupbyB: [],
      metrics: ['lineMetric'],
      metricsB: ['barMetric'],
      showValue: true,
      showValueB: true,
      stack: null,
      stackB: null,
      x_axis: '__timestamp',
      yAxisFormat: '.0%',
      yAxisFormatSecondary: ',.1f',
      yAxisIndex: 0,
      yAxisIndexB: 1,
    },
    queriesData: [queryAData, queryBData],
  });

  const { echartOptions } = transformProps(chartProps);
  const series = echartOptions.series as SeriesOption[];
  const lineSeries = getSeriesWithLabelFormatter(series, 'lineMetric');
  const barSeries = getSeriesWithLabelFormatter(series, 'barMetric');

  expect(formatSeriesLabel(lineSeries, [timestamp, 0.25])).toBe('25%');
  expect(formatSeriesLabel(barSeries, [timestamp, 0.5])).toBe('0.5');
});

test('keeps bar value label clipping aligned with the assigned y-axis', () => {
  const timestamp = 1704067200000;
  const queryAData = createTestQueryData(
    [{ __timestamp: timestamp, lineMetric: 0.25 }],
    {
      colnames: ['__timestamp', 'lineMetric'],
      coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      label_map: { lineMetric: ['lineMetric'] },
    },
  );
  const queryBData = createTestQueryData(
    [{ __timestamp: timestamp, barMetric: 0.5 }],
    {
      colnames: ['__timestamp', 'barMetric'],
      coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      label_map: { 'barMetric (1)': ['barMetric'] },
    },
  );
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [queryAData, queryBData],
    formData: {
      ...formData,
      groupby: [],
      groupbyB: [],
      metrics: ['lineMetric'],
      metricsB: ['barMetric'],
      showValue: true,
      showValueB: true,
      stack: null,
      stackB: null,
      x_axis: '__timestamp',
      yAxisBounds: [undefined, 1],
      yAxisBoundsSecondary: [undefined, 0.1],
      yAxisFormat: '.0%',
      yAxisFormatSecondary: ',.1f',
      yAxisIndex: 0,
      yAxisIndexB: 1,
    },
    queriesData: [queryAData, queryBData],
  });

  const { echartOptions } = transformProps(chartProps);
  const series = echartOptions.series as SeriesOption[];
  const barSeries = getSeriesWithLabelFormatter(series, 'barMetric');

  expect(formatSeriesLabel(barSeries, [timestamp, 0.5])).toBe('');
});

describe('legend sorting', () => {
  const getChartProps = (overrides = {}) =>
    createEchartsTimeseriesTestChartProps<
      EchartsMixedTimeseriesFormData,
      EchartsMixedTimeseriesProps
    >({
      ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
      defaultQueriesData: queriesData,
      formData: {
        ...formData,
        ...overrides,
        showQueryIdentifiers: true,
      },
      queriesData,
    });

  test('sort legend by data', () => {
    const chartProps = getChartProps({
      legendSort: null,
    });
    const transformed = transformProps(chartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'sum__num (Query A), girl',
      'sum__num (Query A), boy',
      'sum__num (Query B), girl',
      'sum__num (Query B), boy',
    ]);
  });

  test('sort legend by label ascending', () => {
    const chartProps = getChartProps({
      legendSort: 'asc',
    });
    const transformed = transformProps(chartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'sum__num (Query A), boy',
      'sum__num (Query A), girl',
      'sum__num (Query B), boy',
      'sum__num (Query B), girl',
    ]);
  });

  test('sort legend by label descending', () => {
    const chartProps = getChartProps({
      legendSort: 'desc',
    });
    const transformed = transformProps(chartProps);

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'sum__num (Query B), girl',
      'sum__num (Query B), boy',
      'sum__num (Query A), girl',
      'sum__num (Query A), boy',
    ]);
  });
});

test('legend margin: top orientation sets grid.top correctly', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: {
      ...formData,
      legendMargin: 250,
      showLegend: true,
    },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  expect((transformed.echartOptions.grid as any).top).toEqual(270);
});

test('legend margin: bottom orientation sets grid.bottom correctly', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: {
      ...formData,
      legendMargin: 250,
      showLegend: true,
      legendOrientation: LegendOrientation.Bottom,
    },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  expect((transformed.echartOptions.grid as any).bottom).toEqual(270);
});

test('legend margin: left orientation sets grid.left correctly', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: {
      ...formData,
      legendMargin: 250,
      showLegend: true,
      legendOrientation: LegendOrientation.Left,
    },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  expect((transformed.echartOptions.grid as any).left).toEqual(270);
});

test('legend margin: right orientation sets grid.right correctly', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: {
      ...formData,
      legendMargin: 270,
      showLegend: true,
      legendOrientation: LegendOrientation.Right,
    },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  expect((transformed.echartOptions.grid as any).right).toEqual(270);
});

test('should exclude unnamed annotation helper series from legend data', () => {
  const interval: IntervalAnnotationLayer = {
    annotationType: AnnotationType.Interval,
    name: 'My Interval',
    show: true,
    showLabel: true,
    sourceType: AnnotationSourceType.Table,
    titleColumn: '',
    timeColumn: 'start',
    intervalEndColumn: 'end',
    descriptionColumns: [],
    style: AnnotationStyle.Dashed,
    value: 2,
  };

  const annotationData = {
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
  };

  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [],
    formData: {
      ...formData,
      annotationLayers: [interval],
      showLegend: true,
      showQueryIdentifiers: true,
    },
    queriesData: [
      createTestQueryData(defaultQueryRows, {
        label_map: defaultLabelMap,
        annotation_data: annotationData,
      }),
      createTestQueryData(defaultQueryRows, {
        label_map: defaultLabelMap,
        annotation_data: annotationData,
      }),
    ],
  });
  const transformed = transformProps(chartProps);

  expect((transformed.echartOptions.legend as any).data).toEqual([
    'sum__num (Query A), girl',
    'sum__num (Query A), boy',
    'sum__num (Query B), girl',
    'sum__num (Query B), boy',
  ]);
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
      [timeColumnLabel]: 599616000000,
      boy: 1,
      girl: 2,
    },
    {
      [timeColumnLabel]: 599916000000,
      boy: 3,
      girl: 4,
    },
  ];
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [],
    formData: {
      ...formData,
      x_axis: timeColumnName,
      annotationLayers: [formula],
    },
    queriesData: [
      createTestQueryData(testData, {
        label_map: {
          [timeColumnName]: [timeColumnLabel],
          boy: ['boy'],
          girl: ['girl'],
        },
      }),
      createTestQueryData(testData, {
        label_map: {
          [timeColumnName]: [timeColumnLabel],
          boy: ['boy'],
          girl: ['girl'],
        },
      }),
    ],
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
  expect((formulaSeries!.data as unknown[]).length).toBeGreaterThan(0);
});

test('numeric x coltype never gets silently coerced to the Time axis', () => {
  // Regression guard for echarts-timeseries-epoch-x-axis-labels investigation.
  // Mixed Timeseries must follow the reported coltype: Numeric values stay
  // off the Time axis and are not silently reinterpreted as Date instances.
  // A future change that coerces Numeric → Time would bring back the "NaN"
  // label symptom we were investigating. We also assert that whichever
  // formatter is picked, it produces a string and does not emit "NaN".
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const epochRows = [
    { __timestamp: ts1, metric: 10 },
    { __timestamp: ts2, metric: 20 },
  ];
  const epochQueryData = createTestQueryData(epochRows, {
    colnames: ['__timestamp', 'metric'],
    coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
    label_map: { __timestamp: ['__timestamp'], metric: ['metric'] },
  });

  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [epochQueryData, epochQueryData],
    formData: {
      ...formData,
      x_axis: '__timestamp',
      metrics: ['metric'],
      metricsB: ['metric'],
      groupby: [],
      groupbyB: [],
    },
    queriesData: [epochQueryData, epochQueryData],
  });

  const { echartOptions } = transformProps(chartProps);
  const xAxis = echartOptions.xAxis as {
    type: string;
    axisLabel: { formatter: (v: number) => string };
  };

  expect(xAxis.type).not.toBe(AxisType.Time);
  const label = xAxis.axisLabel.formatter(ts1);
  expect(typeof label).toBe('string');
  expect(label).not.toMatch(/NaN/);
});

test('xAxisForceCategorical forces Category axis regardless of Numeric coltype', () => {
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const epochRows = [
    { __timestamp: ts1, metric: 10 },
    { __timestamp: ts2, metric: 20 },
  ];
  const epochQueryData = createTestQueryData(epochRows, {
    colnames: ['__timestamp', 'metric'],
    coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
    label_map: { __timestamp: ['__timestamp'], metric: ['metric'] },
  });

  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [epochQueryData, epochQueryData],
    formData: {
      ...formData,
      x_axis: '__timestamp',
      metrics: ['metric'],
      metricsB: ['metric'],
      groupby: [],
      groupbyB: [],
      xAxisForceCategorical: true,
    },
    queriesData: [epochQueryData, epochQueryData],
  });

  const { echartOptions } = transformProps(chartProps);
  const xAxis = echartOptions.xAxis as { type: string };

  expect(xAxis.type).toBe(AxisType.Category);
});

// labelMap/labelMapB must be keyed by the rendered series names or the
// cross-filter/drill lookups in EchartsMixedTimeseries miss (#41622);
// see the re-key comment in transformProps.ts.
test('cross-filter label maps are keyed by the rendered series names', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: { ...formData, showQueryIdentifiers: false },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  // The backend label_map is keyed by the flattened column names
  // ("boy"/"girl") while the rendered series are "sum__num, boy" etc.
  expect(transformed.labelMap).toEqual({
    'sum__num, boy': ['boy'],
    'sum__num, girl': ['girl'],
  });
  expect(transformed.labelMapB).toEqual({
    'sum__num, boy': ['boy'],
    'sum__num, girl': ['girl'],
  });
});

test('cross-filter label maps resolve every rendered series name', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: queriesData,
    formData: { ...formData, showQueryIdentifiers: true },
    queriesData,
  });
  const transformed = transformProps(chartProps);

  const names = (transformed.echartOptions.series as SeriesOption[]).map(
    series => String(series.name),
  );
  expect(names).toHaveLength(4);
  names
    .slice(0, transformed.seriesBreakdown)
    .forEach(name => expect(transformed.labelMap[name]).toBeDefined());
  names
    .slice(transformed.seriesBreakdown)
    .forEach(name => expect(transformed.labelMapB[name]).toBeDefined());
});

test('cross-filter label maps resolve verbose series names to raw label_map values', () => {
  const verboseRows = [
    { ds: 599616000000, sum__num: 1 },
    { ds: 599916000000, sum__num: 3 },
  ];
  const verboseQueryData = createTestQueryData(verboseRows, {
    label_map: { ds: ['ds'], sum__num: ['sum__num'] },
  });
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [verboseQueryData, verboseQueryData],
    formData: { ...formData, groupby: [], groupbyB: [] },
    queriesData: [verboseQueryData, verboseQueryData],
    datasource: {
      verboseMap: { sum__num: 'Total Births' },
    },
  });
  const transformed = transformProps(chartProps);

  // rebaseForecastDatum renames data columns to their verbose names, so the
  // rendered series is "Total Births" while label_map stays keyed by
  // "sum__num" — the display-keyed map bridges the two.
  expect(transformed.labelMap['Total Births']).toEqual(['sum__num']);
  expect(transformed.labelMapB['Total Births']).toEqual(['sum__num']);
});

test('tooltip resolves per-metric formats through the display-keyed label map', () => {
  // Multi-metric so getCustomFormatter cannot short-circuit on a single
  // saved metric: the formatter key must come from resolving the rendered
  // series name through the display-keyed map.
  const rows = [{ ds: 599616000000, 'sum__num, boy': 0.5, 'avg__num, boy': 1 }];
  const queryData = createTestQueryData(rows, {
    colnames: ['ds', 'sum__num, boy', 'avg__num, boy'],
    coltypes: [
      GenericDataType.Temporal,
      GenericDataType.Numeric,
      GenericDataType.Numeric,
    ],
    label_map: {
      ds: ['ds'],
      'sum__num, boy': ['sum__num', 'boy'],
      'avg__num, boy': ['avg__num', 'boy'],
    },
  });
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [queryData, queryData],
    formData: {
      ...formData,
      metrics: ['sum__num', 'avg__num'],
      x_axis: 'ds',
      yAxisFormat: undefined,
    },
    queriesData: [queryData, queryData],
    datasource: {
      columnFormats: { sum__num: '.2%' },
    },
  });
  const transformed = transformProps(chartProps);

  const formatter = (transformed.echartOptions.tooltip as any).formatter as (
    params: unknown,
  ) => string;
  const html = formatter({
    value: [599616000000, 0.5],
    seriesId: 'sum__num, boy',
    marker: '',
    color: '#333',
  });

  expect(html).toContain('50.00%');
});

test('tooltip resolves per-metric formats for secondary-query series', () => {
  const rowsA = [
    { ds: 599616000000, 'sum__num, boy': 0.5, 'avg__num, boy': 1 },
  ];
  const queryDataA = createTestQueryData(rowsA, {
    colnames: ['ds', 'sum__num, boy', 'avg__num, boy'],
    coltypes: [
      GenericDataType.Temporal,
      GenericDataType.Numeric,
      GenericDataType.Numeric,
    ],
    label_map: {
      ds: ['ds'],
      'sum__num, boy': ['sum__num', 'boy'],
      'avg__num, boy': ['avg__num', 'boy'],
    },
  });
  const rowsB = [{ ds: 599616000000, 'count__num, boy': 2.5 }];
  const queryDataB = createTestQueryData(rowsB, {
    colnames: ['ds', 'count__num, boy'],
    coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
    label_map: {
      ds: ['ds'],
      'count__num, boy': ['count__num', 'boy'],
    },
  });
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [queryDataA, queryDataB],
    formData: {
      ...formData,
      metrics: ['sum__num', 'avg__num'],
      metricsB: ['count__num', 'max__num'],
      x_axis: 'ds',
      yAxisFormat: undefined,
      yAxisFormatSecondary: undefined,
      yAxisIndex: 0,
      yAxisIndexB: 1,
    },
    queriesData: [queryDataA, queryDataB],
    datasource: {
      columnFormats: { count__num: '.1f' },
    },
  });
  const transformed = transformProps(chartProps);

  const formatter = (transformed.echartOptions.tooltip as any).formatter as (
    params: unknown,
  ) => string;
  const html = formatter({
    value: [599616000000, 2.5],
    seriesId: 'count__num, boy',
    marker: '',
    color: '#333',
  });

  expect(html).toContain('2.5');
});

test('temporal x coltype wires the time formatter and Time axis', () => {
  // Regression guard: the happy path for mixed-timeseries charts. Ensures
  // Temporal coltype still routes through the TimeFormatter so the time axis
  // rendering path is exercised by the test suite.
  const ts1 = 1745784000000;
  const ts2 = 1745870400000;
  const temporalRows = [
    { __timestamp: ts1, metric: 10 },
    { __timestamp: ts2, metric: 20 },
  ];
  const temporalQueryData = createTestQueryData(temporalRows, {
    colnames: ['__timestamp', 'metric'],
    coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
    label_map: { __timestamp: ['__timestamp'], metric: ['metric'] },
  });

  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    defaultQueriesData: [temporalQueryData, temporalQueryData],
    formData: {
      ...formData,
      x_axis: '__timestamp',
      metrics: ['metric'],
      metricsB: ['metric'],
      groupby: [],
      groupbyB: [],
    },
    queriesData: [temporalQueryData, temporalQueryData],
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
});
