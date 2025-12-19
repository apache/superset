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
// eslint-disable-next-line import/no-extraneous-dependencies
import fetchMock from 'fetch-mock';
import { render, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryParamProvider } from 'use-query-params';
import DatasetList from 'src/pages/DatasetList';
import handleResourceExport from 'src/utils/export';

export const mockHandleResourceExport =
  handleResourceExport as jest.MockedFunction<typeof handleResourceExport>;

// Type definitions for test helpers
export interface UserState {
  userId: string | number;
  firstName: string;
  lastName: string;
  [key: string]: unknown; // Allow additional properties like roles
}

export interface RisonFilter {
  col: string;
  opr: string;
  value: string | number | boolean;
}

// Test-only dataset type that matches the VirtualDataset interface from index.tsx
// Includes extra/sql fields that exist in actual API responses
export interface DatasetFixture {
  id: number;
  table_name: string;
  kind: string;
  schema: string;
  database: {
    id: string;
    database_name: string;
  };
  owners: Array<{ first_name: string; last_name: string; id: number }>;
  changed_by_name: string;
  changed_by: {
    first_name: string;
    last_name: string;
    id: number;
  };
  changed_on_delta_humanized: string;
  explore_url: string;
  extra: string; // JSON-serialized metadata (always present in API)
  sql: string | null; // SQL query for virtual datasets
  description?: string; // Optional description field
}

interface StoreState {
  user?: UserState;
  common?: {
    conf?: {
      SUPERSET_WEBSERVER_TIMEOUT?: number;
      PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET?: boolean;
    };
  };
  datasets?: {
    datasetList?: typeof mockDatasets;
  };
}

interface DatasetListPropsOverrides {
  addDangerToast?: (msg: string) => void;
  addSuccessToast?: (msg: string) => void;
  user?: UserState;
}

export const mockDatasets: DatasetFixture[] = [
  {
    id: 1,
    table_name: 'public.sales_data',
    kind: 'physical',
    schema: 'public',
    database: {
      id: '1',
      database_name: 'PostgreSQL',
    },
    owners: [{ first_name: 'John', last_name: 'Doe', id: 1 }],
    changed_by_name: 'John Doe',
    changed_by: {
      first_name: 'John',
      last_name: 'Doe',
      id: 1,
    },
    changed_on_delta_humanized: '1 day ago',
    explore_url: '/explore/?datasource=1__table',
    extra: JSON.stringify({}),
    sql: null,
  },
  {
    id: 2,
    table_name: 'Analytics Query',
    kind: 'virtual',
    schema: 'analytics',
    database: {
      id: '2',
      database_name: 'MySQL',
    },
    owners: [
      { first_name: 'Jane', last_name: 'Smith', id: 2 },
      { first_name: 'Bob', last_name: 'Jones', id: 3 },
    ],
    changed_by_name: 'Jane Smith',
    changed_by: {
      first_name: 'Jane',
      last_name: 'Smith',
      id: 2,
    },
    changed_on_delta_humanized: '2 hours ago',
    explore_url: '/explore/?datasource=2__table',
    extra: JSON.stringify({
      certification: {
        certified_by: 'Data Team',
        details: 'Approved for production use',
      },
    }),
    sql: 'SELECT * FROM analytics_table WHERE date >= current_date - 30',
  },
  {
    id: 3,
    table_name: 'Customer Metrics',
    kind: 'virtual',
    schema: 'metrics',
    database: {
      id: '1',
      database_name: 'PostgreSQL',
    },
    owners: [],
    changed_by_name: 'System',
    changed_by: {
      first_name: 'System',
      last_name: 'User',
      id: 999,
    },
    changed_on_delta_humanized: '5 days ago',
    explore_url: '/explore/?datasource=3__table',
    extra: JSON.stringify({
      warning_markdown: 'This dataset contains PII. Handle with care.',
    }),
    sql: 'SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id',
  },
  {
    id: 4,
    table_name: 'public.product_catalog',
    kind: 'physical',
    schema: 'public',
    database: {
      id: '3',
      database_name: 'Redshift',
    },
    owners: [{ first_name: 'Alice', last_name: 'Johnson', id: 4 }],
    changed_by_name: 'Alice Johnson',
    changed_by: {
      first_name: 'Alice',
      last_name: 'Johnson',
      id: 4,
    },
    changed_on_delta_humanized: '3 weeks ago',
    explore_url: '/explore/?datasource=4__table',
    extra: JSON.stringify({
      certification: {
        certified_by: 'QA Team',
        details: 'Verified data quality',
      },
      warning_markdown: 'Data refreshed weekly on Sundays',
    }),
    sql: null,
  },
  {
    id: 5,
    table_name: 'Quarterly Report',
    kind: 'virtual',
    schema: 'reports',
    database: {
      id: '2',
      database_name: 'MySQL',
    },
    owners: [
      { first_name: 'Charlie', last_name: 'Brown', id: 5 },
      { first_name: 'David', last_name: 'Lee', id: 6 },
      { first_name: 'Eve', last_name: 'Taylor', id: 7 },
      { first_name: 'Frank', last_name: 'Wilson', id: 8 },
    ],
    changed_by_name: 'Charlie Brown',
    changed_by: {
      first_name: 'Charlie',
      last_name: 'Brown',
      id: 5,
    },
    changed_on_delta_humanized: '1 month ago',
    explore_url: '/explore/?datasource=5__table',
    extra: JSON.stringify({}),
    sql: 'SELECT quarter, SUM(revenue) FROM sales GROUP BY quarter',
  },
];

