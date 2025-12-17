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
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { ComponentType } from 'react';
import {
  setupMocks,
  renderDatasetList,
  waitForDatasetsPageReady,
  mockAdminUser,
  mockDatasets,
  setupDeleteMocks,
  mockRelatedCharts,
  mockRelatedDashboards,
  mockHandleResourceExport,
  API_ENDPOINTS,
} from './DatasetList.testHelpers';

jest.mock('src/utils/export');

// Mock withToasts HOC to be a passthrough so we can spy on toast calls
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: <P extends object>(Component: ComponentType<P>) => Component,
}));

// Increase default timeout for all tests in this file
jest.setTimeout(30000);

beforeEach(() => {
  setupMocks();
  jest.clearAllMocks();
});

afterEach(() => {
  fetchMock.resetHistory();
  fetchMock.restore();
  jest.restoreAllMocks();
});

test('typing in search updates the input value correctly', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('search-filter-container')).toBeInTheDocument();
  });

  const searchContainer = screen.getByTestId('search-filter-container');
  const searchInput = within(searchContainer).getByRole('textbox');

  // Type search query
  await userEvent.type(searchInput, 'sales');

  // Verify input value is updated
  await waitFor(() => {
    expect(searchInput).toHaveValue('sales');
  });
});

test('typing in search triggers debounced API call with search filter', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('search-filter-container')).toBeInTheDocument();
  });

  const searchContainer = screen.getByTestId('search-filter-container');
  const searchInput = within(searchContainer).getByRole('textbox');

  // Record initial API calls
  const initialCallCount = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Type search query and submit with Enter to trigger the debounced fetch
  await userEvent.type(searchInput, 'sales{enter}');

  // Wait for debounced API call
  await waitFor(
    () => {
      const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
      expect(calls.length).toBeGreaterThan(initialCallCount);
    },
    { timeout: 5000 },
  );

  // Verify the latest API call includes search filter in URL
  const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
  const latestCall = calls[calls.length - 1];
  const url = latestCall[0] as string;

  // URL should contain filters parameter with search term
  expect(url).toContain('filters');
  const risonPayload = url.split('?q=')[1];
  expect(risonPayload).toBeTruthy();
  const decoded = rison.decode(decodeURIComponent(risonPayload!)) as Record<
    string,
    unknown
  >;
  const filters = Array.isArray(decoded?.filters) ? decoded.filters : [];
  const hasSalesFilter = filters.some(
    (filter: Record<string, unknown>) =>
      typeof filter?.value === 'string' &&
      filter.value.toLowerCase().includes('sales'),
  );
  expect(hasSalesFilter).toBe(true);
});

test('500 error triggers danger toast with error message', async () => {
  const addDangerToast = jest.fn();

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    {
      status: 500,
      body: { message: 'Internal Server Error' },
    },
    { overwriteRoutes: true },
  );

  // Pass toast spy directly via props to bypass withToasts HOC
  renderDatasetList(mockAdminUser, {
    addDangerToast,
    addSuccessToast: jest.fn(),
  });

  // Verify component renders despite error
  await waitForDatasetsPageReady();

  // Verify danger toast called with error information
  await waitFor(
    () => {
      expect(addDangerToast).toHaveBeenCalled();
    },
    { timeout: 5000 },
  );

  // Verify toast message contains error keywords
  expect(addDangerToast.mock.calls.length).toBeGreaterThan(0);
  const toastMessage = String(addDangerToast.mock.calls[0][0]);
  expect(
    toastMessage.includes('error') ||
      toastMessage.includes('Error') ||
      toastMessage.includes('500') ||
      toastMessage.includes('Internal Server'),
  ).toBe(true);
});

test('network timeout triggers danger toast', async () => {
  const addDangerToast = jest.fn();

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { throws: new Error('Network timeout') },
    { overwriteRoutes: true },
  );

  // Pass toast spy directly via props to bypass withToasts HOC
  renderDatasetList(mockAdminUser, {
    addDangerToast,
    addSuccessToast: jest.fn(),
  });

  // Verify component renders despite error
  await waitForDatasetsPageReady();

  // Verify danger toast called with timeout message
  await waitFor(
    () => {
      expect(addDangerToast).toHaveBeenCalled();
    },
    { timeout: 5000 },
  );

  // Verify toast message contains timeout/network keywords
  expect(addDangerToast.mock.calls.length).toBeGreaterThan(0);
  const toastMessage = String(addDangerToast.mock.calls[0][0]);
  expect(
    toastMessage.includes('timeout') ||
      toastMessage.includes('Timeout') ||
      toastMessage.includes('network') ||
      toastMessage.includes('Network') ||
      toastMessage.includes('error'),
  ).toBe(true);
});

test('clicking delete opens modal with related objects count', async () => {
  const datasetToDelete = mockDatasets[0];

  // Set up delete mocks
  setupDeleteMocks(datasetToDelete.id);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetToDelete], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  // Wait for dataset to render
  await waitFor(() => {
    expect(screen.getByText(datasetToDelete.table_name)).toBeInTheDocument();
  });

  // Find and click delete button in the row
  const table = screen.getByTestId('listview-table');
  const datasetRow = within(table)
    .getAllByRole('row')
    .find(row => within(row).queryByText(datasetToDelete.table_name));
  expect(datasetRow).toBeTruthy();
  await userEvent.hover(datasetRow!);
  const deleteButton = within(datasetRow!).getByTestId('delete');

  await userEvent.click(deleteButton);

  // Verify modal opens with related objects
  const modal = await screen.findByRole('dialog');
  expect(modal).toBeInTheDocument();

  // Check for related charts count
  expect(modal).toHaveTextContent(
    new RegExp(mockRelatedCharts.count.toString()),
  );
  // Check for related dashboards count
  expect(modal).toHaveTextContent(
    new RegExp(mockRelatedDashboards.count.toString()),
  );
});

