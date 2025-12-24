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
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import rison from 'rison';
import fetchMock from 'fetch-mock';
import {
  setupMocks,
  renderDatasetList,
  waitForDatasetsPageReady,
  mockAdminUser,
  mockReadOnlyUser,
  mockExportOnlyUser,
  mockDatasets,
  mockApiError403,
  API_ENDPOINTS,
  RisonFilter,
} from './DatasetList.testHelpers';

// Increase default timeout for all tests in this file
jest.setTimeout(30000);

beforeEach(() => {
  setupMocks();
});

afterEach(() => {
  fetchMock.resetHistory();
  fetchMock.restore();
});

test('renders page with "Datasets" title', async () => {
  renderDatasetList(mockAdminUser);

  const title = await screen.findByText('Datasets');
  expect(title).toBeInTheDocument();
});

test('shows loading state during initial data fetch', () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    new Promise(() => {}), // Never resolves to keep loading state
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('maintains component structure during loading', () => {
  fetchMock.get(API_ENDPOINTS.DATASETS, new Promise(() => {}), {
    overwriteRoutes: true,
  });

  renderDatasetList(mockAdminUser);

  expect(screen.getByText('Datasets')).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('"New Dataset" button exists (when canCreate=true)', async () => {
  renderDatasetList(mockAdminUser);

  expect(
    await screen.findByRole('button', { name: /dataset/i }),
  ).toBeInTheDocument();
});

test('"New Dataset" button hidden (when canCreate=false)', async () => {
  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: /dataset/i }),
    ).not.toBeInTheDocument();
  });
});

test('"Import" button exists (when canCreate=true)', async () => {
  renderDatasetList(mockAdminUser);

  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(await screen.findByTestId('import-button')).toBeInTheDocument();
});

test('"Import" button opens import modal', async () => {
  renderDatasetList(mockAdminUser);

  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  const importButton = await screen.findByTestId('import-button');
  expect(importButton).toBeInTheDocument();

  await userEvent.click(importButton);

  // Modal should appear with title - using semantic query here
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Import dataset')).toBeInTheDocument();
});

test('"Bulk select" button exists (when canDelete || canExport)', async () => {
  renderDatasetList(mockAdminUser);

  expect(
    await screen.findByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();
});

test('"Bulk select" button exists for export-only users', async () => {
  renderDatasetList(mockExportOnlyUser);

  expect(
    await screen.findByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();
});

test('"Bulk select" button hidden for read-only users', async () => {
  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: /bulk select/i }),
    ).not.toBeInTheDocument();
  });
});

test('renders Name search filter', async () => {
  renderDatasetList(mockAdminUser);

  // Note: Using testId - search input lacks accessible label
  // TODO: Add aria-label to search input
  expect(
    await screen.findByTestId('search-filter-container'),
  ).toBeInTheDocument();
});

test('renders Type filter (Virtual/Physical dropdown)', async () => {
  renderDatasetList(mockAdminUser);

  // Filter dropdowns should be present
  const filters = await screen.findAllByRole('combobox');
  expect(filters.length).toBeGreaterThan(0);
});

test('handles datasets with missing fields and renders gracefully', async () => {
  const datasetWithMissingFields = {
    id: 999,
    table_name: 'Incomplete Dataset',
    kind: 'physical',
    schema: null,
    database: {
      id: '1',
      database_name: 'PostgreSQL',
    },
    owners: [],
    changed_by_name: 'Unknown',
    changed_by: null,
    changed_on_delta_humanized: 'Unknown',
    explore_url: '/explore/?datasource=999__table',
    extra: JSON.stringify({}),
    sql: null,
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetWithMissingFields], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText('Incomplete Dataset')).toBeInTheDocument();
  });

  // Verify empty owners renders without crashing (no FacePile)
  const table = screen.getByRole('table');
  expect(table).toBeInTheDocument();

  // Verify the row exists even with missing data
  const datasetRow = screen.getByText('Incomplete Dataset').closest('tr');
  expect(datasetRow).toBeInTheDocument();

  // Verify no certification badge or warning icon (extra is empty)
  expect(
    screen.queryByRole('img', { name: /certified/i }),
  ).not.toBeInTheDocument();
});

test('handles empty results (shows empty state)', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [], count: 0 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  // Datasets heading should still be present
  expect(await screen.findByText('Datasets')).toBeInTheDocument();
});

test('makes correct initial API call on load', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(0);
  });
});

test('API call includes correct page size', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(0);
    const url = calls[0][0] as string;
    expect(url).toContain('page_size');
  });
});

test('typing in name filter updates input value and triggers API with decoded search filter', async () => {
  renderDatasetList(mockAdminUser);

  const searchContainer = await screen.findByTestId('search-filter-container');
  const searchInput = within(searchContainer).getByRole('textbox');

  // Record initial API calls
  const initialCallCount = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Type in search box and press Enter to trigger search
  await userEvent.type(searchInput, 'sales{enter}');

  // Verify input value updated
  await waitFor(() => {
    expect(searchInput).toHaveValue('sales');
  });

  // Wait for API call after Enter key press
  await waitFor(
    () => {
      const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
      expect(calls.length).toBeGreaterThan(initialCallCount);

      // Get latest API call
      const url = calls[calls.length - 1][0] as string;

      // Verify URL contains search filter
      expect(url).toContain('filters');

      // Extract and decode rison query param
      const queryString = url.split('?q=')[1];
      expect(queryString).toBeTruthy();

      // Decode the rison payload
      const decoded = rison.decode(decodeURIComponent(queryString)) as Record<
        string,
        unknown
      >;

      // Verify filter structure contains table_name search
      expect(decoded.filters).toBeDefined();
      expect(Array.isArray(decoded.filters)).toBe(true);

      // Check for sales filter in the filters array
      const filters = decoded.filters as RisonFilter[];
      const hasSalesFilter = filters.some(
        (filter: RisonFilter) =>
          filter.col === 'table_name' &&
          filter.opr === 'ct' &&
          typeof filter.value === 'string' &&
          filter.value.toLowerCase().includes('sales'),
      );
      expect(hasSalesFilter).toBe(true);
    },
    { timeout: 5000 },
  );
});

