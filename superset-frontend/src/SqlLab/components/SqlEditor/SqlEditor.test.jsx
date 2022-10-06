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
import { mount } from 'enzyme';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import {
  SQL_EDITOR_GUTTER_HEIGHT,
  SQL_EDITOR_GUTTER_MARGIN,
  SQL_TOOLBAR_HEIGHT,
} from 'src/SqlLab/constants';
import AceEditorWrapper from 'src/SqlLab/components/AceEditorWrapper';
import ConnectedSouthPane from 'src/SqlLab/components/SouthPane/state';
import SqlEditor from 'src/SqlLab/components/SqlEditor';
import QueryProvider from 'src/views/QueryProvider';
import { AntdDropdown } from 'src/components';
import {
  queryEditorSetFunctionNames,
  queryEditorSetSelectedText,
  queryEditorSetSchemaOptions,
} from 'src/SqlLab/actions/sqlLab';
import { EmptyStateBig } from 'src/components/EmptyState';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import {
  initialState,
  queries,
  table,
  defaultQueryEditor,
} from 'src/SqlLab/fixtures';

jest.mock('src/components/AsyncAceEditor', () => ({
  ...jest.requireActual('src/components/AsyncAceEditor'),
  FullSQLEditor: props => (
    <div data-test="react-ace">{JSON.stringify(props)}</div>
  ),
}));
jest.mock('src/SqlLab/components/SqlEditorLeftBar', () => () => (
  <div data-test="mock-sql-editor-left-bar" />
));

const MOCKED_SQL_EDITOR_HEIGHT = 500;

fetchMock.get('glob:*/api/v1/database/*', { result: [] });
fetchMock.get('glob:*/superset/tables/*', { options: [] });
fetchMock.post('glob:*/sql_json/*', { result: [] });

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore({
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    databases: {
      dbid1: {
        allow_ctas: false,
        allow_cvas: false,
        allow_dml: false,
        allow_file_upload: false,
        allow_run_async: false,
        backend: 'postgresql',
        database_name: 'examples',
        expose_in_sqllab: true,
        force_ctas_schema: null,
        id: 1,
      },
    },
    unsavedQueryEditor: {
      id: defaultQueryEditor.id,
      dbId: 'dbid1',
    },
  },
});

const setup = (props = {}, store) =>
  render(<SqlEditor {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

describe('SqlEditor', () => {
  const mockedProps = {
    actions: {
      queryEditorSetFunctionNames,
      queryEditorSetSelectedText,
      queryEditorSetSchemaOptions,
      addDangerToast: jest.fn(),
      removeDataPreview: jest.fn(),
    },
    queryEditor: initialState.sqlLab.queryEditors[0],
    latestQuery: queries[0],
    tables: [table],
    getHeight: () => '100px',
    editorQueries: [],
    dataPreviewQueries: [],
    defaultQueryLimit: 1000,
    maxRow: 100000,
    displayLimit: 100,
  };

  const buildWrapper = (props = {}) =>
    mount(
      <QueryProvider>
        <Provider store={store}>
          <SqlEditor {...mockedProps} {...props} />
        </Provider>
      </QueryProvider>,
      {
        wrappingComponent: ThemeProvider,
        wrappingComponentProps: { theme: supersetTheme },
      },
    );

  it('does not render SqlEditor if no db selected', () => {
    const queryEditor = initialState.sqlLab.queryEditors[1];
    const updatedProps = { ...mockedProps, queryEditor };
    const wrapper = buildWrapper(updatedProps);
    expect(wrapper.find(EmptyStateBig)).toExist();
  });

  it('render a SqlEditorLeftBar', async () => {
    const { getByTestId } = setup(mockedProps, store);
    await waitFor(() =>
      expect(getByTestId('mock-sql-editor-left-bar')).toBeInTheDocument(),
    );
  });

  it('render an AceEditorWrapper', async () => {
    const wrapper = buildWrapper();
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(AceEditorWrapper)).toExist();
  });

  it('renders sql from unsaved change', () => {
    const expectedSql = 'SELECT updated_column\nFROM updated_table\nWHERE';
    const { getByTestId } = setup(
      mockedProps,
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          databases: {
            dbid1: {
              allow_ctas: false,
              allow_cvas: false,
              allow_dml: false,
              allow_file_upload: false,
              allow_run_async: false,
              backend: 'postgresql',
              database_name: 'examples',
              expose_in_sqllab: true,
              force_ctas_schema: null,
              id: 1,
            },
          },
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            dbId: 'dbid1',
            sql: expectedSql,
          },
        },
      }),
    );

    expect(getByTestId('react-ace')).toHaveTextContent(
      JSON.stringify({ value: expectedSql }).slice(1, -1),
    );
  });

  it('render a SouthPane', async () => {
    const wrapper = buildWrapper();
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(ConnectedSouthPane)).toExist();
  });

  it('runs query action with ctas false', async () => {
    const expectedStore = mockStore({
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        databases: {
          5667: {
            allow_ctas: false,
            allow_cvas: false,
            allow_dml: false,
            allow_file_upload: false,
            allow_run_async: true,
            backend: 'postgresql',
            database_name: 'examples',
            expose_in_sqllab: true,
            force_ctas_schema: null,
            id: 1,
          },
        },
        unsavedQueryEditor: {
          id: defaultQueryEditor.id,
          dbId: 5667,
          sql: 'expectedSql',
        },
      },
    });
    const { findByTestId } = setup(mockedProps, expectedStore);
    const runButton = await findByTestId('run-query-action');
    fireEvent.click(runButton);
    await waitFor(() =>
      expect(expectedStore.getActions()).toContainEqual({
        type: 'START_QUERY',
        query: expect.objectContaining({
          ctas: false,
          sqlEditorId: defaultQueryEditor.id,
        }),
      }),
    );
  });

  // TODO eschutho convert tests to RTL
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('does not overflow the editor window', async () => {
    const wrapper = buildWrapper();
    await waitForComponentToPaint(wrapper);
    const totalSize =
      parseFloat(wrapper.find(AceEditorWrapper).props().height) +
      wrapper.find(ConnectedSouthPane).props().height +
      SQL_TOOLBAR_HEIGHT +
      SQL_EDITOR_GUTTER_MARGIN * 2 +
      SQL_EDITOR_GUTTER_HEIGHT;
    expect(totalSize).toEqual(MOCKED_SQL_EDITOR_HEIGHT);
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('does not overflow the editor window after resizing', async () => {
    const wrapper = buildWrapper();
    wrapper.setState({ height: 450 });
    await waitForComponentToPaint(wrapper);
    const totalSize =
      parseFloat(wrapper.find(AceEditorWrapper).props().height) +
      wrapper.find(ConnectedSouthPane).props().height +
      SQL_TOOLBAR_HEIGHT +
      SQL_EDITOR_GUTTER_MARGIN * 2 +
      SQL_EDITOR_GUTTER_HEIGHT;
    expect(totalSize).toEqual(450);
  });

  it('render a Limit Dropdown', async () => {
    const defaultQueryLimit = 101;
    const updatedProps = { ...mockedProps, defaultQueryLimit };
    const wrapper = buildWrapper(updatedProps);
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(AntdDropdown)).toExist();
  });
});
