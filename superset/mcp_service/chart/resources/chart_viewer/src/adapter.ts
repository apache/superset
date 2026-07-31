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
  formatByColumn,
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

/** True for the view types rendered by an ECharts instance. */
export function isEChartsView(view: ViewType): boolean {
  return view !== 'table' && view !== 'big_number';
}

/** True for the views drawn on a cartesian grid with a category x-axis. */
export function isCartesianView(view: ViewType): boolean {
  return view === 'line' || view === 'bar' || view === 'area';
}

/** A pie needs one slice dimension and one measure. */
function canRenderPie(roles: ColumnRoles): boolean {
  return !!roles.dimension && roles.numeric.length >= 1;
}

/** A scatter needs two measures (x and y). */
function canRenderScatter(roles: ColumnRoles): boolean {
  return roles.numeric.length >= 2;
}

/** Map an incoming Superset viz_type to the best-fit default view. */
export function defaultViewForChartType(
  chartType: string,
  data?: ChartData,
): ViewType {
  const t = (chartType || '').toLowerCase();
  const roles = data ? classifyColumns(data) : null;
  if (t.includes('big_number')) return 'big_number';
  if (t === 'table' || t === 'pivot_table' || t.includes('table'))
    return 'table';
  // `pie` / `donut` / `rose` all map onto the same part-of-whole renderer.
  // Without a dimension + measure there is nothing to slice, so fall through.
  if (t.includes('pie') || t.includes('donut') || t.includes('rose')) {
    if (!roles || canRenderPie(roles)) return 'pie';
  }
  if (t.includes('scatter') || t.includes('bubble')) {
    if (!roles || canRenderScatter(roles)) return 'scatter';
  }
  if (t.includes('area')) return 'area';
  if (t.includes('bar') || t.includes('histogram') || t.includes('dist_bar'))
    return 'bar';
  if (t.includes('line') || t.includes('timeseries')) return 'line';
  // Fall back based on data shape when the viz_type is unknown.
  if (data && roles) {
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
  if (canRenderPie(roles)) views.push('pie');
  if (canRenderScatter(roles)) views.push('scatter');
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

  if (viewType === 'big_number') {
    // Big number is rendered by a React component, not ECharts; return an
    // empty option (App decides which renderer to mount).
    return {};
  }

  let option: EChartsOption;
  switch (viewType) {
    case 'pie':
      option = buildPie(data, roles, activeNumeric, options.theme);
      break;
    case 'scatter':
      // A scatter needs two measures. Metric chips can narrow the active set
      // below that, so fall back to the full numeric set before giving up.
      option = buildScatter(
        data,
        roles,
        activeNumeric.length >= 2 ? activeNumeric : roles.numeric,
        options.theme,
      );
      break;
    case 'bar':
      option = buildCartesian(data, roles, activeNumeric, options.theme, 'bar');
      break;
    case 'area':
      option = buildCartesian(data, roles, activeNumeric, options.theme, 'area');
      break;
    case 'line':
    default:
      option = buildCartesian(data, roles, activeNumeric, options.theme, 'line');
  }

  // A canvas is opaque to assistive technology, so every rendered option
  // carries a text alternative that ECharts puts on the container element.
  return {
    ...option,
    aria: {
      enabled: true,
      label: {
        enabled: true,
        description: describeChart(data, viewType, activeNumeric),
      },
    },
  };
}

const VIEW_NOUNS: Record<ViewType, string> = {
  line: 'Line chart',
  bar: 'Bar chart',
  area: 'Area chart',
  pie: 'Pie chart',
  scatter: 'Scatter plot',
  table: 'Table',
  big_number: 'Big number',
};

/**
 * One-sentence text alternative for a rendered chart: what it plots, over how
 * many points, and where the shape actually is. Pure and exported so the
 * wording is testable rather than buried in a canvas.
 */
export function describeChart(
  data: ChartData,
  viewType: ViewType,
  numeric?: DataColumn[],
): string {
  const roles = classifyColumns(data);
  const measures = (numeric?.length ? numeric : roles.numeric).map(
    (c) => c.display_name || c.name,
  );
  const rows = data.data ?? [];
  const noun = VIEW_NOUNS[viewType] ?? 'Chart';
  const name = stripUntrustedMarkers(data.chart_name || 'Chart');
  if (!rows.length) return `${noun} "${name}": no data.`;

  const dim = roles.strings[0] ?? roles.dimension;
  if (viewType === 'pie' && dim && measures.length) {
    const slices = buildPieSlices(
      data,
      (numeric?.length ? numeric : roles.numeric)[0],
      dim,
    );
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    const top = slices[0];
    const share = top && total > 0 ? Math.round((top.value / total) * 100) : 0;
    return (
      `${noun} "${name}": share of ${measures[0]} by ` +
      `${dim.display_name || dim.name} across ${slices.length} categories. ` +
      `Largest is ${top?.name} at ${formatFull(top?.value)} (${share}%). ` +
      `Switch to the table view for every value.`
    );
  }

  if (viewType === 'scatter' && measures.length >= 2) {
    return (
      `${noun} "${name}": ${measures[1]} against ${measures[0]} ` +
      `over ${rows.length} points. Switch to the table view for every value.`
    );
  }

  const dimension = roles.dimension;
  const span =
    dimension && rows.length > 1
      ? `, from ${formatByColumn(rows[0][dimension.name], dimension)} to ` +
        `${formatByColumn(rows[rows.length - 1][dimension.name], dimension)}`
      : '';
  const by = dimension
    ? ` by ${dimension.display_name || dimension.name}`
    : '';
  return (
    `${noun} "${name}": ${measures.join(', ') || 'no measures'}${by} ` +
    `over ${rows.length} points${span}. ` +
    `Switch to the table view for every value.`
  );
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

/**
 * Slices beyond this are collapsed into a single "Other" wedge. A pie stops
 * communicating anything past a dozen or so slices, and Superset routinely
 * returns high-cardinality dimensions.
 */
export const PIE_MAX_SLICES = 12;

/** One pie wedge. `rowIndex` maps back to the source row (-1 for "Other"). */
export interface PieSlice {
  name: string;
  value: number;
  rowIndex: number;
}

/**
 * Build the wedges for a pie: label from the dimension, value from the first
 * active measure, largest first, with a long tail collapsed into "Other".
 * Exported so the slice math can be tested without an ECharts instance.
 */
export function buildPieSlices(
  data: ChartData,
  metric: DataColumn,
  dimension: DataColumn,
): PieSlice[] {
  const rows = data.data ?? [];
  const all: PieSlice[] = rows.map((r, rowIndex) => ({
    // formatByColumn strips the untrusted-content markers and renders dates
    // readably; wedge labels are display text, never filter values.
    name: formatByColumn(r[dimension.name], dimension) || String(rowIndex),
    value: toNumber(r[metric.name]) ?? 0,
    rowIndex,
  }));
  // Negative measures cannot be expressed as a share of a whole; drop them
  // rather than drawing a wedge that lies about its proportion.
  const usable = all.filter((s) => s.value > 0);
  const ordered = usable.slice().sort((a, b) => b.value - a.value);
  if (ordered.length <= PIE_MAX_SLICES) return ordered;
  const head = ordered.slice(0, PIE_MAX_SLICES);
  const tail = ordered.slice(PIE_MAX_SLICES);
  head.push({
    name: `Other (${tail.length})`,
    value: tail.reduce((sum, s) => sum + s.value, 0),
    rowIndex: -1,
  });
  return head;
}

function buildPie(
  data: ChartData,
  roles: ColumnRoles,
  numeric: DataColumn[],
  theme: ThemeTokens,
): EChartsOption {
  const metric = numeric[0] ?? roles.numeric[0] ?? null;
  // Prefer a categorical dimension: a pie of time buckets is legal but a
  // string dimension is almost always the intended part-of-whole split.
  const dimension = roles.strings[0] ?? roles.dimension;
  const palette = getCategoricalPalette(
    (data.theme ?? null) as SupersetThemeTokens | null,
  );
  if (!metric || !dimension) {
    return { color: palette, series: [] };
  }
  const slices = buildPieSlices(data, metric, dimension);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const metricLabel = metric.display_name || metric.name;

  return {
    color: palette,
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: theme.fontSans, color: theme.textSecondary },
    legend: {
      show: slices.length > 1,
      type: 'scroll',
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      textStyle: { color: theme.textSecondary, fontSize: 11 },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: theme.textPrimary, fontSize: 12 },
      extraCssText:
        'box-shadow: 0 4px 16px rgba(0,0,0,0.12); border-radius: 8px;',
      formatter: (params: unknown) =>
        pieTooltipFormatter(params, metricLabel, total),
    },
    series: [
      {
        // Shares the measure's id with the cartesian series so switching
        // between bar and pie morphs rather than cutting.
        id: metric.name,
        name: metricLabel,
        type: 'pie' as const,
        // A donut reads more precisely than a full pie and leaves room for
        // the centre label.
        radius: ['44%', '70%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        minAngle: 2,
        padAngle: 1,
        itemStyle: {
          borderColor: theme.panel,
          borderWidth: 2,
          borderRadius: 4,
        },
        label: {
          show: slices.length <= 8,
          color: theme.textSecondary,
          fontSize: 11,
          formatter: '{b}  {d}%',
        },
        labelLine: {
          length: 8,
          length2: 10,
          lineStyle: { color: theme.axisLine },
        },
        emphasis: {
          focus: 'self' as const,
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 600,
            color: theme.textPrimary,
          },
        },
        universalTransition: { enabled: true },
        animationDurationUpdate: 500,
        data: slices,
      },
    ],
  };
}

