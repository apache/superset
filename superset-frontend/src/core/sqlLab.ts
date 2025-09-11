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
import { sqlLab as sqlLabType, core as coreType } from '@apache-superset/core';
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
import type { SqlLabRootState } from 'src/SqlLab/types';
import { Disposable, Editor, Panel, Tab } from './core';
import { createActionListener } from './utils';

const { CTASMethod } = sqlLabType;

export class CTAS implements sqlLabType.CTAS {
  method: sqlLabType.CTASMethod;

  tempTable: string;

  constructor(asView: boolean, tempTable: string) {
    this.method = asView ? CTASMethod.View : CTASMethod.Table;
    this.tempTable = tempTable;
  }
}

export class QueryContext implements sqlLabType.QueryContext {
  clientId: string;

  ctas: sqlLabType.CTAS | null;

  editor: Editor;

  requestedLimit: number | null;

  runAsync: boolean;

  startDttm: number;

  tab: Tab;

  private templateParams: string;

  private parsedParams: Record<string, any>;

  constructor(
    clientId: string,
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    options: {
      templateParams?: string;
      ctasMethod?: string;
      tempTable?: string;
      requestedLimit?: number;
    } = {},
  ) {
    this.clientId = clientId;
    this.tab = tab;
    this.runAsync = runAsync;
    this.startDttm = startDttm;
    this.requestedLimit = options.requestedLimit ?? null;
    this.ctas = options.tempTable
      ? new CTAS(options.ctasMethod === CTASMethod.View, options.tempTable)
      : null;
    this.templateParams = options.templateParams ?? '';
  }

  /**
   * A custom accessor is used to process JSON parsing only
   * when necessary for better performance.
   */
  get templateParameters() {
    if (this.parsedParams) {
      return this.parsedParams;
    }

    let parsed = {};
    try {
      parsed = JSON.parse(this.templateParams);
    } catch (e) {
      // ignore invalid format string.
    }
    this.parsedParams = parsed;

    return parsed;
  }
}

export class QueryResultContext
  extends QueryContext
  implements sqlLabType.QueryResultContext
{
  appliedLimit: number;

  appliedLimitingFactor: string;

  endDttm: number;

  executedSql: string;

  remoteId: number;

  result: sqlLabType.QueryResult;

  constructor(
    clientId: string,
    remoteId: number,
    executedSql: string,
    columns: sqlLabType.QueryResult['columns'],
    data: sqlLabType.QueryResult['data'],
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    endDttm: number,
    options: {
      appliedLimit?: number;
      appliedLimitingFactor?: string;
      templateParams?: string;
      ctasMethod?: string;
      tempTable?: string;
      requestedLimit?: number;
    } = {},
  ) {
    const { appliedLimit, appliedLimitingFactor, ...opt } = options;
    super(clientId, tab, runAsync, startDttm, opt);
    this.remoteId = remoteId;
    this.executedSql = executedSql;
    this.endDttm = endDttm;
    this.result = {
      columns,
      data,
    };
    this.appliedLimit = appliedLimit ?? data.length;
    this.appliedLimitingFactor = options.appliedLimitingFactor ?? '';
  }
}

export class QueryErrorResultContext
  extends QueryContext
  implements sqlLabType.QueryErrorResultContext
{
  endDttm: number;

  errorMessage: string;

  errors: coreType.SupersetError[] | null;

  executedSql: string | null;

  constructor(
    clientId: string,
    errorMessage: string,
    errors: coreType.SupersetError[],
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    options: {
      ctasMethod?: string;
      executedSql?: string;
      endDttm?: number;
      templateParams?: string;
      tempTable?: string;
      requestedLimist?: number;
      queryId?: number;
    } = {},
  ) {
    const { queryId, executedSql, endDttm, ...opt } = options;
    super(clientId, tab, runAsync, startDttm, opt);
    this.executedSql = executedSql ?? null;
    this.errorMessage = errorMessage;
    this.errors = errors;
    this.endDttm = endDttm ?? Date.now();
  }
}

