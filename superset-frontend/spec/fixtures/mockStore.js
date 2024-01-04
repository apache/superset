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
import { setupStore } from 'src/views/store';
import { FilterBarOrientation } from 'src/dashboard/types';

import mockState from './mockState';
import {
  dashboardLayoutWithTabs,
  dashboardLayoutWithChartsInTabsAndRoot,
} from './mockDashboardLayout';
import { sliceId } from './mockChartQueries';
import { dashboardFilters } from './mockDashboardFilters';
import { nativeFilters, dataMaskWith2Filters } from './mockNativeFilters';

export const storeWithState = state =>
  setupStore({
    disableDebugger: true,
    initialState: state,
  });

export const getMockStore = overrideState =>
  setupStore({
    disableDebugger: true,
    initialState: { ...mockState, ...overrideState },
  });

export const mockStore = getMockStore();

export const getMockStoreWithTabs = () =>
  setupStore({
    disableDebugger: true,
    initialState: {
      ...mockState,
      dashboardLayout: dashboardLayoutWithTabs,
      dashboardFilters: {},
    },
  });

export const getMockStoreWithChartsInTabsAndRoot = () =>
  setupStore({
    disableDebugger: true,
    initialState: {
      ...mockState,
      dashboardLayout: dashboardLayoutWithChartsInTabsAndRoot,
      dashboardFilters: {},
    },
  });

export const mockStoreWithTabs = getMockStoreWithTabs();
export const mockStoreWithChartsInTabsAndRoot =
  getMockStoreWithChartsInTabsAndRoot();

export const sliceIdWithAppliedFilter = sliceId + 1;
export const sliceIdWithRejectedFilter = sliceId + 2;

export const stateWithFilters = {
  ...mockState,
  dashboardFilters,
  dataMask: dataMaskWith2Filters,
  charts: {
    ...mockState.charts,
    [sliceIdWithAppliedFilter]: {
      ...mockState.charts[sliceId],
      queryResponse: {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    },
    [sliceIdWithRejectedFilter]: {
      ...mockState.charts[sliceId],
      queryResponse: {
        status: 'success',
        applied_filters: [],
        rejected_filters: [{ column: 'region', reason: 'not_in_datasource' }],
      },
    },
  },
};

// has one chart with a filter that has been applied,
// one chart with a filter that has been rejected,
// and one chart with no filters set.
export const getMockStoreWithFilters = () =>
  setupStore({
    disableDebugger: true,
    initialState: stateWithFilters,
  });

export const stateWithNativeFilters = {
  ...mockState,
  nativeFilters,
  dataMask: dataMaskWith2Filters,
  charts: {
    ...mockState.charts,
    [sliceIdWithAppliedFilter]: {
      ...mockState.charts[sliceId],
      queryResponse: {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    },
    [sliceIdWithRejectedFilter]: {
      ...mockState.charts[sliceId],
      queryResponse: {
        status: 'success',
        applied_filters: [],
        rejected_filters: [{ column: 'region', reason: 'not_in_datasource' }],
      },
    },
  },
  dashboardInfo: {
    filterBarOrientation: FilterBarOrientation.VERTICAL,
  },
};

export const getMockStoreWithNativeFilters = () =>
  setupStore({
    disableDebugger: true,
    initialState: stateWithNativeFilters,
  });

export const stateWithoutNativeFilters = {
  ...mockState,
  charts: {
    ...mockState.charts,
    [sliceIdWithAppliedFilter]: {
      ...mockState.charts[sliceId],
      queryResponse: {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    },
    [sliceIdWithRejectedFilter]: {
      ...mockState.charts[sliceId],
      queryResponse: {
        status: 'success',
        applied_filters: [],
        rejected_filters: [{ column: 'region', reason: 'not_in_datasource' }],
      },
    },
  },
  dashboardInfo: {
    dash_edit_perm: true,
    filterBarOrientation: FilterBarOrientation.VERTICAL,
    metadata: {
      native_filter_configuration: [],
    },
  },
  dataMask: {},
  nativeFilters: { filters: {}, filterSets: {} },
};
