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
  CategoricalColorNamespace,
  ColorSchemeRegistry,
  GenericDataType,
  SequentialScheme,
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
} from '@superset-ui/core';
import { maxBy, minBy } from 'lodash';
import { EChartsOption, HeatmapSeriesOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { HeatmapChartProps, HeatmapTransformedProps } from './types';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { parseYAxisBound } from '../utils/controls';
import { NULL_STRING } from '../constants';

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
    showPercentage, // TODO: Logic is in viz.py
    showValues,
    sortXAxis,
    sortYAxis,
    xscaleInterval,
    yscaleInterval,
    yAxisBounds,
    yAxisFormat,
    xAxisTimeFormat,
    currencyFormat,
  } = formData;
  const metricName = typeof metric === 'string' ? metric : metric.label || '';
  const { data, colnames, coltypes } = queriesData[0];
  const { columnFormats = {}, currencyFormats = {} } = datasource;

  const getAxisFormatter =
    (colType: GenericDataType) => (value: number | string) => {
      if (colType === GenericDataType.TEMPORAL) {
        if (typeof value === 'string') {
          return getTimeFormatter(xAxisTimeFormat)(Number.parseInt(value, 10));
        }
        return getTimeFormatter(xAxisTimeFormat)(value);
      }
      return String(value);
    };

  const xAxisFormatter = getAxisFormatter(coltypes[0]);
  const yAxisFormatter = getAxisFormatter(coltypes[1]);
  const valueFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );
  // yAxisBounds need to be parsed to replace incompatible values with undefined
  const [min, max] = (yAxisBounds || []).map(parseYAxisBound);

  const series: HeatmapSeriesOption[] = [
    {
      name: metricName,
      type: 'heatmap',
      data: data.map(row =>
        colnames.map(col => {
          const value = row[col];
          if (!value) {
            return NULL_STRING;
          }
          if (typeof value === 'boolean') {
            return String(value);
          }
          return value;
        }),
      ),
      label: {
        show: true,
        formatter: (params: CallbackDataParams) =>
          valueFormatter(params.value[2]),
      },
    },
  ];

  const colors = getSequentialSchemeRegistry().get(linearColorScheme)?.colors;

  const echartOptions: EChartsOption = {
    grid: {
      bottom: 20,
    },
    series,
    tooltip: {
      ...getDefaultTooltip(refs),
      formatter: (params: CallbackDataParams) => `
        <div>
          <div>${colnames[0]}: <b>${xAxisFormatter(params.value[0])}</b></div>
          <div>${colnames[1]}: <b>${params.value[1]}</b></div>
          <div>${colnames[2]}: <b>${valueFormatter(params.value[2])}</b></div>
        </div>`,
    },
    visualMap: {
      type: legendType,
      min: minBy(data, row => row[metricName])?.[metricName] as number,
      max: maxBy(data, row => row[metricName])?.[metricName] as number,
      calculable: true,
      orient: 'horizontal',
      right: 0,
      top: 0,
      itemHeight: legendType === 'continuous' ? 300 : 14,
      itemWidth: 15,
      formatter: min => valueFormatter(min as number),
      inRange: {
        color: colors,
      },
    },
    xAxis: {
      type: 'category',
      axisLabel: {
        formatter: xAxisFormatter,
      },
    },
    yAxis: {
      type: 'category',
      min,
      max,
      axisLabel: {
        formatter: yAxisFormatter,
      },
    },
  };
  return {
    refs,
    echartOptions,
    width,
    height,
    formData,
  };
}
