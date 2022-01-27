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
CategoricalColorNamespace,

getColumnLabel,
getMetricLabel,
getNumberFormatter,
getTimeFormatter,
NumberFormats } from

'@superset-ui/core';


import {
DEFAULT_FORM_DATA as DEFAULT_PIE_FORM_DATA,


EchartsPieLabelType } from

'./types';
import { DEFAULT_LEGEND_FORM_DATA } from '../types';
import {
extractGroupbyLabel,
getChartPadding,
getColtypesMapping,
getLegendProps,
sanitizeHtml } from
'../utils/series';
import { defaultGrid, defaultTooltip } from '../defaults';
import { OpacityEnum } from '../constants';

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function formatPieLabel({
  params,
  labelType,
  numberFormatter,
  sanitizeName = false })





{
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value);
  const formattedPercent = percentFormatter(percent / 100);

  switch (labelType) {
    case EchartsPieLabelType.Key:
      return name;
    case EchartsPieLabelType.Value:
      return formattedValue;
    case EchartsPieLabelType.Percent:
      return formattedPercent;
    case EchartsPieLabelType.KeyValue:
      return `${name}: ${formattedValue}`;
    case EchartsPieLabelType.KeyValuePercent:
      return `${name}: ${formattedValue} (${formattedPercent})`;
    case EchartsPieLabelType.KeyPercent:
      return `${name}: ${formattedPercent}`;
    default:
      return name;}

}

export default function transformProps(
chartProps)
{
  const { formData, height, hooks, filterState, queriesData, width } =
  chartProps;
  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);

  const {
    colorScheme,
    donut,
    groupby,
    innerRadius,
    labelsOutside,
    labelLine,
    labelType,
    legendMargin,
    legendOrientation,
    legendType,
    metric = '',
    numberFormat,
    dateFormat,
    outerRadius,
    showLabels,
    showLegend,
    showLabelsThreshold,
    emitFilter } =
  {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_PIE_FORM_DATA,
    ...formData };

  const metricLabel = getMetricLabel(metric);
  const groupbyLabels = groupby.map(getColumnLabel);
  const minShowLabelAngle = (showLabelsThreshold || 0) * 3.6;

  const keys = data.map((datum) =>
  extractGroupbyLabel({
    datum,
    groupby: groupbyLabels,
    coltypeMapping,
    timeFormatter: getTimeFormatter(dateFormat) }));


  const labelMap = data.reduce(
  (acc, datum) => {
    const label = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat) });

    return {
      ...acc,
      [label]: groupbyLabels.map((col) => datum[col]) };

  },
  {});


  const { setDataMask = () => {} } = hooks;

  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const numberFormatter = getNumberFormatter(numberFormat);

  const transformedData = data.map((datum) => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat) });


    const isFiltered =
    filterState.selectedValues && !filterState.selectedValues.includes(name);

    return {
      value: datum[metricLabel],
      name,
      itemStyle: {
        color: colorFn(name),
        opacity: isFiltered ?
        OpacityEnum.SemiTransparent :
        OpacityEnum.NonTransparent } };


  });

  const selectedValues = (filterState.selectedValues || []).reduce(
  (acc, selectedValue) => {
    const index = transformedData.findIndex(
    ({ name }) => name === selectedValue);

    return {
      ...acc,
      [index]: selectedValue };

  },
  {});


  const formatter = (params) =>
  formatPieLabel({
    params,
    numberFormatter,
    labelType });


  const defaultLabel = {
    formatter,
    show: showLabels,
    color: '#000000' };


  const series = [
  {
    type: 'pie',
    ...getChartPadding(showLegend, legendOrientation, legendMargin),
    animation: false,
    radius: [`${donut ? innerRadius : 0}%`, `${outerRadius}%`],
    center: ['50%', '50%'],
    avoidLabelOverlap: true,
    labelLine: labelsOutside && labelLine ? { show: true } : { show: false },
    minShowLabelAngle,
    label: labelsOutside ?
    {
      ...defaultLabel,
      position: 'outer',
      alignTo: 'none',
      bleedMargin: 5 } :

    {
      ...defaultLabel,
      position: 'inner' },

    emphasis: {
      label: {
        show: true,
        fontWeight: 'bold',
        backgroundColor: 'white' } },


    data: transformedData }];



  const echartOptions = {
    grid: {
      ...defaultGrid },

    tooltip: {
      ...defaultTooltip,
      trigger: 'item',
      formatter: (params) =>
      formatPieLabel({
        params,
        numberFormatter,
        labelType: EchartsPieLabelType.KeyValuePercent,
        sanitizeName: true }) },


    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend),
      data: keys },

    series };


  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitFilter,
    labelMap,
    groupby,
    selectedValues };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(percentFormatter, "percentFormatter", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Pie/transformProps.ts");reactHotLoader.register(formatPieLabel, "formatPieLabel", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Pie/transformProps.ts");reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Pie/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();