const getActiveEditorImmutableId = () => {
  const { sqlLab }: { sqlLab: SqlLabRootState['sqlLab'] } = store.getState();
  const { queryEditors, tabHistory } = sqlLab;
  const activeEditorId = tabHistory[tabHistory.length - 1];
  const activeEditor = queryEditors.find(
    editor => editor.id === activeEditorId,
  );
  return activeEditor?.immutableId;
};

const activeEditorId = () => {
  const { sqlLab }: { sqlLab: SqlLabRootState['sqlLab'] } = store.getState();
  const { tabHistory } = sqlLab;
  return tabHistory[tabHistory.length - 1];
};

const getCurrentTab: typeof sqlLabType.getCurrentTab = () => {
  const { sqlLab }: { sqlLab: SqlLabRootState['sqlLab'] } = store.getState();
  const { queryEditors } = sqlLab;
  const queryEditor = queryEditors.find(
    editor => editor.id === activeEditorId(),
  );
  if (queryEditor) {
    const { id, name } = queryEditor;
    const editor = new Editor(
      queryEditor.sql,
      queryEditor.dbId!,
      queryEditor.catalog,
      queryEditor.schema,
      null, // TODO: Populate table if needed
    );
    const panels: Panel[] = []; // TODO: Populate panels

    return new Tab(id, name, editor, panels);
  }
  return undefined;
};

const predicate = (actionType: string): AnyListenerPredicate<RootState> => {
  // Capture the immutable ID of the active editor at the time the listener is created
  // This ID never changes for a tab, ensuring stable event routing
  const registrationImmutableId = getActiveEditorImmutableId();

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
      const { sqlLab }: { sqlLab: SqlLabRootState['sqlLab'] } =
        store.getState();
      const { queryEditors } = sqlLab;
      const queryEditor = queryEditors.find(
        editor => editor.id === action.queryEditor.id,
      );
      return queryEditor?.immutableId === registrationImmutableId;
    }

    // Fallback: do not allow the event if we can't determine the source
    return false;
  };
};

export const onDidQueryRun: typeof sqlLabType.onDidQueryRun = (
  listener: (queryContext: sqlLabType.QueryContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(START_QUERY),
    listener,
    (action: ReturnType<typeof startQuery>) => {
      const { query } = action;
      const {
        id,
        dbId,
        catalog,
        schema,
        sql,
        startDttm,
        ctas_method: ctasMethod,
        runAsync,
        tempTable,
        templateParams,
        queryLimit,
      } = query;
      const editor = new Editor(sql, dbId, catalog, schema);
      const panels: Panel[] = []; // TODO: Populate panels
      const tab = new Tab(query.sqlEditorId, query.tab, editor, panels);
      return new QueryContext(id, tab, runAsync, startDttm, {
        ctasMethod,
        tempTable,
        templateParams,
        requestedLimit: queryLimit,
      });
    },
    thisArgs,
  );

export const onDidQuerySuccess: typeof sqlLabType.onDidQuerySuccess = (
  listener: (queryResultContext: sqlLabType.QueryResultContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_SUCCESS),
    listener,
    (action: ReturnType<typeof querySuccess>) => {
      const { query, results } = action;
      const {
        id,
        dbId,
        catalog,
        schema,
        sql,
        startDttm,
        ctas_method: ctasMethod,
        runAsync,
        templateParams,
      } = query;
      const {
        query_id: queryId,
        columns,
        data,
        query: { endDttm, executedSql, tempTable, limit, limitingFactor },
      } = results;
      const editor = new Editor(sql, dbId, catalog, schema);
      const panels: Panel[] = []; // TODO: Populate panels
      const tab = new Tab(query.sqlEditorId, query.tab, editor, panels);
      return new QueryResultContext(
        id,
        queryId,
        executedSql ?? sql,
        columns,
        data,
        tab,
        runAsync,
        startDttm,
        endDttm,
        {
          ctasMethod,
          tempTable,
          templateParams,
          appliedLimit: limit,
          appliedLimitingFactor: limitingFactor,
        },
      );
    },
    thisArgs,
  );

export const onDidQueryStop: typeof sqlLabType.onDidQueryStop = (
  listener: (queryContext: sqlLabType.QueryContext) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(STOP_QUERY),
    listener,
    (action: ReturnType<typeof stopQuery>) => {
      const { query } = action;
      const {
        id,
        dbId,
        catalog,
        schema,
        sql,
        startDttm,
        ctas_method: ctasMethod,
        runAsync,
        tempTable,
        templateParams,
      } = query;
      const editor = new Editor(sql, dbId, catalog, schema);
      const panels: Panel[] = []; // TODO: Populate panels
      const tab = new Tab(query.sqlEditorId, query.tab, editor, panels);
      return new QueryContext(id, tab, runAsync, startDttm, {
        ctasMethod,
        tempTable,
        templateParams,
      });
    },
    thisArgs,
  );

export const onDidQueryFail: typeof sqlLabType.onDidQueryFail = (
  listener: (
    queryErrorResultContext: sqlLabType.QueryErrorResultContext,
  ) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_FAILED),
    listener,
    (action: ReturnType<typeof createQueryFailedAction>) => {
      const { query, msg: errorMessage, errors } = action;
      const {
        id,
        dbId,
        catalog,
        endDttm,
        executedSql,
        schema,
        sql,
        startDttm,
        ctas_method: ctasMethod,
        runAsync,
        templateParams,
        query_id: queryId,
        tempTable,
      } = query;
      const editor = new Editor(sql, dbId, catalog, schema);
      const panels: Panel[] = []; // TODO: Populate panels
      const tab = new Tab(query.sqlEditorId, query.tab, editor, panels);
      return new QueryErrorResultContext(
        id,
        errorMessage,
        errors,
        tab,
        runAsync,
        startDttm,
        {
          queryId,
          executedSql,
          endDttm,
          ctasMethod,
          tempTable,
          templateParams,
        },
      );
    },
    thisArgs,
  );

