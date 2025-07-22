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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import * as reactRedux from 'react-redux';
import fetchMock from 'fetch-mock';
import { VizType } from '@superset-ui/core';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { QueryParamProvider } from 'use-query-params';

import ChartList from 'src/pages/ChartList';

const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({ push: mockPush }),
}));

// Increase default timeout for all tests
jest.setTimeout(30000);

const mockCharts = [...new Array(3)].map((_, i) => ({
  changed_on: new Date().toISOString(),
  creator: 'super user',
  id: i,
  slice_name: `cool chart ${i}`,
  url: 'url',
  viz_type: VizType.Bar,
  datasource_name: `ds${i}`,
  datasource_name_text: `schema.ds${i}`,
  datasource_url: `/dataset/${i}`,
  thumbnail_url: '/thumbnail',
}));

const mockUser = {
  userId: 1,
};

const chartsInfoEndpoint = 'glob:*/api/v1/chart/_info*';
const chartsEndpoint = 'glob:*/api/v1/chart/*';

fetchMock.get(chartsInfoEndpoint, {
  permissions: ['can_read', 'can_write'],
});
fetchMock.get(chartsEndpoint, {
  result: mockCharts,
  chart_count: 3,
});

const user = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
    ],
  },
  userId: 1,
  username: 'admin',
};

const mockStore = configureStore([thunk]);
const store = mockStore({ user });
const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

const renderChartList = (props = {}) =>
  render(
    <MemoryRouter>
      <QueryParamProvider>
        <ChartList {...props} user={mockUser} />
      </QueryParamProvider>
    </MemoryRouter>,
    {
      useRedux: true,
      store,
    },
  );

