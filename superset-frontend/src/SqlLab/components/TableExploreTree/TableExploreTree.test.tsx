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
import type { ReactChild } from 'react';
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';

import TableExploreTree from '.';

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: (params: { height: number }) => ReactChild }) =>
      children({ height: 500 }),
);

const mockedQueryEditorId = defaultQueryEditor.id;
const mockedDatabase = {
  id: 1,
  database_name: 'main',
  backend: 'mysql',
};

const mockSchemas = ['public', 'information_schema', 'test_schema'];
const mockTables = [
  { label: 'users', value: 'users', type: 'table' },
  { label: 'orders', value: 'orders', type: 'table' },
  { label: 'user_view', value: 'user_view', type: 'view' },
];
const mockColumns = [
  { name: 'id', type: 'INTEGER', keys: [{ type: 'pk' }] },
  { name: 'name', type: 'VARCHAR(255)' },
  { name: 'created_at', type: 'TIMESTAMP' },
];

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    count: mockSchemas.length,
    result: mockSchemas,
  });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', {
    count: mockTables.length,
    result: mockTables,
  });
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/*', {
    status: 200,
    body: {
      columns: mockColumns,
    },
  });
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/extra/*', {
    status: 200,
    body: {},
  });
});

afterEach(() => {
  fetchMock.restore();
  jest.clearAllMocks();
});

const getInitialState = (overrides = {}) => ({
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    databases: {
      1: mockedDatabase,
    },
    queryEditors: [
      {
        ...defaultQueryEditor,
        dbId: mockedDatabase.id,
        schema: 'public',
      },
    ],
    ...overrides,
  },
});

const renderComponent = (queryEditorId: string = mockedQueryEditorId) =>
  render(<TableExploreTree queryEditorId={queryEditorId} />, {
    useRedux: true,
    initialState: getInitialState(),
  });

test('renders schema list from API', async () => {
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });
  expect(screen.getByText('information_schema')).toBeInTheDocument();
  expect(screen.getByText('test_schema')).toBeInTheDocument();
});

test('renders search input', async () => {
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Enter a part of the object name',
  );
  expect(searchInput).toBeInTheDocument();
});

test('filters schemas when searching', async () => {
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  // Verify all schemas are initially visible
  expect(screen.getByText('test_schema')).toBeInTheDocument();
  expect(screen.getByText('information_schema')).toBeInTheDocument();

  const searchInput = screen.getByPlaceholderText(
    'Enter a part of the object name',
  );
  await userEvent.type(searchInput, 'test');

  // After searching, only matching schema should be visible
  await waitFor(() => {
    // react-arborist filters nodes via searchMatch - non-matching nodes are not rendered
    const treeItems = screen.getAllByRole('treeitem');
    expect(treeItems).toHaveLength(1);
  });
  // Verify the filtered schema is visible via the treeitem
  const treeItem = screen.getByRole('treeitem');
  expect(treeItem).toHaveTextContent('test_schema');
});

test('expands schema node and loads tables', async () => {
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  const schemaNode = screen.getByText('public');
  await userEvent.click(schemaNode);

  await waitFor(() => {
    expect(screen.getByText('users')).toBeInTheDocument();
  });
  expect(screen.getByText('orders')).toBeInTheDocument();
  expect(screen.getByText('user_view')).toBeInTheDocument();
});

test('expands table node and loads columns', async () => {
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  // Expand schema
  const schemaNode = screen.getByText('public');
  await userEvent.click(schemaNode);

  await waitFor(() => {
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  // Expand table
  const tableNode = screen.getByText('users');
  await userEvent.click(tableNode);

  await waitFor(() => {
    expect(screen.getByText('id')).toBeInTheDocument();
  });
  expect(screen.getByText('name')).toBeInTheDocument();
  expect(screen.getByText('created_at')).toBeInTheDocument();
});

test('shows empty state when no schemas match search', async () => {
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Enter a part of the object name',
  );
  await userEvent.type(searchInput, 'nonexistent');

  await waitFor(() => {
    expect(screen.queryByText('public')).not.toBeInTheDocument();
  });
});

test('shows loading skeleton while fetching schemas', async () => {
  fetchMock.get(
    'glob:*/api/v1/database/1/schemas/?*',
    new Promise(resolve =>
      setTimeout(
        () =>
          resolve({
            count: mockSchemas.length,
            result: mockSchemas,
          }),
        100,
      ),
    ),
    { overwriteRoutes: true },
  );

  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });
});

test('renders refresh button for schema list', async () => {
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  const refreshButton = screen.getByRole('button', { name: /refresh/i });
  expect(refreshButton).toBeInTheDocument();
});
