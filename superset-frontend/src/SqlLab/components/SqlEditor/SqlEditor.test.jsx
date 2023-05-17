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
import { act } from 'react-dom/test-utils';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { reducers } from 'src/SqlLab/reducers';
import SqlEditor from 'src/SqlLab/components/SqlEditor';
import { setupStore } from 'src/views/store';
import {
  initialState,
  queries,
  table,
  defaultQueryEditor,
} from 'src/SqlLab/fixtures';
import SqlEditorLeftBar from 'src/SqlLab/components/SqlEditorLeftBar';
import { api } from 'src/hooks/apiResources/queryApi';

jest.mock('src/components/AsyncAceEditor', () => ({
  ...jest.requireActual('src/components/AsyncAceEditor'),
  FullSQLEditor: ({ onChange, onBlur, value }) => (
    <textarea
      data-test="react-ace"
      onChange={evt => onChange(evt.target.value)}
      onBlur={onBlur}
      value={value}
    />
  ),
}));
jest.mock('src/SqlLab/components/SqlEditorLeftBar', () => jest.fn());

fetchMock.get('glob:*/api/v1/database/*', { result: [] });
fetchMock.get('glob:*/api/v1/database/*/tables/*', { options: [] });
fetchMock.post('glob:*/sqllab/execute/*', { result: [] });

let store;
let actions;
const mockInitialState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    databases: {
      1991: {
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
      dbId: 1991,
    },
  },
};

const setup = (props = {}, store) =>
  render(<SqlEditor {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

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

describe('SqlEditor', () => {
  const mockedProps = {
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

  beforeEach(() => {
    store = createStore(mockInitialState);
    actions = [];

    SqlEditorLeftBar.mockClear();
    SqlEditorLeftBar.mockImplementation(() => (
      <div data-test="mock-sql-editor-left-bar" />
    ));
  });

  afterEach(() => {
    act(() => {
      store.dispatch(api.util.resetApiState());
    });
  });

  it('does not render SqlEditor if no db selected', async () => {
    const queryEditor = initialState.sqlLab.queryEditors[1];
    const { findByText } = setup({ ...mockedProps, queryEditor }, store);
    expect(
      await findByText('Select a database to write a query'),
    ).toBeInTheDocument();
  });

  it('render a SqlEditorLeftBar', async () => {
    const { getByTestId } = setup(mockedProps, store);
    await waitFor(() =>
      expect(getByTestId('mock-sql-editor-left-bar')).toBeInTheDocument(),
    );
  });

  it('render an AceEditorWrapper', async () => {
    const { findByTestId } = setup(mockedProps, store);
    expect(await findByTestId('react-ace')).toBeInTheDocument();
  });

  it('avoids rerendering EditorLeftBar while typing', async () => {
    const { findByTestId } = setup(mockedProps, store);
    const editor = await findByTestId('react-ace');
    const sql = 'select *';
    const renderCount = SqlEditorLeftBar.mock.calls.length;
    expect(SqlEditorLeftBar).toHaveBeenCalledTimes(renderCount);
    fireEvent.change(editor, { target: { value: sql } });
    // Verify the rendering regression
    expect(SqlEditorLeftBar).toHaveBeenCalledTimes(renderCount);
  });

  it('renders sql from unsaved change', async () => {
    const expectedSql = 'SELECT updated_column\nFROM updated_table\nWHERE';
    store = createStore({
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        databases: {
          2023: {
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
          dbId: 2023,
          sql: expectedSql,
        },
      },
    });
    const { findByTestId } = setup(mockedProps, store);

    const editor = await findByTestId('react-ace');
    expect(editor).toHaveValue(expectedSql);
  });

  it('render a SouthPane', async () => {
    const { findByText } = setup(mockedProps, store);
    expect(
      await findByText(/run a query to display results/i),
    ).toBeInTheDocument();
  });

  it('runs query action with ctas false', async () => {
    store = createStore({
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
    const { findByTestId } = setup(mockedProps, store);
    const runButton = await findByTestId('run-query-action');
    fireEvent.click(runButton);
    await waitFor(() =>
      expect(actions).toContainEqual({
        type: 'START_QUERY',
        query: expect.objectContaining({
          ctas: false,
          sqlEditorId: defaultQueryEditor.id,
        }),
      }),
    );
  });

  it('render a Limit Dropdown', async () => {
    const defaultQueryLimit = 101;
    const updatedProps = { ...mockedProps, defaultQueryLimit };
    const { findByText } = setup(updatedProps, store);
    fireEvent.click(await findByText('LIMIT:'));
    expect(await findByText('10 000')).toBeInTheDocument();
  });
});
