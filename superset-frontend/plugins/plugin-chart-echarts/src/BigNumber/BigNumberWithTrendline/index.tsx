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

/**
 * BigNumber with Trendline - Glyph Pattern Implementation
 *
 * This is the Glyph pattern version of BigNumberWithTrendline.
 * Complex charts like this one use custom buildQuery and transform functions
 * to handle the data processing, while still benefiting from the
 * declarative argument-based control panel generation.
 */

import { t } from '@apache-superset/core/translation';
import {
  Behavior,
  buildQueryContext,
  ensureIsArray,
  extractTimegrain,
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  getXAxisColumn,
  getXAxisLabel,
  isXAxisSet,
  Metric as SupersetMetric,
  NumberFormats,
  QueryFormData,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { EChartsCoreOption, graphic } from 'echarts/core';
import {
  aggregationControl,
  aggregationOperator,
  aggregationChoices,
  flattenOperator,
  pivotOperator,
  resampleOperator,
  rollingWindowOperator,
  temporalColumnMixin,
} from '@superset-ui/chart-controls';

import {
  defineChart,
  Metric,
  Temporal,
  Select,
  Text,
  Checkbox,
  Color,
  NumberFormat,
  Currency,
  TimeFormat,
  HeaderFontSize,
  SubheaderFontSize,
  Subtitle,
  ForceTimestampFormatting,
  ShowMetricName,
  MetricNameFontSize,
  ChartProps,
} from '@superset-ui/glyph-core';

import { TIMESERIES_CONSTANTS } from '../../constants';
import { getXAxisFormatter } from '../../utils/formatters';
import { getDefaultTooltip } from '../../utils/tooltip';
import { getDateFormatter, parseMetricValue, getOriginalLabel } from '../utils';
import BigNumberViz from '../BigNumberViz';
import { BigNumberDatum, TimeSeriesDatum, BigNumberVizProps } from '../types';
import { Refs } from '../../types';

import example from './images/Big_Number_Trendline.jpg';
import exampleDark from './images/Big_Number_Trendline-dark.jpg';
import thumbnail from './images/thumbnail.png';

// ============================================================================
// Build Query - Exported for testing
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const isRawMetric = formData.aggregation === 'raw';

  const timeColumn = isXAxisSet(formData)
    ? ensureIsArray(getXAxisColumn(formData))
    : [];

  return buildQueryContext(formData, baseQueryObject => {
    const queries = [
      {
        ...baseQueryObject,
        columns: [...timeColumn],
        ...(timeColumn.length ? {} : { is_timeseries: true }),
        post_processing: [
          pivotOperator(formData, baseQueryObject),
          rollingWindowOperator(formData, baseQueryObject),
          resampleOperator(formData, baseQueryObject),
          flattenOperator(formData, baseQueryObject),
        ].filter(Boolean),
      },
    ];

    if (formData.aggregation === 'raw') {
      queries.push({
        ...baseQueryObject,
        columns: [...(isRawMetric ? [] : timeColumn)],
        is_timeseries: !isRawMetric,
        post_processing: isRawMetric
          ? []
          : ([
              pivotOperator(formData, baseQueryObject),
              aggregationOperator(formData, baseQueryObject),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ].filter(Boolean) as any[]),
      });
    }

    return queries;
  });
}

// ============================================================================
// Helpers
// ============================================================================

const formatPercentChange = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

function computeClientSideAggregation(
  data: [number | null, number | null][],
  aggregation: string | undefined | null,
): number | null {
  if (!data.length) return null;

  const methodKey = Object.keys(aggregationChoices).find(
    key => key.toLowerCase() === (aggregation || '').toLowerCase(),
  );

  const selectedMethod = methodKey
    ? aggregationChoices[methodKey as keyof typeof aggregationChoices]
    : aggregationChoices.LAST_VALUE;

  const values = data
    .map(([, value]) => value)
    .filter((v): v is number => v !== null);

  return selectedMethod.compute(values);
}

// ============================================================================
// Rolling Window Options
// ============================================================================

