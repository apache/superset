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
  extractTimegrain,
  getNumberFormatter,
  NumberFormats,
  GenericDataType,
  getMetricLabel,
  getXAxisLabel,
  Metric,
  getValueFormatter,
  t,
  tooltipHtml,
} from '@superset-ui/core';
import { EChartsCoreOption, graphic } from 'echarts/core';
import { aggregationChoices } from '@superset-ui/chart-controls';
import {
  BigNumberVizProps,
  BigNumberDatum,
  BigNumberWithTrendlineChartProps,
  TimeSeriesDatum,
} from '../types';
import { getDateFormatter, parseMetricValue, getOriginalLabel } from '../utils';
import { getDefaultTooltip } from '../../utils/tooltip';
import { Refs } from '../../types';

const formatPercentChange = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

// Client-side aggregation function using shared aggregationChoices
function computeClientSideAggregation(
  data: [number | null, number | null][],
  aggregation: string | undefined | null,
): number | null {
  if (!data.length) return null;

  // Find the aggregation method, handling case variations
  const methodKey = Object.keys(aggregationChoices).find(
    key => key.toLowerCase() === (aggregation || '').toLowerCase(),
  );

  // Use the compute method from aggregationChoices, fallback to LAST_VALUE
  const selectedMethod = methodKey
    ? aggregationChoices[methodKey as keyof typeof aggregationChoices]
    : aggregationChoices.LAST_VALUE;

  // Extract values from tuple array and filter out nulls
  const values = data
    .map(([, value]) => value)
    .filter((v): v is number => v !== null);

  return selectedMethod.compute(values);
}

export default function transformProps(
  chartProps: BigNumberWithTrendlineChartProps,
): BigNumberVizProps {
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    hooks,
    inContextMenu,
    theme,
    datasource: { currencyFormats = {}, columnFormats = {} },
  } = chartProps;
  const {
    colorPicker,
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
  } = formData;
  const granularity = extractTimegrain(rawFormData);
  const {
    data = [],
    colnames = [],
    coltypes = [],
    from_dttm: fromDatetime,
    to_dttm: toDatetime,
  } = queriesData[0];

  const aggregatedQueryData = queriesData.length > 1 ? queriesData[1] : null;

  const hasAggregatedData =
    aggregatedQueryData?.data &&
    aggregatedQueryData.data.length > 0 &&
    aggregation !== 'LAST_VALUE';

  const aggregatedData = hasAggregatedData ? aggregatedQueryData.data[0] : null;
  const refs: Refs = {};
  const metricName = getMetricLabel(metric);
  const metrics = chartProps.datasource?.metrics || [];
  const originalLabel = getOriginalLabel(metric, metrics);
  const showMetricName = chartProps.rawFormData?.show_metric_name ?? false;
  const compareLag = Number(compareLag_) || 0;
  let formattedSubheader = subheader;

  const { r, g, b } = colorPicker;
  const mainColor = `rgb(${r}, ${g}, ${b})`;

  const xAxisLabel = getXAxisLabel(rawFormData) as string;
  let trendLineData: TimeSeriesDatum[] | undefined;
  let percentChange = 0;
  let bigNumber = data.length === 0 ? null : data[0][metricName];
  let timestamp = data.length === 0 ? null : data[0][xAxisLabel];
  let bigNumberFallback = null;
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
      // sort in time descending order
      .sort((a, b) => (a[0] !== null && b[0] !== null ? b[0] - a[0] : 0));
  }
  if (sortedData.length > 0) {
    timestamp = sortedData[0][0];

    // Raw aggregation uses server-side data, all others use client-side
    if (aggregation === 'raw' && hasAggregatedData && aggregatedData) {
      // Use server-side aggregation for raw
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
      // Use client-side aggregation for all other methods
      bigNumber = computeClientSideAggregation(sortedData, aggregation);
    }

    // Handle null bigNumber case
    if (bigNumber === null) {
      bigNumberFallback = sortedData.find(d => d[1] !== null);
      bigNumber = bigNumberFallback ? bigNumberFallback[1] : null;
      timestamp = bigNumberFallback ? bigNumberFallback[0] : null;
    }
  }

  if (compareLag > 0 && sortedData.length > 0) {
    const compareIndex = compareLag;
    if (compareIndex < sortedData.length) {
      const compareFromValue = sortedData[compareIndex][1];
      const compareToValue = sortedData[0][1];
      // compare values must both be non-nulls
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
    // @ts-ignore
    trendLineData = showTrendLine ? reversedData : undefined;
  }

  let className = '';
  if (percentChange > 0) {
    className = 'positive';
  } else if (percentChange < 0) {
    className = 'negative';
  }

  const metricColtypeIndex = colnames.findIndex(name => name === metricName);
  const metricColtype =
    metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricEntry => metricEntry.metric_name === metric,
    );
  }

  const formatTime = getDateFormatter(
    timeFormat,
    granularity,
    metricEntry?.d3format,
  );

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    metricEntry?.d3format || yAxisFormat,
    currencyFormat,
  );

  const headerFormatter =
    metricColtype === GenericDataType.Temporal ||
    metricColtype === GenericDataType.String ||
    forceTimestampFormatting
      ? formatTime
      : numberFormatter;

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
                  color: theme.colorBgContainer,
                },
              ]),
            },
          },
        ],
        xAxis: {
          min: trendLineData[0][0],
          max: trendLineData[trendLineData.length - 1][0],
          show: false,
          type: 'value',
        },
        yAxis: {
          scale: !startYAxisAtZero,
          show: false,
        },
        grid: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
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
                    : headerFormatter.format(params[0].data[1]),
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
      }
    : {};

  const { onContextMenu } = hooks;

  return {
    width,
    height,
    bigNumber,
    // @ts-ignore
    bigNumberFallback,
    className,
    headerFormatter,
    formatTime,
    formData,
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
  };
}
