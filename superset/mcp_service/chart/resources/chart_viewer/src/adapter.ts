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
import type { EChartsOption } from 'echarts';
import type { ChartData, DataColumn, ViewType } from './types';
import {
  formatAxisDate,
  formatDate,
  formatFull,
  formatNumber,
  stripUntrustedMarkers,
  toDate,
  toNumber,
} from './format';
import {
  getCategoricalPalette,
  type SupersetThemeTokens,
  type ThemeTokens,
} from './theme';

/** Options passed to the adapter alongside the data. */
export interface AdapterOptions {
  theme: ThemeTokens;
  /** Restrict rendering to a subset of numeric columns (metric switcher). */
  activeMetrics?: string[];
}

/** Column classification result for a ChartData payload. */
export interface ColumnRoles {
  temporal: DataColumn[];
  numeric: DataColumn[];
  strings: DataColumn[];
  /** The chosen x-axis (dimension) column, if any. */
  dimension: DataColumn | null;
  /** True when the dimension is a temporal column. */
  dimensionIsTemporal: boolean;
}

/** Split columns into semantic roles and pick a sensible x dimension. */
export function classifyColumns(data: ChartData): ColumnRoles {
  const temporal = data.columns.filter((c) => c.data_type === 'temporal');
  const numeric = data.columns.filter((c) => c.data_type === 'numeric');
  const strings = data.columns.filter(
    (c) => c.data_type === 'string' || c.data_type === 'boolean',
  );
  const dimension = temporal[0] ?? strings[0] ?? null;
  return {
    temporal,
    numeric,
    strings,
    dimension,
    dimensionIsTemporal: !!dimension && dimension.data_type === 'temporal',
  };
}

/** Map an incoming Superset viz_type to the best-fit default view. */
export function defaultViewForChartType(
  chartType: string,
  data?: ChartData,
): ViewType {
  const t = (chartType || '').toLowerCase();
  if (t.includes('big_number')) return 'big_number';
  if (t === 'table' || t === 'pivot_table' || t.includes('table'))
    return 'table';
  if (t.includes('area')) return 'area';
  if (t.includes('bar') || t.includes('histogram') || t.includes('dist_bar'))
    return 'bar';
  if (t.includes('line') || t.includes('timeseries')) return 'line';
  if (t === 'pie') return 'bar';
  // Fall back based on data shape when the viz_type is unknown.
  if (data) {
    const roles = classifyColumns(data);
    if (roles.numeric.length === 1 && data.row_count <= 1) return 'big_number';
    if (roles.dimension && roles.numeric.length) {
      return roles.dimensionIsTemporal ? 'line' : 'bar';
    }
    return 'table';
  }
  return 'table';
}

/** Which view types are worth offering for this dataset. */
export function availableViews(data: ChartData): ViewType[] {
  const roles = classifyColumns(data);
  const views: ViewType[] = [];
  const hasSeries = !!roles.dimension && roles.numeric.length > 0;
  if (hasSeries) {
    views.push('line', 'bar', 'area');
  }
  if (roles.numeric.length >= 1) views.push('big_number');
  views.push('table');
  return views;
}

const AXIS_LABEL_LIMIT = 24;

function truncate(label: string): string {
  return label.length > AXIS_LABEL_LIMIT
    ? `${label.slice(0, AXIS_LABEL_LIMIT - 1)}…`
    : label;
}

/**
 * Pure adapter: turn a ChartData payload + a chosen view type into a fully
 * styled ECharts option object. Never throws for empty/odd data — callers
 * render dedicated empty/error states instead.
 */
export function chartDataToEChartsOption(
  data: ChartData,
  viewType: ViewType,
  options: AdapterOptions,
): EChartsOption {
  const roles = classifyColumns(data);
  const activeNumeric =
    options.activeMetrics && options.activeMetrics.length
      ? roles.numeric.filter((c) => options.activeMetrics!.includes(c.name))
      : roles.numeric;

  switch (viewType) {
    case 'big_number':
      // Big number is rendered by a React component, not ECharts; return an
      // empty option (App decides which renderer to mount).
      return {};
    case 'bar':
      return buildCartesian(data, roles, activeNumeric, options.theme, 'bar');
    case 'area':
      return buildCartesian(data, roles, activeNumeric, options.theme, 'area');
    case 'line':
    default:
      return buildCartesian(data, roles, activeNumeric, options.theme, 'line');
  }
}

type SeriesKind = 'line' | 'bar' | 'area';

