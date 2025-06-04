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
import { isEqual, omit } from 'lodash';
import { shallowEqual } from 'react-redux';
import { now } from '@superset-ui/core/utils/dates';
import * as actions from '../actions/sqlLab';
import {
  addToObject,
  alterInObject,
  alterInArr,
  removeFromArr,
  getFromArr,
  addToArr,
  extendArr,
} from '../../reduxUtils';

function alterUnsavedQueryEditorState(
  state: $TSFixMe,
  updatedState: $TSFixMe,
  id: $TSFixMe,
  silent = false,
) {
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

// @ts-expect-error TS(7023): 'sqlLabReducer' implicitly has return type 'any' b... Remove this comment to see the full error message
export default function sqlLabReducer(state = {}, action: $TSFixMe) {
  const actionHandlers = {
    [actions.ADD_QUERY_EDITOR]() {
      const mergeUnsavedState = alterInArr(
        state,
        'queryEditors',
        // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
        state.unsavedQueryEditor,
        {
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
          ...state.unsavedQueryEditor,
        },
      );
      const newState = {
        ...mergeUnsavedState,
        // @ts-expect-error TS(2339): Property 'tabHistory' does not exist on type '{}'.
        tabHistory: [...state.tabHistory, action.queryEditor.id],
      };
      return addToArr(newState, 'queryEditors', {
        ...action.queryEditor,
        updatedAt: new Date().getTime(),
      });
    },
    [actions.QUERY_EDITOR_SAVED]() {
      const { query, result, clientId } = action;
      // @ts-expect-error TS(2339): Property 'queryEditors' does not exist on type '{}... Remove this comment to see the full error message
      const existing = state.queryEditors.find(
        (qe: $TSFixMe) => qe.id === clientId,
      );
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
      // @ts-expect-error TS(2339): Property 'queryEditors' does not exist on type '{}... Remove this comment to see the full error message
      const existing = state.queryEditors.find(
        (qe: $TSFixMe) => qe.remoteId === id,
      );
      if (existing == null) return state;
      return alterInArr(
        state,
        'queryEditors',
        existing,
        action.alterations,
        'remoteId',
      );
    },
    // @ts-expect-error TS(7023): '[actions.CLONE_QUERY_TO_NEW_TAB]' implicitly has ... Remove this comment to see the full error message
    [actions.CLONE_QUERY_TO_NEW_TAB]() {
      // @ts-expect-error TS(2339): Property 'queryEditors' does not exist on type '{}... Remove this comment to see the full error message
      const queryEditor = state.queryEditors.find(
        (qe: $TSFixMe) =>
          // @ts-expect-error TS(2339): Property 'tabHistory' does not exist on type '{}'.
          qe.id === state.tabHistory[state.tabHistory.length - 1],
      );
      const progenitor = {
        ...queryEditor,
        // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
        ...(state.unsavedQueryEditor.id === queryEditor.id &&
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
        ...(action.queryEditor.id === state.unsavedQueryEditor.id &&
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
          state.unsavedQueryEditor),
      };
      let newState = removeFromArr(state, 'queryEditors', queryEditor);
      // List of remaining queryEditor ids
      const qeIds = newState.queryEditors.map((qe: $TSFixMe) => qe.id);

      const queries = {};
      // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
      Object.keys(state.queries).forEach(k => {
        // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
        const query = state.queries[k];
        if (qeIds.indexOf(query.sqlEditorId) > -1) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          queries[k] = query;
        }
      });

      // @ts-expect-error TS(2339): Property 'tabHistory' does not exist on type '{}'.
      let tabHistory = state.tabHistory.slice();
      tabHistory = tabHistory.filter((id: $TSFixMe) => qeIds.indexOf(id) > -1);

      // Remove associated table schemas
      // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
      const tables = state.tables.filter(
        (table: $TSFixMe) => table.queryEditorId !== queryEditor.id,
      );

      newState = {
        ...newState,
        tabHistory:
          tabHistory.length === 0 && newState.queryEditors.length > 0
            ? newState.queryEditors.slice(-1).map((qe: $TSFixMe) => qe.id)
            : tabHistory,
        tables,
        queries,
        unsavedQueryEditor: {
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
          ...(action.queryEditor.id !== state.unsavedQueryEditor.id &&
            // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
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
      // @ts-expect-error TS(2339): Property 'destroyedQueryEditors' does not exist on... Remove this comment to see the full error message
      const destroyedQueryEditors = { ...state.destroyedQueryEditors };
      delete destroyedQueryEditors[action.queryEditorId];
      return { ...state, destroyedQueryEditors };
    },
    [actions.REMOVE_QUERY]() {
      // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
      const newQueries = { ...state.queries };
      delete newQueries[action.query.id];
      return { ...state, queries: newQueries };
    },
    [actions.RESET_STATE]() {
      return { ...action.sqlLabInitialState };
    },
    [actions.MERGE_TABLE]() {
      const at = { ...action.table };
      // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
      const existingTableIndex = state.tables.findIndex(
        (xt: $TSFixMe) =>
          xt.dbId === at.dbId &&
          xt.queryEditorId === at.queryEditorId &&
          xt.catalog === at.catalog &&
          xt.schema === at.schema &&
          xt.name === at.name,
      );
      if (existingTableIndex >= 0) {
        if (action.query) {
          at.dataPreviewQueryId = action.query.id;
        }
        return {
          ...state,
          tables: [
            // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
            ...state.tables.slice(0, existingTableIndex),
            {
              // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
              ...state.tables[existingTableIndex],
              ...at,
              // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
              ...(state.tables[existingTableIndex].initialized && {
                // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
                id: state.tables[existingTableIndex].id,
              }),
            },
            // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
            ...state.tables.slice(existingTableIndex + 1),
          ],
          ...(at.expanded && {
            activeSouthPaneTab: at.id,
          }),
        };
      }
      // for new table, associate Id of query for data preview
      at.dataPreviewQueryId = null;
      let newState = addToArr(state, 'tables', at, Boolean(action.prepend));
      newState.activeSouthPaneTab = at.id;
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
      // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
      const queries = { ...state.queries };
      delete queries[action.table.dataPreviewQueryId];
      const newState = alterInArr(state, 'tables', action.table, {
        dataPreviewQueryId: null,
      });
      return { ...newState, queries };
    },
    [actions.CHANGE_DATA_PREVIEW_ID]() {
      // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
      const queries = { ...state.queries };
      delete queries[action.oldQueryId];

      const newTables: $TSFixMe = [];
      // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
      state.tables.forEach((xt: $TSFixMe) => {
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
      };
    },
    [actions.COLLAPSE_TABLE]() {
      return alterInArr(state, 'tables', action.table, { expanded: false });
    },
    [actions.REMOVE_TABLES]() {
      const tableIds = action.tables.map((table: $TSFixMe) => table.id);
      // @ts-expect-error TS(2339): Property 'tables' does not exist on type '{}'.
      const tables = state.tables.filter(
        (table: $TSFixMe) => !tableIds.includes(table.id),
      );

      return {
        ...state,
        tables,
        // @ts-expect-error TS(2339): Property 'activeSouthPaneTab' does not exist on ty... Remove this comment to see the full error message
        ...(tableIds.includes(state.activeSouthPaneTab) && {
          activeSouthPaneTab:
            tables.find(
              ({ queryEditorId }: $TSFixMe) =>
                queryEditorId === action.tables[0].queryEditorId,
            )?.id ?? 'Results',
        }),
      };
    },
    [actions.COST_ESTIMATE_STARTED]() {
      return {
        ...state,
        queryCostEstimates: {
          // @ts-expect-error TS(2339): Property 'queryCostEstimates' does not exist on ty... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2339): Property 'queryCostEstimates' does not exist on ty... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2339): Property 'queryCostEstimates' does not exist on ty... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2698): Spread types may only be created from object types... Remove this comment to see the full error message
          ...getFromArr(state.queryEditors, action.query.sqlEditorId),
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
          ...(action.query.sqlEditorId === state.unsavedQueryEditor.id &&
            // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
            state.unsavedQueryEditor),
        };
        // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
        if (qe.latestQueryId && state.queries[qe.latestQueryId]) {
          const newResults = {
            // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
            ...state.queries[qe.latestQueryId].results,
            data: [],
            query: null,
          };
          // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
          const q = { ...state.queries[qe.latestQueryId], results: newResults };
          // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
          const queries = { ...state.queries, [q.id]: q };
          newState = { ...state, queries };
        }
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
        // @ts-expect-error TS(2551): Property 'STOPPED' does not exist on type 'typeof ... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2339): Property 'resultsKey' does not exist on type '{ en... Remove this comment to see the full error message
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
      // @ts-expect-error TS(2339): Property 'queryEditors' does not exist on type '{}... Remove this comment to see the full error message
      const qeIds = state.queryEditors.map((qe: $TSFixMe) => qe.id);
      if (
        qeIds.indexOf(action.queryEditor?.id) > -1 &&
        // @ts-expect-error TS(2339): Property 'tabHistory' does not exist on type '{}'.
        state.tabHistory[state.tabHistory.length - 1] !== action.queryEditor.id
      ) {
        const mergeUnsavedState = {
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
          ...alterInArr(state, 'queryEditors', state.unsavedQueryEditor, {
            // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
            ...state.unsavedQueryEditor,
          }),
          unsavedQueryEditor: {},
        };
        return {
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
          ...(action.queryEditor.id === state.unsavedQueryEditor.id
            ? alterInArr(
                mergeUnsavedState,
                'queryEditors',
                action.queryEditor,
                {
                  ...action.queryEditor,
                  // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
                  ...state.unsavedQueryEditor,
                },
              )
            : mergeUnsavedState),
          // @ts-expect-error TS(2339): Property 'tabHistory' does not exist on type '{}'.
          tabHistory: [...state.tabHistory, action.queryEditor.id],
        };
      }
      return state;
    },
    [actions.LOAD_QUERY_EDITOR]() {
      const mergeUnsavedState = alterInArr(
        state,
        'queryEditors',
        // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
        state.unsavedQueryEditor,
        {
          // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2345): Argument of type 'string | null' is not assignable... Remove this comment to see the full error message
        const { sqlLab } = JSON.parse(localStorage.getItem('redux'));
        sqlLab.queryEditors = sqlLab.queryEditors.filter(
          (qe: $TSFixMe) => qe.id !== action.oldQueryEditor.id,
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
        // @ts-expect-error TS(2345): Argument of type 'string | null' is not assignable... Remove this comment to see the full error message
        const { sqlLab } = JSON.parse(localStorage.getItem('redux'));
        sqlLab.tables = sqlLab.tables.filter(
          (table: $TSFixMe) => table.id !== action.oldTable.id,
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
      // @ts-expect-error TS(2339): Property 'tabHistory' does not exist on type '{}'.
      const tabHistory = state.tabHistory.map((tabId: $TSFixMe) =>
        tabId === action.oldId ? action.newId : tabId,
      );
      return { ...state, tabHistory };
    },
    [actions.MIGRATE_QUERY]() {
      const query = {
        // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
        ...state.queries[action.queryId],
        // point query to migrated query editor
        sqlEditorId: action.queryEditorId,
      };
      // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
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
      // @ts-expect-error TS(2339): Property 'unsavedQueryEditor' does not exist on ty... Remove this comment to see the full error message
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
      action.databases.forEach((db: $TSFixMe) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        databases[db.id] = {
          ...db,
          extra_json: JSON.parse(db.extra || ''),
        };
      });
      return { ...state, databases };
    },
    [actions.REFRESH_QUERIES]() {
      // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
      let newQueries = { ...state.queries };
      // Fetch the updates to the queries present in the store.
      let change = false;
      // @ts-expect-error TS(2339): Property 'queriesLastUpdate' does not exist on typ... Remove this comment to see the full error message
      let { queriesLastUpdate } = state;
      Object.entries(action.alteredQueries).forEach(([id, changedQuery]) => {
        if (
          // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
          !state.queries.hasOwnProperty(id) ||
          // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
          (state.queries[id].state !== QueryState.Stopped &&
            // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
            state.queries[id].state !== QueryState.Failed)
        ) {
          // @ts-expect-error TS(2571): Object is of type 'unknown'.
          const changedOn = normalizeTimestamp(changedQuery.changed_on);
          const timestamp = Date.parse(changedOn);
          if (timestamp > queriesLastUpdate) {
            queriesLastUpdate = timestamp;
          }
          // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
          const prevState = state.queries[id]?.state;
          // @ts-expect-error TS(2571): Object is of type 'unknown'.
          const currentState = changedQuery.state;
          newQueries[id] = {
            // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
            ...state.queries[id],
            // @ts-expect-error TS(2698): Spread types may only be created from object types... Remove this comment to see the full error message
            ...changedQuery,
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            ...(changedQuery.startDttm && {
              // @ts-expect-error TS(2571): Object is of type 'unknown'.
              startDttm: Number(changedQuery.startDttm),
            }),
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            ...(changedQuery.endDttm && {
              // @ts-expect-error TS(2571): Object is of type 'unknown'.
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
          if (
            shallowEqual(
              omit(newQueries[id], ['extra']),
              // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
              omit(state.queries[id], ['extra']),
            ) &&
            // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
            isEqual(newQueries[id].extra, state.queries[id].extra)
          ) {
            // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
            newQueries[id] = state.queries[id];
          } else {
            change = true;
          }
        }
      });
      if (!change) {
        // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
        newQueries = state.queries;
      }
      return { ...state, queries: newQueries, queriesLastUpdate };
    },
    [actions.CLEAR_INACTIVE_QUERIES]() {
      // @ts-expect-error TS(2339): Property 'queries' does not exist on type '{}'.
      const { queries } = state;
      const cleanedQueries = Object.fromEntries(
        Object.entries(queries)
          .filter(([, query]) => {
            if (
              // @ts-expect-error TS(2571): Object is of type 'unknown'.
              ['running', 'pending'].includes(query.state) &&
              // @ts-expect-error TS(2571): Object is of type 'unknown'.
              Date.now() - query.startDttm > action.interval &&
              // @ts-expect-error TS(2571): Object is of type 'unknown'.
              query.progress === 0
            ) {
              return false;
            }
            return true;
          })
          .map(([id, query]) => [
            id,
            {
              // @ts-expect-error TS(2698): Spread types may only be created from object types... Remove this comment to see the full error message
              ...query,
              state:
                // @ts-expect-error TS(2571): Object is of type 'unknown'.
                query.resultsKey && query.results?.status
                  ? // @ts-expect-error TS(2571): Object is of type 'unknown'.
                    query.results.status
                  : // @ts-expect-error TS(2571): Object is of type 'unknown'.
                    query.state,
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
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return actionHandlers[action.type]();
  }
  return state;
}
