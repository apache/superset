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
import fetchMock from 'fetch-mock';
import { createStore, waitFor } from 'spec/helpers/testing-library';
import { DEFAULT_BOOTSTRAP_DATA } from 'src/constants';
import { defaultQueryEditor, initialState } from 'src/SqlLab/fixtures';
import sqlLabReducer from 'src/SqlLab/reducers/sqlLab';
import type { SqlLabRootState } from 'src/SqlLab/types';
import type { AppDispatch } from 'src/views/store';
import * as actions from './sqlLab';

/** Resolve a response independently of other requests. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Exercise persistence and execution through the production reducer. */
function setup() {
  const editor = {
    ...defaultQueryEditor,
    sql: 'SELECT 42',
    inLocalStorage: true,
  };
  const state: SqlLabRootState = {
    ...initialState,
    user: { ...initialState.user, isAnonymous: false, groups: [] },
    common: {
      ...DEFAULT_BOOTSTRAP_DATA.common,
      conf: initialState.common.conf,
    },
    localStorageUsageInKilobytes: 0,
    sqlLab: {
      ...initialState.sqlLab,
      queryEditors: [editor],
      unsavedQueryEditor: {},
      tabHistory: [editor.id],
      queries: {},
      tables: [],
      destroyedQueryEditors: {},
      dbConnect: false,
      errorMessage: null,
      editorTabLastUpdatedAt: 0,
      lastUpdatedActiveTab: '',
    },
  };
  const store = createStore(state, {
    sqlLab: sqlLabReducer,
    common: (value = state.common) => value,
    user: (value = state.user) => value,
    messageToasts: (value = state.messageToasts) => value,
    localStorageUsageInKilobytes: (value = 0) => value,
  });
  const dispatch = store.dispatch as AppDispatch;
  const saveResponse = deferred<{ id: number }>();
  fetchMock.get(
    `glob:*/api/v1/database/${editor.dbId}`,
    {},
    { name: 'get-database' },
  );
  fetchMock.post('glob:*/tabstateview/', () => saveResponse.promise, {
    name: 'save-tab',
  });
  fetchMock.post(
    'glob:*/tabstateview/123/migrate_query',
    {},
    { name: 'migrate-query' },
  );
  fetchMock.put('glob:*/tabstateview/123', {}, { name: 'update-tab' });
  return {
    editor,
    getState: () => store.getState() as unknown as SqlLabRootState,
    dispatch,
    saveResponse,
  };
}

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test.each([
  { tabFirst: false, runAsync: false },
  { tabFirst: true, runAsync: false },
  { tabFirst: false, runAsync: true },
  { tabFirst: true, runAsync: true },
])(
  'migrates a query started during tab saving: tabFirst=$tabFirst async=$runAsync',
  async ({ tabFirst, runAsync }) => {
    const h = setup();
    const response = deferred<object>();
    fetchMock.post('glob:*/api/v1/sqllab/execute/*', () => response.promise, {
      name: 'execute',
    });
    const saving = h.dispatch(actions.syncQueryEditor(h.editor));
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('save-tab')).toHaveLength(1),
    );
    const query = actions.buildSqlEditorQuery(
      { id: h.editor.dbId!, allow_run_async: runAsync },
      h.editor,
      1000,
    );
    const running = h.dispatch(actions.runQuery(query));
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('execute')).toHaveLength(1),
    );
    if (tabFirst) {
      h.saveResponse.resolve({ id: 123 });
      await waitFor(() =>
        expect(h.getState().sqlLab.queryEditors[0].tabViewId).toBe('123'),
      );
      expect(fetchMock.callHistory.calls('migrate-query')).toHaveLength(0);
    }
    response.resolve({
      status: 'success',
      query: { rows: 1 },
      data: [{ value: 42 }],
      columns: [],
    });
    await running;
    if (!tabFirst) h.saveResponse.resolve({ id: 123 });
    await saving;
    const migrations = fetchMock.callHistory.calls('migrate-query');
    expect(migrations).toHaveLength(1);
    expect(
      JSON.parse(
        String((migrations[0].options.body as FormData).get('queryId')),
      ),
    ).toBe(query.id);
    expect(h.getState().sqlLab.queries[query.id]).toMatchObject({
      sqlEditorId: '123',
      sql: 'SELECT 42',
      state: runAsync ? 'pending' : 'success',
    });
    expect(fetchMock.callHistory.calls('execute')).toHaveLength(1);
  },
);

