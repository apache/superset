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
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import type { Middleware } from 'redux';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { isFeatureEnabled } from '@superset-ui/core';
import DashboardListComponent from 'src/pages/DashboardList';
import {
  API_ENDPOINTS,
  mockDashboards,
  setupMocks,
} from './DashboardList.testHelpers';

// Cast to accept partial mock props in tests
const DashboardList = DashboardListComponent as unknown as React.FC<
  Record<string, any>
>;

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Permission configurations
const PERMISSIONS = {
  ADMIN: [
    ['can_write', 'Dashboard'],
    ['can_export', 'Dashboard'],
    ['can_read', 'Tag'],
  ],
  READ_ONLY: [],
  EXPORT_ONLY: [['can_export', 'Dashboard']],
  WRITE_ONLY: [['can_write', 'Dashboard']],
};

const createMockUser = (overrides = {}) => ({
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_write', 'Dashboard'],
      ['can_export', 'Dashboard'],
    ],
  },
  ...overrides,
});

const createMockStore = (initialState: any = {}) =>
  configureStore({
    reducer: {
      user: (state = initialState.user || {}, action: any) => state,
      common: (state = initialState.common || {}, action: any) => state,
      dashboards: (state = initialState.dashboards || {}, action: any) => state,
    },
    preloadedState: initialState,
    middleware: (getDefaultMiddleware: (options?: unknown) => Middleware[]) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });

const createStoreStateWithPermissions = (
  permissions = PERMISSIONS.ADMIN,
  userId: number | undefined = 1,
) => ({
  user: userId
    ? {
        ...createMockUser({ userId }),
        roles: { TestRole: permissions },
      }
    : {},
  common: {
    conf: {
      SUPERSET_WEBSERVER_TIMEOUT: 60000,
    },
  },
  dashboards: {
    dashboardList: mockDashboards,
  },
});

