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
import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import type { QueryEditor } from 'src/SqlLab/types';
import sqlLabReducer from 'src/SqlLab/reducers/sqlLab';
import {
  START_QUERY,
  QUERY_SUCCESS,
  STOP_QUERY,
  QUERY_FAILED,
  QUERY_EDITOR_SETDB,
  QUERY_EDITOR_SET_SCHEMA,
  QUERY_EDITOR_SET_TITLE,
  SET_ACTIVE_SOUTHPANE_TAB,
  REMOVE_QUERY_EDITOR,
  SET_ACTIVE_QUERY_EDITOR,
  ADD_QUERY_EDITOR,
} from 'src/SqlLab/actions/sqlLab';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EDITOR_ID = 'editor-1';
const IMMUTABLE_ID = 'immutable-1';

// ---------------------------------------------------------------------------
// Test infrastructure — real reducer + real listener middleware
// ---------------------------------------------------------------------------

const mockListenerMiddleware = createListenerMiddleware();

function makeInitialSqlLabState() {
  return {
    queryEditors: [
      {
        id: EDITOR_ID,
        immutableId: IMMUTABLE_ID,
        name: 'Untitled Query 1',
        dbId: 1,
        catalog: null,
        schema: 'public',
        sql: 'SELECT 1',
        autorun: false,
        remoteId: null,
        loaded: true,
        inLocalStorage: true,
      } as unknown as QueryEditor,
    ],
    tabHistory: [EDITOR_ID],
    unsavedQueryEditor: {} as Record<string, unknown>,
    queries: {} as Record<string, unknown>,
    tables: [] as unknown[],
    databases: {
      1: { id: 1, database_name: 'test_db', allow_run_async: false },
    } as Record<string, unknown>,
    activeSouthPaneTab: 'Results' as string | number,
    queriesLastUpdate: 0,
    errorMessage: null as string | null,
    alerts: [] as unknown[],
    dbConnect: false,
    offline: false,
    editorTabLastUpdatedAt: 0,
    lastUpdatedActiveTab: EDITOR_ID,
    destroyedQueryEditors: {} as Record<string, number>,
  };
}

function createMockStore() {
  return configureStore({
    reducer: { sqlLab: sqlLabReducer },
    middleware: getDefault =>
      getDefault({ serializableCheck: false, immutableCheck: false }).prepend(
        mockListenerMiddleware.middleware,
      ),
    preloadedState: { sqlLab: makeInitialSqlLabState() as any },
  });
}

let mockStore = createMockStore();

// ---------------------------------------------------------------------------
// Mocks — must use "mock" prefix for jest.mock() scoping rules
// ---------------------------------------------------------------------------

jest.mock('nanoid', () => {
  let counter = 0;
  return {
    nanoid: jest.fn(() => {
      counter += 1;
      return `mock-nanoid-${counter}`;
    }),
  };
});

jest.mock('src/views/store', () => ({
  get store() {
    return mockStore;
  },
  get listenerMiddleware() {
    return mockListenerMiddleware;
  },
  setupStore: jest.fn(),
}));

// Module under test — imported after mocks
// eslint-disable-next-line import/first
import { sqlLab } from '.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  mockStore = createMockStore();
}

function makeQueryPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    sql: 'SELECT 1',
    sqlEditorId: EDITOR_ID,
    sqlEditorImmutableId: IMMUTABLE_ID,
    tab: 'Untitled Query 1',
    dbId: 1,
    catalog: null,
    schema: 'public',
    startDttm: 1000,
    runAsync: false,
    ...overrides,
  };
}

function makeSecondEditor() {
  return {
    id: 'editor-2',
    immutableId: 'immutable-2',
    name: 'Query 2',
    dbId: 2,
    catalog: null,
    schema: 'test_schema',
    sql: 'SELECT 2',
    autorun: false,
    remoteId: null,
    loaded: true,
    inLocalStorage: true,
  } as unknown as QueryEditor;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  mockListenerMiddleware.clearListeners();
  resetStore();
});

// ---------------------------------------------------------------------------
// Event Listeners (11 tests) + Predicate scoping (2 tests)
// ---------------------------------------------------------------------------

