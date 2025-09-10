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

/**
 * @fileoverview SQL Lab API for Superset extensions.
 *
 * This module provides interfaces and functions for integrating with Superset's SQL Lab,
 * allowing extensions to interact with SQL editors, tabs, panels, and query execution.
 * Extensions can listen to various events and access current state information.
 *
 * The API is organized into two main categories:
 * - Tab-scoped APIs: Functions and events available within the context of a specific tab
 * - Global APIs: Functions and events available across the entire SQL Lab interface
 */

import { Event, Database, SupersetError, Column } from './core';

/**
 * Represents an SQL editor instance within a SQL Lab tab.
 * Contains the editor content and associated database connection information.
 */
export interface Editor {
  /**
   * The SQL content of the editor.
   * This represents the current text in the SQL editor.
   */
  content: string;

  /**
   * The database identifier associated with the editor.
   * This determines which database the queries will be executed against.
   */
  databaseId: number;

  /**
   * The catalog name associated with the editor.
   * Can be null if no specific catalog is selected.
   */
  catalog: string | null;

  /**
   * The schema name associated with the editor.
   * Defines the database schema context for the editor.
   */
  schema: string;

  /**
   * The table name associated with the editor.
   * Can be null if no specific table is selected.
   *
   * @todo Revisit if we actually need the table property
   */
  table: string | null;
}

/**
 * Represents a panel within a SQL Lab tab.
 * Panels can display query results, database schema information, or other tools.
 */
export interface Panel {
  /**
   * The unique identifier of the panel.
   * Used to distinguish between different panels in the same tab.
   */
  id: string;
}

/**
 * Represents a tab in the SQL Lab interface.
 * Each tab contains an SQL editor and can have multiple associated panels.
 */
export interface Tab {
  /**
   * The unique identifier of the tab.
   * Used to identify and manage specific tabs.
   */
  id: string;

  /**
   * The display title of the tab.
   * This is what users see in the tab header.
   */
  title: string;

  /**
   * The SQL editor instance associated with this tab.
   * Contains the editor content and database connection settings.
   */
  editor: Editor;

  /**
   * The panels associated with the tab.
   * Panels provide additional functionality like result display and schema browsing.
   */
  panels: Panel[];
}

export enum CTASMethod {
  Table = 'TABLE',
  View = 'VIEW',
}

export interface CTAS {
  /**
   * Create method for CTAS creation request.
   */
  method: CTASMethod;

  /**
   * Temporary table name for creation using a CTAS query.
   */
  tempTable: string | null;
}

export interface QueryContext {
  /**
   * Unique query ID on client side.
   */
  clientId: string;

  /**
   * Contains CTAS if the query requests table creation.
   */
  ctas: CTAS | null;

  /**
   * The SQL editor instance associated with the query.
   */
  editor: Editor;

  /**
   * Requested row limit for the query.
   */
  requestedLimit: number | null;

  /**
   * True if the query execution result will be/was delivered asynchronously
   */
  runAsync?: boolean;

  /**
   * Start datetime for the query in a numerical timestamp
   */
  startDttm: number;

  /**
   * The tab instance associated with the request query
   */
  tab: Tab;

  /**
   * A key-value JSON associated with Jinja template variables
   */
  templateParameters: Record<string, any>;
}

export interface QueryErrorResultContext extends QueryContext {
  /**
   * Finished datetime for the query in a numerical timestamp
   */
  endDttm: number;

  /**
   * Error message returned from DB engine
   */
  errorMessage: string;

  /**
   * Error details in a SupersetError structure
   */
  errors: SupersetError[] | null;

  /**
   * Executed SQL after parsing Jinja templates.
   */
  executedSql: string | null;
}

export interface QueryResultContext extends QueryContext {
  /**
   * Actual number of rows returned by the query.
   */
  appliedLimit: number;

  /**
   * Major factor that is determining the row limit of the query results.
   */
  appliedLimitingFactor: string;

  /**
   * Finished datetime for the query in a numerical timestamp.
   */
  endDttm: number;

  /**
   * Executed SQL after parsing Jinja templates.
   */
  executedSql: string;

  /**
   * Remote query id stored in backend.
   */
  remoteId: number;