// Mock users with various permission levels
export const mockAdminUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_read', 'Dataset'],
      ['can_write', 'Dataset'],
      ['can_export', 'Dataset'],
      ['can_duplicate', 'Dataset'],
    ],
  },
};

export const mockOwnerUser = {
  userId: 1,
  firstName: 'John',
  lastName: 'Doe',
  roles: {
    Alpha: [
      ['can_read', 'Dataset'],
      ['can_write', 'Dataset'],
      ['can_export', 'Dataset'],
      ['can_duplicate', 'Dataset'],
    ],
  },
};

export const mockReadOnlyUser = {
  userId: 10,
  firstName: 'Read',
  lastName: 'Only',
  roles: {
    Gamma: [['can_read', 'Dataset']],
  },
};

export const mockExportOnlyUser = {
  userId: 11,
  firstName: 'Export',
  lastName: 'User',
  roles: {
    Gamma: [
      ['can_read', 'Dataset'],
      ['can_export', 'Dataset'],
    ],
  },
};

export const mockWriteUser = {
  userId: 9,
  firstName: 'Write',
  lastName: 'User',
  roles: {
    Alpha: [
      ['can_read', 'Dataset'],
      ['can_write', 'Dataset'],
      ['can_export', 'Dataset'],
    ],
  },
};

// Mock related objects for delete modal
export const mockRelatedCharts = {
  count: 3,
  result: [
    { id: 101, slice_name: 'Sales Chart' },
    { id: 102, slice_name: 'Revenue Chart' },
    { id: 103, slice_name: 'Analytics Chart' },
  ],
};

export const mockRelatedDashboards = {
  count: 2,
  result: [
    { id: 201, title: 'Executive Dashboard' },
    { id: 202, title: 'Sales Dashboard' },
  ],
};

// Mock API error responses
export const mockApiError500 = {
  status: 500,
  body: { message: 'Internal Server Error' },
};

export const mockApiError403 = {
  status: 403,
  body: { message: 'Forbidden' },
};

export const mockApiError404 = {
  status: 404,
  body: { message: 'Not Found' },
};

// API endpoint constants
export const API_ENDPOINTS = {
  DATASETS_INFO: 'glob:*/api/v1/dataset/_info*',
  DATASETS: 'glob:*/api/v1/dataset/?*',
  DATASET_GET: 'glob:*/api/v1/dataset/[0-9]*',
  DATASET_RELATED_OBJECTS: 'glob:*/api/v1/dataset/*/related_objects*',
  DATASET_DELETE: 'glob:*/api/v1/dataset/[0-9]*',
  DATASET_BULK_DELETE: 'glob:*/api/v1/dataset/?q=*', // Matches DELETE /api/v1/dataset/?q=...
  DATASET_DUPLICATE: 'glob:*/api/v1/dataset/duplicate*',
  DATASET_FAVORITE_STATUS: 'glob:*/api/v1/dataset/favorite_status*',
  DATASET_RELATED_DATABASE: 'glob:*/api/v1/dataset/related/database*',
  DATASET_RELATED_SCHEMA: 'glob:*/api/v1/dataset/distinct/schema*',
  DATASET_RELATED_OWNERS: 'glob:*/api/v1/dataset/related/owners*',
  DATASET_RELATED_CHANGED_BY: 'glob:*/api/v1/dataset/related/changed_by*',
};

// Setup API permissions mock (for permission-based testing)
export const setupApiPermissions = (permissions: string[]) => {
  fetchMock.get(
    API_ENDPOINTS.DATASETS_INFO,
    { permissions },
    { overwriteRoutes: true },
  );
};

// Store utilities
export const createMockStore = (initialState: Partial<StoreState> = {}) =>
  configureStore({
    reducer: {
      user: (state = initialState.user || {}) => state,
      common: (state = initialState.common || {}) => state,
      datasets: (state = initialState.datasets || {}) => state,
    },
    preloadedState: initialState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });

export const createDefaultStoreState = (user: UserState): StoreState => ({
  user,
  common: {
    conf: {
      SUPERSET_WEBSERVER_TIMEOUT: 60000,
      PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET: false,
    },
  },
  datasets: {
    datasetList: mockDatasets,
  },
});

