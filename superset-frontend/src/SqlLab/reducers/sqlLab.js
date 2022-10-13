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

import getInitialState from './getInitialState';
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

function alterUnsavedQueryEditorState(state, updatedState, id) {
  return {
    ...(state.unsavedQueryEditor.id === id && state.unsavedQueryEditor),
    ...(id ? { id, ...updatedState } : state.unsavedQueryEditor),
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
      return addToArr(newState, 'queryEditors', action.queryEditor);
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
        tabHistory,
        tables,
        queries,
        unsavedQueryEditor: {
          ...(action.queryEditor.id !== state.unsavedQueryEditor.id &&
            state.unsavedQueryEditor),
        },
      };
      return newState;
    },
    [actions.REMOVE_QUERY]() {
      const newQueries = { ...state.queries };
      delete newQueries[action.query.id];
      return { ...state, queries: newQueries };
    },
    [actions.RESET_STATE]() {
      return { ...getInitialState() };
    },
    [actions.MERGE_TABLE]() {
      const at = { ...action.table };
      let existingTable;
      state.tables.forEach(xt => {
        if (
          xt.dbId === at.dbId &&
          xt.queryEditorId === at.queryEditorId &&
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
    [actions.START_QUERY_VALIDATION]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            validationResult: {
              id: action.query.id,
              errors: [],
              completed: false,
            },
          },
          action.query.sqlEditorId,
        ),
      };
    },
    [actions.QUERY_VALIDATION_RETURNED]() {
      // If the server is very slow about answering us, we might get validation
      // responses back out of order. This check confirms the response we're
      // handling corresponds to the most recently dispatched request.
      //
      // We don't care about any but the most recent because validations are
      // only valid for the SQL text they correspond to -- once the SQL has
      // changed, the old validation doesn't tell us anything useful anymore.
      const qe = {
        ...getFromArr(state.queryEditors, action.query.sqlEditorId),
        ...(state.unsavedQueryEditor.id === action.query.sqlEditorId &&
          state.unsavedQueryEditor),
      };
      if (qe.validationResult.id !== action.query.id) {
        return state;
      }
      // Otherwise, persist the results on the queryEditor state
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            validationResult: {
              id: action.query.id,
              errors: action.results,
              completed: true,
            },
          },
          action.query.sqlEditorId,
        ),
      };
    },
    [actions.QUERY_VALIDATION_FAILED]() {
      // If the server is very slow about answering us, we might get validation
      // responses back out of order. This check confirms the response we're
      // handling corresponds to the most recently dispatched request.
      //
      // We don't care about any but the most recent because validations are
      // only valid for the SQL text they correspond to -- once the SQL has
      // changed, the old validation doesn't tell us anything useful anymore.
      const qe = getFromArr(state.queryEditors, action.query.sqlEditorId);
      if (qe.validationResult.id !== action.query.id) {
        return state;
      }
      // Otherwise, persist the results on the queryEditor state
      let newState = { ...state };
      const sqlEditor = { id: action.query.sqlEditorId };
      newState = alterInArr(newState, 'queryEditors', sqlEditor, {
        validationResult: {
          id: action.query.id,
          errors: [
            {
              line_number: 1,
              start_column: 1,
              end_column: 1,
              message: `The server failed to validate your query.\n${action.message}`,
            },
          ],
          completed: true,
        },
      });
      return newState;
    },
    [actions.COST_ESTIMATE_STARTED]() {
      return {
        ...state,
        queryCostEstimates: {
          ...state.queryCostEstimates,
          [action.query.sqlEditorId]: {
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
          [action.query.sqlEditorId]: {
            completed: true,
            cost: action.json,
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
          [action.query.sqlEditorId]: {
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
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            latestQueryId: action.query.id,
          },
          action.query.sqlEditorId,
        ),
      };
    },
    [actions.STOP_QUERY]() {
      return alterInObject(state, 'queries', action.query, {
        state: 'stopped',
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
        state: 'fetching',
      });
    },
    [actions.QUERY_SUCCESS]() {
      // prevent race condition were query succeeds shortly after being canceled
      if (action.query.state === 'stopped') {
        return state;
      }
      const alts = {
        endDttm: now(),
        progress: 100,
        results: action.results,
        rows: action?.results?.query?.rows || 0,
        state: 'success',
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
      if (action.query.state === 'stopped') {
        return state;
      }
      const alts = {
        state: 'failed',
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
        const mergeUnsavedState = alterInArr(
          state,
          'queryEditors',
          state.unsavedQueryEditor,
          {
            ...state.unsavedQueryEditor,
          },
        );
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
      // remove migrated query editor from localStorage
      const { sqlLab } = JSON.parse(localStorage.getItem('redux'));
      sqlLab.queryEditors = sqlLab.queryEditors.filter(
        qe => qe.id !== action.oldQueryEditor.id,
      );
      localStorage.setItem('redux', JSON.stringify({ sqlLab }));

      // replace localStorage query editor with the server backed one
      return addToArr(
        removeFromArr(state, 'queryEditors', action.oldQueryEditor),
        'queryEditors',
        action.newQueryEditor,
      );
    },
    [actions.MIGRATE_TABLE]() {
      // remove migrated table from localStorage
      const { sqlLab } = JSON.parse(localStorage.getItem('redux'));
      sqlLab.tables = sqlLab.tables.filter(
        table => table.id !== action.oldTable.id,
      );
      localStorage.setItem('redux', JSON.stringify({ sqlLab }));

      // replace localStorage table with the server backed one
      return addToArr(
        removeFromArr(state, 'tables', action.oldTable),
        'tables',
        action.newTable,
      );
    },
    [actions.MIGRATE_TAB_HISTORY]() {
      // remove migrated tab from localStorage tabHistory
      const { sqlLab } = JSON.parse(localStorage.getItem('redux'));
      sqlLab.tabHistory = sqlLab.tabHistory.filter(
        tabId => tabId !== action.oldId,
      );
      localStorage.setItem('redux', JSON.stringify({ sqlLab }));
      const tabHistory = state.tabHistory.filter(
        tabId => tabId !== action.oldId,
      );
      tabHistory.push(action.newId);
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
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            dbId: action.dbId,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_FUNCTION_NAMES]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            functionNames: action.functionNames,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_SCHEMA]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            schema: action.schema,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_SCHEMA_OPTIONS]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            schemaOptions: action.options,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_TABLE_OPTIONS]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            tableOptions: action.options,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_TITLE]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            name: action.name,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_SQL]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            sql: action.sql,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_QUERY_LIMIT]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
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
        unsavedQueryEditor: alterUnsavedQueryEditorState(
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
        unsavedQueryEditor: alterUnsavedQueryEditorState(
          state,
          {
            selectedText: action.sql,
          },
          action.queryEditor.id,
        ),
      };
    },
    [actions.QUERY_EDITOR_SET_AUTORUN]() {
      return {
        ...state,
        unsavedQueryEditor: alterUnsavedQueryEditorState(
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
        unsavedQueryEditor: alterUnsavedQueryEditorState(
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
        unsavedQueryEditor: alterUnsavedQueryEditorState(
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
          (state.queries[id].state !== 'stopped' &&
            state.queries[id].state !== 'failed')
        ) {
          if (changedQuery.changedOn > queriesLastUpdate) {
            queriesLastUpdate = changedQuery.changedOn;
          }
          const prevState = state.queries[id]?.state;
          const currentState = changedQuery.state;
          newQueries[id] = {
            ...state.queries[id],
            ...changedQuery,
            // race condition:
            // because of async behavior, sql lab may still poll a couple of seconds
            // when it started fetching or finished rendering results
            state:
              currentState === 'success' &&
              ['fetching', 'success'].includes(prevState)
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
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