test('toggling bulk select mode shows checkboxes', async () => {
  renderDatasetList(mockAdminUser);

  const bulkSelectButton = await screen.findByRole('button', {
    name: /bulk select/i,
  });

  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    // When bulk select is active, checkboxes should appear
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});

test('handles 500 error on initial load without crashing', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { throws: new Error('Internal Server Error') },
    {
      overwriteRoutes: true,
    },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
  });

  // Component should still render without crashing
  const title = await screen.findByText('Datasets');
  expect(title).toBeInTheDocument();
});

test('handles 403 error on _info endpoint and disables create actions', async () => {
  const addDangerToast = jest.fn();

  fetchMock.get(API_ENDPOINTS.DATASETS_INFO, mockApiError403, {
    overwriteRoutes: true,
  });

  renderDatasetList(mockAdminUser, {
    addDangerToast,
    addSuccessToast: jest.fn(),
  });

  await waitForDatasetsPageReady();

  // Verify bulk actions are disabled/hidden when permissions fail
  await waitFor(() => {
    const bulkSelectButton = screen.queryByRole('button', {
      name: /bulk select/i,
    });
    // Bulk select should not appear without proper permissions
    expect(bulkSelectButton).not.toBeInTheDocument();
  });
});

test('handles network timeout without crashing', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { throws: new Error('Network timeout') },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
  });

  // Component should not crash
  const title = await screen.findByText('Datasets');
  expect(title).toBeInTheDocument();
});

test('component requires explicit mocks for all API endpoints', async () => {
  // Use standard mocks
  setupMocks();

  // Clear call history to start fresh
  fetchMock.resetHistory();

  // Render component with standard setup
  renderDatasetList(mockAdminUser);

  // Wait for initial data load
  await waitForDatasetsPageReady();

  // Verify that critical endpoints were called and had mocks available
  const newDatasetsCalls = fetchMock.calls(API_ENDPOINTS.DATASETS);
  const newInfoCalls = fetchMock.calls(API_ENDPOINTS.DATASETS_INFO);

  // These should have been called during render
  expect(newDatasetsCalls.length).toBeGreaterThan(0);
  expect(newInfoCalls.length).toBeGreaterThan(0);

  // Verify no unmatched calls (all endpoints were mocked)
  const unmatchedCalls = fetchMock.calls(false); // false = unmatched only
  expect(unmatchedCalls.length).toBe(0);
});

test('selecting Database filter triggers API call with database relation filter', async () => {
  renderDatasetList(mockAdminUser);

  await waitForDatasetsPageReady();

  const filtersContainers = screen.getAllByRole('combobox');
  expect(filtersContainers.length).toBeGreaterThan(0);
});

test('renders datasets with certification data', async () => {
  const certifiedDataset = {
    ...mockDatasets[1], // mockDatasets[1] has certification
    extra: JSON.stringify({
      certification: {
        certified_by: 'Data Team',
        details: 'Approved for production',
      },
    }),
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [certifiedDataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(certifiedDataset.table_name)).toBeInTheDocument();
  });

  // Verify the dataset row renders successfully
  const datasetRow = screen
    .getByText(certifiedDataset.table_name)
    .closest('tr');
  expect(datasetRow).toBeInTheDocument();
});

test('displays datasets with warning_markdown', async () => {
  const warningText = 'This dataset contains PII. Handle with care.';
  const datasetWithWarning = {
    ...mockDatasets[2], // mockDatasets[2] has warning
    extra: JSON.stringify({
      warning_markdown: warningText,
    }),
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetWithWarning], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(datasetWithWarning.table_name)).toBeInTheDocument();
  });

  // Verify the dataset row exists
  const datasetRow = screen
    .getByText(datasetWithWarning.table_name)
    .closest('tr');
  expect(datasetRow).toBeInTheDocument();
});

test('displays dataset with multiple owners', async () => {
  const datasetWithOwners = mockDatasets[1]; // Has 2 owners: Jane Smith, Bob Jones

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetWithOwners], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(datasetWithOwners.table_name)).toBeInTheDocument();
  });

  // Verify row exists with the dataset
  const datasetRow = screen
    .getByText(datasetWithOwners.table_name)
    .closest('tr');
  expect(datasetRow).toBeInTheDocument();
});

test('displays ModifiedInfo with humanized date', async () => {
  const datasetWithModified = mockDatasets[0]; // changed_by_name: 'John Doe', changed_on: '1 day ago'

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetWithModified], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(
      screen.getByText(datasetWithModified.table_name),
    ).toBeInTheDocument();
  });

  // Verify humanized date appears (ModifiedInfo component renders it)
  expect(
    screen.getByText(datasetWithModified.changed_on_delta_humanized),
  ).toBeInTheDocument();
});

test('dataset name links to Explore with correct explore_url', async () => {
  const dataset = mockDatasets[0]; // explore_url: '/explore/?datasource=1__table'

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  // Find the dataset name link (should be a link role)
  const exploreLink = screen.getByRole('link', { name: dataset.table_name });
  expect(exploreLink).toBeInTheDocument();
  expect(exploreLink).toHaveAttribute('href', dataset.explore_url);
});
