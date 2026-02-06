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
import { sqlLab as sqlLabApi } from '@apache-superset/core';
import { nanoid } from 'nanoid';
import {
  ADD_QUERY_EDITOR,
  QUERY_FAILED,
  QUERY_SUCCESS,
  QUERY_EDITOR_SETDB,
  QUERY_EDITOR_SET_SCHEMA,
  QUERY_EDITOR_SET_TITLE,
  REMOVE_QUERY_EDITOR,
  SET_ACTIVE_QUERY_EDITOR,
  SET_ACTIVE_SOUTHPANE_TAB,
  addQueryEditor,
  querySuccess,
  startQuery,
  START_QUERY,
  stopQuery as stopQueryAction,
  STOP_QUERY,
  createQueryFailedAction,
  setActiveQueryEditor,
  queryEditorSetDb,
  queryEditorSetCatalog,
  queryEditorSetSchema,
  runQuery as runQueryAction,
  postStopQuery,
  Query,
} from 'src/SqlLab/actions/sqlLab';
import { RootState, store } from 'src/views/store';
import { AnyListenerPredicate } from '@reduxjs/toolkit';
import type { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import { newQueryTabName } from 'src/SqlLab/utils/newQueryTabName';
import { Database, Disposable } from '../models';
import { createActionListener } from '../utils';
import {
  Panel,
  Tab,
  QueryContext,
  QueryResultContext,
  QueryErrorResultContext,
} from './models';

const { CTASMethod } = sqlLabApi;

const getSqlLabState = () => {
  const { sqlLab }: { sqlLab: SqlLabRootState['sqlLab'] } = store.getState();
  return sqlLab;
};

const activeEditorId = () => {
  const { tabHistory } = getSqlLabState();
  return tabHistory[tabHistory.length - 1];
};

const findQueryEditor = (editorId: string) => {
  const { queryEditors, unsavedQueryEditor } = getSqlLabState();
  const editor = queryEditors.find(qe => qe.id === editorId);
  if (!editor) return undefined;
  // Merge unsaved changes
  if (unsavedQueryEditor?.id === editorId) {
    return { ...editor, ...unsavedQueryEditor };
  }
  return editor;
};

/**
 * Registry for editor handles. Editor components register their handles here
 * when they mount, allowing the SQL Lab API to access them.
 */
const editorHandleRegistry = new Map<string, sqlLabApi.Editor>();

/**
 * Pending promises waiting for editor handles to be registered.
 */
const pendingEditorPromises = new Map<
  string,
  Array<(handle: sqlLabApi.Editor) => void>
>();

/**
 * Registers an editor handle for a tab. Called by EditorWrapper when it mounts.
 * Resolves any pending promises waiting for this editor.
 */
export const registerEditorHandle = (
  tabId: string,
  handle: sqlLabApi.Editor,
): void => {
  editorHandleRegistry.set(tabId, handle);

  // Resolve any pending promises waiting for this editor
  const pending = pendingEditorPromises.get(tabId);
  if (pending) {
    pending.forEach(resolve => resolve(handle));
    pendingEditorPromises.delete(tabId);
  }
};

/**
 * Unregisters an editor handle for a tab. Called when EditorWrapper unmounts.
 */
export const unregisterEditorHandle = (tabId: string): void => {
  editorHandleRegistry.delete(tabId);
};

/**
 * Creates a Proxy that always delegates to the current editor handle in the registry.
 * This handles editor hot-swapping (e.g., Ace to Monaco).
 */
const createEditorProxy = (tabId: string): sqlLabApi.Editor =>
  new Proxy({} as sqlLabApi.Editor, {
    get(_, prop: keyof sqlLabApi.Editor) {
      const handle = editorHandleRegistry.get(tabId);
      if (!handle) {
        throw new Error(`Editor handle not found for tab ${tabId}`);
      }
      const value = handle[prop];
      return typeof value === 'function' ? value.bind(handle) : value;
    },
  });

/**
 * Gets the editor for a tab, waiting for it to be registered if necessary.
 * Returns a Proxy that always delegates to the current handle.
 */
const getEditorAsync = (tabId: string): Promise<sqlLabApi.Editor> => {
  const existingHandle = editorHandleRegistry.get(tabId);
  if (existingHandle) {
    // Editor already registered, return proxy immediately
    return Promise.resolve(createEditorProxy(tabId));
  }

  // Wait for the editor to be registered
  return new Promise(resolve => {
    const pending = pendingEditorPromises.get(tabId) ?? [];
    pending.push(() => resolve(createEditorProxy(tabId)));
    pendingEditorPromises.set(tabId, pending);
  });
};

const makeTab = (
  id: string,
  name: string,
  dbId: number,
  catalog: string | null = null,
  schema: string | null = null,
  closed: boolean = false,
): Tab => {
  const panels: Panel[] = []; // TODO: Populate panels
  const editorGetter = closed
    ? () => Promise.reject(new Error(`Tab ${id} has been closed`))
    : () => getEditorAsync(id);
  return new Tab(id, name, dbId, catalog, schema, editorGetter, panels);
};

const getTab = (id: string): Tab | undefined => {
  const queryEditor = findQueryEditor(id);
  if (queryEditor?.dbId !== undefined) {
    const { name, dbId, catalog, schema } = queryEditor;
    return makeTab(id, name, dbId, catalog, schema);
  }
  return undefined;
};

type QueryAction =
  | ReturnType<typeof startQuery>
  | ReturnType<typeof stopQueryAction>
  | ReturnType<typeof querySuccess>
  | ReturnType<typeof createQueryFailedAction>;

function extractBaseData(action: QueryAction): {
  baseParams: [string, Tab, boolean, number];
  sql: string;
  options: {
    ctasMethod?: string;
    tempTable?: string;
    templateParams?: string;
    requestedLimit?: number;
  };
} {
  const { query } = action;
  const {
    id,
    sql,
    startDttm,
    runAsync,
    dbId,
    catalog,
    schema,
    sqlEditorId,
    tab: tabName,
    ctas_method: ctasMethod,
    tempTable,
    templateParams,
    queryLimit,
  } = query;

  const tab = makeTab(
    sqlEditorId ?? '',
    tabName ?? '',
    dbId ?? 0,
    catalog,
    schema,
  );

  return {
    baseParams: [id, tab, runAsync ?? false, startDttm ?? 0],
    sql,
    options: {
      ctasMethod,
      tempTable: tempTable ?? undefined,
      templateParams,
      requestedLimit: queryLimit,
    },
  };
}

function createQueryContext(
  action: ReturnType<typeof startQuery> | ReturnType<typeof stopQueryAction>,
): QueryContext {
  const { baseParams, options } = extractBaseData(action);
  return new QueryContext(...baseParams, options);
}

function createQueryResultContext(
  action: ReturnType<typeof querySuccess>,
): QueryResultContext {
  const { baseParams, sql, options } = extractBaseData(action);
  const { results } = action;
  const { query_id: queryId, columns, data, query } = results;
  const {
    endDttm,
    executedSql,
    tempTable: resultTempTable,
    limit,
    limitingFactor,
  } = query;

  // Map columns to ensure required fields are present
  const mappedColumns = columns.map(col => ({
    ...col,
    name: col.name || col.column_name,
    type: col.type ?? 'STRING', // Ensure type is not null
  }));

  return new QueryResultContext(
    ...baseParams,
    queryId ?? 0,
    executedSql ?? sql,
    mappedColumns,
    data,
    endDttm ?? 0,
    {
      ...options,
      tempTable: resultTempTable || options.tempTable,
      appliedLimit: limit,
      appliedLimitingFactor: limitingFactor,
    },
  );
}

function createQueryErrorContext(
  action: ReturnType<typeof createQueryFailedAction>,
): QueryErrorResultContext {
  const { baseParams, options } = extractBaseData(action);
  const { msg: errorMessage, errors, query } = action;
  const { endDttm, executedSql, query_id: queryId } = query;

  // Map errors to ensure 'extra' is not null (required by QueryErrorResultContext)
  const mappedErrors = (errors ?? []).map(err => ({
    ...err,
    extra: err.extra ?? {},
  }));

  return new QueryErrorResultContext(
    ...baseParams,
    errorMessage,
    mappedErrors,
    {
      ...options,
      queryId,
      executedSql: executedSql ?? undefined,
      endDttm: endDttm ?? Date.now(),
    },
  );
}

const getCurrentTab: typeof sqlLabApi.getCurrentTab = () =>
  getTab(activeEditorId());

const getActivePanel: typeof sqlLabApi.getActivePanel = () => {
  const { activeSouthPaneTab } = getSqlLabState();
  return new Panel(String(activeSouthPaneTab));
};

const getTabs: typeof sqlLabApi.getTabs = () => {
  const { queryEditors } = getSqlLabState();
  return queryEditors
    .map(qe => getTab(qe.id))
    .filter((tab): tab is Tab => tab !== undefined);
};

const getDatabases: typeof sqlLabApi.getDatabases = () => {
  const { databases } = getSqlLabState();
  return Object.values(databases).map(
    db => new Database(db.id, db.database_name, [], []),
  );
};

const getActiveEditorImmutableId = () => {
  const { tabHistory } = getSqlLabState();
  const activeEditorId = tabHistory[tabHistory.length - 1];
  const activeEditor = findQueryEditor(activeEditorId);
  return activeEditor?.immutableId;
};

const predicate = (actionType: string): AnyListenerPredicate<RootState> => {
  // Capture the immutable ID of the active editor at the time the listener is created
  // This ID never changes for a tab, ensuring stable event routing
  const registrationImmutableId = getActiveEditorImmutableId();

  return action => {
    if (action.type !== actionType) return false;

    // If we don't have a registration ID, don't filter events
    if (!registrationImmutableId) return true;

    // For query events, use the sqlEditorImmutableId directly from the action payload
    if (action.query?.sqlEditorImmutableId) {
      return action.query.sqlEditorImmutableId === registrationImmutableId;
    }

    // For tab events, we need to find the immutable ID of the affected tab
    const queryEditorId = action.queryEditor?.id || action.query?.sqlEditorId;
    if (queryEditorId) {
      const queryEditor = findQueryEditor(queryEditorId);
      return queryEditor?.immutableId === registrationImmutableId;
    }

    // Fallback: do not allow the event if we can't determine the source
    return false;
  };
};

// Simple predicate for global events not tied to a specific tab
const globalPredicate =
  (actionType: string): AnyListenerPredicate<RootState> =>
  action =>
    action.type === actionType;

const onDidQueryRun: typeof sqlLabApi.onDidQueryRun = (
  listener: (queryContext: sqlLabApi.QueryContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(START_QUERY),
    listener,
    (action: ReturnType<typeof startQuery>) => createQueryContext(action),
    thisArgs,
  );

const onDidQuerySuccess: typeof sqlLabApi.onDidQuerySuccess = (
  listener: (queryResultContext: sqlLabApi.QueryResultContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_SUCCESS),
    listener,
    (action: ReturnType<typeof querySuccess>) =>
      createQueryResultContext(action),
    thisArgs,
  );

const onDidQueryStop: typeof sqlLabApi.onDidQueryStop = (
  listener: (queryContext: sqlLabApi.QueryContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(STOP_QUERY),
    listener,
    (action: ReturnType<typeof stopQueryAction>) => createQueryContext(action),
    thisArgs,
  );

const onDidQueryFail: typeof sqlLabApi.onDidQueryFail = (
  listener: (
    queryErrorResultContext: sqlLabApi.QueryErrorResultContext,
  ) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_FAILED),
    listener,
    (action: ReturnType<typeof createQueryFailedAction>) =>
      createQueryErrorContext(action),
    thisArgs,
  );

const onDidChangeEditorDatabase: typeof sqlLabApi.onDidChangeEditorDatabase = (
  listener: (e: number) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_EDITOR_SETDB),
    listener,
    (action: { type: string; dbId?: number; queryEditor: { dbId: number } }) =>
      action.dbId || action.queryEditor.dbId,
    thisArgs,
  );

const onDidCloseTab: typeof sqlLabApi.onDidCloseTab = (
  listener: (tab: sqlLabApi.Tab) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    globalPredicate(REMOVE_QUERY_EDITOR),
    listener,
    (action: { type: string; queryEditor: QueryEditor }) =>
      // Construct tab from action data since the tab has already been removed from state
      // Pass closed=true so getEditor() rejects immediately instead of waiting forever
      makeTab(
        action.queryEditor.id,
        action.queryEditor.name ?? '',
        action.queryEditor.dbId ?? 0,
        action.queryEditor.catalog,
        action.queryEditor.schema,
        true, // closed
      ),
    thisArgs,
  );

const onDidChangeActiveTab: typeof sqlLabApi.onDidChangeActiveTab = (
  listener: (tab: sqlLabApi.Tab) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    globalPredicate(SET_ACTIVE_QUERY_EDITOR),
    listener,
    (action: { type: string; queryEditor: { id: string } }) =>
      getTab(action.queryEditor.id),
    thisArgs,
  );

const onDidChangeEditorSchema: typeof sqlLabApi.onDidChangeEditorSchema = (
  listener: (schema: string) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_EDITOR_SET_SCHEMA),
    listener,
    (action: { type: string; schema: string }) => action.schema,
    thisArgs,
  );

