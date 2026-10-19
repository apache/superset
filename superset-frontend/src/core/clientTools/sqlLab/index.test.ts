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

import type { sqlLab as sqlLabApi } from '@apache-superset/core';
import { sqlLab } from 'src/core/sqlLab';
import { navigation } from 'src/core/navigation';
import sqlLabTools from './index';

jest.mock('src/core/sqlLab', () => ({
  sqlLab: {
    getCurrentTab: jest.fn(),
    getTabs: jest.fn(),
    getDatabases: jest.fn(),
    createTab: jest.fn(),
    setActiveTab: jest.fn(),
    closeTab: jest.fn(),
    executeQuery: jest.fn(),
  },
}));
jest.mock('src/core/navigation', () => ({
  navigation: { getPage: jest.fn() },
}));

const mockSqlLab = jest.mocked(sqlLab);
const editor = {
  getValue: jest.fn(() => 'SELECT 1'),
  getSelectedText: jest.fn(() => '1'),
  setValue: jest.fn(),
};
const tab: sqlLabApi.Tab = {
  id: 'editor-1',
  title: 'Query 1',
  databaseId: 7,
  catalog: 'catalog',
  schema: 'public',
  panels: [],
  getEditor: jest.fn(async () => editor as unknown as sqlLabApi.Editor),
};

function invoke(name: string, input: unknown = {}) {
  const tool = sqlLabTools.find(item => item.name === `sqlLab__${name}`);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool.handler(input);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(navigation.getPage).mockReturnValue('sqllab');
  mockSqlLab.getCurrentTab.mockReturnValue(tab);
  mockSqlLab.getTabs.mockReturnValue([tab]);
  mockSqlLab.getDatabases.mockReturnValue([
    { id: 7, name: 'examples', catalogs: [], schemas: [] },
  ]);
});

test('resolves the current editor at invocation time', async () => {
  const tool = sqlLabTools[0];
  mockSqlLab.getCurrentTab.mockReturnValue({ ...tab, id: 'new-editor' });
  expect(await tool.handler({})).toEqual({
    success: true,
    editor_id: 'new-editor',
  });
});

test.each(sqlLabTools.map(tool => [tool.name]))(
  '%s fails outside SQL Lab without calling the SQL Lab API',
  async name => {
    jest.mocked(navigation.getPage).mockReturnValue('dashboard');
    const tool = sqlLabTools.find(item => item.name === name)!;
    expect(await tool.handler({})).toEqual({
      success: false,
      message: 'Open SQL Lab before using this tool',
    });
    expect(mockSqlLab.getCurrentTab).not.toHaveBeenCalled();
    expect(mockSqlLab.getTabs).not.toHaveBeenCalled();
    expect(mockSqlLab.executeQuery).not.toHaveBeenCalled();
  },
);

test('lists tab metadata without waiting for inactive editor handles', async () => {
  const inactive = { ...tab, id: 'inactive', getEditor: jest.fn() };
  mockSqlLab.getTabs.mockReturnValue([tab, inactive]);
  expect(await invoke('get_editor_tabs')).toEqual({
    success: true,
    editors: [tab, inactive].map(item => ({
      editor_id: item.id,
      title: item.title,
      databaseId: item.databaseId,
      catalog: item.catalog,
      schema: item.schema,
    })),
  });
  expect(tab.getEditor).not.toHaveBeenCalled();
  expect(inactive.getEditor).not.toHaveBeenCalled();
});

test('lists unvisited persisted tabs with an unknown database', async () => {
  mockSqlLab.getTabs.mockReturnValue([{ ...tab, databaseId: undefined }]);
  expect(await invoke('get_editor_tabs')).toMatchObject({
    success: true,
    editors: [{ editor_id: tab.id, databaseId: null }],
  });
});

test('reads SQL and selection from the requested editor without requiring it to be active', async () => {
  mockSqlLab.getCurrentTab.mockReturnValue(undefined);
  expect(await invoke('get_editor_sql', { editor_id: tab.id })).toMatchObject({
    success: true,
    editor: {
      editor_id: tab.id,
      sql: 'SELECT 1',
      selectedText: '1',
    },
  });
  expect(mockSqlLab.getCurrentTab).not.toHaveBeenCalled();
});

test('reading SQL reports errors from getEditor', async () => {
  const message = `SQL editor "${tab.id}" is not loaded. Switch to this tab to load it, then retry.`;
  jest.mocked(tab.getEditor).mockRejectedValueOnce(new Error(message));
  expect(await invoke('get_editor_sql', { editor_id: tab.id })).toEqual({
    success: false,
    message,
  });
  expect(tab.getEditor).toHaveBeenCalledTimes(1);
});

