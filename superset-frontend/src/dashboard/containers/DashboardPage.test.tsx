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
import {
  createStore,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import { SupersetApiError, SupersetClient } from '@superset-ui/core';
import CrudThemeProvider from 'src/components/CrudThemeProvider';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import {
  clearDashboardHistory,
  UPDATE_COMPONENTS,
} from 'src/dashboard/actions/dashboardLayout';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import { getUrlParam } from 'src/utils/urlUtils';
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
  editors: [],
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

jest.mock('src/dashboard/actions/dashboardLayout', () => ({
  ...jest.requireActual('src/dashboard/actions/dashboardLayout'),
  clearDashboardHistory: jest.fn(() => ({ type: 'MOCK_CLEAR_HISTORY' })),
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
  getUrlParam: jest.fn().mockReturnValue(null),
}));

const mockGetUrlParam = getUrlParam as jest.Mock;

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
  // Tests assert against the global document.title and the unmount restore
  // effect can carry title state across tests, so reset it for isolation.
  document.title = '';
  // clearAllMocks does not reset mockImplementation — reset explicitly so
  // per-test overrides don't leak into subsequent tests.
  mockGetUrlParam.mockReset();
  mockGetUrlParam.mockReturnValue(null);
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

test('document.title tracks the live Redux dashboard title after a rename, not the stale API value', async () => {
  // Renaming a dashboard updates the live title in Redux
  // (dashboardLayout HEADER meta.text) and persists via an in-SPA save with
  // no full reload, so the useDashboard() API result stays stale. The browser
  // tab title must follow the live title, otherwise a newly created dashboard
  // keeps showing "[ untitled dashboard ]" after being renamed and saved.
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
        dashboardLayout: {
          past: [],
          future: [],
          present: {
            [DASHBOARD_HEADER_ID]: {
              id: DASHBOARD_HEADER_ID,
              type: 'HEADER',
              meta: { text: 'Live Renamed Title' },
            },
          },
        },
        nativeFilters: { filters: {} },
        dataMask: {},
      },
    },
  );

  await waitFor(() => {
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });

  // API result (mockDashboard.dashboard_title) is 'Test Dashboard', but the
  // live title is 'Live Renamed Title' — the tab title must reflect the latter.
  await waitFor(() => {
    expect(document.title).toBe('Live Renamed Title');
  });
});

test('document.title updates when the dashboard is renamed after mount', async () => {
  // The bug is a live rename: the title is edited in Redux after the page has
  // already mounted, so the tab title must react to the change rather than only
  // reflecting the title present at initial render.
  const store = createStore(
    {
      dashboardInfo: { id: 1, metadata: {} },
      dashboardState: { sliceIds: [] },
      dashboardLayout: {
        past: [],
        future: [],
        present: {
          [DASHBOARD_HEADER_ID]: {
            id: DASHBOARD_HEADER_ID,
            type: 'HEADER',
            meta: { text: 'Title At Mount' },
          },
        },
      },
      nativeFilters: { filters: {} },
      dataMask: {},
    },
    reducerIndex,
  );

  render(
    <Suspense fallback="loading">
      <DashboardPage idOrSlug="1" />
    </Suspense>,
    { store, useRouter: true },
  );

  await waitFor(() => expect(document.title).toBe('Title At Mount'));

  // Simulate the in-SPA rename mutating the live header title.
  store.dispatch({
    type: UPDATE_COMPONENTS,
    payload: {
      nextComponents: {
        [DASHBOARD_HEADER_ID]: {
          id: DASHBOARD_HEADER_ID,
          type: 'HEADER',
          meta: { text: 'Renamed After Mount' },
        },
      },
    },
  });

  await waitFor(() => expect(document.title).toBe('Renamed After Mount'));
});

test('document.title uses the fresh API title during dashboard-to-dashboard navigation', async () => {
  // While switching dashboards in the SPA the component instance and Redux store
  // are reused, so the previous dashboard's layout (header title) lingers until
  // the new dashboard hydrates. The tab title must follow the newly loaded
  // dashboard's API title, not the stale live layout title.
  mockUseDashboard.mockReturnValue({
    result: { ...mockDashboard, id: 2, dashboard_title: 'Dashboard Two' },
    error: null,
  });

  render(
    <Suspense fallback="loading">
      <DashboardPage idOrSlug="2" />
    </Suspense>,
    {
      useRedux: true,
      useRouter: true,
      initialState: {
        // dashboardInfo still describes the previously hydrated dashboard 1.
        dashboardInfo: { id: 1, metadata: {} },
        dashboardState: { sliceIds: [] },
        dashboardLayout: {
          past: [],
          future: [],
          present: {
            [DASHBOARD_HEADER_ID]: {
              id: DASHBOARD_HEADER_ID,
              type: 'HEADER',
              meta: { text: 'Dashboard One' },
            },
          },
        },
        nativeFilters: { filters: {} },
        dataMask: {},
      },
    },
  );

  await waitFor(() => {
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });

  await waitFor(() => expect(document.title).toBe('Dashboard Two'));
});

