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
import { screen, waitFor } from 'spec/helpers/testing-library';
import {
  API_ENDPOINTS,
  renderChartList,
  setupMocks,
} from './ChartList.testHelpers';

jest.setTimeout(30000);

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_read', 'Chart'],
      ['can_write', 'Chart'],
    ],
  },
};

describe('ChartList - Favorite Column Visibility', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    fetchMock.resetHistory();
    fetchMock.restore();
  });

  test('hides favorite column when no charts are favorited', async () => {
    // Mock favorite status API to return all false
    fetchMock.get(
      API_ENDPOINTS.CHART_FAVORITE_STATUS,
      {
        result: [
          { id: 0, value: false },
          { id: 1, value: false },
          { id: 2, value: false },
          { id: 3, value: false },
        ],
      },
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Chart 0')).toBeInTheDocument();
    });

    // Favorite column should be hidden - check that favorite stars are not present
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);

    // Verify that other columns are still present (check table headers)
    expect(
      screen.getByRole('columnheader', { name: 'Name' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Type' }),
    ).toBeInTheDocument();
  });

  test('shows favorite column when at least one chart is favorited', async () => {
    // Mock favorite status API to return mixed favorites
    fetchMock.get(
      API_ENDPOINTS.CHART_FAVORITE_STATUS,
      {
        result: [
          { id: 0, value: true }, // This chart is favorited
          { id: 1, value: false },
          { id: 2, value: false },
          { id: 3, value: false },
        ],
      },
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Chart 0')).toBeInTheDocument();
    });

    // Favorite column should be visible - wait for stars to appear
    await waitFor(
      () => {
        const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
        expect(favoriteStars.length).toBeGreaterThan(0);
      },
      { timeout: 10000 },
    );
  });

  test('shows favorite column when all charts are favorited', async () => {
    // Mock favorite status API to return all true
    fetchMock.get(
      API_ENDPOINTS.CHART_FAVORITE_STATUS,
      {
        result: [
          { id: 0, value: true },
          { id: 1, value: true },
          { id: 2, value: true },
          { id: 3, value: true },
        ],
      },
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Chart 0')).toBeInTheDocument();
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
      API_ENDPOINTS.CHART_FAVORITE_STATUS,
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
      userId: null,
      firstName: '',
      lastName: '',
      roles: {},
    };

    renderChartList(noUser);

    await waitFor(() => {
      expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Chart 0')).toBeInTheDocument();
    });

    // Favorite column should be hidden when user is not logged in
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);
  });

  test('hides favorite column when chart list is empty', async () => {
    // Mock empty charts response
    fetchMock.get(
      API_ENDPOINTS.CHARTS,
      {
        result: [],
        chart_count: 0,
      },
      { overwriteRoutes: true },
    );

    // Mock empty favorite status
    fetchMock.get(
      API_ENDPOINTS.CHART_FAVORITE_STATUS,
      {
        result: [],
      },
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
    });

    // No favorite stars should be present when there are no charts
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);
  });

  test('handles partial favorite status loading gracefully', async () => {
    // Mock partial favorite status (fewer items than charts)
    fetchMock.get(
      API_ENDPOINTS.CHART_FAVORITE_STATUS,
      {
        result: [
          { id: 0, value: false },
          { id: 1, value: false },
          // Missing status for charts 2 and 3
        ],
      },
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Chart 0')).toBeInTheDocument();
    });

    // Should hide column when favorite status is incomplete
    const favoriteStars = screen.queryAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(0);
  });
});
