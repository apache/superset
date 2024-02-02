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
import { Provider } from 'react-redux';
import '@testing-library/jest-dom/extend-expect';
import SqlEditorLeftBar from 'src/SqlLab/components/SqlEditorLeftBar';
import { table, initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { api } from 'src/hooks/apiResources/queryApi';
import { setupStore } from 'src/views/store';
import reducers from 'spec/helpers/reducerIndex';

const mockedProps = {
  tables: [table],
  queryEditorId: defaultQueryEditor.id,
  database: {
    id: 1,
    database_name: 'main',
    backend: 'mysql',
  },
  height: 0,
};

let store;
let actions;

const logAction = () => next => action => {
  if (typeof action === 'function') {
    return next(action);
  }
  actions.push(action);
  return next(action);
};

const createStore = initState =>
  setupStore({
    disableDegugger: true,
    initialState: initState,
    rootReducers: reducers,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware().concat(api.middleware, logAction),
  });

beforeEach(() => {
  store = createStore(initialState);
  actions = [];
  fetchMock.get('glob:*/api/v1/database/?*', { result: [] });
  fetchMock.get('glob:*/api/v1/database/*/schemas/?*', {
    count: 2,
    result: ['main', 'new_schema'],
  });
  fetchMock.get('glob:*/api/v1/database/*/tables/*', {
    count: 1,
    result: [
      {
        label: 'ab_user',
        value: 'ab_user',
      },
    ],
  });
});

afterEach(() => {
  fetchMock.restore();
  store.dispatch(api.util.resetApiState());
  jest.clearAllMocks();
});

const renderAndWait = (props, store) =>
  waitFor(() =>
    render(<SqlEditorLeftBar {...props} />, {
      useRedux: true,
      ...(store && { store }),
    }),
  );

test('is valid', () => {
  expect(
    React.isValidElement(
      <Provider store={store}>
        <SqlEditorLeftBar {...mockedProps} />
      </Provider>,
    ),
  ).toBe(true);
});

test('renders a TableElement', async () => {
  await renderAndWait(mockedProps, store);
  expect(await screen.findByText(/Database/i)).toBeInTheDocument();
  const tableElement = screen.getAllByTestId('table-element');
  expect(tableElement.length).toBeGreaterThanOrEqual(1);
});

test('table should be visible when expanded is true', async () => {
  const { container } = await renderAndWait(mockedProps, store);

  const dbSelect = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  const schemaSelect = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  const dropdown = screen.getByText(/Table/i);
  const abUser = screen.queryAllByText(/ab_user/i);

  await waitFor(() => {
    expect(screen.getByText(/Database/i)).toBeInTheDocument();
    expect(dbSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
    expect(dropdown).toBeInTheDocument();
    expect(abUser).toHaveLength(2);
    expect(
      container.querySelector('.ant-collapse-content-active'),
    ).toBeInTheDocument();
  });
});

test('should toggle the table when the header is clicked', async () => {
  await renderAndWait(mockedProps, store);

  const header = (await screen.findAllByText(/ab_user/))[1];
  expect(header).toBeInTheDocument();

  userEvent.click(header);

  await waitFor(() => {
    expect(actions[actions.length - 1].type).toEqual('COLLAPSE_TABLE');
  });
});

test('When changing database the table list must be updated', async () => {
  store = createStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        schema: 'new_schema',
      },
    },
  });
  const { rerender } = await renderAndWait(mockedProps, store);

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
      queryEditorId={defaultQueryEditor.id}
      tables={[{ ...mockedProps.tables[0], dbId: 2, name: 'new_table' }]}
    />,
    {
      useRedux: true,
      store,
    },
  );
  expect(await screen.findByText(/new_db/i)).toBeInTheDocument();
  expect(await screen.findByText(/new_table/i)).toBeInTheDocument();
});

test('ignore schema api when current schema is deprecated', async () => {
  const invalidSchemaName = 'None';
  store = createStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        schema: invalidSchemaName,
      },
    },
  });
  const { rerender } = await renderAndWait(mockedProps, store);

  expect(await screen.findByText(/Database/i)).toBeInTheDocument();
  expect(fetchMock.calls()).not.toContainEqual(
    expect.arrayContaining([
      expect.stringContaining(
        `/tables/${mockedProps.database.id}/${invalidSchemaName}/`,
      ),
    ]),
  );
  rerender();
  // Deselect the deprecated schema selection
  await waitFor(() =>
    expect(screen.queryByText(/None/i)).not.toBeInTheDocument(),
  );
});
