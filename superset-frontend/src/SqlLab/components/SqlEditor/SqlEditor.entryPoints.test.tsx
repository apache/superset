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
import type { editors } from '@apache-superset/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import fetchMock from 'fetch-mock';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import reducers from 'spec/helpers/reducerIndex';
import { setupStore } from 'src/views/store';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { queryEditorSetSelectedText } from 'src/SqlLab/actions/sqlLab';
import type { SqlLabRootState } from 'src/SqlLab/types';
import SqlEditor from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));
jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({
      children,
    }: {
      children: (size: { height: number }) => React.ReactNode;
    }) =>
      children({ height: 500 }),
);
jest.mock('src/SqlLab/components/ResultSet', () => () => <div />);
jest.mock('src/components/DatabaseSelector', () => ({
  DatabaseSelector: () => <div />,
}));

let mockCursor = { line: 0, column: 0 };
const mockSetSelection = jest.fn();
const mockMoveCursor = jest.fn();
const mockScrollToLine = jest.fn();
jest.mock('src/core/editors', () => ({
  ...jest.requireActual('src/core/editors'),
  EditorHost: ({ value, hotkeys, onChange }: editors.EditorProps) => {
    const handle: editors.EditorHandle = {
      getValue: () => value,
      getCursorPosition: () => mockCursor,
      setSelection: mockSetSelection,
      moveCursorToPosition: mockMoveCursor,
      scrollToLine: mockScrollToLine,
      focus: jest.fn(),
      setValue: jest.fn(),
      getSelections: () => [],
      getSelectedText: () => '',
      insertText: jest.fn(),
      executeCommand: jest.fn(),
      setAnnotations: jest.fn(),
      clearAnnotations: jest.fn(),
      resize: jest.fn(),
      registerCompletionProvider: () => ({ dispose: jest.fn() }),
      onDidChangeContent: () => ({ dispose: jest.fn() }),
    };
    return (
      <textarea
        aria-label="SQL editor"
        value={value}
        onChange={event => onChange?.(event.target.value)}
        onKeyDown={event => {
          const key = [
            event.ctrlKey ? 'ctrl' : '',
            event.shiftKey ? 'shift' : '',
            event.key.toLowerCase(),
          ]
            .filter(Boolean)
            .join('+');
          hotkeys?.find(hotkey => hotkey.key === key)?.exec(handle);
        }}
      />
    );
  },
}));

/** Render the real active-editor wiring as Redux opens or switches SQL Lab tabs. */
function ActiveEditor() {
  const editor = useSelector((state: SqlLabRootState) =>
    state.sqlLab.queryEditors.find(
      qe => qe.id === state.sqlLab.tabHistory.slice(-1)[0],
    ),
  );
  return editor ? (
    <SqlEditor
      key={editor.id}
      queryEditor={editor}
      defaultQueryLimit={1000}
      maxRow={100000}
      displayLimit={100}
      saveQueryWarning={null}
      scheduleQueryWarning={null}
    />
  ) : null;
}

/** Use the application reducer and HTTP clients; mock only editor rendering. */
function setup(sql: string) {
  const store = setupStore({
    disableDebugger: true,
    rootReducers: reducers,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        queryEditors: [{ ...defaultQueryEditor, sql, queryLimit: 42 }],
        databases: {
          [defaultQueryEditor.dbId!]: {
            id: defaultQueryEditor.dbId,
            backend: 'postgresql',
            allow_run_async: false,
            allows_cost_estimate: true,
            engine_information: { query_cost_warning_metric: 'total_cost' },
            query_cost_warning: {
              enabled: true,
              metric: 'total_cost',
              threshold: 10,
            },
          },
        },
      },
    },
  });
  render(<ActiveEditor />, { store, useRedux: true });
  return store;
}
const warning = {
  status: 'exceeded',
  metric: 'total_cost',
  label: 'Estimated planner cost',
  unit: 'planner cost units',
  value: 12.5,
  threshold: 10,
  message: 'Above threshold',
};
const estimates = () => fetchMock.callHistory.calls('check');
const executions = () => fetchMock.callHistory.calls('execution');

