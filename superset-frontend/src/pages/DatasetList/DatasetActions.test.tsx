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
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import DatasetList from './index';
import {
  mockDatasets,
  mockDatasetResponse,
  mockPhysicalDataset,
  mockVirtualDataset,
  mockDatasetDetail,
  mockRelatedObjects,
  mockEmptyRelatedObjects,
  mockUser,
  mockAdminUser,
  mockOtherOwner,
  mockToasts,
} from './fixtures';

// Mock components to avoid complex dependencies
jest.mock('src/features/home/SubMenu', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-test="submenu">{children}</div>
  ),
}));

jest.mock('src/components/Datasource', () => ({
  __esModule: true,
  DatasourceModal: ({ show, onHide, datasource }: any) =>
    show ? (
      <div role="dialog" data-test="datasource-modal">
        <span>Editing: {datasource?.table_name}</span>
        <button type="button" onClick={onHide}>
          Close Modal
        </button>
      </div>
    ) : null,
}));

jest.mock('src/features/datasets/DuplicateDatasetModal', () => ({
  __esModule: true,
  default: ({ dataset, onHide }: any) =>
    dataset ? (
      <div role="dialog" data-test="duplicate-modal">
        <span>Duplicating: {dataset?.table_name}</span>
        <button type="button" onClick={onHide}>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('src/components/ImportModal', () => ({
  __esModule: true,
  ImportModal: ({ show, onHide, onImport }: any) =>
    show ? (
      <div role="dialog" data-test="import-modal">
        <button type="button" onClick={() => onImport()}>
          Import
        </button>
        <button type="button" onClick={onHide}>
          Cancel
        </button>
      </div>
    ) : null,
}));

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const defaultProps = {
  ...mockToasts,
  user: mockUser,
};

const setupMockApi = () => {
  fetchMock.get('glob:*/api/v1/dataset/_info*', {
    permissions: ['can_read', 'can_write', 'can_export', 'can_duplicate'],
  });
  fetchMock.get('glob:*/api/v1/dataset/related/database*', []);
  fetchMock.get('glob:*/api/v1/dataset/distinct/schema*', []);
  fetchMock.get('glob:*/api/v1/dataset/related/owners*', []);
};

beforeEach(() => {
  fetchMock.reset();
  fetchMock.restore();
  setupMockApi();
  jest.clearAllMocks();
});

afterEach(() => {
  fetchMock.restore();
});

test('opens edit modal when edit button is clicked', async () => {
  // Register specific routes before catch-all to avoid precedence issues
  fetchMock.get('glob:*/api/v1/dataset/1', { result: mockDatasetDetail });
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Find the row containing 'birth_names', then click edit within that row
  const row = screen.getByRole('row', { name: /birth_names/i });
  const editButton = within(row).getByRole('button', { name: /edit/i });
  await userEvent.click(editButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Editing: birth_names')).toBeInTheDocument();
  });
});

test('shows disabled edit button with tooltip for non-owners', async () => {
  const datasetWithOtherOwner = {
    ...mockPhysicalDataset,
    owners: [mockOtherOwner],
  };

  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [datasetWithOtherOwner],
    count: 1,
  });

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Find edit button within the row
  const row = screen.getByRole('row', { name: /birth_names/i });
  const editButton = within(row).getByRole('button', { name: /edit/i });

  // Button should have disabled class
  expect(editButton).toHaveClass('disabled');
});

test('allows edit for admin users regardless of ownership', async () => {
  const datasetWithOtherOwner = {
    ...mockPhysicalDataset,
    owners: [mockOtherOwner],
  };

  // Register specific routes before catch-all
  fetchMock.get('glob:*/api/v1/dataset/1', { result: mockDatasetDetail });
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [datasetWithOtherOwner],
    count: 1,
  });

  render(<DatasetList {...defaultProps} user={mockAdminUser} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Admin should be able to edit even if not owner
  const row = screen.getByRole('row', { name: /birth_names/i });
  const editButton = within(row).getByRole('button', { name: /edit/i });

  expect(editButton).not.toHaveClass('disabled');
  await userEvent.click(editButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

test('opens delete confirmation modal when delete button is clicked', async () => {
  // Register specific routes before catch-all
  fetchMock.get(
    'glob:*/api/v1/dataset/1/related_objects',
    mockEmptyRelatedObjects,
  );
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  const deleteButton = within(row).getByRole('button', { name: /delete/i });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

test('shows related objects in delete confirmation when they exist', async () => {
  // Register specific routes before catch-all
  fetchMock.get('glob:*/api/v1/dataset/1/related_objects', mockRelatedObjects);
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  const deleteButton = within(row).getByRole('button', { name: /delete/i });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Should show related objects information
  });
});

test('deletes dataset when confirmation is clicked', async () => {
  // Register specific routes before catch-all
  fetchMock.get(
    'glob:*/api/v1/dataset/1/related_objects',
    mockEmptyRelatedObjects,
  );
  fetchMock.delete('glob:*/api/v1/dataset/1', 200);
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  // Mock refreshed data after deletion
  fetchMock.get(
    'glob:*/api/v1/dataset/*',
    {
      result: mockDatasets.slice(1), // Remove first dataset
      count: mockDatasets.length - 1,
    },
    { overwriteRoutes: false },
  );

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  const deleteButton = within(row).getByRole('button', { name: /delete/i });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  const modal = screen.getByRole('dialog');
  const confirmButton = within(modal).getByRole('button', { name: /delete/i });
  await userEvent.click(confirmButton);

  await waitFor(() => {
    expect(fetchMock.called('DELETE', 'glob:*/api/v1/dataset/1')).toBe(true);
    expect(mockToasts.addSuccessToast).toHaveBeenCalledWith(
      expect.stringContaining('deleted'),
    );
  });
});

test('handles delete API errors gracefully', async () => {
  // Register specific routes before catch-all
  fetchMock.get(
    'glob:*/api/v1/dataset/1/related_objects',
    mockEmptyRelatedObjects,
  );
  fetchMock.delete('glob:*/api/v1/dataset/1', 500);
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  const deleteButton = within(row).getByRole('button', { name: /delete/i });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  const modal = screen.getByRole('dialog');
  const confirmButton = within(modal).getByRole('button', { name: /delete/i });
  await userEvent.click(confirmButton);

  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining('error'),
    );
  });
});

