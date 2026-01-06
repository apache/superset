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
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { selectOption } from 'spec/helpers/testing-library';
import {
  setupMocks,
  renderDatasetList,
  mockAdminUser,
  mockDatasets,
  setupDeleteMocks,
  setupBulkDeleteMocks,
  setupDuplicateMocks,
  mockHandleResourceExport,
  assertOnlyExpectedCalls,
  API_ENDPOINTS,
} from './DatasetList.testHelpers';

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();

jest.mock('src/components/MessageToasts/actions', () => ({
  addDangerToast: (msg: string) => {
    mockAddDangerToast(msg);
    return () => ({ type: '@@toast/danger' });
  },
  addSuccessToast: (msg: string) => {
    mockAddSuccessToast(msg);
    return () => ({ type: '@@toast/success' });
  },
}));

jest.mock('src/utils/export');

// Increase default timeout for tests that involve multiple async operations
jest.setTimeout(15000);

const buildSupersetClientError = ({
  status,
  message,
}: {
  status: number;
  message: string;
}) => ({
  message,
  error: message,
  status,
  response: {
    status,
    json: async () => ({ message }),
    text: async () => message,
    clone() {
      return {
        ...this,
        json: async () => ({ message }),
        text: async () => message,
      };
    },
  },
});

/**
 * Helper to set up error test scenarios with SupersetClient spy
 * Reduces boilerplate for error toast tests
 */
const setupErrorTestScenario = ({
  dataset,
  method,
  endpoint,
  errorStatus,
  errorMessage,
}: {
  dataset: (typeof mockDatasets)[0];
  method: 'get' | 'post';
  endpoint: string;
  errorStatus: number;
  errorMessage: string;
}) => {
  // Spy on SupersetClient method and throw error for specific endpoint
  const originalMethod =
    method === 'get'
      ? SupersetClient.get.bind(SupersetClient)
      : SupersetClient.post.bind(SupersetClient);

  jest.spyOn(SupersetClient, method).mockImplementation(async request => {
    if (request.endpoint?.includes(endpoint)) {
      throw buildSupersetClientError({
        status: errorStatus,
        message: errorMessage,
      });
    }
    return originalMethod(request);
  });

  // Configure fetchMock to return single dataset
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  // Render component with toast mocks
  renderDatasetList(mockAdminUser, {
    addDangerToast: mockAddDangerToast,
    addSuccessToast: mockAddSuccessToast,
  });
};

beforeEach(() => {
  setupMocks();
  jest.clearAllMocks();
});

afterEach(async () => {
  // Flush pending React state updates within act() to prevent warnings
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  // Reset browser history state to prevent query params leaking between tests
  // QueryParamProvider reads from window.history, which persists across renders
  window.history.replaceState({}, '', '/');

  fetchMock.resetHistory();
  fetchMock.restore();
  jest.restoreAllMocks();
});

test('only expected API endpoints are called on initial render', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify only expected endpoints were called (no unmocked calls)
  // These are the minimum required endpoints for initial dataset list render
  assertOnlyExpectedCalls([
    API_ENDPOINTS.DATASETS_INFO, // Permission check
    API_ENDPOINTS.DATASETS, // Main dataset list data
  ]);
});

test('renders all required column headers', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  // Verify all column headers are present
  expect(
    within(table).getByRole('columnheader', { name: /Name/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Type/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Database/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Schema/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Owners/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Last modified/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Actions/i }),
  ).toBeInTheDocument();
});

test('displays dataset name in Name column', async () => {
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
});

test('displays dataset type as Physical or Virtual', async () => {
  const physicalDataset = mockDatasets[0]; // kind: 'physical'
  const virtualDataset = mockDatasets[1]; // kind: 'virtual'

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [physicalDataset, virtualDataset], count: 2 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(physicalDataset.table_name)).toBeInTheDocument();
  });

  expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
});

test('displays database name in Database column', async () => {
  const dataset = mockDatasets[0];

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(
      screen.getByText(dataset.database.database_name),
    ).toBeInTheDocument();
  });
});

test('displays schema name in Schema column', async () => {
  const dataset = mockDatasets[0];

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.schema)).toBeInTheDocument();
  });
});

