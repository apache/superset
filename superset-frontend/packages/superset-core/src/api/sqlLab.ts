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
import { Event, Database } from './core';

export interface Editor {
  /**
   * The content of the editor.
   */
  content: string;

  /**
   * The database id associated with the editor.
   */
  databaseId: number;

  /**
   * The catalog name associated with the editor.
   */
  catalog: string | null;

  /**
   * The schema name associated with the editor.
   */
  schema: string;

  /**
   * The table name associated with the editor.
   */
  table: string | null; // TODO: Revisit if we actually need the table property
}

export interface Panel {
  /**
   * The unique identifier of the panel.
   */
  id: string;
}

export interface Tab {
  /**
   * The unique identifier of the tab.
   */
  id: string;

  /**
   * The title of the tab.
   */
  title: string;

  /**
   * The editor of the tab.
   */
  editor: Editor;

  /**
   * The panels associated with the tab.
   */
  panels: Panel[];
}

/**
 * Events and functions that are available in the context of a tab.
 */

export declare const getCurrentTab: () => Tab | undefined;

export declare const onDidChangeEditorContent: Event<string>;

export declare const onDidChangeEditorDatabase: Event<number>;

export declare const onDidChangeEditorCatalog: Event<string>;

export declare const onDidChangeEditorSchema: Event<string>;

export declare const onDidChangeEditorTable: Event<string>;

export declare const onDidClosePanel: Event<Panel>;

export declare const onDidChangeActivePanel: Event<Panel>;

export declare const onDidChangeTabTitle: Event<string>;

export declare const onDidQueryRun: Event<Editor>;

export declare const onDidQueryStop: Event<Editor>;

// TODO: Check what's the state object for onDidQueryFail and onDidQuerySuccess.
// Now it's a string, but it should be an object with
// properties like queryId, status, etc.

export declare const onDidQueryFail: Event<string>;

export declare const onDidQuerySuccess: Event<string>;

/**
 * Events and functions that are globally available in the context of SQL Lab.
 */

export declare const getDatabases: () => Database[];

export declare const getTabs: () => Tab[];

export declare const onDidCloseTab: Event<Tab>;

export declare const onDidChangeActiveTab: Event<Tab>;

export declare const onDidRefreshDatabases: Event<void>;

export declare const onDidRefreshCatalogs: Event<void>;

export declare const onDidRefreshSchemas: Event<void>;

export declare const onDidRefreshTables: Event<void>;
