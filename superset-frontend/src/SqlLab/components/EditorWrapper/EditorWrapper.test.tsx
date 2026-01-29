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
import EditorWrapper from 'src/SqlLab/components/EditorWrapper';
import type { editors } from '@apache-superset/core';
import {
  queryEditorSetCursorPosition,
  queryEditorSetDb,
  queryEditorSetSelectedText,
} from 'src/SqlLab/actions/sqlLab';
import fetchMock from 'fetch-mock';

fetchMock.get('glob:*/api/v1/database/*/function_names/', {
  function_names: [],
});

jest.mock('@superset-ui/core/components/Select/Select', () => () => (
  <div data-test="mock-deprecated-select-select" />
));
jest.mock('@superset-ui/core/components/Select/AsyncSelect', () => () => (
  <div data-test="mock-deprecated-async-select" />
));

// Mock EditorHost from the editors module
const MockEditorHost = jest
  .fn()
  .mockImplementation((props: editors.EditorProps) => (
    <div data-test="editor-host">{JSON.stringify(props)}</div>
  ));

jest.mock('src/core/editors', () => ({
  ...jest.requireActual('src/core/editors'),
  EditorHost: (props: editors.EditorProps) => MockEditorHost(props),
}));

const setup = (queryEditor: QueryEditor, store?: Store) =>
  render(
    <EditorWrapper
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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('EditorWrapper', () => {
  beforeEach(() => {
    MockEditorHost.mockClear();
  });

  test('renders editor including sql value', async () => {
    const store = createStore(initialState, reducerIndex);
    const { getByTestId } = setup(defaultQueryEditor, store);
    await waitFor(() => expect(getByTestId('editor-host')).toBeInTheDocument());

    expect(getByTestId('editor-host')).toHaveTextContent(
      JSON.stringify({ value: defaultQueryEditor.sql }).slice(1, -1),
    );
  });

  test('renders current sql for unrelated unsaved changes', () => {
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

    expect(getByTestId('editor-host')).not.toHaveTextContent(
      JSON.stringify({ value: expectedSql }).slice(1, -1),
    );
    expect(getByTestId('editor-host')).toHaveTextContent(
      JSON.stringify({ value: defaultQueryEditor.sql }).slice(1, -1),
    );
  });

  test('skips rerendering for updating cursor position', () => {
    const store = createStore(initialState, reducerIndex);
    setup(defaultQueryEditor, store);

    expect(MockEditorHost).toHaveBeenCalled();
    const renderCount = MockEditorHost.mock.calls.length;
    const updatedCursorPosition = { row: 1, column: 9 };
    store.dispatch(
      queryEditorSetCursorPosition(defaultQueryEditor, updatedCursorPosition),
    );
    expect(MockEditorHost).toHaveBeenCalledTimes(renderCount);
    store.dispatch(queryEditorSetDb(defaultQueryEditor, 2));
    expect(MockEditorHost).toHaveBeenCalledTimes(renderCount + 1);
  });

  test('clears selectedText when selection becomes empty', async () => {
    const store = createStore(initialState, reducerIndex);
    // Set initial selected text in store
    store.dispatch(
      queryEditorSetSelectedText(defaultQueryEditor, 'SELECT * FROM table'),
    );
    setup(defaultQueryEditor, store);

    await waitFor(() => expect(MockEditorHost).toHaveBeenCalled());

    // Get the onSelectionChange and onReady callbacks from the mock
    const lastCall =
      MockEditorHost.mock.calls[MockEditorHost.mock.calls.length - 1][0];
    const { onSelectionChange, onReady } = lastCall;

    // Simulate editor ready with a mock handle that returns empty selection
    const mockHandle = {
      getSelectedText: jest.fn().mockReturnValue(''),
      getValue: jest.fn().mockReturnValue(''),
      setValue: jest.fn(),
      focus: jest.fn(),
      moveCursorToPosition: jest.fn(),
      scrollToLine: jest.fn(),
    };
    onReady(mockHandle);

    // Simulate selection change with empty selection (cursor moved without selecting)
    onSelectionChange([
      { start: { line: 0, column: 5 }, end: { line: 0, column: 5 } },
    ]);

    // Verify selectedText was cleared in the store
    await waitFor(() => {
      const state = store.getState() as unknown as {
        sqlLab: { queryEditors: QueryEditor[] };
      };
      const editor = state.sqlLab.queryEditors.find(
        qe => qe.id === defaultQueryEditor.id,
      );
      expect(editor?.selectedText).toBeFalsy();
    });
  });
});
