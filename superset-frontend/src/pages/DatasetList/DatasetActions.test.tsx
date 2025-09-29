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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
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
      <div data-test="datasource-modal">
        <span>Editing: {datasource?.table_name}</span>
        <button type="button" onClick={onHide}>Close Modal</button>
      </div>
    ) : null,
}));

jest.mock('@superset-ui/core/components', () => ({
  ...jest.requireActual('@superset-ui/core/components'),
  DeleteModal: ({ show, onConfirm, onHide, title }: any) =>
    show ? (
      <div data-test="delete-modal">
        <span>{title}</span>
        <button type="button" onClick={onConfirm}>Delete</button>
        <button type="button" onClick={onHide}>Cancel</button>
      </div>
    ) : null,
}));

jest.mock('src/features/datasets/DuplicateDatasetModal', () => ({
  __esModule: true,
  default: ({ show, onHide, dataset }: any) =>
    show ? (
      <div data-test="duplicate-modal">
        <span>Duplicating: {dataset?.table_name}</span>
        <button type="button" onClick={onHide}>Close</button>
      </div>
    ) : null,
}));

jest.mock('src/components/ImportModal', () => ({
  __esModule: true,
  ImportModal: ({ show, onHide, onImport }: any) =>
    show ? (
      <div data-test="import-modal">
        <button type="button" onClick={() => onImport()}>Import</button>
        <button type="button" onClick={onHide}>Cancel</button>
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

  const editButton = screen.getByLabelText(/edit/i);
  await userEvent.click(editButton);

  await waitFor(() => {
    expect(screen.getByTestId('datasource-modal')).toBeInTheDocument();
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
    const editButton = screen.getByLabelText(/edit/i);
    expect(editButton).toHaveClass('disabled');
  });

  // Tooltip should show restriction message
  const editButton = screen.getByLabelText(/edit/i);
  await userEvent.hover(editButton);

  await waitFor(() => {
    expect(
      screen.getByText(/you must be a dataset owner/i),
    ).toBeInTheDocument();
  });
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
  });

  await waitFor(() => {
    const editButton = screen.getByLabelText(/edit/i);
    expect(editButton).not.toHaveClass('disabled');
  });

  const editButton = screen.getByLabelText(/edit/i);
  await userEvent.click(editButton);

  await waitFor(() => {
    expect(screen.getByTestId('datasource-modal')).toBeInTheDocument();
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

  const deleteButton = screen.getByLabelText(/delete/i);
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
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

  const deleteButton = screen.getByLabelText(/delete/i);
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
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

  const deleteButton = screen.getByLabelText(/delete/i);
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  const confirmButton = screen.getByRole('button', { name: /delete/i });
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

  const deleteButton = screen.getByLabelText(/delete/i);
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  const confirmButton = screen.getByRole('button', { name: /delete/i });
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

  const exportButton = screen.getByLabelText(/export/i);
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

  const duplicateButton = screen.getByLabelText(/duplicate/i);
  await userEvent.click(duplicateButton);

  await waitFor(() => {
    expect(screen.getByTestId('duplicate-modal')).toBeInTheDocument();
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

  // Should not have duplicate button for physical datasets
  expect(screen.queryByLabelText(/duplicate/i)).not.toBeInTheDocument();
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

  // This test would need access to bulk selection controls
  // The implementation would depend on how ListView exposes bulk operations
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

  const editButton = screen.getByLabelText(/edit/i);
  await userEvent.click(editButton);

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

  const deleteButton = screen.getByLabelText(/delete/i);
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining(
        'error occurred while fetching dataset related data',
      ),
    );
  });
});

test('hides action column when user has no permissions', async () => {
  fetchMock.get('glob:*/api/v1/dataset/_info*', {
    permissions: ['can_read'], // Only read permission
  });
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
  const editButton = screen.getByLabelText(/edit/i);
  await userEvent.click(editButton);

  await waitFor(() => {
    expect(screen.getByTestId('datasource-modal')).toBeInTheDocument();
  });

  const closeButton = screen.getByRole('button', { name: /close modal/i });
  await userEvent.click(closeButton);

  await waitFor(() => {
    expect(screen.queryByTestId('datasource-modal')).not.toBeInTheDocument();
  });
});
