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
/* eslint-disable camelcase */
import { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
// eslint-disable-next-line import/no-extraneous-dependencies
import type { History } from 'history';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { findPermission } from 'src/utils/findPermission';
import {
  canUserEditDashboard,
  canUserSaveAsDashboard,
} from 'src/dashboard/util/permissionUtils';
import type { Dashboard } from 'src/types/Dashboard';
import { getCrossFiltersConfiguration } from 'src/dashboard/util/crossFilters';
import getDefaultActiveTabs from 'src/dashboard/util/getDefaultActiveTabs';
import getLocationHash from 'src/dashboard/util/getLocationHash';
import type { DashboardEntity } from 'src/dashboard/util/newComponentFactory';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import type { DashboardChartStates } from 'src/dashboard/types/chartState';
import {
  useDashboardStateStore,
  useDashboardLayoutStore,
  useDashboardSlicesStore,
  useNativeFiltersStore,
  useDashboardInfoStore,
  getNativeFiltersInitialState,
  type DashboardInfoData,
  type FilterEntry,
} from 'src/dashboard/stores';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import type { DashboardFilterMetadata } from 'src/dataMask/useDataMaskStore';
import { queryClient } from 'src/queries/queryClient';
import { dashboardKeys } from 'src/dashboard/queries/keys';
import extractUrlParams from '../util/extractUrlParams';
import buildDashboardLayout, {
  HydrateChartData,
} from '../util/buildDashboardLayout';
import { AUTO_REFRESH_STATE_DEFAULTS } from '../types/autoRefresh';
import { migrateChartCustomizationArray } from '../util/migrateChartCustomization';
import {
  ChartsState,
  DashboardLayout,
  GetState,
  LayoutItem,
  RootState,
  Slice,
} from '../types';

export const HYDRATE_DASHBOARD = 'HYDRATE_DASHBOARD';
type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/** Shape cached at `dashboardKeys.hydrationPayload(id)`; the in-place-discard restore point. */
export interface HydrationPayload {
  dashboardInfo: DashboardInfoData;
  dashboardLayout: {
    present: DashboardLayout;
    past?: unknown[];
    future?: unknown[];
  };
  charts: ChartsState;
  sliceEntities: {
    slices: Record<number, Slice>;
    isLoading: boolean;
    errorMessage: string | null;
    lastUpdated: number;
  };
  dataMask: DataMaskStateWithId;
  dashboardFilters: JsonObject;
  nativeFilters: {
    filters: Record<string, FilterEntry>;
    focusedFilterId?: string;
    hoveredFilterId?: string;
    hoveredChartCustomizationId?: string;
  };
  zustandStateSeed: Record<string, unknown>;
}

interface HydrateDashboardData extends Dashboard {
  metadata: JsonObject;
  position_data: Record<string, LayoutItem> | null;
  [key: string]: unknown;
}

interface HydrateDashboardParams {
  history: History;
  dashboard: HydrateDashboardData;
  charts: HydrateChartData[];
  dataMask: DataMaskStateWithId;
  activeTabs: string[] | null;
  chartStates: DashboardChartStates | null;
}

export const hydrateDashboard =
  ({
    history,
    dashboard,
    charts,
    dataMask,
    activeTabs,
    chartStates,
  }: HydrateDashboardParams) =>
  (dispatch: AppDispatch, getState: GetState): AnyAction => {
    const { user, common } = getState();
    const dashboardState = useDashboardStateStore.getState();
    const { metadata, position_data: positionData } = dashboard;
    const regularUrlParams = extractUrlParams('regular');
    const reservedUrlParams = extractUrlParams('reserved');
    const editMode = reservedUrlParams.edit === 'true';

    const { layout, chartQueries, slices, sliceIds } = buildDashboardLayout({
      dashboardTitle: dashboard.dashboard_title,
      positionData,
      charts,
      regularUrlParams,
    });

    const dashboardFilters: Record<string, JsonObject> = {};
    buildActiveFilters({
      dashboardFilters: dashboardFilters as Parameters<
        typeof buildActiveFilters
      >[0]['dashboardFilters'],
      components: layout as Record<string, LayoutItem>,
    });

    const dashboardLayout = {
      past: [] as Record<string, LayoutItem | DashboardEntity>[],
      present: layout,
      future: [] as Record<string, LayoutItem | DashboardEntity>[],
    };

    // Searches for a focused_chart parameter in the URL to automatically focus a chart
    const focusedChartId = getUrlParam(URL_PARAMS.dashboardFocusedChart);
    let focusedChartLayoutId: string | undefined;
    if (focusedChartId) {
      // Converts focused_chart to dashboard layout id
      const found = Object.values(dashboardLayout.present).find(
        element => (element as LayoutItem).meta?.chartId === focusedChartId,
      );
      focusedChartLayoutId = found?.id;
      // Removes the focused_chart parameter from the URL
      const params = new URLSearchParams(window.location.search);
      params.delete(URL_PARAMS.dashboardFocusedChart.name);
      history.replace({
        search: params.toString(),
      });
    }

    // find direct link component and path from root
    const directLinkComponentId = focusedChartLayoutId || getLocationHash();
    let directPathToChild = dashboardState.directPathToChild || [];
    if (directLinkComponentId && layout[directLinkComponentId]) {
      directPathToChild = (
        (layout[directLinkComponentId] as LayoutItem).parents || []
      ).slice();
      directPathToChild.push(directLinkComponentId);
    }

    const rawChartCustomizations = (
      (metadata?.chart_customization_config as JsonObject[]) || []
    ).filter(Boolean);

    const chartCustomizations = migrateChartCustomizationArray(
      rawChartCustomizations,
    );

    const filters = (
      (metadata?.native_filter_configuration as JsonObject[]) || []
    ).filter(Boolean);
    const combinedFilters = [...filters, ...chartCustomizations];

    const nativeFilters = getNativeFiltersInitialState({
      filterConfig: combinedFilters as Parameters<
        typeof getNativeFiltersInitialState
      >[0]['filterConfig'],
    });

    const { chartConfiguration, globalChartConfiguration } =
      getCrossFiltersConfiguration(
        dashboardLayout.present as Record<string, LayoutItem>,
        metadata as Parameters<typeof getCrossFiltersConfiguration>[1],
        chartQueries as Parameters<typeof getCrossFiltersConfiguration>[2],
      );
    metadata.chart_configuration = chartConfiguration;
    metadata.global_chart_configuration = globalChartConfiguration;

    const { roles } = user;
    const canEdit = canUserEditDashboard(dashboard, user);

    const hydratedEditMode = canEdit && editMode;
    // precedence: permalink param > stored value > layout default. The layout
    // default only applies to a genuinely fresh load: no permalink activeTabs,
    // no stored activeTabs, and no deep-link (directPathToChild), which the
    // live Tabs component resolves on its own.
    const hydratedActiveTabs =
      activeTabs ||
      (dashboardState?.activeTabs?.length
        ? dashboardState.activeTabs
        : undefined) ||
      (directPathToChild.length
        ? []
        : getDefaultActiveTabs(dashboardLayout.present as DashboardLayout));

    // Seed the dashboard-state Zustand store. Captured into a named object so the
    // same seed can be cached and replayed by useDiscardChanges (HYDRATE_DASHBOARD
    // resets only the Redux reducers, not the Zustand store).
    const zustandStateSeed = {
      ...AUTO_REFRESH_STATE_DEFAULTS,
      editMode: hydratedEditMode,
      fullSizeChartId: null,
      isPublished: dashboard.published ?? null,
      sliceIds: Array.from(sliceIds),
      activeTabs: hydratedActiveTabs,
      inactiveTabs: [],
      hasUnsavedChanges: false,
      // Starts closed; the useNativeFilters mount effect opens it when there are filters.
      nativeFiltersBarOpen: false,
      isRefreshing: false,
      isFiltersRefreshing: false,
      directPathToChild,
      directPathLastUpdated: Date.now(),
      isStarred: false,
      maxUndoHistoryExceeded: false,
      dashboardIsSaving: false,
      // Stale-overwrite guard baseline: must be numeric (Header takes Math.max with
      // the real last_modified_time), so seed 0 — a non-numeric seed makes Math.max NaN.
      lastModifiedTime: 0,
      lastRefreshTime: 0,
      overwriteConfirmMetadata: undefined,
      colorScheme: metadata?.color_scheme || undefined,
      colorNamespace: metadata?.color_namespace || undefined,
      updatedColorScheme: false,
      labelsColorMapMustSync: false,
      sharedLabelsColorsMustSync: false,
      expandedSlices: metadata?.expanded_slices || {},
      focusedFilterField: null,
      chartStates: chartStates || {},
      refreshFrequency: metadata?.refresh_frequency || 0,
      shouldPersistRefreshFrequency: false,
      datasetsStatus: ResourceStatus.Loading,
      preselectNativeFilters:
        (getUrlParam(URL_PARAMS.nativeFilters) as JsonObject | undefined) ||
        undefined,
      tabActivationTimes: Object.fromEntries(
        hydratedActiveTabs.map((tabId: string) => [tabId, Date.now()]),
      ),
    };
    useDashboardStateStore.setState(zustandStateSeed);

    // Seed the layout store, then clear zundo history so the empty `{}` initial
    // layout isn't left as a bogus undo target.
    useDashboardLayoutStore.getState().setLayout(dashboardLayout.present);
    useDashboardLayoutStore.temporal.getState().clear();

    // Seed the dashboard's chart metadata; the "add chart" panel uses useSlicesQuery instead.
    useDashboardSlicesStore
      .getState()
      .setSlices(slices as Record<number, Slice>);

    // Seed the filter Zustand stores (dataMask + native filters).
    useDataMaskStore
      .getState()
      .hydrateDataMask(metadata as DashboardFilterMetadata, dataMask);
    useNativeFiltersStore
      .getState()
      .hydrateNativeFilters(nativeFilters.filters);

    const hydrateData = {
      // Consumed by useDiscardChanges to re-seed useDashboardSlicesStore.
      sliceEntities: {
        slices,
        isLoading: false,
        errorMessage: null,
        lastUpdated: 0,
      },
      charts: chartQueries,
      // read-only data
      dashboardInfo: {
        ...dashboard,
        metadata,
        userId: user.userId ? String(user.userId) : null, // legacy, please use state.user instead
        dash_edit_perm: canEdit,
        dash_save_perm: canUserSaveAsDashboard(dashboard, user),
        dash_share_perm: findPermission(
          'can_share_dashboard',
          'Superset',
          roles,
        ),
        dash_export_perm: findPermission('can_export', 'Dashboard', roles),
        superset_can_explore: findPermission('can_explore', 'Superset', roles),
        superset_can_share: findPermission(
          'can_share_chart',
          'Superset',
          roles,
        ),
        superset_can_download: findPermission('can_csv', 'Superset', roles),
        common: {
          // legacy, please use state.common instead
          conf: common?.conf,
        },
      },
      dataMask,
      dashboardFilters,
      nativeFilters,
      dashboardLayout,
      // Carried (not read by any reducer) so useDiscardChanges can replay the Zustand seed.
      zustandStateSeed,
    };

    // Seed the dashboardInfo Zustand store; readers consume it from here.
    useDashboardInfoStore
      .getState()
      .hydrateDashboardInfo(
        hydrateData.dashboardInfo as unknown as DashboardInfoData,
      );

    // Cache the payload so useDiscardChanges can re-seed without a reload. No useQuery
    // observes it, so gcTime: Infinity prevents GC (which would degrade discard to a
    // reload); set on the shared prefix and before setQueryData so the default applies.
    queryClient.setQueryDefaults(dashboardKeys.hydrationPayloadAll, {
      gcTime: Infinity,
    });
    queryClient.setQueryData<HydrationPayload>(
      dashboardKeys.hydrationPayload(dashboard.id),
      hydrateData as unknown as HydrationPayload,
    );

    return dispatch({
      type: HYDRATE_DASHBOARD,
      data: hydrateData,
    });
  };