const onDidChangeActivePanel: typeof sqlLabApi.onDidChangeActivePanel = (
  listener: (panel: sqlLabApi.Panel) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    globalPredicate(SET_ACTIVE_SOUTHPANE_TAB),
    listener,
    (action: { type: string; tabId: string }) => new Panel(action.tabId),
    thisArgs,
  );

const onDidChangeTabTitle: typeof sqlLabApi.onDidChangeTabTitle = (
  listener: (title: string) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_EDITOR_SET_TITLE),
    listener,
    (action: { type: string; name: string }) => action.name,
    thisArgs,
  );

/**
 * Event fired when a new tab is created.
 */
const onDidCreateTab: typeof sqlLabApi.onDidCreateTab = (
  listener: (tab: sqlLabApi.Tab) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    globalPredicate(ADD_QUERY_EDITOR),
    listener,
    (action: { type: string; queryEditor: QueryEditor }) =>
      makeTab(
        action.queryEditor.id!,
        action.queryEditor.name ?? '',
        action.queryEditor.dbId ?? 0,
        action.queryEditor.catalog,
        action.queryEditor.schema ?? undefined,
      ),
    thisArgs,
  );

/**
 * Tab/Editor Management APIs
 */

const createTab: typeof sqlLabApi.createTab = async (
  options?: sqlLabApi.CreateTabOptions,
) => {
  const {
    sqlLab: { queryEditors, tabHistory, unsavedQueryEditor, databases },
    common,
  } = store.getState() as SqlLabRootState;

  const activeQueryEditor = queryEditors.find(
    (qe: QueryEditor) => qe.id === tabHistory[tabHistory.length - 1],
  );
  const dbIds = Object.values(databases).map(db => db.id);
  const defaultDbId = common?.conf?.SQLLAB_DEFAULT_DBID;
  const firstDbId = dbIds.length > 0 ? Math.min(...dbIds) : undefined;

  // Inherit from active tab or use defaults
  const inheritedValues = {
    ...queryEditors[0],
    ...activeQueryEditor,
    ...(unsavedQueryEditor?.id === activeQueryEditor?.id && unsavedQueryEditor),
  } as Partial<QueryEditor>;

  // Generate default name if no title provided
  const name =
    options?.title ??
    newQueryTabName(
      queryEditors?.map((qe: QueryEditor) => ({
        ...qe,
        ...(qe.id === unsavedQueryEditor?.id && unsavedQueryEditor),
      })) || [],
    );

  const newQueryEditor: Partial<QueryEditor> = {
    dbId:
      options?.databaseId ?? inheritedValues.dbId ?? defaultDbId ?? firstDbId,
    catalog: options?.catalog ?? inheritedValues.catalog,
    schema: options?.schema ?? inheritedValues.schema,
    sql: options?.sql ?? 'SELECT ...',
    queryLimit:
      inheritedValues.queryLimit ?? common?.conf?.DEFAULT_SQLLAB_LIMIT,
    autorun: false,
    name,
  };

  store.dispatch(addQueryEditor(newQueryEditor) as any);

  // Get the newly created tab
  const updatedState = store.getState() as SqlLabRootState;
  const newTab =
    updatedState.sqlLab.queryEditors[
      updatedState.sqlLab.queryEditors.length - 1
    ];

  return makeTab(
    newTab.id,
    newTab.name ?? '',
    newTab.dbId ?? 0,
    newTab.catalog,
    newTab.schema ?? undefined,
  );
};

