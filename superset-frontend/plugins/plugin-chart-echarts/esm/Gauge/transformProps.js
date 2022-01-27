(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();import "core-js/modules/es.string.replace.js";var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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

CategoricalColorNamespace,


getNumberFormatter,
getMetricLabel,

getColumnLabel } from
'@superset-ui/core';


import range from 'lodash/range';
import { parseNumbersList } from '../utils/controls';
import {
DEFAULT_FORM_DATA as DEFAULT_GAUGE_FORM_DATA } from




'./types';
import {
DEFAULT_GAUGE_SERIES_OPTION,
INTERVAL_GAUGE_SERIES_OPTION,
OFFSETS,
FONT_SIZE_MULTIPLIERS } from
'./constants';
import { OpacityEnum } from '../constants';

const setIntervalBoundsAndColors = (
intervals,
intervalColorIndices,
colorFn,
normalizer) =>
{
  let intervalBoundsNonNormalized;
  let intervalColorIndicesArray;
  try {
    intervalBoundsNonNormalized = parseNumbersList(intervals, ',');
    intervalColorIndicesArray = parseNumbersList(intervalColorIndices, ',');
  } catch (error) {
    intervalBoundsNonNormalized = [];
    intervalColorIndicesArray = [];
  }

  const intervalBounds = intervalBoundsNonNormalized.map(
  (bound) => bound / normalizer);

  const intervalColors = intervalColorIndicesArray.map(
  (ind) => colorFn.colors[(ind - 1) % colorFn.colors.length]);


  return intervalBounds.map((val, idx) => {
    const color = intervalColors[idx];
    return [val, color || colorFn.colors[idx]];
  });
};

const calculateAxisLineWidth = (
data,
fontSize,
overlap) =>
overlap ? fontSize : data.length * fontSize;

