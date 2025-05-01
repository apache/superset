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
  within,
} from 'spec/helpers/testing-library';
import SqlEditorLeftBar, {
  SqlEditorLeftBarProps,
} from 'src/SqlLab/components/SqlEditorLeftBar';
import {
  table,
  initialState,
  defaultQueryEditor,
  extraQueryEditor1,
  extraQueryEditor2,
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
  const { container, getByText, getByRole, getAllByLabelText } =
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
  const tableSelect = getAllByLabelText(
    /Select table or type to search tables/i,
  )[0];
  const tableOption = within(tableSelect).getByText(/ab_user/i);

  expect(getByText(/Database/i)).toBeInTheDocument();
  expect(dbSelect).toBeInTheDocument();
  expect(schemaSelect).toBeInTheDocument();
  expect(tableSelect).toBeInTheDocument();
  expect(tableOption).toBeInTheDocument();
  expect(
    container.querySelector('.ant-collapse-content-active'),
  ).toBeInTheDocument();
  table.columns.forEach(({ name }) => {
    expect(getByText(name)).toBeInTheDocument();
  });
});

test('catalog selector should be visible when enabled in the database', async () => {
  const { container, getByText, getByRole } = await renderAndWait(
    {
      ...mockedProps,
      database: {
        ...mockedProps.database,
        allow_multi_catalog: true,
      },
    },
    undefined,
    {
      ...initialState,
      sqlLab: { ...initialState.sqlLab, tables: [table] },
    },
  );

  const dbSelect = getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  const catalogSelect = getByRole('combobox', {
    name: 'Select catalog or type to search catalogs',
  });
  const schemaSelect = getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  const dropdown = getByText(/Select table/i);
  const abUser = getByText(/ab_user/i);

  expect(getByText(/Database/i)).toBeInTheDocument();
  expect(dbSelect).toBeInTheDocument();
  expect(catalogSelect).toBeInTheDocument();
  expect(schemaSelect).toBeInTheDocument();
  expect(dropdown).toBeInTheDocument();
  expect(abUser).toBeInTheDocument();
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

test('When changing database the schema and table list must be updated', async () => {
  const reduxState = {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        schema: 'db1_schema',
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
        {
          ...table,
          dbId: defaultQueryEditor.dbId,
          schema: 'db1_schema',
        },
        {
          ...table,
          dbId: 2,
          schema: 'new_schema',
          name: 'new_table',
          queryEditorId: extraQueryEditor1.id,
        },
      ],
    },
  };
  const { rerender } = await renderAndWait(mockedProps, undefined, reduxState);

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

  userEvent.click(screen.getAllByText('new_schema')[1]);

  const updatedTableSelector = await screen.findAllByText(/new_table/i);
  expect(updatedTableSelector[0]).toBeInTheDocument();
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
    },
  };
  await renderAndWait(
    {
      ...mockedProps,
      queryEditorId: extraQueryEditor2.id,
      database: {
        id: 3,
        database_name: 'unauth_db',
        backend: 'minervasql',
      },
    },
    undefined,
    reduxState,
  );
  await waitFor(() =>
    expect(fetchMock.calls('glob:*/api/v1/database/3/schemas/?*')).toHaveLength(
      1,
    ),
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
