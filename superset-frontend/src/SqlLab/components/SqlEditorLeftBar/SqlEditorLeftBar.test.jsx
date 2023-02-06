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
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import '@testing-library/jest-dom/extend-expect';
import thunk from 'redux-thunk';
import SqlEditorLeftBar from 'src/SqlLab/components/SqlEditorLeftBar';
import { table, initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';

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
const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore(initialState);

fetchMock.get('glob:*/api/v1/database/*/schemas/?*', { result: [] });
fetchMock.get('glob:*/api/v1/database/*/tables/*', {
  count: 1,
  result: [
    {
      label: 'ab_user',
      value: 'ab_user',
    },
  ],
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
    name: 'Select database or type database name',
  });
  const schemaSelect = screen.getByRole('combobox', {
    name: 'Select schema or type schema name',
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
  const store = mockStore(initialState);
  await renderAndWait(mockedProps, store);

  const header = (await screen.findAllByText(/ab_user/))[1];
  expect(header).toBeInTheDocument();
  userEvent.click(header);

  await waitFor(() => {
    expect(store.getActions()).toHaveLength(4);
    expect(store.getActions()[3].type).toEqual('COLLAPSE_TABLE');
  });
});

test('When changing database the table list must be updated', async () => {
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
      queryEditor={{ ...mockedProps.queryEditor, schema: 'new_schema' }}
      tables={[{ ...mockedProps.tables[0], dbId: 2, name: 'new_table' }]}
    />,
    {
      useRedux: true,
      initialState,
    },
  );
  expect(await screen.findByText(/new_db/i)).toBeInTheDocument();
  expect(await screen.findByText(/new_table/i)).toBeInTheDocument();
});
