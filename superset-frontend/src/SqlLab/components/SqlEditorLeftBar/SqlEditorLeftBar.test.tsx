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
import React from 'react';
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import SqlEditorLeftBar, {
  SqlEditorLeftBarProps,
} from 'src/SqlLab/components/SqlEditorLeftBar';
import {
  table,
  initialState,
  defaultQueryEditor,
  extraQueryEditor1,
} from 'src/SqlLab/fixtures';
import type { RootState } from 'src/views/store';
import type { Store } from 'redux';

const mockedProps = {
  queryEditorId: defaultQueryEditor.id,
  database: {
    id: 1,
    database_name: 'main',
    backend: 'mysql',
  },
  height: 0,
};

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/database/?*', { result: [] });
  fetchMock.get('glob:*/api/v1/database/*/schemas/?*', {
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
  fetchMock.get('glob:*/api/v1/database/*/table/*/*', {
    status: 200,
    body: {
      columns: table.columns,
    },
  });
  fetchMock.get('glob:*/api/v1/database/*/table_extra/*/*', {
    status: 200,
    body: {},
  });
});

afterEach(() => {
  fetchMock.restore();
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

test('renders a TableElement', async () => {
  const { findByText, getAllByTestId } = await renderAndWait(
    mockedProps,
    undefined,
    { ...initialState, sqlLab: { ...initialState.sqlLab, tables: [table] } },
  );
  expect(await findByText(/Database/i)).toBeInTheDocument();
  const tableElement = getAllByTestId('table-element');
  expect(tableElement.length).toBeGreaterThanOrEqual(1);
});

test('table should be visible when expanded is true', async () => {
  const { container, getByText, getByRole, queryAllByText } =
    await renderAndWait(mockedProps, undefined, {
      ...initialState,
      sqlLab: { ...initialState.sqlLab, tables: [table] },
    });

  const dbSelect = getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  const schemaSelect = getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  const dropdown = getByText(/Table/i);
  const abUser = queryAllByText(/ab_user/i);

  expect(getByText(/Database/i)).toBeInTheDocument();
  expect(dbSelect).toBeInTheDocument();
  expect(schemaSelect).toBeInTheDocument();
  expect(dropdown).toBeInTheDocument();
  expect(abUser).toHaveLength(2);
  expect(
    container.querySelector('.ant-collapse-content-active'),
  ).toBeInTheDocument();
  table.columns.forEach(({ name }) => {
    expect(getByText(name)).toBeInTheDocument();
  });
});

test('should toggle the table when the header is clicked', async () => {
  const { container } = await renderAndWait(mockedProps, undefined, {
    ...initialState,
    sqlLab: { ...initialState.sqlLab, tables: [table] },
  });

  const header = container.querySelector('.ant-collapse-header');
  expect(header).toBeInTheDocument();

  if (header) {
    userEvent.click(header);
  }

  await waitFor(() =>
    expect(
      container.querySelector('.ant-collapse-content-inactive'),
    ).toBeInTheDocument(),
  );
});

test('When changing database the table list must be updated', async () => {
  const { rerender } = await renderAndWait(mockedProps, undefined, {
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
    <SqlEditorLeftBar
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
      },
      tables: [table],
    },
  });

  expect(await screen.findByText(/Database/i)).toBeInTheDocument();
  expect(fetchMock.calls()).not.toContainEqual(
    expect.arrayContaining([
      expect.stringContaining(
        `/tables/${mockedProps.database.id}/${invalidSchemaName}/`,
      ),
    ]),
  );
  // Deselect the deprecated schema selection
  await waitFor(() =>
    expect(screen.queryByText(/None/i)).not.toBeInTheDocument(),
  );
});