test('onDidQueryRun fires with QueryContext on START_QUERY', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidQueryRun(listener);

  const query = makeQueryPayload();
  mockStore.dispatch({ type: START_QUERY, query });

  expect(listener).toHaveBeenCalledTimes(1);
  const ctx = listener.mock.calls[0][0];
  expect(ctx.clientId).toBe('q-1');
  expect(ctx.tab.id).toBe(EDITOR_ID);
  expect(ctx.tab.databaseId).toBe(1);
  expect(ctx.runAsync).toBe(false);

  disposable.dispose();
});

test('onDidQuerySuccess fires with QueryResultContext on QUERY_SUCCESS', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidQuerySuccess(listener);

  const query = makeQueryPayload({ state: 'running' });
  // Add query to state first (reducer requires it for alterInObject)
  mockStore.dispatch({ type: START_QUERY, query });
  listener.mockClear();

  const results = {
    status: 'success',
    columns: [{ name: 'id', type: 'INT', column_name: 'id' }],
    data: [{ id: 1 }],
    query_id: 42,
    query: {
      endDttm: 2000,
      executedSql: 'SELECT 1',
      tempTable: null,
      limit: 100,
      limitingFactor: 'QUERY',
      rows: 1,
    },
  };

  mockStore.dispatch({ type: QUERY_SUCCESS, query, results });

  expect(listener).toHaveBeenCalledTimes(1);
  const ctx = listener.mock.calls[0][0];
  expect(ctx.remoteId).toBe(42);
  expect(ctx.executedSql).toBe('SELECT 1');
  expect(ctx.result.columns).toHaveLength(1);
  expect(ctx.result.data).toEqual([{ id: 1 }]);
  expect(ctx.endDttm).toBe(2000);

  disposable.dispose();
});

test('onDidQueryStop fires with QueryContext on STOP_QUERY', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidQueryStop(listener);

  const query = makeQueryPayload();
  mockStore.dispatch({ type: STOP_QUERY, query });

  expect(listener).toHaveBeenCalledTimes(1);
  const ctx = listener.mock.calls[0][0];
  expect(ctx.clientId).toBe('q-1');
  expect(ctx.tab.id).toBe(EDITOR_ID);

  disposable.dispose();
});

test('onDidQueryFail fires with QueryErrorResultContext on QUERY_FAILED', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidQueryFail(listener);

  const query = makeQueryPayload({ state: 'running' });
  // Add query to state first
  mockStore.dispatch({ type: START_QUERY, query });
  listener.mockClear();

  const errors = [
    {
      message: 'table not found',
      error_type: 'GENERIC_DB_ENGINE_ERROR',
      level: 'error',
      extra: { engine_name: 'PostgreSQL' },
    },
  ];

  mockStore.dispatch({
    type: QUERY_FAILED,
    query,
    msg: 'table not found',
    errors,
  });

  expect(listener).toHaveBeenCalledTimes(1);
  const ctx = listener.mock.calls[0][0];
  expect(ctx.errorMessage).toBe('table not found');
  expect(ctx.errors).toHaveLength(1);

  disposable.dispose();
});

test('onDidChangeEditorDatabase fires with dbId on QUERY_EDITOR_SETDB', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidChangeEditorDatabase(listener);

  const queryEditor = { id: EDITOR_ID, immutableId: IMMUTABLE_ID };
  mockStore.dispatch({ type: QUERY_EDITOR_SETDB, queryEditor, dbId: 5 });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(5);

  disposable.dispose();
});

test('onDidChangeEditorSchema fires with schema on QUERY_EDITOR_SET_SCHEMA', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidChangeEditorSchema(listener);

  const queryEditor = { id: EDITOR_ID, immutableId: IMMUTABLE_ID };
  mockStore.dispatch({
    type: QUERY_EDITOR_SET_SCHEMA,
    queryEditor,
    schema: 'information_schema',
  });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith('information_schema');

  disposable.dispose();
});

test('onDidChangeActivePanel fires with Panel on SET_ACTIVE_SOUTHPANE_TAB', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidChangeActivePanel(listener);

  mockStore.dispatch({ type: SET_ACTIVE_SOUTHPANE_TAB, tabId: 'History' });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].id).toBe('History');

  disposable.dispose();
});

