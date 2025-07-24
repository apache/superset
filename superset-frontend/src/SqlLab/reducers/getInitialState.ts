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
import { t } from '@superset-ui/core';
import type { BootstrapData } from 'src/types/bootstrapTypes';
import type { InitialState } from 'src/hooks/apiResources/sqlLab';
import {
  QueryEditor,
  UnsavedQueryEditor,
  SqlLabRootState,
  Table,
  LatestQueryEditorVersion,
  QueryEditorVersion,
} from 'src/SqlLab/types';

export function dedupeTabHistory(tabHistory: string[]) {
  return tabHistory.reduce<string[]>(
    (result, tabId) =>
      result.slice(-1)[0] === tabId ? result : result.concat(tabId),
    [],
  );
}

export default function getInitialState({
  common,
  active_tab: activeTab,
  tab_state_ids: tabStateIds = [],
  databases,
  queries: queries_,
  ...otherBootstrapData
}: BootstrapData & Partial<InitialState>) {
  /**
   * Before YYYY-MM-DD, the state for SQL Lab was stored exclusively in the
   * browser's localStorage. The feature flag `SQLLAB_BACKEND_PERSISTENCE`
   * moves the state to the backend instead, migrating it from local storage.
   *
   * To allow for a transparent migration, the initial state is a combination
   * of the backend state (if any) with the browser state (if any).
   */
  let queryEditors: Record<string, QueryEditor> = {};
  const defaultQueryEditor = {
    version: LatestQueryEditorVersion,
    loaded: true,
    name: t('Untitled query'),
    sql: '',
    latestQueryId: null,
    autorun: false,
    dbId: common.conf.SQLLAB_DEFAULT_DBID,
    queryLimit: common.conf.DEFAULT_SQLLAB_LIMIT,
    hideLeftBar: false,
    remoteId: null,
    cursorPosition: { row: 0, column: 0 },
  };
  let unsavedQueryEditor: UnsavedQueryEditor = {};

  /**
   * Load state from the backend. This will be empty if the feature flag
   * `SQLLAB_BACKEND_PERSISTENCE` is off.
   */
  tabStateIds.forEach(({ id, label }) => {
    let queryEditor: QueryEditor;
    if (activeTab && activeTab.id === id) {
      queryEditor = {
        version: activeTab.extra_json?.version ?? QueryEditorVersion.V1,
        id: id.toString(),
        loaded: true,
        name: activeTab.label,
        sql: activeTab.sql || '',
        selectedText: undefined,
        latestQueryId: activeTab.latest_query
          ? activeTab.latest_query.id
          : null,
        remoteId: activeTab.saved_query?.id || null,
        autorun: Boolean(activeTab.autorun),
        templateParams: activeTab.template_params || undefined,
        dbId: activeTab.database_id,
        catalog: activeTab.catalog,
        schema: activeTab.schema,
        queryLimit: activeTab.query_limit,
        hideLeftBar: activeTab.hide_left_bar,
        updatedAt: activeTab.extra_json?.updatedAt,
      };
    } else {
      // dummy state, actual state will be loaded on tab switch
      queryEditor = {
        ...defaultQueryEditor,
        id: id.toString(),
        loaded: false,
        name: label,
        dbId: undefined,
      };
    }
    queryEditors = {
      ...queryEditors,
      [queryEditor.id]: queryEditor,
    };
  });
  const tabHistory = activeTab ? [activeTab.id.toString()] : [];
  let lastUpdatedActiveTab = activeTab ? activeTab.id.toString() : '';
  let tables = {} as Record<string, Table>;
  let editorTabLastUpdatedAt = Date.now();
  if (activeTab) {
    editorTabLastUpdatedAt =
      activeTab.extra_json?.updatedAt || editorTabLastUpdatedAt;
    activeTab.table_schemas
      .filter(tableSchema => tableSchema.description !== null)
      .forEach(tableSchema => {
        const { dataPreviewQueryId, ...persistData } = tableSchema.description;
        const table = {
          dbId: tableSchema.database_id ?? 0,
          queryEditorId: tableSchema.tab_state_id.toString(),
          catalog: tableSchema.catalog,
          schema: tableSchema.schema,
          name: tableSchema.table,
          expanded: Boolean(tableSchema.expanded),
          id: tableSchema.id,
          dataPreviewQueryId,
          persistData,
          initialized: true,
        };
        tables = {
          ...tables,
          [table.id]: table,
        };
      });
  }

  const queries = {
    ...queries_,
    ...(activeTab?.latest_query && {
      [activeTab.latest_query.id]: activeTab.latest_query,
    }),
  };

  const destroyedQueryEditors: SqlLabRootState['sqlLab']['destroyedQueryEditors'] =
    {};

  /**
   * If the `SQLLAB_BACKEND_PERSISTENCE` feature flag is off, or if the user
   * hasn't used SQL Lab after it has been turned on, the state will be stored
   * in the browser's local storage.
   */
  try {
    const localStorageData = localStorage.getItem('redux');
    const sqlLabCacheData = localStorageData
      ? (JSON.parse(localStorageData) as Pick<SqlLabRootState, 'sqlLab'>)
      : undefined;
    if (localStorageData && sqlLabCacheData?.sqlLab) {
      const { sqlLab } = sqlLabCacheData;

      if (sqlLab.queryEditors.length === 0) {
        // migration was successful
        localStorage.removeItem('redux');
      } else {
        unsavedQueryEditor = sqlLab.unsavedQueryEditor || unsavedQueryEditor;
        // add query editors and tables to state with a special flag so they can
        // be migrated if the `SQLLAB_BACKEND_PERSISTENCE` feature flag is on
        sqlLab.queryEditors.forEach(qe => {
          const hasConflictFromBackend = Boolean(queryEditors[qe.id]);
          const unsavedUpdatedAt = queryEditors[qe.id]?.updatedAt;
          const hasUnsavedUpdateSinceLastSave =
            qe.updatedAt &&
            (!unsavedUpdatedAt || qe.updatedAt > unsavedUpdatedAt);
          const cachedQueryEditor: UnsavedQueryEditor =
            !hasConflictFromBackend || hasUnsavedUpdateSinceLastSave ? qe : {};
          queryEditors = {
            ...queryEditors,
            [qe.id]: {
              ...queryEditors[qe.id],
              ...cachedQueryEditor,
              name:
                cachedQueryEditor.title ||
                cachedQueryEditor.name ||
                queryEditors[qe.id]?.name,
              ...(cachedQueryEditor.id &&
                unsavedQueryEditor.id === qe.id &&
                unsavedQueryEditor),
              inLocalStorage: !hasConflictFromBackend,
              loaded: true,
            },
          };
        });
        const expandedTables = new Set();

        if (sqlLab.tables) {
          tables = sqlLab.tables.reduce((merged, table) => {
            const expanded = !expandedTables.has(table.queryEditorId);
            if (expanded) {
              expandedTables.add(table.queryEditorId);
            }
            return {
              ...merged,
              [table.id]: {
                ...tables[table.id],
                ...table,
                expanded,
                inLocalStorage: true,
              },
            };
          }, tables);
        }
        if (sqlLab.queries) {
          Object.values(sqlLab.queries).forEach(query => {
            queries[query.id] = { ...query, inLocalStorage: true };
          });
        }
        if (sqlLab.tabHistory) {
          tabHistory.push(...sqlLab.tabHistory);
        }
        lastUpdatedActiveTab = tabHistory.slice(tabHistory.length - 1)[0] || '';

        if (sqlLab.destroyedQueryEditors) {
          Object.entries(sqlLab.destroyedQueryEditors).forEach(([id, ts]) => {
            if (queryEditors[id]) {
              destroyedQueryEditors[id] = ts;
              delete queryEditors[id];
            }
          });
        }
      }
    }
  } catch (error) {
    // continue regardless of error
  }

  return {
    sqlLab: {
      activeSouthPaneTab: 'Results',
      alerts: [],
      databases,
      offline: false,
      queries: Object.fromEntries(
        Object.entries(queries).map(([queryId, query]) => [
          queryId,
          {
            ...query,
            ...(query.startDttm && {
              startDttm: Number(query.startDttm),
            }),
            ...(query.endDttm && {
              endDttm: Number(query.endDttm),
            }),
          },
        ]),
      ),
      queryEditors: Object.values(queryEditors),
      tabHistory: dedupeTabHistory(tabHistory),
      tables: Object.values(tables),
      queriesLastUpdate: Date.now(),
      editorTabLastUpdatedAt,
      queryCostEstimates: {},
      unsavedQueryEditor,
      lastUpdatedActiveTab,
      destroyedQueryEditors,
    },
    localStorageUsageInKilobytes: 0,
    common,
    ...otherBootstrapData,
  };
}
