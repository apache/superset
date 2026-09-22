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
 * One component (row, column, chart holder, tab, markdown, etc.) in a
 * dashboard's layout tree, as returned by {@link getLayout}.
 */
export interface LayoutNode {
  /** IDs of this node's child components, in display order. */
  children: string[];

  /** IDs of this node's ancestor components, root first. */
  parents?: string[];

  /** Component type, e.g. `'CHART'`, `'ROW'`, `'TABS'`, `'MARKDOWN'`. */
  type: string;

  /** This node's own ID, e.g. `'CHART-abc123'`. */
  id: string;

  /** Grid size/position and other component-specific settings. */
  meta: {
    chartId?: number;
    width?: number;
    height?: number;
    [key: string]: unknown;
  };
}

/**
 * Gets the current dashboard's full layout tree — one entry per component
 * (row, column, chart holder, tab, markdown, etc.), keyed by node ID.
 *
 * @returns A map of node ID to layout node.
 *
 * @example
 * ```typescript
 * const layout = dashboard.getLayout();
 * const chartNode = layout['CHART-abc123'];
 * console.log(chartNode.meta.width);
 * ```
 */
export declare function getLayout(): Record<string, LayoutNode>;

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
 * One filter definition update, as passed to {@link saveFilters}.
 */
export interface FilterConfigUpdate {
  /**
   * The filter's ID. Must be an existing filter on this dashboard —
   * `saveFilters` does not create new ones. Use `getFilters()` to find
   * filter IDs.
   */
  filterId: string;

  /**
   * The filter's new display name.
   */
  name?: string;

  /**
   * The filter's new target columns/charts.
   */
  targets?: unknown;

  /**
   * The filter's new default value — applied when the dashboard next loads
   * or the filter is reset — in the same shape as a filter's
   * `extraFormData`/`filterState`.
   */
  defaultDataMask?: {
    extraFormData?: Record<string, unknown>;
    filterState?: Record<string, unknown>;
  };
}

/**
 * Persists changes to the current dashboard's native filter *definitions* —
 * as opposed to {@link updateFilters}, which only changes a filter's
 * currently-applied value for this browser session. Changes saved here are
 * visible to every future viewer of this dashboard, the same as saving
 * through the Filter Bar's "Edit filters" UI.
 *
 * Does not create new filters or reorder existing ones — only edits or
 * deletes filters that already exist on this dashboard.
 *
 * @param updates The filter definitions to update.
 * @param deletedFilterIds IDs of filters to delete.
 * @returns Promise that resolves once the changes have been saved and
 * applied to this session.
 * @throws If no dashboard is active, an update references a filter ID that
 * doesn't exist on this dashboard, or the save fails.
 *
 * @example
 * ```typescript
 * await dashboard.saveFilters([
 *   { filterId: 'NATIVE_FILTER-abc123', name: 'Region (EMEA)' },
 * ]);
 * ```
 */
export declare function saveFilters(
  updates: FilterConfigUpdate[],
  deletedFilterIds?: string[],
): Promise<void>;

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

/**
 * Re-fetches the given chart's saved configuration from the server and
 * re-runs its query with the dashboard's currently-applied filters,
 * replacing whatever is currently rendered for it.
 *
 * Superset does not otherwise learn of a chart's configuration changing
 * while its dashboard is open — e.g. a change made through the REST API by
 * something other than this dashboard session — until the page is
 * reloaded. This re-syncs a single chart without one.
 *
 * @param chartId The chart's ID. Use `getLayout()` to find chart IDs on
 * this dashboard — each `CHART`-type node's `meta.chartId`.
 * @returns Promise that resolves once the chart has been re-queried and
 * re-rendered with its latest saved configuration.
 * @throws If no dashboard is active, the chart isn't on this dashboard, or
 * its configuration couldn't be retrieved.
 *
 * @example
 * ```typescript
 * await dashboard.refreshChart(123);
 * ```
 */
export declare function refreshChart(chartId: number): Promise<void>;