test('onDidChangeTabTitle fires with title on QUERY_EDITOR_SET_TITLE', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidChangeTabTitle(listener);

  const queryEditor = { id: EDITOR_ID, immutableId: IMMUTABLE_ID };
  mockStore.dispatch({
    type: QUERY_EDITOR_SET_TITLE,
    queryEditor,
    name: 'My Query',
  });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith('My Query');

  disposable.dispose();
});

test('onDidCloseTab fires with Tab on REMOVE_QUERY_EDITOR', async () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidCloseTab(listener);

  const queryEditor = {
    id: EDITOR_ID,
    immutableId: IMMUTABLE_ID,
    name: 'Untitled Query 1',
    dbId: 1,
    catalog: null,
    schema: 'public',
  } as QueryEditor;

  mockStore.dispatch({ type: REMOVE_QUERY_EDITOR, queryEditor });

  expect(listener).toHaveBeenCalledTimes(1);
  const tab = listener.mock.calls[0][0];
  expect(tab.id).toBe(EDITOR_ID);
  expect(tab.title).toBe('Untitled Query 1');
  expect(tab.databaseId).toBe(1);

  // Closed-tab contract: getEditor() rejects immediately instead of waiting forever
  await expect(tab.getEditor()).rejects.toThrow(/closed/i);

  disposable.dispose();
});

test('onDidChangeActiveTab fires with Tab on SET_ACTIVE_QUERY_EDITOR', () => {
  // Add a second editor so switching back is a real change
  mockStore.dispatch({
    type: ADD_QUERY_EDITOR,
    queryEditor: makeSecondEditor(),
  });

  const listener = jest.fn();
  const disposable = sqlLab.onDidChangeActiveTab(listener);

  mockStore.dispatch({
    type: SET_ACTIVE_QUERY_EDITOR,
    queryEditor: { id: EDITOR_ID },
  });

  expect(listener).toHaveBeenCalledTimes(1);
  const tab = listener.mock.calls[0][0];
  expect(tab.id).toBe(EDITOR_ID);
  expect(tab.title).toBe('Untitled Query 1');
  expect(tab.databaseId).toBe(1);

  disposable.dispose();
});

test('onDidCreateTab fires with Tab on ADD_QUERY_EDITOR', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidCreateTab(listener);

  const newEditor = {
    id: 'new-tab',
    immutableId: 'new-immutable',
    name: 'New Query',
    dbId: 1,
    catalog: null,
    schema: 'public',
  } as QueryEditor;

  mockStore.dispatch({ type: ADD_QUERY_EDITOR, queryEditor: newEditor });

  expect(listener).toHaveBeenCalledTimes(1);
  const tab = listener.mock.calls[0][0];
  expect(tab.id).toBe('new-tab');
  expect(tab.title).toBe('New Query');
  expect(tab.databaseId).toBe(1);

  disposable.dispose();
});

// ---------------------------------------------------------------------------
// Predicate scoping — editor-scoped listeners ignore other editors' events
// ---------------------------------------------------------------------------

test('editor-scoped listener does not fire for a different editor', () => {
  // Add a second editor (ADD_QUERY_EDITOR makes it active)
  mockStore.dispatch({
    type: ADD_QUERY_EDITOR,
    queryEditor: makeSecondEditor(),
  });

  // Switch back to editor-1 so the predicate captures immutable-1
  mockStore.dispatch({
    type: SET_ACTIVE_QUERY_EDITOR,
    queryEditor: { id: EDITOR_ID },
  });

  // Register listener while editor-1 is active (predicate captures immutable-1)
  const listener = jest.fn();
  const disposable = sqlLab.onDidQueryRun(listener);

  // Dispatch START_QUERY for editor-2 — should be filtered out by predicate
  const query = makeQueryPayload({
    sqlEditorId: 'editor-2',
    sqlEditorImmutableId: 'immutable-2',
  });
  mockStore.dispatch({ type: START_QUERY, query });

  expect(listener).not.toHaveBeenCalled();

  disposable.dispose();
});