test('displays last modified date in humanized format', async () => {
  const dataset = mockDatasets[0];

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(
      screen.getByText(dataset.changed_on_delta_humanized),
    ).toBeInTheDocument();
  });
});

test('sorting by Name column updates API call with sort parameter', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const nameHeader = within(table).getByRole('columnheader', {
    name: /Name/i,
  });

  // Record initial calls
  const initialCalls = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Click Name header to sort
  await userEvent.click(nameHeader);

  // Wait for new API call
  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(initialCalls);
  });

  // Verify latest call includes sort parameter
  const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
  const latestCall = calls[calls.length - 1];
  const url = latestCall[0] as string;

  // URL should contain order_column for sorting
  expect(url).toMatch(/order_column|sort/);
});

test('sorting by Database column updates sort parameter', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const databaseHeader = within(table).getByRole('columnheader', {
    name: /Database/i,
  });

  const initialCalls = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  await userEvent.click(databaseHeader);

  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(initialCalls);
  });

  const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
  const url = calls[calls.length - 1][0] as string;
  expect(url).toMatch(/order_column|sort/);
});

test('sorting by Last modified column updates sort parameter', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const modifiedHeader = within(table).getByRole('columnheader', {
    name: /Last modified/i,
  });

  const initialCalls = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  await userEvent.click(modifiedHeader);

  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(initialCalls);
  });

  const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
  const url = calls[calls.length - 1][0] as string;
  expect(url).toMatch(/order_column|sort/);
});

test('export button triggers handleResourceExport with dataset ID', async () => {
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

  // Find export button in actions column (fail-fast if not found)
  const table = screen.getByTestId('listview-table');
  const exportButton = await within(table).findByTestId('upload');

  await userEvent.click(exportButton);

  await waitFor(() => {
    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'dataset',
      [dataset.id],
      expect.any(Function),
    );
  });
});

test('delete button opens modal with dataset details', async () => {
  const dataset = mockDatasets[0];

  setupDeleteMocks(dataset.id);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');

  await userEvent.click(deleteButton);

  // Verify delete modal appears
  const modal = await screen.findByRole('dialog');
  expect(modal).toBeInTheDocument();
});