export const onDidChangeEditorDatabase: typeof sqlLabType.onDidChangeEditorDatabase =
  (listener: (e: number) => void, thisArgs?: any): Disposable =>
    createActionListener(
      predicate(QUERY_EDITOR_SETDB),
      listener,
      (action: {
        type: string;
        dbId?: number;
        queryEditor: { dbId: number };
      }) => action.dbId || action.queryEditor.dbId,
      thisArgs,
    );

const onDidChangeEditorContent: typeof sqlLabType.onDidChangeEditorContent =
  () => {
    throw new Error('Not implemented yet');
  };

const onDidChangeEditorCatalog: typeof sqlLabType.onDidChangeEditorCatalog =
  () => {
    throw new Error('Not implemented yet');
  };

const onDidChangeEditorSchema: typeof sqlLabType.onDidChangeEditorSchema =
  () => {
    throw new Error('Not implemented yet');
  };

const onDidChangeEditorTable: typeof sqlLabType.onDidChangeEditorTable = () => {
  throw new Error('Not implemented yet');
};

const onDidClosePanel: typeof sqlLabType.onDidClosePanel = () => {
  throw new Error('Not implemented yet');
};

const onDidChangeActivePanel: typeof sqlLabType.onDidChangeActivePanel = () => {
  throw new Error('Not implemented yet');
};

const onDidChangeTabTitle: typeof sqlLabType.onDidChangeTabTitle = () => {
  throw new Error('Not implemented yet');
};

const getDatabases: typeof sqlLabType.getDatabases = () => {
  throw new Error('Not implemented yet');
};

const getTabs: typeof sqlLabType.getTabs = () => {
  throw new Error('Not implemented yet');
};

const onDidCloseTab: typeof sqlLabType.onDidCloseTab = () => {
  throw new Error('Not implemented yet');
};

const onDidChangeActiveTab: typeof sqlLabType.onDidChangeActiveTab = () => {
  throw new Error('Not implemented yet');
};

const onDidRefreshDatabases: typeof sqlLabType.onDidRefreshDatabases = () => {
  throw new Error('Not implemented yet');
};

const onDidRefreshCatalogs: typeof sqlLabType.onDidRefreshCatalogs = () => {
  throw new Error('Not implemented yet');
};

const onDidRefreshSchemas: typeof sqlLabType.onDidRefreshSchemas = () => {
  throw new Error('Not implemented yet');
};

const onDidRefreshTables: typeof sqlLabType.onDidRefreshTables = () => {
  throw new Error('Not implemented yet');
};

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
