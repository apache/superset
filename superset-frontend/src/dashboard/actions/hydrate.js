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
import { FeatureFlag } from '@superset-ui/core';
import { chart } from 'src/components/Chart/chartReducer';
import { initSliceEntities } from 'src/dashboard/reducers/sliceEntities';
import { getInitialState as getInitialNativeFilterState } from 'src/dashboard/reducers/nativeFilters';
import { applyDefaultFormData } from 'src/explore/store';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { findPermission } from 'src/utils/findPermission';
import { canUserEditDashboard } from 'src/dashboard/util/permissionUtils';
import {
  getCrossFiltersConfiguration,
  isCrossFiltersEnabled,
} from 'src/dashboard/util/crossFilters';
import {
  DASHBOARD_FILTER_SCOPE_GLOBAL,
  dashboardFilter,
} from 'src/dashboard/reducers/dashboardFilters';
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
import getFilterConfigsFromFormdata from 'src/dashboard/util/getFilterConfigsFromFormdata';
import getLocationHash from 'src/dashboard/util/getLocationHash';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { TIME_RANGE } from 'src/visualizations/FilterBox/FilterBox';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { isFeatureEnabled } from '../../featureFlags';
import extractUrlParams from '../util/extractUrlParams';
import { updateColorSchema } from './dashboardInfo';
import updateComponentParentsList from '../util/updateComponentParentsList';
import { FilterBarOrientation } from '../types';

export const HYDRATE_DASHBOARD = 'HYDRATE_DASHBOARD';

