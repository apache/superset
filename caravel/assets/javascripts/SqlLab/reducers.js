import shortid from 'shortid';
import * as actions from './actions';
import { now } from '../modules/dates';
import { addToObject, alterInObject, alterInArr, removeFromArr, getFromArr, addToArr }
  from '../reduxUtils.js';

const defaultQueryEditor = {
  id: shortid.generate(),
  title: 'Untitled Query',
  sql: 'SELECT *\nFROM\nWHERE',
  latestQueryId: null,
  autorun: false,
  dbId: null,
};

// TODO(bkyryliuk): document the object schemas
export const initialState = {
  alerts: [],
  networkOn: true,
  queries: {},
  databases: {},
  queryEditors: [defaultQueryEditor],
  tabHistory: [defaultQueryEditor.id],
  tables: [],
  workspaceQueries: [],
  queriesLastUpdate: 0,
};

export const sqlLabReducer = function (state, action) {
  const actionHandlers = {
    [actions.ADD_QUERY_EDITOR]() {
      const tabHistory = state.tabHistory.slice();
      tabHistory.push(action.queryEditor.id);
      const newState = Object.assign({}, state, { tabHistory });
      return addToArr(newState, 'queryEditors', action.queryEditor);
    },
    [actions.REMOVE_QUERY_EDITOR]() {
      let newState = removeFromArr(state, 'queryEditors', action.queryEditor);
      // List of remaining queryEditor ids
      const qeIds = newState.queryEditors.map((qe) => qe.id);
      const queries = {};
      Object.keys(state.queries).forEach((k) => {
        const query = state.queries[k];
        if (qeIds.includes(query.sqlEditorId)) {
          queries[k] = query;
        }
      });
      let tabHistory = state.tabHistory.slice();
      tabHistory = tabHistory.filter((id) => qeIds.includes(id));
      newState = Object.assign({}, newState, { tabHistory, queries });
      return newState;
    },
    [actions.REMOVE_QUERY]() {
      const newQueries = Object.assign({}, state.queries);
      delete newQueries[action.query.id];
      return Object.assign({}, state, { queries: newQueries });
    },
    [actions.RESET_STATE]() {
      return Object.assign({}, initialState);
    },
    [actions.ADD_TABLE]() {
      return addToArr(state, 'tables', action.table);
    },
    [actions.EXPAND_TABLE]() {
      return alterInArr(state, 'tables', action.table, { expanded: true });
    },
    [actions.COLLAPSE_TABLE]() {
      return alterInArr(state, 'tables', action.table, { expanded: false });
    },
    [actions.REMOVE_TABLE]() {
      return removeFromArr(state, 'tables', action.table);
    },
    [actions.START_QUERY]() {
      const qe = getFromArr(state.queryEditors, action.query.sqlEditorId);
      let newState = Object.assign({}, state);
      if (qe.latestQueryId) {
        const q = Object.assign({}, state.queries[qe.latestQueryId], { results: null });
        const queries = Object.assign({}, state.queries, { [q.id]: q });
        newState = Object.assign({}, state, { queries });
      }
      newState = addToObject(newState, 'queries', action.query);
      const sqlEditor = { id: action.query.sqlEditorId };
      return alterInArr(newState, 'queryEditors', sqlEditor, { latestQueryId: action.query.id });
    },
    [actions.STOP_QUERY]() {
      return alterInObject(state, 'queries', action.query, { state: 'stopped' });
    },
    [actions.QUERY_SUCCESS]() {
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
      };
      return alterInObject(state, 'queries', action.query, alts);
    },
    [actions.QUERY_FAILED]() {
      const alts = { state: 'failed', errorMessage: action.msg, endDttm: now() };
      return alterInObject(state, 'queries', action.query, alts);
    },
    [actions.SET_ACTIVE_QUERY_EDITOR]() {
      const qeIds = state.queryEditors.map((qe) => qe.id);
      if (qeIds.includes(action.queryEditor.id)) {
        const tabHistory = state.tabHistory.slice();
        tabHistory.push(action.queryEditor.id);
        return Object.assign({}, state, { tabHistory });
      }
      return state;
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
    [actions.QUERY_EDITOR_SET_AUTORUN]() {
      return alterInArr(state, 'queryEditors', action.queryEditor, { autorun: action.autorun });
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
    [actions.SET_NETWORK_STATUS]() {
      if (state.networkOn !== action.networkOn) {
        return Object.assign({}, state, { networkOn: action.networkOn });
      }
      return state;
    },
    [actions.REFRESH_QUERIES]() {
      let newQueries = Object.assign({}, state.queries);
      // Fetch the updates to the queries present in the store.
      let change = false;
      for (const id in action.alteredQueries) {
        const changedQuery = action.alteredQueries[id];
        if (
            !state.queries.hasOwnProperty(id) ||
            state.queries[id].changedOn !== changedQuery.changedOn) {
          newQueries[id] = Object.assign({}, state.queries[id], changedQuery);
          change = true;
        }
      }
      if (!change) {
        newQueries = state.queries;
      }
      const queriesLastUpdate = now();
      return Object.assign({}, state, { queries: newQueries, queriesLastUpdate });
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
