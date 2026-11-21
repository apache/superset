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
  removeDuplicates,
  sanitizeHtml,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { CustomSeriesRenderItem } from 'echarts';
import { Refs } from '../types';
import {
  EchartsBulletChartProps,
  EchartsBulletFormData,
  BulletChartTransformedProps,
} from './types';
import { sanitizeHtml as escapeHtml } from '../utils/series';
import {
  getColorLuminance,
  tokenizeToNumericArray,
  tokenizeToStringArray,
} from './utils';
import { estimateWrappedLegendRowCount } from '../utils/legendLayout';
import { getMetricValue } from '../utils/metricBounds';

// Foregrounds for band labels drawn over a custom fill, chosen from the fill's
// own luminance so they stay readable in both light and dark themes.
const BAND_LABEL_COLORS = {
  // eslint-disable-next-line theme-colors/no-literal-colors
  light: '#ffffff',
  // eslint-disable-next-line theme-colors/no-literal-colors
  dark: '#1f1f1f',
};
// Relative luminance of each fixed foreground, computed once so the pick
// between them is a real WCAG contrast comparison against the fill, not a
// magic threshold that can drift away from these two colors' actual
// break-even point.
const BAND_LABEL_LUMINANCE = {
  light: getColorLuminance(BAND_LABEL_COLORS.light) ?? 1,
  dark: getColorLuminance(BAND_LABEL_COLORS.dark) ?? 0,
};
const wcagContrast = (luminanceA: number, luminanceB: number): number => {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
};
const MEASURE_BAR_FRACTION = 0.28;
// Per-row range bands (relative ranges) fill this share of their row.
const ROW_BAND_FRACTION = 0.7;
// The target tick stands taller than the measure bar, like d3-bullet.
const TARGET_TICK_FRACTION = MEASURE_BAR_FRACTION * 1.8;

// Draws one range band from data [start, end, rowIndex] within its row.
const renderRowBand: CustomSeriesRenderItem = (_params, api) => {
  const row = Number(api.value(2));
  const start = api.coord([api.value(0), row]);
  const end = api.coord([api.value(1), row]);
  const rowSize = api.size ? (api.size([0, 1]) as number[])[1] : 0;
  const height = rowSize * ROW_BAND_FRACTION;
  return {
    type: 'rect',
    shape: {
      x: start[0],
      y: start[1] - height / 2,
      width: Math.max(end[0] - start[0], 0),
      height,
    },
    style: api.style(),
  };
};
// Small pixel gap below the measure bar so the target/marker symbol doesn't
// touch its edge.
const MARKER_GAP_BELOW_BAR_PX = 12;

