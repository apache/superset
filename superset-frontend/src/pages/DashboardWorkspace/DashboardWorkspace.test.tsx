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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { createMemoryHistory } from 'history';
import { MemoryRouter, Router } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { SupersetApiError } from '@superset-ui/core';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { RoutePaths } from 'src/views/routePaths';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import DashboardWorkspaceComponent from 'src/pages/DashboardWorkspace';
import DashboardListRoute from 'src/pages/DashboardWorkspace/DashboardListRoute';
import {
  getLatestDashboardApiCall,
  mockAdminUser,
  mockDashboards,
  setupMocks,
} from 'src/pages/DashboardList/DashboardList.testHelpers';
import { useIsMobile } from 'src/hooks/useIsMobile';
import { DASHBOARD_WORKSPACE_LIST_COLUMNS } from './constants';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';

jest.mock('re-resizable', () => ({
  Resizable: ({ children }: { children: React.ReactNode }) => (
    <div data-test="mock-resizable">{children}</div>
  ),
}));

jest.mock('./sidebarPrefs', () => {
  const actual = jest.requireActual('./sidebarPrefs');
  return {
    ...actual,
    loadSidebarPrefs: jest.fn(() =>
      Promise.resolve({ source: 'server', prefs: actual.defaultSidebarPrefs() }),
    ),
    saveSidebarPrefs: jest.fn(() => Promise.resolve(true)),
  };
});

const mockUseIsMobileHook = useIsMobile as jest.MockedFunction<
  typeof useIsMobile
>;

jest.setTimeout(30000);

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('src/dashboard/containers/DashboardPage', () => ({
  DashboardPage: ({ idOrSlug }: { idOrSlug: string }) => (
    <div data-test="mock-dashboard-page">Dashboard {idOrSlug}</div>
  ),
}));

jest.mock('src/pages/DashboardList', () => ({
  __esModule: true,
  default: () => <div data-test="mock-classic-dashboard-list">Classic list</div>,
}));

jest.mock('src/hooks/useIsMobile', () => ({
  ...jest.requireActual('src/hooks/useIsMobile'),
  useIsMobile: jest.fn(() => false),
}));

const mockUseDashboard = jest.fn();
jest.mock('src/hooks/apiResources/dashboards', () => ({
  ...jest.requireActual('src/hooks/apiResources/dashboards'),
  useDashboard: (idOrSlug: string | number) => mockUseDashboard(idOrSlug),
}));

const DashboardWorkspace = DashboardWorkspaceComponent as unknown as React.FC<
  Record<string, unknown>
>;

const mockUser = mockAdminUser as unknown as UserWithPermissionsAndRoles;

const listPath: string = RoutePaths.DASHBOARD_LIST;

function renderWorkspace(
  initialPath: string = listPath,
  history = createMemoryHistory({
    initialEntries: [initialPath] as [string, ...string[]],
  }),
) {
  const store = configureStore({
    reducer: {
      user: () => mockUser,
      messageToasts: () => [],
    },
  });

  return {
    history,
    ...render(
      <Provider store={store}>
        <Router history={history}>
          <QueryParamProvider adapter={ReactRouter5Adapter}>
            <DashboardWorkspace user={mockUser} />
          </QueryParamProvider>
        </Router>
      </Provider>,
    ),
  };
}

function renderListRoute(initialPath: string = listPath) {
  const store = configureStore({
    reducer: {
      user: () => mockUser,
      messageToasts: () => [],
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath] as [string, ...string[]]}>
        <QueryParamProvider adapter={ReactRouter5Adapter}>
          <DashboardListRoute user={mockUser} />
        </QueryParamProvider>
      </MemoryRouter>
    </Provider>,
  );
}

beforeAll(() => {
  setupMocks();
});

beforeEach(() => {
  mockUseIsMobileHook.mockReturnValue(false);
  setItem(LocalStorageKeys.DashboardWorkspaceSidebarPrefs, {});
  mockUseDashboard.mockImplementation((idOrSlug: string | number) => ({
    result: {
      id: Number(idOrSlug) || 1,
      dashboard_title: 'Preview',
    },
    error: null,
    status: ResourceStatus.Complete,
  }));
});

test('defaults preview to the first dashboard from the list API', async () => {
  renderWorkspace();
  await waitFor(() => {
    expect(screen.getByTestId('mock-dashboard-page')).toHaveTextContent(
      'Dashboard 1',
    );
  });
});