  /**
   * Query result data and metadata.
   */
  result: QueryResult;
}

export interface QueryResult {
  /**
   * Column metadata associated with the query result.
   */
  columns: Column[];

  /**
   * Query result data.
   */
  data: Record<string, any>[];
}

/**
 * Tab-scoped Events and Functions
 *
 * These APIs are available within the context of a specific SQL Lab tab and provide
 * access to tab-specific state and events.
 */

/**
 * Gets the currently active tab in SQL Lab.
 *
 * @returns The current tab object, or undefined if no tab is active.
 *
 * @example
 * ```typescript
 * const tab = getCurrentTab();
 * if (tab) {
 *   console.log(`Active tab: ${tab.title}`);
 *   console.log(`Database ID: ${tab.editor.databaseId}`);
 * }
 * ```
 */
export declare const getCurrentTab: () => Tab | undefined;

/**
 * Event fired when the content of the SQL editor changes.
 * Provides the new content as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeEditorContent.event((newContent) => {
 *   console.log('Editor content changed:', newContent.length, 'characters');
 * });
 * ```
 */
export declare const onDidChangeEditorContent: Event<string>;

/**
 * Event fired when the database selection changes in the editor.
 * Provides the new database ID as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeEditorDatabase.event((databaseId) => {
 *   console.log('Database changed to:', databaseId);
 * });
 * ```
 */
export declare const onDidChangeEditorDatabase: Event<number>;

/**
 * Event fired when the catalog selection changes in the editor.
 * Provides the new catalog name as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeEditorCatalog.event((catalog) => {
 *   console.log('Catalog changed to:', catalog);
 * });
 * ```
 */
export declare const onDidChangeEditorCatalog: Event<string>;

/**
 * Event fired when the schema selection changes in the editor.
 * Provides the new schema name as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeEditorSchema.event((schema) => {
 *   console.log('Schema changed to:', schema);
 * });
 * ```
 */
export declare const onDidChangeEditorSchema: Event<string>;

/**
 * Event fired when the table selection changes in the editor.
 * Provides the new table name as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeEditorTable.event((table) => {
 *   console.log('Table changed to:', table);
 * });
 * ```
 */
export declare const onDidChangeEditorTable: Event<string>;

/**
 * Event fired when a panel is closed in the current tab.
 * Provides the closed panel object as the event payload.
 *
 * @example
 * ```typescript
 * onDidClosePanel.event((panel) => {
 *   console.log('Panel closed:', panel.id);
 * });
 * ```
 */
export declare const onDidClosePanel: Event<Panel>;

/**
 * Event fired when the active panel changes in the current tab.
 * Provides the newly active panel object as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeActivePanel.event((panel) => {
 *   console.log('Active panel changed to:', panel.id);
 * });
 * ```
 */
export declare const onDidChangeActivePanel: Event<Panel>;

/**
 * Event fired when the title of the current tab changes.
 * Provides the new title as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeTabTitle.event((title) => {
 *   console.log('Tab title changed to:', title);
 * });
 * ```
 */
export declare const onDidChangeTabTitle: Event<string>;

/**
 * Event fired when a query starts running in the current tab.
 * Provides the query request state at the time of query execution.
 *
 * @example
 * ```typescript
 * onDidQueryRun.event((query) => {
 *   console.log('Query started on database:', query.tab.editor.databaseId);
 *   console.log('Query content:', query.tab.editor.content);
 * });
 * ```
 */
export declare const onDidQueryRun: Event<QueryContext>;

/**
 * Event fired when a running query is stopped in the current tab.
 * Provides the query request state when the query was stopped.
 *
 * @example
 * ```typescript
 * onDidQueryStop.event((query) => {
 *   console.log('Query stopped for database:', query.tab.editor.databaseId);
 * });
 * ```
 */
export declare const onDidQueryStop: Event<QueryContext>;

/**
 * Event fired when a query fails in the current tab.
 *
 * @todo Check what's the state object for onDidQueryFail and onDidQuerySuccess.
 * Currently it's a string, but it should be an object with properties like queryId, status, etc.
 *
 * @example
 * ```typescript
 * onDidQueryFail.event((result) => {
 *   console.error('Query failed:', result.errorMessage);
 * });
 * ```
 */
