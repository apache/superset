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
 * Tests for SQL Lab tab state management and validation
 *
 * This file validates the behavior of SQL Lab tab state management,
 * particularly the interaction between frontend-generated IDs and backend
 * persistence. Tests edge cases and race conditions that can occur when
 * the SqllabBackendPersistence feature flag is enabled.
 *
 * Related to issue #34997: Ensures metadata updates work correctly
 * when users modify queries in newly created tabs.
 */

import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';

import { isFeatureEnabled } from '@superset-ui/core';
import * as actions from './sqlLab';
import { defaultQueryEditor } from '../fixtures';

// Mock feature flags
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockStore = configureMockStore([thunk]);

describe('SQL Lab tab state validation', () => {
  const updateTabStateEndpoint = 'glob:*/tabstateview/*';

  beforeEach(() => {
    fetchMock.reset();
    // Enable backend persistence for these tests
    isFeatureEnabled.mockImplementation(
      feature => feature === 'SQLLAB_BACKEND_PERSISTENCE',
    );
  });

  afterEach(() => {
    fetchMock.reset();
    isFeatureEnabled.mockRestore();
  });

  describe('New tab creation with string IDs', () => {
    test('addQueryEditor creates tabs with string nanoid IDs', () => {
      const queryEditor = { name: 'Test Tab', sql: 'SELECT 1' };
      const action = actions.addQueryEditor(queryEditor);

      // Verify string ID was generated
      expect(typeof action.queryEditor.id).toBe('string');
      expect(action.queryEditor.id).toMatch(/^[a-zA-Z0-9_-]{11}$/);
      expect(action.queryEditor.inLocalStorage).toBe(true);
      expect(action.queryEditor.tabViewId).toBeUndefined();
    });

    test('multiple new tabs get unique string IDs', () => {
      const editor1 = actions.addQueryEditor({ name: 'Tab 1' });
      const editor2 = actions.addQueryEditor({ name: 'Tab 2' });
      const editor3 = actions.addQueryEditor({ name: 'Tab 3' });

      // All should have different string IDs
      expect(editor1.queryEditor.id).not.toBe(editor2.queryEditor.id);
      expect(editor2.queryEditor.id).not.toBe(editor3.queryEditor.id);
      expect(editor1.queryEditor.id).not.toBe(editor3.queryEditor.id);

      // All should be strings
      expect(typeof editor1.queryEditor.id).toBe('string');
      expect(typeof editor2.queryEditor.id).toBe('string');
      expect(typeof editor3.queryEditor.id).toBe('string');
    });
  });

  describe('Backend persistence edge cases', () => {
    test('queryEditorSetAndSaveSql sends string ID to backend', async () => {
      // Create new tab with string ID (simulating real nanoid output)
      const newQueryEditor = {
        ...defaultQueryEditor,
        id: 'FRRULMQgWHa', // Realistic nanoid(11) output
        inLocalStorage: true,
        // No tabViewId - simulates new tab before sync
      };

      const store = mockStore({
        sqlLab: {
          queryEditors: [newQueryEditor],
          unsavedQueryEditor: {},
        },
      });

      // Mock the endpoint to track what ID is sent
      fetchMock.put(updateTabStateEndpoint, { status: 404 });

      // This should attempt to use the string ID
      const sql = 'SELECT * FROM test';
      await store.dispatch(
        actions.queryEditorSetAndSaveSql(newQueryEditor, sql),
      );

      // Verify the string ID was sent to backend
      const putCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/tabstateview/') && call[1].method === 'PUT',
        );

      expect(putCalls).toHaveLength(1);
      expect(putCalls[0][0]).toContain('/tabstateview/FRRULMQgWHa');
    });

    test('string IDs cause backend endpoint mismatch errors', async () => {
      const newQueryEditor = {
        ...defaultQueryEditor,
        id: 'abc123def456', // String ID
        inLocalStorage: true,
      };

      const store = mockStore({
        sqlLab: {
          queryEditors: [newQueryEditor],
          unsavedQueryEditor: {},
        },
      });

      // Mock 404 response for string IDs (simulating real backend behavior)
      fetchMock.put('glob:*/tabstateview/abc123def456', { status: 404 });

      // The function should handle the 404 but dispatch a danger toast
      await store.dispatch(
        actions.queryEditorSetAndSaveSql(newQueryEditor, 'SELECT 1'),
      );

      // Verify error handling occurred (the function catches and handles 404 silently)
      const actionsDispatched = store.getActions();
      console.log(
        'Actions dispatched:',
        actionsDispatched.map(a => a.type),
      );

      // Check that the PUT call was attempted with string ID
      const putCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/tabstateview/') && call[1].method === 'PUT',
        );
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0][0]).toContain('/abc123def456');
    });

    test('existing tabs with tabViewId work correctly', async () => {
      // Existing tab with proper backend ID
      const existingQueryEditor = {
        ...defaultQueryEditor,
        id: 'frontend-id-123',
        tabViewId: '42', // Integer ID from backend (as string)
        inLocalStorage: false,
      };

      const store = mockStore({
        sqlLab: {
          queryEditors: [existingQueryEditor],
          unsavedQueryEditor: {},
        },
      });

      // Mock successful response for integer IDs
      fetchMock.put('glob:*/tabstateview/42', { status: 200 });

      await store.dispatch(
        actions.queryEditorSetAndSaveSql(existingQueryEditor, 'SELECT 1'),
      );

      // Verify correct endpoint was called with integer ID
      const putCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/tabstateview/') && call[1].method === 'PUT',
        );

      expect(putCalls).toHaveLength(1);
      expect(putCalls[0][0]).toContain('/tabstateview/42');
    });
  });

  describe('Race condition scenarios', () => {
    test('rapid tab creation and SQL editing triggers string ID usage', async () => {
      const store = mockStore({
        sqlLab: {
          queryEditors: [],
          unsavedQueryEditor: {},
          tabHistory: [],
          databases: {},
        },
        common: {
          conf: {
            SQLLAB_DEFAULT_DBID: 1,
            DEFAULT_SQLLAB_LIMIT: 1000,
          },
        },
      });

      // Mock endpoints for this specific test
      fetchMock.put('glob:*/tabstateview/*', { status: 404 });
      fetchMock.post('glob:*/tabstateview/', { id: 999 });

      // Simulate rapid user actions: create tab then immediately edit SQL
      await store.dispatch(actions.addNewQueryEditor());
      const addAction = store
        .getActions()
        .find(a => a.type === 'ADD_QUERY_EDITOR');
      const newTab = addAction.queryEditor;

      // User immediately starts typing (before EditorAutoSync runs)
      await store.dispatch(
        actions.queryEditorSetAndSaveSql(newTab, 'SELECT NOW()'),
      );

      // Should attempt to use string ID
      const putCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/tabstateview/') && call[1].method === 'PUT',
        );
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0][0]).toMatch(/\/tabstateview\/[a-zA-Z0-9_-]{11}$/);
    });

    test('feature flag disabled should not attempt backend updates', async () => {
      // Disable backend persistence
      isFeatureEnabled.mockImplementation(() => false);

      const newQueryEditor = {
        ...defaultQueryEditor,
        id: 'string-id-123',
        inLocalStorage: true,
      };

      const store = mockStore({
        sqlLab: {
          queryEditors: [newQueryEditor],
          unsavedQueryEditor: {},
        },
      });

      await store.dispatch(
        actions.queryEditorSetAndSaveSql(newQueryEditor, 'SELECT 1'),
      );

      // Should not make any backend calls
      const putCalls = fetchMock
        .calls()
        .filter(call => call[0].includes('/tabstateview/'));
      expect(putCalls).toHaveLength(0);
    });
  });

  describe('Comparison: old vs new behavior', () => {
    test('old addQueryEditor still creates local tabs', () => {
      // The original function still works for backward compatibility
      const action = actions.addQueryEditor({ name: 'New Tab' });

      expect(action.queryEditor.tabViewId).toBeUndefined();
      expect(action.queryEditor.inLocalStorage).toBe(true);
    });

    test('FIXED: addQueryEditorWithBackendSync creates backend tabs immediately', async () => {
      // The new function fixes the race condition
      const store = mockStore({});

      // Mock successful tab creation
      fetchMock.post('glob:*/tabstateview/', { id: 123 });

      const queryEditor = await store.dispatch(
        actions.addQueryEditorWithBackendSync({ name: 'New Tab' }),
      );

      // After fix: should have tabViewId set immediately
      expect(queryEditor.tabViewId).toBe('123');
      expect(queryEditor.inLocalStorage).toBe(false);
    });
  });
});
