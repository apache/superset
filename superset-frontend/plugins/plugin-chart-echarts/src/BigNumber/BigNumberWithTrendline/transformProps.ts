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
  getMetricLabel,
  getXAxisLabel,
  Metric,
  getValueFormatter,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { EChartsCoreOption } from 'echarts/core';
import { aggregationChoices } from '@superset-ui/chart-controls';
import {
  BigNumberVizProps,
  BigNumberDatum,
  BigNumberWithTrendlineChartProps,
  TimeSeriesDatum,
} from '../types';
import { getDateFormatter, parseMetricValue, getOriginalLabel } from '../utils';
import { Refs } from '../../types';

const formatPercentChange = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

function computeClientSideAggregation(
  data: [number | null, number | null][],
  aggregation?: string | null,
): number | null {
  if (!data.length) return null;

  const methodKey = Object.keys(aggregationChoices).find(
    key => key.toLowerCase() === (aggregation || '').toLowerCase(),
  );

  const method =
    aggregationChoices[
      (methodKey as keyof typeof aggregationChoices) || 'LAST_VALUE'
    ];

  const values = data.map(([, v]) => v).filter((v): v is number => v !== null);

  return method.compute(values);
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
    datasource,
  } = chartProps;

  const {
    colorPicker,
    compareLag,
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
    alignment = 'center',
  } = formData;

  const { data = [], colnames = [], coltypes = [] } = queriesData[0];
  const refs: Refs = {};

  const metricName = getMetricLabel(metric);
  const originalLabel = getOriginalLabel(metric, datasource?.metrics || []);
  const showMetricName = rawFormData?.show_metric_name ?? false;

  const xAxisLabel = getXAxisLabel(rawFormData) as string;
  let sortedData: [number | null, number | null][] = [];

  if (data.length) {
    sortedData = (data as BigNumberDatum[])
      .map(
        d =>
          [d[xAxisLabel] as number | null, parseMetricValue(d[metricName])] as [
            number | null,
            number | null,
          ],
      )
      .sort((a, b) => (a[0] !== null && b[0] !== null ? b[0] - a[0] : 0));
  }

  let bigNumber = computeClientSideAggregation(sortedData, aggregation);
  let timestamp = sortedData[0]?.[0] ?? null;

  let formattedSubheader = subheader;

  if (compareLag && sortedData.length > compareLag) {
    const prev = sortedData[compareLag][1];
    const curr = sortedData[0][1];

    if (prev != null && curr != null && prev !== 0) {
      formattedSubheader = `${formatPercentChange(
        (curr - prev) / Math.abs(prev),
      )} ${compareSuffix}`;
    }
  }

  let trendLineData: TimeSeriesDatum[] | undefined;
  if (showTrendLine) {
    trendLineData = [...sortedData].reverse();
  }

  const metricColtype = coltypes[colnames.findIndex(c => c === metricName)];

  const metricEntry: Metric | undefined = datasource?.metrics?.find(
    m => m.metric_name === metric,
  );

  const formatTime = getDateFormatter(
    timeFormat,
    extractTimegrain(rawFormData),
    metricEntry?.d3format,
  );

  const numberFormatter = getValueFormatter(
    metric,
    datasource?.currencyFormats,
    datasource?.columnFormats,
    metricEntry?.d3format,
  );

  const headerFormatter =
    metricColtype === GenericDataType.Temporal ? formatTime : numberFormatter;

  const echartOptions: EChartsCoreOption =
    trendLineData && showTrendLine
      ? { series: [{ type: 'line', data: trendLineData }] }
      : {};

  return {
    width,
    height,
    bigNumber,
    headerFormatter,
    formatTime,
    metricName: originalLabel,
    showMetricName,
    metricNameFontSize,
    headerFontSize,
    subtitleFontSize,
    subtitle,
    subheaderFontSize,
    subheader: formattedSubheader,
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    timestamp,
    trendLineData,
    echartOptions,
    alignment,
    onContextMenu: hooks.onContextMenu,
    refs,
  };
}
