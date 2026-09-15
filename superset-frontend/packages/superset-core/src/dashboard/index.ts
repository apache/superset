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
 * @fileoverview Dashboard API for Superset extensions.
 *
 * Exposes the dashboard currently active on the Dashboard surface (see
 * `navigation.getPage() === 'dashboard'`) so extensions can identify it and
 * read/apply its layout, custom CSS, and native filter values.
 */

/**
 * Gets the ID of the dashboard currently active on the Dashboard surface.
 *
 * @returns The current dashboard's ID, or undefined if none is active.
 *
 * @example
 * ```typescript
 * const dashboardId = dashboard.getDashboardId();
 * if (dashboardId != null) {
 *   console.log(`Dashboard ID: ${dashboardId}`);
 * }
 * ```
 */
export declare function getDashboardId(): number | undefined;

/**
 * Gets the current dashboard's full layout tree — one entry per component
 * (row, column, chart holder, tab, markdown, etc.), keyed by node ID. Each
 * entry has `children`, `parents`, `type`, `id`, and `meta` (grid
 * size/position and other component-specific settings).
 *
 * @returns A map of node ID to layout node.
 *
 * @example
 * ```typescript
 * const layout = dashboard.getLayout();
 * console.log(layout['CHART-abc123'].meta.width);
 * ```
 */
export declare function getLayout(): Record<string, unknown>;

/**
 * Updates a single layout node's `meta` (e.g. grid `width`/`height`, or
 * other component-specific settings) on the current dashboard. Only the
 * keys passed in `meta` are changed — the node's other meta fields, and the
 * rest of the layout, are left as-is.
 *
 * @param nodeId The layout node's ID, e.g. `'CHART-abc123'`. Use
 * `getLayout()` to find node IDs.
 * @param meta Meta fields to merge into the node.
 * @returns Promise that resolves once the layout has been updated.
 * @throws If no dashboard is active, or `nodeId` doesn't exist in the
 * layout.
 *
 * @example
 * ```typescript
 * await dashboard.updateLayoutNode('CHART-abc123', { width: 6, height: 50 });
 * ```
 */
export declare function updateLayoutNode(
  nodeId: string,
  meta: Record<string, unknown>,
): Promise<void>;

/**
 * Gets the current dashboard's custom CSS.
 *
 * @returns The current CSS string (empty string if unset).
 *
 * @example
 * ```typescript
 * const css = dashboard.getCss();
 * ```
 */
export declare function getCss(): string;

/**
 * Sets the current dashboard's custom CSS. Applies immediately to the
 * rendered page — no save required.
 *
 * @param css The new CSS.
 * @returns Promise that resolves once the CSS has been applied.
 * @throws If no dashboard is active.
 *
 * @example
 * ```typescript
 * await dashboard.setCss('.dashboard-header { background: #f5f5f5; }');
 * ```
 */
export declare function setCss(css: string): Promise<void>;

/**
 * Represents one of the current dashboard's native filters, along with its
 * currently-applied value.
 */
export interface DashboardFilter {
  /**
   * The filter's ID.
   */
  id: string;

  /**
   * The filter's display name.
   */
  name?: string;

  /**
   * The filter's type, e.g. `'filter_select'`, `'filter_range'`.
   */
  filterType?: string;

  /**
   * The columns/charts this filter targets.
   */
  targets?: unknown;

  /**
   * The filter's currently-applied query-modifying payload, if set.
   */
  extraFormData?: Record<string, unknown>;

  /**
   * The filter's currently-applied UI state (e.g. selected values), if set.
   */
  filterState?: Record<string, unknown>;
}

/**
 * Gets the current dashboard's native filters, including their
 * currently-applied values.
 *
 * @returns The dashboard's filters.
 *
 * @example
 * ```typescript
 * const filters = dashboard.getFilters();
 * ```
 */
export declare function getFilters(): DashboardFilter[];

/**
 * One filter value update, as passed to {@link updateFilters}.
 */
export interface FilterValueUpdate {
  /**
   * The filter's ID. Use `getFilters()` to find filter IDs.
   */
  filterId: string;

  /**
   * The new query-modifying payload to apply.
   */
  extraFormData?: Record<string, unknown>;

  /**
   * The new UI state (e.g. selected values) to apply.
   */
  filterState?: Record<string, unknown>;
}

/**
 * Applies new values to one or more of the current dashboard's native
 * filters — the same effect as a user changing a value in the Filter Bar.
 * Every chart the affected filter(s) target re-queries and re-renders.
 *
 * @param updates The filter value updates to apply.
 * @returns Promise that resolves once the updates have been applied.
 * @throws If no dashboard is active.
 *
 * @example
 * ```typescript
 * await dashboard.updateFilters([
 *   { filterId: 'NATIVE_FILTER-abc123', filterState: { value: ['US'] } },
 * ]);
 * ```
 */
export declare function updateFilters(
  updates: FilterValueUpdate[],
): Promise<void>;