export declare const onDidQueryFail: Event<QueryErrorResultContext>;

/**
 * Event fired when a query succeeds in the current tab.
 *
 * @todo Check what's the state object for onDidQueryFail and onDidQuerySuccess.
 * Currently it's a string, but it should be an object with properties like queryId, status, etc.
 *
 * @example
 * ```typescript
 * onDidQuerySuccess.event((query) => {
 *   console.log('Query succeeded:', query.result.data);
 *   console.log('Query executed content:', query.executedSql);
 * });
 * ```
 */
export declare const onDidQuerySuccess: Event<QueryResultContext>;

/**
 * Global Events and Functions
 *
 * These APIs are available across the entire SQL Lab interface and provide
 * access to global state and events that affect the overall SQL Lab experience.
 */

/**
 * Gets all available databases in the Superset instance.
 *
 * @returns An array of database objects that the current user has access to.
 *
 * @example
 * ```typescript
 * const databases = getDatabases();
 * console.log(`Available databases: ${databases.length}`);
 * databases.forEach(db => {
 *   console.log(`- ${db.database_name} (ID: ${db.id})`);
 * });
 * ```
 */
export declare const getDatabases: () => Database[];

/**
 * Gets all tabs currently open in SQL Lab.
 *
 * @returns An array of all open tab objects.
 *
 * @example
 * ```typescript
 * const tabs = getTabs();
 * console.log(`Open tabs: ${tabs.length}`);
 * tabs.forEach(tab => {
 *   console.log(`- ${tab.title} (ID: ${tab.id})`);
 * });
 * ```
 */
export declare const getTabs: () => Tab[];

/**
 * Event fired when a tab is closed in SQL Lab.
 * Provides the closed tab object as the event payload.
 *
 * @example
 * ```typescript
 * onDidCloseTab.event((tab) => {
 *   console.log('Tab closed:', tab.title);
 *   // Clean up any tab-specific resources
 * });
 * ```
 */
export declare const onDidCloseTab: Event<Tab>;

/**
 * Event fired when the active tab changes in SQL Lab.
 * Provides the newly active tab object as the event payload.
 *
 * @example
 * ```typescript
 * onDidChangeActiveTab.event((tab) => {
 *   console.log('Active tab changed to:', tab.title);
 *   // Update UI based on new active tab
 * });
 * ```
 */
export declare const onDidChangeActiveTab: Event<Tab>;

/**
 * Event fired when the databases list is refreshed.
 * This can happen when new databases are added or existing ones are modified.
 *
 * @example
 * ```typescript
 * onDidRefreshDatabases.event(() => {
 *   console.log('Databases refreshed, updating UI...');
 *   const updatedDatabases = getDatabases();
 *   // Update UI with new database list
 * });
 * ```
 */
export declare const onDidRefreshDatabases: Event<void>;

/**
 * Event fired when the catalogs list is refreshed for the current database.
 * This typically happens when switching databases or when catalog metadata is updated.
 *
 * @example
 * ```typescript
 * onDidRefreshCatalogs.event(() => {
 *   console.log('Catalogs refreshed');
 *   // Update catalog dropdown or related UI
 * });
 * ```
 */
export declare const onDidRefreshCatalogs: Event<void>;

/**
 * Event fired when the schemas list is refreshed for the current database/catalog.
 * This happens when switching databases/catalogs or when schema metadata is updated.
 *
 * @example
 * ```typescript
 * onDidRefreshSchemas.event(() => {
 *   console.log('Schemas refreshed');
 *   // Update schema dropdown or related UI
 * });
 * ```
 */
export declare const onDidRefreshSchemas: Event<void>;

/**
 * Event fired when the tables list is refreshed for the current database/catalog/schema.
 * This happens when switching schema contexts or when table metadata is updated.
 *
 * @example
 * ```typescript
 * onDidRefreshTables.event(() => {
 *   console.log('Tables refreshed');
 *   // Update table browser or autocomplete suggestions
 * });
 * ```
 */
export declare const onDidRefreshTables: Event<void>;
