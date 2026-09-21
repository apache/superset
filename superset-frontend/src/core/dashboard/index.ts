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
import { updateComponents } from 'src/dashboard/actions/dashboardLayout';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { applySavedFilterChanges } from 'src/dashboard/actions/nativeFilters';
import type { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { updateDataMask } from 'src/dataMask/actions';
import {
  setChartFormData,
  triggerQuery,
} from 'src/components/Chart/chartAction';
import { applyDefaultFormData } from 'src/explore/store';
import extractUrlParams from 'src/dashboard/util/extractUrlParams';
import { store, RootState } from 'src/views/store';
import { navigation } from '../navigation';

const getState = () => store.getState() as RootState;

// The Redux slices below are retained across an in-SPA navigation, so
// checking them alone can't tell a still-active dashboard from a stale one
// left over from before the user navigated to another page.
const isDashboardActive = (): boolean => navigation.getPage() === 'dashboard';

const requireDashboardId = (): number => {
  const { id } = getState().dashboardInfo;
  if (!isDashboardActive() || id == null) {
    throw new Error('No dashboard is currently active');
  }
  return id;
};

const getDashboardId: typeof dashboardApi.getDashboardId = () =>
  isDashboardActive() ? (getState().dashboardInfo.id ?? undefined) : undefined;

const getLayout: typeof dashboardApi.getLayout = () =>
  isDashboardActive()
    ? { ...(getState().dashboardLayout.present as Record<string, unknown>) }
    : {};

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
};

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

  store.dispatch(setChartFormData(formData, chartId));
  store.dispatch(triggerQuery(true, chartId));
};

export const dashboard: typeof dashboardApi = {
  getDashboardId,
  getLayout,
  updateLayoutNode,
  getCss,
  setCss,
  getFilters,
  updateFilters,
  saveFilters,
  refreshChart,
};
