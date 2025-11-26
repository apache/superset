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
  NumberFormats,
  QueryFormColumn,
  getColumnLabel,
  getMetricLabel,
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
  rgbToHex,
  addAlpha,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
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

/**
 * Extract unique values for an axis from the data
 */
function extractUniqueValues(
  data: Record<string, any>[],
  columnName: string,
): (string | number)[] {
  const uniqueSet = new Set<string | number>();
  data.forEach(row => {
    const value = row[columnName];
    if (value !== null && value !== undefined) {
      uniqueSet.add(value);
    }
  });
  return Array.from(uniqueSet);
}

/**
 * Sort axis values based on the sort configuration
 */
function sortAxisValues(
  values: (string | number)[],
  data: Record<string, any>[],
  sortOption: string | undefined,
  metricLabel: string,
  axisColumn: string,
): (string | number)[] {
  if (!sortOption) {
    // No sorting specified, return values as they appear in the data
    return values;
  }

  const isAscending = sortOption.includes('asc');
  const isValueSort = sortOption.includes('value');

  if (isValueSort) {
    // Sort by metric value - aggregate metric values for each axis category
    const valueMap = new Map<string | number, number>();
    data.forEach(row => {
      const axisValue = row[axisColumn];
      const metricValue = row[metricLabel];
      if (
        axisValue !== null &&
        axisValue !== undefined &&
        typeof metricValue === 'number'
      ) {
        const current = valueMap.get(axisValue) || 0;
        valueMap.set(axisValue, current + metricValue);
      }
    });

    return values.sort((a, b) => {
      const aValue = valueMap.get(a) || 0;
      const bValue = valueMap.get(b) || 0;
      return isAscending ? aValue - bValue : bValue - aValue;
    });
  }

  // Alphabetical/lexicographic sort
  return values.sort((a, b) => {
    const aStr = String(a);
    const bStr = String(b);
    const comparison = aStr.localeCompare(bStr);
    return isAscending ? comparison : -comparison;
  });
}

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
  const { width, height, formData, queriesData, datasource, theme } =
    chartProps;
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
    xAxisLabelRotation,
    currencyFormat,
    sortXAxis,
    sortYAxis,
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

  // Extract and sort unique axis values
  // Use colnames to get the actual column names in the data
  const xAxisColumnName = colnames[0];
  const yAxisColumnName = colnames[1];

  const xAxisValues = extractUniqueValues(data, xAxisColumnName);
  const yAxisValues = extractUniqueValues(data, yAxisColumnName);

  const sortedXAxisValues = sortAxisValues(
    xAxisValues,
    data,
    sortXAxis,
    metricLabel,
    xAxisColumnName,
  );
  const sortedYAxisValues = sortAxisValues(
    yAxisValues,
    data,
    sortYAxis,
    metricLabel,
    yAxisColumnName,
  );

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
        borderColor: addAlpha(
          rgbToHex(borderColor.r, borderColor.g, borderColor.b),
          borderColor.a,
        ),
        borderWidth,
      },
      emphasis: {
        itemStyle: {
          borderColor: 'transparent',
          shadowBlur: 10,
          shadowColor: addAlpha(theme.colorText, 0.3),
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
      data: sortedXAxisValues,
      axisLabel: {
        formatter: xAxisFormatter,
        interval: xscaleInterval === -1 ? 'auto' : xscaleInterval - 1,
        rotate: xAxisLabelRotation,
      },
    },
    yAxis: {
      type: 'category',
      data: sortedYAxisValues,
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