const ROLLING_TYPE_OPTIONS = [
  { label: t('None'), value: 'None' },
  { label: t('mean'), value: 'mean' },
  { label: t('sum'), value: 'sum' },
  { label: t('std'), value: 'std' },
  { label: t('cumsum'), value: 'cumsum' },
];

const RESAMPLE_RULE_OPTIONS = [
  { label: t('1 minutely frequency'), value: '1T' },
  { label: t('1 hourly frequency'), value: '1H' },
  { label: t('1 calendar day frequency'), value: '1D' },
  { label: t('7 calendar day frequency'), value: '7D' },
  { label: t('1 month start frequency'), value: '1MS' },
  { label: t('1 month end frequency'), value: '1M' },
  { label: t('1 year start frequency'), value: '1AS' },
  { label: t('1 year end frequency'), value: '1A' },
];

const RESAMPLE_METHOD_OPTIONS = [
  { label: t('Null imputation'), value: 'asfreq' },
  { label: t('Zero imputation'), value: 'zerofill' },
  { label: t('Linear interpolation'), value: 'linear' },
  { label: t('Forward values'), value: 'ffill' },
  { label: t('Backward values'), value: 'bfill' },
  { label: t('Median values'), value: 'median' },
  { label: t('Mean values'), value: 'mean' },
  { label: t('Sum values'), value: 'sum' },
];

// ============================================================================
// Transform Props Type
// ============================================================================

interface TrendlineTransformResult {
  vizProps: BigNumberVizProps;
}

// ============================================================================
// The Chart Definition
// ============================================================================

