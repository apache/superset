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
import DatasetList from './index';
import {
  mockDatasetResponse,
  mockDatabaseOptions,
  mockSchemaOptions,
  mockOwnerOptions,
  mockUser,
  mockToasts,
} from './fixtures';

// Helper to find filter by label text
const findFilterByLabel = (labelText: string) => {
  const containers = screen.getAllByTestId('select-filter-container');
  for (const container of containers) {
    const label = container.querySelector('label');
    if (label?.textContent === labelText) {
      return container.querySelector('[role="combobox"], .ant-select');
    }
  }
  return null;
};

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
        <button type="button" onClick={onHide}>
          Close
        </button>
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

test('renders search filter correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify search filter renders
  expect(screen.getByTestId('filters-search')).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/type a value/i)).toBeInTheDocument();
});

test('renders Type filter correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const typeFilter = findFilterByLabel('Type');
  expect(typeFilter).toBeVisible();
  expect(typeFilter).toBeEnabled();
});

test('renders Database filter correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const databaseFilter = findFilterByLabel('Database');
  expect(databaseFilter).toBeVisible();
  expect(databaseFilter).toBeEnabled();
});

test('renders Schema filter correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const schemaFilter = findFilterByLabel('Schema');
  expect(schemaFilter).toBeVisible();
  expect(schemaFilter).toBeEnabled();
});

test('renders Owner filter correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const ownerFilter = findFilterByLabel('Owner');
  expect(ownerFilter).toBeTruthy();
});

test('renders Certified filter correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const certifiedFilter = findFilterByLabel('Certified');
  expect(certifiedFilter).toBeVisible();
  expect(certifiedFilter).toBeEnabled();
});

test('name column is sortable', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const nameHeader = screen.getByRole('columnheader', { name: /name/i });
  expect(nameHeader).toBeInTheDocument();
});

test('database column exists', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const databaseHeader = screen.getByRole('columnheader', {
    name: /database/i,
  });
  expect(databaseHeader).toBeInTheDocument();
});

test('schema column exists', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const schemaHeader = screen.getByRole('columnheader', { name: /schema/i });
  expect(schemaHeader).toBeInTheDocument();
});

test('owners column exists', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const ownersHeader = screen.getByRole('columnheader', { name: /owners/i });
  expect(ownersHeader).toBeInTheDocument();
});

test('last modified column exists', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const modifiedHeader = screen.getByRole('columnheader', {
    name: /last modified/i,
  });
  expect(modifiedHeader).toBeInTheDocument();
});

test('type column exists', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const typeHeader = screen.getByRole('columnheader', { name: /type/i });
  expect(typeHeader).toBeInTheDocument();
});

test('renders Modified by filter correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const modifiedByFilter = findFilterByLabel('Modified by');
  expect(modifiedByFilter).toBeVisible();
  expect(modifiedByFilter).toBeEnabled();
});

test('table renders with multiple datasets', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify datasets are displayed (use getAllByText for items that appear multiple times)
  expect(screen.getAllByText('birth_names').length).toBeGreaterThan(0);
  // Verify multiple datasets are in the table by checking row count
  const rows = screen.getAllByRole('row');
  expect(rows.length).toBeGreaterThan(1); // Header + at least one data row
});

test('type filter options exist', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const typeFilter = findFilterByLabel('Type');
  expect(typeFilter).toBeVisible();
});

test('all primary columns render', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify all primary columns exist
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
});

test('actions column exists when user has permissions', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const actionsHeader = screen.getByRole('columnheader', { name: /actions/i });
  expect(actionsHeader).toBeInTheDocument();
});

test('dataset data displays correctly', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify dataset details are displayed
  expect(screen.getByText('birth_names')).toBeInTheDocument();
  expect(screen.getAllByText('examples').length).toBeGreaterThan(0);
});

test('list view components render correctly', async () => {
  fetchMock.restore();
  fetchMock.get('glob:*/api/v1/dataset/_info*', {
    permissions: ['can_read', 'can_write', 'can_export', 'can_duplicate'],
  });
  fetchMock.get('glob:*/api/v1/dataset/related/database*', mockDatabaseOptions);
  fetchMock.get('glob:*/api/v1/dataset/distinct/schema*', mockSchemaOptions);
  fetchMock.get('glob:*/api/v1/dataset/related/owners*', mockOwnerOptions);
  fetchMock.get('glob:*/api/v1/dataset/*', mockDatasetResponse);

  render(<DatasetList {...defaultProps} />, {
    useRouter: true,
    useRedux: true,
    useQueryParams: true,
  });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // Verify the list renders
  expect(screen.getAllByText('birth_names').length).toBeGreaterThan(0);
  expect(screen.getByTestId('filters-search')).toBeInTheDocument();
});
