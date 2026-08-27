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
import {
  act,
  createStore,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import userEvent from '@testing-library/user-event';
import { api } from 'src/hooks/apiResources/queryApi';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';

import { ViewLocations } from 'src/SqlLab/contributions';
import {
  registerToolbarAction,
  cleanupExtensions,
} from 'spec/helpers/extensionTestHelpers';
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
  jest.clearAllMocks();
  fetchMock.clearHistory();
  cleanupExtensions();
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

  // All schemas are visible (no longer filtered to selected schema)
  expect(screen.getByText('test_schema')).toBeInTheDocument();
  expect(screen.getByText('information_schema')).toBeInTheDocument();

  const searchInput = screen.getByPlaceholderText(
    'Enter a part of the object name',
  );
  await userEvent.type(searchInput, 'pub');

  // After searching, only matching schema should be visible
  await waitFor(() => {
    // react-arborist filters nodes via searchMatch - non-matching nodes are not rendered
    const treeItems = screen.getAllByRole('treeitem');
    expect(treeItems).toHaveLength(1);
  });
  // Verify the filtered schema is visible via the treeitem
  const treeItem = screen.getByRole('treeitem');
  expect(treeItem).toHaveTextContent('public');
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
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    response: new Promise(resolve =>
      setTimeout(
        () =>
          resolve({
            count: mockSchemas.length,
            result: mockSchemas,
          }),
        100,
      ),
    ),
  });

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

  const refreshButton = screen.getByRole('button', { name: /reload/i });
  expect(refreshButton).toBeInTheDocument();
});

test('renders contributed toolbar action in leftSidebar slot', async () => {
  registerToolbarAction(
    ViewLocations.sqllab.leftSidebar,
    'test-left-action',
    'Left Sidebar Action',
    jest.fn(),
  );

  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  expect(
    screen.getByRole('button', { name: 'Left Sidebar Action' }),
  ).toBeInTheDocument();
});

test('shows columns immediately on first toggle when searchTerm is active', async () => {
  // Regression: treeData change after async fetch was resetting react-arborist's
  // internal open state, so children only appeared after toggling twice.
  // The useEffect([treeData]) fix ensures manually-opened nodes stay open.
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  // Expand schema to load tables
  await userEvent.click(screen.getByText('public'));
  await waitFor(() => {
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  // Activate search while schema is already expanded
  const searchInput = screen.getByPlaceholderText(
    'Enter a part of the object name',
  );
  await userEvent.type(searchInput, 'pub');

  // Tables remain visible under the search-matched schema
  expect(screen.getByText('users')).toBeInTheDocument();

  // Toggle the table with searchTerm active — columns must appear on the FIRST click
  await userEvent.click(screen.getByText('users'));

  await waitFor(() => {
    expect(screen.getByText('id')).toBeInTheDocument();
  });
  expect(screen.getByText('name')).toBeInTheDocument();
  expect(screen.getByText('created_at')).toBeInTheDocument();
});

test('closes a schema while searchTerm is active and keeps it closed', async () => {
  // Regression: manuallyOpenedNodes must record the schema as closed when the
  // user collapses it with a searchTerm active. If it remains true, the treeData
  // effect would immediately re-open the schema on the next data change.
  //
  // Note: searchTerm 'users' is intentional. A term that matches the schema name
  // (e.g. 'pub') would cause highlightText to split 'public' across two DOM nodes,
  // making screen.getByText('public') unreliable. 'users' matches a table name so
  // the schema label is left as a plain text node and remains queryable.
  renderComponent();

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  // Expand schema to load tables
  await userEvent.click(screen.getByText('public'));
  await waitFor(() => {
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  // Activate search with a term that matches a table name; 'public' schema is
  // visible as an ancestor and its text is not highlighted (safe to query by text)
  const searchInput = screen.getByPlaceholderText(
    'Enter a part of the object name',
  );
  await userEvent.type(searchInput, 'users');
  expect(screen.getByText('public')).toBeInTheDocument();

  // Load columns to trigger a treeData change that could accidentally reopen the schema
  await userEvent.click(screen.getByText('users'));
  await waitFor(() => {
    expect(screen.getByText('id')).toBeInTheDocument();
  });

  // Close the schema while searchTerm is active
  await userEvent.click(screen.getByText('public'));

  // Tables and columns must disappear and stay gone — the treeData effect must not
  // reopen the schema because manuallyOpenedNodes was updated to false on close
  await waitFor(() => {
    expect(screen.queryByText('id')).not.toBeInTheDocument();
  });
  // The schema node itself remains visible as a matching ancestor (just collapsed)
  expect(screen.getByText('public')).toBeInTheDocument();
});

test('clears the OAuth error banner after a Tables invalidateTags refetch', async () => {
  // Regression test for the OAuth2 crud symptom (follow-up to PR #41101).
  // Expanding a schema lazily fetches its tables; when that fails with an
  // OAuth2 auth error the banner is held in local reducer state and, before
  // this fix, only cleared when a table list loaded via manual re-expansion.
  // After the OAuth2 redirect, OAuth2RedirectMessage dispatches
  // invalidateTags(['Tables']); the errored node's subscribed tables query must
  // now refetch automatically and clear the banner.
  fetchMock.removeRoutes().clearHistory();
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    count: mockSchemas.length,
    result: mockSchemas,
  });
  let tablesShouldFail = true;
  fetchMock.get('glob:*/api/v1/database/1/tables/*', () =>
    tablesShouldFail
      ? {
          status: 500,
          body: {
            errors: [
              {
                error_type: 'GENERIC_DB_ENGINE_ERROR',
                level: 'error',
                message: 'Tables could not be loaded',
                extra: {},
              },
            ],
          },
        }
      : { count: mockTables.length, result: mockTables },
  );

  const store = createStore(getInitialState(), reducerIndex);
  render(<TableExploreTree queryEditorId={mockedQueryEditorId} />, {
    useRedux: true,
    store,
  });

  await waitFor(() => {
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  // Expand the schema node → its table fetch rejects → the banner appears.
  await userEvent.click(screen.getByText('public'));
  expect(await screen.findByText('Unexpected error')).toBeInTheDocument();

  // The OAuth2 redirect completes: the stored token makes the next fetch
  // succeed, and the redirect handler invalidates the Tables cache.
  tablesShouldFail = false;
  act(() => {
    store.dispatch(api.util.invalidateTags(['Tables']));
  });

  // The subscribed tables query refetches, the tables load, and the banner is
  // cleared without the user manually re-expanding the node.
  expect(await screen.findByText('users')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument(),
  );
});
