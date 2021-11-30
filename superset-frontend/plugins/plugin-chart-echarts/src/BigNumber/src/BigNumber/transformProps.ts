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
import * as color from 'd3-color';
import {
  extractTimegrain,
  getNumberFormatter,
  getTimeFormatter,
  getTimeFormatterForGranularity,
  NumberFormats,
  ChartProps,
  LegacyQueryData,
  QueryFormData,
  smartDateFormatter,
  GenericDataType,
  QueryFormMetric,
  getMetricLabel,
} from '@superset-ui/core';

const TIME_COLUMN = '__timestamp';
const formatPercentChange = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

// we trust both the x (time) and y (big number) to be numeric
export interface BigNumberDatum {
  [key: string]: number | null;
}

export type BigNumberFormData = QueryFormData & {
  colorPicker?: {
    r: number;
    g: number;
    b: number;
  };
  metric?: QueryFormMetric;
  compareLag?: string | number;
  yAxisFormat?: string;
};

export type BigNumberChartProps = ChartProps & {
  formData: BigNumberFormData;
  queriesData: (LegacyQueryData & {
    data?: BigNumberDatum[];
  })[];
};

export default function transformProps(chartProps: BigNumberChartProps) {
  const { width, height, queriesData, formData, rawFormData } = chartProps;
  const {
    colorPicker,
    compareLag: compareLag_,
    compareSuffix = '',
    timeFormat,
    headerFontSize,
    metric = 'value',
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader = '',
    subheaderFontSize,
    timeRangeFixed = false,
    forceTimestampFormatting,
    yAxisFormat,
  } = formData;
  const granularity = extractTimegrain(rawFormData as QueryFormData);
  const {
    data = [],
    from_dttm: fromDatetime,
    to_dttm: toDatetime,
    colnames = [],
    coltypes = [],
  } = queriesData[0];
  const metricName = getMetricLabel(metric);
  const compareLag = Number(compareLag_) || 0;
  let formattedSubheader = subheader;

  let mainColor;
  if (colorPicker) {
    const { r, g, b } = colorPicker;
    mainColor = color.rgb(r, g, b).hex();
  }

  let trendLineData;
  let percentChange = 0;
  let bigNumber = data.length === 0 ? null : data[0][metricName];
  let timestamp = data.length === 0 ? null : data[0][TIME_COLUMN];
  let bigNumberFallback;

  if (data.length > 0) {
    const sortedData = (data as BigNumberDatum[])
      .map(d => ({ x: d[TIME_COLUMN], y: d[metricName] }))
      // sort in time descending order
      .sort((a, b) => (a.x !== null && b.x !== null ? b.x - a.x : 0));

    bigNumber = sortedData[0].y;
    timestamp = sortedData[0].x;

    if (bigNumber === null) {
      bigNumberFallback = sortedData.find(d => d.y !== null);
      bigNumber = bigNumberFallback ? bigNumberFallback.y : null;
      timestamp = bigNumberFallback ? bigNumberFallback.x : null;
    }

    if (compareLag > 0) {
      const compareIndex = compareLag;
      if (compareIndex < sortedData.length) {
        const compareValue = sortedData[compareIndex].y;
        // compare values must both be non-nulls
        if (bigNumber !== null && compareValue !== null && compareValue !== 0) {
          percentChange = (bigNumber - compareValue) / Math.abs(compareValue);
          formattedSubheader = `${formatPercentChange(
            percentChange,
          )} ${compareSuffix}`;
        }
      }
    }
    sortedData.reverse();
    trendLineData = showTrendLine ? sortedData : undefined;
  }

  let className = '';
  if (percentChange > 0) {
    className = 'positive';
  } else if (percentChange < 0) {
    className = 'negative';
  }

  let metricEntry;
  if (chartProps.datasource && chartProps.datasource.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricEntry => metricEntry.metric_name === metric,
    );
  }

  const formatTime =
    timeFormat === smartDateFormatter.id
      ? getTimeFormatterForGranularity(granularity)
      : getTimeFormatter(timeFormat ?? metricEntry?.d3format);

  const metricColtypeIndex = colnames.findIndex(
    (name: string) => name === metricName,
  );
  const coltype = metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;
  const headerFormatter =
    coltype === GenericDataType.TEMPORAL || forceTimestampFormatting
      ? formatTime
      : getNumberFormatter(yAxisFormat ?? metricEntry?.d3format ?? undefined);

  return {
    width,
    height,
    bigNumber,
    bigNumberFallback,
    className,
    headerFormatter,
    formatTime,
    headerFontSize,
    subheaderFontSize,
    mainColor,
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader: formattedSubheader,
    timestamp,
    trendLineData,
    fromDatetime,
    toDatetime,
    timeRangeFixed,
  };
}
