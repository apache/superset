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
import { sqlLab as sqlLabType } from '@apache-superset/core';
import {
  QUERY_FAILED,
  QUERY_SUCCESS,
  QUERY_EDITOR_SETDB,
  querySuccess,
  startQuery,
  START_QUERY,
  stopQuery,
  STOP_QUERY,
  createQueryFailedAction,
} from 'src/SqlLab/actions/sqlLab';
import { RootState, store } from 'src/views/store';
import { AnyListenerPredicate } from '@reduxjs/toolkit';
import memoizeOne from 'memoize-one';
import type { SqlLabRootState } from 'src/SqlLab/types';
import { Disposable } from '../models';
import { createActionListener } from '../utils';
import {
  Panel,
  Editor,
  Tab,
  QueryContext,
  QueryResultContext,
  QueryErrorResultContext,
} from './models';

const { CTASMethod } = sqlLabType;

const getSqlLabState = () => {
  const { sqlLab }: { sqlLab: SqlLabRootState['sqlLab'] } = store.getState();
  return sqlLab;
};

const activeEditorId = () => {
  const { tabHistory } = getSqlLabState();
  return tabHistory[tabHistory.length - 1];
};

const findQueryEditor = (editorId: string) => {
  const { queryEditors } = getSqlLabState();
  return queryEditors.find(editor => editor.id === editorId);
};

const createTab = (
  id: string,
  name: string,
  sql: string,
  dbId: number,
  catalog?: string,
  schema?: string,
  table?: any,
) => {
  const editor = new Editor(sql, dbId, catalog, schema, table);
  const panels: Panel[] = []; // TODO: Populate panels
  return new Tab(id, name, editor, panels);
};

const notImplemented = (): never => {
  throw new Error('Not implemented yet');
};

function extractBaseData(action: any): {
  baseParams: [string, Tab, boolean, number];
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

  const tab = createTab(sqlEditorId, tabName, sql, dbId, catalog, schema);

  return {
    baseParams: [id, tab, runAsync ?? false, startDttm ?? 0],
    options: {
      ctasMethod,
      tempTable,
      templateParams,
      requestedLimit: queryLimit,
    },
  };
}

function createQueryContext(
  action: ReturnType<typeof startQuery> | ReturnType<typeof stopQuery>,
): QueryContext {
  const { baseParams, options } = extractBaseData(action);
  return new QueryContext(...baseParams, options);
}

