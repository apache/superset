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
import { chart } from 'src/components/Chart/chartReducer';
import { initSliceEntities } from 'src/dashboard/reducers/sliceEntities';
import { getInitialState as getInitialNativeFilterState } from 'src/dashboard/reducers/nativeFilters';
import { applyDefaultFormData } from 'src/explore/store';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { findPermission } from 'src/utils/findPermission';
import {
  canUserEditDashboard,
  canUserSaveAsDashboard,
} from 'src/dashboard/util/permissionUtils';
import type { Dashboard } from 'src/types/Dashboard';
import {
  getCrossFiltersConfiguration,
  isCrossFiltersEnabled,
} from 'src/dashboard/util/crossFilters';
import {
  DASHBOARD_HEADER_ID,
  GRID_DEFAULT_CHART_WIDTH,
  GRID_COLUMN_COUNT,
  DASHBOARD_ROOT_ID,
} from 'src/dashboard/util/constants';
import {
  DASHBOARD_HEADER_TYPE,
  CHART_TYPE,
  ROW_TYPE,
} from 'src/dashboard/util/componentTypes';
import findFirstParentContainerId from 'src/dashboard/util/findFirstParentContainer';
import getEmptyLayout from 'src/dashboard/util/getEmptyLayout';
import getLocationHash from 'src/dashboard/util/getLocationHash';
import newComponentFactory, {
  DashboardEntity,
} from 'src/dashboard/util/newComponentFactory';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import type { DashboardChartStates } from 'src/dashboard/types/chartState';
import extractUrlParams from '../util/extractUrlParams';
import updateComponentParentsList from '../util/updateComponentParentsList';
import { AUTO_REFRESH_STATE_DEFAULTS } from '../types/autoRefresh';
import { migrateChartCustomizationArray } from '../util/migrateChartCustomization';
import {
  DashboardLayout,
  FilterBarOrientation,
  GetState,
  LayoutItem,
  RootState,
} from '../types';

export const HYDRATE_DASHBOARD = 'HYDRATE_DASHBOARD';
type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

interface HydrateChartData {
  slice_id: number;
  slice_url: string;
  slice_name: string;
  form_data: JsonObject;
  description: string;
  description_markeddown: string;
  owners: { id: number }[];
  modified: string;
  changed_on: string;
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
    const { user, common, dashboardState } = getState();
    const { metadata, position_data: positionData } = dashboard;
    const regularUrlParams = extractUrlParams('regular');
    const reservedUrlParams = extractUrlParams('reserved');
    const editMode = reservedUrlParams.edit === 'true';

    charts.forEach((chartItem: HydrateChartData) => {
      // eslint-disable-next-line no-param-reassign
      chartItem.slice_id = chartItem.form_data.slice_id as number;
    });

    // new dash: position_json could be {} or null
    // getEmptyLayout() includes a version string entry plus BasicLayoutItem entries
    // which lack the `meta` field; layout is mutated below to add full LayoutItem entries
    const layout = (
      positionData && Object.keys(positionData).length > 0
        ? positionData
        : getEmptyLayout()
    ) as Record<string, LayoutItem | DashboardEntity>;

    // create a lookup to sync layout names with slice names
    const chartIdToLayoutId: Record<number, string> = {};
    Object.values(layout).forEach(layoutComponent => {
      if (layoutComponent.type === CHART_TYPE) {
        const { chartId } = (layoutComponent as LayoutItem).meta;
        if (chartId !== undefined) {
          chartIdToLayoutId[chartId] = layoutComponent.id;
        }
      }
    });

    // find root level chart container node for newly-added slices
    const parentId = findFirstParentContainerId(layout as DashboardLayout);
    const parent = layout[parentId];
    let newSlicesContainer: DashboardEntity | undefined;
    let newSlicesContainerWidth = 0;

    const chartQueries: Record<string, JsonObject> = {};
    const dashboardFilters: Record<string, JsonObject> = {};
    const slices: Record<string, JsonObject> = {};
    const sliceIds = new Set<number>();
    const slicesFromExploreCount = new Map<number, number>();

