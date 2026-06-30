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
import rison from 'rison';
import { render, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import DashboardListComponent from 'src/pages/DashboardList';
import handleResourceExport from 'src/utils/export';

// Cast to accept partial mock props in tests
const DashboardList = DashboardListComponent as unknown as React.FC<
  Record<string, any>
>;

export const mockHandleResourceExport =
  handleResourceExport as jest.MockedFunction<typeof handleResourceExport>;

export const mockDashboards = [
  {
    id: 1,
    url: '/superset/dashboard/1/',
    dashboard_title: 'Sales Dashboard',
    published: true,
    changed_by_name: 'admin',
    changed_by_fk: 1,
    changed_by: {
      first_name: 'Admin',
      last_name: 'User',
      id: 1,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '1 day ago',
    owners: [{ id: 1, first_name: 'Admin', last_name: 'User' }],
    roles: [{ id: 1, name: 'Admin' }],
    tags: [{ id: 1, name: 'production', type: 'TagTypes.custom' }],
    thumbnail_url: '/thumbnail',
    certified_by: 'Data Team',
    certification_details: 'Approved for production use',
    status: 'published',
  },
  {
    id: 2,
    url: '/superset/dashboard/2/',
    dashboard_title: 'Analytics Dashboard',
    published: false,
    changed_by_name: 'analyst',
    changed_by_fk: 2,
    changed_by: {
      first_name: 'Data',
      last_name: 'Analyst',
      id: 2,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '2 days ago',
    owners: [
      { id: 1, first_name: 'Admin', last_name: 'User' },
      { id: 2, first_name: 'Data', last_name: 'Analyst' },
    ],
    roles: [],
    tags: [],
    thumbnail_url: '/thumbnail',
    certified_by: null,
    certification_details: null,
    status: 'draft',
  },
  {
    id: 3,
    url: '/superset/dashboard/3/',
    dashboard_title: 'Executive Overview',
    published: true,
    changed_by_name: 'admin',
    changed_by_fk: 1,
    changed_by: {
      first_name: 'Admin',
      last_name: 'User',
      id: 1,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '3 days ago',
    owners: [],
    roles: [{ id: 2, name: 'Alpha' }],
    tags: [
      { id: 2, name: 'executive', type: 'TagTypes.custom' },
      { id: 3, name: 'quarterly', type: 'TagTypes.custom' },
    ],
    thumbnail_url: '/thumbnail',
    certified_by: 'QA Team',
    certification_details: 'Verified for executive use',
    status: 'published',
  },
  {
    id: 4,
    url: '/superset/dashboard/4/',
    dashboard_title: 'Marketing Metrics',
    published: false,
    changed_by_name: 'marketing',
    changed_by_fk: 3,
    changed_by: {
      first_name: 'Marketing',
      last_name: 'Lead',
      id: 3,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '5 days ago',
    owners: [{ id: 3, first_name: 'Marketing', last_name: 'Lead' }],
    roles: [],
    tags: [],
    thumbnail_url: '/thumbnail',
    certified_by: null,
    certification_details: null,
    status: 'draft',
  },
  {
    id: 5,
    url: '/superset/dashboard/5/',
    dashboard_title: 'Ops Monitor',
    published: true,
    changed_by_name: 'ops',
    changed_by_fk: 4,
    changed_by: {
      first_name: 'Ops',
      last_name: 'Engineer',
      id: 4,
    },
    changed_on_utc: new Date().toISOString(),
    changed_on_delta_humanized: '1 week ago',
    owners: [
      { id: 4, first_name: 'Ops', last_name: 'Engineer' },
      { id: 1, first_name: 'Admin', last_name: 'User' },
    ],
    roles: [],
    tags: [{ id: 4, name: 'monitoring', type: 'TagTypes.custom' }],
    thumbnail_url: '/thumbnail',
    certified_by: null,
    certification_details: null,
    status: 'published',
  },
];

// Mock users with various permission levels
export const mockAdminUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_write', 'Dashboard'],
      ['can_export', 'Dashboard'],
      ['can_read', 'Tag'],
    ],
  },
};

export const mockReadOnlyUser = {
  userId: 10,
  firstName: 'Read',
  lastName: 'Only',
  roles: {
    Gamma: [['can_read', 'Dashboard']],
  },
};

export const mockExportOnlyUser = {
  userId: 11,
  firstName: 'Export',
  lastName: 'User',
  roles: {
    Gamma: [
      ['can_read', 'Dashboard'],
      ['can_export', 'Dashboard'],
    ],
  },
};

// API endpoint constants
export const API_ENDPOINTS = {
  DASHBOARDS_INFO: 'glob:*/api/v1/dashboard/_info*',
  DASHBOARDS: 'glob:*/api/v1/dashboard/?*',
  DASHBOARD_GET: 'glob:*/api/v1/dashboard/*',
  DASHBOARD_FAVORITE_STATUS: 'glob:*/api/v1/dashboard/favorite_status*',
  DASHBOARD_RELATED_OWNERS: 'glob:*/api/v1/dashboard/related/owners*',
  DASHBOARD_RELATED_CHANGED_BY: 'glob:*/api/v1/dashboard/related/changed_by*',
  THUMBNAIL: '/thumbnail',
  CATCH_ALL: 'glob:*',
};

interface StoreState {
  user?: any;
  common?: {
    conf?: {
      SUPERSET_WEBSERVER_TIMEOUT?: number;
    };
  };
  dashboards?: {
    dashboardList?: typeof mockDashboards;
  };
}

export const createMockStore = (initialState: Partial<StoreState> = {}) =>
  configureStore({
    reducer: {
      user: (state = initialState.user || {}) => state,
      common: (state = initialState.common || {}) => state,
      dashboards: (state = initialState.dashboards || {}) => state,
    },
    preloadedState: initialState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });

export const createDefaultStoreState = (user: any): StoreState => ({
  user,
  common: {
    conf: {
      SUPERSET_WEBSERVER_TIMEOUT: 60000,
    },
  },
  dashboards: {
    dashboardList: mockDashboards,
  },
});

export const renderDashboardList = (
  user: any,
  props: Record<string, any> = {},
  storeState: Partial<StoreState> = {},
) => {
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
        <QueryParamProvider adapter={ReactRouter5Adapter}>
          <DashboardList user={user} {...props} />
        </QueryParamProvider>
      </MemoryRouter>
    </Provider>,
  );
};

/**
 * Helper to wait for the DashboardList page to be ready
 * Waits for the "Dashboards" heading to appear, indicating initial render is complete
 */
export const waitForDashboardsPageReady = async () => {
  await screen.findByText('Dashboards');
};

export const setupMocks = (
  payloadMap: Record<string, string[]> = {
    [API_ENDPOINTS.DASHBOARDS_INFO]: ['can_read', 'can_write', 'can_export'],
  },
) => {
  fetchMock.get(
    API_ENDPOINTS.DASHBOARDS_INFO,
    {
      permissions: payloadMap[API_ENDPOINTS.DASHBOARDS_INFO],
    },
    { name: API_ENDPOINTS.DASHBOARDS_INFO },
  );

  fetchMock.get(
    API_ENDPOINTS.DASHBOARDS,
    {
      result: mockDashboards,
      dashboard_count: mockDashboards.length,
    },
    { name: API_ENDPOINTS.DASHBOARDS },
  );

  fetchMock.get(
    API_ENDPOINTS.DASHBOARD_FAVORITE_STATUS,
    { result: [] },
    { name: API_ENDPOINTS.DASHBOARD_FAVORITE_STATUS },
  );

  fetchMock.get(
    API_ENDPOINTS.DASHBOARD_RELATED_OWNERS,
    { result: [], count: 0 },
    { name: API_ENDPOINTS.DASHBOARD_RELATED_OWNERS },
  );

  fetchMock.get(
    API_ENDPOINTS.DASHBOARD_RELATED_CHANGED_BY,
    { result: [], count: 0 },
    { name: API_ENDPOINTS.DASHBOARD_RELATED_CHANGED_BY },
  );

  global.URL.createObjectURL = jest.fn();
  fetchMock.get(
    API_ENDPOINTS.THUMBNAIL,
    { body: new Blob(), sendAsJson: false },
    { name: API_ENDPOINTS.THUMBNAIL },
  );

  fetchMock.get(
    API_ENDPOINTS.CATCH_ALL,
    (callLog: any) => {
      const reqUrl =
        typeof callLog === 'string' ? callLog : callLog?.url || callLog;
      throw new Error(`[fetchMock catch-all] Unmatched GET: ${reqUrl}`);
    },
    { name: API_ENDPOINTS.CATCH_ALL },
  );
};

/**
 * Parse the rison-encoded `q` query parameter from a fetch-mock call URL.
 * Returns the decoded object, or null if parsing fails.
 */
export const parseQueryFromUrl = (url: string): Record<string, any> | null => {
  const match = url.match(/[?&]q=(.+?)(?:&|$)/);
  if (!match) return null;
  return rison.decode(decodeURIComponent(match[1]));
};

/**
 * Get the last dashboard list API call from fetchMock history.
 * Returns both the raw call and the parsed rison query.
 */
export const getLatestDashboardApiCall = () => {
  const calls = fetchMock.callHistory.calls(/dashboard\/\?q/);
  if (calls.length === 0) return null;
  const lastCall = calls[calls.length - 1];
  return {
    call: lastCall,
    query: parseQueryFromUrl(lastCall.url),
  };
};
