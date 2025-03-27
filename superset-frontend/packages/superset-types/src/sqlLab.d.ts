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
import { Event, Database, Table, Schema } from './core';

export declare namespace sqlLab {
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
  }

  export interface Editor {
    /**
     * The content of the editor.
     */
    content: string;

    /**
     * The database name associated with the editor.
     */
    database: string;

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
    table: string;
  }

  export interface Panel {
    /**
     * Activate the panel in the UI.
     */
    activate(): void;

    /**
     * Dispose and free associated resources.
     */
    dispose(): void;
  }

  export const databases: Database[];

  export const tabs: Tab[];

  export const panels: Panel[];

  export const onDidRefreshDatabase: Event<Database>;

  export const onDidRefreshSchema: Event<Schema>;

  export const onDidRefreshTable: Event<Table>;

  export const onDidClosePanel: Event<Panel>;

  export const onDidCloseTab: Event<Panel>;

  export const onDidChangePanelState: Event<Panel>;

  export const onDidChangeTabState: Event<Tab>;

  export const onDidChangeActivePanel: Event<Panel>;

  export const onDidChangeActiveTab: Event<Tab>;

  // TODO: Check what's the state object for query events.
  // Now it's a string, but it should be an object with
  // properties like queryId, status, etc.

  export const onDidQueryStart: Event<string>;

  export const onDidQueryRun: Event<string>;

  export const onDidQueryStop: Event<string>;

  export const onDidQueryError: Event<string>;

  export const onDidQuerySuccess: Event<string>;
}
