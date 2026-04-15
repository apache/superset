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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { renderHook, act } from '@testing-library/react-hooks';
import { createWrapper } from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import * as localStorageHelpers from 'src/utils/localStorageHelpers';

import useDatabaseSelector from './useDatabaseSelector';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

const mockDatabase = {
  id: 1,
  database_name: 'main',
  backend: 'mysql',
};

const mockDatabases = {
  [mockDatabase.id]: mockDatabase,
};

const createInitialState = (overrides = {}) => ({
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    databases: mockDatabases,
    ...overrides,
  },
});

beforeEach(() => {
  jest.spyOn(localStorageHelpers, 'getItem').mockReturnValue(null);
  jest.spyOn(localStorageHelpers, 'setItem').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

test('returns initial values from query editor', () => {
  const store = mockStore(createInitialState());
  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  expect(result.current.catalog).toBe(defaultQueryEditor.catalog);
  expect(result.current.schema).toBe(defaultQueryEditor.schema);
  expect(typeof result.current.onDbChange).toBe('function');
  expect(typeof result.current.onCatalogChange).toBe('function');
  expect(typeof result.current.onSchemaChange).toBe('function');
  expect(typeof result.current.getDbList).toBe('function');
  expect(typeof result.current.handleError).toBe('function');
});

test('returns database when dbId exists in store', () => {
  const store = mockStore(
    createInitialState({
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        dbId: mockDatabase.id,
      },
    }),
  );

  const { result, rerender } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  // Trigger effect by rerendering
  rerender();

  expect(result.current.db).toEqual(mockDatabase);
});

test('dispatches QUERY_EDITOR_SETDB action on onDbChange', () => {
  const store = mockStore(createInitialState());
  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  act(() => {
    result.current.onDbChange({ id: 2 });
  });

  const actions = store.getActions();
  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'QUERY_EDITOR_SETDB',
      dbId: 2,
    }),
  );
});

test('dispatches queryEditorSetCatalog action on onCatalogChange', () => {
  const store = mockStore(createInitialState());
  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  act(() => {
    result.current.onCatalogChange('new_catalog');
  });

  const actions = store.getActions();
  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'QUERY_EDITOR_SET_CATALOG',
    }),
  );
});

test('dispatches queryEditorSetSchema action on onSchemaChange', () => {
  const store = mockStore(createInitialState());
  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  act(() => {
    result.current.onSchemaChange('new_schema');
  });

  const actions = store.getActions();
  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'QUERY_EDITOR_SET_SCHEMA',
    }),
  );
});

test('dispatches setDatabases action on getDbList', () => {
  const store = mockStore(createInitialState());
  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  const newDatabase = {
    id: 3,
    database_name: 'test_db',
    backend: 'postgresql',
  };

  act(() => {
    result.current.getDbList(newDatabase as any);
  });

  const actions = store.getActions();
  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'SET_DATABASES',
    }),
  );
});

test('dispatches addDangerToast action on handleError', () => {
  const store = mockStore(createInitialState());
  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  act(() => {
    result.current.handleError('Test error message');
  });

  const actions = store.getActions();
  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'ADD_TOAST',
      payload: expect.objectContaining({
        toastType: 'DANGER_TOAST',
        text: 'Test error message',
      }),
    }),
  );
});

test('reads database from localStorage when URL has db param', () => {
  const localStorageDb = {
    id: 5,
    database_name: 'local_storage_db',
    backend: 'sqlite',
  };

  jest.spyOn(localStorageHelpers, 'getItem').mockReturnValue(localStorageDb);

  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { search: '?db=true' },
    writable: true,
  });

  const store = mockStore(createInitialState());
  const { result, rerender } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  rerender();

  expect(result.current.db).toEqual(localStorageDb);
  expect(localStorageHelpers.setItem).toHaveBeenCalledWith(
    localStorageHelpers.LocalStorageKeys.Database,
    null,
  );

  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
  });
});

test('returns null db when dbId does not exist in databases', () => {
  const store = mockStore(
    createInitialState({
      databases: {},
    }),
  );

  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  expect(result.current.db).toBeNull();
});

test('handles null catalog change', () => {
  const store = mockStore(createInitialState());
  const { result } = renderHook(
    () => useDatabaseSelector(defaultQueryEditor.id),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );

  act(() => {
    result.current.onCatalogChange(null);
  });

  const actions = store.getActions();
  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'QUERY_EDITOR_SET_CATALOG',
    }),
  );
});