test.each([{}, { editor_id: '' }, { editor_id: 1 }])(
  'reading SQL requires a valid editor_id: %p',
  async input => {
    expect(await invoke('get_editor_sql', input)).toMatchObject({
      success: false,
    });
    expect(tab.getEditor).not.toHaveBeenCalled();
  },
);

test('lists only databases loaded in the frontend', async () => {
  expect(await invoke('get_databases')).toEqual({
    success: true,
    databases: [{ id: 7, name: 'examples' }],
  });
});

test.each(['SELECT 2', ''])(
  'replaces the editor SQL with %p without executing it',
  async sql => {
    expect(await invoke('update_editor_sql', { sql })).toEqual({
      success: true,
      editor_id: tab.id,
    });
    expect(editor.setValue).toHaveBeenCalledWith(sql);
    expect(mockSqlLab.executeQuery).not.toHaveBeenCalled();
  },
);

test.each([null, [], {}, { sql: 1 }])(
  'rejects invalid SQL input %p',
  async input => {
    expect(await invoke('update_editor_sql', input)).toMatchObject({
      success: false,
    });
    expect(editor.setValue).not.toHaveBeenCalled();
  },
);

test('updating with the existing SQL preserves the editor buffer', async () => {
  expect(await invoke('update_editor_sql', { sql: 'SELECT 1' })).toEqual({
    success: true,
    editor_id: tab.id,
  });
  expect(editor.getValue).toHaveBeenCalled();
  expect(editor.setValue).not.toHaveBeenCalled();
});

test.each(['get_current_editor_id', 'update_editor_sql', 'run_current_query'])(
  '%s fails when there is no active editor',
  async name => {
    mockSqlLab.getCurrentTab.mockReturnValue(undefined);
    expect(await invoke(name, { sql: 'SELECT 2' })).toEqual({
      success: false,
      message: 'No active SQL editor tab',
    });
    expect(mockSqlLab.executeQuery).not.toHaveBeenCalled();
  },
);

test.each(['get_editor_sql', 'switch_editor_tab', 'close_editor_tab'])(
  '%s validates the target tab before changing UI state',
  async name => {
    expect(await invoke(name, { editor_id: 'missing' })).toEqual({
      success: false,
      message: 'SQL editor "missing" not found',
    });
    expect(mockSqlLab.setActiveTab).not.toHaveBeenCalled();
    expect(mockSqlLab.closeTab).not.toHaveBeenCalled();
  },
);

test('switches to the requested tab', async () => {
  expect(await invoke('switch_editor_tab', { editor_id: tab.id })).toEqual({
    success: true,
    editor_id: tab.id,
  });
  expect(mockSqlLab.setActiveTab).toHaveBeenCalledWith(tab.id);
});

test('closes the requested tab', async () => {
  expect(await invoke('close_editor_tab', { editor_id: tab.id })).toEqual({
    success: true,
    editor_id: tab.id,
  });
  expect(mockSqlLab.closeTab).toHaveBeenCalledWith(tab.id);
});

test('creates a tab without executing SQL', async () => {
  mockSqlLab.createTab.mockResolvedValue({ ...tab, id: 'created' });
  expect(
    await invoke('create_editor_tab', {
      title: 'New query',
      databaseId: 7,
      sql: 'SELECT 2',
      schema: 'public',
    }),
  ).toMatchObject({ success: true, editor_id: 'created' });
  expect(mockSqlLab.createTab).toHaveBeenCalledWith({
    title: 'New query',
    databaseId: 7,
    sql: 'SELECT 2',
    schema: 'public',
  });
  expect(mockSqlLab.executeQuery).not.toHaveBeenCalled();
});

test.each([
  { title: 'New', databaseId: 99 },
  { title: 'New', databaseId: 7.5 },
  { title: '', databaseId: 7 },
  { title: 'New', databaseId: 7, sql: 42 },
  { title: 'New', databaseId: 7, schema: 42 },
])('validates new tab options before creation: %p', async input => {
  expect(await invoke('create_editor_tab', input)).toMatchObject({
    success: false,
  });
  expect(mockSqlLab.createTab).not.toHaveBeenCalled();
});

test('returns the client query ID when execution is initiated, without waiting for its outcome', async () => {
  mockSqlLab.executeQuery.mockResolvedValue('client-query-id');
  expect(await invoke('run_current_query')).toEqual({
    success: true,
    editor_id: tab.id,
    query_id: 'client-query-id',
  });
  expect(mockSqlLab.executeQuery).toHaveBeenCalledWith();
});

test('reports errors raised while handling a tool call', async () => {
  mockSqlLab.getCurrentTab.mockImplementationOnce(() => {
    throw new Error('Unable to read SQL Lab state');
  });
  expect(await invoke('run_current_query')).toEqual({
    success: false,
    message: 'Unable to read SQL Lab state',
  });
});