test('clicking a dashboard card updates the preview pane', async () => {
  renderWorkspace();
  await waitFor(() => {
    expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('Analytics Dashboard'));
  await waitFor(() => {
    expect(screen.getByTestId('mock-dashboard-page')).toHaveTextContent(
      'Dashboard 2',
    );
  });
});

test('deep-link ?id= selects the matching dashboard', async () => {
  renderWorkspace(`${listPath}?id=3`);
  await waitFor(() => {
    expect(screen.getByTestId('mock-dashboard-page')).toHaveTextContent(
      'Dashboard 3',
    );
  });
});

test('deep-link ?id= loads pane even when dashboard is not in the first list page', async () => {
  renderWorkspace(`${listPath}?id=999`);
  await waitFor(() => {
    expect(screen.getByTestId('mock-dashboard-page')).toHaveTextContent(
      'Dashboard 999',
    );
  });
});

test('browser back restores the previous preview selection', async () => {
  const { history } = renderWorkspace();
  await waitFor(() => {
    expect(screen.getByTestId('mock-dashboard-page')).toHaveTextContent(
      'Dashboard 1',
    );
  });
  fireEvent.click(screen.getByText('Analytics Dashboard'));
  await waitFor(() => {
    expect(screen.getByTestId('mock-dashboard-page')).toHaveTextContent(
      'Dashboard 2',
    );
  });
  history.go(-1);
  await waitFor(() => {
    expect(screen.getByTestId('mock-dashboard-page')).toHaveTextContent(
      'Dashboard 1',
    );
  });
});

test('mobile layout hides the preview pane', async () => {
  mockUseIsMobileHook.mockReturnValue(true);
  renderWorkspace();
  await screen.findByText('Sales Dashboard');
  expect(
    screen.queryByTestId('dashboard-workspace-preview'),
  ).not.toBeInTheDocument();
});

test('?view=table renders the classic dashboard list (rollback)', async () => {
  renderListRoute(`${listPath}?view=table`);
  expect(await screen.findByTestId('mock-classic-dashboard-list')).toBeInTheDocument();
});

test('uses the same dashboard list API and columns as CRUD list (permission scoped server-side)', async () => {
  renderWorkspace();
  await screen.findByText('Sales Dashboard');
  const apiCall = getLatestDashboardApiCall();
  expect(apiCall?.call.url).toMatch(/\/api\/v1\/dashboard\/\?q=/);
  expect(apiCall?.query?.select_columns).toEqual(
    DASHBOARD_WORKSPACE_LIST_COLUMNS,
  );
  const sidebar = screen.getByTestId('dashboard-workspace-sidebar');
  mockDashboards.forEach(dashboard => {
    expect(
      within(sidebar).getByText(dashboard.dashboard_title),
    ).toBeInTheDocument();
  });
});

test('workspace cards hide export actions in the kebab menu', async () => {
  renderWorkspace();
  await screen.findByText('Sales Dashboard');
  expect(
    screen.queryByTestId('dashboard-card-option-export-button'),
  ).not.toBeInTheDocument();
});

test('shows access error in pane without crashing when dashboard GET returns 403', async () => {
  mockUseDashboard.mockReturnValue({
    result: undefined,
    error: new SupersetApiError({ status: 403, message: 'Forbidden' }),
    status: ResourceStatus.Error,
  });
  renderWorkspace(`${listPath}?id=1`);
  await waitFor(() => {
    expect(
      screen.getByText('You do not have access to this dashboard'),
    ).toBeInTheDocument();
  });
  expect(screen.getByTestId('dashboard-workspace')).toBeInTheDocument();
});

test('desktop sidebar exposes reorder handles and layout controls', async () => {
  renderWorkspace();
  await screen.findByText('Sales Dashboard');
  expect(
    screen.getAllByTestId('dashboard-workspace-drag-handle').length,
  ).toBeGreaterThan(0);
  expect(
    screen.getByTestId('dashboard-workspace-sidebar-collapse'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('dashboard-workspace-sidebar-reset-width'),
  ).toBeInTheDocument();
});

test('mobile sidebar hides drag handles', async () => {
  mockUseIsMobileHook.mockReturnValue(true);
  renderWorkspace();
  await screen.findByText('Sales Dashboard');
  expect(
    screen.queryByTestId('dashboard-workspace-drag-handle'),
  ).not.toBeInTheDocument();
});
