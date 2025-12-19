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
import type { StoreEnhancer } from 'redux';
import persistState from 'redux-localstorage';
import { pickBy } from 'lodash';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { filterUnsavedQueryEditorList } from 'src/SqlLab/components/EditorAutoSync';
import type {
  SqlLabRootState,
  QueryEditor,
  UnsavedQueryEditor,
  Table,
} from '../types';
import {
  emptyTablePersistData,
  emptyQueryResults,
  clearQueryEditors,
} from '../utils/reduxStateToLocalStorageHelper';
import { BYTES_PER_CHAR, KB_STORAGE } from '../constants';

type SqlLabState = SqlLabRootState['sqlLab'];

type ClearEntityHelperValue =
  | Table[]
  | SqlLabState['queries']
  | QueryEditor[]
  | UnsavedQueryEditor;

interface ClearEntityHelpersMap {
  tables: (tables: Table[]) => ReturnType<typeof emptyTablePersistData>;
  queries: (
    queries: SqlLabState['queries'],
  ) => ReturnType<typeof emptyQueryResults>;
  queryEditors: (
    queryEditors: QueryEditor[],
  ) => ReturnType<typeof clearQueryEditors>;
  unsavedQueryEditor: (
    qe: UnsavedQueryEditor,
  ) => ReturnType<typeof clearQueryEditors>[number];
}

const CLEAR_ENTITY_HELPERS_MAP: ClearEntityHelpersMap = {
  tables: emptyTablePersistData,
  queries: emptyQueryResults,
  queryEditors: clearQueryEditors,
  unsavedQueryEditor: (qe: UnsavedQueryEditor) =>
    clearQueryEditors([qe as QueryEditor])[0],
};

interface PersistedSqlLabState {
  sqlLab?: Partial<SqlLabState>;
  localStorageUsageInKilobytes?: number;
}

const sqlLabPersistStateConfig = {
  paths: ['sqlLab'],
  config: {
    slicer:
      (paths: string[]) =>
      (state: SqlLabRootState): PersistedSqlLabState => {
        const subset: PersistedSqlLabState = {};
        paths.forEach(path => {
          if (isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)) {
            const {
              queryEditors,
              editorTabLastUpdatedAt,
              unsavedQueryEditor,
              tables,
              queries,
              tabHistory,
              lastUpdatedActiveTab,
              destroyedQueryEditors,
            } = state.sqlLab;
            const unsavedQueryEditors = filterUnsavedQueryEditorList(
              queryEditors,
              unsavedQueryEditor,
              editorTabLastUpdatedAt,
            );
            const hasUnsavedActiveTabState =
              tabHistory.slice(-1)[0] !== lastUpdatedActiveTab;
            const hasUnsavedDeletedQueryEditors =
              Object.keys(destroyedQueryEditors).length > 0;
            if (
              unsavedQueryEditors.length > 0 ||
              hasUnsavedActiveTabState ||
              hasUnsavedDeletedQueryEditors
            ) {
              const hasFinishedMigrationFromLocalStorage =
                unsavedQueryEditors.every(
                  ({ inLocalStorage }) => !inLocalStorage,
                );
              subset.sqlLab = {
                queryEditors: unsavedQueryEditors,
                ...(!hasFinishedMigrationFromLocalStorage && {
                  tabHistory,
                  tables: tables.filter(table => table.inLocalStorage),
                  queries: pickBy(
                    queries,
                    query => query.inLocalStorage && !query.isDataPreview,
                  ),
                }),
                ...(hasUnsavedActiveTabState && {
                  tabHistory,
                }),
                destroyedQueryEditors,
              };
            }
            return;
          }
          // this line is used to remove old data from browser localStorage.
          // we used to persist all redux state into localStorage, but
          // it caused configurations passed from server-side got override.
          // see PR 6257 for details
          const statePath = state[path as keyof SqlLabRootState];
          if (
            statePath &&
            typeof statePath === 'object' &&
            'common' in statePath
          ) {
            delete (statePath as Record<string, unknown>).common; // eslint-disable-line no-param-reassign
          }
          if (path === 'sqlLab') {
            subset[path] = Object.fromEntries(
              Object.entries(state[path]).map(([key, value]) => {
                const helper = CLEAR_ENTITY_HELPERS_MAP[
                  key as keyof ClearEntityHelpersMap
                ] as ((val: ClearEntityHelperValue) => unknown) | undefined;
                return [
                  key,
                  helper?.(value as ClearEntityHelperValue) ?? value,
                ];
              }),
            );
          }
        });

        const data = JSON.stringify(subset);
        // 2 digit precision
        const currentSize =
          Math.round(((data.length * BYTES_PER_CHAR) / KB_STORAGE) * 100) / 100;
        if (state.localStorageUsageInKilobytes !== currentSize) {
          state.localStorageUsageInKilobytes = currentSize; // eslint-disable-line no-param-reassign
        }

        return subset;
      },
    merge: (
      initialState: SqlLabRootState,
      persistedState: PersistedSqlLabState = {},
    ) => ({
      ...initialState,
      ...persistedState,
      sqlLab: {
        ...persistedState?.sqlLab,
        // Overwrite initialState over persistedState for sqlLab
        // since a logic in getInitialState overrides the value from persistedState
        ...initialState.sqlLab,
      },
    }),
  },
};

// redux-localstorage doesn't have TypeScript definitions
// The library returns a StoreEnhancer that persists specified paths to localStorage
export const persistSqlLabStateEnhancer = persistState(
  sqlLabPersistStateConfig.paths,
  sqlLabPersistStateConfig.config,
) as StoreEnhancer;
