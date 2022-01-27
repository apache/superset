(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
t,
smartDateVerboseFormatter } from


'@superset-ui/core';
import { graphic } from 'echarts';





import { getDateFormatter, parseMetricValue } from '../utils';

const defaultNumberFormatter = getNumberFormatter();
export function renderTooltipFactory(
formatDate = smartDateVerboseFormatter,
formatValue = defaultNumberFormatter)
{
  return function renderTooltip(params) {
    return `
      ${formatDate(params[0].data[0])}
      <br />
      <strong>
        ${
    params[0].data[1] === null ? t('N/A') : formatValue(params[0].data[1])
    }
      </strong>
    `;
  };
}

const TIME_COLUMN = '__timestamp';
const formatPercentChange = getNumberFormatter(
NumberFormats.PERCENT_SIGNED_1_POINT);


export default function transformProps(
chartProps)
{var _metricEntry, _ref, _metricEntry2;
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
    forceTimestampFormatting,
    yAxisFormat,
    timeRangeFixed } =
  formData;
  const granularity = extractTimegrain(rawFormData);
  const {
    data = [],
    colnames = [],
    coltypes = [],
    from_dttm: fromDatetime,
    to_dttm: toDatetime } =
  queriesData[0];
  const metricName = getMetricLabel(metric);
  const compareLag = Number(compareLag_) || 0;
  let formattedSubheader = subheader;

  const { r, g, b } = colorPicker;
  const mainColor = `rgb(${r}, ${g}, ${b})`;

  let trendLineData;
  let percentChange = 0;
  let bigNumber = data.length === 0 ? null : data[0][metricName];
  let timestamp = data.length === 0 ? null : data[0][TIME_COLUMN];
  let bigNumberFallback;

  const metricColtypeIndex = colnames.findIndex((name) => name === metricName);
  const metricColtype =
  metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;

  if (data.length > 0) {
    const sortedData = data.
    map((d) => [d[TIME_COLUMN], parseMetricValue(d[metricName])])
    // sort in time descending order
    .sort((a, b) => a[0] !== null && b[0] !== null ? b[0] - a[0] : 0);

    bigNumber = sortedData[0][1];
    timestamp = sortedData[0][0];

    if (bigNumber === null) {
      bigNumberFallback = sortedData.find((d) => d[1] !== null);
      bigNumber = bigNumberFallback ? bigNumberFallback[1] : null;
      timestamp = bigNumberFallback ? bigNumberFallback[0] : null;
    }

    if (compareLag > 0) {
      const compareIndex = compareLag;
      if (compareIndex < sortedData.length) {
        const compareValue = sortedData[compareIndex][1];
        // compare values must both be non-nulls
        if (bigNumber !== null && compareValue !== null && compareValue !== 0) {
          percentChange = (bigNumber - compareValue) / Math.abs(compareValue);
          formattedSubheader = `${formatPercentChange(
          percentChange)
          } ${compareSuffix}`;
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
    (metricEntry) => metricEntry.metric_name === metric);

  }

  const formatTime = getDateFormatter(
  timeFormat,
  granularity, (_metricEntry =
  metricEntry) == null ? void 0 : _metricEntry.d3format);


  const headerFormatter =
  metricColtype === GenericDataType.TEMPORAL ||
  metricColtype === GenericDataType.STRING ||
  forceTimestampFormatting ?
  formatTime :
  getNumberFormatter((_ref = yAxisFormat != null ? yAxisFormat : (_metricEntry2 = metricEntry) == null ? void 0 : _metricEntry2.d3format) != null ? _ref : undefined);

  if (trendLineData && timeRangeFixed && fromDatetime) {
    const toDatetimeOrToday = toDatetime != null ? toDatetime : Date.now();
    if (!trendLineData[0][0] || trendLineData[0][0] > fromDatetime) {
      trendLineData.unshift([fromDatetime, null]);
    }
    if (
    !trendLineData[trendLineData.length - 1][0] ||
    trendLineData[trendLineData.length - 1][0] < toDatetimeOrToday)
    {
      trendLineData.push([toDatetimeOrToday, null]);
    }
  }

  const echartOptions = trendLineData ?
  {
    series: [
    {
      data: trendLineData,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      showSymbol: false,
      color: mainColor,
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
        {
          offset: 0,
          color: mainColor },

        {
          offset: 1,
          color: 'white' }]) } }],





    xAxis: {
      min: trendLineData[0][0],
      max: trendLineData[trendLineData.length - 1][0],
      show: false,
      type: 'value' },

    yAxis: {
      scale: !startYAxisAtZero,
      show: false },

    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0 },

    tooltip: {
      show: true,
      trigger: 'axis',
      confine: true,
      formatter: renderTooltipFactory(formatTime, headerFormatter) },

    aria: {
      enabled: true,
      label: {
        description: `Big number visualization ${subheader}` } } } :



  {};
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
    echartOptions };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultNumberFormatter, "defaultNumberFormatter", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberWithTrendline/transformProps.ts");reactHotLoader.register(renderTooltipFactory, "renderTooltipFactory", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberWithTrendline/transformProps.ts");reactHotLoader.register(TIME_COLUMN, "TIME_COLUMN", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberWithTrendline/transformProps.ts");reactHotLoader.register(formatPercentChange, "formatPercentChange", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberWithTrendline/transformProps.ts");reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberWithTrendline/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();