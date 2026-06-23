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
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import { SupersetClient } from '@superset-ui/core';
import CrudThemeProvider from 'src/components/CrudThemeProvider';
import DashboardPage from './DashboardPage';

const mockTheme = {
  id: 42,
  theme_name: 'Branded',
  json_data: '{"token":{"colorPrimary":"#1677ff"}}',
};

const mockDashboard = {
  id: 1,
  slug: null,
  url: '/superset/dashboard/1/',
  dashboard_title: 'Test Dashboard',
  thumbnail_url: null,
  published: true,
  css: null,
  json_metadata: '{}',
  position_json: '{}',
  changed_by_name: 'admin',
  changed_by: { id: 1, first_name: 'Admin', last_name: 'User' },
  changed_on: '2024-01-01T00:00:00',
  charts: [],
  owners: [],
  roles: [],
  theme: mockTheme,
};

jest.mock('src/hooks/apiResources', () => ({
  useDashboard: jest.fn(),
  useDashboardCharts: jest.fn(),
  useDashboardDatasets: jest.fn(),
}));

jest.mock('src/dashboard/actions/hydrate', () => ({
  ...jest.requireActual('src/dashboard/actions/hydrate'),
  hydrateDashboard: jest.fn(() => ({ type: 'MOCK_HYDRATE' })),
}));

jest.mock('src/dashboard/actions/datasources', () => ({
  ...jest.requireActual('src/dashboard/actions/datasources'),
  setDatasources: jest.fn(() => ({ type: 'MOCK_SET_DATASOURCES' })),
}));

jest.mock('src/dashboard/actions/dashboardState', () => ({
  ...jest.requireActual('src/dashboard/actions/dashboardState'),
  setDatasetsStatus: jest.fn(() => ({ type: 'MOCK_SET_DATASETS_STATUS' })),
}));

jest.mock('src/components/CrudThemeProvider', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  )),
}));

jest.mock('src/dashboard/components/DashboardBuilder/DashboardBuilder', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-builder">DashboardBuilder</div>,
}));

jest.mock('src/dashboard/components/SyncDashboardState', () => ({
  __esModule: true,
  default: () => null,
  getDashboardContextLocalStorage: () => ({}),
}));

jest.mock('src/dashboard/containers/Dashboard', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: jest.fn(), addSuccessToast: jest.fn() }),
}));

jest.mock('src/dashboard/util/injectCustomCss', () => ({
  __esModule: true,
  default: () => () => {},
}));

jest.mock('src/dashboard/util/activeAllDashboardFilters', () => ({
  getAllActiveFilters: () => ({}),
  getRelevantDataMask: () => ({}),
}));

jest.mock('src/dashboard/util/activeDashboardFilters', () => ({
  getActiveFilters: () => ({}),
}));

jest.mock('src/utils/urlUtils', () => ({
  getUrlParam: () => null,
}));

jest.mock('src/dashboard/components/nativeFilters/FilterBar/keyValue', () => ({
  getFilterValue: jest.fn(),
  getPermalinkValue: jest.fn(),
}));

jest.mock('src/dashboard/contexts/AutoRefreshContext', () => ({
  AutoRefreshProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

const mockUseDashboard = useDashboard as jest.Mock;
const mockUseDashboardCharts = useDashboardCharts as jest.Mock;
const mockUseDashboardDatasets = useDashboardDatasets as jest.Mock;
const MockCrudThemeProvider = CrudThemeProvider as unknown as jest.Mock;

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboard.mockReturnValue({
    result: mockDashboard,
    error: null,
  });
  mockUseDashboardCharts.mockReturnValue({
    result: [],
    error: null,
  });
  mockUseDashboardDatasets.mockReturnValue({
    result: [],
    error: null,
    status: 'complete',
  });
});

test('passes full theme object from dashboard API response to CrudThemeProvider', async () => {
  const clientGetSpy = jest.spyOn(SupersetClient, 'get');

  render(
    <Suspense fallback="loading">
      <DashboardPage idOrSlug="1" />
    </Suspense>,
    {
      useRedux: true,
      useRouter: true,
      initialState: {
        dashboardInfo: { id: 1, metadata: {} },
        dashboardState: { sliceIds: [] },
        nativeFilters: { filters: {} },
        dataMask: {},
      },
    },
  );

  await waitFor(() => {
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });

  expect(MockCrudThemeProvider).toHaveBeenCalledWith(
    expect.objectContaining({ theme: mockTheme }),
    expect.anything(),
  );

  // Regression guard: theme data comes from the dashboard API response,
  // not a separate /api/v1/theme/:id fetch (which would 403 for non-admin users)
  const themeCalls = clientGetSpy.mock.calls.filter(([{ endpoint }]) =>
    endpoint?.startsWith('/api/v1/theme/'),
  );
  expect(themeCalls).toHaveLength(0);
});

test('uses theme from Redux dashboardInfo when it differs from API response (Properties modal update)', async () => {
  const reduxTheme = {
    id: 99,
    theme_name: 'Updated Theme',
    json_data: '{"token":{"colorPrimary":"#ff0000"}}',
  };

  render(
    <Suspense fallback="loading">
      <DashboardPage idOrSlug="1" />
    </Suspense>,
    {
      useRedux: true,
      useRouter: true,
      initialState: {
        dashboardInfo: { id: 1, metadata: {}, theme: reduxTheme },
        dashboardState: { sliceIds: [] },
        nativeFilters: { filters: {} },
        dataMask: {},
      },
    },
  );

  await waitFor(() => {
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });

  // Redux theme should take priority over API response theme
  expect(MockCrudThemeProvider).toHaveBeenCalledWith(
    expect.objectContaining({ theme: reduxTheme }),
    expect.anything(),
  );
});

test('passes null theme when Redux dashboardInfo.theme is explicitly null (theme removed)', async () => {
  render(
    <Suspense fallback="loading">
      <DashboardPage idOrSlug="1" />
    </Suspense>,
    {
      useRedux: true,
      useRouter: true,
      initialState: {
        dashboardInfo: { id: 1, metadata: {}, theme: null },
        dashboardState: { sliceIds: [] },
        nativeFilters: { filters: {} },
        dataMask: {},
      },
    },
  );

  await waitFor(() => {
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });

  // When theme is explicitly null in Redux (removed via Properties modal),
  // CrudThemeProvider should receive null
  expect(MockCrudThemeProvider).toHaveBeenCalledWith(
    expect.objectContaining({ theme: null }),
    expect.anything(),
  );
});
