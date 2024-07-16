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
import { normalizeTimestamp, QueryState, t } from '@superset-ui/core';
import * as actions from '../actions/sqlLab';
import { now } from '../../utils/dates';
import {
  addToObject,
  alterInObject,
  alterInArr,
  removeFromArr,
  getFromArr,
  addToArr,
  extendArr,
} from '../../reduxUtils';

function alterUnsavedQueryEditorState(state, updatedState, id, silent = false) {
  if (state.tabHistory[state.tabHistory.length - 1] !== id) {
    const { queryEditors } = alterInArr(
      state,
      'queryEditors',
      { id },
      updatedState,
    );
    return {
      queryEditors,
    };
  }
  return {
    unsavedQueryEditor: {
      ...(state.unsavedQueryEditor.id === id && state.unsavedQueryEditor),
      ...(id ? { id, ...updatedState } : state.unsavedQueryEditor),
      ...(!silent && { updatedAt: new Date().getTime() }),
    },
  };
}

export default function sqlLabReducer(state = {}, action) {
  const actionHandlers = {
    [actions.ADD_QUERY_EDITOR]() {
      const mergeUnsavedState = alterInArr(
        state,
        'queryEditors',
        state.unsavedQueryEditor,
        {
          ...state.unsavedQueryEditor,
        },
      );
      const newState = {
        ...mergeUnsavedState,
        tabHistory: [...state.tabHistory, action.queryEditor.id],
      };
      return addToArr(newState, 'queryEditors', {
        ...action.queryEditor,
        updatedAt: new Date().getTime(),
      });
    },
    [actions.QUERY_EDITOR_SAVED]() {
      const { query, result, clientId } = action;
      const existing = state.queryEditors.find(qe => qe.id === clientId);
      return alterInArr(
        state,
        'queryEditors',
        existing,
        {
          remoteId: result.remoteId,
          name: query.name,
        },
        'id',
      );
    },
    [actions.UPDATE_QUERY_EDITOR]() {
      const id = action.alterations.remoteId;
      const existing = state.queryEditors.find(qe => qe.remoteId === id);
      if (existing == null) return state;
      return alterInArr(
        state,
        'queryEditors',
        existing,
        action.alterations,
        'remoteId',
      );
    },
    [actions.CLONE_QUERY_TO_NEW_TAB]() {
      const queryEditor = state.queryEditors.find(
        qe => qe.id === state.tabHistory[state.tabHistory.length - 1],
      );
      const progenitor = {
        ...queryEditor,
        ...(state.unsavedQueryEditor.id === queryEditor.id &&
          state.unsavedQueryEditor),
      };
      const qe = {
        remoteId: progenitor.remoteId,
        name: t('Copy of %s', progenitor.name),
        dbId: action.query.dbId ? action.query.dbId : null,
        catalog: action.query.catalog ? action.query.catalog : null,
        schema: action.query.schema ? action.query.schema : null,
        autorun: true,
        sql: action.query.sql,
        queryLimit: action.query.queryLimit,
        maxRow: action.query.maxRow,
      };
      const stateWithoutUnsavedState = {
        ...state,
        unsavedQueryEditor: {},
      };
      return sqlLabReducer(
        stateWithoutUnsavedState,
        actions.addQueryEditor(qe),
      );
    },
    [actions.REMOVE_QUERY_EDITOR]() {
      const queryEditor = {
        ...action.queryEditor,
        ...(action.queryEditor.id === state.unsavedQueryEditor.id &&
          state.unsavedQueryEditor),
      };
      let newState = removeFromArr(state, 'queryEditors', queryEditor);
      // List of remaining queryEditor ids
      const qeIds = newState.queryEditors.map(qe => qe.id);

      const queries = {};
      Object.keys(state.queries).forEach(k => {
        const query = state.queries[k];
        if (qeIds.indexOf(query.sqlEditorId) > -1) {
          queries[k] = query;
        }
      });

      let tabHistory = state.tabHistory.slice();
      tabHistory = tabHistory.filter(id => qeIds.indexOf(id) > -1);

      // Remove associated table schemas
      const tables = state.tables.filter(
        table => table.queryEditorId !== queryEditor.id,
      );

      newState = {
        ...newState,
        tabHistory:
          tabHistory.length === 0 && newState.queryEditors.length > 0
            ? newState.queryEditors.slice(-1).map(qe => qe.id)
            : tabHistory,
        tables,
        queries,
        unsavedQueryEditor: {
          ...(action.queryEditor.id !== state.unsavedQueryEditor.id &&
            state.unsavedQueryEditor),
        },
        destroyedQueryEditors: {
          ...newState.destroyedQueryEditors,
          [queryEditor.id]: Date.now(),
        },
      };
      return newState;
    },
    [actions.CLEAR_DESTROYED_QUERY_EDITOR]() {
      const destroyedQueryEditors = { ...state.destroyedQueryEditors };
      delete destroyedQueryEditors[action.queryEditorId];
      return { ...state, destroyedQueryEditors };
    },
    [actions.REMOVE_QUERY]() {
      const newQueries = { ...state.queries };
      delete newQueries[action.query.id];
      return { ...state, queries: newQueries };
    },
    [actions.RESET_STATE]() {
      return { ...action.sqlLabInitialState };
    },
    [actions.MERGE_TABLE]() {
      const at = { ...action.table };
      let existingTable;
      state.tables.forEach(xt => {
        if (
          xt.dbId === at.dbId &&
          xt.queryEditorId === at.queryEditorId &&
          xt.catalog === at.catalog &&
          xt.schema === at.schema &&
          xt.name === at.name
        ) {
          existingTable = xt;
        }
      });
      if (existingTable) {
        if (action.query) {
          at.dataPreviewQueryId = action.query.id;
        }
        if (existingTable.initialized) {
          at.id = existingTable.id;
        }
        return alterInArr(state, 'tables', existingTable, at);
      }
      // for new table, associate Id of query for data preview
      at.dataPreviewQueryId = null;
      let newState = addToArr(state, 'tables', at, Boolean(action.prepend));
      if (action.query) {
        newState = alterInArr(newState, 'tables', at, {
          dataPreviewQueryId: action.query.id,
        });
      }
      return newState;
    },
    [actions.EXPAND_TABLE]() {
      return alterInArr(state, 'tables', action.table, { expanded: true });
    },
    [actions.REMOVE_DATA_PREVIEW]() {
      const queries = { ...state.queries };
      delete queries[action.table.dataPreviewQueryId];
      const newState = alterInArr(state, 'tables', action.table, {
        dataPreviewQueryId: null,
      });
      return { ...newState, queries };
    },
    [actions.CHANGE_DATA_PREVIEW_ID]() {
      const queries = { ...state.queries };
      delete queries[action.oldQueryId];

      const newTables = [];
      state.tables.forEach(xt => {
        if (xt.dataPreviewQueryId === action.oldQueryId) {
          newTables.push({ ...xt, dataPreviewQueryId: action.newQuery.id });
        } else {
          newTables.push(xt);
        }
      });
      return {
        ...state,
        queries,
        tables: newTables,
        activeSouthPaneTab: action.newQuery.id,
      };
    },
    [actions.COLLAPSE_TABLE]() {
      return alterInArr(state, 'tables', action.table, { expanded: false });
    },
    [actions.REMOVE_TABLES]() {
      const tableIds = action.tables.map(table => table.id);
      return {
        ...state,
        tables: state.tables.filter(table => !tableIds.includes(table.id)),
      };
    },
    [actions.COST_ESTIMATE_STARTED]() {
      return {
        ...state,
        queryCostEstimates: {
          ...state.queryCostEstimates,
          [action.query.id]: {
            completed: false,
            cost: null,
            error: null,
          },
        },
      };
    },
    [actions.COST_ESTIMATE_RETURNED]() {
      return {
        ...state,
        queryCostEstimates: {
          ...state.queryCostEstimates,
          [action.query.id]: {
            completed: true,
            cost: action.json.result,
            error: null,
          },
        },
      };
    },
    [actions.COST_ESTIMATE_FAILED]() {
      return {
        ...state,
        queryCostEstimates: {
          ...state.queryCostEstimates,
          [action.query.id]: {
            completed: false,
            cost: null,
            error: action.error,
          },
        },
      };
    },
    [actions.START_QUERY]() {
      let newState = { ...state };
      if (action.query.sqlEditorId) {
        const qe = {
          ...getFromArr(state.queryEditors, action.query.sqlEditorId),
          ...(action.query.sqlEditorId === state.unsavedQueryEditor.id &&
            state.unsavedQueryEditor),
        };
        if (qe.latestQueryId && state.queries[qe.latestQueryId]) {
          const newResults = {
            ...state.queries[qe.latestQueryId].results,
            data: [],
            query: null,
          };
          const q = { ...state.queries[qe.latestQueryId], results: newResults };
          const queries = { ...state.queries, [q.id]: q };
          newState = { ...state, queries };
        }
      } else {
        newState.activeSouthPaneTab = action.query.id;
      }
      newState = addToObject(newState, 'queries', action.query);

      return {
        ...newState,
        ...alterUnsavedQueryEditorState(
          state,
          {
            latestQueryId: action.query.id,
          },
          action.query.sqlEditorId,
          action.query.isDataPreview,
        ),
      };
    },
    [actions.STOP_QUERY]() {
      return alterInObject(state, 'queries', action.query, {
        state: QueryState.Stopped,
        results: [],
      });
    },
    [actions.CLEAR_QUERY_RESULTS]() {
      const newResults = { ...action.query.results };
      newResults.data = [];
      return alterInObject(state, 'queries', action.query, {
        results: newResults,
        cached: true,
      });
    },
    [actions.REQUEST_QUERY_RESULTS]() {
      return alterInObject(state, 'queries', action.query, {
        state: QueryState.Fetching,
      });
    },
    [actions.QUERY_SUCCESS]() {
      // prevent race condition where query succeeds shortly after being canceled
      // or the final result was unsuccessful
      if (
        action.query.state === QueryState.STOPPED ||
        action.results.status !== QueryState.Success
      ) {
        return state;
      }
      const alts = {
        endDttm: now(),
        progress: 100,
        results: action.results,
        rows: action?.results?.query?.rows || 0,
        state: QueryState.Success,
        limitingFactor: action?.results?.query?.limitingFactor,
        tempSchema: action?.results?.query?.tempSchema,
        tempTable: action?.results?.query?.tempTable,
        errorMessage: null,
        cached: false,
      };

      const resultsKey = action?.results?.query?.resultsKey;
      if (resultsKey) {
        alts.resultsKey = resultsKey;
      }

      return alterInObject(state, 'queries', action.query, alts);
    },
    [actions.QUERY_FAILED]() {
      if (action.query.state === QueryState.Stopped) {
        return state;
      }
      const alts = {
        state: QueryState.Failed,
        errors: action.errors,
        errorMessage: action.msg,
        endDttm: now(),
        link: action.link,
      };
      return alterInObject(state, 'queries', action.query, alts);
    },
    [actions.SET_ACTIVE_QUERY_EDITOR]() {
      const qeIds = state.queryEditors.map(qe => qe.id);
      if (
        qeIds.indexOf(action.queryEditor?.id) > -1 &&
        state.tabHistory[state.tabHistory.length - 1] !== action.queryEditor.id
      ) {
        const mergeUnsavedState = {
          ...alterInArr(state, 'queryEditors', state.unsavedQueryEditor, {
            ...state.unsavedQueryEditor,
          }),
          unsavedQueryEditor: {},
        };
        return {
          ...(action.queryEditor.id === state.unsavedQueryEditor.id
            ? alterInArr(
                mergeUnsavedState,
                'queryEditors',
                action.queryEditor,
                {
                  ...action.queryEditor,
                  ...state.unsavedQueryEditor,
                },
              )
            : mergeUnsavedState),
          tabHistory: [...state.tabHistory, action.queryEditor.id],
        };
      }
      return state;
    },
    [actions.LOAD_QUERY_EDITOR]() {
      const mergeUnsavedState = alterInArr(
        state,
        'queryEditors',
        state.unsavedQueryEditor,
        {
          ...state.unsavedQueryEditor,
        },
      );
      return alterInArr(mergeUnsavedState, 'queryEditors', action.queryEditor, {
        ...action.queryEditor,
      });
    },
    [actions.SET_TABLES]() {
      return extendArr(state, 'tables', action.tables);
    },
    [actions.SET_ACTIVE_SOUTHPANE_TAB]() {
      return { ...state, activeSouthPaneTab: action.tabId };
    },
    [actions.MIGRATE_QUERY_EDITOR]() {
      try {
        // remove migrated query editor from localStorage
        const { sqlLab } = JSON.parse(localStorage.getItem('redux'));
        sqlLab.queryEditors = sqlLab.queryEditors.filter(
          qe => qe.id !== action.oldQueryEditor.id,
        );
        localStorage.setItem('redux', JSON.stringify({ sqlLab }));
      } catch (error) {
        // continue regardless of error
      }
      // replace localStorage query editor with the server backed one
      return alterInArr(
        state,
        'queryEditors',
        action.oldQueryEditor,
        action.newQueryEditor,
      );
    },
    [actions.MIGRATE_TABLE]() {
      try {
        // remove migrated table from localStorage
        const { sqlLab } = JSON.parse(localStorage.getItem('redux'));
        sqlLab.tables = sqlLab.tables.filter(
          table => table.id !== action.oldTable.id,
        );
        localStorage.setItem('redux', JSON.stringify({ sqlLab }));
      } catch (error) {
        // continue regardless of error
      }

      // replace localStorage table with the server backed one
      return addToArr(
        removeFromArr(state, 'tables', action.oldTable),
        'tables',
        action.newTable,
      );
    },
    [actions.MIGRATE_TAB_HISTORY]() {
      const tabHistory = state.tabHistory.map(tabId =>
        tabId === action.oldId ? action.newId : tabId,
      );
      return { ...state, tabHistory };
    },
    [actions.MIGRATE_QUERY]() {
      const query = {
        ...state.queries[action.queryId],
        // point query to migrated query editor
        sqlEditorId: action.queryEditorId,
      };
      const queries = { ...state.queries, [query.id]: query };
      return { ...state, queries };
    },
    [actions.QUERY_EDITOR_SETDB]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            dbId: action.dbId,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_CATALOG]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            catalog: action.catalog,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_SCHEMA]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            schema: action.schema,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_TITLE]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            name: action.name,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_SQL]() {
      const { unsavedQueryEditor } = state;
      if (
        unsavedQueryEditor?.id === action.queryEditor.id &&
        unsavedQueryEditor.sql === action.sql
      ) {
        return state;
      }
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            sql: action.sql,
            ...(action.queryId && { latestQueryId: action.queryId }),
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_CURSOR_POSITION]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            cursorPosition: action.position,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_QUERY_LIMIT]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            queryLimit: action.queryLimit,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_TEMPLATE_PARAMS]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            templateParams: action.templateParams,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_SELECTED_TEXT]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            selectedText: action.sql,
          },
          action.queryEditor.id,
          true,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_AUTORUN]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            autorun: action.autorun,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_PERSIST_HEIGHT]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            northPercent: action.northPercent,
            southPercent: action.southPercent,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_TOGGLE_LEFT_BAR]() {
      return {
        ...state,
        ...alterUnsavedQueryEditorState(
          state,
          {
            hideLeftBar: action.hideLeftBar,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.SET_DATABASES]() {
      const databases = {};
      action.databases.forEach(db => {
        databases[db.id] = {
          ...db,
          extra_json: JSON.parse(db.extra || ''),
        };
      });
      return { ...state, databases };
    },
    [actions.REFRESH_QUERIES]() {
      let newQueries = { ...state.queries };
      // Fetch the updates to the queries present in the store.
      let change = false;
      let { queriesLastUpdate } = state;
      Object.entries(action.alteredQueries).forEach(([id, changedQuery]) => {
        if (
          !state.queries.hasOwnProperty(id) ||
          (state.queries[id].state !== QueryState.Stopped &&
            state.queries[id].state !== QueryState.Failed)
        ) {
          const changedOn = normalizeTimestamp(changedQuery.changed_on);
          const timestamp = Date.parse(changedOn);
          if (timestamp > queriesLastUpdate) {
            queriesLastUpdate = timestamp;
          }
          const prevState = state.queries[id]?.state;
          const currentState = changedQuery.state;
          newQueries[id] = {
            ...state.queries[id],
            ...changedQuery,
            ...(changedQuery.startDttm && {
              startDttm: Number(changedQuery.startDttm),
            }),
            ...(changedQuery.endDttm && {
              endDttm: Number(changedQuery.endDttm),
            }),
            // race condition:
            // because of async behavior, sql lab may still poll a couple of seconds
            // when it started fetching or finished rendering results
            state:
              currentState === QueryState.Success &&
              [
                QueryState.Fetching,
                QueryState.Success,
                QueryState.Running,
              ].includes(prevState)
                ? prevState
                : currentState,
          };
          change = true;
        }
      });
      if (!change) {
        newQueries = state.queries;
      }
      return { ...state, queries: newQueries, queriesLastUpdate };
    },
    [actions.CLEAR_INACTIVE_QUERIES]() {
      const { queries } = state;
      const cleanedQueries = Object.fromEntries(
        Object.entries(queries)
          .filter(([, query]) => {
            if (
              ['running', 'pending'].includes(query.state) &&
              Date.now() - query.startDttm > action.interval &&
              query.progress === 0
            ) {
              return false;
            }
            return true;
          })
          .map(([id, query]) => [
            id,
            {
              ...query,
              state:
                query.resultsKey && query.results?.status
                  ? query.results.status
                  : query.state,
            },
          ]),
      );
      return { ...state, queries: cleanedQueries };
    },
    [actions.SET_USER_OFFLINE]() {
      return { ...state, offline: action.offline };
    },
    [actions.CREATE_DATASOURCE_STARTED]() {
      return { ...state, isDatasourceLoading: true, errorMessage: null };
    },
    [actions.CREATE_DATASOURCE_SUCCESS]() {
      return {
        ...state,
        isDatasourceLoading: false,
        errorMessage: null,
        datasource: action.datasource,
      };
    },
    [actions.CREATE_DATASOURCE_FAILED]() {
      return { ...state, isDatasourceLoading: false, errorMessage: action.err };
    },
    [actions.SET_EDITOR_TAB_LAST_UPDATE]() {
      return { ...state, editorTabLastUpdatedAt: action.timestamp };
    },
    [actions.SET_LAST_UPDATED_ACTIVE_TAB]() {
      return { ...state, lastUpdatedActiveTab: action.queryEditorId };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
