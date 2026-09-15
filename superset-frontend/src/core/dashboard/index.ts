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
import { isNativeFilter } from '@superset-ui/core';
import type { Divider, Filter } from '@superset-ui/core';
import { updateComponents } from 'src/dashboard/actions/dashboardLayout';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { updateDataMask } from 'src/dataMask/actions';
import { store, RootState } from 'src/views/store';

const getState = () => store.getState() as RootState;

const requireDashboardId = (): number => {
  const { id } = getState().dashboardInfo;
  if (id == null) {
    throw new Error('No dashboard is currently active');
  }
  return id;
};

const getDashboardId: typeof dashboardApi.getDashboardId = () =>
  getState().dashboardInfo.id ?? undefined;

const getLayout: typeof dashboardApi.getLayout = () => ({
  ...(getState().dashboardLayout.present as Record<string, unknown>),
});

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

const getCss: typeof dashboardApi.getCss = () => getState().dashboardInfo.css ?? '';

const setCss: typeof dashboardApi.setCss = async (css: string) => {
  requireDashboardId();
  store.dispatch(dashboardInfoChanged({ css }));
};

const getFilters: typeof dashboardApi.getFilters = () => {
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
    store.dispatch(updateDataMask(filterId, { extraFormData, filterState }));
  });
};

export const dashboard: typeof dashboardApi = {
  getDashboardId,
  getLayout,
  updateLayoutNode,
  getCss,
  setCss,
  getFilters,
  updateFilters,
};