export const renderDatasetList = (
  user: UserState,
  props: Partial<DatasetListPropsOverrides> = {},
  storeState: Partial<StoreState> = {},
) => {
  const defaultStoreState = createDefaultStoreState(user);
  const storeStateWithUser = {
    ...defaultStoreState,
    user,
    ...storeState,
  };

  const store = createMockStore(storeStateWithUser);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <QueryParamProvider>
          <DatasetList user={user} {...props} />
        </QueryParamProvider>
      </MemoryRouter>
    </Provider>,
  );
};

/**
 * Helper to wait for the DatasetList page to be ready
 * Waits for the "Datasets" heading to appear, indicating initial render is complete
 */
export const waitForDatasetsPageReady = async () => {
  await screen.findByText('Datasets');
};

// Helper functions for specific operations
export const setupDeleteMocks = (datasetId: number) => {
  fetchMock.get(
    `glob:*/api/v1/dataset/${datasetId}/related_objects*`,
    {
      charts: mockRelatedCharts,
      dashboards: mockRelatedDashboards,
    },
    { overwriteRoutes: true },
  );

  fetchMock.delete(
    `glob:*/api/v1/dataset/${datasetId}`,
    { message: 'Dataset deleted successfully' },
    { overwriteRoutes: true },
  );
};

export const setupDuplicateMocks = () => {
  fetchMock.post(
    API_ENDPOINTS.DATASET_DUPLICATE,
    { id: 999, table_name: 'Copy of Dataset' },
    { overwriteRoutes: true },
  );
};

export const setupBulkDeleteMocks = () => {
  fetchMock.delete(
    API_ENDPOINTS.DATASET_BULK_DELETE,
    { message: '3 datasets deleted successfully' },
    { overwriteRoutes: true },
  );
};

// Setup error mocks for negative flow testing
export const setupDeleteErrorMocks = (
  datasetId: number,
  statusCode: number,
) => {
  fetchMock.get(
    `glob:*/api/v1/dataset/${datasetId}/related_objects*`,
    {
      status: statusCode,
      body: { message: 'Failed to fetch related objects' },
    },
    { overwriteRoutes: true },
  );
};

export const setupDuplicateErrorMocks = (statusCode: number) => {
  fetchMock.post(
    API_ENDPOINTS.DATASET_DUPLICATE,
    {
      status: statusCode,
      body: { message: 'Failed to duplicate dataset' },
    },
    { overwriteRoutes: true },
  );
};

/**
 * Helper function to verify only expected API calls were made
 * Replaces global fail-fast fetchMock.catch() with test-specific assertions
 *
 * @param expectedEndpoints - Array of endpoint glob patterns that should have been called
 * @throws If any unmocked endpoints were called or expected endpoints weren't called
 */
export const assertOnlyExpectedCalls = (expectedEndpoints: string[]) => {
  const allCalls = fetchMock.calls(true); // Get all calls including unmatched
  const unmatchedCalls = allCalls.filter(call => call.isUnmatched);

  if (unmatchedCalls.length > 0) {
    const unmatchedUrls = unmatchedCalls.map(call => call[0]);
    throw new Error(
      `Unmocked endpoints called: ${unmatchedUrls.join(', ')}. ` +
        'Add explicit mocks in setupMocks() or test setup.',
    );
  }

  // Verify expected endpoints were called
  expectedEndpoints.forEach(endpoint => {
    const calls = fetchMock.calls(endpoint);
    if (calls.length === 0) {
      throw new Error(
        `Expected endpoint not called: ${endpoint}. ` +
          'Check if component logic changed or mock is incorrectly configured.',
      );
    }
  });
};

// MSW setup using fetch-mock (following ChartList pattern)
export const setupMocks = () => {
  fetchMock.reset();

  fetchMock.get(API_ENDPOINTS.DATASETS_INFO, {
    permissions: ['can_read', 'can_write', 'can_export', 'can_duplicate'],
  });

  fetchMock.get(API_ENDPOINTS.DATASETS, {
    result: mockDatasets,
    count: mockDatasets.length,
  });

  fetchMock.get(API_ENDPOINTS.DATASET_FAVORITE_STATUS, {
    result: [],
  });

  fetchMock.get(API_ENDPOINTS.DATASET_RELATED_DATABASE, {
    result: [
      { value: 1, text: 'PostgreSQL' },
      { value: 2, text: 'MySQL' },
      { value: 3, text: 'Redshift' },
    ],
    count: 3,
  });

  fetchMock.get(API_ENDPOINTS.DATASET_RELATED_SCHEMA, {
    result: [
      { value: 'public', text: 'public' },
      { value: 'analytics', text: 'analytics' },
      { value: 'metrics', text: 'metrics' },
      { value: 'reports', text: 'reports' },
    ],
    count: 4,
  });

  fetchMock.get(API_ENDPOINTS.DATASET_RELATED_OWNERS, {
    result: [],
    count: 0,
  });

  fetchMock.get(API_ENDPOINTS.DATASET_RELATED_CHANGED_BY, {
    result: [],
    count: 0,
  });
};