test('document.title falls back to the API dashboard_title before the layout is hydrated', async () => {
  // Before hydration there is no HEADER component in the layout, so the tab
  // title should still come from the dashboard API response.
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

  await waitFor(() => {
    expect(document.title).toBe('Test Dashboard');
  });
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

test('copies currentState to filterState for legacy native_filters URL params', async () => {
  // Pre-2021 URLs encode filter selections under `currentState`. The dataMask
  // reducer uses `filterState`, so without normalization the filter panel shows
  // no active selections even though extraFormData still filters chart queries.
  mockGetUrlParam.mockImplementation((param: { name: string }) => {
    if (param.name === 'native_filters') {
      return {
        'NATIVE_FILTER-OvPTDNKc9': {
          extraFormData: {
            filters: [{ col: 'team_name', op: 'IN', val: ['MarginEdge'] }],
          },
          currentState: { value: ['MarginEdge'] },
        },
      };
    }
    return null;
  });

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

  expect(hydrateDashboard).toHaveBeenCalledWith(
    expect.objectContaining({
      dataMask: expect.objectContaining({
        'NATIVE_FILTER-OvPTDNKc9': expect.objectContaining({
          filterState: { value: ['MarginEdge'] },
          extraFormData: {
            filters: [{ col: 'team_name', op: 'IN', val: ['MarginEdge'] }],
          },
          currentState: { value: ['MarginEdge'] },
        }),
      }),
    }),
  );
});

test('does not overwrite filterState when modern native_filters URL format is used', async () => {
  // Modern URLs already carry `filterState`; the normalization must not clobber it.
  mockGetUrlParam.mockImplementation((param: { name: string }) => {
    if (param.name === 'native_filters') {
      return {
        'NATIVE_FILTER-OvPTDNKc9': {
          extraFormData: {
            filters: [{ col: 'team_name', op: 'IN', val: ['MarginEdge'] }],
          },
          filterState: { value: ['MarginEdge'] },
        },
      };
    }
    return null;
  });

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

  expect(hydrateDashboard).toHaveBeenCalledWith(
    expect.objectContaining({
      dataMask: expect.objectContaining({
        'NATIVE_FILTER-OvPTDNKc9': expect.objectContaining({
          filterState: { value: ['MarginEdge'] },
          extraFormData: {
            filters: [{ col: 'team_name', op: 'IN', val: ['MarginEdge'] }],
          },
        }),
      }),
    }),
  );

  // currentState must not have been injected
  const callArg = (hydrateDashboard as jest.Mock).mock.calls[0][0];
  expect(
    callArg.dataMask['NATIVE_FILTER-OvPTDNKc9'].currentState,
  ).toBeUndefined();
});

test('renders a not-found state instead of throwing when the dashboard 404s', async () => {
  mockUseDashboard.mockReturnValue({
    result: null,
    error: new SupersetApiError({ status: 404, message: 'Not found' }),
  });
  mockUseDashboardCharts.mockReturnValue({
    result: null,
    error: new SupersetApiError({ status: 404, message: 'Not found' }),
  });
  mockUseDashboardDatasets.mockReturnValue({
    result: null,
    error: new SupersetApiError({ status: 404, message: 'Not found' }),
    status: 'error',
  });

  render(
    <Suspense fallback="loading">
      <DashboardPage idOrSlug="404" />
    </Suspense>,
    {
      useRedux: true,
      useRouter: true,
      initialState: {
        dashboardInfo: {},
        dashboardState: { sliceIds: [] },
        nativeFilters: { filters: {} },
        dataMask: {},
      },
    },
  );

  expect(
    await screen.findByText('This dashboard does not exist'),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('dashboard-builder')).not.toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: 'See all dashboards' }),
  );
  expect(window.location.pathname).toBe('/dashboard/list/');
});

test('clears undo history after hydrating the dashboard', async () => {
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

  expect(hydrateDashboard).toHaveBeenCalled();
  expect(clearDashboardHistory).toHaveBeenCalled();
  const hydrateOrder = (hydrateDashboard as jest.Mock).mock
    .invocationCallOrder[0];
  const clearOrder = (clearDashboardHistory as jest.Mock).mock
    .invocationCallOrder[0];
  expect(clearOrder).toBeGreaterThan(hydrateOrder);
});