test('overlapping saves create one server tab and failures allow another attempt', async () => {
  const h = setup();
  fetchMock.modifyRoute('save-tab', {
    response: { status: 500, body: { message: 'Save failed' } },
  });
  await Promise.all([
    h.dispatch(actions.syncQueryEditor(h.editor)),
    h.dispatch(actions.syncQueryEditor(h.editor)),
  ]);
  expect(fetchMock.callHistory.calls('save-tab')).toHaveLength(1);
  expect(h.getState().sqlLab.queryEditors[0].inLocalStorage).toBe(true);
  fetchMock.modifyRoute('save-tab', { response: { id: 123 } });
  await h.dispatch(actions.syncQueryEditor(h.editor));
  expect(fetchMock.callHistory.calls('save-tab')).toHaveLength(2);
  expect(h.getState().sqlLab.queryEditors[0].tabViewId).toBe('123');
});

test('saving preserves edits made before switching to another tab', async () => {
  const h = setup();
  const saving = h.dispatch(actions.syncQueryEditor(h.editor));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('save-tab')).toHaveLength(1),
  );
  h.dispatch(actions.queryEditorSetSql(h.editor, 'SELECT 99'));
  h.dispatch(actions.queryEditorSetTitle(h.editor, 'Renamed', h.editor.id));
  h.dispatch(
    actions.addQueryEditor({ ...defaultQueryEditor, name: 'Other tab' }),
  );
  h.saveResponse.resolve({ id: 123 });
  await saving;
  expect(
    h.getState().sqlLab.queryEditors.find(e => e.id === h.editor.id),
  ).toMatchObject({
    sql: 'SELECT 99',
    name: 'Renamed',
    tabViewId: '123',
    inLocalStorage: false,
  });
  const updates = fetchMock.callHistory.calls('update-tab');
  expect(updates).toHaveLength(1);
  const payload = updates[0].options.body as FormData;
  expect(JSON.parse(String(payload.get('sql')))).toBe('SELECT 99');
  expect(JSON.parse(String(payload.get('label')))).toBe('Renamed');
});

test('closing a tab during creation schedules deletion of the newly saved tab', async () => {
  const h = setup();
  const saving = h.dispatch(actions.syncQueryEditor(h.editor));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('save-tab')).toHaveLength(1),
  );
  h.dispatch(actions.removeQueryEditor(h.editor));
  h.saveResponse.resolve({ id: 123 });
  await saving;
  expect(h.getState().sqlLab.queryEditors).toHaveLength(0);
  expect(h.getState().sqlLab.destroyedQueryEditors).toHaveProperty('123');
  expect(fetchMock.callHistory.calls('migrate-query')).toHaveLength(0);
});

test('a late query migration does not recreate a removed query', () => {
  const h = setup();
  h.dispatch({
    type: actions.MIGRATE_QUERY,
    queryId: 'removed',
    queryEditorId: '123',
  });
  expect(h.getState().sqlLab.queries).toEqual({});
});

test('a failed execution keeps its error after migration and is not retried', async () => {
  const h = setup();
  const response = deferred<{ status: number; body: { message: string } }>();
  fetchMock.post('glob:*/api/v1/sqllab/execute/*', () => response.promise, {
    name: 'execute',
  });
  const query = actions.buildSqlEditorQuery(null, h.editor, 1000);
  const running = h.dispatch(actions.runQuery(query));
  const saving = h.dispatch(actions.syncQueryEditor(h.editor));
  h.saveResponse.resolve({ id: 123 });
  await waitFor(() =>
    expect(h.getState().sqlLab.queryEditors[0].tabViewId).toBe('123'),
  );
  expect(fetchMock.callHistory.calls('migrate-query')).toHaveLength(0);
  response.resolve({ status: 500, body: { message: 'Execution failed' } });
  await Promise.all([running, saving]);
  expect(h.getState().sqlLab.queries[query.id]).toMatchObject({
    state: 'failed',
    errorMessage: 'Execution failed',
    sqlEditorId: '123',
  });
  expect(fetchMock.callHistory.calls('execute')).toHaveLength(1);
});