export default defineChart<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  TrendlineTransformResult
>({
  metadata: {
    name: t('Big Number with Trendline'),
    description: t(
      'Showcases a single number accompanied by a simple line chart, to call attention to ' +
        'an important metric along with its change over time or other dimension.',
    ),
    category: t('KPI'),
    tags: [
      t('Advanced-Analytics'),
      t('Line'),
      t('Percentages'),
      t('Featured'),
      t('Report'),
      t('Trend'),
    ],
    thumbnail,
    behaviors: [Behavior.DrillToDetail],
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },

  arguments: {
    // Query arguments
    xAxis: Temporal.with({ label: t('Temporal X-Axis') }),
    metric: Metric.with({ label: t('Metric') }),

    // Comparison options
    compareLag: Text.with({
      label: t('Comparison Period Lag'),
      description: t(
        'Based on granularity, number of time periods to compare against',
      ),
    }),

    compareSuffix: Text.with({
      label: t('Comparison suffix'),
      description: t('Suffix to apply after the percentage display'),
    }),

    // Display options
    showTimestamp: Checkbox.with({
      label: t('Show Timestamp'),
      description: t('Whether to display the timestamp'),
      default: false,
    }),

    showTrendLine: Checkbox.with({
      label: t('Show Trend Line'),
      description: t('Whether to display the trend line'),
      default: true,
    }),

    startYAxisAtZero: Checkbox.with({
      label: t('Start y-axis at 0'),
      description: t(
        'Start y-axis at zero. Uncheck to start y-axis at minimum value in the data.',
      ),
      default: true,
    }),

    timeRangeFixed: {
      arg: Checkbox.with({
        label: t('Fix to selected Time Range'),
        description: t(
          'Fix the trend line to the full time range specified in case filtered results do not include the start or end dates',
        ),
        default: false,
      }),
      // Only show when time range is selected
      visibleWhen: {}, // TODO: Need formData access for this
    },

    // Chart styling
    colorPicker: Color.with({
      label: t('Color'),
      description: t('Color for the trend line'),
      // eslint-disable-next-line theme-colors/no-literal-colors
      default: '#1f77b4',
    }),

    headerFontSize: HeaderFontSize,
    subheaderFontSize: SubheaderFontSize,
    subtitle: Subtitle,
    subtitleFontSize: SubheaderFontSize,

    showMetricName: ShowMetricName,

    metricNameFontSize: {
      arg: MetricNameFontSize,
      visibleWhen: { showMetricName: true },
    },

    // X Axis options
    showXAxis: Checkbox.with({
      label: t('Show X-axis'),
      description: t('Whether to display the X Axis'),
      default: false,
    }),

    showXAxisMinMaxLabels: {
      arg: Checkbox.with({
        label: t('Show min/max axis labels'),
        description: t(
          'When enabled, the axis will display labels for the minimum and maximum values of your data',
        ),
        default: false,
      }),
      visibleWhen: { showXAxis: true },
    },

    // Y Axis options
    showYAxis: Checkbox.with({
      label: t('Show Y-axis'),
      description: t('Whether to display the Y Axis'),
      default: false,
    }),

    showYAxisMinMaxLabels: {
      arg: Checkbox.with({
        label: t('Show min/max axis labels'),
        description: t(
          'When enabled, the axis will display labels for the minimum and maximum values of your data',
        ),
        default: false,
      }),
      visibleWhen: { showYAxis: true },
    },

    // Formatting
    yAxisFormat: NumberFormat.with({
      label: t('Number format'),
      default: 'SMART_NUMBER',
    }),

    currencyFormat: Currency,
    timeFormat: TimeFormat,
    forceTimestampFormatting: ForceTimestampFormatting,

    // Advanced analytics - Rolling window
    rollingType: Select.with({
      label: t('Rolling Function'),
      description: t(
        'Defines a rolling window function to apply, works along with the [Periods] text box',
      ),
      options: ROLLING_TYPE_OPTIONS,
      default: 'None',
    }),

    rollingPeriods: Text.with({
      label: t('Periods'),
      description: t(
        'Defines the size of the rolling window function, relative to the time granularity selected',
      ),
    }),

    minPeriods: Text.with({
      label: t('Min Periods'),
      description: t(
        'The minimum number of rolling periods required to show a value',
      ),
    }),

    // Advanced analytics - Resample
    resampleRule: Select.with({
      label: t('Rule'),
      description: t('Pandas resample rule'),
      options: RESAMPLE_RULE_OPTIONS,
      default: '',
    }),

    resampleMethod: Select.with({
      label: t('Fill method'),
      description: t('Pandas resample method'),
      options: RESAMPLE_METHOD_OPTIONS,
      default: '',
    }),
  },

  // Additional controls that need special handling
  additionalControls: {
    query: [['x_axis'], ['time_grain_sqla'], [aggregationControl]],
  },

  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
    x_axis: {
      label: t('Temporal X-Axis'),
      ...temporalColumnMixin,
    },
  },

  // Custom buildQuery for time-series with post-processing
  buildQuery,

  // Custom transform to compute trendline data and ECharts options
  transform: (chartProps: ChartProps, _argValues): TrendlineTransformResult => {
    const {
      width,
      height,
      queriesData,
      formData,
      rawFormData,
      hooks,
      inContextMenu,
      theme,
      datasource,
    } = chartProps;

    const currencyFormats = datasource?.currencyFormats ?? {};
    const columnFormats = datasource?.columnFormats ?? {};

    const {
      colorPicker = { r: 31, g: 119, b: 180 },
      compareLag: compareLag_,
      compareSuffix = '',
      timeFormat,
      metricNameFontSize,
      headerFontSize,
      metric = 'value',
      showTimestamp,
      showTrendLine,
      subtitle = '',
      subtitleFontSize,
      aggregation,
      startYAxisAtZero,
      subheader = '',
      subheaderFontSize,
      forceTimestampFormatting,
      yAxisFormat,
      currencyFormat,
      timeRangeFixed,
      showXAxis = false,
      showXAxisMinMaxLabels = false,
      showYAxis = false,
      showYAxisMinMaxLabels = false,
    } = formData;

    const granularity = extractTimegrain(rawFormData as QueryFormData);
    const {
      data = [],
      colnames = [],
      coltypes = [],
      from_dttm: fromDatetime,
      to_dttm: toDatetime,
    } = queriesData[0] ?? {};

    const aggregatedQueryData = queriesData.length > 1 ? queriesData[1] : null;

    const hasAggregatedData =
      aggregatedQueryData?.data &&
      aggregatedQueryData.data.length > 0 &&
      aggregation !== 'LAST_VALUE';

    const aggregatedData = hasAggregatedData
      ? aggregatedQueryData.data[0]
      : null;
    const refs: Refs = {};
    const metricName = getMetricLabel(metric);
    const metrics = datasource?.metrics || [];
    const originalLabel = getOriginalLabel(metric, metrics as SupersetMetric[]);
    const showMetricName = rawFormData?.show_metric_name ?? false;
    const compareLag = Number(compareLag_) || 0;
    let formattedSubheader = subheader;

    const { r, g, b } = colorPicker as { r: number; g: number; b: number };
    const mainColor = `rgb(${r}, ${g}, ${b})`;

    const xAxisLabel = getXAxisLabel(rawFormData as QueryFormData) as string;
    let trendLineData: TimeSeriesDatum[] | undefined;
    let percentChange = 0;
    let bigNumber =
      data.length === 0 ? null : (data[0] as BigNumberDatum)[metricName];
    let timestamp =
      data.length === 0 ? null : (data[0] as BigNumberDatum)[xAxisLabel];
    let bigNumberFallback: TimeSeriesDatum | undefined;
    let sortedData: [number | null, number | null][] = [];

    if (data.length > 0) {
      sortedData = (data as BigNumberDatum[])
        .map(
          d =>
            [d[xAxisLabel], parseMetricValue(d[metricName])] as [
              number | null,
              number | null,
            ],
        )
        .sort((a, b) => (a[0] !== null && b[0] !== null ? b[0] - a[0] : 0));
    }

    if (sortedData.length > 0) {
      timestamp = sortedData[0][0];

      if (aggregation === 'raw' && hasAggregatedData && aggregatedData) {
        if (
          aggregatedData[metricName] !== null &&
          aggregatedData[metricName] !== undefined
        ) {
          bigNumber = aggregatedData[metricName];
        } else {
          const metricKeys = Object.keys(aggregatedData).filter(
            key =>
              key !== xAxisLabel &&
              aggregatedData[key] !== null &&
              typeof aggregatedData[key] === 'number',
          );
          bigNumber =
            metricKeys.length > 0 ? aggregatedData[metricKeys[0]] : null;
        }
      } else {
        bigNumber = computeClientSideAggregation(sortedData, aggregation);
      }

      if (bigNumber === null) {
        const fallback = sortedData.find(d => d[1] !== null);
        if (fallback) {
          bigNumberFallback = fallback as TimeSeriesDatum;
          bigNumber = fallback[1];
          timestamp = fallback[0];
        }
      }
    }

    if (compareLag > 0 && sortedData.length > 0) {
      const compareIndex = compareLag;
      if (compareIndex < sortedData.length) {
        const compareFromValue = sortedData[compareIndex][1];
        const compareToValue = sortedData[0][1];
        if (compareToValue !== null && compareFromValue !== null) {
          percentChange = compareFromValue
            ? (Number(compareToValue) - compareFromValue) /
              Math.abs(compareFromValue)
            : 0;
          formattedSubheader = `${formatPercentChange(
            percentChange,
          )} ${compareSuffix}`;
        }
      }
    }

    if (data.length > 0) {
      const reversedData = [...sortedData].reverse();
      trendLineData = showTrendLine
        ? (reversedData as TimeSeriesDatum[])
        : undefined;
    }

    let className = '';
    if (percentChange > 0) {
      className = 'positive';
    } else if (percentChange < 0) {
      className = 'negative';
    }

    const metricColtypeIndex = colnames.findIndex(
      (name: string) => name === metricName,
    );
    const metricColtype =
      metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;

    let metricEntry: SupersetMetric | undefined;
    if (datasource?.metrics) {
      metricEntry = (datasource.metrics as SupersetMetric[]).find(
        m => m.metric_name === metric,
      );
    }

    const formatTime = getDateFormatter(
      timeFormat,
      granularity,
      metricEntry?.d3format,
    );

    if (trendLineData && timeRangeFixed && fromDatetime) {
      const toDatetimeOrToday = toDatetime ?? Date.now();
      if (!trendLineData[0][0] || trendLineData[0][0] > fromDatetime) {
        trendLineData.unshift([fromDatetime, null]);
      }
      if (
        !trendLineData[trendLineData.length - 1][0] ||
        trendLineData[trendLineData.length - 1][0]! < toDatetimeOrToday
      ) {
        trendLineData.push([toDatetimeOrToday, null]);
      }
    }

    const numberFormatter = getValueFormatter(
      metric,
      currencyFormats,
      columnFormats,
      metricEntry?.d3format || yAxisFormat,
      currencyFormat,
    );
    const xAxisFormatter = getXAxisFormatter(timeFormat);
    const yAxisFormatter =
      metricColtype === GenericDataType.Temporal ||
      metricColtype === GenericDataType.String ||
      forceTimestampFormatting
        ? formatTime
        : numberFormatter;

    const echartOptions: EChartsCoreOption = trendLineData
      ? {
          series: [
            {
              data: trendLineData,
              type: 'line',
              smooth: true,
              symbol: 'circle',
              symbolSize: 10,
              showSymbol: false,
              color: mainColor,
              areaStyle: {
                color: new graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: mainColor,
                  },
                  {
                    offset: 1,
                    /* eslint-disable theme-colors/no-literal-colors */
                    color:
                      (theme as { colorBgContainer?: string })
                        ?.colorBgContainer ?? '#fff',
                    /* eslint-enable theme-colors/no-literal-colors */
                  },
                ]),
              },
            },
          ],
          xAxis: {
            type: 'time',
            show: showXAxis,
            splitLine: {
              show: false,
            },
            axisLabel: {
              hideOverlap: true,
              formatter: xAxisFormatter,
              alignMinLabel: 'left',
              alignMaxLabel: 'right',
              showMinLabel: showXAxisMinMaxLabels,
              showMaxLabel: showXAxisMinMaxLabels,
            },
          },
          yAxis: {
            type: 'value',
            show: showYAxis,
            scale: !startYAxisAtZero,
            splitLine: {
              show: false,
            },
            axisLabel: {
              hideOverlap: true,
              formatter: yAxisFormatter,
              showMinLabel: showYAxisMinMaxLabels,
              showMaxLabel: showYAxisMinMaxLabels,
            },
          },
          grid:
            showXAxis || showYAxis
              ? {
                  containLabel: true,
                  bottom: TIMESERIES_CONSTANTS.gridOffsetBottom,
                  left: TIMESERIES_CONSTANTS.gridOffsetLeft,
                  right: TIMESERIES_CONSTANTS.gridOffsetRight,
                  top: TIMESERIES_CONSTANTS.gridOffsetTop,
                }
              : {
                  bottom: 0,
                  left: 0,
                  right: 0,
                  top: 0,
                },
          tooltip: {
            ...getDefaultTooltip(refs),
            show: !inContextMenu,
            trigger: 'axis',
            formatter: (params: { data: TimeSeriesDatum }[]) =>
              tooltipHtml(
                [
                  [
                    metricName,
                    params[0].data[1] === null
                      ? t('N/A')
                      : yAxisFormatter.format(params[0].data[1]),
                  ],
                ],
                formatTime(params[0].data[0]),
              ),
          },
          aria: {
            enabled: true,
            label: {
              description: `Big number visualization ${subheader}`,
            },
          },
          useUTC: true,
        }
      : {};

    const { onContextMenu } = hooks ?? {};

    return {
      vizProps: {
        width,
        height,
        bigNumber,
        bigNumberFallback,
        className,
        headerFormatter: yAxisFormatter,
        formatTime,
        formData: formData as BigNumberVizProps['formData'],
        metricName: originalLabel,
        showMetricName,
        metricNameFontSize,
        headerFontSize,
        subtitleFontSize,
        subtitle,
        subheaderFontSize,
        mainColor,
        showTimestamp,
        showTrendLine,
        startYAxisAtZero,
        subheader: formattedSubheader,
        timestamp,
        trendLineData,
        echartOptions,
        onContextMenu,
        xValueFormatter: formatTime,
        refs,
      },
    };
  },

  // Render using BigNumberViz component
  render: ({ vizProps }) => <BigNumberViz {...vizProps} />,
});
