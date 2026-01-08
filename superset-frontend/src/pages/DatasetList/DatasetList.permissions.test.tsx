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
import fetchMock from 'fetch-mock';
import {
  setupMocks,
  setupApiPermissions,
  renderDatasetList,
  mockAdminUser,
  mockReadOnlyUser,
  mockWriteUser,
  mockExportOnlyUser,
  mockDatasets,
  API_ENDPOINTS,
} from './DatasetList.testHelpers';

// Increase default timeout for tests that involve multiple async operations
jest.setTimeout(15000);

beforeEach(() => {
  setupMocks();
  jest.clearAllMocks();
});

afterEach(() => {
  fetchMock.resetHistory();
  fetchMock.restore();
});

test('admin users see all UI elements', async () => {
  // Setup API with full admin permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export', 'can_duplicate']);

  renderDatasetList(mockAdminUser);

  expect(await screen.findByText('Datasets')).toBeInTheDocument();

  // Admin should see create button
  expect(
    screen.getByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).toBeInTheDocument();

  // Admin should see import button
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.getByTestId('import-button')).toBeInTheDocument();

  // Admin should see bulk select button
  expect(
    screen.getByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();

  // Admin should see actions column
  await waitFor(() => {
    const table = screen.getByTestId('listview-table');
    expect(
      within(table).getByRole('columnheader', { name: /Actions/i }),
    ).toBeInTheDocument();
  });
});

test('read-only users cannot see Actions column', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  await waitFor(() => {
    const table = screen.getByTestId('listview-table');
    // Actions column should not be present
    expect(within(table).queryByText(/Actions/i)).not.toBeInTheDocument();
  });
});

test('read-only users cannot see bulk select button', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Bulk select should not be visible
  expect(
    screen.queryByRole('button', { name: /bulk select/i }),
  ).not.toBeInTheDocument();
});

test('read-only users cannot see Create/Import buttons', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Create button should not be visible
  expect(
    screen.queryByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).not.toBeInTheDocument();

  // Import button should not be visible
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
});

test('write users see Actions column', async () => {
  // Setup API with write permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  await waitFor(() => {
    const table = screen.getByTestId('listview-table');
    expect(
      within(table).getByRole('columnheader', { name: /Actions/i }),
    ).toBeInTheDocument();
  });
});

test('write users see bulk select button', async () => {
  // Setup API with write permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  expect(
    screen.getByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();
});

test('write users see Create/Import buttons', async () => {
  // Setup API with write permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Create button should be visible
  expect(
    screen.getByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).toBeInTheDocument();

  // Import button should be visible
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.getByTestId('import-button')).toBeInTheDocument();
});

test('export-only users see bulk select (for export only)', async () => {
  // Setup API with export-only permissions
  setupApiPermissions(['can_read', 'can_export']);

  renderDatasetList(mockExportOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Export users should see bulk select for export functionality
  expect(
    screen.getByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();
});

test('export-only users cannot see Create/Import buttons', async () => {
  // Setup API with export-only permissions
  setupApiPermissions(['can_read', 'can_export']);

  renderDatasetList(mockExportOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Create and Import should not be visible for export-only users
  expect(
    screen.queryByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).not.toBeInTheDocument();
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
});

test('action buttons respect user permissions', async () => {
  // Setup API with full admin permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export', 'can_duplicate']);

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

  // Admin should see action buttons in the row
  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Verify specific action buttons are present
  const deleteButton = within(row!).queryByTestId('delete');
  const exportButton = within(row!).queryByTestId('upload');

  expect(deleteButton).toBeInTheDocument();
  expect(exportButton).toBeInTheDocument();
});

test('read-only user sees no delete or duplicate buttons in row', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  const dataset = mockDatasets[0];

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  // Find the dataset row
  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Verify no delete button in the row
  const deleteButton = within(row!).queryByTestId('delete');
  expect(deleteButton).not.toBeInTheDocument();

  // Verify no duplicate button (Actions column should not exist)
  const duplicateButton = within(row!).queryByTestId('copy');
  expect(duplicateButton).not.toBeInTheDocument();

  // Verify no edit button
  const editButton = within(row!).queryByTestId('edit');
  expect(editButton).not.toBeInTheDocument();
});

test('write user sees edit, delete, and export actions', async () => {
  // Setup API with write permissions (includes delete)
  // Note: can_write grants both edit and delete permissions in DatasetList
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  const dataset = {
    ...mockDatasets[0],
    owners: [{ id: mockWriteUser.userId, username: 'writeuser' }],
  };

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Should have delete button (can_write includes delete)
  const deleteButton = within(row!).getByTestId('delete');
  expect(deleteButton).toBeInTheDocument();

  // Should have export button
  const exportButton = within(row!).getByTestId('upload');
  expect(exportButton).toBeInTheDocument();

  // Should have edit button (user is owner)
  const editButton = within(row!).getByTestId('edit');
  expect(editButton).toBeInTheDocument();

  // Should NOT have duplicate button (no can_duplicate permission)
  const duplicateButton = within(row!).queryByTestId('copy');
  expect(duplicateButton).not.toBeInTheDocument();
});

test('export-only user has no Actions column (no write/duplicate permissions)', async () => {
  // Setup API with export-only permissions
  // Note: Export action alone doesn't render Actions column - it's in toolbar/bulk select
  setupApiPermissions(['can_read', 'can_export']);

  const dataset = mockDatasets[0];

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: [dataset], count: 1 },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockExportOnlyUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Actions column is hidden when user only has export permission
  // (export is available via bulk select toolbar, not row actions)
  const deleteButton = within(row!).queryByTestId('delete');
  expect(deleteButton).not.toBeInTheDocument();

  const editButton = within(row!).queryByTestId('edit');
  expect(editButton).not.toBeInTheDocument();

  const duplicateButton = within(row!).queryByTestId('copy');
  expect(duplicateButton).not.toBeInTheDocument();

  const exportButton = within(row!).queryByTestId('upload');
  expect(exportButton).not.toBeInTheDocument();
});

test('user with can_duplicate sees duplicate button only for virtual datasets', async () => {
  // Setup API with duplicate permission
  setupApiPermissions(['can_read', 'can_duplicate']);

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

  // Check physical dataset row
  const physicalRow = screen
    .getByText(physicalDataset.table_name)
    .closest('tr');
  expect(physicalRow).toBeInTheDocument();

  // Physical dataset should NOT have duplicate button
  const physicalDuplicateButton = within(physicalRow!).queryByTestId('copy');
  expect(physicalDuplicateButton).not.toBeInTheDocument();

  // Check virtual dataset row
  const virtualRow = screen.getByText(virtualDataset.table_name).closest('tr');
  expect(virtualRow).toBeInTheDocument();

  // Virtual dataset SHOULD have duplicate button
  const virtualDuplicateButton = within(virtualRow!).getByTestId('copy');
  expect(virtualDuplicateButton).toBeInTheDocument();
});
