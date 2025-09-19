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
import { MemoryRouter } from 'react-router-dom';
import fetchMock from 'fetch-mock';
import { isFeatureEnabled } from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { QueryParamProvider } from 'use-query-params';

import DashboardList from 'src/pages/DashboardList';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.setTimeout(30000);

const dashboardsInfoEndpoint = 'glob:*/api/v1/dashboard/_info*';
const dashboardOwnersEndpoint = 'glob:*/api/v1/dashboard/related/owners*';
const dashboardCreatedByEndpoint =
  'glob:*/api/v1/dashboard/related/created_by*';
const dashboardFavoriteStatusEndpoint =
  'glob:*/api/v1/dashboard/favorite_status*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';

const mockDashboards = [...new Array(3)].map((_, i) => ({
  id: i,
  url: `url-${i}`,
  dashboard_title: `Dashboard ${i}`,
  changed_by_name: 'user',
  changed_by_fk: 1,
  published: true,
  changed_on_utc: new Date().toISOString(),
  changed_on_delta_humanized: '5 minutes ago',
  owners: [{ id: 1, first_name: 'admin', last_name: 'admin_user' }],
  roles: [{ id: 1, name: 'adminUser' }],
  thumbnail_url: '/thumbnail',
}));

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
};

const setupBasicMocks = () => {
  fetchMock.reset();

  fetchMock.get(dashboardsInfoEndpoint, {
    permissions: ['can_read', 'can_write'],
  });

  fetchMock.get(dashboardOwnersEndpoint, {
    result: [],
  });

  fetchMock.get(dashboardCreatedByEndpoint, {
    result: [],
  });

  fetchMock.get(dashboardsEndpoint, {
    result: mockDashboards,
    dashboard_count: 3,
  });

  global.URL.createObjectURL = jest.fn();
  fetchMock.get('/thumbnail', { body: new Blob(), sendAsJson: false });
};

describe('DashboardList - Favorite Column Visibility', () => {
  const renderDashboardList = (props = {}, userProp = mockUser) =>
    render(
      <MemoryRouter>
        <QueryParamProvider>
          <DashboardList {...props} user={userProp} />
        </QueryParamProvider>
      </MemoryRouter>,
      { useRedux: true },
    );

  beforeEach(() => {
    setupBasicMocks();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(feature => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW');
  });

  afterEach(() => {
    fetchMock.resetHistory();
    fetchMock.restore();
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  });

  test('hides favorite column when no dashboards are favorited', async () => {
    // Mock favorite status API to return all false
    fetchMock.get(
      dashboardFavoriteStatusEndpoint,
      {
        result: [
          { id: 0, value: false },
          { id: 1, value: false },
          { id: 2, value: false },
        ],
      },
      { overwriteRoutes: true },
    );

    renderDashboardList();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Dashboard 0')).toBeInTheDocument();
    });

    // Favorite column should be hidden - check that favorite stars are not present
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);

    // Verify that other columns are still present
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  test('shows favorite column when at least one dashboard is favorited', async () => {
    // Mock favorite status API to return mixed favorites
    fetchMock.get(
      dashboardFavoriteStatusEndpoint,
      {
        result: [
          { id: 0, value: true }, // This dashboard is favorited
          { id: 1, value: false },
          { id: 2, value: false },
        ],
      },
      { overwriteRoutes: true },
    );

    renderDashboardList();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Dashboard 0')).toBeInTheDocument();
    });

    // Favorite column should be visible - check that favorite stars are present
    await waitFor(
      () => {
        const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
        expect(favoriteStars.length).toBeGreaterThan(0);
      },
      { timeout: 10000 },
    );
  });

  test('shows favorite column when all dashboards are favorited', async () => {
    // Mock favorite status API to return all true
    fetchMock.get(
      dashboardFavoriteStatusEndpoint,
      {
        result: [
          { id: 0, value: true },
          { id: 1, value: true },
          { id: 2, value: true },
        ],
      },
      { overwriteRoutes: true },
    );

    renderDashboardList();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Dashboard 0')).toBeInTheDocument();
    });

    // Favorite column should be visible
    await waitFor(
      () => {
        const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
        expect(favoriteStars.length).toBeGreaterThan(0);
      },
      { timeout: 10000 },
    );
  });

  test('hides favorite column when user is not logged in', async () => {
    // Mock favorite status API
    fetchMock.get(
      dashboardFavoriteStatusEndpoint,
      {
        result: [
          { id: 0, value: true },
          { id: 1, value: false },
        ],
      },
      { overwriteRoutes: true },
    );

    // Render without userId (user not logged in)
    const noUser = {
      userId: 0, // Use 0 instead of null to satisfy type requirements
      firstName: '',
      lastName: '',
    };

    renderDashboardList({}, noUser);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Dashboard 0')).toBeInTheDocument();
    });

    // Favorite column should be hidden when user is not logged in
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);
  });

  test('hides favorite column when dashboard list is empty', async () => {
    // Mock empty dashboards response
    fetchMock.get(
      dashboardsEndpoint,
      {
        result: [],
        dashboard_count: 0,
      },
      { overwriteRoutes: true },
    );

    // Mock empty favorite status
    fetchMock.get(
      dashboardFavoriteStatusEndpoint,
      {
        result: [],
      },
      { overwriteRoutes: true },
    );

    renderDashboardList();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
    });

    // No favorite stars should be present when there are no dashboards
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);
  });

  test('handles partial favorite status loading gracefully', async () => {
    // Mock partial favorite status (fewer items than dashboards)
    fetchMock.get(
      dashboardFavoriteStatusEndpoint,
      {
        result: [
          { id: 0, value: false },
          // Missing status for dashboards 1 and 2
        ],
      },
      { overwriteRoutes: true },
    );

    renderDashboardList();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Dashboard 0')).toBeInTheDocument();
    });

    // Should hide column when favorite status is incomplete
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);
  });
});
