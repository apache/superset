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
 * Tests for SQL Lab immediate backend persistence functionality
 *
 * This file tests the addQueryEditorWithBackendSync function that
 * immediately creates backend tabs when SqllabBackendPersistence is enabled,
 * ensuring consistent state management and preventing race conditions
 * between frontend tab creation and backend synchronization.
 *
 * Related to issue #34997: Prevents metadata update failures by ensuring
 * tabs have valid backend IDs before users can modify them.
 */

import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';

import { isFeatureEnabled } from '@superset-ui/core';
import * as actions from './sqlLab';

// Mock feature flags
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockStore = configureMockStore([thunk]);

describe('SQL Lab immediate backend persistence', () => {
  beforeEach(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    fetchMock.reset();
    isFeatureEnabled.mockRestore();
  });

  describe('with backend persistence enabled', () => {
    beforeEach(() => {
      isFeatureEnabled.mockImplementation(
        feature => feature === 'SQLLAB_BACKEND_PERSISTENCE',
      );
    });

    test('creates backend tab immediately and returns tabViewId', async () => {
      const store = mockStore({});
      const queryEditor = { name: 'Test Tab', sql: 'SELECT 1' };

      // Mock successful backend creation
      fetchMock.post('glob:*/tabstateview/', { id: 42 });

      const result = await store.dispatch(
        actions.addQueryEditorWithBackendSync(queryEditor),
      );

      // Verify backend call was made
      const postCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/tabstateview/') && call[1].method === 'POST',
        );
      expect(postCalls).toHaveLength(1);

      // Verify action was dispatched with backend ID
      const addActions = store
        .getActions()
        .filter(action => action.type === 'ADD_QUERY_EDITOR');
      expect(addActions).toHaveLength(1);
      expect(addActions[0].queryEditor.tabViewId).toBe('42');
      expect(addActions[0].queryEditor.inLocalStorage).toBe(false);
      expect(addActions[0].queryEditor.loaded).toBe(true);

      // Verify returned query editor
      expect(result.tabViewId).toBe('42');
      expect(result.inLocalStorage).toBe(false);
    });

    test('falls back to local storage on backend failure', async () => {
      const store = mockStore({});
      const queryEditor = { name: 'Test Tab', sql: 'SELECT 1' };

      // Mock backend failure
      fetchMock.post('glob:*/tabstateview/', { status: 500 });

      const result = await store.dispatch(
        actions.addQueryEditorWithBackendSync(queryEditor),
      );

      // Verify fallback action was dispatched
      const actionsDispatched = store.getActions();
      const addActions = actionsDispatched.filter(
        action => action.type === 'ADD_QUERY_EDITOR',
      );
      const toastActions = actionsDispatched.filter(
        action => action.type === 'ADD_TOAST',
      );

      expect(addActions).toHaveLength(1);
      expect(addActions[0].queryEditor.tabViewId).toBeUndefined();
      expect(addActions[0].queryEditor.inLocalStorage).toBe(true);

      // Should have error toast
      expect(toastActions).toHaveLength(1);

      // Verify returned query editor (fallback)
      expect(result.tabViewId).toBeUndefined();
      expect(result.inLocalStorage).toBe(true);
    });

    test('SQL updates work immediately after tab creation', async () => {
      const store = mockStore({
        sqlLab: {
          queryEditors: [],
          unsavedQueryEditor: {},
        },
      });

      // Mock backend tab creation
      fetchMock.post('glob:*/tabstateview/', { id: 123 });
      // Mock SQL update
      fetchMock.put('glob:*/tabstateview/123', { status: 200 });

      // Create tab with backend sync
      const queryEditor = await store.dispatch(
        actions.addQueryEditorWithBackendSync({
          name: 'Test',
          sql: 'SELECT 1',
        }),
      );

      // Clear previous actions
      store.clearActions();

      // Update state for the SQL update call
      const updatedStore = mockStore({
        sqlLab: {
          queryEditors: [queryEditor],
          unsavedQueryEditor: {},
        },
      });

      // Now SQL updates should work immediately
      await updatedStore.dispatch(
        actions.queryEditorSetAndSaveSql(queryEditor, 'SELECT 2'),
      );

      // Verify PUT call was made with correct integer ID
      const putCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/tabstateview/') && call[1].method === 'PUT',
        );
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0][0]).toContain('/tabstateview/123');
    });
  });

  describe('with backend persistence disabled', () => {
    beforeEach(() => {
      isFeatureEnabled.mockImplementation(() => false);
    });

    test('creates local tab without backend call', async () => {
      const store = mockStore({});
      const queryEditor = { name: 'Test Tab', sql: 'SELECT 1' };

      const result = await store.dispatch(
        actions.addQueryEditorWithBackendSync(queryEditor),
      );

      // Verify no backend calls were made
      const calls = fetchMock.calls();
      expect(calls).toHaveLength(0);

      // Verify local action was dispatched
      const addActions = store
        .getActions()
        .filter(action => action.type === 'ADD_QUERY_EDITOR');
      expect(addActions).toHaveLength(1);
      expect(addActions[0].queryEditor.tabViewId).toBeUndefined();
      expect(addActions[0].queryEditor.inLocalStorage).toBe(true);

      // Verify returned query editor
      expect(result.tabViewId).toBeUndefined();
      expect(result.inLocalStorage).toBe(true);
    });
  });

  describe('integration with addNewQueryEditor', () => {
    test('addNewQueryEditor uses backend sync', async () => {
      isFeatureEnabled.mockImplementation(
        feature => feature === 'SQLLAB_BACKEND_PERSISTENCE',
      );

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

      // Mock backend creation
      fetchMock.post('glob:*/tabstateview/', { id: 999 });

      await store.dispatch(actions.addNewQueryEditor());

      // Verify backend call was made
      const postCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/tabstateview/') && call[1].method === 'POST',
        );
      expect(postCalls).toHaveLength(1);

      // Verify resulting tab has backend ID
      const addActions = store
        .getActions()
        .filter(action => action.type === 'ADD_QUERY_EDITOR');
      expect(addActions).toHaveLength(1);
      expect(addActions[0].queryEditor.tabViewId).toBe('999');
      expect(addActions[0].queryEditor.inLocalStorage).toBe(false);
    });
  });
});
