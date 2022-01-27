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
/* eslint-disable camelcase */
import {

CategoricalColorNamespace,
getNumberFormatter,
isEventAnnotationLayer,
isFormulaAnnotationLayer,
isIntervalAnnotationLayer,
isTimeseriesAnnotationLayer } from


'@superset-ui/core';

import {
DEFAULT_FORM_DATA } from



'./types';
import { ForecastSeriesEnum } from '../types';
import { parseYAxisBound } from '../utils/controls';
import {
dedupSeries,
extractTimeseriesSeries,
getLegendProps,
currentSeries } from
'../utils/series';
import { extractAnnotationLabels } from '../utils/annotation';
import {
extractForecastSeriesContext,
extractForecastSeriesContexts,
extractProphetValuesFromTooltipParams,
formatProphetTooltipSeries,
rebaseTimeseriesDatum } from
'../utils/prophet';
import { defaultGrid, defaultTooltip, defaultYAxis } from '../defaults';
import {
getPadding,
getTooltipTimeFormatter,
getXAxisFormatter,
transformEventAnnotation,
transformFormulaAnnotation,
transformIntervalAnnotation,
transformSeries,
transformTimeseriesAnnotation } from
'./transformers';
import { TIMESERIES_CONSTANTS } from '../constants';

export default function transformProps(
chartProps)
{
  const {
    width,
    height,
    filterState,
    formData,
    hooks,
    queriesData,
    datasource } =
  chartProps;
  const { verboseMap = {} } = datasource;
  const { annotation_data: annotationData_, data = [] } =
  queriesData[0];
  const annotationData = annotationData_ || {};

  const {
    area,
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    legendOrientation,
    legendType,
    legendMargin,
    logAxis,
    markerEnabled,
    markerSize,
    opacity,
    minorSplitLine,
    seriesType,
    showLegend,
    stack,
    truncateYAxis,
    yAxisFormat,
    xAxisTimeFormat,
    yAxisBounds,
    tooltipTimeFormat,
    tooltipSortByMetric,
    zoomable,
    richTooltip,
    xAxisLabelRotation,
    emitFilter,
    groupby,
    showValue,
    onlyTotal,
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition } =
  { ...DEFAULT_FORM_DATA, ...formData };
  const colorScale = CategoricalColorNamespace.getScale(colorScheme);
  const rebasedData = rebaseTimeseriesDatum(data, verboseMap);
  const rawSeries = extractTimeseriesSeries(rebasedData, {
    fillNeighborValue: stack && !forecastEnabled ? 0 : undefined });

  const seriesContexts = extractForecastSeriesContexts(
  Object.values(rawSeries).map((series) => series.name));

  const series = [];
  const formatter = getNumberFormatter(contributionMode ? ',.0%' : yAxisFormat);

  const totalStackedValues = [];
  const showValueIndexes = [];

  rebasedData.forEach((data) => {
    const values = Object.keys(data).reduce((prev, curr) => {
      if (curr === '__timestamp') {
        return prev;
      }
      const value = data[curr] || 0;
      return prev + value;
    }, 0);
    totalStackedValues.push(values);
  });

  if (stack) {
    rawSeries.forEach((entry, seriesIndex) => {
      const { data = [] } = entry;
      data.forEach((datum, dataIndex) => {
        if (datum[1] !== null) {
          showValueIndexes[dataIndex] = seriesIndex;
        }
      });
    });
  }

  rawSeries.forEach((entry) => {
    const transformedSeries = transformSeries(entry, colorScale, {
      area,
      filterState,
      seriesContexts,
      markerEnabled,
      markerSize,
      areaOpacity: opacity,
      seriesType,
      stack,
      formatter,
      showValue,
      onlyTotal,
      totalStackedValues,
      showValueIndexes,
      richTooltip });

    if (transformedSeries) series.push(transformedSeries);
  });

  const selectedValues = (filterState.selectedValues || []).reduce(
  (acc, selectedValue) => {
    const index = series.findIndex(({ name }) => name === selectedValue);
    return {
      ...acc,
      [index]: selectedValue };

  },
  {});


  annotationLayers.
  filter((layer) => layer.show).
  forEach((layer) => {
    if (isFormulaAnnotationLayer(layer))
    series.push(transformFormulaAnnotation(layer, data, colorScale));else
    if (isIntervalAnnotationLayer(layer)) {
      series.push(
      ...transformIntervalAnnotation(
      layer,
      data,
      annotationData,
      colorScale));


    } else if (isEventAnnotationLayer(layer)) {
      series.push(
      ...transformEventAnnotation(layer, data, annotationData, colorScale));

    } else if (isTimeseriesAnnotationLayer(layer)) {
      series.push(
      ...transformTimeseriesAnnotation(
      layer,
      markerSize,
      data,
      annotationData));


    }
  });

  // yAxisBounds need to be parsed to replace incompatible values with undefined
  let [min, max] = (yAxisBounds || []).map(parseYAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if (contributionMode === 'row' && stack) {
    if (min === undefined) min = 0;
    if (max === undefined) max = 1;
  }

  const tooltipFormatter = getTooltipTimeFormatter(tooltipTimeFormat);
  const xAxisFormatter = getXAxisFormatter(xAxisTimeFormat);

  const labelMap = series.reduce(
  (acc, datum) => {
    const name = datum.name;
    return {
      ...acc,
      [name]: [name] };

  },
  {});


  const { setDataMask = () => {} } = hooks;

  const addYAxisLabelOffset = !!yAxisTitle;
  const addXAxisLabelOffset = !!xAxisTitle;
  const padding = getPadding(
  showLegend,
  legendOrientation,
  addYAxisLabelOffset,
  zoomable,
  legendMargin,
  addXAxisLabelOffset,
  yAxisTitlePosition,
  yAxisTitleMargin,
  xAxisTitleMargin);


  const legendData = rawSeries.
  filter(
  (entry) =>
  extractForecastSeriesContext(entry.name || '').type ===
  ForecastSeriesEnum.Observation).

  map((entry) => entry.name || '').
  concat(extractAnnotationLabels(annotationLayers, annotationData));

  const echartOptions = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...padding },

    xAxis: {
      type: 'time',
      name: xAxisTitle,
      nameGap: xAxisTitleMargin,
      nameLocation: 'middle',
      axisLabel: {
        hideOverlap: true,
        formatter: xAxisFormatter,
        rotate: xAxisLabelRotation } },


    yAxis: {
      ...defaultYAxis,
      type: logAxis ? 'log' : 'value',
      min,
      max,
      minorTick: { show: true },
      minorSplitLine: { show: minorSplitLine },
      axisLabel: { formatter },
      scale: truncateYAxis,
      name: yAxisTitle,
      nameGap: yAxisTitleMargin,
      nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end' },

    tooltip: {
      ...defaultTooltip,
      appendToBody: true,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params) => {
        const xValue = richTooltip ?
        params[0].value[0] :
        params.value[0];
        const prophetValue = richTooltip ? params : [params];

        if (richTooltip && tooltipSortByMetric) {
          prophetValue.sort((a, b) => b.data[1] - a.data[1]);
        }

        const rows = [`${tooltipFormatter(xValue)}`];
        const prophetValues =
        extractProphetValuesFromTooltipParams(prophetValue);

        Object.keys(prophetValues).forEach((key) => {
          const value = prophetValues[key];
          const content = formatProphetTooltipSeries({
            ...value,
            seriesName: key,
            formatter });

          if (currentSeries.name === key) {
            rows.push(`<span style="font-weight: 700">${content}</span>`);
          } else {
            rows.push(`<span style="opacity: 0.7">${content}</span>`);
          }
        });
        return rows.join('<br />');
      } },

    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, zoomable),
      data: legendData },

    series: dedupSeries(series),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          yAxisIndex: false,
          title: {
            zoom: 'zoom area',
            back: 'restore zoom' } } } },




    dataZoom: zoomable ?
    [
    {
      type: 'slider',
      start: TIMESERIES_CONSTANTS.dataZoomStart,
      end: TIMESERIES_CONSTANTS.dataZoomEnd,
      bottom: TIMESERIES_CONSTANTS.zoomBottom }] :


    [] };


  return {
    echartOptions,
    emitFilter,
    formData,
    groupby,
    height,
    labelMap,
    selectedValues,
    setDataMask,
    width,
    legendData };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();