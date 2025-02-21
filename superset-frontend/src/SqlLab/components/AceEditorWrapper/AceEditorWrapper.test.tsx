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
import reducerIndex from 'spec/helpers/reducerIndex';
import { render, waitFor, createStore } from 'spec/helpers/testing-library';
import { QueryEditor } from 'src/SqlLab/types';
import { Store } from 'redux';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import AceEditorWrapper from 'src/SqlLab/components/AceEditorWrapper';
import {
  AsyncAceEditorProps,
  FullSQLEditor,
} from 'src/components/AsyncAceEditor';
import {
  queryEditorSetCursorPosition,
  queryEditorSetDb,
} from 'src/SqlLab/actions/sqlLab';
import fetchMock from 'fetch-mock';

fetchMock.get('glob:*/api/v1/database/*/function_names/', {
  function_names: [],
});

jest.mock('src/components/Select/Select', () => () => (
  <div data-test="mock-deprecated-select-select" />
));
jest.mock('src/components/Select/AsyncSelect', () => () => (
  <div data-test="mock-deprecated-async-select" />
));

jest.mock('src/components/AsyncAceEditor', () => ({
  FullSQLEditor: jest
    .fn()
    .mockImplementation((props: AsyncAceEditorProps) => (
      <div data-test="react-ace">{JSON.stringify(props)}</div>
    )),
}));

const setup = (queryEditor: QueryEditor, store?: Store) =>
  render(
    <AceEditorWrapper
      queryEditorId={queryEditor.id}
      height="100px"
      hotkeys={[]}
      onChange={jest.fn()}
      onBlur={jest.fn()}
      autocomplete
      onCursorPositionChange={jest.fn()}
    />,
    {
      useRedux: true,
      ...(store && { store }),
    },
  );

describe('AceEditorWrapper', () => {
  beforeEach(() => {
    (FullSQLEditor as any as jest.Mock).mockClear();
  });

  it('renders ace editor including sql value', async () => {
    const store = createStore(initialState, reducerIndex);
    const { getByTestId } = setup(defaultQueryEditor, store);
    await waitFor(() => expect(getByTestId('react-ace')).toBeInTheDocument());

    expect(getByTestId('react-ace')).toHaveTextContent(
      JSON.stringify({ value: defaultQueryEditor.sql }).slice(1, -1),
    );
  });

  it('renders current sql for unrelated unsaved changes', () => {
    const expectedSql = 'SELECT updated_column\nFROM updated_table\nWHERE';
    const store = createStore(
      {
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: `${defaultQueryEditor.id}-other`,
            sql: expectedSql,
          },
        },
      },
      reducerIndex,
    );
    const { getByTestId } = setup(defaultQueryEditor, store);

    expect(getByTestId('react-ace')).not.toHaveTextContent(
      JSON.stringify({ value: expectedSql }).slice(1, -1),
    );
    expect(getByTestId('react-ace')).toHaveTextContent(
      JSON.stringify({ value: defaultQueryEditor.sql }).slice(1, -1),
    );
  });

  it('skips rerendering for updating cursor position', () => {
    const store = createStore(initialState, reducerIndex);
    setup(defaultQueryEditor, store);

    expect(FullSQLEditor).toHaveBeenCalled();
    const renderCount = (FullSQLEditor as any as jest.Mock).mock.calls.length;
    const updatedCursorPosition = { row: 1, column: 9 };
    store.dispatch(
      queryEditorSetCursorPosition(defaultQueryEditor, updatedCursorPosition),
    );
    expect(FullSQLEditor).toHaveBeenCalledTimes(renderCount);
    store.dispatch(queryEditorSetDb(defaultQueryEditor, 2));
    expect(FullSQLEditor).toHaveBeenCalledTimes(renderCount + 1);
  });
});