test.each([403, 404, 500])(
  'a failed migration (%s) does not claim the query was migrated',
  async status => {
    const h = setup();
    fetchMock.modifyRoute('migrate-query', {
      response: { status, body: { message: 'Migration failed' } },
    });
    const query = actions.buildSqlEditorQuery(null, h.editor, 1000);
    h.dispatch(actions.startQuery(query));
    const saving = h.dispatch(actions.syncQueryEditor(h.editor));
    h.saveResponse.resolve({ id: 123 });
    await saving;
    expect(h.getState().sqlLab.queries[query.id].sqlEditorId).toBe(h.editor.id);
    expect(fetchMock.callHistory.calls('migrate-query')).toHaveLength(1);
  },
);

test('closing a persisted tab while execution is pending skips migration', async () => {
  const h = setup();
  const response = deferred<object>();
  fetchMock.post('glob:*/api/v1/sqllab/execute/*', () => response.promise, {
    name: 'execute',
  });
  const query = actions.buildSqlEditorQuery(null, h.editor, 1000);
  const running = h.dispatch(actions.runQuery(query));
  const saving = h.dispatch(actions.syncQueryEditor(h.editor));
  h.saveResponse.resolve({ id: 123 });
  await waitFor(() =>
    expect(h.getState().sqlLab.queryEditors[0].tabViewId).toBe('123'),
  );
  h.dispatch(actions.removeQueryEditor(h.getState().sqlLab.queryEditors[0]));
  response.resolve({
    status: 'success',
    query: { rows: 1 },
    data: [],
    columns: [],
  });
  await Promise.all([running, saving]);
  expect(fetchMock.callHistory.calls('migrate-query')).toHaveLength(0);
  expect(h.getState().sqlLab.queryEditors).toHaveLength(0);
  expect(h.getState().sqlLab.destroyedQueryEditors).toHaveProperty('123');
});

test('a deleted original database does not clear a new selection or its tables', async () => {
  const h = setup();
  fetchMock.modifyRoute('get-database', { response: 404 });
  fetchMock.post(
    'glob:*/tableschemaview/',
    { id: 'saved-table' },
    { name: 'save-table' },
  );
  const saving = h.dispatch(actions.syncQueryEditor(h.editor));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('save-tab')).toHaveLength(1),
  );
  const dbId = h.editor.dbId + 1;
  h.dispatch(actions.queryEditorSetDb(h.editor, dbId));
  h.dispatch(actions.queryEditorSetSchema(h.editor, 'new_schema'));
  h.dispatch({
    type: actions.MERGE_TABLE,
    table: {
      id: 'new-table',
      dbId,
      queryEditorId: h.editor.id,
      name: 'new_table',
      schema: 'new_schema',
      expanded: true,
      inLocalStorage: true,
    },
  });
  h.saveResponse.resolve({ id: 123 });
  await saving;
  expect(actions.getUpToDateQuery(h.getState(), h.editor)).toMatchObject({
    dbId,
    schema: 'new_schema',
    tabViewId: '123',
  });
  expect(h.getState().sqlLab.tables).toEqual([
    expect.objectContaining({ id: 'saved-table', dbId, queryEditorId: '123' }),
  ]);
  const update = fetchMock.callHistory.calls('update-tab')[0].options
    .body as FormData;
  expect(JSON.parse(String(update.get('database_id')))).toBe(dbId);
  expect(JSON.parse(String(update.get('schema')))).toBe('new_schema');
});
