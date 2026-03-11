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
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import SqlEditorLeftBar, {
  SqlEditorLeftBarProps,
} from 'src/SqlLab/components/SqlEditorLeftBar';
import {
  table,
  initialState,
  defaultQueryEditor,
  extraQueryEditor2,
} from 'src/SqlLab/fixtures';
import type { RootState } from 'src/views/store';
import type { Store } from 'redux';

// Mock TableExploreTree to avoid complex tree rendering in tests
jest.mock('../TableExploreTree', () => ({
  __esModule: true,
  default: () => (
    <div data-test="mock-table-explore-tree">TableExploreTree</div>
  ),
}));

// Helper to switch from default TreeView to SelectView
const switchToSelectView = async () => {
  const changeButton = screen.getByTestId('DatabaseSelector');
  // Click Change button to open database selector modal
  await userEvent.click(changeButton);

  // Verify popup is opened
  await waitFor(() => {
    expect(screen.getByText('Select Database and Schema')).toBeInTheDocument();
  });
};

const mockedProps = {
  queryEditorId: defaultQueryEditor.id,
  height: 0,
};
const mockData = {
  database: {
    id: 1,
    database_name: 'main',
    backend: 'mysql',
  },
};

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/database/?*', { result: [] });
  fetchMock.get('glob:*/api/v1/database/*/catalogs/?*', {
    count: 0,
    result: [],
  });
  fetchMock.get('glob:*/api/v1/database/3/schemas/?*', {
    error: 'Unauthorized',
  });
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    count: 2,
    result: ['main', 'db1_schema', 'db1_schema2'],
  });
  fetchMock.get('glob:*/api/v1/database/2/schemas/?*', {
    count: 2,
    result: ['main', 'new_schema'],
  });
  fetchMock.get('glob:*/api/v1/database/*/tables/*', {
    count: 2,
    result: [
      {
        label: 'ab_user',
        value: 'ab_user',
      },
      {
        label: 'new_table',
        value: 'new_table',
      },
    ],
  });
  fetchMock.get('glob:*/api/v1/database/*/table_metadata/*', {
    status: 200,
    body: {
      columns: table.columns,
    },
  });
  fetchMock.get('glob:*/api/v1/database/*/table_metadata/extra/*', {
    status: 200,
    body: {},
  });
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
});

const renderAndWait = (
  props: SqlEditorLeftBarProps,
  store?: Store,
  initialState?: RootState,
) =>
  waitFor(() =>
    render(<SqlEditorLeftBar {...props} />, {
      useRedux: true,
      initialState,
      ...(store && { store }),
    }),
  );

test('catalog selector should be visible when enabled in the database', async () => {
  const { getByRole } = await renderAndWait(mockedProps, undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: mockedProps.queryEditorId,
        dbId: mockData.database.id,
      },
      tables: [table],
      databases: {
        [mockData.database.id]: {
          ...mockData.database,
          allow_multi_catalog: true,
        },
      },
    },
  });
  await switchToSelectView();

  const dbSelect = getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  const catalogSelect = getByRole('combobox', {
    name: 'Select catalog or type to search catalogs',
  });

  expect(dbSelect).toBeInTheDocument();
  expect(catalogSelect).toBeInTheDocument();
});

test('display no compatible schema found when schema api throws errors', async () => {
  const reduxState = {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queryEditors: [
        {
          ...extraQueryEditor2,
          dbId: 3,
          schema: undefined,
        },
      ],
      databases: {
        [mockData.database.id]: {
          ...mockData.database,
          allow_multi_catalog: true,
        },
        3: {
          id: 3,
          database_name: 'unauth_db',
          backend: 'minervasql',
        },
      },
    },
  };
  await renderAndWait(
    {
      ...mockedProps,
      queryEditorId: extraQueryEditor2.id,
    },
    undefined,
    reduxState,
  );
  await switchToSelectView();

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/database/3/schemas/?*').length,
    ).toBeGreaterThanOrEqual(1),
  );
  const select = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  userEvent.click(select);
  expect(
    await screen.findByText('No compatible schema found'),
  ).toBeInTheDocument();
});

test('ignore schema api when current schema is deprecated', async () => {
  const invalidSchemaName = 'None';
  await renderAndWait(mockedProps, undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        schema: invalidSchemaName,
        dbId: mockData.database.id,
      },
      tables: [table],
      databases: {
        [mockData.database.id]: {
          ...mockData.database,
        },
      },
    },
  });
  await switchToSelectView();
  expect(fetchMock.callHistory.calls()).not.toContainEqual(
    expect.arrayContaining([
      expect.stringContaining(
        `/tables/${mockData.database.id}/${invalidSchemaName}/`,
      ),
    ]),
  );
});
