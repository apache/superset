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

/**
 * The `echarts` widget's optional structured layer (`chartType`/`customize`
 * on `EchartsControls`, see `superset/widgets/controls.py`). Precedence,
 * matching the backend model's docstring:
 *   1. `echartsOptions` (already `$bind`-resolved) is the base.
 *   2. When `chartType` is set, `option.series` — and only `series` — is
 *      replaced with one generated series per `dataBinding` metric.
 *      Everything else the raw option authored (axes, legend, tooltip,
 *      title) survives unmanaged.
 *   3. `chartType` unset/null ("Custom") leaves the raw option untouched,
 *      including mixed-series or non-Cartesian (e.g. pie) shapes.
 *
 * A series is keyed by its metric's `getMetricLabel` — the same label the
 * `/api/v1/chart/data` result columns are named after, so `data` reads the
 * right column, and the same label the backend's `_metric_key` computes, so
 * a stored override matches by stable identity rather than array position.
 */
import { getMetricLabel } from '@superset-ui/core';
import type { QueryFormMetric } from '@superset-ui/core';
import type { dashboard as dashboardApi } from '@apache-superset/core';

type DataRow = dashboardApi.DataRow;

export type EchartsChartType = 'bar' | 'line' | 'scatter';

export interface SeriesOverrideValue {
  color?: string;
  visible?: boolean;
  displayName?: string;
}

// A categorical palette of distinct colors — one per series index. The
// literal hex is intentional (and must match the backend palette in
// `superset/widgets/builtin.py`'s `Echarts.PALETTE`, the same convention
// `BalloonsWidget`'s own `PALETTE` follows) so a series' color is stable
// before the author touches `customize`: the per-series schema control
// advertises `Echarts.PALETTE[index]` as that series' default swatch (see
// `_populate_chart_series`), so the rendered series has to fall back to the
// very same color, not ECharts' own default palette, or the swatch shown
// would lie about what's actually on screen.
const PALETTE = [
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#e74c3c',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#3498db',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#2ecc71',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#f1c40f',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#9b59b6',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#1abc9c',
];

/**
 * One ECharts series per metric, in `dataBinding.metrics` order. A metric
 * overridden with `visible: false` is omitted entirely (there is no ECharts
 * option for "present but hidden" that also frees its legend/tooltip slot).
 */
export function buildStructuredSeries(
  chartType: EchartsChartType,
  metrics: QueryFormMetric[],
  rows: DataRow[],
  overrides: Record<string, SeriesOverrideValue> | undefined,
): Record<string, unknown>[] {
  return metrics
    .map((metric, index): Record<string, unknown> | null => {
      const key = getMetricLabel(metric);
      const override = overrides?.[key];
      if (override?.visible === false) return null;
      return {
        name: override?.displayName || key,
        type: chartType,
        data: rows.map(row => row[key]),
        itemStyle: {
          color: override?.color || PALETTE[index % PALETTE.length],
        },
      };
    })
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

/**
 * Layers the structured series on top of an already `$bind`-resolved raw
 * option. Returns `resolved` unchanged when `chartType` is unset — the only
 * key this ever touches is `series`.
 */
export function applyStructuredEchartsSeries(
  resolved: Record<string, unknown>,
  chartType: EchartsChartType | null | undefined,
  metrics: QueryFormMetric[],
  rows: DataRow[],
  overrides: Record<string, SeriesOverrideValue> | undefined,
): Record<string, unknown> {
  if (!chartType) return resolved;
  return {
    ...resolved,
    series: buildStructuredSeries(chartType, metrics, rows, overrides),
  };
}