test('clicking export calls handleResourceExport with dataset ID', async () => {
  const datasetToExport = mockDatasets[0];

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetToExport], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(datasetToExport.table_name)).toBeInTheDocument();
  });

  // Find and click export button
  const table = screen.getByTestId('listview-table');
  const exportButton = await within(table).findByTestId('upload');

  await userEvent.click(exportButton);

  // Verify export was called with correct ID
  await waitFor(() => {
    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'dataset',
      [datasetToExport.id],
      expect.any(Function),
    );
  });
});

test('clicking duplicate opens modal and submits duplicate request', async () => {
  const datasetToDuplicate = {
    ...mockDatasets[1],
    kind: 'virtual',
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetToDuplicate], count: 1 },
    { overwriteRoutes: true },
  );

  fetchMock.post(
    API_ENDPOINTS.DATASET_DUPLICATE,
    { id: 999, table_name: 'Copy of Dataset' },
    { overwriteRoutes: true },
  );

  const addSuccessToast = jest.fn();

  renderDatasetList(mockAdminUser, {
    addDangerToast: jest.fn(),
    addSuccessToast,
  });

  await waitFor(() => {
    expect(screen.getByText(datasetToDuplicate.table_name)).toBeInTheDocument();
  });

  // Track initial dataset list API calls BEFORE duplicate action
  const initialDatasetCallCount = fetchMock.calls(
    API_ENDPOINTS.DATASETS,
  ).length;

  const row = screen.getByText(datasetToDuplicate.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  const duplicateIcon = await within(row!).findByTestId('copy');
  const duplicateButton = duplicateIcon.closest(
    '[role="button"]',
  ) as HTMLElement | null;
  expect(duplicateButton).toBeTruthy();

  await userEvent.click(duplicateButton!);

  const modal = await screen.findByRole('dialog');
  const modalInput = within(modal).getByRole('textbox');
  await userEvent.clear(modalInput);
  await userEvent.type(modalInput, 'Copy of Dataset');

  const confirmButton = within(modal).getByRole('button', {
    name: /duplicate/i,
  });
  await userEvent.click(confirmButton);

  // Verify duplicate API was called with correct payload
  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASET_DUPLICATE);
    expect(calls.length).toBeGreaterThan(0);

    // Verify POST body contains correct dataset info
    const requestBody = JSON.parse(calls[0][1]?.body as string);
    expect(requestBody.base_model_id).toBe(datasetToDuplicate.id);
    expect(requestBody.table_name).toBe('Copy of Dataset');
  });

  // Verify modal closes after successful duplicate
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Verify refreshData() is called (observable via new dataset list API call)
  await waitFor(
    () => {
      const datasetCalls = fetchMock.calls(API_ENDPOINTS.DATASETS);
      expect(datasetCalls.length).toBeGreaterThan(initialDatasetCallCount);
    },
    { timeout: 3000 },
  );

  // Note: Success toast feature not implemented (see index.tsx:718-721)
  expect(addSuccessToast).not.toHaveBeenCalled();
});

test('certified dataset shows badge and tooltip with certification details', async () => {
  const certifiedDataset = {
    ...mockDatasets[1],
    extra: JSON.stringify({
      certification: {
        certified_by: 'Data Team',
        details: 'Approved for production use',
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

  // Verify the row renders with the dataset
  const row = screen.getByText(certifiedDataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Find certification badge within the row (fail-fast if not found)
  const certBadge = await within(row!).findByRole('img', {
    name: /certified/i,
  });
  expect(certBadge).toBeInTheDocument();

  // Hover to reveal tooltip
  await userEvent.hover(certBadge);

  // Wait for tooltip content to appear
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent(/Data Team/i);
  expect(tooltip).toHaveTextContent(/Approved for production/i);
});

test('dataset with warning shows icon and tooltip with markdown content', async () => {
  const warningMessage = 'This dataset contains PII. Handle with care.';
  const datasetWithWarning = {
    ...mockDatasets[2],
    extra: JSON.stringify({
      warning_markdown: warningMessage,
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

  // Verify row exists
  const row = screen.getByText(datasetWithWarning.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Find warning icon within the row (fail-fast if not found)
  const warningIcon = await within(row!).findByRole('img', {
    name: /warning/i,
  });
  expect(warningIcon).toBeInTheDocument();

  // Hover to reveal tooltip with markdown content
  await userEvent.hover(warningIcon);

  // Wait for tooltip to appear with warning text
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent(/PII/i);
  expect(tooltip).toHaveTextContent(/Handle with care/i);
});

test('dataset name links to Explore with correct URL and accessible label', async () => {
  const dataset = mockDatasets[0];

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  // Find the dataset row and scope the link query to it
  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Find the internal link within the dataset row (fail-fast if not found)
  const exploreLink = within(row!).getByTestId('internal-link');
  expect(exploreLink).toBeInTheDocument();

  // Verify link has correct href to Explore page
  expect(exploreLink).toHaveAttribute('href', dataset.explore_url);
  expect(exploreLink).toHaveAttribute(
    'href',
    expect.stringContaining('/explore/'),
  );

  // Verify link contains dataset ID
  expect(exploreLink).toHaveAttribute(
    'href',
    expect.stringContaining(`${dataset.id}__table`),
  );
});

// Note: Component "+1" tests for state persistence through operations have been
// moved to DatasetList.listview.test.tsx where they can use the reliable selectOption helper.