export default function transformProps(
chartProps)
{var _queriesData$, _DEFAULT_GAUGE_SERIES, _DEFAULT_GAUGE_SERIES2, _DEFAULT_GAUGE_SERIES3, _DEFAULT_GAUGE_SERIES4, _DEFAULT_GAUGE_SERIES5, _DEFAULT_GAUGE_SERIES6, _DEFAULT_GAUGE_SERIES7;
  const { width, height, formData, queriesData, hooks, filterState } =
  chartProps;
  const {
    groupby,
    metric,
    minVal,
    maxVal,
    colorScheme,
    fontSize,
    numberFormat,
    animation,
    showProgress,
    overlap,
    roundCap,
    showAxisTick,
    showSplitLine,
    splitNumber,
    startAngle,
    endAngle,
    showPointer,
    intervals,
    intervalColorIndices,
    valueFormatter,
    emitFilter } =
  { ...DEFAULT_GAUGE_FORM_DATA, ...formData };
  const data = ((_queriesData$ = queriesData[0]) == null ? void 0 : _queriesData$.data) || [];
  const numberFormatter = getNumberFormatter(numberFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const normalizer = maxVal;
  const axisLineWidth = calculateAxisLineWidth(data, fontSize, overlap);
  const axisLabels = range(minVal, maxVal, (maxVal - minVal) / splitNumber);
  const axisLabelLength = Math.max(
  ...axisLabels.map((label) => numberFormatter(label).length).concat([1]));

  const groupbyLabels = groupby.map(getColumnLabel);
  const formatValue = (value) =>
  valueFormatter.replace('{value}', numberFormatter(value));
  const axisTickLength = FONT_SIZE_MULTIPLIERS.axisTickLength * fontSize;
  const splitLineLength = FONT_SIZE_MULTIPLIERS.splitLineLength * fontSize;
  const titleOffsetFromTitle =
  FONT_SIZE_MULTIPLIERS.titleOffsetFromTitle * fontSize;
  const detailOffsetFromTitle =
  FONT_SIZE_MULTIPLIERS.detailOffsetFromTitle * fontSize;
  const intervalBoundsAndColors = setIntervalBoundsAndColors(
  intervals,
  intervalColorIndices,
  colorFn,
  normalizer);

  const columnsLabelMap = new Map();

  const transformedData = data.map(
  (data_point, index) => {
    const name = groupbyLabels.
    map((column) => `${column}: ${data_point[column]}`).
    join(', ');
    columnsLabelMap.set(
    name,
    groupbyLabels.map((col) => data_point[col]));

    let item = {
      value: data_point[getMetricLabel(metric)],
      name,
      itemStyle: {
        color: colorFn(index) },

      title: {
        offsetCenter: [
        '0%',
        `${index * titleOffsetFromTitle + OFFSETS.titleFromCenter}%`],

        fontSize },

      detail: {
        offsetCenter: [
        '0%',
        `${
        index * titleOffsetFromTitle +
        OFFSETS.titleFromCenter +
        detailOffsetFromTitle
        }%`],

        fontSize: FONT_SIZE_MULTIPLIERS.detailFontSize * fontSize } };


    if (
    filterState.selectedValues &&
    !filterState.selectedValues.includes(name))
    {
      item = {
        ...item,
        itemStyle: {
          color: colorFn(index),
          opacity: OpacityEnum.SemiTransparent },

        detail: {
          show: false },

        title: {
          show: false } };


    }
    return item;
  });


  const { setDataMask = () => {} } = hooks;

  const progress = {
    show: showProgress,
    overlap,
    roundCap,
    width: fontSize };

  const splitLine = {
    show: showSplitLine,
    distance: -axisLineWidth - splitLineLength - OFFSETS.ticksFromLine,
    length: splitLineLength,
    lineStyle: {
      width: FONT_SIZE_MULTIPLIERS.splitLineWidth * fontSize,
      color: (_DEFAULT_GAUGE_SERIES = DEFAULT_GAUGE_SERIES_OPTION.splitLine) == null ? void 0 : (_DEFAULT_GAUGE_SERIES2 = _DEFAULT_GAUGE_SERIES.lineStyle) == null ? void 0 : _DEFAULT_GAUGE_SERIES2.color } };


  const axisLine = {
    roundCap,
    lineStyle: {
      width: axisLineWidth,
      color: (_DEFAULT_GAUGE_SERIES3 = DEFAULT_GAUGE_SERIES_OPTION.axisLine) == null ? void 0 : (_DEFAULT_GAUGE_SERIES4 = _DEFAULT_GAUGE_SERIES3.lineStyle) == null ? void 0 : _DEFAULT_GAUGE_SERIES4.color } };


  const axisLabel = {
    distance:
    axisLineWidth -
    FONT_SIZE_MULTIPLIERS.axisLabelDistance *
    fontSize *
    FONT_SIZE_MULTIPLIERS.axisLabelLength *
    axisLabelLength - (
    showSplitLine ? splitLineLength : 0) - (
    showAxisTick ? axisTickLength : 0) -
    OFFSETS.ticksFromLine,
    fontSize,
    formatter: numberFormatter,
    color: (_DEFAULT_GAUGE_SERIES5 = DEFAULT_GAUGE_SERIES_OPTION.axisLabel) == null ? void 0 : _DEFAULT_GAUGE_SERIES5.color };

  const axisTick = {
    show: showAxisTick,
    distance: -axisLineWidth - axisTickLength - OFFSETS.ticksFromLine,
    length: axisTickLength,
    lineStyle: (_DEFAULT_GAUGE_SERIES6 = DEFAULT_GAUGE_SERIES_OPTION.axisTick) == null ? void 0 : _DEFAULT_GAUGE_SERIES6.
    lineStyle };

  const detail = {
    valueAnimation: animation,
    formatter: (value) => formatValue(value),
    color: (_DEFAULT_GAUGE_SERIES7 = DEFAULT_GAUGE_SERIES_OPTION.detail) == null ? void 0 : _DEFAULT_GAUGE_SERIES7.color };

  let pointer;

  if (intervalBoundsAndColors.length) {var _INTERVAL_GAUGE_SERIE, _INTERVAL_GAUGE_SERIE2, _INTERVAL_GAUGE_SERIE3, _INTERVAL_GAUGE_SERIE4, _INTERVAL_GAUGE_SERIE5, _INTERVAL_GAUGE_SERIE6;
    splitLine.lineStyle.color = (_INTERVAL_GAUGE_SERIE =
    INTERVAL_GAUGE_SERIES_OPTION.splitLine) == null ? void 0 : (_INTERVAL_GAUGE_SERIE2 = _INTERVAL_GAUGE_SERIE.lineStyle) == null ? void 0 : _INTERVAL_GAUGE_SERIE2.color;
    axisTick.lineStyle.color = INTERVAL_GAUGE_SERIES_OPTION == null ? void 0 : (_INTERVAL_GAUGE_SERIE3 = INTERVAL_GAUGE_SERIES_OPTION.axisTick) == null ? void 0 : (_INTERVAL_GAUGE_SERIE4 = _INTERVAL_GAUGE_SERIE3.lineStyle) == null ? void 0 : _INTERVAL_GAUGE_SERIE4.
    color;
    axisLabel.color = (_INTERVAL_GAUGE_SERIE5 = INTERVAL_GAUGE_SERIES_OPTION.axisLabel) == null ? void 0 : _INTERVAL_GAUGE_SERIE5.color;
    axisLine.lineStyle.color = intervalBoundsAndColors;
    pointer = {
      show: showPointer,
      showAbove: false,
      itemStyle: (_INTERVAL_GAUGE_SERIE6 = INTERVAL_GAUGE_SERIES_OPTION.pointer) == null ? void 0 : _INTERVAL_GAUGE_SERIE6.itemStyle };

  } else {
    pointer = {
      show: showPointer,
      showAbove: false };

  }

  const series = [
  {
    type: 'gauge',
    startAngle,
    endAngle,
    min: minVal,
    max: maxVal,
    progress,
    animation,
    axisLine: axisLine,
    splitLine,
    splitNumber,
    axisLabel,
    axisTick,
    pointer,
    detail,
    data: transformedData }];



  const echartOptions = {
    series };


  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitFilter,
    labelMap: Object.fromEntries(columnsLabelMap),
    groupby,
    selectedValues: filterState.selectedValues || [] };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(setIntervalBoundsAndColors, "setIntervalBoundsAndColors", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Gauge/transformProps.ts");reactHotLoader.register(calculateAxisLineWidth, "calculateAxisLineWidth", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Gauge/transformProps.ts");reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Gauge/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();