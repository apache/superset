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
 * Host-internal implementation of the `dashboard` namespace.
 *
 * Wraps Redux dashboardInfo and dataMask state and normalizes them into the
 * stable `DashboardContext` contract. Extensions must not depend on the Redux
 * slice structure directly.
 */

import type { dashboard as dashboardApi } from '@apache-superset/core';
import type { DataMaskStateWithId } from '@superset-ui/core';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import {
  UPDATE_DATA_MASK,
  SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE,
} from 'src/dataMask/actions';
import { store, RootState } from 'src/views/store';
import { AnyListenerPredicate } from '@reduxjs/toolkit';
import getChartIdsFromLayout from 'src/dashboard/util/getChartIdsFromLayout';
import { createActionListener } from '../utils';
import { navigation } from '../navigation';

type DashboardContext = dashboardApi.DashboardContext;
type FilterValue = dashboardApi.FilterValue;
type ChartSummary = NonNullable<DashboardContext['charts']>[number];

function buildChartSummaries(state: RootState): ChartSummary[] {
  const slices = state.sliceEntities?.slices ?? {};
  const layout = state.dashboardLayout?.present ?? {};

  // Only charts actually placed on the dashboard layout — `slices` can also
  // hold entities that are not on the current dashboard.
  return getChartIdsFromLayout(layout).map(chartId => {
    const slice = slices[chartId];
    return {
      chartId,
      chartName: slice?.slice_name ?? '',
      vizType: slice?.viz_type ?? '',
      datasourceId: slice?.datasource_id ?? null,
      datasourceName: slice?.datasource_name ?? null,
      // Tab-accurate visibility is a deferred phase; every chart on the
      // dashboard is reported visible for now.
      isVisible: true,
    };
  });
}

function buildDashboardContext(): DashboardContext | undefined {
  if (navigation.getPageType() !== 'dashboard') return undefined;
  // `store.getState()` is already typed as RootState, so the slices below are
  // read with their real types — the host owns this normalization and must
  // stay type-safe against slice reshapes.
  const state = store.getState();
  const info = state.dashboardInfo;
  if (!info?.id) return undefined;

  const nativeFilters = state.nativeFilters?.filters ?? {};
  const dataMask: DataMaskStateWithId = state.dataMask ?? {};

  const filters: FilterValue[] = Object.entries(dataMask)
    .filter(([id, mask]) => {
      if (!(id in nativeFilters)) return false;
      const value = mask?.filterState?.value;
      return value !== null && value !== undefined;
    })
    .map(([id, mask]) => {
      const raw = mask.filterState?.value;
      return {
        filterId: id,
        label: nativeFilters[id]?.name ?? id,
        value: Array.isArray(raw) ? [...raw] : raw,
      };
    });

  return {
    dashboardId: info.id,
    title: info.dashboard_title ?? info.slug ?? String(info.id),
    filters,
    charts: buildChartSummaries(state),
  };
}

const dashboardChangePredicate: AnyListenerPredicate<RootState> = action =>
  action.type === HYDRATE_DASHBOARD ||
  action.type === UPDATE_DATA_MASK ||
  action.type === SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE;

const getCurrentDashboard: typeof dashboardApi.getCurrentDashboard = () =>
  buildDashboardContext();

const onDidChangeDashboard: typeof dashboardApi.onDidChangeDashboard = (
  listener: (ctx: DashboardContext) => void,
  thisArgs?: any,
) =>
  createActionListener<DashboardContext>(
    dashboardChangePredicate,
    listener,
    () => buildDashboardContext() ?? null,
    thisArgs,
  );

export const dashboard: typeof dashboardApi = {
  getCurrentDashboard,
  onDidChangeDashboard,
};
