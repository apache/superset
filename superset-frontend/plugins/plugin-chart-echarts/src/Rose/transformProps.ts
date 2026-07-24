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
  ensureIsArray,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  QueryFormMetric,
  sanitizeHtml,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import { Refs } from '../types';
import transformData, { RoseEntry } from './transformData';
import {
  EchartsRoseChartProps,
  RoseChartTransformedProps,
  RosePeriod,
} from './types';

const displayName = (name: RoseEntry['name']): string =>
  Array.isArray(name) ? name.join(', ') : String(name);

export default function transformProps(
  chartProps: EchartsRoseChartProps,
): RoseChartTransformedProps {
  const { width, height, formData, queriesData, theme, hooks } = chartProps;
  const {
    colorScheme,
    dateTimeFormat,
    numberFormat,
    richTooltip,
    roseAreaProportion,
    sliceId,
    metrics,
    timeCompare,
    comparisonType,
  } = formData;
  const refs: Refs = {};
  const { onContextMenu, setDataMask = () => {} } = hooks;

  const records = (queriesData[0]?.data ?? []) as Record<string, unknown>[];
  const datum = transformData(records, {
    metricLabels: ensureIsArray(metrics as QueryFormMetric[]).map(
      getMetricLabel,
    ),
    timeCompare: ensureIsArray(timeCompare),
    comparisonType:
      comparisonType === 'absolute' ? 'difference' : comparisonType,
  });

  const format = getNumberFormatter(numberFormat);
  const timeFormat = getTimeFormatter(dateTimeFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);

  const times = Object.keys(datum)
    .map(t => parseInt(t, 10))
    .sort((a, b) => a - b);
  const seriesNames = (datum[times[0]] ?? []).map(entry =>
    displayName(entry.name),
  );

  // The largest per-period sum sets the full radius, like the legacy
  // renderer's maxRadius/maxSum proportion.
  const sums = times.map(time =>
    (datum[time] ?? []).reduce((acc, entry) => acc + entry.value, 0),
  );
  const maxSum = Math.max(...sums, 0) || 1;

  // In area-proportional mode a wedge's AREA encodes its value, so the
  // stacked outer radius is sqrt(cumsum/maxSum) on a [0, 1] radius axis;
  // each series plots the increment between consecutive outer radii. In
  // radius mode the raw values stack linearly and the axis normalizes.
  const periods: RosePeriod[] = times.map(time => {
    let cumulative = 0;
    let previousOuter = 0;
    const entries = (datum[time] ?? []).map(entry => {
      cumulative += entry.value;
      const outer = roseAreaProportion
        ? Math.sqrt(cumulative / maxSum)
        : cumulative;
      const increment = outer - previousOuter;
      previousOuter = outer;
      return {
        seriesName: displayName(entry.name),
        value: entry.value,
        increment,
      };
    });
    return { time, label: String(timeFormat(time)), entries };
  });

  const tooltipRows = (dataIndex: number, highlightSeries?: string): string => {
    const period = periods[dataIndex];
    if (!period) return '';
    const rows = period.entries
      .map(entry => {
        const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorFn(
          entry.seriesName,
          sliceId,
        )};margin-right:5px"></span>`;
        const emphasis =
          entry.seriesName === highlightSeries ? 'font-weight:bold' : '';
        return `<div style="${emphasis}">${marker}${sanitizeHtml(entry.seriesName)}: ${format(
          entry.value,
        )}</div>`;
      })
      .join('');
    return `<div><b>${period.label}</b></div>${rows}`;
  };

  const echartOptions: EChartsCoreOption = {
    legend: {
      top: 0,
      type: 'scroll',
      data: seriesNames,
    },
    polar: { radius: ['0%', '72%'], center: ['50%', '54%'] },
    angleAxis: {
      type: 'category',
      data: periods.map(period => period.label),
      startAngle: 90,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.colorText },
      splitLine: { show: false },
      z: 10,
    },
    radiusAxis: {
      type: 'value',
      ...(roseAreaProportion && { max: 1 }),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    tooltip: {
      confine: true,
      ...(richTooltip
        ? {
            formatter: (params: { dataIndex: number; seriesName: string }) =>
              tooltipRows(params.dataIndex, params.seriesName),
          }
        : {
            formatter: (params: { dataIndex: number; seriesName: string }) => {
              const period = periods[params.dataIndex];
              const entry = period?.entries.find(
                e => e.seriesName === params.seriesName,
              );
              if (!period || !entry) return '';
              return `<div><b>${period.label}</b></div>${sanitizeHtml(params.seriesName)}: ${format(entry.value)}`;
            },
          }),
    },
    series: seriesNames.map(name => ({
      id: `rose-${name}`,
      name,
      type: 'bar',
      coordinateSystem: 'polar',
      stack: 'rose',
      // sectors span their full period angle, edge to edge
      barCategoryGap: '0%',
      // morphs into the period pie when a sector is drilled into
      universalTransition: { enabled: true },
      dataGroupId: name,
      itemStyle: {
        color: colorFn(name, sliceId),
        borderColor: theme.colorBgContainer,
        borderWidth: 1,
      },
      emphasis: { focus: 'none' },
      data: periods.map(period => {
        const entry = period.entries.find(e => e.seriesName === name);
        return { value: entry?.increment ?? 0, groupId: name };
      }),
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
    periods,
    seriesNames,
    numberFormat,
    sliceId,
    colorScheme,
  };
}
