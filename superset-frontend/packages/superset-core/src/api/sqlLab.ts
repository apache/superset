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

export declare namespace sqlLab {
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
    table: string | null;
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

  export const getCurrentTab: () => Tab;

  export const onDidChangeEditorContent: Event<string>;

  export const onDidChangeEditorDatabase: Event<number>;

  export const onDidChangeEditorCatalog: Event<string>;

  export const onDidChangeEditorSchema: Event<string>;

  export const onDidChangeEditorTable: Event<string>;

  export const onDidClosePanel: Event<Panel>;

  export const onDidChangeActivePanel: Event<Panel>;

  export const onDidChangeTabTitle: Event<string>;

  export const onDidQueryRun: Event<Editor>;

  export const onDidQueryStop: Event<Editor>;

  // TODO: Check what's the state object for onDidQueryFail and onDidQuerySuccess.
  // Now it's a string, but it should be an object with
  // properties like queryId, status, etc.

  export const onDidQueryFail: Event<string>;

  export const onDidQuerySuccess: Event<string>;

  /**
   * Events and functions that are globally available in the context of SQL Lab.
   */

  export const getDatabases: () => Database[];

  export const getTabs: () => Tab[];

  export const onDidCloseTab: Event<Tab>;

  export const onDidChangeActiveTab: Event<Tab>;

  export const onDidRefreshDatabases: Event<void>;

  export const onDidRefreshCatalogs: Event<void>;

  export const onDidRefreshSchemas: Event<void>;

  export const onDidRefreshTables: Event<void>;
}
