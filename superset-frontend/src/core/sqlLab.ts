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
import type { sqlLab as sqlLabType } from '@apache-superset/core';
import {
  QUERY_FAILED,
  QUERY_SUCCESS,
  QUERY_EDITOR_SETDB,
  querySuccess,
} from 'src/SqlLab/actions/sqlLab';
import { RootState, store } from 'src/views/store';
import { AnyListenerPredicate } from '@reduxjs/toolkit';
import type { SqlLabRootState } from 'src/SqlLab/types';
import { Disposable, Editor, Panel, Tab } from './core';
import { createActionListener } from './utils';

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
  // Uses closure to capture the active editor ID at the time the listener is created
  const id = activeEditorId();
  return action =>
    // Compares the original id with the current active editor ID
    action.type === actionType && activeEditorId() === id;
};

export const onDidQueryRun: typeof sqlLabType.onDidQueryRun = (
  listener: (editor: sqlLabType.Editor) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_SUCCESS),
    listener,
    (action: ReturnType<typeof querySuccess>) => {
      const { query } = action;
      const { dbId, catalog, schema, sql } = query;
      return new Editor(sql, dbId, catalog, schema);
    },
    thisArgs,
  );

export const onDidQueryFail: typeof sqlLabType.onDidQueryFail = (
  listener: (e: string) => void,
  thisArgs?: any,
): Disposable =>
  createActionListener(
    predicate(QUERY_FAILED),
    listener,
    (action: {
      type: string;
      query: any;
      msg: string;
      link: any;
      errors: any;
    }) => action.msg,
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

const onDidQueryStop: typeof sqlLabType.onDidQueryStop = () => {
  throw new Error('Not implemented yet');
};

const onDidQuerySuccess: typeof sqlLabType.onDidQuerySuccess = () => {
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