const renderDashboardListWithPermissions = (
  props = {},
  storeState = {},
  user = createMockUser(),
) => {
  const storeStateWithUser = {
    ...createStoreStateWithPermissions(),
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

const renderWithPermissions = async (
  permissions = PERMISSIONS.ADMIN,
  userId: number | undefined = 1,
  featureFlags: { tagging?: boolean; cardView?: boolean } = {},
) => {
  (
    isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
  ).mockImplementation((feature: string) => {
    if (feature === 'TAGGING_SYSTEM') return featureFlags.tagging === true;
    if (feature === 'LISTVIEWS_DEFAULT_CARD_VIEW')
      return featureFlags.cardView === true;
    return false;
  });

  // Convert role permissions to API permissions
  setupMocks({
    [API_ENDPOINTS.DASHBOARDS_INFO]: permissions.map(perm => perm[0]),
  });

  const storeState = createStoreStateWithPermissions(permissions, userId);

  const userProps = userId
    ? {
        user: {
          ...createMockUser({ userId }),
          roles: { TestRole: permissions },
        },
      }
    : { user: { userId: undefined } };

  const result = renderDashboardListWithPermissions(userProps, storeState);
  await waitFor(() => {
    expect(screen.getByTestId('dashboard-list-view')).toBeInTheDocument();
  });
  return result;
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardList - Permission-based UI Tests', () => {
  beforeEach(() => {
    fetchMock.clearHistory().removeRoutes();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  });

  test('shows all UI elements for admin users with full permissions', async () => {
    await renderWithPermissions(PERMISSIONS.ADMIN);

    await screen.findByTestId('dashboard-list-view');

    // Verify admin controls are visible
    expect(
      screen.getByRole('button', { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('import-button')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-select')).toBeInTheDocument();

    // Verify Actions column is visible
    expect(screen.getByTitle('Actions')).toBeInTheDocument();

    // Verify favorite stars are rendered
    const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(mockDashboards.length);
  });

  test('renders basic UI for anonymous users without permissions', async () => {
    await renderWithPermissions(PERMISSIONS.READ_ONLY, undefined);
    await screen.findByTestId('dashboard-list-view');

    // Verify basic structure renders
    expect(screen.getByTestId('dashboard-list-view')).toBeInTheDocument();
    expect(screen.getByText('Dashboards')).toBeInTheDocument();

    // Verify view toggles are available (not permission-gated)
    expect(screen.getByRole('img', { name: 'appstore' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'unordered-list' }),
    ).toBeInTheDocument();

    // Verify permission-gated elements are hidden
    expect(
      screen.queryByRole('button', { name: /dashboard/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
  });

  test('shows Actions column for users with admin permissions', async () => {
    await renderWithPermissions(PERMISSIONS.ADMIN);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.getByTitle('Actions')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });
  });

  test('hides Actions column for users with read-only permissions', async () => {
    await renderWithPermissions(PERMISSIONS.READ_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.queryByTitle('Actions')).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText('more')).toHaveLength(0);
  });

  test('shows Actions column for users with export-only permissions', async () => {
    // DashboardList shows Actions column when canExport is true
    await renderWithPermissions(PERMISSIONS.EXPORT_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.getByTitle('Actions')).toBeInTheDocument();
  });

  test('shows Actions column for users with write-only permissions', async () => {
    await renderWithPermissions(PERMISSIONS.WRITE_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.getByTitle('Actions')).toBeInTheDocument();
  });

  test('shows Tags column when TAGGING_SYSTEM feature flag is enabled', async () => {
    await renderWithPermissions(PERMISSIONS.ADMIN, 1, { tagging: true });
    await screen.findByTestId('dashboard-list-view');

    expect(screen.getByTitle('Tags')).toBeInTheDocument();
  });

  test('hides Tags column when TAGGING_SYSTEM feature flag is disabled', async () => {
    await renderWithPermissions(PERMISSIONS.ADMIN, 1, { tagging: false });
    await screen.findByTestId('dashboard-list-view');

    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  test('shows bulk select button for users with admin permissions', async () => {
    await renderWithPermissions(PERMISSIONS.ADMIN);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.getByTestId('bulk-select')).toBeInTheDocument();
  });

  test('shows bulk select button for users with export-only permissions', async () => {
    await renderWithPermissions(PERMISSIONS.EXPORT_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.getByTestId('bulk-select')).toBeInTheDocument();
  });

  test('shows bulk select button for users with write-only permissions', async () => {
    await renderWithPermissions(PERMISSIONS.WRITE_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.getByTestId('bulk-select')).toBeInTheDocument();
  });

  test('hides bulk select button for users with read-only permissions', async () => {
    await renderWithPermissions(PERMISSIONS.READ_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.queryByTestId('bulk-select')).not.toBeInTheDocument();
  });

  test('shows Create and Import buttons for users with write permissions', async () => {
    await renderWithPermissions(PERMISSIONS.WRITE_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(
      screen.getByRole('button', { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('import-button')).toBeInTheDocument();
  });

  test('hides Create and Import buttons for users with read-only permissions', async () => {
    await renderWithPermissions(PERMISSIONS.READ_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(
      screen.queryByRole('button', { name: /dashboard/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
  });

  test('hides Create and Import buttons for users with export-only permissions', async () => {
    await renderWithPermissions(PERMISSIONS.EXPORT_ONLY);
    await screen.findByTestId('dashboard-list-view');

    expect(
      screen.queryByRole('button', { name: /dashboard/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
  });

  test('renders favorite stars even for anonymous user', async () => {
    // Current behavior: Component renders favorites regardless of userId
    // (matches ChartList behavior — antd hidden column + Cell guard
    // do not prevent rendering in JSDOM)
    await renderWithPermissions(PERMISSIONS.READ_ONLY, undefined);
    await screen.findByTestId('dashboard-list-view');

    const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(mockDashboards.length);
  });
});
