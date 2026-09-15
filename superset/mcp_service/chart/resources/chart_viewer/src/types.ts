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

/** Inferred, semantic data type for a column (Superset's real schema). */
export type DataType = 'numeric' | 'temporal' | 'string' | 'boolean';

/** Rich column metadata mirroring `DataColumn` in the MCP chart schemas. */
export interface DataColumn {
  name: string;
  display_name: string;
  data_type: DataType | string;
  sample_values: unknown[];
  null_count: number;
  unique_count: number;
  statistics?: Record<string, unknown> | null;
  semantic_type?: string | null;
}

/**
 * The tool result payload the widget receives. Mirrors `ChartData` in
 * `superset/mcp_service/chart/schemas.py`. Only the fields the widget uses are
 * typed strictly; the rest are optional/loose to stay forward compatible.
 */
export interface ChartData {
  chart_id: number;
  chart_name: string;
  /** A Superset viz_type string, e.g. "echarts_timeseries_line", "table", "pie". */
  chart_type: string;
  columns: DataColumn[];
  data: Array<Record<string, unknown>>;
  row_count: number;
  total_rows: number | null;
  summary?: string;
  insights?: string[];
  recommended_visualizations?: string[];
  data_quality?: Record<string, unknown>;
  data_freshness?: string | null;
  /** Absolute Explore deep link, set by the render_chart tool. */
  explore_url?: string;
  /** Superset design tokens (subset) so the widget matches the deployment. */
  theme?: Record<string, string>;
  [key: string]: unknown;
  /**
   * Set when the query was rebuilt outside Superset's viz plugins, so the
   * time grain, groupby, sort, pivot structure and any second series were
   * never applied. The VALUES may be wrong, not merely reordered — a monthly
   * chart can return individual days. Never present this as the chart's data
   * without saying so.
   */
  fidelity_warning?: string | null;
}

/** Optional extras the host may pass in the tool result `_meta`. */
export interface ChartMeta {
  /** Deep link to open the chart in Superset Explore. */
  explore_url?: string;
  [key: string]: unknown;
}

/** The view modes the widget can render. */
export type ViewType =
  | 'line'
  | 'bar'
  | 'area'
  | 'pie'
  | 'scatter'
  | 'table'
  | 'big_number';

/** Host color scheme. */
export type ColorScheme = 'light' | 'dark';

/**
 * Arguments the widget sends to the app-visible `render_chart_requery` tool.
 * Drill by filtering a clicked value or narrowing the time range — dimension
 * pivot (group_by) was removed server-side as it was a no-op.
 */
export interface RequeryArgs {
  chart_id: number;
  filter?: { col: string; val: unknown };
  time_range?: string;
  granularity?: string;
}

export const REQUERY_TOOL_NAME = 'render_chart_requery';

/**
 * One leaf of a rendered dashboard layout.
 *
 * A cell always renders something: `status` distinguishes real data from a
 * placeholder (a chart past the query cap) or a failure (its query errored).
 * Nothing is dropped — a composite that silently omits cells reads as though
 * it covered everything.
 */
export interface DashboardCell {
  chart_id?: number | null;
  title?: string | null;
  tab_id?: string | null;
  width?: number | null;
  height?: number | null;
  status: 'ok' | 'skipped' | 'error';
  message?: string | null;
  data?: ChartData | null;
}

/** A dashboard as a composite visualization: a layout plus its leaves. */
export interface DashboardRender {
  dashboard_id?: number | null;
  /** Tab the render was filtered to, when one was requested. */
  active_tab_id?: string | null;
  dashboard_title?: string | null;
  dashboard_url?: string | null;
  tabs: Array<{ id: string; name?: string | null; parent_tab_id?: string | null }>;
  cells: DashboardCell[];
  chart_count: number;
  rendered_count: number;
  theme?: Record<string, unknown> | null;
}