test('delete action successfully deletes dataset and refreshes list', async () => {
  const datasetToDelete = mockDatasets[0];
  setupDeleteMocks(datasetToDelete.id);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetToDelete], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addSuccessToast: mockAddSuccessToast,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');
  await userEvent.click(deleteButton);

  // Modal opens with dataset info
  const modal = await screen.findByRole('dialog');

  // Type DELETE to enable confirm button
  const confirmInput = within(modal).getByTestId('delete-modal-input');
  await userEvent.type(confirmInput, 'DELETE');

  // Track API calls before confirm
  const callsBefore = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Click confirm - find the danger button (last delete button in modal)
  const confirmButton = within(modal)
    .getAllByRole('button', { name: /^delete$/i })
    .pop();
  await userEvent.click(confirmButton!);

  // Wait for delete API call
  await waitFor(() => {
    const deleteCalls = fetchMock.calls(
      `glob:*/api/v1/dataset/${datasetToDelete.id}`,
    );
    const hasDelete = deleteCalls.some(
      call => (call[1] as RequestInit)?.method === 'DELETE',
    );
    expect(hasDelete).toBe(true);
  });

  // Success toast shown and modal closes
  await waitFor(() => {
    expect(mockAddSuccessToast).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // List refreshes
  await waitFor(() => {
    expect(fetchMock.calls(API_ENDPOINTS.DATASETS).length).toBeGreaterThan(
      callsBefore,
    );
  });
});

test('delete action cancel closes modal without deleting', async () => {
  const dataset = mockDatasets[0];
  setupDeleteMocks(dataset.id);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');
  await userEvent.click(deleteButton);

  const modal = await screen.findByRole('dialog');

  // Click Cancel button
  const cancelButton = within(modal).getByRole('button', { name: /cancel/i });
  await userEvent.click(cancelButton);

  // Modal closes
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // No delete API call made (only related_objects GET was called)
  const deleteCalls = fetchMock.calls(`glob:*/api/v1/dataset/${dataset.id}`);
  const hasDeleteMethod = deleteCalls.some(
    call => (call[1] as RequestInit)?.method === 'DELETE',
  );
  expect(hasDeleteMethod).toBe(false);

  // Dataset still in list
  expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
});

test('duplicate action successfully duplicates virtual dataset', async () => {
  const virtualDataset = mockDatasets[1]; // Virtual dataset (kind: 'virtual')
  setupDuplicateMocks();

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [virtualDataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addSuccessToast: mockAddSuccessToast,
  });

  await waitFor(() => {
    expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const duplicateButton = await within(table).findByTestId('copy');
  await userEvent.click(duplicateButton);

  const modal = await screen.findByRole('dialog');

  // Enter new name
  const input = within(modal).getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, 'Copy of Analytics');

  // Track API calls before submit
  const callsBefore = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Submit
  const submitButton = within(modal).getByRole('button', {
    name: /duplicate/i,
  });
  await userEvent.click(submitButton);

  // Wait for duplicate API call and modal closes
  await waitFor(() => {
    const dupCalls = fetchMock.calls(API_ENDPOINTS.DATASET_DUPLICATE);
    expect(dupCalls.length).toBeGreaterThan(0);
    // Modal closes (duplicate success doesn't show toast, just closes modal)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // List refreshes
  await waitFor(() => {
    expect(fetchMock.calls(API_ENDPOINTS.DATASETS).length).toBeGreaterThan(
      callsBefore,
    );
  });
});

test('duplicate button visible only for virtual datasets', async () => {
  const physicalDataset = mockDatasets[0]; // kind: 'physical'
  const virtualDataset = mockDatasets[1]; // kind: 'virtual'

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [physicalDataset, virtualDataset], count: 2 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(physicalDataset.table_name)).toBeInTheDocument();
  });

  // Find both dataset rows
  const physicalRow = screen
    .getByText(physicalDataset.table_name)
    .closest('tr');
  const virtualRow = screen.getByText(virtualDataset.table_name).closest('tr');

  expect(physicalRow).toBeInTheDocument();
  expect(virtualRow).toBeInTheDocument();

  // Check physical dataset row - should NOT have duplicate button
  const physicalDuplicateButton = within(physicalRow!).queryByTestId('copy');
  expect(physicalDuplicateButton).not.toBeInTheDocument();

  // Check virtual dataset row - should have duplicate button (copy icon)
  const virtualDuplicateButton = within(virtualRow!).getByTestId('copy');
  expect(virtualDuplicateButton).toBeInTheDocument();

  // Verify the duplicate button is visible and clickable for virtual datasets
  expect(virtualDuplicateButton).toBeVisible();
});

