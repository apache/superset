import shortid from 'shortid';
import { now } from '../modules/dates';
const $ = require('jquery');

export const RESET_STATE = 'RESET_STATE';
export const ADD_QUERY_EDITOR = 'ADD_QUERY_EDITOR';
export const CLONE_QUERY_TO_NEW_TAB = 'CLONE_QUERY_TO_NEW_TAB';
export const REMOVE_QUERY_EDITOR = 'REMOVE_QUERY_EDITOR';
export const MERGE_TABLE = 'MERGE_TABLE';
export const REMOVE_TABLE = 'REMOVE_TABLE';
export const END_QUERY = 'END_QUERY';
export const REMOVE_QUERY = 'REMOVE_QUERY';
export const EXPAND_TABLE = 'EXPAND_TABLE';
export const COLLAPSE_TABLE = 'COLLAPSE_TABLE';
export const QUERY_EDITOR_SETDB = 'QUERY_EDITOR_SETDB';
export const QUERY_EDITOR_SET_SCHEMA = 'QUERY_EDITOR_SET_SCHEMA';
export const QUERY_EDITOR_SET_TITLE = 'QUERY_EDITOR_SET_TITLE';
export const QUERY_EDITOR_SET_AUTORUN = 'QUERY_EDITOR_SET_AUTORUN';
export const QUERY_EDITOR_SET_SQL = 'QUERY_EDITOR_SET_SQL';
export const QUERY_EDITOR_SET_SELECTED_TEXT = 'QUERY_EDITOR_SET_SELECTED_TEXT';
export const SET_DATABASES = 'SET_DATABASES';
export const SET_ACTIVE_QUERY_EDITOR = 'SET_ACTIVE_QUERY_EDITOR';
export const SET_ACTIVE_SOUTHPANE_TAB = 'SET_ACTIVE_SOUTHPANE_TAB';
export const ADD_ALERT = 'ADD_ALERT';
export const REMOVE_ALERT = 'REMOVE_ALERT';
export const REFRESH_QUERIES = 'REFRESH_QUERIES';
export const SET_NETWORK_STATUS = 'SET_NETWORK_STATUS';
export const RUN_QUERY = 'RUN_QUERY';
export const START_QUERY = 'START_QUERY';
export const STOP_QUERY = 'STOP_QUERY';
export const REQUEST_QUERY_RESULTS = 'REQUEST_QUERY_RESULTS';
export const QUERY_SUCCESS = 'QUERY_SUCCESS';
export const QUERY_FAILED = 'QUERY_FAILED';
export const CLEAR_QUERY_RESULTS = 'CLEAR_QUERY_RESULTS';
export const REMOVE_DATA_PREVIEW = 'REMOVE_DATA_PREVIEW';
export const CHANGE_DATA_PREVIEW_ID = 'CHANGE_DATA_PREVIEW_ID';

export function resetState() {
  return { type: RESET_STATE };
}

export function startQuery(query) {
  Object.assign(query, {
    id: query.id ? query.id : shortid.generate(),
    progress: 0,
    startDttm: now(),
    state: (query.runAsync) ? 'pending' : 'running',
    cached: false,
  });
  return { type: START_QUERY, query };
}

export function querySuccess(query, results) {
  return { type: QUERY_SUCCESS, query, results };
}

export function queryFailed(query, msg) {
  return { type: QUERY_FAILED, query, msg };
}

export function stopQuery(query) {
  return { type: STOP_QUERY, query };
}

export function clearQueryResults(query) {
  return { type: CLEAR_QUERY_RESULTS, query };
}

export function removeDataPreview(table) {
  return { type: REMOVE_DATA_PREVIEW, table };
}

export function requestQueryResults(query) {
  return { type: REQUEST_QUERY_RESULTS, query };
}

export function fetchQueryResults(query) {
  return function (dispatch) {
    dispatch(requestQueryResults(query));
    const sqlJsonUrl = `/superset/results/${query.resultsKey}/`;
    $.ajax({
      type: 'GET',
      dataType: 'json',
      url: sqlJsonUrl,
      success(results) {
        dispatch(querySuccess(query, results));
      },
      error(err) {
        let msg = 'Failed at retrieving results from the results backend';
        if (err.responseJSON && err.responseJSON.error) {
          msg = err.responseJSON.error;
        }
        dispatch(queryFailed(query, msg));
      },
    });
  };
}

export function runQuery(query) {
  return function (dispatch) {
    dispatch(startQuery(query));
    const sqlJsonUrl = '/superset/sql_json/';
    const sqlJsonRequest = {
      client_id: query.id,
      database_id: query.dbId,
      json: true,
      runAsync: query.runAsync,
      schema: query.schema,
      sql: query.sql,
      sql_editor_id: query.sqlEditorId,
      tab: query.tab,
      tmp_table_name: query.tempTableName,
      select_as_cta: query.ctas,
    };
    $.ajax({
      type: 'POST',
      dataType: 'json',
      url: sqlJsonUrl,
      data: sqlJsonRequest,
      success(results) {
        if (!query.runAsync) {
          dispatch(querySuccess(query, results));
        }
      },
      error(err, textStatus, errorThrown) {
        let msg;
        try {
          msg = err.responseJSON.error;
        } catch (e) {
          if (err.responseText !== undefined) {
            msg = err.responseText;
          }
        }
        if (textStatus === 'error' && errorThrown === '') {
          msg = 'Could not connect to server';
        } else if (msg === null) {
          msg = `[${textStatus}] ${errorThrown}`;
        }
        dispatch(queryFailed(query, msg));
      },
    });
  };
}

