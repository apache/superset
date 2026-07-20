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
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  JsonObject,
  SMART_DATE_VERBOSE_ID,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import { Refs } from '../types';
import transformData, { TimePivotSeries } from './transformData';
import {
  EchartsTimePivotChartProps,
  TimePivotChartTransformedProps,
} from './types';

const DEFAULT_COLOR = { r: 0, g: 122, b: 135, a: 1 };

export default function transformProps(
  chartProps: EchartsTimePivotChartProps,
): TimePivotChartTransformedProps {
  const { width, height, formData, queriesData, theme, hooks } = chartProps;
  const {
    metric,
    freq,
    colorPicker,
    showLegend,
    lineInterpolation,
    xAxisLabel,
    yAxisLabel,
    yAxisFormat,
    yLogScale,
    yAxisBounds,
  } = formData;
  const refs: Refs = {};
  const { onContextMenu, setDataMask = () => {} } = hooks;

  const metricLabel = getMetricLabel(metric ?? '');
  const records = (queriesData[0]?.data ?? []) as Record<string, unknown>[];
  const series: TimePivotSeries[] = Array.isArray(records)
    ? transformData(records, metricLabel, (freq as string) || 'W-MON')
    : [];

  const { r, g, b } = colorPicker ?? DEFAULT_COLOR;
  // Match the nvd3 styling: the current period is fully opaque, prior
  // periods fade with their recency percentile.
  const colorOf = (s: TimePivotSeries) =>
    `rgba(${r}, ${g}, ${b}, ${s.rank > 0 ? s.perc * 0.5 : 1})`;

  const smooth = lineInterpolation === 'cardinal';
  const step =
    lineInterpolation === 'step-before'
      ? 'start'
      : lineInterpolation === 'step-after'
        ? 'end'
        : undefined;

  const valueFormatter = getNumberFormatter(yAxisFormat);
  const timeFormatter = getTimeFormatter(SMART_DATE_VERBOSE_ID);

  // Draw the current period last so it paints on top of the faded priors.
  const sortedSeries = [...series].sort((a, b) => b.rank - a.rank);

  const [yMin, yMax] = yAxisBounds ?? [null, null];

  const echartOptions: EChartsCoreOption = {
    grid: {
      top: theme.sizeUnit * 8,
      bottom: theme.sizeUnit * 8,
      left: theme.sizeUnit * 4,
      right: theme.sizeUnit * 6,
      containLabel: true,
    },
    legend: {
      show: showLegend !== false,
      top: 0,
      data: series.map(s => s.key),
    },
    xAxis: {
      type: 'time',
      name: xAxisLabel || undefined,
      nameLocation: 'middle',
      nameGap: theme.sizeUnit * 8,
      axisLabel: { color: theme.colorTextSecondary },
    },
    yAxis: {
      type: yLogScale ? 'log' : 'value',
      name: yAxisLabel || undefined,
      nameLocation: 'middle',
      nameGap: theme.sizeUnit * 12,
      min: yMin ?? undefined,
      max: yMax ?? undefined,
      axisLabel: {
        color: theme.colorTextSecondary,
        formatter: (value: number) => valueFormatter(value),
      },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params: JsonObject[]) => {
        const rows = params
          .filter(param => param.value?.[1] != null)
          .map(
            param =>
              `${param.marker}${param.seriesName}: <b>${valueFormatter(
                param.value[1] as number,
              )}</b>`,
          );
        const axisTime = params[0]?.value?.[0];
        return [
          axisTime != null ? timeFormatter(axisTime as number) : '',
          ...rows,
        ].join('<br />');
      },
    },
    series: sortedSeries.map(s => ({
      name: s.key,
      type: 'line',
      smooth,
      ...(step ? { step } : {}),
      showSymbol: false,
      connectNulls: false,
      lineStyle: {
        color: colorOf(s),
        width: s.rank === 0 ? 3 : 2,
      },
      itemStyle: { color: colorOf(s) },
      data: s.values.map(({ x, y }) => [x, y]),
      z: s.rank === 0 ? 10 : 2,
    })),
  };

  return {
    width,
    height,
    echartOptions,
    formData,
    onContextMenu,
    setDataMask,
    selectedValues: {},
    groupby: [],
    labelMap: {},
    refs,
  };
}
