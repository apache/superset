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
import { now } from '../../modules/dates';
import {
  addToObject,
  alterInObject,
  alterInArr,
  removeFromArr,
  getFromArr,
  addToArr,
  extendArr,
} from '../../reduxUtils';

export default function sqlLabReducer(state = {}, action) {
  const actionHandlers = {
    [actions.ADD_QUERY_EDITOR]() {
      const tabHistory = state.tabHistory.slice();
      tabHistory.push(action.queryEditor.id);
      const newState = { ...state, tabHistory };
      return addToArr(newState, 'queryEditors', action.queryEditor);
    },
    [actions.QUERY_EDITOR_SAVED]() {
      const { query, result } = action;
      const existing = state.queryEditors.find(qe => qe.id === query.id);
      return alterInArr(
        state,
        'queryEditors',
        existing,
        {
          remoteId: result.remoteId,
          title: query.title,
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
      const progenitor = state.queryEditors.find(
        qe => qe.id === state.tabHistory[state.tabHistory.length - 1],
      );
      const qe = {
        remoteId: progenitor.remoteId,
        title: t('Copy of %s', progenitor.title),
        dbId: action.query.dbId ? action.query.dbId : null,
        schema: action.query.schema ? action.query.schema : null,
        autorun: true,
        sql: action.query.sql,
        queryLimit: action.query.queryLimit,
        maxRow: action.query.maxRow,
      };
      return sqlLabReducer(state, actions.addQueryEditor(qe));
    },
    [actions.REMOVE_QUERY_EDITOR]() {
      let newState = removeFromArr(state, 'queryEditors', action.queryEditor);
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
        table => table.queryEditorId !== action.queryEditor.id,
      );

      newState = { ...newState, tabHistory, tables, queries };
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
      let newState = addToArr(state, 'tables', at);
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
    [actions.REMOVE_TABLE]() {
      return removeFromArr(state, 'tables', action.table);
    },
    [actions.START_QUERY_VALIDATION]() {
      let newState = { ...state };
      const sqlEditor = { id: action.query.sqlEditorId };
      newState = alterInArr(newState, 'queryEditors', sqlEditor, {
        validationResult: {
          id: action.query.id,
          errors: [],
          completed: false,
        },
      });
      return newState;
    },
    [actions.QUERY_VALIDATION_RETURNED]() {
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
          errors: action.results,
          completed: true,
        },
      });
      return newState;
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
      let newState = { ...state };
      const sqlEditor = { id: action.query.sqlEditorId };
      newState = alterInArr(newState, 'queryEditors', sqlEditor, {
        queryCostEstimate: {
          completed: false,
          cost: null,
          error: null,
        },
      });
      return newState;
    },
    [actions.COST_ESTIMATE_RETURNED]() {
      let newState = { ...state };
      const sqlEditor = { id: action.query.sqlEditorId };
      newState = alterInArr(newState, 'queryEditors', sqlEditor, {
        queryCostEstimate: {
          completed: true,
          cost: action.json,
          error: null,
        },
      });
      return newState;
    },
    [actions.COST_ESTIMATE_FAILED]() {
      let newState = { ...state };
      const sqlEditor = { id: action.query.sqlEditorId };
      newState = alterInArr(newState, 'queryEditors', sqlEditor, {
        queryCostEstimate: {
          completed: false,
          cost: null,
          error: action.error,
        },
      });
      return newState;
    },
    [actions.START_QUERY]() {
      let newState = { ...state };
      if (action.query.sqlEditorId) {
        const qe = getFromArr(state.queryEditors, action.query.sqlEditorId);
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
      const sqlEditor = { id: action.query.sqlEditorId };
      return alterInArr(newState, 'queryEditors', sqlEditor, {
        latestQueryId: action.query.id,
      });
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
      const alts = {
        endDttm: now(),
        progress: 100,
        results: action.results,
        rows: action?.results?.data?.length,
        state: 'success',
        tempSchema: action?.results?.query?.tempSchema,
        tempTable: action?.results?.query?.tempTable,
        errorMessage: null,
        cached: false,
      };
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
        qeIds.indexOf(action.queryEditor.id) > -1 &&
        state.tabHistory[state.tabHistory.length - 1] !== action.queryEditor.id
      ) {
        const tabHistory = state.tabHistory.slice();
        tabHistory.push(action.queryEditor.id);
        return { ...state, tabHistory };
      }
      return state;
    },
    [actions.LOAD_QUERY_EDITOR]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
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
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        dbId: action.dbId,
      });
    },
    [actions.QUERY_EDITOR_SET_SCHEMA]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        schema: action.schema,
      });
    },
    [actions.QUERY_EDITOR_SET_SCHEMA_OPTIONS]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        schemaOptions: action.options,
      });
    },
    [actions.QUERY_EDITOR_SET_TABLE_OPTIONS]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        tableOptions: action.options,
      });
    },
    [actions.QUERY_EDITOR_SET_TITLE]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        title: action.title,
      });
    },
    [actions.QUERY_EDITOR_SET_SQL]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        sql: action.sql,
      });
    },
    [actions.QUERY_EDITOR_SET_QUERY_LIMIT]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        queryLimit: action.queryLimit,
      });
    },
    [actions.QUERY_EDITOR_SET_TEMPLATE_PARAMS]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        templateParams: action.templateParams,
      });
    },
    [actions.QUERY_EDITOR_SET_SELECTED_TEXT]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        selectedText: action.sql,
      });
    },
    [actions.QUERY_EDITOR_SET_AUTORUN]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        autorun: action.autorun,
      });
    },
    [actions.QUERY_EDITOR_PERSIST_HEIGHT]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, {
        northPercent: action.northPercent,
        southPercent: action.southPercent,
      });
    },
    [actions.SET_DATABASES]() {
      const databases = {};
      action.databases.forEach(db => {
        databases[db.id] = db;
      });
      return { ...state, databases };
    },
    [actions.REFRESH_QUERIES]() {
      let newQueries = { ...state.queries };
      // Fetch the updates to the queries present in the store.
      let change = false;
      let { queriesLastUpdate } = state;
      for (const id in action.alteredQueries) {
        const changedQuery = action.alteredQueries[id];
        if (
          !state.queries.hasOwnProperty(id) ||
          (state.queries[id].state !== 'stopped' &&
            state.queries[id].state !== 'failed')
        ) {
          if (changedQuery.changedOn > queriesLastUpdate) {
            queriesLastUpdate = changedQuery.changedOn;
          }
          newQueries[id] = { ...state.queries[id], ...changedQuery };
          change = true;
        }
      }
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
