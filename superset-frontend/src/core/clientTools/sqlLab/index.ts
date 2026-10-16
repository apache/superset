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

import type { chat, sqlLab as sqlLabApi } from '@apache-superset/core';
import { navigation } from 'src/core/navigation';
import { sqlLab } from 'src/core/sqlLab';

const emptySchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};
const editorIdSchema = {
  type: 'object',
  properties: { editor_id: { type: 'string', minLength: 1 } },
  required: ['editor_id'],
  additionalProperties: false,
};

/** Validates inputs even when a consumer invokes a handler without schema validation. */
function inputObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Expected an object input');
  }
  return input as Record<string, unknown>;
}

/** Reads a required string, allowing an empty SQL buffer. */
function stringInput(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || (key !== 'sql' && !value.trim())) {
    throw new Error(`Expected a string for "${key}"`);
  }
  return value;
}

/** Resolves the active tab at invocation time. */
function currentTab(): sqlLabApi.Tab {
  const tab = sqlLab.getCurrentTab();
  if (!tab) throw new Error('No active SQL editor tab');
  return tab;
}

/** Resolves a target before APIs that silently ignore missing tab IDs are called. */
function targetTab(input: unknown): sqlLabApi.Tab {
  const editorId = stringInput(inputObject(input), 'editor_id');
  const tab = sqlLab.getTabs().find(item => item.id === editorId);
  if (!tab) throw new Error(`SQL editor "${editorId}" not found`);
  return tab;
}

/** Serializes tab metadata without waiting for inactive editors to mount. */
function tabMetadata(tab: sqlLabApi.Tab) {
  return {
    editor_id: tab.id,
    title: tab.title,
    databaseId: tab.databaseId ?? null,
    catalog: tab.catalog,
    schema: tab.schema,
  };
}

/** SQL Lab tools backed exclusively by the existing frontend API. */
const sqlLabTools: chat.ClientTool[] = [
  {
    name: 'sqlLab__get_current_editor_id',
    description: 'Get the ID of the active SQL Lab editor tab.',
    inputSchema: emptySchema,
    annotations: { readOnlyHint: true },
    handler: () => ({ success: true, editor_id: currentTab().id }),
  },
  {
    name: 'sqlLab__get_editor_tabs',
    description:
      'List open SQL Lab tabs and their database, catalog, and schema. Switch tabs before reading or editing their SQL.',
    inputSchema: emptySchema,
    annotations: { readOnlyHint: true },
    handler: () => ({
      success: true,
      editors: sqlLab.getTabs().map(tabMetadata),
    }),
  },
  {
    name: 'sqlLab__get_databases',
    description: 'List database IDs and names already loaded in SQL Lab.',
    inputSchema: emptySchema,
    annotations: { readOnlyHint: true },
    handler: () => ({
      success: true,
      databases: sqlLab.getDatabases().map(({ id, name }) => ({ id, name })),
    }),
  },
  {
    name: 'sqlLab__get_editor_sql',
    description: 'Read the active SQL Lab editor SQL, selection, and metadata.',
    inputSchema: emptySchema,
    annotations: { readOnlyHint: true },
    handler: async () => {
      const tab = currentTab();
      const editor = await tab.getEditor();
      return {
        success: true,
        editor: {
          ...tabMetadata(tab),
          sql: editor.getValue(),
          selectedText: editor.getSelectedText(),
        },
      };
    },
  },
  {
    name: 'sqlLab__update_editor_sql',
    description:
      'Replace the SQL in the active SQL Lab editor without running or saving it as a saved query.',
    inputSchema: {
      type: 'object',
      properties: { sql: { type: 'string' } },
      required: ['sql'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
    handler: async input => {
      const sql = stringInput(inputObject(input), 'sql');
      const tab = currentTab();
      const editor = await tab.getEditor();
      editor.setValue(sql);
      return { success: true, editor_id: tab.id };
    },
  },
  {
    name: 'sqlLab__create_editor_tab',
    description:
      'Open a SQL Lab tab without executing SQL. Use get_databases to find a database ID.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1 },
        databaseId: { type: 'integer', minimum: 1 },
        sql: { type: 'string' },
        catalog: { type: 'string' },
        schema: { type: 'string' },
      },
      required: ['title', 'databaseId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    handler: async input => {
      const args = inputObject(input);
      const title = stringInput(args, 'title');
      const { databaseId } = args;
      if (
        typeof databaseId !== 'number' ||
        !Number.isInteger(databaseId) ||
        !sqlLab.getDatabases().some(db => db.id === databaseId)
      ) {
        throw new Error('Expected a databaseId available in SQL Lab');
      }
      const options: sqlLabApi.CreateTabOptions = { title, databaseId };
      if (args.sql !== undefined) options.sql = stringInput(args, 'sql');
      for (const key of ['catalog', 'schema'] as const) {
        const value = args[key];
        if (value !== undefined && typeof value !== 'string') {
          throw new Error(`Expected a string for "${key}"`);
        }
        if (value !== undefined) options[key] = value;
      }
      const tab = await sqlLab.createTab(options);
      return { success: true, ...tabMetadata(tab) };
    },
  },
  {
    name: 'sqlLab__switch_editor_tab',
    description: 'Activate an open SQL Lab tab by editor_id.',
    inputSchema: editorIdSchema,
    annotations: { readOnlyHint: false, destructiveHint: false },
    handler: async input => {
      const tab = targetTab(input);
      await sqlLab.setActiveTab(tab.id);
      return { success: true, editor_id: tab.id };
    },
  },
  {
    name: 'sqlLab__close_editor_tab',
    description: 'Close an open SQL Lab tab, discarding its editor buffer.',
    inputSchema: editorIdSchema,
    annotations: { readOnlyHint: false, destructiveHint: true },
    handler: async input => {
      const tab = targetTab(input);
      await sqlLab.closeTab(tab.id);
      return { success: true, editor_id: tab.id };
    },
  },
  {
    name: 'sqlLab__run_current_query',
    description:
      'Trigger SQL Lab Run on the active editor, executing the selection if present, otherwise the full SQL. Success confirms initiation only. Use SQL Lab query success/failure events for the outcome.',
    inputSchema: emptySchema,
    annotations: { readOnlyHint: false, destructiveHint: true },
    handler: async () => {
      const tab = currentTab();
      const queryId = await sqlLab.executeQuery();
      return { success: true, editor_id: tab.id, query_id: queryId };
    },
  },
];

export default sqlLabTools.map(tool => ({
  ...tool,
  handler: async (input: unknown) => {
    try {
      if (navigation.getPage() !== 'sqllab') {
        throw new Error('Open SQL Lab before using this tool');
      }
      return await tool.handler(input);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
}));
