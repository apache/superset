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
import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';

import rootReducer from 'src/dashboard/reducers/index';

import mockState from './mockState';
import {
  dashboardLayoutWithTabs,
  dashboardLayoutWithChartsInTabsAndRoot,
} from './mockDashboardLayout';
import { sliceId } from './mockChartQueries';
import { dashboardFilters } from './mockDashboardFilters';
import { nativeFilters } from './mockNativeFilters';

export const getMockStore = overrideState =>
  createStore(
    rootReducer,
    { ...mockState, ...overrideState },
    compose(applyMiddleware(thunk)),
  );

export const mockStore = getMockStore();

export const getMockStoreWithTabs = () =>
  createStore(
    rootReducer,
    {
      ...mockState,
      dashboardLayout: dashboardLayoutWithTabs,
      dashboardFilters: {},
    },
    compose(applyMiddleware(thunk)),
  );

export const getMockStoreWithChartsInTabsAndRoot = () =>
  createStore(
    rootReducer,
    {
      ...mockState,
      dashboardLayout: dashboardLayoutWithChartsInTabsAndRoot,
      dashboardFilters: {},
    },
    compose(applyMiddleware(thunk)),
  );

export const mockStoreWithTabs = getMockStoreWithTabs();
export const mockStoreWithChartsInTabsAndRoot = getMockStoreWithChartsInTabsAndRoot();

export const sliceIdWithAppliedFilter = sliceId + 1;
export const sliceIdWithRejectedFilter = sliceId + 2;

// has one chart with a filter that has been applied,
// one chart with a filter that has been rejected,
// and one chart with no filters set.
export const getMockStoreWithFilters = () =>
  createStore(rootReducer, {
    ...mockState,
    dashboardFilters,
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
  });

export const getMockStoreWithNativeFilters = () =>
  createStore(rootReducer, {
    ...mockState,
    nativeFilters,
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
  });
