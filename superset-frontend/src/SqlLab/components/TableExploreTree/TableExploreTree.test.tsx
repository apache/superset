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
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import {
  table,
  initialState,
  defaultQueryEditor,
  extraQueryEditor1,
} from 'src/SqlLab/fixtures';
import type { RootState } from 'src/views/store';
import type { Store } from 'redux';

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
  fetchMock.restore();
  jest.clearAllMocks();
});

const renderAndWait = (
  queryEditorId: string,
  store?: Store,
  initialState?: RootState,
) =>
  waitFor(() =>
    render(<TableExploreTree queryEditorId={queryEditorId} />, {
      useRedux: true,
      initialState,
      ...(store && { store }),
    }),
  );

test('renders a TableElement', async () => {
  const { findByText, getAllByTestId } = await renderAndWait(
    mockedQueryEditorId,
    undefined,
    { ...initialState, sqlLab: { ...initialState.sqlLab, tables: [table] } },
  );
  expect(await findByText(/Database/i)).toBeInTheDocument();
  const tableElement = getAllByTestId('table-element');
  expect(tableElement.length).toBeGreaterThanOrEqual(1);
});

test('When changing database the schema and table list must be updated', async () => {
  const { rerender } = await renderAndWait(mockedQueryEditorId, undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        schema: 'new_schema',
      },
      queryEditors: [
        defaultQueryEditor,
        {
          ...extraQueryEditor1,
          schema: 'new_schema',
          dbId: 2,
        },
      ],
      tables: [
        table,
        {
          ...table,
          dbId: 2,
          name: 'new_table',
          queryEditorId: extraQueryEditor1.id,
        },
      ],
    },
  });

  expect(screen.getAllByText(/main/i)[0]).toBeInTheDocument();
  expect(screen.getAllByText(/ab_user/i)[0]).toBeInTheDocument();

  rerender(
    <TableExploreTree
      {...mockedProps}
      database={{
        id: 2,
        database_name: 'new_db',
        backend: 'postgresql',
      }}
      queryEditorId={extraQueryEditor1.id}
    />,
  );
  const updatedDbSelector = await screen.findAllByText(/new_db/i);
  expect(updatedDbSelector[0]).toBeInTheDocument();
  const updatedTableSelector = await screen.findAllByText(/new_table/i);
  expect(updatedTableSelector[0]).toBeInTheDocument();

  const select = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  userEvent.click(select);
  expect(
    await screen.findByRole('option', { name: 'main' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('option', { name: 'new_schema' }),
  ).toBeInTheDocument();
  rerender(
    <SqlEditorLeftBar
      {...mockedProps}
      database={{
        id: 3,
        database_name: 'unauth_db',
        backend: 'minervasql',
      }}
      queryEditorId={extraQueryEditor1.id}
    />,
  );
  userEvent.click(select);
  expect(
    await screen.findByText('No compatible schema found'),
  ).toBeInTheDocument();
});

test('ignore schema api when current schema is deprecated', async () => {
  const invalidSchemaName = 'None';
  await renderAndWait(mockedQueryEditorId, undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      databases: {
        1: mockedDatabase,
      },
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        schema: invalidSchemaName,
        dbId: mockedDatabase.id,
      },
      tables: [table],
    },
  });

  expect(await screen.findByText(/db1_schema2/i)).toBeInTheDocument();
  expect(fetchMock.calls()).not.toContainEqual(
    expect.arrayContaining([
      expect.stringContaining(
        `/tables/${mockedDatabase.id}/${invalidSchemaName}/`,
      ),
    ]),
  );
  // Deselect the deprecated schema selection
  await waitFor(() =>
    expect(screen.queryByText(/None/i)).not.toBeInTheDocument(),
  );
});