const closeTab: typeof sqlLabApi.closeTab = async (tabId: string) => {
  const queryEditor = findQueryEditor(tabId);
  if (queryEditor) {
    store.dispatch({ type: REMOVE_QUERY_EDITOR, queryEditor });
  }
};

const setActiveTab: typeof sqlLabApi.setActiveTab = async (tabId: string) => {
  const queryEditor = findQueryEditor(tabId);
  if (queryEditor) {
    store.dispatch(setActiveQueryEditor(queryEditor as QueryEditor));
  }
};

const executeQuery: typeof sqlLabApi.executeQuery = async options => {
  const state = store.getState() as SqlLabRootState;
  const editorId = activeEditorId();
  const queryEditor = findQueryEditor(editorId);

  if (!queryEditor) {
    throw new Error('No active query editor');
  }

  const { databases, unsavedQueryEditor } = state.sqlLab;
  const qe = {
    ...queryEditor,
    ...(queryEditor.id === unsavedQueryEditor?.id && unsavedQueryEditor),
  } as QueryEditor;

  const database = qe.dbId ? databases[qe.dbId] : null;
  const defaultLimit = state.common?.conf?.DEFAULT_SQLLAB_LIMIT ?? 1000;

  // Determine SQL to execute
  let sql: string;
  let updateTabState = true;

  if (options?.sql !== undefined) {
    // Custom SQL provided - don't update tab state
    ({ sql } = options);
    updateTabState = false;
  } else if (options?.selectedOnly && qe.selectedText) {
    // Run selected text only
    sql = qe.selectedText;
    updateTabState = false;
  } else {
    // Default: use editor content (selected text takes precedence)
    sql = qe.selectedText || qe.sql;
    updateTabState = !qe.selectedText;
  }

  // Merge template parameters
  const templateParams = options?.templateParameters
    ? JSON.stringify({
        ...JSON.parse(qe.templateParams || '{}'),
        ...options.templateParameters,
      })
    : qe.templateParams;

  const queryId = nanoid(11);

  const query: Query = {
    id: queryId,
    dbId: qe.dbId,
    sql,
    sqlEditorId: qe.tabViewId ?? qe.id,
    sqlEditorImmutableId: qe.immutableId,
    tab: qe.name,
    catalog: qe.catalog,
    schema: qe.schema,
    tempTable: options?.ctas?.tableName,
    templateParams,
    queryLimit: options?.limit ?? qe.queryLimit ?? defaultLimit,
    runAsync: database ? database.allow_run_async : false,
    ctas: !!options?.ctas,
    ctas_method: options?.ctas?.method,
    updateTabState,
  };

  store.dispatch(runQueryAction(query));

  return queryId;
};

