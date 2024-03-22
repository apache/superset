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
  QueryFormColumn,
  SequentialScheme,
  getColumnLabel,
  getMetricLabel,
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
  t,
} from '@superset-ui/core';
import memoizeOne from 'memoize-one';
import { maxBy, minBy } from 'lodash';
import { EChartsOption, HeatmapSeriesOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { HeatmapChartProps, HeatmapTransformedProps } from './types';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { parseAxisBound } from '../utils/controls';
import { NULL_STRING } from '../constants';

// Calculated totals per x and y categories plus total
const calculateTotals = memoizeOne(
  (
    data: Record<string, any>[],
    xAxis: string,
    groupby: string,
    metric: string,
  ) =>
    data.reduce(
      (acc, row) => {
        const value = row[metric];
        if (typeof value !== 'number') {
          return acc;
        }
        const x = row[xAxis] as string;
        const y = row[groupby] as string;
        const xTotal = acc.x[x] || 0;
        const yTotal = acc.y[y] || 0;
        return {
          x: { ...acc.x, [x]: xTotal + value },
          y: { ...acc.y, [y]: yTotal + value },
          total: acc.total + value,
        };
      },
      { x: {}, y: {}, total: 0 },
    ),
);

const sortData = memoizeOne(
  (
    data: Record<string, any>[],
    x: string,
    y: string,
    metric: string,
    xAxisSorting: string,
    yAxisSorting: string,
  ) => {
    const xAscending = xAxisSorting.includes('asc');
    const yAscending = yAxisSorting.includes('asc');
    const xField = xAxisSorting.includes('value') ? metric : x;
    const yField = yAxisSorting.includes('value') ? metric : y;

    // return data sorted by xField and yField at the same time
    return data.sort((a, b) => {
      let result = 0;
      if (a[xField] === b[xField]) {
        result = a[yField] > b[yField] ? 1 : -1;
        return yAscending ? result : -result;
      }
      result = a[xField] > b[xField] ? 1 : -1;
      return xAscending ? result : -result;
    });
  },
);

export default function transformProps(
  chartProps: HeatmapChartProps,
): HeatmapTransformedProps {
  const refs: Refs = {};
  const { width, height, formData, queriesData, datasource } = chartProps;
  const {
    bottomMargin,
    canvasImageRendering,
    xAxis,
    groupby,
    linearColorScheme,
    leftMargin,
    legendType = 'continuous',
    metric,
    normalizeAcross,
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
    xAxisTimeFormat,
    currencyFormat,
  } = formData;
  const metricLabel = getMetricLabel(metric);
  const xAxisLabel = getColumnLabel(xAxis);
  // groupby is overridden to be a single value
  const yAxisLabel = getColumnLabel(groupby as unknown as QueryFormColumn);
  const { data, colnames, coltypes } = queriesData[0];
  const { columnFormats = {}, currencyFormats = {} } = datasource;

  const sortedData = sortData(
    data,
    xAxisLabel,
    yAxisLabel,
    metricLabel,
    sortXAxis,
    sortYAxis,
  );

  const getAxisFormatter =
    (colType: GenericDataType) => (value: number | string) => {
      if (colType === GenericDataType.Temporal) {
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
  const [min, max] = (yAxisBounds || []).map(parseAxisBound);

  const series: HeatmapSeriesOption[] = [
    {
      name: metricLabel,
      type: 'heatmap',
      data: sortedData.map(row =>
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
        show: showValues,
        formatter: (params: CallbackDataParams) =>
          valueFormatter(params.value[2]),
      },
    },
  ];

  const colors = getSequentialSchemeRegistry().get(linearColorScheme)?.colors;
  const dimension = normalized ? 3 : 2;
  const colorColumn = normalized ? 'rank' : metricLabel;

  const echartOptions: EChartsOption = {
    grid: {
      containLabel: true,
      bottom: bottomMargin,
      left: leftMargin,
    },
    series,
    tooltip: {
      ...getDefaultTooltip(refs),
      formatter: (params: CallbackDataParams) => {
        const totals = calculateTotals(
          sortedData,
          xAxisLabel,
          yAxisLabel,
          metricLabel,
        );
        const x = xAxisFormatter(params.value[0]);
        const y = params.value[1];
        const value = params.value[2];
        let percentage = 0;
        let suffix = 'heatmap';
        if (typeof value === 'number') {
          if (normalizeAcross === 'x') {
            percentage = (value / totals.x[x]) * 100;
            suffix = x;
          } else if (normalizeAcross === 'y') {
            percentage = (value / totals.y[y]) * 100;
            suffix = y;
          } else {
            percentage = (value / totals.total) * 100;
            suffix = 'heatmap';
          }
        }
        return `
          <div>
            <div>${colnames[0]}: <b>${x}</b></div>
            <div>${colnames[1]}: <b>${y}</b></div>
            <div>${colnames[2]}: <b>${valueFormatter(value)}</b></div>
            ${
              showPercentage
                ? `<div>% (${suffix}): <b>${valueFormatter(
                    percentage,
                  )}%</b></div>`
                : ''
            }
          </div>`;
      },
    },
    visualMap: {
      type: legendType,
      min: minBy(sortedData, row => row[colorColumn])?.[colorColumn] as number,
      max: maxBy(sortedData, row => row[colorColumn])?.[colorColumn] as number,
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
      show: showLegend,
      dimension,
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
