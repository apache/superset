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
// eslint-disable-next-line import/no-extraneous-dependencies
import fetchMock from 'fetch-mock';
import { render } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryParamProvider } from 'use-query-params';
import ChartList from 'src/pages/ChartList';
import handleResourceExport from 'src/utils/export';

export const mockHandleResourceExport =
  handleResourceExport as jest.MockedFunction<typeof handleResourceExport>;

export const mockCharts = [
  {
    id: 0,
    url: '/superset/slice/0/',
    viz_type: 'table',
    slice_name: 'Test Chart 0',

    // ✅ Basic case - has some data
    owners: [{ first_name: 'Test', last_name: 'User', id: 1 }],
    dashboards: [{ dashboard_title: 'Test Dashboard', id: 1 }],
    tags: [{ name: 'basic', type: 1, id: 1 }],

    datasource_name_text: 'public.test_dataset',
    datasource_url: '/superset/explore/table/1/',
    datasource_id: 1,

    changed_by_name: 'user',
    changed_by: {
      first_name: 'Test',
      last_name: 'User',
      id: 1,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '1 day ago',
    last_saved_at: new Date().toISOString(),

    created_by: 'user',
    description: 'Test chart description',
    thumbnail_url: '/api/v1/chart/0/thumbnail/',
    certified_by: null,
    certification_details: null,
  },
  {
    id: 1,
    url: '/superset/slice/1/',
    viz_type: 'bar',
    slice_name: 'Test Chart 1',

    // ✅ FULL DATA CASE - everything populated for comprehensive testing
    owners: [
      { first_name: 'Admin', last_name: 'User', id: 2 },
      { first_name: 'Data', last_name: 'Analyst', id: 3 },
    ],
    dashboards: [
      { dashboard_title: 'Sales Dashboard', id: 2 },
      { dashboard_title: 'Analytics Dashboard', id: 3 },
      { dashboard_title: 'Executive Dashboard', id: 4 },
    ],
    tags: [
      { name: 'production', type: 1, id: 2 },
      { name: 'sales', type: 1, id: 3 },
      { name: 'analytics', type: 1, id: 4 },
    ],

    datasource_name_text: 'sales_data',
    datasource_url: '/superset/explore/table/2/',
    datasource_id: 2,

    changed_by_name: 'admin',
    changed_by: {
      first_name: 'Admin',
      last_name: 'User',
      id: 2,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '2 days ago',
    last_saved_at: new Date().toISOString(),

    created_by: 'admin',
    description: 'Comprehensive sales analytics chart',
    thumbnail_url: '/api/v1/chart/1/thumbnail/',
    certified_by: 'Data Team',
    certification_details: 'Approved for production use',
  },
  {
    id: 2,
    url: '/superset/slice/2/',
    viz_type: 'line',
    slice_name: 'Test Chart 2',

    // ✅ EDGE CASE - no owners, no dataset, no dashboards, no tags
    owners: [],
    dashboards: [],
    tags: [],

    datasource_name_text: null,
    datasource_url: null,
    datasource_id: null,

    changed_by_name: 'system',
    changed_by: {
      first_name: 'System',
      last_name: 'User',
      id: 999,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '3 days ago',
    last_saved_at: new Date().toISOString(),

    created_by: 'system',
    description: null,
    thumbnail_url: '/api/v1/chart/2/thumbnail/',
    certified_by: null,
    certification_details: null,
  },
  {
    id: 3,
    url: '/superset/slice/3/',
    viz_type: 'area',
    slice_name: 'Test Chart 3',

    // ✅ TRUNCATION TEST - Exactly at limits (4 owners, 20 dashboards)
    owners: [
      { first_name: 'Admin', last_name: 'User', id: 2 },
      { first_name: 'Data', last_name: 'Analyst', id: 3 },
      { first_name: 'Limit', last_name: 'User', id: 40 },
      { first_name: 'Test', last_name: 'User', id: 43 },
    ],
    dashboards: Array.from({ length: 20 }, (_, i) => ({
      dashboard_title: `Dashboard ${i + 1}`,
      id: 200 + i,
    })),
    tags: [{ name: 'limit-test', type: 1, id: 10 }],

    datasource_name_text: 'public.limits_dataset',
    datasource_url: '/superset/explore/table/4/',
    datasource_id: 4,

    changed_by_name: 'limit_user',
    changed_by: {
      first_name: 'Limit',
      last_name: 'User',
      id: 40,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '4 days ago',
    last_saved_at: new Date().toISOString(),

    created_by: 'limit_user',
    description: 'Chart at exact truncation limits',
    thumbnail_url: '/api/v1/chart/3/thumbnail/',
    certified_by: 'QA Team',
    certification_details: 'Verified for limit testing',
  },
  {
    id: 4,
    url: '/superset/slice/4/',
    viz_type: 'bubble',
    slice_name: 'Test Chart 4',

    // ✅ TRUNCATION TEST - Just above limits (5 owners shows +1, 21 dashboards)
    owners: [
      { first_name: 'Admin', last_name: 'User', id: 2 },
      { first_name: 'Data', last_name: 'Analyst', id: 3 },
      { first_name: 'Limit', last_name: 'User', id: 40 },
      { first_name: 'Test', last_name: 'User', id: 43 },
      { first_name: 'Overflow', last_name: 'User', id: 50 },
    ],
    dashboards: Array.from({ length: 21 }, (_, i) => ({
      dashboard_title: `Extra Dashboard ${i + 1}`,
      id: 300 + i,
    })),
    tags: [{ name: 'overflow', type: 1, id: 11 }],

    datasource_name_text: 'public.overflow_dataset',
    datasource_url: '/superset/explore/table/5/',
    datasource_id: 5,

    changed_by_name: 'overflow_user',
    changed_by: {
      first_name: 'Overflow',
      last_name: 'User',
      id: 50,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '5 days ago',
    last_saved_at: new Date().toISOString(),

    created_by: 'overflow_user',
    description: 'Chart exceeding truncation limits',
    thumbnail_url: '/api/v1/chart/4/thumbnail/',
    certified_by: null,
    certification_details: null,
  },
];

// Shared store utilities
export const createMockStore = (initialState: any = {}) =>
  configureStore({
    reducer: {
      user: (state = initialState.user || {}) => state,
      common: (state = initialState.common || {}) => state,
      charts: (state = initialState.charts || {}) => state,
    },
    preloadedState: initialState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });

export const createDefaultStoreState = (user: any) => ({
  user,
  common: {
    conf: {
      SUPERSET_WEBSERVER_TIMEOUT: 60000,
    },
  },
  charts: {
    chartList: mockCharts,
  },
});

export const renderChartList = (user: any, props = {}, storeState = {}) => {
  const defaultStoreState = createDefaultStoreState(user);
  const storeStateWithUser = {
    ...defaultStoreState,
    user,
    ...storeState,
  };

  const store = createMockStore(storeStateWithUser);

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <QueryParamProvider>
          <ChartList user={user} {...props} />
        </QueryParamProvider>
      </MemoryRouter>
    </Provider>,
  );
};

// API endpoint constants for reuse across tests
export const API_ENDPOINTS = {
  CHARTS_INFO: 'glob:*/api/v1/chart/_info*',
  CHARTS: 'glob:*/api/v1/chart/?*',
  CHART_FAVORITE_STATUS: 'glob:*/api/v1/chart/favorite_status*',
  CHART_VIZ_TYPES: 'glob:*/api/v1/chart/viz_types*',
  CHART_THUMBNAILS: 'glob:*/api/v1/chart/*/thumbnail/*',
  DATASETS: 'glob:*/api/v1/dataset/?q=*',
  DASHBOARDS: 'glob:*/api/v1/dashboard/?q=*',
  CHART_RELATED_OWNERS: 'glob:*/api/v1/chart/related/owners*',
  CHART_RELATED_CHANGED_BY: 'glob:*/api/v1/chart/related/changed_by*',
  CATCH_ALL: 'glob:*',
};

export const setupMocks = () => {
  fetchMock.reset();

  fetchMock.get(API_ENDPOINTS.CHARTS_INFO, {
    permissions: ['can_read', 'can_write', 'can_export'],
  });

  fetchMock.get(API_ENDPOINTS.CHARTS, {
    result: mockCharts,
    chart_count: mockCharts.length,
  });

  fetchMock.get(API_ENDPOINTS.CHART_FAVORITE_STATUS, {
    result: [],
  });

  fetchMock.get(API_ENDPOINTS.CHART_VIZ_TYPES, {
    result: [
      { text: 'Table', value: 'table' },
      { text: 'Bar Chart', value: 'bar' },
      { text: 'Line Chart', value: 'line' },
    ],
    count: 3,
  });

  fetchMock.get(API_ENDPOINTS.CHART_THUMBNAILS, {
    body: new Blob(),
    sendAsJson: false,
  });

  fetchMock.get(API_ENDPOINTS.DATASETS, {
    result: [],
    count: 0,
  });

  fetchMock.get(API_ENDPOINTS.DASHBOARDS, {
    result: [],
    count: 0,
  });

  fetchMock.get(API_ENDPOINTS.CHART_RELATED_OWNERS, {
    result: [],
    count: 0,
  });

  fetchMock.get(API_ENDPOINTS.CHART_RELATED_CHANGED_BY, {
    result: [],
    count: 0,
  });

  fetchMock.get(API_ENDPOINTS.CATCH_ALL, { result: [], count: 0 });
};
