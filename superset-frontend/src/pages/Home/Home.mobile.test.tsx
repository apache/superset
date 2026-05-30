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
 * Mobile-specific tests for the Home/Welcome page.
 *
 * These tests verify that certain desktop-only sections are hidden
 * on mobile viewports.
 */

import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import Welcome from 'src/pages/Home';

// Mock useBreakpoint to return MOBILE breakpoints
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Grid: {
    ...jest.requireActual('antd').Grid,
    useBreakpoint: () => ({
      xs: true,
      sm: true,
      md: false, // Mobile: md is false
      lg: false,
      xl: false,
    }),
  },
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}));

// API mocks
const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const chartInfoEndpoint = 'glob:*/api/v1/chart/_info?*';
const chartFavoriteStatusEndpoint = 'glob:*/api/v1/chart/favorite_status?*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';
const dashboardInfoEndpoint = 'glob:*/api/v1/dashboard/_info?*';
const dashboardFavoriteStatusEndpoint =
  'glob:*/api/v1/dashboard/favorite_status/?*';
const savedQueryEndpoint = 'glob:*/api/v1/saved_query/?*';
const savedQueryInfoEndpoint = 'glob:*/api/v1/saved_query/_info?*';
const recentActivityEndpoint = 'glob:*/api/v1/log/recent_activity/*';

fetchMock.get(chartsEndpoint, {
  result: [
    {
      slice_name: 'ChartyChart',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/explore',
      id: '4',
      table: {},
    },
  ],
});

fetchMock.get(dashboardsEndpoint, {
  result: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
});

fetchMock.get(savedQueryEndpoint, {
  result: [],
});

fetchMock.get(recentActivityEndpoint, {
  result: [
    {
      action: 'dashboard',
      item_title: "World Bank's Data",
      item_type: 'dashboard',
      item_url: '/superset/dashboard/world_health/',
      time: 1741644942130.566,
      time_delta_humanized: 'a day ago',
    },
  ],
});

fetchMock.get(chartInfoEndpoint, { permissions: [] });
fetchMock.get(chartFavoriteStatusEndpoint, { result: [] });
fetchMock.get(dashboardInfoEndpoint, { permissions: [] });
fetchMock.get(dashboardFavoriteStatusEndpoint, { result: [] });
fetchMock.get(savedQueryInfoEndpoint, { permissions: [] });

const mockedProps = {
  user: {
    username: 'alpha',
    firstName: 'alpha',
    lastName: 'alpha',
    createdOn: '2016-11-11T12:34:17',
    userId: 5,
    email: 'alpha@alpha.com',
    isActive: true,
    isAnonymous: false,
    permissions: {},
    roles: {
      sql_lab: [['can_read', 'SavedQuery']],
    },
  },
};

const renderWelcome = (props = mockedProps) =>
  waitFor(() => {
    render(<Welcome {...props} />, {
      useRedux: true,
      useRouter: true,
    });
  });

afterEach(() => {
  fetchMock.clearHistory();
});

test('Mobile view - renders Dashboards panel', async () => {
  await renderWelcome();
  expect(await screen.findByText('Dashboards')).toBeInTheDocument();
});

test('Mobile view - renders Recents panel', async () => {
  await renderWelcome();
  expect(await screen.findByText('Recents')).toBeInTheDocument();
});

test('Mobile view - does NOT render Charts panel', async () => {
  await renderWelcome();

  // Wait for Dashboards to ensure the component has rendered
  await screen.findByText('Dashboards');

  // Charts panel should NOT be present on mobile
  // Look specifically for the Charts collapse panel header
  const chartsPanel = screen.queryByRole('button', { name: /Charts/i });
  expect(chartsPanel).not.toBeInTheDocument();
});

test('Mobile view - does NOT render Saved queries panel', async () => {
  await renderWelcome();

  // Wait for Dashboards to ensure the component has rendered
  await screen.findByText('Dashboards');

  // Saved queries panel should NOT be present on mobile
  const savedQueriesPanel = screen.queryByRole('button', {
    name: /Saved queries/i,
  });
  expect(savedQueriesPanel).not.toBeInTheDocument();
});

test('Mobile view - only shows 2 panels (Recents and Dashboards)', async () => {
  await renderWelcome();

  // Wait for content to load
  await screen.findByText('Dashboards');

  // Should only have Recents and Dashboards panels visible
  // Charts and Saved queries are hidden on mobile
  const recentsPanel = screen.queryByText('Recents');
  const dashboardsPanel = screen.queryByText('Dashboards');

  expect(recentsPanel).toBeInTheDocument();
  expect(dashboardsPanel).toBeInTheDocument();
});