export const hydrateDashboard =
  ({ history, dashboard, charts, dataMask, activeTabs }) =>
  (dispatch, getState) => {
    const { user, common, dashboardState } = getState();
    const { metadata, position_data: positionData } = dashboard;
    const regularUrlParams = extractUrlParams('regular');
    const reservedUrlParams = extractUrlParams('reserved');
    const editMode = reservedUrlParams.edit === 'true';

    let preselectFilters = {};

    charts.forEach(chart => {
      // eslint-disable-next-line no-param-reassign
      chart.slice_id = chart.form_data.slice_id;
    });
    try {
      // allow request parameter overwrite dashboard metadata
      preselectFilters =
        getUrlParam(URL_PARAMS.preselectFilters) ||
        JSON.parse(metadata.default_filters);
    } catch (e) {
      //
    }

    if (metadata?.shared_label_colors) {
      updateColorSchema(metadata, metadata?.shared_label_colors);
    }

    // Priming the color palette with user's label-color mapping provided in
    // the dashboard's JSON metadata
    if (metadata?.label_colors) {
      updateColorSchema(metadata, metadata?.label_colors);
    }

    // new dash: position_json could be {} or null
    const layout =
      positionData && Object.keys(positionData).length > 0
        ? positionData
        : getEmptyLayout();

    // create a lookup to sync layout names with slice names
    const chartIdToLayoutId = {};
    Object.values(layout).forEach(layoutComponent => {
      if (layoutComponent.type === CHART_TYPE) {
        chartIdToLayoutId[layoutComponent.meta.chartId] = layoutComponent.id;
      }
    });

    // find root level chart container node for newly-added slices
    const parentId = findFirstParentContainerId(layout);
    const parent = layout[parentId];
    let newSlicesContainer;
    let newSlicesContainerWidth = 0;

    const filterScopes = metadata?.filter_scopes || {};

    const chartQueries = {};
    const dashboardFilters = {};
    const slices = {};
    const sliceIds = new Set();
    const slicesFromExploreCount = new Map();

    charts.forEach(slice => {
      const key = slice.slice_id;
      const formData = {
        ...slice.form_data,
        url_params: {
          ...slice.form_data.url_params,
          ...regularUrlParams,
        },
      };
      chartQueries[key] = {
        ...chart,
        id: key,
        form_data: applyDefaultFormData(formData),
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
            (parent.parents || []).slice(),
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
          (newSlicesContainer.parents || []).slice(),
        );

        const count = (slicesFromExploreCount.get(slice.slice_id) ?? 0) + 1;
        chartHolder.id = `${CHART_TYPE}-explore-${slice.slice_id}-${count}`;
        slicesFromExploreCount.set(slice.slice_id, count);

        layout[chartHolder.id] = chartHolder;
        newSlicesContainer.children.push(chartHolder.id);
        chartIdToLayoutId[chartHolder.meta.chartId] = chartHolder.id;
        newSlicesContainerWidth += GRID_DEFAULT_CHART_WIDTH;
      }

      // build DashboardFilters for interactive filter features
      if (slice.form_data.viz_type === 'filter_box') {
        const configs = getFilterConfigsFromFormdata(slice.form_data);
        let { columns } = configs;
        const { labels } = configs;
        if (preselectFilters[key]) {
          Object.keys(columns).forEach(col => {
            if (preselectFilters[key][col]) {
              columns = {
                ...columns,
                [col]: preselectFilters[key][col],
              };
            }
          });
        }

        const scopesByChartId = Object.keys(columns).reduce((map, column) => {
          const scopeSettings = {
            ...filterScopes[key],
          };
          const { scope, immune } = {
            ...DASHBOARD_FILTER_SCOPE_GLOBAL,
            ...scopeSettings[column],
          };

          return {
            ...map,
            [column]: {
              scope,
              immune,
            },
          };
        }, {});

        const componentId = chartIdToLayoutId[key];
        const directPathToFilter = (layout[componentId].parents || []).slice();
        directPathToFilter.push(componentId);
        dashboardFilters[key] = {
          ...dashboardFilter,
          chartId: key,
          componentId,
          datasourceId: slice.form_data.datasource,
          filterName: slice.slice_name,
          directPathToFilter,
          columns,
          labels,
          scopes: scopesByChartId,
          isDateFilter: Object.keys(columns).includes(TIME_RANGE),
        };
      }

      // sync layout names with current slice names in case a slice was edited
      // in explore since the layout was updated. name updates go through layout for undo/redo
      // functionality and python updates slice names based on layout upon dashboard save
      const layoutId = chartIdToLayoutId[key];
      if (layoutId && layout[layoutId]) {
        layout[layoutId].meta.sliceName = slice.slice_name;
      }
    });

    // make sure that parents tree is built
    if (
      Object.values(layout).some(
        element => element.id !== DASHBOARD_ROOT_ID && !element.parents,
      )
    ) {
      updateComponentParentsList({
        currentComponent: layout[DASHBOARD_ROOT_ID],
        layout,
      });
    }

    buildActiveFilters({
      dashboardFilters,
      components: layout,
    });

    // store the header as a layout component so we can undo/redo changes
    layout[DASHBOARD_HEADER_ID] = {
      id: DASHBOARD_HEADER_ID,
      type: DASHBOARD_HEADER_TYPE,
      meta: {
        text: dashboard.dashboard_title,
      },
    };

    const dashboardLayout = {
      past: [],
      present: layout,
      future: [],
    };

    // Searches for a focused_chart parameter in the URL to automatically focus a chart
    const focusedChartId = getUrlParam(URL_PARAMS.dashboardFocusedChart);
    let focusedChartLayoutId;
    if (focusedChartId) {
      // Converts focused_chart to dashboard layout id
      const found = Object.values(dashboardLayout.present).find(
        element => element.meta?.chartId === focusedChartId,
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
    if (layout[directLinkComponentId]) {
      directPathToChild = (layout[directLinkComponentId].parents || []).slice();
      directPathToChild.push(directLinkComponentId);
    }

    const nativeFilters = getInitialNativeFilterState({
      filterConfig: metadata?.native_filter_configuration || [],
    });

    if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
      metadata.chart_configuration = getCrossFiltersConfiguration(
        dashboardLayout.present,
        metadata.chart_configuration,
        chartQueries,
      );
    }

    const { roles } = user;
    const canEdit = canUserEditDashboard(dashboard, user);
    const crossFiltersEnabled = isCrossFiltersEnabled(
      metadata.cross_filters_enabled,
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
          dash_save_perm: findPermission('can_save_dash', 'Superset', roles),
          dash_share_perm: findPermission(
            'can_share_dashboard',
            'Superset',
            roles,
          ),
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
          slice_can_edit: findPermission('can_slice', 'Superset', roles),
          common: {
            // legacy, please use state.common instead
            flash_messages: common?.flash_messages,
            conf: common?.conf,
          },
          filterBarOrientation:
            (isFeatureEnabled(FeatureFlag.HORIZONTAL_FILTER_BAR) &&
              metadata.filter_bar_orientation) ||
            FilterBarOrientation.VERTICAL,
          crossFiltersEnabled,
        },
        dataMask,
        dashboardFilters,
        nativeFilters,
        dashboardState: {
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
          datasetsStatus: ResourceStatus.LOADING,
        },
        dashboardLayout,
      },
    });
  };
