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
import { setupStore, type AppDispatch } from 'src/views/store';
import {
  initialState,
  defaultQueryEditor,
  successfulQuery,
} from 'src/SqlLab/fixtures';
import {
  queryEditorSetSelectedText,
  setDatabases,
  syncQueryEditor,
} from 'src/SqlLab/actions/sqlLab';
import type { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import { clearQueryEditors } from 'src/SqlLab/utils/reduxStateToLocalStorageHelper';
import SqlEditor from '.';
import TabbedSqlEditors from '../TabbedSqlEditors';

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

const historyQuery = {
  ...successfulQuery,
  id: 'historical',
  sqlEditorId: defaultQueryEditor.id,
  dbId: 2,
  catalog: 'historical_catalog',
  schema: 'historical_schema',
  sql: 'SELECT 99',
  queryLimit: 9999,
  templateParams: '{"origin":"history"}',
  runAsync: true,
};

/** Use the application reducer and HTTP clients; mock only editor rendering. */
function setup(
  sql: string,
  mode: 'editor' | 'history' | 'persisted-history' | 'automatic' = 'editor',
) {
  const store = setupStore({
    disableDebugger: true,
    rootReducers: reducers,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        queryEditors: [
          {
            ...defaultQueryEditor,
            sql,
            queryLimit: 42,
            autorun: mode === 'automatic',
            templateParams: mode.includes('history')
              ? '{"origin":"active"}'
              : '{}',
            ...(mode === 'persisted-history' && {
              inLocalStorage: false,
              loaded: true,
              tabViewId: '11',
            }),
          },
        ],
        queries: mode.includes('history')
          ? {
              [historyQuery.id]: {
                ...historyQuery,
                ...(mode === 'persisted-history' && { sqlEditorId: '11' }),
              },
            }
          : {},
        databases: {
          2: {
            id: 2,
            backend: 'postgresql',
            allow_run_async: false,
            allows_cost_estimate: true,
            query_warning_state: 'ready',
            engine_information: { query_cost_warning_metric: 'total_cost' },
            query_cost_warning: {
              enabled: true,
              metric: 'total_cost',
              threshold: 10,
            },
          },
          [defaultQueryEditor.dbId!]: {
            id: defaultQueryEditor.dbId,
            backend: 'postgresql',
            allow_run_async: false,
            allows_cost_estimate: true,
            query_warning_state: 'ready',
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
  render(mode.includes('history') ? <TabbedSqlEditors /> : <ActiveEditor />, {
    store,
    useRedux: true,
  });
  return store;
}
const warning = {
  action: 'confirm',
  reason: 'warning',
  message: 'Above threshold',
  details: [
    { label: 'Estimated planner cost', value: '12.5 planner cost units' },
    { label: 'Warning threshold', value: '10 planner cost units' },
  ],
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

test.each([
  { messageOnly: false, executionFails: false },
  { messageOnly: true, executionFails: false },
  { messageOnly: true, executionFails: true },
])(
  'keyboard Run confirms captured SQL (message-only=$messageOnly, execution-error=$executionFails)',
  async ({ messageOnly, executionFails }) => {
    const store = setup('SELECT 1; SELECT 2;');
    if (messageOnly) {
      jest
        .mocked(isFeatureEnabled)
        .mockImplementation(
          flag => flag === FeatureFlag.SqlLabQueryCostWarnings,
        );
      const database = {
        ...store.getState().sqlLab.databases[defaultQueryEditor.dbId!],
        id: defaultQueryEditor.dbId!,
        allow_run_async: false,
        allows_cost_estimate: false,
        query_warning_state: 'ready' as const,
        query_cost_warning: { enabled: true },
        engine_information: {
          query_warning_supported: true,
          query_cost_warning_metric: null,
        },
      };
      act(() => {
        store.dispatch(setDatabases([database]));
      });
      fetchMock.modifyRoute('check', {
        response: {
          result: {
            action: 'confirm',
            reason: 'warning',
            message: 'Review this query.',
          },
        },
      });
    }
    if (executionFails) {
      fetchMock.modifyRoute('execution', {
        response: { status: 500, body: { message: 'Execution failed' } },
      });
    }
    act(() => {
      store.dispatch(
        queryEditorSetSelectedText(defaultQueryEditor, 'SELECT 2'),
      );
    });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'SQL editor' }), {
      key: 'Enter',
      ctrlKey: true,
    });
    await screen.findByRole('dialog', { name: 'Query warning' });
    expect(JSON.parse(String(estimates()[0].options.body)).sql).toBe(
      'SELECT 2',
    );
    expect(executions()).toHaveLength(0);
    if (messageOnly) {
      expect(screen.getByText('Review this query.')).toBeInTheDocument();
      expect(screen.queryByText('Warning threshold')).not.toBeInTheDocument();
    }
    const continueButton = screen.getByRole('button', { name: 'Run anyway' });
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);
    await waitFor(() => expect(executions()).toHaveLength(1));
    expect(JSON.parse(String(executions()[0].options.body)).sql).toBe(
      'SELECT 2',
    );
    if (executionFails) {
      await waitFor(() =>
        expect(Object.values(store.getState().sqlLab.queries)).toEqual([
          expect.objectContaining({
            sql: 'SELECT 2',
            state: 'failed',
            errorMessage: 'Execution failed',
          }),
        ]),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(estimates()).toHaveLength(1);
      expect(executions()).toHaveLength(1);
    }
  },
);

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

/** Start from the real QueryHistory row, action, reducer, and tab renderer. */
async function rerunFromHistory() {
  const store = setup('SELECT 1', 'history');
  fireEvent.click(await screen.findByRole('tab', { name: 'Query history' }));
  fireEvent.click(await screen.findByTestId('plus-circle'));
  await screen.findByRole('tab', {
    name: /Copy of Untitled Query 1/,
    selected: true,
  });
  return store;
}

test('history action opens a tab, checks its effective inputs, and executes that request once', async () => {
  fetchMock.modifyRoute('check', {
    response: {
      result: {
        ...warning,
        reason: 'unavailable',
        message: 'Templates cannot be estimated',
      },
    },
  });
  const store = await rerunFromHistory();
  await screen.findByRole('dialog');
  const checked = JSON.parse(String(estimates()[0].options.body));
  expect(checked).toEqual({
    check_warning: true,
    database_id: 2,
    catalog: 'historical_catalog',
    schema: 'historical_schema',
    sql: 'SELECT 99',
    query_limit: 42,
    template_params: { origin: 'active' },
  });
  expect(executions()).toHaveLength(0);
  const cloned = store
    .getState()
    .sqlLab.queryEditors.find(
      (qe: QueryEditor) =>
        qe.id === store.getState().sqlLab.tabHistory.slice(-1)[0],
    );
  expect(cloned?.id).not.toBe(defaultQueryEditor.id);
  fireEvent.click(screen.getByRole('button', { name: 'Run anyway' }));
  await waitFor(() => expect(executions()).toHaveLength(1));
  expect(JSON.parse(String(executions()[0].options.body))).toMatchObject({
    sql: checked.sql,
    database_id: checked.database_id,
    catalog: checked.catalog,
    schema: checked.schema,
    queryLimit: checked.query_limit,
    templateParams: '{"origin":"active"}',
    runAsync: false,
    sql_editor_id: cloned?.id,
  });
  expect(estimates()).toHaveLength(1);
});

test('cancelling history rerun confirmation keeps the new tab and never executes', async () => {
  const store = await rerunFromHistory();
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(executions()).toHaveLength(0);
  expect(store.getState().sqlLab.tabHistory.slice(-1)[0]).not.toBe(
    defaultQueryEditor.id,
  );
});

test.each(['button', 'shortcut'])(
  'history rerun Stop via %s ignores a late check',
  async method => {
    let finish: (body: object) => void = () => {};
    const pending = new Promise<object>(resolve => {
      finish = resolve;
    });
    fetchMock.modifyRoute('check', { response: () => pending });
    await rerunFromHistory();
    expect(await screen.findByRole('button', { name: /Stop$/ })).toBeEnabled();
    expect(executions()).toHaveLength(0);
    if (method === 'button') {
      fireEvent.click(screen.getByRole('button', { name: /Stop$/ }));
    } else {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'SQL editor' }), {
        key: 'e',
        ctrlKey: true,
      });
    }
    await act(async () => {
      finish({ result: { action: 'proceed' } });
      await fetchMock.callHistory.flush(true);
    });
    expect(executions()).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

test('ordinary autorun retains its existing direct execution path', async () => {
  setup('SELECT 1', 'automatic');
  await waitFor(() => expect(executions()).toHaveLength(1));
  expect(estimates()).toHaveLength(0);
});

test('explicit history intent survives the existing editor persistence filter', () => {
  expect(
    clearQueryEditors([
      { ...defaultQueryEditor, autorun: true, autorunSource: 'history' },
    ])[0],
  ).toMatchObject({ autorun: true, autorunSource: 'history' });
});

test('persisted history rerun waits for its server tab ID before capturing the checked request', async () => {
  jest
    .mocked(isFeatureEnabled)
    .mockImplementation(flag =>
      [
        FeatureFlag.EstimateQueryCost,
        FeatureFlag.SqlLabQueryCostWarnings,
        FeatureFlag.SqllabBackendPersistence,
      ].includes(flag),
    );
  fetchMock.get('glob:*/api/v1/query/*', { count: 0, result: [] });
  fetchMock.post('glob:*/tabstateview/', { id: 123 });
  const store = setup('SELECT 1', 'persisted-history');
  fireEvent.click(await screen.findByRole('tab', { name: 'Query history' }));
  fireEvent.click(await screen.findByTestId('plus-circle'));
  await screen.findByRole('tab', {
    name: /Copy of Untitled Query 1/,
    selected: true,
  });
  expect(estimates()).toHaveLength(0);
  expect(executions()).toHaveLength(0);
  const editor = store
    .getState()
    .sqlLab.queryEditors.find(
      (qe: QueryEditor) =>
        qe.id === store.getState().sqlLab.tabHistory.slice(-1)[0],
    );
  if (!editor) throw new Error('Expected the history tab');
  await act(async () => {
    await (store.dispatch as AppDispatch)(syncQueryEditor(editor));
  });
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Run anyway' }));
  await waitFor(() => expect(executions()).toHaveLength(1));
  expect(estimates()).toHaveLength(1);
  expect(JSON.parse(String(executions()[0].options.body))).toMatchObject({
    sql_editor_id: '123',
    sql: 'SELECT 99',
    queryLimit: 42,
    templateParams: '{"origin":"active"}',
  });
});
