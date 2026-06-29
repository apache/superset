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
 * Domain hooks for dashboard "info" client state. Components import these (from
 * `src/dashboard/stores`) rather than reaching into the Zustand store directly,
 * so the state library stays an implementation detail behind this layer. Each
 * hook keeps a precise selector so render granularity matches direct store use.
 */
import { JsonObject } from '@superset-ui/core';
import {
  ChartConfiguration,
  DashboardInfo,
  FilterBarOrientation,
} from 'src/dashboard/types';
import {
  useDashboardInfoStore,
  selectFilterBarOrientation,
  selectCrossFiltersEnabled,
} from './useDashboardInfoStore';

const EMPTY_OBJECT: JsonObject = {};

/** The filter bar orientation (vertical / horizontal). */
export const useFilterBarOrientation = (): FilterBarOrientation =>
  useDashboardInfoStore(selectFilterBarOrientation);

/** Whether cross-filtering is enabled for the dashboard. */
export const useCrossFiltersEnabled = (): boolean =>
  useDashboardInfoStore(selectCrossFiltersEnabled);

/** The current dashboard's numeric id. */
export const useDashboardId = (): number =>
  useDashboardInfoStore(s => s.dashboardInfo.id);

/** Whether the current user may edit this dashboard. */
export const useCanEditDashboard = (): boolean =>
  useDashboardInfoStore(s => s.dashboardInfo.dash_edit_perm);

/** The full dashboard info object (coarse — re-renders on any info change). */
export const useDashboardInfo = (): DashboardInfo =>
  useDashboardInfoStore(s => s.dashboardInfo);

/** Server-provided per-dashboard config blob (`common.conf`). */
export const useDashboardConf = (): JsonObject =>
  useDashboardInfoStore(s => s.dashboardInfo.common.conf);

/** Whether the current user can open Explore for this dashboard's charts. */
export const useCanExplore = (): boolean =>
  useDashboardInfoStore(
    s => !!(s.dashboardInfo as JsonObject).superset_can_explore,
  );

/** Whether the current user can share this dashboard. */
export const useCanShare = (): boolean =>
  useDashboardInfoStore(
    s => !!(s.dashboardInfo as JsonObject).superset_can_share,
  );

/** Whether the current user can export CSV from this dashboard's charts. */
export const useCanCsv = (): boolean =>
  useDashboardInfoStore(
    s => !!(s.dashboardInfo as JsonObject).superset_can_csv,
  );

/** Whether chart timestamps are shown on the dashboard. */
export const useShowChartTimestamps = (): boolean =>
  useDashboardInfoStore(
    s =>
      (s.dashboardInfo?.metadata as JsonObject)?.show_chart_timestamps ?? false,
  );

/** The dashboard's chart cross-filter configuration. */
export const useChartConfiguration = (): ChartConfiguration =>
  useDashboardInfoStore(s => s.dashboardInfo.metadata?.chart_configuration);

/** Per-label categorical colors (`label_colors`). */
export const useLabelsColor = (): JsonObject =>
  useDashboardInfoStore(
    s => s.dashboardInfo?.metadata?.label_colors || EMPTY_OBJECT,
  );

/** Persisted label→color map (`map_label_colors`). */
export const useLabelsColorMap = (): JsonObject =>
  useDashboardInfoStore(
    s => s.dashboardInfo?.metadata?.map_label_colors || EMPTY_OBJECT,
  );

/** Shared label colors carried in metadata (`shared_label_colors`). */
export const useSharedLabelsColors = (): string[] | undefined =>
  useDashboardInfoStore(s => s.dashboardInfo?.metadata?.shared_label_colors);

/** The dashboard's custom CSS (empty string when unset). */
export const useCustomCss = (): string =>
  useDashboardInfoStore(s => s.dashboardInfo.css ?? '');

/** Pending (unsaved) chart customizations keyed by item id. */
export const usePendingChartCustomizations = () =>
  useDashboardInfoStore(s => s.dashboardInfo.pendingChartCustomizations);

/** The chart-customization config list (undefined when unset). */
export const useChartCustomizationConfig = () =>
  useDashboardInfoStore(
    s => s.dashboardInfo?.metadata?.chart_customization_config,
  );

/** The global cross-filter chart configuration (undefined when unset). */
export const useGlobalChartConfiguration = () =>
  useDashboardInfoStore(
    s => s.dashboardInfo.metadata?.global_chart_configuration,
  );

/** The native-filter configuration list (undefined when unset). */
export const useNativeFilterConfiguration = () =>
  useDashboardInfoStore(
    s => s.dashboardInfo?.metadata?.native_filter_configuration,
  );

/** The server-configured periodical-refresh limit, if any. */
export const useRefreshLimit = () =>
  useDashboardInfoStore(
    s =>
      s.dashboardInfo?.common?.conf
        ?.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT,
  );

/** The server-configured periodical-refresh warning message, if any. */
export const useRefreshWarningMessage = () =>
  useDashboardInfoStore(
    s =>
      s.dashboardInfo?.common?.conf
        ?.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE,
  );
