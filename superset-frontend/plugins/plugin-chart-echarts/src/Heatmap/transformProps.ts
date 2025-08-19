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
  getColumnLabel,
  getMetricLabel,
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
  rgbToHex,
  addAlpha,
  supersetTheme,
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
    borderColor,
    borderWidth = 0,
    showLegend,
    showPercentage,
    showValues,
    xscaleInterval,
    yscaleInterval,
    valueBounds,
    yAxisFormat,
    xAxisTimeFormat,
    currencyFormat,
    sortXAxis,
    sortYAxis,
  } = formData;
  const metricLabel = getMetricLabel(metric);
  const xAxisLabel = getColumnLabel(xAxis);
  // groupby is overridden to be a single value
  const yAxisLabel = getColumnLabel(groupby?.[0] || '');
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

  // Extract unique values for each axis
  const xValues = Array.from(new Set(data.map(row => row[xAxisLabel])));
  const yValues = Array.from(new Set(data.map(row => row[yAxisLabel])));

  // Sort axis values based on configuration
  const sortAxisValues = (
    values: any[],
    sortConfig: string | undefined,
    axisLabel: string,
  ) => {
    if (!sortConfig) {
      return values;
    }

    const isMetricSort = sortConfig.includes('value');
    const isAscending = sortConfig.endsWith('asc');

    if (isMetricSort) {
      // Create a map of axis value to metric sum for sorting by metric
      const metricSums: Record<string, number> = {};
      data.forEach(row => {
        const axisValue = row[axisLabel];
        const metricValue = row[metricLabel];
        if (typeof metricValue === 'number' && axisValue != null) {
          const key = String(axisValue);
          metricSums[key] = (metricSums[key] || 0) + metricValue;
        }
      });

      values.sort((a, b) => {
        const keyA = String(a);
        const keyB = String(b);
        const sumA = metricSums[keyA] || 0;
        const sumB = metricSums[keyB] || 0;
        return isAscending ? sumA - sumB : sumB - sumA;
      });
    } else {
      // Sort alphabetically/numerically
      values.sort((a, b) => {
        // Handle null/undefined values
        if (a === null || a === undefined) return isAscending ? -1 : 1;
        if (b === null || b === undefined) return isAscending ? 1 : -1;

        // Convert to strings for comparison
        const strA = String(a);
        const strB = String(b);

        // Try numeric comparison first
        const numA = Number(strA);
        const numB = Number(strB);
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          return isAscending ? numA - numB : numB - numA;
        }

        // Fall back to string comparison
        return isAscending
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    return values;
  };

  const sortedXValues = sortAxisValues(xValues, sortXAxis, xAxisLabel);
  const sortedYValues = sortAxisValues(yValues, sortYAxis, yAxisLabel);

  const series: HeatmapSeriesOption[] = [
    {
      name: metricLabel,
      type: 'heatmap',
      data: data.map(row =>
        colnames.map(col => {
          const value = row[col];
          if (value === null || value === undefined) {
            return NULL_STRING;
          }
          if (typeof value === 'boolean' || typeof value === 'bigint') {
            return String(value);
          }
          return value;
        }),
      ),
      label: {
        show: showValues,
        formatter: (params: CallbackDataParams) => {
          const paramsValue = params.value as (string | number)[];
          return valueFormatter(paramsValue?.[2] as number | null | undefined);
        },
      },
      itemStyle: {
        borderColor: borderColor
          ? addAlpha(
              rgbToHex(borderColor.r, borderColor.g, borderColor.b),
              borderColor.a,
            )
          : 'transparent',
        borderWidth,
      },
      emphasis: {
        itemStyle: {
          borderColor: supersetTheme.colors.grayscale.light5,
          shadowBlur: 10,
          shadowColor: supersetTheme.colors.grayscale.dark2,
        },
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
        const paramsValue = params.value as (string | number)[];
        const x = paramsValue?.[0];
        const y = paramsValue?.[1];
        const value = paramsValue?.[2] as number | null | undefined;
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
      data: sortedXValues.map(v =>
        v === null || v === undefined ? NULL_STRING : v,
      ),
      axisLabel: {
        formatter: xAxisFormatter,
        interval: xscaleInterval === -1 ? 'auto' : xscaleInterval - 1,
      },
    },
    yAxis: {
      type: 'category',
      data: sortedYValues.map(v =>
        v === null || v === undefined ? NULL_STRING : v,
      ),
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