beforeEach(() => {
  jest
    .mocked(isFeatureEnabled)
    .mockImplementation(flag =>
      [
        FeatureFlag.EstimateQueryCost,
        FeatureFlag.SqlLabQueryCostWarnings,
      ].includes(flag),
    );
  mockSetSelection.mockClear();
  mockMoveCursor.mockClear();
  mockScrollToLine.mockClear();
  mockCursor = { line: 0, column: 0 };
  fetchMock.post('glob:*/log/*', 200);
  fetchMock.get('glob:*/api/v1/database/*/function_names/', {
    function_names: [],
  });
  fetchMock.get('glob:*/api/v1/database/*', { result: [] });
  fetchMock.post(
    'glob:*/api/v1/sqllab/estimate/',
    { result: warning },
    { name: 'check' },
  );
  fetchMock.post(
    'glob:*/api/v1/sqllab/execute/*',
    { data: [], columns: [] },
    { name: 'execution' },
  );
});
afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test.each([
  {
    sql: 'SELECT 1; SELECT 2;',
    cursor: { line: 0, column: 14 },
    expected: ' SELECT 2;',
  },
  {
    sql: 'SELECT 1;\n\nSELECT\n  2',
    cursor: { line: 3, column: 2 },
    expected: 'SELECT\n  2',
  },
  { sql: '\n\nSELECT 2', cursor: { line: 2, column: 4 }, expected: 'SELECT 2' },
])(
  'current-statement shortcut captures its existing range: $sql',
  async ({ sql, cursor, expected }) => {
    mockCursor = cursor;
    setup(sql);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'SQL editor' }), {
      key: 'Enter',
      ctrlKey: true,
      shiftKey: true,
    });
    await screen.findByRole('dialog');
    expect(JSON.parse(String(estimates()[0].options.body))).toMatchObject({
      sql: expected,
      query_limit: 42,
      check_warning: true,
    });
    expect(executions()).toHaveLength(0);
    expect(mockSetSelection).not.toHaveBeenCalled();
    expect(mockMoveCursor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Run anyway' }));
    await waitFor(() => expect(executions()).toHaveLength(1));
    expect(JSON.parse(String(executions()[0].options.body))).toMatchObject({
      sql: expected,
      queryLimit: 42,
    });
  },
);

test('current-statement Run preserves an existing selection and cancel executes nothing', async () => {
  const store = setup('SELECT 1; SELECT 2;');
  mockCursor = { line: 0, column: 14 };
  act(() => {
    store.dispatch(queryEditorSetSelectedText(defaultQueryEditor, 'SELECT 1'));
  });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'SQL editor' }), {
    key: 'Enter',
    ctrlKey: true,
    shiftKey: true,
  });
  await screen.findByRole('dialog');
  expect(JSON.parse(String(estimates()[0].options.body)).sql).toBe(
    ' SELECT 2;',
  );
  expect(store.getState().sqlLab.unsavedQueryEditor.selectedText).toBe(
    'SELECT 1',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(executions()).toHaveLength(0);
  expect(mockSetSelection).not.toHaveBeenCalled();
});

test('keyboard Run keeps the existing selected-SQL behavior through confirmation', async () => {
  const store = setup('SELECT 1; SELECT 2;');
  act(() => {
    store.dispatch(queryEditorSetSelectedText(defaultQueryEditor, 'SELECT 2'));
  });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'SQL editor' }), {
    key: 'Enter',
    ctrlKey: true,
  });
  await screen.findByRole('dialog');
  expect(JSON.parse(String(estimates()[0].options.body)).sql).toBe('SELECT 2');
  fireEvent.click(screen.getByRole('button', { name: 'Run anyway' }));
  await waitFor(() => expect(executions()).toHaveLength(1));
  expect(JSON.parse(String(executions()[0].options.body)).sql).toBe('SELECT 2');
});

test('current-statement Run still executes directly when warnings are off without changing selection', async () => {
  jest.mocked(isFeatureEnabled).mockReturnValue(false);
  setup('SELECT 1; SELECT 2;');
  mockCursor = { line: 0, column: 14 };
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'SQL editor' }), {
    key: 'Enter',
    ctrlKey: true,
    shiftKey: true,
  });
  await waitFor(() => expect(executions()).toHaveLength(1));
  expect(JSON.parse(String(executions()[0].options.body)).sql).toBe(
    ' SELECT 2;',
  );
  expect(estimates()).toHaveLength(0);
  expect(mockSetSelection).not.toHaveBeenCalled();
});