export default function transformProps(
  chartProps: EchartsBulletChartProps,
): BulletChartTransformedProps {
  const { width, height, formData, queriesData, theme, hooks } = chartProps;
  const {
    metric,
    groupby,
    ranges: rawRanges,
    rangeLabels: rawRangeLabels,
    rangeColors,
    markers: rawMarkers,
    markerLabels: rawMarkerLabels,
    markerLines: rawMarkerLines,
    markerLineLabels: rawMarkerLineLabels,
    targetMetric,
    markerLineMetrics,
    markerMetrics,
    rangesRelative,
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

  // Each row's own target, read from the same grouped query as the measure.
  const targetLabel = targetMetric ? getMetricLabel(targetMetric) : '';
  const targets = categories.map((_, i) =>
    getMetricValue(rows[i], targetMetric),
  );
  const definedTargets = targets.filter(
    (value): value is number => value !== undefined,
  );

  // Match the legacy default: a single band up to 110% of the measure.
  const typedRanges = tokenizeToNumericArray(rawRanges);
  const ranges = typedRanges ?? [0, measure * 1.1];
  // Relative ranges are percentages of each row's target, so every row
  // gets its own thresholds; otherwise all rows share the typed ones.
  const relativeRanges = Boolean(
    rangesRelative && typedRanges && definedTargets.length,
  );
  const rowRanges = categories.map((_, i) => {
    if (!relativeRanges) return ranges;
    const target = targets[i];
    return target === undefined
      ? []
      : ranges.map(percent => (target * percent) / 100);
  });
  const rangeLabels = tokenizeToStringArray(rawRangeLabels) ?? [];
  // Metric-driven markers and marker lines all come from the single row of
  // the second, ungrouped query and join their typed counterparts, each
  // labelled with its metric name. Metrics without a value draw nothing.
  const chartWideRow = queriesData[1]?.data?.[0];
  const withMetricValues = (
    typedValues: number[],
    typedLabels: string[],
    metrics: EchartsBulletFormData['markerMetrics'],
  ) => {
    const fromMetrics = removeDuplicates(
      ensureIsArray(metrics),
      getMetricLabel,
    ).flatMap(boundMetric => {
      const value = getMetricValue(chartWideRow, boundMetric);
      return value === undefined
        ? []
        : [{ value, label: getMetricLabel(boundMetric) }];
    });
    return {
      values: [...typedValues, ...fromMetrics.map(({ value }) => value)],
      labels: fromMetrics.length
        ? [
            ...typedValues.map((_, i) => typedLabels[i] ?? ''),
            ...fromMetrics.map(({ label }) => label),
          ]
        : typedLabels,
    };
  };
  const { values: markers, labels: markerLabels } = withMetricValues(
    tokenizeToNumericArray(rawMarkers) ?? [],
    tokenizeToStringArray(rawMarkerLabels) ?? [],
    markerMetrics,
  );
  const { values: markerLines, labels: markerLineLabels } = withMetricValues(
    tokenizeToNumericArray(rawMarkerLines) ?? [],
    tokenizeToStringArray(rawMarkerLineLabels) ?? [],
    markerLineMetrics,
  );

  const formatter = getNumberFormatter(yAxisFormat);

  const allRangeValues = rowRanges.flat();
  const axisMin = Math.min(
    0,
    ...measures,
    ...allRangeValues,
    ...definedTargets,
    ...markers,
    ...markerLines,
  );
  let axisMax = Math.max(
    ...measures,
    ...allRangeValues,
    ...definedTargets,
    ...markers,
    ...markerLines,
  );
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
  // Custom colors (if any) are authored positionally against the original,
  // pre-sort `ranges` order via the `range_colors` control -- capture each
  // range's color here, before the descending sort below reorders them.
  const sortedRanges = [...ranges]
    .map((value, i) => ({
      value,
      label: rangeLabels[i],
      // Colors only apply to user-entered ranges; the automatic fallback band
      // must not pick up a stale `range_colors` entry kept from earlier edits.
      color: typedRanges ? rangeColors?.[i] || undefined : undefined,
      index: i,
    }))
    .filter(({ value }) => relativeRanges || value > axisMin)
    .sort((a, b) => b.value - a.value);
  // Each band's label sits inside its own top-right corner: the visible strip
  // of a nested band ends at its threshold, so the label lands inside the
  // range it names and the rightmost label cannot clip at the chart edge.
  const getBandLabelColor = (fill?: string): string => {
    const luminance = fill ? getColorLuminance(fill) : null;
    if (luminance === null) return theme.colorTextSecondary;
    // Fixed light/dark foregrounds, not `theme.colorText`: that token flips
    // to a light color in dark themes and would vanish on a light custom
    // fill. Pick whichever foreground actually contrasts better against
    // this fill, rather than a single magic luminance cutoff that doesn't
    // match where white and the dark foreground really break even.
    return wcagContrast(luminance, BAND_LABEL_LUMINANCE.light) >=
      wcagContrast(luminance, BAND_LABEL_LUMINANCE.dark)
      ? BAND_LABEL_COLORS.light
      : BAND_LABEL_COLORS.dark;
  };
  // Bands are drawn outermost first, so a band without its own opaque color
  // shows the nearest outer opaque custom fill; its label must contrast with
  // that. Only a fill known to be translucent defers outward: an opaque color
  // `getColorLuminance` can't parse (e.g. a named CSS color) still covers the
  // band beneath it, so its label keeps the default color.
  let outerCustomFill: string | undefined;
  const bandLabelFills = sortedRanges.map(({ color }) => {
    const translucent =
      !!color &&
      getColorLuminance(color) === null &&
      /^(#[0-9a-f]{8}|rgba\()/i.test(color.trim());
    if (color && !translucent) outerCustomFill = color;
    return outerCustomFill;
  });
  const bands = sortedRanges.map(({ value, label, color }, i) => ({
    name: label,
    itemStyle: {
      // A custom `range_colors` entry wins; otherwise fall back to the
      // default theme-token ramp exactly as before this control existed, so
      // Bullet charts saved without `range_colors` are unaffected.
      color: color || bandFills[Math.min(i, bandFills.length - 1)],
    },
    label: {
      show: Boolean(showLabels) && Boolean(label),
      position: 'insideTopRight',
      distance: theme.sizeUnit,
      // Labels sit inside the band, so a custom fill needs a foreground that
      // contrasts with it; theme-ramp fills keep the default label color.
      color: getBandLabelColor(bandLabelFills[i]),
      formatter: () => label ?? '',
    },
    // markArea item: [{start}, {end}]
    coords: [{ xAxis: axisMin }, { xAxis: value }],
  }));

  // Which labeled range a measure falls within, for the bar tooltip. Range
  // labels render at band edges, so naming the containing band on hover
  // disambiguates which side of a boundary a value sits on.
  const containingRangeLabel = (
    value: number,
    row: number,
  ): string | undefined => {
    const ascendingRanges = rowRanges[row]
      .map((threshold, i) => ({ value: threshold, label: rangeLabels[i] }))
      .sort((a, b) => a.value - b.value);
    const hit = ascendingRanges.find(range => value <= range.value);
    if (hit?.label) return hit.label;
    const last = ascendingRanges[ascendingRanges.length - 1];
    if (!hit && last?.label) return `> ${last.label}`;
    return undefined;
  };

  // Resolve by position rather than `indexOf(value)` so duplicate marker or
  // marker-line values each keep their own label instead of collapsing onto
  // the first match.
  const markerLabelAt = (index: number, labels: string[], values: number[]) =>
    labels[index] ? labels[index] : formatter(values[index]);

  const formatThreshold = (value: number) =>
    relativeRanges ? `${value}% ${t('of target')}` : formatter(value);
  const rangeName = (value: number, i: number) =>
    rangeLabels[i]
      ? `${rangeLabels[i]}: \u2264 ${formatThreshold(value)}`
      : `\u2264 ${formatThreshold(value)}`;
  const markerName = (value: number, i: number, labels: string[]) =>
    labels[i] ? `${labels[i]}: ${formatter(value)}` : String(formatter(value));

  // ECharts wraps a top legend onto extra rows but does not push the grid
  // down to make room, so estimate the wrapped row count from item text
  // widths and reserve grid space for it.
  const legendNames = [
    metricLabel,
    ...(definedTargets.length ? [targetLabel] : []),
    ...ranges.map(rangeName),
    ...markers.map((value, i) => markerName(value, i, markerLabels)),
    ...markerLines.map((value, i) => markerName(value, i, markerLineLabels)),
  ];
  const legendRowHeight = theme.fontSize + theme.sizeUnit * 3;
  const gridTop = showLegend
    ? estimateWrappedLegendRowCount({
        names: legendNames,
        availableWidth: width - theme.sizeUnit * 4,
        theme,
      }) *
        legendRowHeight +
      theme.sizeUnit * 2
    : theme.sizeUnit * 2;

  // The measure bar spans MEASURE_BAR_FRACTION of the category band
  // (roughly the grid height), so a percentage symbolOffset lands inside a
  // tall bar. Compute pixels: half the bar plus a small gap below it.
  const gridHeight = Math.max(height - gridTop - theme.sizeUnit * 6, 40);
  const rowHeight = gridHeight / Math.max(categories.length, 1);
  const markerOffsetPx = Math.round(
    (MEASURE_BAR_FRACTION / 2) * rowHeight + MARKER_GAP_BELOW_BAR_PX,
  );

  // Relative ranges differ per row, so they are drawn as per-row rectangles
  // instead of the chart-wide markArea used for typed ranges. Each shares its
  // name with the range's hover series so one legend entry toggles both.
  const rowBandSeries = relativeRanges
    ? sortedRanges.map(({ value, index, color }, i) => ({
        name: rangeName(value, index),
        type: 'custom',
        silent: true,
        renderItem: renderRowBand,
        encode: { x: [0, 1], y: 2 },
        // A custom `range_colors` entry wins, as for the markArea bands.
        itemStyle: {
          color: color || bandFills[Math.min(i, bandFills.length - 1)],
        },
        data: rowRanges.flatMap((thresholds, row) =>
          thresholds.length ? [[axisMin, thresholds[index], row]] : [],
        ),
        z: 1,
      }))
    : [];

  // One target tick per row that has a target value.
  const targetSeries = definedTargets.length
    ? [
        {
          name: targetLabel,
          type: 'scatter',
          data: targets.flatMap((target, row) =>
            target === undefined
              ? []
              : [
                  {
                    value: [target, row],
                    tooltip: {
                      formatter: () =>
                        sanitizeHtml(
                          `${grouped ? `${escapeHtml(categories[row])} \u2014 ` : ''}${escapeHtml(targetLabel)}: <b>${escapeHtml(formatter(target))}</b>`,
                        ),
                    },
                  },
                ],
          ),
          symbol: 'rect',
          symbolSize: [3, Math.max(TARGET_TICK_FRACTION * rowHeight, 8)],
          itemStyle: { color: theme.colorText },
          z: 25,
        },
      ]
    : [];

  const echartOptions: EChartsCoreOption = {
    animation: false,
    // Optional legend listing every range, marker and line as a toggleable
    // named entry; each is its own series so ECharts handles the toggling.
    legend: { show: Boolean(showLegend), top: 0 },
    grid: {
      top: gridTop,
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
    // The tooltip stays on regardless of the label and legend toggles: it is
    // the only place hover reveals which range a value falls within.
    tooltip: {
      confine: true,
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
            const prefix = grouped
              ? `${escapeHtml(categories[i])} \u2014 `
              : '';
            const band = containingRangeLabel(measures[i], i);
            const bandLine = band
              ? `<br/>${escapeHtml(t('Range'))}: ${escapeHtml(band)}`
              : '';
            const target = targets[i];
            const targetLine =
              target === undefined
                ? ''
                : `<br/>${escapeHtml(targetLabel)}: ${escapeHtml(formatter(target))}`;
            return sanitizeHtml(
              `${prefix}${escapeHtml(metricLabel)}: <b>${escapeHtml(formatter(measures[i]))}</b>${targetLine}${bandLine}`,
            );
          },
        },
        z: 10,
        markArea: {
          silent: true,
          data: (relativeRanges ? [] : bands).map(band => [
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
      ...rowBandSeries,
      ...targetSeries,
      ...ranges.map((value, index) => ({
        name: rangeName(value, index),
        type: 'scatter',
        data: categories.flatMap((_, row) => {
          const threshold = rowRanges[row][index];
          return threshold === undefined
            ? []
            : [
                {
                  value: [threshold, row],
                  tooltip: {
                    formatter: () =>
                      sanitizeHtml(
                        `${escapeHtml(rangeLabels[index] || '')} \u2264 <b>${escapeHtml(formatter(threshold))}</b>`,
                      ),
                  },
                },
              ];
        }),
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
                `${escapeHtml(markerLabelAt(index, markerLabels, markers))}: <b>${escapeHtml(formatter(value))}</b>`,
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