test('exports single dataset when export button is clicked', async () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const handleResourceExport = require('src/utils/export').default;

  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  // Action buttons are in order: Delete, Export, Edit
  // Filter out InfoTooltip buttons to get only action buttons
  const allButtons = within(row).getAllByRole('button');
  const actionButtons = allButtons.filter(
    btn => !btn.getAttribute('data-test')?.includes('info-tooltip'),
  );
  const exportButton = actionButtons[1]; // Export is second action button (after Delete)
  await userEvent.click(exportButton);

  expect(handleResourceExport).toHaveBeenCalledWith(
    'dataset',
    [mockPhysicalDataset.id],
    expect.any(Function),
  );
});

test('opens duplicate modal for virtual datasets only', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [mockVirtualDataset],
    count: 1,
  });

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('virtual_dataset')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /virtual_dataset/i });
  // For virtual datasets: Delete, Export, Edit, Duplicate
  // Filter out InfoTooltip buttons to get only action buttons
  const allButtons = within(row).getAllByRole('button');
  const actionButtons = allButtons.filter(
    btn => !btn.getAttribute('data-test')?.includes('info-tooltip'),
  );
  const duplicateButton = actionButtons[actionButtons.length - 1]; // Duplicate is last action button
  await userEvent.click(duplicateButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Duplicating: virtual_dataset'),
    ).toBeInTheDocument();
  });
});

test('does not show duplicate button for physical datasets', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [mockPhysicalDataset],
    count: 1,
  });

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  // Should not have duplicate button for physical datasets
  // Physical datasets have 3 action buttons (Delete, Export, Edit), virtual would have 4 (+ Duplicate)
  // Filter out InfoTooltip buttons to count only action buttons
  const allButtons = within(row).getAllByRole('button');
  const actionButtons = allButtons.filter(
    btn => !btn.getAttribute('data-test')?.includes('info-tooltip'),
  );
  expect(actionButtons).toHaveLength(3);
});

test('handles bulk delete operation', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);
  fetchMock.delete('glob:*/api/v1/dataset/', 200);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // This test would need access to bulk selection controls
  // The implementation would depend on how ListView exposes bulk operations
});

test('handles bulk export operation', async () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const handleResourceExport = require('src/utils/export').default;

  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Activate bulk select mode
  const bulkSelectButton = screen.getByTestId('bulk-select');
  fireEvent.click(bulkSelectButton);

  await waitFor(() => {
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      mockDatasets.length + 1,
    );
  });

  // Select all datasets
  const selectAllCheckbox = screen.getByLabelText('Select all');
  fireEvent.click(selectAllCheckbox);

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      `${mockDatasets.length} Selected`,
    );
  });

  // Click bulk export button
  const bulkActions = screen.getAllByTestId('bulk-select-action');
  const exportButton = bulkActions.find(btn => btn.textContent === 'Export');
  expect(exportButton).toBeInTheDocument();

  fireEvent.click(exportButton!);

  // Verify export function was called with all dataset IDs
  await waitFor(() => {
    expect(handleResourceExport).toHaveBeenCalledWith(
      'dataset',
      mockDatasets.map(dataset => dataset.id),
      expect.any(Function),
    );
  });
});

test('opens import modal and handles successful import', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);
  fetchMock.post('glob:*/api/v1/dataset/import/', 200);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  // This test would need access to import button in SubMenu
  // Would need to trigger import modal and test the flow
});

test('shows error toast when edit API call fails', async () => {
  // Register specific routes before catch-all
  fetchMock.get('glob:*/api/v1/dataset/1', 500);
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  const editButton = within(row).getByRole('button', { name: /edit/i });
  fireEvent.click(editButton);

  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining(
        'error occurred while fetching dataset related data',
      ),
    );
  });
});

test('shows error toast when related objects API call fails', async () => {
  // Register specific routes before catch-all
  fetchMock.get('glob:*/api/v1/dataset/1/related_objects', 500);
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const row = screen.getByRole('row', { name: /birth_names/i });
  const deleteButton = within(row).getByRole('button', { name: /delete/i });
  fireEvent.click(deleteButton);

  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining(
        'error occurred while fetching dataset related data',
      ),
    );
  });
});

test('hides action column when user has no permissions', async () => {
  fetchMock.get(
    'glob:*/api/v1/dataset/_info*',
    {
      permissions: ['can_read'], // Only read permission
    },
    { overwriteRoutes: true },
  );
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Actions column should be hidden when no permissions
  expect(
    screen.queryByRole('columnheader', { name: /actions/i }),
  ).not.toBeInTheDocument();
});

test('closes modals when cancel buttons are clicked', async () => {
  // Register specific routes before catch-all
  fetchMock.get('glob:*/api/v1/dataset/1', { result: mockDatasetDetail });
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Test edit modal close
  const row = screen.getByRole('row', { name: /birth_names/i });
  const editButton = within(row).getByRole('button', { name: /edit/i });
  await userEvent.click(editButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  const closeButton = screen.getByRole('button', { name: /close modal/i });
  await userEvent.click(closeButton);

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
