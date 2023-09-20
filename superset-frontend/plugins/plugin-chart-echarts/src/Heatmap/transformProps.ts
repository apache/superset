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
  GenericDataType,
  getTimeFormatter,
  getValueFormatter,
} from '@superset-ui/core';
import { maxBy, minBy } from 'lodash';
import { EChartsCoreOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { HeatmapChartProps, HeatmapTransformedProps } from './types';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { parseYAxisBound } from '../utils/controls';

export default function transformProps(
  chartProps: HeatmapChartProps,
): HeatmapTransformedProps {
  const refs: Refs = {};
  const { width, height, formData, queriesData, datasource } = chartProps;
  const {
    bottomMargin,
    canvasImageRendering,
    columns,
    groupby,
    linearColorScheme,
    leftMargin,
    legendType = 'continuous',
    metric,
    normalized,
    showLegend,
    showPercentage,
    showValues,
    sortXAxis,
    sortYAxis,
    xscaleInterval,
    yscaleInterval,
    yAxisBounds,
    yAxisFormat,
    timeFormat,
    currencyFormat,
  } = formData;
  const metricName = typeof metric === 'string' ? metric : metric.label || '';
  const { data, colnames, coltypes } = queriesData[0];
  const { columnFormats = {}, currencyFormats = {} } = datasource;
  const valueFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );
  // yAxisBounds need to be parsed to replace incompatible values with undefined
  const [min, max] = (yAxisBounds || []).map(parseYAxisBound);
  const xAxisFormatter =
    coltypes[0] === GenericDataType.TEMPORAL
      ? getTimeFormatter(timeFormat)
      : String;
  const yAxisFormatter =
    coltypes[1] === GenericDataType.TEMPORAL
      ? getTimeFormatter(timeFormat)
      : String;
  const xAxis = {
    type: 'category',
    axisLabel: {
      formatter: xAxisFormatter,
    },
  };
  const yAxis = {
    type: 'category',
    min,
    max,
    axisLabel: {
      formatter: yAxisFormatter,
    },
  };
  const series = [
    {
      name: metricName,
      type: 'heatmap',
      data: data.map(row => colnames.map(col => row[col])),
      label: {
        show: true,
        formatter: (params: CallbackDataParams) =>
          valueFormatter(params.value[2]),
      },
    },
  ];

  const echartOptions: EChartsCoreOption = {
    grid: {
      bottom: 20,
    },
    series,
    tooltip: {
      ...getDefaultTooltip(refs),
      formatter: (params: CallbackDataParams) => `
        <div>
          <div>${colnames[0]}: <b>${params.value[0]}</b></div>
          <div>${colnames[1]}: <b>${params.value[1]}</b></div>
          <div>${colnames[2]}: <b>${valueFormatter(params.value[2])}</b></div>
        </div>`,
    },
    visualMap: {
      type: legendType,
      min: minBy(data, row => row[metricName])?.[metricName],
      max: maxBy(data, row => row[metricName])?.[metricName],
      calculable: true,
      orient: 'horizontal',
      right: 0,
      top: 0,
      itemHeight: legendType === 'continuous' ? 300 : 14,
      itemWidth: 15,
      formatter: valueFormatter,
    },
    xAxis,
    yAxis,
  };
  return {
    refs,
    echartOptions,
    width,
    height,
    formData,
  };
}
