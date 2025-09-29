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
  mockDatabaseOptions,
  mockSchemaOptions,
  mockOwnerOptions,
  mockUser,
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
  DatasourceModal: ({ show, onHide }: { show: boolean; onHide: () => void }) =>
    show ? (
      <div data-test="datasource-modal">
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
  fetchMock.get('glob:*/api/v1/dataset/related/database*', mockDatabaseOptions);
  fetchMock.get('glob:*/api/v1/dataset/distinct/schema*', mockSchemaOptions);
  fetchMock.get('glob:*/api/v1/dataset/related/owners*', mockOwnerOptions);
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

test('searches datasets by name', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Find and use search input
  const searchInput = screen.getByPlaceholderText(/search/i);
  await userEvent.type(searchInput, 'birth');

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('filters');
    expect(lastCall).toContain('table_name');
    expect(lastCall).toContain('birth');
  });
});

test('filters datasets by type (Virtual/Physical)', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Open filter dropdown
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  // Select Virtual type filter
  const typeFilter = screen.getByLabelText(/type/i);
  await userEvent.click(typeFilter);

  const virtualOption = screen.getByText('Virtual');
  await userEvent.click(virtualOption);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('filters');
    expect(lastCall).toContain('sql');
    expect(lastCall).toContain('false'); // Virtual datasets have sql
  });
});

test('filters datasets by database', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Open filter dropdown
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  // Select database filter
  const databaseFilter = screen.getByLabelText(/database/i);
  await userEvent.click(databaseFilter);

  // Wait for database options to load
  await waitFor(() => {
    expect(screen.getByText('examples')).toBeInTheDocument();
  });

  const examplesOption = screen.getByText('examples');
  await userEvent.click(examplesOption);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('filters');
    expect(lastCall).toContain('database');
    expect(lastCall).toContain('1'); // Database ID
  });
});

test('filters datasets by schema', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Open filter dropdown
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  // Select schema filter
  const schemaFilter = screen.getByLabelText(/schema/i);
  await userEvent.click(schemaFilter);

  // Wait for schema options to load
  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  const publicOption = screen.getByText('public');
  await userEvent.click(publicOption);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('filters');
    expect(lastCall).toContain('schema');
    expect(lastCall).toContain('public');
  });
});

test('filters datasets by owner', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Open filter dropdown
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  // Select owner filter
  const ownerFilter = screen.getByLabelText(/owner/i);
  await userEvent.click(ownerFilter);

  // Wait for owner options to load
  await waitFor(() => {
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  const adminOption = screen.getByText('Admin User');
  await userEvent.click(adminOption);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('filters');
    expect(lastCall).toContain('owners');
    expect(lastCall).toContain('1'); // Owner ID
  });
});

test('filters datasets by certification status', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Open filter dropdown
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  // Select certified filter
  const certifiedFilter = screen.getByLabelText(/certified/i);
  await userEvent.click(certifiedFilter);

  const certifiedOption = screen.getByText('Yes');
  await userEvent.click(certifiedOption);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('filters');
    expect(lastCall).toContain('certified');
  });
});

test('sorts datasets by name ascending', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const nameHeader = screen.getByRole('columnheader', { name: /name/i });
  await userEvent.click(nameHeader);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('order_column=table_name');
    expect(lastCall).toContain('order_direction=asc');
  });
});

test('sorts datasets by name descending on second click', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const nameHeader = screen.getByRole('columnheader', { name: /name/i });

  // Click once for ascending
  await userEvent.click(nameHeader);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('order_direction=asc');
  });

  // Click again for descending
  await userEvent.click(nameHeader);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('order_column=table_name');
    expect(lastCall).toContain('order_direction=desc');
  });
});

test('sorts datasets by database name', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const databaseHeader = screen.getByRole('columnheader', {
    name: /database/i,
  });
  await userEvent.click(databaseHeader);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('order_column=database.database_name');
    expect(lastCall).toContain('order_direction=asc');
  });
});

test('sorts datasets by schema', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const schemaHeader = screen.getByRole('columnheader', { name: /schema/i });
  await userEvent.click(schemaHeader);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('order_column=schema');
    expect(lastCall).toContain('order_direction=asc');
  });
});