interface ItemTooltipParam {
  marker: string;
  name: unknown;
  value: unknown;
  percent?: number;
}

/** Tooltip for a pie wedge: label, absolute value and share of the whole. */
export function pieTooltipFormatter(
  params: unknown,
  metricLabel: string,
  total: number,
): string {
  const p = (Array.isArray(params) ? params[0] : params) as ItemTooltipParam;
  if (!p) return '';
  const value = toNumber(p.value) ?? 0;
  const percent =
    typeof p.percent === 'number'
      ? p.percent
      : total > 0
        ? (value / total) * 100
        : 0;
  // ECharts renders this as HTML, so every data-derived string is escaped.
  // ``p.marker`` is ECharts-generated markup, not user data.
  return `<div style="font-weight:600;margin-bottom:2px;">${escapeHtml(
    String(p.name ?? ''),
  )}</div>
          <div style="display:flex;justify-content:space-between;gap:16px;">
            <span>${p.marker} ${escapeHtml(metricLabel)}</span>
            <strong>${escapeHtml(formatFull(p.value))} (${percent.toFixed(1)}%)</strong>
          </div>`;
}

/** One scatter point: `[x, y]` plus the row it came from. */
export interface ScatterPoint {
  value: [number | null, number | null];
  name: string;
  rowIndex: number;
}