const cancelQuery: typeof sqlLabApi.cancelQuery = async (queryId: string) => {
  const state = store.getState() as SqlLabRootState;
  const query = state.sqlLab.queries[queryId];

  if (query) {
    // Dispatch stopQueryAction to emit STOP_QUERY event for onDidQueryStop listeners
    store.dispatch(stopQueryAction(query));
    // Dispatch postStopQuery to send HTTP request to cancel on server
    store.dispatch(postStopQuery(query as any) as any);
  }
};

const setDatabase: typeof sqlLabApi.setDatabase = async (
  databaseId: number,
) => {
  const queryEditor = findQueryEditor(activeEditorId());
  if (queryEditor) {
    store.dispatch(queryEditorSetDb(queryEditor, databaseId));
  }
};

const setCatalog: typeof sqlLabApi.setCatalog = async (
  catalog: string | null,
) => {
  const queryEditor = findQueryEditor(activeEditorId());
  store.dispatch(queryEditorSetCatalog(queryEditor ?? null, catalog));
};

const setSchema: typeof sqlLabApi.setSchema = async (schema: string | null) => {
  const queryEditor = findQueryEditor(activeEditorId());
  store.dispatch(queryEditorSetSchema(queryEditor ?? null, schema));
};

export const sqlLab: typeof sqlLabApi = {
  CTASMethod,
  getActivePanel,
  getCurrentTab,
  getDatabases,
  getTabs,
  onDidChangeEditorDatabase,
  onDidChangeEditorSchema,
  onDidChangeActivePanel,
  onDidChangeTabTitle,
  onDidQueryRun,
  onDidQueryStop,
  onDidQueryFail,
  onDidQuerySuccess,
  onDidCloseTab,
  onDidChangeActiveTab,
  onDidCreateTab,
  createTab,
  closeTab,
  setActiveTab,
  executeQuery,
  cancelQuery,
  setDatabase,
  setCatalog,
  setSchema,
};

// Export all models
export * from './models';