describe('ChartList', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
    useSelectorMock.mockClear();
    mockPush.mockClear();
  });

  it('renders component with basic structure', async () => {
    renderChartList();

    expect(await screen.findByTestId('chart-list-view')).toBeInTheDocument();
    expect(screen.getByText('Charts')).toBeInTheDocument();
  });

  it('verify New Chart button existence and functionality', async () => {
    renderChartList();
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
    renderChartList();
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
    // Delay the API response to test loading state
    fetchMock.get(
      chartsEndpoint,
      new Promise(resolve =>
        setTimeout(() => resolve({ result: mockCharts, chart_count: 3 }), 200),
      ),
      { overwriteRoutes: true },
    );

    renderChartList();

    // Component should render immediately with loading state
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();

    // Wait for data to eventually load
    await waitFor(
      () => {
        expect(screen.getByText('cool chart 0')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('makes correct API calls on initial load', async () => {
    renderChartList();

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
      chartsInfoEndpoint,
      new Promise(resolve =>
        setTimeout(
          () => resolve({ permissions: ['can_read', 'can_write'] }),
          100,
        ),
      ),
      { overwriteRoutes: true },
    );

    fetchMock.get(
      chartsEndpoint,
      new Promise(resolve =>
        setTimeout(() => resolve({ result: mockCharts, chart_count: 3 }), 150),
      ),
      { overwriteRoutes: true },
    );

    renderChartList();

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

  it('switches between card and table view', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Find and click list view toggle
    const listViewToggle = await screen.findByRole('img', {
      name: 'unordered-list',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active
    await waitFor(() => {
      const listViewToggle = screen.getByRole('img', {
        name: 'unordered-list',
      });
      expect(listViewToggle.closest('[role="button"]')).toHaveClass('active');
    });

    // Find and click card view toggle
    const cardViewToggle = screen.getByRole('img', {
      name: 'appstore',
    });
    const cardViewButton = cardViewToggle.closest('[role="button"]');
    fireEvent.click(cardViewButton);

    // Wait for card view to be active
    await waitFor(() => {
      const cardViewToggle = screen.getByRole('img', {
        name: 'appstore',
      });
      expect(cardViewToggle.closest('[role="button"]')).toHaveClass('active');
    });
  });

  it('shows edit modal', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view
    const listViewToggle = await screen.findByRole('img', {
      name: 'unordered-list',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('cool chart 0')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = await screen.findAllByTestId('edit-alt');
    fireEvent.click(editButtons[0]);

    // Verify modal appears
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows delete modal', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view
    const listViewToggle = await screen.findByRole('img', {
      name: 'unordered-list',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('cool chart 0')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'delete',
    });
    fireEvent.click(deleteButtons[0]);

    // Verify modal appears
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows favorite stars for logged in user', async () => {
    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view
    const listViewToggle = await screen.findByRole('img', {
      name: 'unordered-list',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('cool chart 0')).toBeInTheDocument();
    });

    // Wait for favorite stars to appear
    await waitFor(() => {
      const favoriteStars = screen.getAllByRole('img', {
        name: 'starred',
      });
      expect(favoriteStars.length).toBeGreaterThan(0);
    });
  });

  it('renders an "Import Chart" tooltip under import button', async () => {
    renderChartList();

    const importButton = await screen.findByTestId('import-button');
    fireEvent.mouseEnter(importButton);

    const importTooltip = await screen.findByRole('tooltip', {
      name: 'Import charts',
    });
    expect(importTooltip).toBeInTheDocument();
  });

  it('handles dataset name display logic correctly', async () => {
    // Test different scenarios for datasource_name_text
    const testCharts = [
      {
        ...mockCharts[0],
        id: 100,
        slice_name: 'Chart with schema.name',
        datasource_name_text: 'public.users_table',
        datasource_url: '/dataset/1',
      },
      {
        ...mockCharts[1],
        id: 101,
        slice_name: 'Chart with just name',
        datasource_name_text: 'simple_table',
        datasource_url: '/dataset/2',
      },
      {
        ...mockCharts[2],
        id: 102,
        slice_name: 'Chart with undefined name',
        datasource_name_text: undefined,
        datasource_url: '/dataset/3',
      },
    ];

    // Override the charts endpoint with test data
    fetchMock.get(
      chartsEndpoint,
      {
        result: testCharts,
        chart_count: 3,
      },
      { overwriteRoutes: true },
    );

    renderChartList();

    // Wait for list to load
    await screen.findByTestId('chart-list-view');

    // Switch to list view to see the dataset column
    const listViewToggle = await screen.findByRole('img', {
      name: 'unordered-list',
    });
    const listViewButton = listViewToggle.closest('[role="button"]');
    fireEvent.click(listViewButton);

    // Wait for list view to be active and data to load
    await waitFor(() => {
      expect(screen.getByText('Chart with schema.name')).toBeInTheDocument();
    });

    // Test schema.name case - should display only the table name (after the dot)
    await waitFor(() => {
      const schemaNameLink = screen.getByText('users_table');
      expect(schemaNameLink).toBeInTheDocument();
      expect(schemaNameLink.closest('a')).toHaveAttribute('href', '/dataset/1');
    });

    // Test just name case - should display the full name
    await waitFor(() => {
      const justNameLink = screen.getByText('simple_table');
      expect(justNameLink).toBeInTheDocument();
      expect(justNameLink.closest('a')).toHaveAttribute('href', '/dataset/2');
    });

    // Test undefined case - should display empty string (no text content)
    await waitFor(() => {
      const undefinedNameRow = screen
        .getByText('Chart with undefined name')
        .closest('tr');
      const datasetCell = undefinedNameRow.querySelector('td:nth-child(4)'); // Dataset is the 4th column
      const linkElement = datasetCell.querySelector('a');
      expect(linkElement).toHaveTextContent('');
      expect(linkElement).toHaveAttribute('href', '/dataset/3');
    });
  });

  it('maintains component structure during loading', async () => {
    // Only delay data loading, not permissions
    fetchMock.get(
      chartsEndpoint,
      new Promise(resolve =>
        setTimeout(() => resolve({ result: mockCharts, chart_count: 3 }), 200),
      ),
      { overwriteRoutes: true },
    );

    renderChartList();

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
        expect(screen.getByText('cool chart 0')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('handles API errors gracefully', async () => {
    // Mock API failure
    fetchMock.get(
      chartsEndpoint,
      { throws: new Error('API Error') },
      { overwriteRoutes: true },
    );

    renderChartList();
    await screen.findByTestId('chart-list-view');

    // Should handle error gracefully and still render component
    expect(screen.getByTestId('chart-list-view')).toBeInTheDocument();
  });

  it('handles empty results', async () => {
    // Mock empty response
    fetchMock.get(
      chartsEndpoint,
      { result: [], chart_count: 0 },
      { overwriteRoutes: true },
    );

    renderChartList();
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

describe('ChartList - anonymous view', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
    // Reset favorite status for anonymous user
    fetchMock.get(
      chartsInfoEndpoint,
      new Promise(resolve =>
        setTimeout(
          () => resolve({ permissions: ['can_read', 'can_write'] }),
          100,
        ),
      ),
      { overwriteRoutes: true },
    );
    // Reset charts endpoint to original mockCharts
    fetchMock.get(
      chartsEndpoint,
      {
        result: mockCharts,
        chart_count: 3,
      },
      { overwriteRoutes: true },
    );
  });
});
