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
import { EditorHandle } from './editors';

/**
 * Provides imperative control over the code editor component.
 * Allows extensions to manipulate text content, cursor position,
 * selections, annotations, and register completion providers.
 */
export interface Editor extends EditorHandle {}

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
   * The database identifier for this tab's query context.
   * This determines which database the queries will be executed against.
   */
  databaseId: number;

  /**
   * The catalog name for this tab's query context.
   * Can be null if no specific catalog is selected (for multi-catalog databases like Trino).
   */
  catalog: string | null;

  /**
   * The schema name for this tab's query context.
   * Can be null if no schema is selected.
   */
  schema: string | null;

  /**
   * Gets the code editor instance for this tab.
   * Returns a Promise that resolves when the editor is ready.
   * The returned editor is a proxy that always delegates to the current
   * editor implementation, even if the editor is swapped (e.g., Ace to Monaco).
   *
   * @returns Promise that resolves to the Editor instance
   *
   * @example
   * ```typescript
   * const tab = sqlLab.getCurrentTab();
   * const editor = await tab.getEditor();
   * editor.setValue("SELECT * FROM users");
   * editor.focus();
   * ```
   */
  getEditor(): Promise<Editor>;

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
 * Gets the currently active panel in the current tab.
 * The active panel defaults to 'Results' when SQL Lab loads.
 *
 * @returns The current active panel object.
 *
 * @example
 * ```typescript
 * const panel = getActivePanel();
 * console.log(`Active panel: ${panel.id}`);
 * ```
 */
