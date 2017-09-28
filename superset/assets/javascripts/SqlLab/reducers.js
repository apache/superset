import shortid from 'shortid';
import * as actions from './actions';
import { now } from '../modules/dates';
import { addToObject, alterInObject, alterInArr, removeFromArr, getFromArr, addToArr }
  from '../reduxUtils';
import { t } from '../locales';

export function getInitialState(defaultDbId) {
  const defaultQueryEditor = {
    id: shortid.generate(),
    title: t('Untitled Query'),
    sql: 'SELECT *\nFROM\nWHERE',
    selectedText: null,
    latestQueryId: null,
    autorun: false,
    dbId: defaultDbId,
  };

  return {
    alerts: [],
    queries: {},
    databases: {},
    queryEditors: [defaultQueryEditor],
    tabHistory: [defaultQueryEditor.id],
    tables: [],
    queriesLastUpdate: 0,
    activeSouthPaneTab: 'Results',
  };
}

export const sqlLabReducer = function (state, action) {
  const actionHandlers = {
    [actions.ADD_QUERY_EDITOR]() {
      const tabHistory = state.tabHistory.slice();
      tabHistory.push(action.queryEditor.id);
      const newState = Object.assign({}, state, { tabHistory });
      return addToArr(newState, 'queryEditors', action.queryEditor);
    },
    [actions.CLONE_QUERY_TO_NEW_TAB]() {
      const progenitor = state.queryEditors.find(qe =>
          qe.id === state.tabHistory[state.tabHistory.length - 1]);
      const qe = {
        id: shortid.generate(),
        title: t('Copy of %s', progenitor.title),
        dbId: (action.query.dbId) ? action.query.dbId : null,
        schema: (action.query.schema) ? action.query.schema : null,
        autorun: true,
        sql: action.query.sql,
      };

      return sqlLabReducer(state, actions.addQueryEditor(qe));
    },
    [actions.REMOVE_QUERY_EDITOR]() {
      let newState = removeFromArr(state, 'queryEditors', action.queryEditor);
      // List of remaining queryEditor ids
      const qeIds = newState.queryEditors.map(qe => qe.id);
      const queries = {};
      Object.keys(state.queries).forEach((k) => {
        const query = state.queries[k];
        if (qeIds.indexOf(query.sqlEditorId) > -1) {
          queries[k] = query;
        }
      });
      let tabHistory = state.tabHistory.slice();
      tabHistory = tabHistory.filter(id => qeIds.indexOf(id) > -1);
      newState = Object.assign({}, newState, { tabHistory, queries });
      return newState;
    },
    [actions.REMOVE_QUERY]() {
      const newQueries = Object.assign({}, state.queries);
      delete newQueries[action.query.id];
      return Object.assign({}, state, { queries: newQueries });
    },
    [actions.RESET_STATE]() {
      return Object.assign({}, getInitialState());
    },
    [actions.MERGE_TABLE]() {
      const at = Object.assign({}, action.table);
      let existingTable;
      state.tables.forEach((xt) => {
        if (
            xt.dbId === at.dbId &&
            xt.queryEditorId === at.queryEditorId &&
            xt.schema === at.schema &&
            xt.name === at.name) {
          existingTable = xt;
        }
      });
      if (existingTable) {
        if (action.query) {
          at.dataPreviewQueryId = action.query.id;
        }
        return alterInArr(state, 'tables', existingTable, at);
      }
      at.id = shortid.generate();
      // for new table, associate Id of query for data preview
      at.dataPreviewQueryId = null;
      let newState = addToArr(state, 'tables', at);
      if (action.query) {
        newState = alterInArr(newState, 'tables', at, { dataPreviewQueryId: action.query.id });
      }
      return newState;
    },
    [actions.EXPAND_TABLE]() {
      return alterInArr(state, 'tables', action.table, { expanded: true });
    },
    [actions.REMOVE_DATA_PREVIEW]() {
      const queries = Object.assign({}, state.queries);
      delete queries[action.table.dataPreviewQueryId];
      const newState = alterInArr(state, 'tables', action.table, { dataPreviewQueryId: null });
      return Object.assign(
       {}, newState, { queries });
    },
    [actions.CHANGE_DATA_PREVIEW_ID]() {
      const queries = Object.assign({}, state.queries);
      delete queries[action.oldQueryId];

      const newTables = [];
      state.tables.forEach((xt) => {
        if (xt.dataPreviewQueryId === action.oldQueryId) {
          newTables.push(Object.assign({}, xt, { dataPreviewQueryId: action.newQuery.id }));
        } else {
          newTables.push(xt);
        }
      });
      return Object.assign(
       {}, state, { queries, tables: newTables, activeSouthPaneTab: action.newQuery.id });
    },
    [actions.COLLAPSE_TABLE]() {
      return alterInArr(state, 'tables', action.table, { expanded: false });
    },
    [actions.REMOVE_TABLE]() {
      return removeFromArr(state, 'tables', action.table);
    },
    [actions.START_QUERY]() {
      let newState = Object.assign({}, state);
      if (action.query.sqlEditorId) {
        const qe = getFromArr(state.queryEditors, action.query.sqlEditorId);
        if (qe.latestQueryId && state.queries[qe.latestQueryId]) {
          const newResults = Object.assign(
            {}, state.queries[qe.latestQueryId].results, { data: [], query: null });
          const q = Object.assign({}, state.queries[qe.latestQueryId], { results: newResults });
          const queries = Object.assign({}, state.queries, { [q.id]: q });
          newState = Object.assign({}, state, { queries });
        }
      } else {
        newState.activeSouthPaneTab = action.query.id;
      }
      newState = addToObject(newState, 'queries', action.query);
      const sqlEditor = { id: action.query.sqlEditorId };
      return alterInArr(newState, 'queryEditors', sqlEditor, { latestQueryId: action.query.id });
    },
    [actions.STOP_QUERY]() {
      return alterInObject(state, 'queries', action.query, { state: 'stopped', results: [] });
    },
    [actions.CLEAR_QUERY_RESULTS]() {
      const newResults = Object.assign({}, action.query.results);
      newResults.data = [];
      return alterInObject(state, 'queries', action.query, { results: newResults, cached: true });
    },
    [actions.REQUEST_QUERY_RESULTS]() {
      return alterInObject(state, 'queries', action.query, { state: 'fetching' });
    },
    [actions.QUERY_SUCCESS]() {
      if (action.query.state === 'stopped') {
        return state;
      }
      let rows;
      if (action.results.data) {
        rows = action.results.data.length;
      }
      const alts = {
        endDttm: now(),
        progress: 100,
        results: action.results,
        rows,
        state: 'success',
        errorMessage: null,
        cached: false,
      };
      return alterInObject(state, 'queries', action.query, alts);
    },
    [actions.QUERY_FAILED]() {
      if (action.query.state === 'stopped') {
        return state;
      }
      const alts = { state: 'failed', errorMessage: action.msg, endDttm: now() };
      return alterInObject(state, 'queries', action.query, alts);
    },
    [actions.SET_ACTIVE_QUERY_EDITOR]() {
      const qeIds = state.queryEditors.map(qe => qe.id);
      if (qeIds.indexOf(action.queryEditor.id) > -1) {
        const tabHistory = state.tabHistory.slice();
        tabHistory.push(action.queryEditor.id);
        return Object.assign({}, state, { tabHistory });
      }
      return state;
    },
    [actions.SET_ACTIVE_SOUTHPANE_TAB]() {
      return Object.assign({}, state, { activeSouthPaneTab: action.tabId });
    },
    [actions.QUERY_EDITOR_SETDB]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { dbId: action.dbId });
    },
    [actions.QUERY_EDITOR_SET_SCHEMA]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { schema: action.schema });
    },
    [actions.QUERY_EDITOR_SET_TITLE]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { title: action.title });
    },
    [actions.QUERY_EDITOR_SET_SQL]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { sql: action.sql });
    },
    [actions.QUERY_EDITOR_SET_SELECTED_TEXT]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { selectedText: action.sql });
    },
    [actions.QUERY_EDITOR_SET_AUTORUN]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { autorun: action.autorun });
    },
    [actions.QUERY_EDITOR_PERSIST_HEIGHT]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { height: action.currentHeight });
    },
    [actions.ADD_ALERT]() {
      return addToArr(state, 'alerts', action.alert);
    },
    [actions.SET_DATABASES]() {
      const databases = {};
      action.databases.forEach((db) => {
        databases[db.id] = db;
      });
      return Object.assign({}, state, { databases });
    },
    [actions.REMOVE_ALERT]() {
      return removeFromArr(state, 'alerts', action.alert);
    },
    [actions.REFRESH_QUERIES]() {
      let newQueries = Object.assign({}, state.queries);
      // Fetch the updates to the queries present in the store.
      let change = false;
      let queriesLastUpdate = state.queriesLastUpdate;
      for (const id in action.alteredQueries) {
        const changedQuery = action.alteredQueries[id];
        if (!state.queries.hasOwnProperty(id) ||
            state.queries[id].state !== 'stopped') {
          if (changedQuery.changedOn > queriesLastUpdate) {
            queriesLastUpdate = changedQuery.changedOn;
          }
          newQueries[id] = Object.assign({}, state.queries[id], changedQuery);
          change = true;
        }
      }
      if (!change) {
        newQueries = state.queries;
      }
      return Object.assign({}, state, { queries: newQueries, queriesLastUpdate });
    },
    [actions.CREATE_DATASOURCE_STARTED]() {
      return Object.assign({}, state, {
        isDatasourceLoading: true,
        errorMessage: null,
      });
    },
    [actions.CREATE_DATASOURCE_SUCCESS]() {
      return Object.assign({}, state, {
        isDatasourceLoading: false,
        errorMessage: null,
        datasource: action.datasource,
      });
    },
    [actions.CREATE_DATASOURCE_FAILED]() {
      return Object.assign({}, state, {
        isDatasourceLoading: false,
        errorMessage: action.err,
      });
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
