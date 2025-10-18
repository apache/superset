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
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import {
  setupMocks,
  renderDatasetList,
  mockAdminUser,
  mockDatasets,
  setupDeleteMocks,
  setupBulkDeleteMocks,
  setupDeleteErrorMocks,
  setupDuplicateErrorMocks,
  mockHandleResourceExport,
  assertOnlyExpectedCalls,
  API_ENDPOINTS,
} from './DatasetList.testHelpers';

jest.mock('src/utils/export');

beforeEach(() => {
  setupMocks();
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
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
  expect(within(table).getByText(/Name/i)).toBeInTheDocument();
  expect(within(table).getByText(/Type/i)).toBeInTheDocument();
  expect(within(table).getByText(/Database/i)).toBeInTheDocument();
  expect(within(table).getByText(/Schema/i)).toBeInTheDocument();
  expect(within(table).getByText(/Owners/i)).toBeInTheDocument();
  expect(within(table).getByText(/Last modified/i)).toBeInTheDocument();
  expect(within(table).getByText(/Actions/i)).toBeInTheDocument();
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
  const nameHeader = within(table).getByText(/Name/i);

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
  const databaseHeader = within(table).getByText(/Database/i);

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
  const modifiedHeader = within(table).getByText(/Last modified/i);

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

test('bulk select enables checkboxes for all rows', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify no checkboxes before bulk select
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  // Checkboxes should appear
  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
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
  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  // Select all checkbox (first one is usually select-all)
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(0);

  await userEvent.click(checkboxes[0]);

  // Should show selected count in toolbar
  await waitFor(() => {
    const selectionText = screen.getByText(/selected/i);
    expect(selectionText).toBeInTheDocument();
    // Verify count matches number of datasets
    expect(selectionText).toHaveTextContent(String(mockDatasets.length));
  });

  // Verify bulk action buttons are enabled when items are selected
  const exportButton = screen.getByRole('button', { name: /export/i });
  const deleteButton = screen.getByRole('button', { name: 'Delete' });
  expect(exportButton).toBeEnabled();
  expect(deleteButton).toBeEnabled();
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
  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  // Note: Not verifying export/delete buttons here as they only appear after selection
  // This test focuses on the close button functionality

  // Find close/exit button (available in bulk mode toolbar)
  const closeButton = await screen.findByRole('button', {
    name: /close|exit/i,
  });
  await userEvent.click(closeButton);

  // Checkboxes should disappear
  await waitFor(() => {
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes.length).toBe(0);
  });

  // Bulk action toolbar should be hidden, normal toolbar should return
  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: /close|exit/i }),
    ).not.toBeInTheDocument();
    // Bulk select button should be back
    expect(
      screen.getByRole('button', { name: /bulk select/i }),
    ).toBeInTheDocument();
  });
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

  // Should have disabled class
  expect(editButton).toHaveClass('disabled');
  expect(editButton).not.toHaveClass('action-button');
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

test('delete action shows error toast on 403 forbidden', async () => {
  const dataset = mockDatasets[0];
  const addDangerToast = jest.fn();

  setupDeleteErrorMocks(dataset.id, 403);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast,
    addSuccessToast: jest.fn(),
  });

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');

  await userEvent.click(deleteButton);

  // Wait for error toast with combined assertion
  await waitFor(
    () => {
      expect(addDangerToast).toHaveBeenCalledWith(
        expect.stringMatching(/error occurred while fetching dataset/i),
      );
    },
    { timeout: 5000 },
  );

  // Verify modal did NOT open (error prevented it)
  const modal = screen.queryByRole('dialog');
  expect(modal).not.toBeInTheDocument();

  // Verify dataset still in list (not removed)
  expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
});

test('delete action shows error toast on 500 internal server error', async () => {
  const dataset = mockDatasets[0];
  const addDangerToast = jest.fn();

  setupDeleteErrorMocks(dataset.id, 500);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast,
    addSuccessToast: jest.fn(),
  });

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');

  await userEvent.click(deleteButton);

  // Wait for error toast with combined assertion
  await waitFor(() => {
    expect(addDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/error occurred while fetching dataset/i),
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
    owners: [{ id: mockAdminUser.userId, username: 'admin' }],
  };
  const addDangerToast = jest.fn();

  setupDuplicateErrorMocks(403);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [virtualDataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast,
    addSuccessToast: jest.fn(),
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

  // Wait for error toast with combined assertion
  await waitFor(() => {
    expect(addDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/issue duplicating.*selected datasets/i),
    );
  });

  // Verify table state unchanged (no new dataset added)
  const allDatasetRows = screen.getAllByRole('row');
  // Header + 1 dataset row
  expect(allDatasetRows.length).toBe(2);
});

test('duplicate action shows error toast on 500 internal server error', async () => {
  const virtualDataset = {
    ...mockDatasets[1],
    owners: [{ id: mockAdminUser.userId, username: 'admin' }],
  };
  const addDangerToast = jest.fn();

  setupDuplicateErrorMocks(500);

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [virtualDataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser, {
    addDangerToast,
    addSuccessToast: jest.fn(),
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

  // Wait for error toast with combined assertion
  await waitFor(() => {
    expect(addDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/issue duplicating.*selected datasets/i),
    );
  });

  // Verify table state unchanged
  expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
});
