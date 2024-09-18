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
  NumberFormats,
  QueryFormColumn,
  getColumnLabel,
  getMetricLabel,
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import memoizeOne from 'memoize-one';
import { maxBy, minBy } from 'lodash';
import type { ComposeOption } from 'echarts/core';
import type { HeatmapSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { HeatmapChartProps, HeatmapTransformedProps } from './types';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { parseAxisBound } from '../utils/controls';
import { NULL_STRING } from '../constants';
import { getPercentFormatter } from '../utils/formatters';

type EChartsOption = ComposeOption<HeatmapSeriesOption>;

const DEFAULT_ECHARTS_BOUNDS = [0, 200];

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

export default function transformProps(
  chartProps: HeatmapChartProps,
): HeatmapTransformedProps {
  const refs: Refs = {};
  const { width, height, formData, queriesData, datasource } = chartProps;
  const {
    bottomMargin,
    xAxis,
    groupby,
    linearColorScheme,
    leftMargin,
    legendType = 'continuous',
    metric = '',
    normalizeAcross,
    normalized,
    showLegend,
    showPercentage,
    showValues,
    xscaleInterval,
    yscaleInterval,
    valueBounds,
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
  const colorColumn = normalized ? 'rank' : metricLabel;
  const colors = getSequentialSchemeRegistry().get(linearColorScheme)?.colors;
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
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);
  const valueFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );

  let [min, max] = (valueBounds || []).map(parseAxisBound);
  if (min === undefined) {
    min =
      (minBy(data, row => row[colorColumn])?.[colorColumn] as number) ||
      DEFAULT_ECHARTS_BOUNDS[0];
  }
  if (max === undefined) {
    max =
      (maxBy(data, row => row[colorColumn])?.[colorColumn] as number) ||
      DEFAULT_ECHARTS_BOUNDS[1];
  }

  const series: HeatmapSeriesOption[] = [
    {
      name: metricLabel,
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
        show: showValues,
        formatter: (params: CallbackDataParams) =>
          valueFormatter(params.value?.[2]),
      },
    },
  ];

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
          data,
          xAxisLabel,
          yAxisLabel,
          metricLabel,
        );
        const x = params.value?.[0];
        const y = params.value?.[1];
        const value = params.value?.[2];
        const formattedX = xAxisFormatter(x);
        const formattedY = yAxisFormatter(y);
        const formattedValue = valueFormatter(value);
        let percentage = 0;
        let suffix = 'heatmap';
        if (typeof value === 'number') {
          if (normalizeAcross === 'x') {
            percentage = value / totals.x[x];
            suffix = formattedX;
          } else if (normalizeAcross === 'y') {
            percentage = value / totals.y[y];
            suffix = formattedY;
          } else {
            percentage = value / totals.total;
            suffix = 'heatmap';
          }
        }
        const title = `${formattedX} (${formattedY})`;
        const row = [colnames[2], formattedValue];
        if (showPercentage) {
          row.push(`${percentFormatter(percentage)} (${suffix})`);
        }
        return tooltipHtml([row], title);
      },
    },
    visualMap: {
      type: legendType,
      min,
      max,
      calculable: true,
      orient: 'horizontal',
      right: 0,
      top: 0,
      itemHeight: legendType === 'continuous' ? 300 : 14,
      itemWidth: 15,
      formatter: (min: number) => valueFormatter(min),
      inRange: {
        color: colors,
      },
      show: showLegend,
      // By default, ECharts uses the last dimension which is rank
      dimension: normalized ? 3 : 2,
    },
    xAxis: {
      type: 'category',
      axisLabel: {
        formatter: xAxisFormatter,
        interval: xscaleInterval === -1 ? 'auto' : xscaleInterval - 1,
      },
    },
    yAxis: {
      type: 'category',
      axisLabel: {
        formatter: yAxisFormatter,
        interval: yscaleInterval === -1 ? 'auto' : yscaleInterval - 1,
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
