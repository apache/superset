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


import { t } from '@apache-superset/core';
import {
  extractTimegrain,
  getNumberFormatter,
  NumberFormats,
  getMetricLabel,
  getXAxisLabel,
  Metric,
  getValueFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { EChartsCoreOption, graphic } from 'echarts/core';
import { aggregationChoices } from '@superset-ui/chart-controls';
import { TIMESERIES_CONSTANTS } from '../../constants';
import { getXAxisFormatter } from '../../utils/formatters';
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

// Client-side aggregation
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
    datasource: {
      currencyFormats = {},
      columnFormats = {},
      currencyCodeColumn,
    },
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
    showXAxis = false,
    showXAxisMinMaxLabels = false,
    showYAxis = false,
    showYAxisMinMaxLabels = false,

    /** ✅ NEW */
    alignment = 'center',
  } = formData;

  const granularity = extractTimegrain(rawFormData);

  const {
    data = [],
    colnames = [],
    coltypes = [],
    from_dttm: fromDatetime,
    to_dttm: toDatetime,
    detected_currency: detectedCurrency,
  } = queriesData[0];

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
      .map(d => [d[xAxisLabel], parseMetricValue(d[metricName])])
      .sort((a, b) => (a[0] && b[0] ? b[0] - a[0] : 0));
  }

  if (sortedData.length > 0) {
    timestamp = sortedData[0][0];
    bigNumber = computeClientSideAggregation(sortedData, aggregation);

    if (bigNumber === null) {
      bigNumberFallback = sortedData.find(d => d[1] !== null);
      bigNumber = bigNumberFallback ? bigNumberFallback[1] : null;
      timestamp = bigNumberFallback ? bigNumberFallback[0] : null;
    }
  }

  if (compareLag > 0 && sortedData.length > compareLag) {
    const compareFrom = sortedData[compareLag][1];
    const compareTo = sortedData[0][1];

    if (compareFrom !== null && compareTo !== null) {
      percentChange = compareFrom
        ? (Number(compareTo) - compareFrom) / Math.abs(compareFrom)
        : 0;

      formattedSubheader = `${formatPercentChange(
        percentChange,
      )} ${compareSuffix}`;
    }
  }

  if (sortedData.length > 0 && showTrendLine) {
    const validData = sortedData.filter(
      (d): d is [number, number | null] => d[0] !== null,
    );
    trendLineData = [...validData].reverse();
  }

  const metricColtypeIndex = colnames.findIndex(name => name === metricName);
  const metricColtype =
    metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      m => m.metric_name === metric,
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
    undefined,
    data,
    currencyCodeColumn,
    detectedCurrency,
  );

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
            showSymbol: false,
            color: mainColor,
          },
        ],
      }
    : {};

  const { onContextMenu } = hooks;

  return {
    width,
    height,
    bigNumber,
    alignment, /** ✅ NEW */
    // @ts-expect-error
    bigNumberFallback,
    headerFormatter: yAxisFormatter,
    formatTime,
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
