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
    ranges: rawRanges,
    rangeLabels: rawRangeLabels,
    markers: rawMarkers,
    markerLabels: rawMarkerLabels,
    markerLines: rawMarkerLines,
    markerLineLabels: rawMarkerLineLabels,
    yAxisFormat,
  } = formData;
  const refs: Refs = {};
  const { onContextMenu, setDataMask = () => {} } = hooks;

  const metricLabel = getMetricLabel(metric ?? '');
  const records = (queriesData[0]?.data ?? []) as JsonObject[];
  const measure = Number(records[0]?.[metricLabel] ?? 0);

  // Match the legacy default: a single band up to 110% of the measure.
  const ranges = tokenizeToNumericArray(rawRanges) ?? [0, measure * 1.1];
  const rangeLabels = tokenizeToStringArray(rawRangeLabels) ?? [];
  const markers = tokenizeToNumericArray(rawMarkers) ?? [];
  const markerLabels = tokenizeToStringArray(rawMarkerLabels) ?? [];
  const markerLines = tokenizeToNumericArray(rawMarkerLines) ?? [];
  const markerLineLabels = tokenizeToStringArray(rawMarkerLineLabels) ?? [];

  const formatter = getNumberFormatter(yAxisFormat);

  const axisMin = Math.min(0, measure, ...ranges, ...markers, ...markerLines);
  let axisMax = Math.max(measure, ...ranges, ...markers, ...markerLines);
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
    // Surface the range label inside the band's right edge
    label: {
      show: Boolean(label),
      position: 'insideRight',
      color: theme.colorTextSecondary,
      fontSize: theme.fontSizeSM,
    },
    // markArea item: [{start}, {end}]
    coords: [{ xAxis: axisMin }, { xAxis: value }],
  }));

  // Resolve by position rather than `indexOf(value)` so duplicate marker or
  // marker-line values each keep their own label instead of collapsing onto
  // the first match.
  const markerLabelAt = (index: number, labels: string[], values: number[]) =>
    labels[index] ? labels[index] : formatter(values[index]);

  const echartOptions: EChartsCoreOption = {
    // A single-measure chart needs no legend; the default one collides
    // with the x-axis labels.
    legend: { show: false },
    grid: {
      top: theme.sizeUnit * 2,
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
      data: [''],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    },
    tooltip: {
      confine: true,
      formatter: () =>
        sanitizeHtml(`${metricLabel}: <b>${formatter(measure)}</b>`),
    },
    series: [
      {
        name: metricLabel,
        type: 'bar',
        data: [measure],
        barWidth: `${MEASURE_BAR_FRACTION * 100}%`,
        itemStyle: { color: theme.colorPrimary },
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
        markLine: {
          silent: true,
          symbol: 'none',
          data: markerLines.map((value, index) => ({
            xAxis: value,
            label: {
              position: 'insideEndTop',
              formatter: () =>
                markerLabelAt(index, markerLineLabels, markerLines),
              color: theme.colorTextSecondary,
            },
            lineStyle: {
              color: theme.colorText,
              type: 'solid',
              width: 2,
            },
          })),
        },
      },
      {
        name: 'markers',
        type: 'scatter',
        data: markers.map((value, index) => ({
          value: [value, 0],
          tooltip: {
            formatter: () =>
              sanitizeHtml(
                `${markerLabelAt(index, markerLabels, markers)}: <b>${formatter(
                  value,
                )}</b>`,
              ),
          },
        })),
        symbol: 'triangle',
        symbolSize: 14,
        // Sit below the measure bar pointing up at the marked value
        symbolOffset: [0, '160%'],
        itemStyle: { color: theme.colorText },
        z: 20,
      },
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
