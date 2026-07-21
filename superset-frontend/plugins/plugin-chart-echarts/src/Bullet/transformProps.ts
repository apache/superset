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
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  JsonObject,
  sanitizeHtml,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import { Refs } from '../types';
import { EchartsBulletChartProps, BulletChartTransformedProps } from './types';
import { tokenizeToNumericArray, tokenizeToStringArray } from './utils';

const MEASURE_BAR_FRACTION = 0.28;

export default function transformProps(
  chartProps: EchartsBulletChartProps,
): BulletChartTransformedProps {
  const { width, height, formData, queriesData, theme, hooks } = chartProps;
  const {
    metric,
    groupby,
    ranges: rawRanges,
    rangeLabels: rawRangeLabels,
    markers: rawMarkers,
    markerLabels: rawMarkerLabels,
    markerLines: rawMarkerLines,
    markerLineLabels: rawMarkerLineLabels,
    yAxisFormat,
    showLabels,
    showLegend,
  } = formData;
  const refs: Refs = {};
  const { onContextMenu, setDataMask = () => {} } = hooks;

  const metricLabel = getMetricLabel(metric ?? '');
  const records = (queriesData[0]?.data ?? []) as JsonObject[];
  const groupbyLabels = ensureIsArray(groupby).map(getColumnLabel);
  const grouped = groupbyLabels.length > 0;
  // one bullet row per group value; ungrouped charts keep a single row
  const rows = grouped ? records : records.slice(0, 1);
  const categories = grouped
    ? rows.map(row => groupbyLabels.map(l => String(row[l])).join(', '))
    : [''];
  const measures = rows.map(row => Number(row?.[metricLabel] ?? 0));
  if (measures.length === 0) measures.push(0);
  // the largest row drives the default band and the axis extent
  const measure = Math.max(...measures);

  // Match the legacy default: a single band up to 110% of the measure.
  const ranges = tokenizeToNumericArray(rawRanges) ?? [0, measure * 1.1];
  const rangeLabels = tokenizeToStringArray(rawRangeLabels) ?? [];
  const markers = tokenizeToNumericArray(rawMarkers) ?? [];
  const markerLabels = tokenizeToStringArray(rawMarkerLabels) ?? [];
  const markerLines = tokenizeToNumericArray(rawMarkerLines) ?? [];
  const markerLineLabels = tokenizeToStringArray(rawMarkerLineLabels) ?? [];

  const formatter = getNumberFormatter(yAxisFormat);

  const axisMin = Math.min(
    0,
    ...measures,
    ...ranges,
    ...markers,
    ...markerLines,
  );
  let axisMax = Math.max(...measures, ...ranges, ...markers, ...markerLines);
  if (axisMax === axisMin) {
    // All values identical (e.g. an empty result measuring 0) would produce a
    // zero-width axis domain; expand it so the chart still renders.
    axisMax = axisMin + (Math.abs(axisMin) || 1);
  }

  // Nested qualitative bands like d3-bullet: draw from the largest threshold
  // down so smaller (darker) bands paint on top.
  const bandFills = [
    theme.colorFillQuaternary,
    theme.colorFillTertiary,
    theme.colorFillSecondary,
    theme.colorFill,
  ];
  const sortedRanges = [...ranges]
    .map((value, i) => ({ value, label: rangeLabels[i] }))
    .filter(({ value }) => value > axisMin)
    .sort((a, b) => b.value - a.value);
  const bands = sortedRanges.map(({ value, label }, i) => ({
    name: label,
    itemStyle: {
      color: bandFills[Math.min(i, bandFills.length - 1)],
    },
    label: { show: false },
    // markArea item: [{start}, {end}]
    coords: [{ xAxis: axisMin }, { xAxis: value }],
  }));

  // Resolve by position rather than `indexOf(value)` so duplicate marker or
  // marker-line values each keep their own label instead of collapsing onto
  // the first match.
  const markerLabelAt = (index: number, labels: string[], values: number[]) =>
    labels[index] ? labels[index] : formatter(values[index]);

  // The measure bar spans MEASURE_BAR_FRACTION of the category band
  // (roughly the grid height), so a percentage symbolOffset lands inside a
  // tall bar. Compute pixels: half the bar plus a small gap below it.
  const gridHeight = Math.max(height - theme.sizeUnit * 10, 40);
  const rowHeight = gridHeight / categories.length;
  const markerOffsetPx = Math.round(
    (MEASURE_BAR_FRACTION / 2) * rowHeight + 12,
  );

  const rangeName = (value: number, i: number) =>
    rangeLabels[i]
      ? `${rangeLabels[i]}: \u2264 ${formatter(value)}`
      : `\u2264 ${formatter(value)}`;
  const markerName = (value: number, i: number, labels: string[]) =>
    labels[i] ? `${labels[i]}: ${formatter(value)}` : String(formatter(value));

  const echartOptions: EChartsCoreOption = {
    animation: false,
    // Optional legend listing every range, marker and line as a toggleable
    // named entry; each is its own series so ECharts handles the toggling.
    legend: { show: Boolean(showLegend), top: 0 },
    grid: {
      top: showLegend ? theme.sizeUnit * 10 : theme.sizeUnit * 2,
      bottom: theme.sizeUnit * 6,
      left: theme.sizeUnit * 2,
      right: theme.sizeUnit * 2,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: axisMin,
      max: axisMax,
      axisLabel: {
        color: theme.colorTextSecondary,
        formatter: (value: number) => formatter(value),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: grouped, color: theme.colorTextSecondary },
    },
    tooltip: {
      confine: true,
      show: !showLabels,
    },
    series: [
      {
        name: metricLabel,
        type: 'bar',
        data: measures,
        barWidth: `${MEASURE_BAR_FRACTION * 100}%`,
        itemStyle: { color: theme.colorPrimary },
        tooltip: {
          formatter: (params?: { dataIndex?: number }) => {
            const i = params?.dataIndex ?? 0;
            const prefix = grouped ? `${categories[i]} \u2014 ` : '';
            return sanitizeHtml(
              `${prefix}${metricLabel}: <b>${formatter(measures[i])}</b>`,
            );
          },
        },
        z: 10,
        markArea: {
          silent: true,
          data: bands.map(band => [
            {
              name: band.name,
              itemStyle: band.itemStyle,
              label: band.label,
              ...band.coords[0],
            },
            band.coords[1],
          ]),
        },
      },
      // Invisible hover targets at each range threshold: per-item tooltips
      // (markArea is not reliably hoverable), optional on-chart labels, and a
      // named legend entry each.
      ...ranges.map((value, index) => ({
        name: rangeName(value, index),
        type: 'scatter',
        data: categories.map((_, row) => ({
          value: [value, row],
          tooltip: {
            formatter: () =>
              sanitizeHtml(
                `${rangeLabels[index] || ''} \u2264 <b>${formatter(value)}</b>`,
              ),
          },
          label: {
            show:
              Boolean(showLabels) &&
              Boolean(rangeLabels[index]) &&
              row === categories.length - 1,
            position: 'top',
            color: theme.colorTextSecondary,
            formatter: () => String(rangeLabels[index] || ''),
          },
        })),
        symbol: 'rect',
        symbolSize: [14, 40],
        itemStyle: { color: 'transparent' },
        z: 15,
      })),
      ...markers.map((value, index) => ({
        name: markerName(value, index, markerLabels),
        type: 'scatter',
        data: categories.map((_, row) => ({
          value: [value, row],
          tooltip: {
            formatter: () =>
              sanitizeHtml(
                `${markerLabelAt(index, markerLabels, markers)}: <b>${formatter(value)}</b>`,
              ),
          },
        })),
        symbol: 'triangle',
        symbolSize: 14,
        symbolOffset: [0, markerOffsetPx],
        label: {
          show: Boolean(showLabels),
          position: 'bottom',
          color: theme.colorTextSecondary,
          formatter: () => String(markerLabelAt(index, markerLabels, markers)),
        },
        itemStyle: { color: theme.colorText },
        z: 20,
      })),
      // Marker lines as their own empty series so each gets a legend entry
      // whose toggle shows and hides the line.
      ...markerLines.map((value, index) => ({
        name: markerName(value, index, markerLineLabels),
        type: 'line',
        data: [],
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              xAxis: value,
              label: {
                position: 'insideEndTop',
                formatter: () =>
                  String(markerLabelAt(index, markerLineLabels, markerLines)),
                color: theme.colorTextSecondary,
              },
              lineStyle: { color: theme.colorText, type: 'solid', width: 2 },
            },
          ],
        },
      })),
    ],
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