test('sorts datasets by last modified date', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  const modifiedHeader = screen.getByRole('columnheader', {
    name: /last modified/i,
  });
  await userEvent.click(modifiedHeader);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('order_column=changed_on_delta_humanized');
    expect(lastCall).toContain('order_direction=asc');
  });
});

test('combines multiple filters correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Apply search filter
  const searchInput = screen.getByPlaceholderText(/search/i);
  await userEvent.type(searchInput, 'test');

  // Apply type filter
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  const typeFilter = screen.getByLabelText(/type/i);
  await userEvent.click(typeFilter);

  const physicalOption = screen.getByText('Physical');
  await userEvent.click(physicalOption);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('table_name');
    expect(lastCall).toContain('test');
    expect(lastCall).toContain('sql');
    expect(lastCall).toContain('true'); // Physical datasets
  });
});

test('clears individual filters', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Apply a filter first
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  const typeFilter = screen.getByLabelText(/type/i);
  await userEvent.click(typeFilter);

  const virtualOption = screen.getByText('Virtual');
  await userEvent.click(virtualOption);

  // Wait for filter to be applied
  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('sql');
  });

  // Clear the filter
  const clearFilterButton = screen.getByRole('button', { name: /clear/i });
  await userEvent.click(clearFilterButton);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).not.toContain('sql');
  });
});

test('handles pagination with filters', async () => {
  const paginatedResponse = {
    result: mockDatasets.slice(0, 2),
    count: 10, // More than current page
  };

  fetchMock.get('glob:*/api/v1/dataset/*', paginatedResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Apply a filter
  const searchInput = screen.getByPlaceholderText(/search/i);
  await userEvent.type(searchInput, 'birth');

  // Navigate to next page
  const nextPageButton = screen.getByRole('button', { name: /next/i });
  await userEvent.click(nextPageButton);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('table_name');
    expect(lastCall).toContain('birth');
    expect(lastCall).toContain('page=1'); // Second page (0-indexed)
  });
});

test('resets to first page when filter changes', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Go to second page first (if pagination exists)
  // Then apply a filter and verify we're back to page 0
  const searchInput = screen.getByPlaceholderText(/search/i);
  await userEvent.type(searchInput, 'test');

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('page=0'); // Should reset to first page
  });
});

test('preserves sort order when filters change', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Set sort order first
  const nameHeader = screen.getByRole('columnheader', { name: /name/i });
  await userEvent.click(nameHeader);

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('order_column=table_name');
  });

  // Apply a filter
  const searchInput = screen.getByPlaceholderText(/search/i);
  await userEvent.type(searchInput, 'test');

  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('table_name');
    expect(lastCall).toContain('test');
    expect(lastCall).toContain('order_column=table_name'); // Sort preserved
  });
});

test('updates URL params when filters change', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  const { container } = render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Apply search filter
  const searchInput = screen.getByPlaceholderText(/search/i);
  await userEvent.type(searchInput, 'birth');

  // URL should update with filter params
  await waitFor(() => {
    expect(window.location.search).toContain('filters');
  });
});

test('restores filters from URL params on load', async () => {
  // Mock URL with existing filter params
  const urlParams = new URLSearchParams('?filters=(table_name:birth)');
  Object.defineProperty(window, 'location', {
    value: { search: urlParams.toString() },
    writable: true,
  });

  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  // Should load with filters applied from URL
  await waitFor(() => {
    const lastCall = fetchMock.lastUrl();
    expect(lastCall).toContain('table_name');
    expect(lastCall).toContain('birth');
  });
});

test('handles filter API errors gracefully', async () => {
  fetchMock.restore();
  fetchMock.get('glob:*/api/v1/dataset/_info*', {
    permissions: ['can_read', 'can_write', 'can_export', 'can_duplicate'],
  });
  fetchMock.get('glob:*/api/v1/dataset/related/database*', 500);
  fetchMock.get('glob:*/api/v1/dataset/distinct/schema*', mockSchemaOptions);
  fetchMock.get('glob:*/api/v1/dataset/related/owners*', mockOwnerOptions);
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByText('birth_names')).toBeInTheDocument();
  });

  // Try to open database filter
  const filterButton = screen.getByRole('button', { name: /filter/i });
  await userEvent.click(filterButton);

  const databaseFilter = screen.getByLabelText(/database/i);
  await userEvent.click(databaseFilter);

  // Should handle the error gracefully
  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
      expect.stringContaining('error occurred while fetching'),
    );
  });
});