function createQueryResultContext(
  action: ReturnType<typeof querySuccess>,
): QueryResultContext {
  const { baseParams, options } = extractBaseData(action);
  const [_, tab] = baseParams;
  const { results } = action;
  const {
    query_id: queryId,
    columns,
    data,
    query: {
      endDttm,
      executedSql,
      tempTable: resultTempTable,
      limit,
      limitingFactor,
    },
  } = results;

  return new QueryResultContext(
    ...baseParams,
    queryId,
    executedSql ?? tab.editor.content,
    columns,
    data,
    endDttm,
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

  return new QueryErrorResultContext(...baseParams, errorMessage, errors, {
    ...options,
    queryId,
    executedSql: executedSql ?? null,
    endDttm: endDttm ?? Date.now(),
  });
}

const getCurrentTab: typeof sqlLabType.getCurrentTab = () => {
  const queryEditor = findQueryEditor(activeEditorId());
  if (queryEditor) {
    const { id, name, sql, dbId, catalog, schema } = queryEditor;
    return createTab(
      id,
      name,
      sql,
      dbId!,
      catalog ?? undefined,
      schema ?? undefined,
      undefined,
    );
  }
  return undefined;
};

const getActiveEditorImmutableId = () => {
  const { tabHistory } = getSqlLabState();
  const activeEditorId = tabHistory[tabHistory.length - 1];
  const activeEditor = findQueryEditor(activeEditorId);
  return activeEditor?.immutableId;
};

// Memoized version to avoid repeated store lookups when active editor hasn't changed
const getActiveEditorId = memoizeOne(getActiveEditorImmutableId);

const predicate = (actionType: string): AnyListenerPredicate<RootState> => {
  // Capture the immutable ID of the active editor at the time the listener is created
  // This ID never changes for a tab, ensuring stable event routing
  const registrationImmutableId = getActiveEditorId();

  return action => {
    if (action.type !== actionType) return false;

    // If we don't have a registration ID, don't filter events
    if (!registrationImmutableId) return true;

    // For query events, use the immutableId directly from the action payload
    if (action.query?.immutableId) {
      return action.query.immutableId === registrationImmutableId;
    }

    // For tab events, we need to find the immutable ID of the affected tab
    if (action.queryEditor?.id) {
      const queryEditor = findQueryEditor(action.queryEditor.id);
      return queryEditor?.immutableId === registrationImmutableId;
    }

    // Fallback: do not allow the event if we can't determine the source
    return false;
  };
};

const onDidQueryRun: typeof sqlLabType.onDidQueryRun = (
  listener: (queryContext: sqlLabType.QueryContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(START_QUERY),
    listener,
    (action: ReturnType<typeof startQuery>) => createQueryContext(action),
    thisArgs,
  );

const onDidQuerySuccess: typeof sqlLabType.onDidQuerySuccess = (
  listener: (queryResultContext: sqlLabType.QueryResultContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_SUCCESS),
    listener,
    (action: ReturnType<typeof querySuccess>) =>
      createQueryResultContext(action),
    thisArgs,
  );

const onDidQueryStop: typeof sqlLabType.onDidQueryStop = (
  listener: (queryContext: sqlLabType.QueryContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(STOP_QUERY),
    listener,
    (action: ReturnType<typeof stopQuery>) => createQueryContext(action),
    thisArgs,
  );

const onDidQueryFail: typeof sqlLabType.onDidQueryFail = (
  listener: (
    queryErrorResultContext: sqlLabType.QueryErrorResultContext,
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

const onDidChangeEditorDatabase: typeof sqlLabType.onDidChangeEditorDatabase = (
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

const onDidChangeEditorContent: typeof sqlLabType.onDidChangeEditorContent =
  notImplemented;
const onDidChangeEditorCatalog: typeof sqlLabType.onDidChangeEditorCatalog =
  notImplemented;
const onDidChangeEditorSchema: typeof sqlLabType.onDidChangeEditorSchema =
  notImplemented;
const onDidChangeEditorTable: typeof sqlLabType.onDidChangeEditorTable =
  notImplemented;
const onDidClosePanel: typeof sqlLabType.onDidClosePanel = notImplemented;
const onDidChangeActivePanel: typeof sqlLabType.onDidChangeActivePanel =
  notImplemented;
const onDidChangeTabTitle: typeof sqlLabType.onDidChangeTabTitle =
  notImplemented;
const getDatabases: typeof sqlLabType.getDatabases = notImplemented;
const getTabs: typeof sqlLabType.getTabs = notImplemented;
const onDidCloseTab: typeof sqlLabType.onDidCloseTab = notImplemented;
const onDidChangeActiveTab: typeof sqlLabType.onDidChangeActiveTab =
  notImplemented;
const onDidRefreshDatabases: typeof sqlLabType.onDidRefreshDatabases =
  notImplemented;
const onDidRefreshCatalogs: typeof sqlLabType.onDidRefreshCatalogs =
  notImplemented;
const onDidRefreshSchemas: typeof sqlLabType.onDidRefreshSchemas =
  notImplemented;
const onDidRefreshTables: typeof sqlLabType.onDidRefreshTables = notImplemented;

export const sqlLab: typeof sqlLabType = {
  CTASMethod,
  getCurrentTab,
  onDidChangeEditorContent,
  onDidChangeEditorDatabase,
  onDidChangeEditorCatalog,
  onDidChangeEditorSchema,
  onDidChangeEditorTable,
  onDidClosePanel,
  onDidChangeActivePanel,
  onDidChangeTabTitle,
  onDidQueryRun,
  onDidQueryStop,
  onDidQueryFail,
  onDidQuerySuccess,
  getDatabases,
  getTabs,
  onDidCloseTab,
  onDidChangeActiveTab,
  onDidRefreshDatabases,
  onDidRefreshCatalogs,
  onDidRefreshSchemas,
  onDidRefreshTables,
};

// Export all models
export * from './models';
