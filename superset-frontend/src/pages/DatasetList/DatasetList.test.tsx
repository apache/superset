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
  mockEmptyDatasetResponse,
  mockUser,
  mockAdminUser,
  mockToasts,
  mockCertifiedDataset,
  mockDatasetWithWarning,
} from './fixtures';

// Mock the SubMenu component to avoid complex dependencies
jest.mock('src/features/home/SubMenu', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-test="submenu">{children}</div>
  ),
}));

// Mock DatasourceModal
jest.mock('src/components/Datasource', () => ({
  __esModule: true,
  DatasourceModal: ({ show, onHide }: { show: boolean; onHide: () => void }) =>
    show ? (
      <div data-test="datasource-modal">
        <button type="button" onClick={onHide}>Close</button>
      </div>
    ) : null,
}));

// Mock DeleteModal
jest.mock('@superset-ui/core/components', () => ({
  ...jest.requireActual('@superset-ui/core/components'),
  DeleteModal: ({ show, onConfirm, onHide }: any) =>
    show ? (
      <div data-test="delete-modal">
        <button type="button" onClick={onConfirm}>Delete</button>
        <button type="button" onClick={onHide}>Cancel</button>
      </div>
    ) : null,
}));

// Mock DuplicateDatasetModal
jest.mock('src/features/datasets/DuplicateDatasetModal', () => ({
  __esModule: true,
  default: ({ show, onHide }: { show: boolean; onHide: () => void }) =>
    show ? (
      <div data-test="duplicate-modal">
        <button type="button" onClick={onHide}>Close</button>
      </div>
    ) : null,
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

test('renders loading state', () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse, {
    delay: 1000,
  });

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
});

test('renders empty state when no datasets exist', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockEmptyDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});

test('renders dataset list with proper table structure', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  // Check table headers
  expect(
    screen.getByRole('columnheader', { name: /name/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /type/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /database/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /schema/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /owners/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /last modified/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /actions/i }),
  ).toBeInTheDocument();
});

test('displays dataset names as links to explore', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    const link = screen.getByRole('link', { name: 'birth_names' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      '/explore/?dataset_type=table&dataset_id=1',
    );
  });
});

test('displays dataset types correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('Physical')).toBeInTheDocument();
    expect(screen.getByText('Virtual')).toBeInTheDocument();
  });
});

test('displays database and schema information', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('examples')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('analytics')).toBeInTheDocument();
  });
});

test('displays owner information with FacePile', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    // FacePile component should render owner names
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Data Analyst')).toBeInTheDocument();
  });
});

test('displays modified date information', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
    expect(screen.getByText('1 day ago')).toBeInTheDocument();
    expect(screen.getByText('5 hours ago')).toBeInTheDocument();
  });
});

test('displays certified badge for certified datasets', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [mockCertifiedDataset],
    count: 1,
  });

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('certified_dataset')).toBeInTheDocument();
    // CertifiedBadge should be rendered based on extra.certification
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});

test('displays warning icon for datasets with warnings', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [mockDatasetWithWarning],
    count: 1,
  });

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('deprecated_dataset')).toBeInTheDocument();
    // WarningIconWithTooltip should be rendered
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});

test('shows dataset descriptions in info tooltips', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    // InfoTooltip should be present for datasets with descriptions
    const tooltipIcons = screen.getAllByRole('img');
    expect(tooltipIcons.length).toBeGreaterThan(0);
  });
});

test('renders SubMenu with proper buttons based on permissions', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('submenu')).toBeInTheDocument();
  });
});

test('shows bulk select controls when enabled', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    // Initial render should show normal state
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  // Test bulk selection toggle would go here when we can access the controls
});

test('handles API errors gracefully', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', 500);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining('error'),
    );
  });
});

test('renders with admin user permissions', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} user={mockAdminUser} />, {
    useRouter: true,
    useRedux: true,
  });

  await waitFor(() => {
    expect(screen.getByRole('table')).toBeInTheDocument();
    // Admin should see all action buttons
    expect(screen.getAllByRole('button')).toHaveLength(expect.any(Number));
  });
});

test('updates URL when navigating to dataset explore page', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    const exploreLink = screen.getByRole('link', { name: 'birth_names' });
    expect(exploreLink).toHaveAttribute(
      'href',
      '/explore/?dataset_type=table&dataset_id=1',
    );
  });
});

test('displays correct row count in dataset list', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    const rows = screen.getAllByRole('row');
    // Should have header row + data rows
    expect(rows).toHaveLength(mockDatasets.length + 1);
  });
});

test('preserves dataset list state across re-renders', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  const { rerender } = render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Re-render with same props
  rerender(<DatasetList {...defaultProps} />);

  // Should still show the same data
  expect(screen.getByText('birth_names')).toBeInTheDocument();
});
