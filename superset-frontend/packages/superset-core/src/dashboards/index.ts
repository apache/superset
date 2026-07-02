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
 * @fileoverview Dashboards API for custom dashboard renderers.
 *
 * This module defines the contract for replacing Superset's built-in
 * dashboard renderer with a custom implementation contributed by an
 * extension. It provides:
 *
 * - `DashboardRenderer`: Descriptor for a contributed renderer
 * - `DashboardRendererProps`: The props contract renderer components receive
 * - `registerDashboardRenderer`: Registration function (single slot)
 *
 * The dashboard renderer is a single-slot contribution point: at most one
 * custom renderer is active at a time, and the most recently registered
 * renderer wins. When no custom renderer is registered, the host renders
 * the built-in dashboard renderer.
 *
 * Custom renderers handle VIEW mode only. When a dashboard enters edit
 * mode, the host always renders the built-in renderer, returning to the
 * custom renderer when edit mode exits.
 *
 * The props contract is designed to be Redux-free: everything a renderer
 * needs to display a dashboard arrives via props, and host services are
 * available through the public `window.superset` namespaces. Renderer
 * components are mounted inside the host's theme providers, so `useTheme`
 * from `@apache-superset/core/theme` works as expected. Fetching chart
 * data (e.g. `POST /api/v1/chart/data`) and orchestrating filter-driven
 * chart refreshes are the renderer's responsibility.
 */

import { ComponentType } from 'react';
import { Disposable, Event } from '../common';

/**
 * Describes a dashboard renderer that can be contributed to the application.
 */
export interface DashboardRenderer {
  /** Unique identifier for the renderer (e.g., "acme.kiosk-dashboard") */
  id: string;
  /** Display name of the renderer */
  name: string;
  /** Optional description of the renderer */
  description?: string;
}

/**
 * Filter state for a single native filter or cross-filter emitter, keyed by
 * the filter id (native filters) or chart id (cross-filters).
 */
export interface DashboardDataMaskEntry {
  /** The native filter id or chart id this entry belongs to */
  id: string;
  /** UI-facing filter state (selected values, labels) */
  filterState?: Record<string, unknown>;
  /** Query-facing form data merged into affected charts' queries */
  extraFormData?: Record<string, unknown>;
  /** Renderer/chart-private state (e.g. table pagination, search) */
  ownState?: Record<string, unknown>;
}

/**
 * The complete filter state of a dashboard: one entry per active native
 * filter or cross-filter emitter, keyed by filter or chart id.
 */
export type DashboardDataMask = Record<string, DashboardDataMaskEntry>;

/**
 * Identity and parsed metadata for the dashboard being rendered.
 */
export interface DashboardInfo {
  /** Numeric dashboard id */
  id: number;
  /** Stable UUID of the dashboard */
  uuid?: string;
  /** URL slug, if one is set */
  slug?: string | null;
  /** Dashboard title */
  title: string;
  /** Custom CSS attached to the dashboard (already injected by the host) */
  css?: string | null;
  /**
   * Parsed `json_metadata`: `native_filter_configuration`,
   * `chart_configuration` (cross-filter scoping), `refresh_frequency`,
   * `color_scheme`, `default_filters`, and other dashboard-level settings.
   */
  metadata: Record<string, unknown>;
  /**
   * Parsed `position_json` — the layout component tree keyed by component
   * id (GRID_ID, ROOT_ID, CHART-*, TAB-*, ROW-*, ...), describing how
   * charts, tabs, rows, and columns are arranged.
   */
  layout: Record<string, unknown>;
  /** Whether the dashboard is published */
  isPublished?: boolean;
  /** Whether the dashboard is managed by an external system */
  isManagedExternally?: boolean;
}

/**
 * A chart (slice) definition as returned by
 * `GET /api/v1/dashboard/{id}/charts`. Identity fields are typed
 * explicitly; the remaining payload is passed through untyped.
 */