test('editor-scoped predicate filters tab events via queryEditor lookup', () => {
  // Add a second editor and switch back to editor-1
  mockStore.dispatch({
    type: ADD_QUERY_EDITOR,
    queryEditor: makeSecondEditor(),
  });
  mockStore.dispatch({
    type: SET_ACTIVE_QUERY_EDITOR,
    queryEditor: { id: EDITOR_ID },
  });

  // Register listener while editor-1 is active (predicate captures immutable-1)
  const listener = jest.fn();
  const disposable = sqlLab.onDidChangeEditorDatabase(listener);

  // Dispatch QUERY_EDITOR_SETDB for editor-2 — predicate uses findQueryEditor lookup (Path B)
  mockStore.dispatch({
    type: QUERY_EDITOR_SETDB,
    queryEditor: { id: 'editor-2', immutableId: 'immutable-2' },
    dbId: 99,
  });

  expect(listener).not.toHaveBeenCalled();

  disposable.dispose();
});

test('globalPredicate listener fires for a non-active tab', () => {
  // Add editor-2 and switch to it
  mockStore.dispatch({
    type: ADD_QUERY_EDITOR,
    queryEditor: makeSecondEditor(),
  });
  mockStore.dispatch({
    type: SET_ACTIVE_QUERY_EDITOR,
    queryEditor: { id: 'editor-2' },
  });

  const listener = jest.fn();
  const disposable = sqlLab.onDidCloseTab(listener);

  // Close editor-1 while editor-2 is active — globalPredicate should still fire
  const queryEditor = {
    id: EDITOR_ID,
    immutableId: IMMUTABLE_ID,
    name: 'Untitled Query 1',
    dbId: 1,
    catalog: null,
    schema: 'public',
  } as QueryEditor;
  mockStore.dispatch({ type: REMOVE_QUERY_EDITOR, queryEditor });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].id).toBe(EDITOR_ID);

  disposable.dispose();
});

// ---------------------------------------------------------------------------
// Disposable pattern
// ---------------------------------------------------------------------------

test('dispose() stops the listener from receiving events', () => {
  const listener = jest.fn();
  const disposable = sqlLab.onDidChangeActivePanel(listener);

  // Dispatch a real change (initial state is 'Results', switch to 'History')
  mockStore.dispatch({ type: SET_ACTIVE_SOUTHPANE_TAB, tabId: 'History' });
  expect(listener).toHaveBeenCalledTimes(1);

  disposable.dispose();

  mockStore.dispatch({ type: SET_ACTIVE_SOUTHPANE_TAB, tabId: 'Query' });
  expect(listener).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// Imperative Functions (7 tests)
// ---------------------------------------------------------------------------

test('getCurrentTab returns the active tab with correct properties', () => {
  const tab = sqlLab.getCurrentTab();

  expect(tab).toBeDefined();
  expect(tab!.id).toBe(EDITOR_ID);
  expect(tab!.title).toBe('Untitled Query 1');
  expect(tab!.databaseId).toBe(1);
  expect(tab!.schema).toBe('public');
});

test('getActivePanel returns the active south pane tab', () => {
  const panel = sqlLab.getActivePanel();
  expect(panel.id).toBe('Results');
});

test('getTabs returns all open tabs', () => {
  const tabs = sqlLab.getTabs();

  expect(tabs).toHaveLength(1);
  expect(tabs[0].id).toBe(EDITOR_ID);
  expect(tabs[0].title).toBe('Untitled Query 1');
});

test('getDatabases returns all available databases', () => {
  const databases = sqlLab.getDatabases();

  expect(databases).toHaveLength(1);
  expect(databases[0].id).toBe(1);
  expect(databases[0].name).toBe('test_db');
});

test('createTab dispatches ADD_QUERY_EDITOR and returns the new tab', async () => {
  const tab = await sqlLab.createTab({ title: 'Custom Tab', sql: 'SELECT 42' });

  expect(tab).toBeDefined();
  expect(tab.title).toBe('Custom Tab');
  const tabs = sqlLab.getTabs();
  expect(tabs.length).toBeGreaterThanOrEqual(2);
});

test('setActiveTab switches the active tab', async () => {
  // Create a second tab first
  await sqlLab.createTab({ title: 'Second Tab' });

  // Switch back to the original tab
  await sqlLab.setActiveTab(EDITOR_ID);

  const currentTab = sqlLab.getCurrentTab();
  expect(currentTab).toBeDefined();
  expect(currentTab!.id).toBe(EDITOR_ID);
});

test('setActivePanel dispatches SET_ACTIVE_SOUTHPANE_TAB', async () => {
  await sqlLab.setActivePanel('History');

  const panel = sqlLab.getActivePanel();
  expect(panel.id).toBe('History');
});