export declare const getActivePanel: () => Panel;

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
 *   console.log(`Database ID: ${tab.databaseId}, Schema: ${tab.schema}`);
 *
 *   // Editor manipulation via async getEditor()
 *   const editor = await tab.getEditor();
 *   editor.setValue("SELECT * FROM users");
 *   editor.focus();
 * }
 * ```
 */
export declare const getCurrentTab: () => Tab | undefined;

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
 * onDidQueryRun.event(async (query) => {
 *   console.log('Query started on database:', query.tab.databaseId);
 *   const editor = await query.tab.getEditor();
 *   console.log('Query SQL:', editor.getValue());
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
 *   console.log('Query stopped for database:', query.tab.databaseId);
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
 * Event fired when a new tab is created in SQL Lab.
 * Provides the newly created tab object as the event payload.
 *
 * @example
 * ```typescript
 * onDidCreateTab.event((tab) => {
 *   console.log('New tab created:', tab.title);
 *   // Initialize extension state for new tab
 * });
 * ```
 */
export declare const onDidCreateTab: Event<Tab>;

/**
 * Tab/Editor Management APIs
 *
 * These APIs allow extensions to create, close, and manage SQL Lab tabs.
 */

/**
 * Options for creating a new SQL Lab tab.
 */
export interface CreateTabOptions {
  /**
   * Initial SQL content for the editor.
   */
  sql?: string;

  /**
   * Display title for the tab.
   * If not provided, defaults to "Untitled Query N".
   */
  title?: string;

  /**
   * Database ID to connect to.
   * If not provided, inherits from the active tab or uses default.
   */
  databaseId?: number;

  /**
   * Catalog name (for multi-catalog databases like Trino).
   */
  catalog?: string | null;

  /**
   * Schema name for the query context.
   */
  schema?: string | null;
}

/**
 * Creates a new query editor tab in SQL Lab.
 *
 * @param options Optional configuration for the new tab
 * @returns The newly created tab object
 *
 * @example
 * ```typescript
 * // Create a tab with default settings
 * const tab = await createTab();
 *
 * // Create a tab with specific SQL and database
 * const tab = await createTab({
 *   sql: "SELECT * FROM users LIMIT 10",
 *   title: "User Query",
 *   databaseId: 1,
 *   schema: "public"
 * });
 * ```
 */
export declare function createTab(options?: CreateTabOptions): Promise<Tab>;

/**
 * Closes a specific tab in SQL Lab.
 *
 * @param tabId The ID of the tab to close
 * @returns Promise that resolves when the tab is closed
 *
 * @example
 * ```typescript
 * const tabs = getTabs();
 * if (tabs.length > 1) {
 *   await closeTab(tabs[0].id);
 * }
 * ```
 */
export declare function closeTab(tabId: string): Promise<void>;

/**
 * Switches to a specific tab in SQL Lab.
 *
 * @param tabId The ID of the tab to activate
 * @returns Promise that resolves when the tab is activated
 *
 * @example
 * ```typescript
 * const tabs = getTabs();
 * const targetTab = tabs.find(t => t.title === "My Query");
 * if (targetTab) {
 *   await setActiveTab(targetTab.id);
 * }
 * ```
 */
export declare function setActiveTab(tabId: string): Promise<void>;

/**
 * Query Execution APIs
 *
 * These APIs allow extensions to execute and control SQL queries.
 */

/**
 * Options for executing a SQL query.
 */
export interface QueryOptions {
  /**
   * SQL to execute without modifying editor content.
   * If not provided, uses the current editor content.
   */
  sql?: string;

  /**
   * Run only the selected text in the editor.
   * Ignored if `sql` option is provided.
   */
  selectedOnly?: boolean;

  /**
   * Override the query row limit.
   * If not provided, uses the tab's configured limit.
   */
  limit?: number;

  /**
   * Template parameters for Jinja templating.
   * Merged with existing template parameters from the editor.
   */
  templateParams?: Record<string, unknown>;

  /**
   * Create Table/View As Select options.
   * When provided, query results are stored in a new table instead of returned directly.
   */
  ctas?: {
    /**
     * Whether to create a TABLE or VIEW.
     */
    method: 'TABLE' | 'VIEW';

    /**
     * Name of the table or view to create.
     */
    tableName: string;
  };
}

/**
 * Executes a SQL query in the current tab.
 *
 * @param options Optional query execution options
 * @returns Promise that resolves with the query ID
 *
 * @example
 * ```typescript
 * // Execute the current editor content
 * const queryId = await executeQuery();
 *
 * // Execute custom SQL without modifying the editor
 * const queryId = await executeQuery({
 *   sql: "SELECT * FROM users LIMIT 10"
 * });
 *
 * // Execute only selected text
 * const queryId = await executeQuery({ selectedOnly: true });
 *
 * // Create a table from query results
 * const queryId = await executeQuery({
 *   ctas: { method: 'TABLE', tableName: 'my_results' }
 * });
 * ```
 */
export declare function executeQuery(options?: QueryOptions): Promise<string>;

/**
 * Cancels a running query.
 *
 * @param queryId The client ID of the query to cancel
 * @returns Promise that resolves when the cancellation request is sent
 *
 * @example
 * ```typescript
 * const queryId = await executeQuery();
 * // Later, if needed:
 * await cancelQuery(queryId);
 * ```
 */
export declare function cancelQuery(queryId: string): Promise<void>;

/**
 * Tab Context APIs
 *
 * These APIs manage tab-level query context and settings.
 * Text manipulation is handled directly via Editor (e.g., tab.editor.setValue(sql)).
 */

/**
 * Sets the database for the current tab.
 *
 * @param databaseId The ID of the database to set
 * @returns Promise that resolves when the database is updated
 *
 * @example
 * ```typescript
 * const databases = getDatabases();
 * const prodDb = databases.find(d => d.database_name === "production");
 * if (prodDb) {
 *   await setDatabase(prodDb.id);
 * }
 * ```
 */
export declare function setDatabase(databaseId: number): Promise<void>;

/**
 * Sets the catalog for the current tab.
 *
 * @param catalog The catalog name to set, or null to clear
 * @returns Promise that resolves when the catalog is updated
 *
 * @example
 * ```typescript
 * await setCatalog("hive_metastore");
 * ```
 */
export declare function setCatalog(catalog: string | null): Promise<void>;

/**
 * Sets the schema for the current tab.
 *
 * @param schema The schema name to set, or null to clear
 * @returns Promise that resolves when the schema is updated
 *
 * @example
 * ```typescript
 * await setSchema("public");
 * ```
 */
export declare function setSchema(schema: string | null): Promise<void>;
