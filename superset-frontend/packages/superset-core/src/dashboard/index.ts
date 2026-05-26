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