export interface DashboardChart {
  /** Numeric chart (slice) id */
  id: number;
  /** Chart display name */
  slice_name?: string;
  /** Visualization plugin type (e.g., "echarts_timeseries_line") */
  viz_type?: string;
  /** The chart's stored form data (query + display configuration) */
  form_data?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * A dataset definition as returned by
 * `GET /api/v1/dashboard/{id}/datasets`. Identity fields are typed
 * explicitly; the remaining payload is passed through untyped.
 */
export interface DashboardDataset {
  /** Numeric dataset id */
  id: number;
  /** Datasource uid (e.g., "12__table") */
  uid?: string;
  /** Physical or virtual table name */
  table_name?: string;
  /** Column definitions */
  columns?: Record<string, unknown>[];
  /** Metric definitions */
  metrics?: Record<string, unknown>[];
  [key: string]: unknown;
}

/**
 * Display options for the dashboard, mirroring the embedded SDK's
 * uiConfig chrome-hiding flags.
 */
export interface DashboardUiConfig {
  /** Hide the dashboard title header */
  hideTitle?: boolean;
  /** Hide the top-level tab bar */
  hideTab?: boolean;
  /** Hide per-chart menus and controls */
  hideChartControls?: boolean;
  /** Emit filter state changes to an embedding host application */
  emitDataMasks?: boolean;
}

/**
 * Props contract between the host and dashboard renderer implementations.
 *
 * Everything a renderer needs to display a dashboard arrives via these
 * props; host services (authentication, navigation, theming, translation)
 * are available through the public `window.superset` namespaces.
 */
export interface DashboardRendererProps {
  /** Identity and parsed metadata of the dashboard */
  dashboard: DashboardInfo;
  /** Chart (slice) definitions placed on the dashboard */
  charts: DashboardChart[];
  /** Datasets backing the dashboard's charts */
  datasets: DashboardDataset[];
  /**
   * Initial filter state resolved by the host from the URL: permalink
   * state, `native_filters_key`, and legacy/rison filter params.
   */
  initialDataMask: DashboardDataMask;
  /** Layout component ids of the initially active tabs (from permalink) */
  initialActiveTabs?: string[];
  /** Layout component id to scroll to on mount (permalink anchor) */
  initialAnchor?: string;
  /** Display options (chrome hiding), when provided by the host */
  uiConfig?: DashboardUiConfig;
  /**
   * Notify the host that filter state changed inside the renderer.
   * Reserved for future host consumption (permalinks, embedded emitters);
   * the host does not supply this callback yet.
   */
  onDataMaskChange?: (dataMask: DashboardDataMask) => void;
  /**
   * Notify the host that the active tabs changed inside the renderer.
   * Reserved for future host consumption; the host does not supply this
   * callback yet.
   */
  onActiveTabsChange?: (activeTabs: string[]) => void;
}

/**
 * React component type for dashboard renderer implementations.
 */
export type DashboardRendererComponent = ComponentType<DashboardRendererProps>;

/**
 * A registered dashboard renderer provider with its descriptor and component.
 */
export interface DashboardRendererProvider {
  /** The renderer descriptor */
  renderer: DashboardRenderer;
  /** The React component implementing the renderer */
  component: DashboardRendererComponent;
}

/**
 * Event fired when a dashboard renderer is registered.
 */
export interface DashboardRendererRegisteredEvent {
  /** The descriptor of the renderer that was registered */
  renderer: DashboardRenderer;
}

/**
 * Event fired when a dashboard renderer is unregistered.
 */
export interface DashboardRendererUnregisteredEvent {
  /** The descriptor of the renderer that was unregistered */
  renderer: DashboardRenderer;
}

/**
 * Registers a custom dashboard renderer as a module-level side effect.
 *
 * The dashboard renderer is a single slot: the most recently registered
 * renderer becomes active, displacing (and unregistering) any previously
 * registered one with a console warning. Disposing the returned Disposable
 * removes the renderer if it is still the active one; disposing a displaced
 * renderer's Disposable is a no-op.
 *
 * Custom renderers handle view mode only — when a dashboard enters edit
 * mode, the host always renders the built-in renderer.
 *
 * @param renderer The renderer descriptor including id and name.
 * @param component The React component implementing the renderer.
 * @returns Disposable which unregisters this renderer on disposal.
 *
 * @example
 * ```typescript
 * dashboards.registerDashboardRenderer(
 *   { id: 'acme.kiosk-dashboard', name: 'Kiosk Dashboard Renderer' },
 *   KioskDashboardRenderer,
 * );
 * ```
 */
export declare function registerDashboardRenderer(
  renderer: DashboardRenderer,
  component: DashboardRendererComponent,
): Disposable;

/**
 * Get the currently registered dashboard renderer provider.
 *
 * @returns The active provider, or undefined if no extension has
 *   registered a renderer (the host uses its built-in renderer).
 */
export declare function getDashboardRenderer():
  | DashboardRendererProvider
  | undefined;

/**
 * Event fired when a dashboard renderer is registered.
 */
export declare const onDidRegisterDashboardRenderer: Event<DashboardRendererRegisteredEvent>;

/**
 * Event fired when a dashboard renderer is unregistered.
 */
export declare const onDidUnregisterDashboardRenderer: Event<DashboardRendererUnregisteredEvent>;
