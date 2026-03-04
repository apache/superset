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
import { screen, waitFor, fireEvent } from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  API_ENDPOINTS,
  mockCharts,
  renderChartList,
  setupMocks,
} from './ChartList.testHelpers';

const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({ push: mockPush }),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// Increase default timeout for all tests
jest.setTimeout(30000);

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
      ['can_export', 'Chart'],
    ],
  },
};

// Filter utilities
const findFilterByLabel = (labelText: string) => {
  const containers = screen.getAllByTestId('select-filter-container');
  for (const container of containers) {
    const label = container.querySelector('label');
    if (label?.textContent === labelText) {
      return container.querySelector('[role="combobox"], .ant-select');
    }
  }
  return null;
};

describe('ChartList', () => {
  beforeEach(() => {
    setupMocks();
    mockPush.mockClear();
  });

  afterEach(() => {
    fetchMock.resetHistory();
    fetchMock.restore();
    // Reset feature flag mock
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  });

  it('renders component with basic structure', async () => {
    renderChartList(mockUser);

    expect(await screen.findByTestId('chart-list-view')).toBeInTheDocument();
    expect(screen.getByText('Charts')).toBeInTheDocument();
  });

  it('verify New Chart button existence and functionality', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Verify New Chart button exists
    const newChartButton = screen.getByRole('button', { name: /chart/i });
    expect(newChartButton).toBeInTheDocument();
    expect(screen.getByTestId('plus')).toBeInTheDocument();

    // Click the New Chart button
    fireEvent.click(newChartButton);

    // Verify it triggers navigation to chart creation
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/chart/add');
    });
  });

  it('verify Import button existence and functionality', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Verify Import button exists
    const importButton = screen.getByTestId('import-button');
    expect(importButton).toBeInTheDocument();

    // Click the Import button
    fireEvent.click(importButton);

    // Verify import modal opens
    await waitFor(() => {
      const importModal = screen.getByRole('dialog');
      expect(importModal).toBeInTheDocument();
      expect(importModal).toHaveTextContent(/import/i);
    });
  });

  it('shows loading state during initial data fetch', async () => {
    // Delay the chart data response to test loading state
    fetchMock.get(
      API_ENDPOINTS.CHARTS,
      new Promise(resolve =>
        setTimeout(() => resolve({ result: mockCharts, chart_count: 3 }), 200),
      ),
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    // Component should render immediately with loading state
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Wait for data to eventually load
    await waitFor(
      () => {
        expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('makes correct API calls on initial load', async () => {
    renderChartList(mockUser);

    await waitFor(() => {
      const infoCalls = fetchMock.calls(/chart\/_info/);
      const dataCalls = fetchMock.calls(/chart\/\?q/);

      expect(infoCalls).toHaveLength(1);
      expect(dataCalls).toHaveLength(1);
      expect(dataCalls[0][0]).toContain(
        'order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25',
      );
    });
  });

  it('shows loading state while API calls are in progress', async () => {
    // Mock delayed API responses
    fetchMock.get(
      API_ENDPOINTS.CHARTS_INFO,
      new Promise(resolve =>
        setTimeout(
          () => resolve({ permissions: ['can_read', 'can_write'] }),
          100,
        ),
      ),
      { overwriteRoutes: true },
    );

    fetchMock.get(
      API_ENDPOINTS.CHARTS,
      new Promise(resolve =>
        setTimeout(() => resolve({ result: mockCharts, chart_count: 3 }), 150),
      ),
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    // Main container should render immediately
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Eventually data should load
    await waitFor(
      () => {
        const infoCalls = fetchMock.calls(/chart\/_info/);
        const dataCalls = fetchMock.calls(/chart\/\?q/);

        expect(infoCalls).toHaveLength(1);
        expect(dataCalls).toHaveLength(1);
      },
      { timeout: 1000 },
    );
  });

  it('maintains component structure during loading', async () => {
    // Only delay data loading, not permissions
    fetchMock.get(
      API_ENDPOINTS.CHARTS,
      new Promise(resolve =>
        setTimeout(() => resolve({ result: mockCharts, chart_count: 3 }), 200),
      ),
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);

    // Core structure should be available immediately
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
    expect(screen.getByText('Charts')).toBeInTheDocument();

    // View toggles should be available during loading
    expect(screen.getByRole('img', { name: 'appstore' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'unordered-list' }),
    ).toBeInTheDocument();

    // Wait for permissions to load, then action buttons should appear
    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: 'Bulk select' }),
        ).toBeInTheDocument();
      },
      { timeout: 500 },
    );

    // Wait for data to eventually load
    await waitFor(
      () => {
        expect(screen.getByText(mockCharts[0].slice_name)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('handles API errors gracefully', async () => {
    // Mock API failure
    fetchMock.get(
      API_ENDPOINTS.CHARTS_INFO,
      { throws: new Error('API Error') },
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Should handle error gracefully and still render component
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
  });

  it('handles empty results', async () => {
    // Mock empty chart data (not permissions)
    fetchMock.get(
      API_ENDPOINTS.CHARTS,
      { result: [], chart_count: 0 },
      { overwriteRoutes: true },
    );

    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    // Should render component even with no data
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Global controls should still be functional with no data
    expect(screen.getByRole('img', { name: 'appstore' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'unordered-list' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Bulk select' }),
    ).toBeInTheDocument();
  });
});

describe('ChartList - Global Filter Interactions', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    fetchMock.resetHistory();
    fetchMock.restore();
    // Reset feature flag mock
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockReset();
  });

  it('renders search filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    // Verify search filter renders correctly
    expect(screen.getByTestId('filters-search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type a value/i)).toBeInTheDocument();
  });

  it('renders Type filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const typeFilter = findFilterByLabel('Type');
    expect(typeFilter).toBeVisible();
    expect(typeFilter).toBeEnabled();
  });

  it('renders Dataset filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const datasetFilter = findFilterByLabel('Dataset');
    expect(datasetFilter).toBeVisible();
    expect(datasetFilter).toBeEnabled();
  });

  it('renders Owner filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const ownerFilter = findFilterByLabel('Owner');
    expect(ownerFilter).toBeVisible();
    expect(ownerFilter).toBeEnabled();
  });

  it('renders Certified filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });
    const certifiedFilter = findFilterByLabel('Certified');
    expect(certifiedFilter).toBeVisible();
    expect(certifiedFilter).toBeEnabled();
  });

  it('renders Favorite filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const favoriteFilter = findFilterByLabel('Favorite');
    expect(favoriteFilter).toBeVisible();
    expect(favoriteFilter).toBeEnabled();
  });

  it('renders Dashboard filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const dashboardFilter = findFilterByLabel('Dashboard');
    expect(dashboardFilter).toBeVisible();
    expect(dashboardFilter).toBeEnabled();
  });

  it('renders Modified by filter correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    const modifiedByFilter = findFilterByLabel('Modified by');
    expect(modifiedByFilter).toBeVisible();
    expect(modifiedByFilter).toBeEnabled();
  });

  it('renders Tags filter when TAGGING_SYSTEM is enabled', async () => {
    // Mock feature flag to enable tags
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) =>
        feature === 'TAGGING_SYSTEM' ||
        feature !== 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );

    // Render with tag permissions
    const userWithTagPerms = {
      ...mockUser,
      roles: {
        Admin: [
          ['can_sqllab', 'Superset'],
          ['can_write', 'Dashboard'],
          ['can_write', 'Chart'],
          ['can_read', 'Tag'],
          ['can_write', 'Tag'],
        ],
      },
    };
    renderChartList(userWithTagPerms);

    const tagsFilter = findFilterByLabel('Tag');
    expect(tagsFilter).toBeVisible();
    expect(tagsFilter).toBeEnabled();
  });

  it('does not render Tags filter when TAGGING_SYSTEM is disabled', async () => {
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) =>
        feature !== 'LISTVIEWS_DEFAULT_CARD_VIEW' &&
        feature !== 'TAGGING_SYSTEM',
    );

    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');
    await screen.findByTestId('listview-table');

    // Check that Tag filter is not present in filter containers
    const containers = screen.getAllByTestId('select-filter-container');
    const filterLabels = containers
      .map(container => {
        const label = container.querySelector('label');
        return label?.textContent;
      })
      .filter(Boolean);
    expect(filterLabels).not.toContain('Tag');
  });

  it('allows filters to be reset correctly', async () => {
    renderChartList(mockUser);
    await screen.findByTestId('chart-list-view');

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    // Apply search filter
    const searchInput = screen.getByTestId('filters-search');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    // Verify filter UI is reset
    expect((searchInput as HTMLInputElement).value).toBe('');
  });
});