export function setDatabases(databases) {
  return { type: SET_DATABASES, databases };
}

export function addQueryEditor(queryEditor) {
  const newQe = Object.assign({}, queryEditor, { id: shortid.generate() });
  return { type: ADD_QUERY_EDITOR, queryEditor: newQe };
}

export function cloneQueryToNewTab(query) {
  return { type: CLONE_QUERY_TO_NEW_TAB, query };
}

export function setNetworkStatus(networkOn) {
  return { type: SET_NETWORK_STATUS, networkOn };
}

export function addAlert(alert) {
  const o = Object.assign({}, alert);
  o.id = shortid.generate();
  return { type: ADD_ALERT, alert: o };
}

export function removeAlert(alert) {
  return { type: REMOVE_ALERT, alert };
}

export function setActiveQueryEditor(queryEditor) {
  return { type: SET_ACTIVE_QUERY_EDITOR, queryEditor };
}

export function setActiveSouthPaneTab(tabId) {
  return { type: SET_ACTIVE_SOUTHPANE_TAB, tabId };
}

export function removeQueryEditor(queryEditor) {
  return { type: REMOVE_QUERY_EDITOR, queryEditor };
}

export function removeQuery(query) {
  return { type: REMOVE_QUERY, query };
}

export function queryEditorSetDb(queryEditor, dbId) {
  return { type: QUERY_EDITOR_SETDB, queryEditor, dbId };
}

export function queryEditorSetSchema(queryEditor, schema) {
  return { type: QUERY_EDITOR_SET_SCHEMA, queryEditor, schema };
}

export function queryEditorSetAutorun(queryEditor, autorun) {
  return { type: QUERY_EDITOR_SET_AUTORUN, queryEditor, autorun };
}

export function queryEditorSetTitle(queryEditor, title) {
  return { type: QUERY_EDITOR_SET_TITLE, queryEditor, title };
}

export function queryEditorSetSql(queryEditor, sql) {
  return { type: QUERY_EDITOR_SET_SQL, queryEditor, sql };
}

export function queryEditorSetSelectedText(queryEditor, sql) {
  return { type: QUERY_EDITOR_SET_SELECTED_TEXT, queryEditor, sql };
}

export function mergeTable(table, query) {
  return { type: MERGE_TABLE, table, query };
}

export function addTable(query, tableName) {
  return function (dispatch) {
    let url = `/superset/table/${query.dbId}/${tableName}/${query.schema}/`;
    $.get(url, (data) => {
      const dataPreviewQuery = {
        id: shortid.generate(),
        dbId: query.dbId,
        sql: data.selectStar,
        tableName,
        sqlEditorId: null,
        tab: '',
        runAsync: false,
        ctas: false,
      };
      // Merge table to tables in state
      dispatch(mergeTable(
        Object.assign(data, {
          dbId: query.dbId,
          queryEditorId: query.id,
          schema: query.schema,
          expanded: true,
        }), dataPreviewQuery)
      );
      // Run query to get preview data for table
      dispatch(runQuery(dataPreviewQuery));
    })
    .fail(() => {
      dispatch(
        addAlert({
          msg: 'Error occurred while fetching metadata',
          bsStyle: 'danger',
        })
      );
    });

    url = `/superset/extra_table_metadata/${query.dbId}/${tableName}/${query.schema}/`;
    $.get(url, (data) => {
      const table = {
        dbId: query.dbId,
        queryEditorId: query.id,
        schema: query.schema,
        name: tableName,
      };
      Object.assign(table, data);
      dispatch(mergeTable(table));
    });
  };
}

export function changeDataPreviewId(oldQueryId, newQuery) {
  return { type: CHANGE_DATA_PREVIEW_ID, oldQueryId, newQuery };
}

export function reFetchQueryResults(query) {
  return function (dispatch) {
    const newQuery = {
      id: shortid.generate(),
      dbId: query.dbId,
      sql: query.sql,
      tableName: query.tableName,
      sqlEditorId: null,
      tab: '',
      runAsync: false,
      ctas: false,
    };
    dispatch(runQuery(newQuery));
    dispatch(changeDataPreviewId(query.id, newQuery));
  };
}

export function expandTable(table) {
  return { type: EXPAND_TABLE, table };
}

export function collapseTable(table) {
  return { type: COLLAPSE_TABLE, table };
}

export function removeTable(table) {
  return { type: REMOVE_TABLE, table };
}

export function refreshQueries(alteredQueries) {
  return { type: REFRESH_QUERIES, alteredQueries };
}