function buildScatter(
  data: ChartData,
  roles: ColumnRoles,
  numeric: DataColumn[],
  theme: ThemeTokens,
): EChartsOption {
  const palette = getCategoricalPalette(
    (data.theme ?? null) as SupersetThemeTokens | null,
  );
  const xCol = numeric[0] ?? null;
  const yCol = numeric[1] ?? null;
  if (!xCol || !yCol) {
    // Not enough measures to plot one against the other — degrade to the
    // cartesian renderer rather than emitting a broken option.
    return buildCartesian(data, roles, numeric, theme, 'line');
  }
  const rows = data.data ?? [];
  const label = roles.dimension;
  const points: ScatterPoint[] = rows.map((r, rowIndex) => ({
    value: [toNumber(r[xCol.name]), toNumber(r[yCol.name])],
    name: label
      ? formatByColumn(r[label.name], label)
      : `Row ${rowIndex + 1}`,
    rowIndex,
  }));
  const xLabel = xCol.display_name || xCol.name;
  const yLabel = yCol.display_name || yCol.name;

  return {
    color: palette,
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: theme.fontSans, color: theme.textSecondary },
    legend: { show: false },
    grid: { left: 8, right: 20, top: 20, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: theme.textPrimary, fontSize: 12 },
      extraCssText:
        'box-shadow: 0 4px 16px rgba(0,0,0,0.12); border-radius: 8px;',
      formatter: (params: unknown) =>
        scatterTooltipFormatter(params, xLabel, yLabel),
    },
    xAxis: {
      type: 'value',
      scale: true,
      name: xLabel,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: theme.textMuted, fontSize: 11, fontWeight: 500 },
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.gridLine } },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 11,
        formatter: (v: number) => formatNumber(v),
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: yLabel,
      nameTextStyle: { color: theme.textMuted, fontSize: 11, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.gridLine } },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 11,
        formatter: (v: number) => formatNumber(v),
      },
    },
    series: [
      {
        id: `${xCol.name}~${yCol.name}`,
        name: `${yLabel} vs ${xLabel}`,
        type: 'scatter' as const,
        symbolSize: 11,
        itemStyle: { color: palette[0], opacity: 0.78 },
        emphasis: { focus: 'series' as const, scale: 1.4 },
        data: points,
      },
    ],
  };
}

/** Tooltip for a scatter point: row label plus both measures. */
export function scatterTooltipFormatter(
  params: unknown,
  xLabel: string,
  yLabel: string,
): string {
  const p = (Array.isArray(params) ? params[0] : params) as {
    marker: string;
    name: unknown;
    value: unknown;
  };
  if (!p) return '';
  const pair = Array.isArray(p.value) ? p.value : [null, null];
  const row = (name: string, value: unknown): string =>
    `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px;">
       <span>${escapeHtml(name)}</span>
       <strong>${escapeHtml(formatFull(value))}</strong>
     </div>`;
  // Escaped for the same reason as the axis tooltip: ECharts renders HTML.
  return `<div style="font-weight:600;margin-bottom:2px;">${p.marker} ${escapeHtml(
    String(p.name ?? ''),
  )}</div>
          ${row(xLabel, pair[0])}
          ${row(yLabel, pair[1])}`;
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