    charts.forEach((slice: HydrateChartData) => {
      const key = slice.slice_id;
      const formData = {
        ...slice.form_data,
        url_params: {
          ...(slice.form_data.url_params as JsonObject),
          ...regularUrlParams,
        },
      };
      chartQueries[key] = {
        ...chart,
        id: key,
        form_data: applyDefaultFormData(
          formData as Parameters<typeof applyDefaultFormData>[0],
        ),
      };

      slices[key] = {
        slice_id: key,
        slice_url: slice.slice_url,
        slice_name: slice.slice_name,
        form_data: slice.form_data,
        viz_type: slice.form_data.viz_type,
        datasource: slice.form_data.datasource,
        description: slice.description,
        description_markeddown: slice.description_markeddown,
        owners: slice.owners,
        modified: slice.modified,
        changed_on: new Date(slice.changed_on).getTime(),
      };

      sliceIds.add(key);

      // if there are newly added slices from explore view, fill slices into 1 or more rows
      if (!chartIdToLayoutId[key] && layout[parentId]) {
        if (
          newSlicesContainerWidth === 0 ||
          newSlicesContainerWidth + GRID_DEFAULT_CHART_WIDTH > GRID_COLUMN_COUNT
        ) {
          newSlicesContainer = newComponentFactory(
            ROW_TYPE,
            undefined,
            ((parent as LayoutItem).parents ?? []).slice(),
          );
          layout[newSlicesContainer.id] = newSlicesContainer;
          parent.children.push(newSlicesContainer.id);
          newSlicesContainerWidth = 0;
        }

        const chartHolder = newComponentFactory(
          CHART_TYPE,
          {
            chartId: slice.slice_id,
          },
          (newSlicesContainer!.parents || []).slice(),
        );

        const count = (slicesFromExploreCount.get(slice.slice_id) ?? 0) + 1;
        chartHolder.id = `${CHART_TYPE}-explore-${slice.slice_id}-${count}`;
        slicesFromExploreCount.set(slice.slice_id, count);

        layout[chartHolder.id] = chartHolder;
        newSlicesContainer!.children.push(chartHolder.id);
        const holderChartId = chartHolder.meta.chartId;
        if (holderChartId !== undefined) {
          chartIdToLayoutId[holderChartId] = chartHolder.id;
        }
        newSlicesContainerWidth += GRID_DEFAULT_CHART_WIDTH;
      }

      // sync layout names with current slice names in case a slice was edited
      // in explore since the layout was updated. name updates go through layout for undo/redo
      // functionality and python updates slice names based on layout upon dashboard save
      const layoutId = chartIdToLayoutId[key];
      if (layoutId && layout[layoutId]) {
        (layout[layoutId] as LayoutItem).meta.sliceName = slice.slice_name;
      }
    });

    // make sure that parents tree is built
    if (
      Object.values(layout).some(
        element => element.id !== DASHBOARD_ROOT_ID && !element.parents,
      )
    ) {
      updateComponentParentsList({
        currentComponent: layout[DASHBOARD_ROOT_ID] as LayoutItem,
        layout: layout as Record<string, LayoutItem>,
      });
    }

    buildActiveFilters({
      dashboardFilters: dashboardFilters as Parameters<
        typeof buildActiveFilters
      >[0]['dashboardFilters'],
      components: layout as Record<string, LayoutItem>,
    });

    // store the header as a layout component so we can undo/redo changes
    layout[DASHBOARD_HEADER_ID] = {
      id: DASHBOARD_HEADER_ID,
      type: DASHBOARD_HEADER_TYPE,
      meta: {
        text: dashboard.dashboard_title,
      },
    } as LayoutItem;

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

    const rawChartCustomizations =
      (metadata?.chart_customization_config as JsonObject[]) || [];

    const chartCustomizations = migrateChartCustomizationArray(
      rawChartCustomizations,
    );

    const filters =
      (metadata?.native_filter_configuration as JsonObject[]) || [];
    const combinedFilters = [...filters, ...chartCustomizations];

    const nativeFilters = getInitialNativeFilterState({
      filterConfig: combinedFilters as Parameters<
        typeof getInitialNativeFilterState
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
    const crossFiltersEnabled = isCrossFiltersEnabled(
      metadata.cross_filters_enabled as boolean | undefined,
    );

    return dispatch({
      type: HYDRATE_DASHBOARD,
      data: {
        sliceEntities: { ...initSliceEntities, slices, isLoading: false },
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
          superset_can_explore: findPermission(
            'can_explore',
            'Superset',
            roles,
          ),
          superset_can_share: findPermission(
            'can_share_chart',
            'Superset',
            roles,
          ),
          superset_can_csv: findPermission('can_csv', 'Superset', roles),
          common: {
            // legacy, please use state.common instead
            conf: common?.conf,
          },
          filterBarOrientation:
            metadata.filter_bar_orientation || FilterBarOrientation.Vertical,
          crossFiltersEnabled,
        },
        dataMask,
        dashboardFilters,
        nativeFilters,
        dashboardState: {
          ...AUTO_REFRESH_STATE_DEFAULTS,
          preselectNativeFilters: getUrlParam(URL_PARAMS.nativeFilters),
          sliceIds: Array.from(sliceIds),
          directPathToChild,
          directPathLastUpdated: Date.now(),
          focusedFilterField: null,
          expandedSlices: metadata?.expanded_slices || {},
          refreshFrequency: metadata?.refresh_frequency || 0,
          // dashboard viewers can set refresh frequency for the current visit,
          // only persistent refreshFrequency will be saved to backend
          shouldPersistRefreshFrequency: false,
          css: dashboard.css || '',
          colorNamespace: metadata?.color_namespace || null,
          colorScheme: metadata?.color_scheme || null,
          editMode: canEdit && editMode,
          isPublished: dashboard.published,
          hasUnsavedChanges: false,
          dashboardIsSaving: false,
          maxUndoHistoryExceeded: false,
          lastModifiedTime: dashboard.changed_on,
          isRefreshing: false,
          isFiltersRefreshing: false,
          activeTabs: activeTabs || dashboardState?.activeTabs || [],
          datasetsStatus:
            dashboardState?.datasetsStatus || ResourceStatus.Loading,
          chartStates: chartStates || dashboardState?.chartStates || {},
        },
        dashboardLayout,
      },
    });
  };