function buildCartesian(
  data: ChartData,
  roles: ColumnRoles,
  numeric: DataColumn[],
  theme: ThemeTokens,
  kind: SeriesKind,
): EChartsOption {
  const dim = roles.dimension;
  const isTemporal = roles.dimensionIsTemporal;
  const rows = data.data ?? [];
  // Lead with the deployment's primary color when themed.
  const palette = getCategoricalPalette(
    (data.theme ?? null) as SupersetThemeTokens | null,
  );
  const showLegend = numeric.length > 1;

  // Build x-axis category values (stringified) from the dimension column.
  const xValues = dim
    ? rows.map((r) => normalizeDim(r[dim.name], isTemporal))
    : rows.map((_, i) => String(i));

  const series = numeric.map((col, idx) => {
    const color = palette[idx % palette.length];
    const points = rows.map((r) => toNumber(r[col.name]));
    const isArea = kind === 'area';
    const isBar = kind === 'bar';
    return {
      // Stable id keyed on the metric enables ECharts universal transitions
      // so bars morph into lines when the view switches.
      id: col.name,
      name: col.display_name || col.name,
      type: isBar ? ('bar' as const) : ('line' as const),
      data: points,
      smooth: !isBar,
      smoothMonotone: 'x' as const,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 7,
      universalTransition: { enabled: true },
      animationDurationUpdate: 500,
      lineStyle: isBar ? undefined : { width: 2.5, color },
      itemStyle: {
        color,
        borderRadius: isBar
          ? ([3, 3, 0, 0] as [number, number, number, number])
          : 0,
      },
      emphasis: { focus: 'series' as const },
      areaStyle: isArea ? gradient(color, theme) : undefined,
      barMaxWidth: 48,
    };
  });

  const grid = {
    left: 8,
    right: 16,
    top: showLegend ? 44 : 20,
    bottom: 8,
    containLabel: true,
  };

  return {
    color: palette,
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: theme.fontSans, color: theme.textSecondary },
    legend: showLegend
      ? {
          show: true,
          top: 8,
          left: 0,
          icon: 'roundRect',
          itemWidth: 12,
          itemHeight: 12,
          itemGap: 16,
          textStyle: { color: theme.textSecondary, fontSize: 12 },
        }
      : { show: false },
    grid,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: kind === 'bar' ? 'shadow' : 'line',
        lineStyle: { color: theme.axisLine },
      },
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: theme.textPrimary, fontSize: 12 },
      extraCssText:
        'box-shadow: 0 4px 16px rgba(0,0,0,0.12); border-radius: 8px;',
      formatter: (params: unknown) => tooltipFormatter(params, dim, isTemporal),
    },
    xAxis: {
      type: 'category',
      data: xValues,
      boundaryGap: kind === 'bar',
      name: dim ? dim.display_name || dim.name : '',
      nameLocation: 'middle',
      nameGap: 34,
      nameTextStyle: { color: theme.textMuted, fontSize: 11, fontWeight: 500 },
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 11,
        hideOverlap: true,
        formatter: (v: string) =>
          isTemporal ? formatAxisDate(v) : truncate(String(v)),
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.gridLine } },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 11,
        formatter: (v: number) => formatNumber(v),
      },
    },
    series,
  };
}

function normalizeDim(value: unknown, isTemporal: boolean): string {
  if (isTemporal) {
    const d = toDate(value);
    if (d) return d.toISOString();
  }
  // Category values reach axis labels, tooltips, and drill payloads, so the
  // trust delimiters have to come off here rather than at each display site.
  return stripUntrustedMarkers(String(value ?? ''));
}

function gradient(color: string, theme: ThemeTokens) {
  const topAlpha = theme.scheme === 'dark' ? 0.45 : 0.35;
  return {
    opacity: 1,
    color: {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: withAlpha(color, topAlpha) },
        { offset: 1, color: withAlpha(color, 0.02) },
      ],
    },
  };
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface AxisTooltipParam {
  axisValue: unknown;
  marker: string;
  seriesName: string;
  value: unknown;
}

export function tooltipFormatter(
  params: unknown,
  dim: DataColumn | null,
  isTemporal: boolean,
): string {
  const list = (
    Array.isArray(params) ? params : [params]
  ) as AxisTooltipParam[];
  if (!list.length) return '';
  const header = isTemporal
    ? formatDate(list[0].axisValue)
    : String(list[0].axisValue ?? '');
  const label = dim ? dim.display_name || dim.name : '';
  // ECharts renders this formatter's return value as HTML, so every
  // data-derived string must be escaped. formatFull falls back to the raw
  // value for non-numeric input, so it is escaped too. ``p.marker`` is
  // ECharts-generated markup (a colored swatch), not user data.
  const rows = list
    .map(
      (p) =>
        `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px;">
           <span>${p.marker} ${escapeHtml(p.seriesName)}</span>
           <strong>${escapeHtml(formatFull(p.value))}</strong>
         </div>`,
    )
    .join('');
  return `<div style="font-weight:600;margin-bottom:2px;">${escapeHtml(header)}</div>
          ${label ? `<div style="font-size:11px;opacity:0.6;">${escapeHtml(label)}</div>` : ''}
          ${rows}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Resolve the single KPI value + label for the big-number view. */
export function resolveBigNumber(data: ChartData): {
  value: unknown;
  label: string;
  column: DataColumn | null;
  spark: { x: string[]; y: (number | null)[] } | null;
} {
  const roles = classifyColumns(data);
  const col = roles.numeric[0] ?? null;
  const rows = data.data ?? [];
  let value: unknown = null;
  if (col && rows.length) {
    // Last row is the most recent point for a time series; otherwise sum.
    if (roles.dimensionIsTemporal) {
      value = rows[rows.length - 1][col.name];
    } else if (rows.length === 1) {
      value = rows[0][col.name];
    } else {
      value = rows.reduce((acc, r) => acc + (toNumber(r[col.name]) ?? 0), 0);
    }
  }
  let spark: { x: string[]; y: (number | null)[] } | null = null;
  if (col && roles.dimensionIsTemporal && roles.dimension && rows.length > 1) {
    spark = {
      x: rows.map((r) => normalizeDim(r[roles.dimension!.name], true)),
      y: rows.map((r) => toNumber(r[col.name])),
    };
  }
  return {
    value,
    label: col
      ? col.display_name || col.name
      : stripUntrustedMarkers(data.chart_name),
    column: col,
    spark,
  };
}

/** Build a minimal sparkline option for the big-number view. */
export function buildSparklineOption(
  spark: { x: string[]; y: (number | null)[] },
  theme: ThemeTokens,
): EChartsOption {
  return {
    animation: true,
    grid: { left: 0, right: 0, top: 4, bottom: 4 },
    xAxis: { type: 'category', data: spark.x, show: false, boundaryGap: false },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: { show: false },
    series: [
      {
        type: 'line',
        data: spark.y,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: theme.accent },
        areaStyle: gradient(theme.accent, theme),
      },
    ],
  };
}
