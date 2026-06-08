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
 * @fileoverview Dashboard namespace for Superset extensions (P3).
 *
 * Exposes dashboard identity and filter state as a stable semantic API.
 * Extensions must not depend on the Redux dashboard slice structure directly.
 */

import { Event } from '../common';

/**
 * A single native filter's current selected value(s).
 * The value type is intentionally kept as `unknown` because filter values
 * are heterogeneous (date ranges, string lists, numbers, etc.).
 */
export interface FilterValue {
  /** The filter's stable id. */
  filterId: string;
  /** Display label of the filter. */
  label: string;
  /** Currently applied value, or `null` when the filter is cleared. */
  value: unknown;
}

/**
 * Summary of a single chart on the active dashboard.
 *
 * Exposes the identity, viz type, datasource, and current visibility of a
 * chart so extensions can answer both "which charts are visible?" and
 * "find the chart named X" without additional lookups.
 */
export interface ChartSummary {
  /** Numeric chart (slice) id. */
  chartId: number;
  /** Display name of the chart. */
  chartName: string;
  /** Visualization type key (e.g. `'echarts_timeseries_bar'`). */
  vizType: string;
  /** Datasource id, or `null` when not resolvable. */
  datasourceId: number | null;
  /** Datasource name, or `null` when not resolvable. */
  datasourceName: string | null;
  /** Whether the chart is currently visible (e.g. on the active tab). */
  isVisible: boolean;
}

/**
 * Normalized dashboard context exposed to extensions on the Dashboard page.
 */
export interface DashboardContext {
  /** Numeric dashboard id. */
  dashboardId: number;
  /** Display title of the dashboard. */
  title: string;
  /**
   * Active native filter values keyed by filter id.
   * Only includes filters that have a value applied.
   */
  filters: FilterValue[];
  /**
   * Summaries of the dashboard's charts, including per-chart visibility.
   *
   * Optional: the contract is declared so extensions can compile against the
   * stable shape, but population is delivered in a later phase (see
   * CHATBOT_SIP.md §10/§11). The host returns an empty array until then.
   */
  charts?: ChartSummary[];
}

/**
 * Returns the normalized dashboard context for the page currently being viewed,
 * or `undefined` when the user is not on a Dashboard page.
 *
 * @example
 * ```typescript
 * const dash = dashboard.getCurrentDashboard();
 * if (dash) {
 *   console.log(dash.title, dash.filters);
 * }
 * ```
 */
export declare function getCurrentDashboard(): DashboardContext | undefined;

/**
 * Event fired when the dashboard identity or its active filter values change.
 * Fired on native filter value changes and on navigation to a different dashboard.
 *
 * @example
 * ```typescript
 * const sub = dashboard.onDidChangeDashboard(dash => {
 *   chatbot.updateContext({ dashboard: dash });
 * });
 * sub.dispose();
 * ```
 */
export declare const onDidChangeDashboard: Event<DashboardContext>;