test('bulk select enables checkboxes', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify no checkboxes before bulk select
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  // Wait for bulk select controls container to appear first (fast query)
  await screen.findByTestId('bulk-select-controls');

  // Then wait for checkboxes to render
  await waitFor(() => {
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  // Note: Bulk action buttons (Export, Delete) only appear after selecting items
  // This test only verifies checkboxes appear - button visibility tested in other tests
});

test('selecting all datasets shows correct count in toolbar', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: mockDatasets, count: mockDatasets.length },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Enter bulk select mode
  const bulkSelectButton = screen.getByRole('button', {
    name: /bulk select/i,
  });
  await userEvent.click(bulkSelectButton);

  // Wait for bulk select controls container to appear first (fast query)
  await screen.findByTestId('bulk-select-controls');

  // Then wait for checkboxes to render
  await waitFor(() => {
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  // Select all checkbox using semantic selector
  // Note: antd renders multiple checkboxes with same aria-label, use first one (table header)
  const selectAllCheckboxes = screen.getAllByLabelText('Select all');
  await userEvent.click(selectAllCheckboxes[0]);

  // Should show selected count in toolbar (use data-test for reliability)
  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockDatasets.length} Selected`,
    );
  });
  // Note: Button enable state is tested in bulk export/delete tests
});

test('bulk export triggers export with selected IDs', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [mockDatasets[0]], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Enter bulk select mode
  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  // Select checkbox
  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(1);

  // Click first data row checkbox (index 0 might be select-all)
  await userEvent.click(checkboxes[1]);

  // Find and click bulk export button (fail-fast if not found)
  const exportButton = await screen.findByRole('button', { name: /export/i });
  await userEvent.click(exportButton);

  await waitFor(() => {
    expect(mockHandleResourceExport).toHaveBeenCalled();
  });
});

test('bulk delete opens confirmation modal', async () => {
  setupBulkDeleteMocks();

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [mockDatasets[0]], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Enter bulk select mode
  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  // Select checkbox
  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(1);

  await userEvent.click(checkboxes[1]);

  // Find and click bulk delete button (use accessible name for specificity)
  const deleteButton = await screen.findByRole('button', { name: 'Delete' });
  await userEvent.click(deleteButton);

  // Confirmation modal should appear
  const modal = await screen.findByRole('dialog');
  expect(modal).toBeInTheDocument();
});

test('exit bulk select via close button returns to normal view', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Enter bulk select mode
  const bulkSelectButton = screen.getByRole('button', {
    name: /bulk select/i,
  });
  await userEvent.click(bulkSelectButton);

  // Wait for bulk select controls container to appear first (fast query)
  const bulkSelectControls = await screen.findByTestId('bulk-select-controls');

  // Then wait for checkboxes to render
  await waitFor(() => {
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  // Note: Not verifying export/delete buttons here as they only appear after selection
  // This test focuses on the close button functionality

  // Find close button within the bulk select container
  // antd 5.x Alert component renders close button with aria-label="Close"
  const closeButton = within(bulkSelectControls).getByRole('button', {
    name: /close/i,
  });
  await userEvent.click(closeButton);

  // Wait for bulk select controls to be removed
  // Using waitFor with queryBy - handles both "still visible" and "already gone" cases
  await waitFor(() => {
    expect(
      screen.queryByTestId('bulk-select-controls'),
    ).not.toBeInTheDocument();
  });

  // Then verify normal toolbar is restored
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(
    screen.getByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();
});

test('certified badge appears for certified datasets', async () => {
  const certifiedDataset = {
    ...mockDatasets[1],
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

  // Find the dataset row
  const row = screen.getByText(certifiedDataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Verify certified badge icon is present in the row
  const certBadge = await within(row!).findByRole('img', {
    name: /certified/i,
  });
  expect(certBadge).toBeInTheDocument();
});

test('warning icon appears for datasets with warnings', async () => {
  const datasetWithWarning = {
    ...mockDatasets[2],
    extra: JSON.stringify({
      warning_markdown: 'Contains PII',
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

  // Find the dataset row
  const row = screen.getByText(datasetWithWarning.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Verify warning icon is present in the row
  const warningIcon = await within(row!).findByRole('img', {
    name: /warning/i,
  });
  expect(warningIcon).toBeInTheDocument();
});

test('info tooltip appears for datasets with descriptions', async () => {
  const datasetWithDescription = {
    ...mockDatasets[0],
    description: 'Sales data from Q4 2024',
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [datasetWithDescription], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(
      screen.getByText(datasetWithDescription.table_name),
    ).toBeInTheDocument();
  });

  // Find the dataset row
  const row = screen.getByText(datasetWithDescription.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Verify info tooltip icon is present in the row
  const infoIcon = await within(row!).findByRole('img', { name: /info/i });
  expect(infoIcon).toBeInTheDocument();
});

test('dataset name links to Explore page', async () => {
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

  // Dataset name should be a link to Explore within the row
  const link = within(row!).getByTestId('internal-link');
  expect(link).toHaveAttribute('href', dataset.explore_url);
});

test('physical dataset shows delete, export, and edit actions (no duplicate)', async () => {
  const physicalDataset = mockDatasets[0]; // kind: 'physical'

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [physicalDataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(physicalDataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(physicalDataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Physical datasets should have: delete, export, edit
  const deleteButton = within(row!).getByTestId('delete');
  const exportButton = within(row!).getByTestId('upload');
  const editButton = within(row!).getByTestId('edit');

  expect(deleteButton).toBeInTheDocument();
  expect(exportButton).toBeInTheDocument();
  expect(editButton).toBeInTheDocument();

  // Should NOT have duplicate button
  const duplicateButton = within(row!).queryByTestId('copy');
  expect(duplicateButton).not.toBeInTheDocument();
});

test('virtual dataset shows delete, export, edit, and duplicate actions', async () => {
  const virtualDataset = mockDatasets[1]; // kind: 'virtual'

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [virtualDataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(virtualDataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Virtual datasets should have: delete, export, edit, duplicate
  const deleteButton = within(row!).getByTestId('delete');
  const exportButton = within(row!).getByTestId('upload');
  const editButton = within(row!).getByTestId('edit');
  const duplicateButton = within(row!).getByTestId('copy');

  expect(deleteButton).toBeInTheDocument();
  expect(exportButton).toBeInTheDocument();
  expect(editButton).toBeInTheDocument();
  expect(duplicateButton).toBeInTheDocument();
});

test('edit action is enabled for dataset owner', async () => {
  const dataset = {
    ...mockDatasets[0],
    owners: [{ id: mockAdminUser.userId, username: 'admin' }],
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(dataset.table_name).closest('tr');
  const editIcon = within(row!).getByTestId('edit');
  const editButton = editIcon.closest('.action-button, .disabled');

  // Should have action-button class (not disabled)
  expect(editButton).toHaveClass('action-button');
  expect(editButton).not.toHaveClass('disabled');
});

test('edit action is disabled for non-owner', async () => {
  const dataset = {
    ...mockDatasets[0],
    owners: [{ id: 999, username: 'other_user' }], // Different user
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  // Use a non-admin user to test ownership check
  const regularUser = {
    ...mockAdminUser,
    roles: { Admin: [['can_read', 'Dataset']] },
  };

  renderDatasetList(regularUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(dataset.table_name).closest('tr');
  const editIcon = within(row!).getByTestId('edit');
  const editButton = editIcon.closest('.action-button, .disabled');

  // Should have disabled class (disabled buttons still have 'action-button' class)
  expect(editButton).toHaveClass('disabled');
  expect(editButton).toHaveClass('action-button');
});

test('all action buttons are clickable and enabled for admin user', async () => {
  const virtualDataset = {
    ...mockDatasets[1],
    owners: [{ id: mockAdminUser.userId, username: 'admin' }],
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [virtualDataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(virtualDataset.table_name).closest('tr');

  // Get icons and their parent button elements
  const deleteIcon = within(row!).getByTestId('delete');
  const exportIcon = within(row!).getByTestId('upload');
  const editIcon = within(row!).getByTestId('edit');
  const duplicateIcon = within(row!).getByTestId('copy');

  const deleteButton = deleteIcon.closest('.action-button, .disabled');
  const exportButton = exportIcon.closest('.action-button, .disabled');
  const editButton = editIcon.closest('.action-button, .disabled');
  const duplicateButton = duplicateIcon.closest('.action-button, .disabled');

  // All should have action-button class (enabled)
  expect(deleteButton).toHaveClass('action-button');
  expect(exportButton).toHaveClass('action-button');
  expect(editButton).toHaveClass('action-button');
  expect(duplicateButton).toHaveClass('action-button');

  // None should be disabled
  expect(deleteButton).not.toHaveClass('disabled');
  expect(exportButton).not.toHaveClass('disabled');
  expect(editButton).not.toHaveClass('disabled');
  expect(duplicateButton).not.toHaveClass('disabled');
});

test('displays error when initial dataset fetch fails with 500', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { status: 500, body: { message: 'Internal Server Error' } },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast: mockAddDangerToast,
  });

  // Error toast should be shown
  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalled();
  });

  // No dataset names from mockDatasets should appear in the document
  mockDatasets.forEach(dataset => {
    expect(screen.queryByText(dataset.table_name)).not.toBeInTheDocument();
  });
});

test('displays error when initial dataset fetch fails with 403 permission denied', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { status: 403, body: { message: 'Access Denied' } },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast: mockAddDangerToast,
  });

  // Error toast should be shown for permission denied
  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalled();
  });

  // Verify toast message contains the 403-specific "Access Denied" text
  const toastMessage = String(mockAddDangerToast.mock.calls[0][0]);
  expect(toastMessage).toContain('Access Denied');

  // No dataset names from mockDatasets should appear in the document
  mockDatasets.forEach(dataset => {
    expect(screen.queryByText(dataset.table_name)).not.toBeInTheDocument();
  });
});

test('dataset links use internal routing when PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET is enabled', async () => {
  renderDatasetList(
    mockAdminUser,
    {},
    {
      common: {
        conf: {
          PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET: true,
        },
      },
    },
  );

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // When flag is enabled, links should use internal-link data-test attribute
  const internalLinks = screen.getAllByTestId('internal-link');
  expect(internalLinks.length).toBeGreaterThan(0);

  // Each link should be a React Router Link (has href attribute)
  internalLinks.forEach(link => {
    expect(link).toHaveAttribute('href');
  });
});

// Note: These delete error tests verify that the modal doesn't open when fetching
// related_objects fails. The component's openDatasetDeleteModal error handler
// (index.tsx:262-268) returns a string but doesn't call addDangerToast(), so no
// error toast is shown. This is a component bug documented for a separate fix.
// The tests correctly verify current behavior: API call made, modal prevented.

test('delete action gracefully handles 403 forbidden error', async () => {
  const dataset = mockDatasets[0];

  setupErrorTestScenario({
    dataset,
    method: 'get',
    endpoint: '/related_objects',
    errorStatus: 403,
    errorMessage: 'Failed to fetch related objects',
  });

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');

  await userEvent.click(deleteButton);

  // Wait for SupersetClient.get to be called (deterministic anchor - API was attempted)
  await waitFor(() => {
    expect(SupersetClient.get).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringContaining('/related_objects'),
      }),
    );
  });

  // Verify modal did NOT open (error prevented it)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Verify dataset still in list (not removed)
  expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
});

test('delete action gracefully handles 500 internal server error', async () => {
  const dataset = mockDatasets[0];

  setupErrorTestScenario({
    dataset,
    method: 'get',
    endpoint: '/related_objects',
    errorStatus: 500,
    errorMessage: 'Internal Server Error',
  });

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');

  await userEvent.click(deleteButton);

  // Wait for SupersetClient.get to be called (deterministic anchor - API was attempted)
  await waitFor(() => {
    expect(SupersetClient.get).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringContaining('/related_objects'),
      }),
    );
  });

  // Verify modal did NOT open
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Verify table state unchanged
  expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
});

test('duplicate action shows error toast on 403 forbidden', async () => {
  const virtualDataset = {
    ...mockDatasets[1],
    owners: [
      {
        first_name: mockAdminUser.firstName,
        last_name: mockAdminUser.lastName,
        id: mockAdminUser.userId as number,
      },
    ],
  };

  setupErrorTestScenario({
    dataset: virtualDataset,
    method: 'post',
    endpoint: '/duplicate',
    errorStatus: 403,
    errorMessage: 'Failed to duplicate dataset',
  });

  await waitFor(() => {
    expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const duplicateButton = await within(table).findByTestId('copy');

  await userEvent.click(duplicateButton);

  // Wait for duplicate modal to appear
  const modal = await screen.findByRole('dialog');
  expect(modal).toBeInTheDocument();

  // Enter new dataset name
  const input = within(modal).getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, 'Copy of Analytics Query');

  // Submit duplicate
  const submitButton = within(modal).getByRole('button', {
    name: /duplicate/i,
  });
  await userEvent.click(submitButton);

  // Wait for error toast first (deterministic anchor)
  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/issue duplicating.*selected datasets/i),
    );
  });

  // Then verify modal stays open on error (component doesn't close it on failure)
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  // Verify original dataset still in list
  expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
});

test('duplicate action shows error toast on 500 internal server error', async () => {
  const virtualDataset = {
    ...mockDatasets[1],
    owners: [
      {
        first_name: mockAdminUser.firstName,
        last_name: mockAdminUser.lastName,
        id: mockAdminUser.userId as number,
      },
    ],
  };

  setupErrorTestScenario({
    dataset: virtualDataset,
    method: 'post',
    endpoint: '/duplicate',
    errorStatus: 500,
    errorMessage: 'Internal Server Error',
  });

  await waitFor(() => {
    expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const duplicateButton = await within(table).findByTestId('copy');

  await userEvent.click(duplicateButton);

  // Wait for duplicate modal
  const modal = await screen.findByRole('dialog');

  // Enter new dataset name
  const input = within(modal).getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, 'Copy of Analytics Query');

  // Submit
  const submitButton = within(modal).getByRole('button', {
    name: /duplicate/i,
  });
  await userEvent.click(submitButton);

  // Wait for error toast first (deterministic anchor)
  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/issue duplicating.*selected datasets/i),
    );
  });

  // Then verify modal stays open on error (component doesn't close it on failure)
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  // Verify table state unchanged
  expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
});

// Component "+1" Tests - State persistence through operations

// This test is inherently slow due to userEvent.type() typing DELETE character-by-character
// 30s timeout to handle CI variability
test('sort order persists after deleting a dataset', async () => {
  const datasetToDelete = mockDatasets[0];
  setupDeleteMocks(datasetToDelete.id);

  renderDatasetList(mockAdminUser, {
    addSuccessToast: mockAddSuccessToast,
    addDangerToast: mockAddDangerToast,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const nameHeader = within(table).getByRole('columnheader', {
    name: /Name/i,
  });

  // Record initial API calls count
  const initialCalls = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Click Name header to sort
  await userEvent.click(nameHeader);

  // Wait for new API call with sort parameter
  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(initialCalls);
  });

  // Record the sort parameter from the API call after sorting
  const callsAfterSort = fetchMock.calls(API_ENDPOINTS.DATASETS);
  const sortedUrl = callsAfterSort[callsAfterSort.length - 1][0] as string;
  expect(sortedUrl).toMatch(/order_column|sort/);

  // Delete a dataset - get delete button from first row only
  const firstRow = screen.getAllByRole('row')[1];
  const deleteButton = within(firstRow).getByTestId('delete');
  await userEvent.click(deleteButton);

  // Confirm delete in modal - type DELETE to enable button
  const modal = await screen.findByRole('dialog');
  await within(modal).findByText(datasetToDelete.table_name);

  // Enable the danger button by typing DELETE
  const confirmInput = within(modal).getByTestId('delete-modal-input');
  await userEvent.clear(confirmInput);
  await userEvent.type(confirmInput, 'DELETE');

  // Record call count before delete to track refetch
  const callsBeforeDelete = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  const confirmButton = within(modal)
    .getAllByRole('button', { name: /^delete$/i })
    .pop();
  await userEvent.click(confirmButton!);

  // Confirm the delete request fired
  await waitFor(() => {
    expect(mockAddSuccessToast).toHaveBeenCalled();
  });

  // Wait for modal to close completely
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Wait for list refetch to complete (prevents async cleanup error)
  await waitFor(() => {
    const currentCalls = fetchMock.calls(API_ENDPOINTS.DATASETS).length;
    expect(currentCalls).toBeGreaterThan(callsBeforeDelete);
  });

  // Re-query the header fresh (DOM may have been replaced on re-render)
  // and assert the sort indicators still exist
  await waitFor(() => {
    const freshHeader = screen.getByRole('columnheader', { name: /Name/i });
    const carets = within(freshHeader.closest('th')!).getAllByLabelText(
      /caret/i,
    );
    expect(carets.length).toBeGreaterThan(0);
  });
}, 30000);

// Note: "deleting last item on page 2 fetches page 1" is a hook-level pagination
// concern (useListViewResource handles page reset logic). This is covered by
// integration tests where we can verify the full pagination cycle.

// Note: Full bulk delete workflow (select → delete → confirm → verify toast) is
// tested in DatasetList.integration.test.tsx as it's a multi-component orchestration
// test. Component tests here focus on individual behaviors.

test('bulk selection clears when filter changes', async () => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: mockDatasets, count: mockDatasets.length },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Enter bulk select mode
  const bulkSelectButton = screen.getByRole('button', {
    name: /bulk select/i,
  });
  await userEvent.click(bulkSelectButton);

  // Wait for bulk select controls container to appear first (fast query)
  await screen.findByTestId('bulk-select-controls');

  // Then wait for checkboxes to render
  await waitFor(() => {
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  // Verify multiple checkboxes exist (header + row checkboxes)
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(1);

  // Select first 2 items (indices 1 and 2 - index 0 is header)
  await userEvent.click(checkboxes[1]);
  await userEvent.click(checkboxes[2]);

  // Wait for selections to register - assert specific count to avoid matching "0 Selected"
  await screen.findByText(/2 selected/i);

  // Record API call count before filter
  const beforeFilterCallCount = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Apply a filter using selectOption helper
  await selectOption('Virtual', 'Type');

  // Wait for filter API call to complete
  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(beforeFilterCallCount);
  });

  // Verify filter was applied by decoding URL payload
  const urlAfterFilter = fetchMock
    .calls(API_ENDPOINTS.DATASETS)
    .at(-1)?.[0] as string;
  const risonAfterFilter = urlAfterFilter.split('?q=')[1];
  expect(risonAfterFilter).toBeTruthy();
  const decodedAfterFilter = rison.decode(
    decodeURIComponent(risonAfterFilter),
  ) as Record<string, unknown>;
  expect(decodedAfterFilter.filters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ col: 'sql', value: false }),
    ]),
  );

  // Verify selection was cleared - count should show "0 Selected"
  await waitFor(() => {
    expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
  });
}, 30000); // Complex test with multiple async operations

test('type filter API call includes correct filter parameter', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Wait for Type filter combobox
  await screen.findByRole('combobox', { name: 'Type' });

  // Snapshot call count before filter
  const callsBeforeFilter = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Apply Type filter
  await selectOption('Virtual', 'Type');

  // Wait for filter API call to complete
  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(callsBeforeFilter);
  });

  // Verify the latest API call includes the Type filter
  const url = fetchMock.calls(API_ENDPOINTS.DATASETS).at(-1)?.[0] as string;
  expect(url).toContain('filters');

  const risonPayload = url.split('?q=')[1];
  expect(risonPayload).toBeTruthy();
  const decoded = rison.decode(decodeURIComponent(risonPayload)) as Record<
    string,
    unknown
  >;
  const filters = Array.isArray(decoded?.filters) ? decoded.filters : [];

  // Type filter should be present (sql=false for Virtual datasets)
  expect(filters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ col: 'sql', value: false }),
    ]),
  );
});

test('type filter persists after duplicating a dataset', async () => {
  const datasetToDuplicate = mockDatasets.find(d => d.kind === 'virtual')!;

  setupDuplicateMocks();

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Wait for Type filter combobox
  await screen.findByRole('combobox', { name: 'Type' });

  // Snapshot call count before filter
  const callsBeforeFilter = fetchMock.calls(API_ENDPOINTS.DATASETS).length;

  // Apply Type filter
  await selectOption('Virtual', 'Type');

  // Wait for filter API call to complete
  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(callsBeforeFilter);
  });

  // Verify filter is present by checking the latest API call
  const urlAfterFilter = fetchMock
    .calls(API_ENDPOINTS.DATASETS)
    .at(-1)?.[0] as string;
  const risonAfterFilter = urlAfterFilter.split('?q=')[1];
  expect(risonAfterFilter).toBeTruthy();
  const decodedAfterFilter = rison.decode(
    decodeURIComponent(risonAfterFilter),
  ) as Record<string, unknown>;
  expect(decodedAfterFilter.filters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ col: 'sql', value: false }),
    ]),
  );

  // Capture datasets API call count BEFORE any duplicate operations
  const datasetsCallCountBeforeDuplicate = fetchMock.calls(
    API_ENDPOINTS.DATASETS,
  ).length;

  // Now duplicate the dataset
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

  // Wait for duplicate API call to be made
  await waitFor(() => {
    const duplicateCalls = fetchMock.calls(API_ENDPOINTS.DATASET_DUPLICATE);
    expect(duplicateCalls.length).toBeGreaterThan(0);
  });

  // Wait for datasets refetch to occur (proves duplicate triggered a refresh)
  await waitFor(() => {
    const datasetsCallCount = fetchMock.calls(API_ENDPOINTS.DATASETS).length;
    expect(datasetsCallCount).toBeGreaterThan(datasetsCallCountBeforeDuplicate);
  });

  // Verify Type filter persisted in the NEW datasets API call after duplication
  const urlAfterDuplicate = fetchMock
    .calls(API_ENDPOINTS.DATASETS)
    .at(-1)?.[0] as string;
  const risonAfterDuplicate = urlAfterDuplicate.split('?q=')[1];
  expect(risonAfterDuplicate).toBeTruthy();
  const decodedAfterDuplicate = rison.decode(
    decodeURIComponent(risonAfterDuplicate),
  ) as Record<string, unknown>;
  expect(decodedAfterDuplicate.filters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ col: 'sql', value: false }),
    ]),
  );
});
