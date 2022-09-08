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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import '@testing-library/jest-dom/extend-expect';
import thunk from 'redux-thunk';
import SqlEditorLeftBar from 'src/SqlLab/components/SqlEditorLeftBar';
import {
  table,
  initialState,
  databases,
  defaultQueryEditor,
  mockedActions,
} from 'src/SqlLab/fixtures';

const mockedProps = {
  actions: mockedActions,
  tables: [table],
  queryEditor: defaultQueryEditor,
  database: databases,
  height: 0,
};
const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore(initialState);

fetchMock.get('glob:*/api/v1/database/*/schemas/?*', { result: [] });
fetchMock.get('glob:*/superset/tables/**', {
  json: {
    options: [
      {
        label: 'ab_user',
        value: 'ab_user',
      },
    ],
    tableLength: 1,
  },
});

describe('Left Panel Expansion', () => {
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
    render(<SqlEditorLeftBar {...mockedProps} />, {
      useRedux: true,
      initialState,
    });

    expect(
      await screen.findByText(/select database or type database name/i),
    ).toBeInTheDocument();
    expect(
      screen.queryAllByTestId('table-element').length,
    ).toBeGreaterThanOrEqual(1);
  });

  test('table should be visible when expanded is true', async () => {
    const { container } = render(<SqlEditorLeftBar {...mockedProps} />, {
      useRedux: true,
      initialState,
    });

    const dbSelect = screen.getByRole('combobox', {
      name: 'Select database or type database name',
    });
    const schemaSelect = screen.getByRole('combobox', {
      name: 'Select schema or type schema name',
    });
    const dropdown = screen.getByText(/Select table or type table name/i);
    const abUser = screen.getByText(/ab_user/i);

    expect(
      await screen.findByText(/select database or type database name/i),
    ).toBeInTheDocument();
    expect(dbSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
    expect(dropdown).toBeInTheDocument();
    expect(abUser).toBeInTheDocument();
    expect(
      container.querySelector('.ant-collapse-content-active'),
    ).toBeInTheDocument();
  });

  test('should toggle the table when the header is clicked', async () => {
    const collapseMock = jest.fn();
    render(
      <SqlEditorLeftBar
        actions={{ ...mockedActions, collapseTable: collapseMock }}
        tables={[table]}
        queryEditor={defaultQueryEditor}
        database={databases}
        height={0}
      />,
      {
        useRedux: true,
        initialState,
      },
    );

    expect(await screen.findByText(/ab_user/)).toBeInTheDocument();
    const header = screen.getByText(/ab_user/);
    userEvent.click(header);
    expect(collapseMock).toHaveBeenCalled();
  });
});
