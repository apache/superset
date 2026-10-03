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
import { dashboard as dashboardApi } from '@apache-superset/core';
import { isNativeFilter, makeApi, SupersetClient } from '@superset-ui/core';
import type {
  DataMask,
  Divider,
  Filter,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { matchPath } from 'react-router-dom';
import { updateComponents } from 'src/dashboard/actions/dashboardLayout';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { applySavedFilterChanges } from 'src/dashboard/actions/nativeFilters';
import type { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { updateDataMask } from 'src/dataMask/actions';
import {
  setChartFormData,
  triggerQuery,
} from 'src/components/Chart/chartAction';
import { invalidateChartFormDataCache } from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { applyDefaultFormData } from 'src/explore/store';
import extractUrlParams from 'src/dashboard/util/extractUrlParams';
import { RoutePaths } from 'src/views/routePaths';
import { store, RootState } from 'src/views/store';
import { navigation } from '../navigation';

const getState = () => store.getState() as RootState;

// The `:idOrSlug` the browser's current URL routes to, read directly off
// `window.location` rather than from React Router context, matching how
// `navigation`'s own page derivation works.
const getRoutedIdOrSlug = (): string | undefined =>
  matchPath<{ idOrSlug: string }>(window.location.pathname, {
    path: RoutePaths.DASHBOARD,
    exact: false,
  })?.params.idOrSlug;

// `dashboardInfo`/`dashboardLayout`/`nativeFilters`/`charts` are retained
// across an in-SPA navigation, and even once the browser has routed to a new
// dashboard, they keep the *previous* dashboard's data until that
// dashboard's HYDRATE_DASHBOARD completes. Comparing the URL's `idOrSlug`
// against `dashboardInfo`'s own id/slug — rather than trusting the page type
// alone — closes this window: they only match again once hydration has
// actually caught up, including for a same-surface dashboard-to-dashboard
// navigation.
const isDashboardActive = (): boolean => {
  if (navigation.getPage() !== 'dashboard') return false;
  const idOrSlug = getRoutedIdOrSlug();
  if (idOrSlug == null) return false;
  const { id, slug } = getState().dashboardInfo;
  return id != null && (String(id) === idOrSlug || slug === idOrSlug);
};

const requireDashboardId = (): number => {
  const { id } = getState().dashboardInfo;
  if (!isDashboardActive() || id == null) {
    throw new Error('No dashboard is currently active');
  }
  return id;
};

const getDashboardId: typeof dashboardApi.getDashboardId = () =>
  isDashboardActive() ? (getState().dashboardInfo.id ?? undefined) : undefined;

// Every dashboardLayout reducer treats a node (and its `meta`/`children`/
// `parents`) as immutable already — an update always replaces it with a new
// object rather than mutating it in place — so freezing the copy below only
// makes that existing contract explicit, without risking a reducer's own
// future in-place update on a node returned from here.
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

const getLayout: typeof dashboardApi.getLayout = () =>
  isDashboardActive()
    ? deepFreeze({ ...getState().dashboardLayout.present })
    : {};

const getActiveTabs: typeof dashboardApi.getActiveTabs = () =>
  isDashboardActive() ? [...(getState().dashboardState.activeTabs ?? [])] : [];

const updateLayoutNode: typeof dashboardApi.updateLayoutNode = async (
  nodeId: string,
  meta: Record<string, unknown>,
) => {
  requireDashboardId();
  const node = getState().dashboardLayout.present[nodeId];
  if (!node) {
    throw new Error(`Layout node "${nodeId}" not found`);
  }
  // UPDATE_COMPONENTS replaces each keyed entry wholesale (it's not a deep
  // merge), so the node's other fields must be carried through alongside
  // the merged meta.
  store.dispatch(
    updateComponents({
      [nodeId]: { ...node, meta: { ...node.meta, ...meta } },
    }) as any,
  );
};

const getCss: typeof dashboardApi.getCss = () =>
  isDashboardActive() ? (getState().dashboardInfo.css ?? '') : '';

const setCss: typeof dashboardApi.setCss = async (css: string) => {
  requireDashboardId();
  store.dispatch(dashboardInfoChanged({ css }));
};

const getFilters: typeof dashboardApi.getFilters = () => {
  if (!isDashboardActive()) return [];
  const { nativeFilters, dataMask } = getState();
  const filterElements = Object.values(nativeFilters.filters) as Array<
    Filter | Divider
  >;
  return filterElements.filter(isNativeFilter).map(filter => {
    const mask = dataMask[filter.id];
    return {
      id: filter.id,
      name: filter.name,
      filterType: filter.filterType,
      targets: filter.targets,
      extraFormData: mask?.extraFormData,
      filterState: mask?.filterState,
    };
  });
};

const updateFilters: typeof dashboardApi.updateFilters = async (
  updates: dashboardApi.FilterValueUpdate[],
) => {
  requireDashboardId();
  const { filters: currentFilters } = getState().nativeFilters;
  updates.forEach(({ filterId }) => {
    if (!currentFilters[filterId]) {
      throw new Error(`Filter "${filterId}" not found on this dashboard`);
    }
  });
  updates.forEach(({ filterId, extraFormData, filterState }) => {
    const dataMask: DataMask = {};
    if (extraFormData !== undefined) {
      dataMask.extraFormData = extraFormData;
    }
    if (filterState !== undefined) {
      dataMask.filterState = filterState;
    }
    store.dispatch(updateDataMask(filterId, dataMask));
  });
};

const saveFilters: typeof dashboardApi.saveFilters = async (
  updates: dashboardApi.FilterConfigUpdate[],
  deletedFilterIds: string[] = [],
) => {
  const dashboardId = requireDashboardId();
  const { filters: currentFilters } = getState().nativeFilters;
  const { dataMask: currentDataMask } = getState();

  const modified = updates.map(
    ({ filterId, name, targets, defaultDataMask }) => {
      const existing = currentFilters[filterId];
      if (!existing) {
        throw new Error(`Filter "${filterId}" not found on this dashboard`);
      }
      return {
        ...existing,
        ...(name !== undefined && { name }),
        ...(targets !== undefined && { targets }),
        ...(defaultDataMask !== undefined && { defaultDataMask }),
      };
    },
  ) as SaveFilterChangesType['modified'];

  if (modified.length === 0 && deletedFilterIds.length === 0) {
    return;
  }

  const filterChanges: SaveFilterChangesType = {
    modified,
    deleted: deletedFilterIds,
    reordered: [],
  };

  const putFilters = makeApi<SaveFilterChangesType, { result: Filter[] }>({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${dashboardId}/filters`,
  });
  const response = await putFilters(filterChanges);
  applySavedFilterChanges(
    store.dispatch,
    filterChanges,
    response.result,
    currentFilters,
  );

  // applySavedFilterChanges resets each modified filter's live extraFormData/
  // filterState back to its default unless the filter is required or
  // defaultToFirstItem (see updateDataMaskForFilterChanges), even for an
  // update that never touched the filter's value (e.g. a rename). Restore
  // whatever was live immediately before this save for any filter whose
  // update didn't explicitly set a new one.
  updates.forEach(({ filterId, defaultDataMask }) => {
    if (defaultDataMask !== undefined) return;
    const liveMask = currentDataMask[filterId];
    if (!liveMask) return;
    store.dispatch(
      updateDataMask(filterId, {
        extraFormData: liveMask.extraFormData,
        filterState: liveMask.filterState,
      }),
    );
  });
};

// TRIGGER_QUERY synchronously sets chartStatus to 'loading'; the mounted
// Chart component then re-queries and re-renders it, landing on one of
// these terminal statuses (see chartReducer.ts).
const isTerminalChartStatus = (status: string | null | undefined): boolean =>
  status === 'rendered' || status === 'failed' || status === 'stopped';

const waitForChartRefresh = (chartId: number): Promise<void> =>
  new Promise(resolve => {
    if (isTerminalChartStatus(getState().charts[chartId]?.chartStatus)) {
      resolve();
      return;
    }
    const unsubscribe = store.subscribe(() => {
      if (isTerminalChartStatus(getState().charts[chartId]?.chartStatus)) {
        unsubscribe();
        resolve();
      }
    });
  });

const refreshChart: typeof dashboardApi.refreshChart = async (
  chartId: number,
) => {
  const dashboardId = requireDashboardId();
  if (!getState().charts[chartId]) {
    throw new Error(`Chart ${chartId} is not on the current dashboard`);
  }

  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/dashboard/${dashboardId}/charts`,
  });
  const chartEntity = (
    json?.result as { id: number; form_data?: JsonObject }[]
  )?.find(({ id }) => id === chartId);
  if (!chartEntity?.form_data) {
    throw new Error(`Could not load chart ${chartId}'s current configuration`);
  }

  const formData = applyDefaultFormData({
    ...chartEntity.form_data,
    url_params: {
      ...(chartEntity.form_data.url_params as JsonObject),
      ...extractUrlParams('regular'),
    },
  } as Parameters<typeof applyDefaultFormData>[0]) as QueryFormData;

  // getFormDataWithExtraFilters's per-chart cache only invalidates on
  // dataMask/nativeFilters/filters/color/customization changes, not on the
  // chart's own form_data, so it must be evicted explicitly or the query
  // triggered below can run with the previous configuration.
  invalidateChartFormDataCache(chartId);
  store.dispatch(setChartFormData(formData, chartId));
  store.dispatch(triggerQuery(true, chartId));
  await waitForChartRefresh(chartId);
};

export const dashboard: typeof dashboardApi = {
  getDashboardId,
  getLayout,
  getActiveTabs,
  updateLayoutNode,
  getCss,
  setCss,
  getFilters,
  updateFilters,
  saveFilters,
  refreshChart,
};
