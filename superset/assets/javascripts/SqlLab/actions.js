/* global notify */
import shortid from 'shortid';
import { now } from '../modules/dates';
import { t } from '../locales';

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
export const QUERY_EDITOR_PERSIST_HEIGHT = 'QUERY_EDITOR_PERSIST_HEIGHT';

export const SET_DATABASES = 'SET_DATABASES';
export const SET_ACTIVE_QUERY_EDITOR = 'SET_ACTIVE_QUERY_EDITOR';
export const SET_ACTIVE_SOUTHPANE_TAB = 'SET_ACTIVE_SOUTHPANE_TAB';
export const ADD_ALERT = 'ADD_ALERT';
export const REMOVE_ALERT = 'REMOVE_ALERT';
export const REFRESH_QUERIES = 'REFRESH_QUERIES';
export const RUN_QUERY = 'RUN_QUERY';
export const START_QUERY = 'START_QUERY';
export const STOP_QUERY = 'STOP_QUERY';
export const REQUEST_QUERY_RESULTS = 'REQUEST_QUERY_RESULTS';
export const QUERY_SUCCESS = 'QUERY_SUCCESS';
export const QUERY_FAILED = 'QUERY_FAILED';
export const CLEAR_QUERY_RESULTS = 'CLEAR_QUERY_RESULTS';
export const REMOVE_DATA_PREVIEW = 'REMOVE_DATA_PREVIEW';
export const CHANGE_DATA_PREVIEW_ID = 'CHANGE_DATA_PREVIEW_ID';
export const SAVE_QUERY = 'SAVE_QUERY';

export const CREATE_DATASOURCE_STARTED = 'CREATE_DATASOURCE_STARTED';
export const CREATE_DATASOURCE_SUCCESS = 'CREATE_DATASOURCE_SUCCESS';
export const CREATE_DATASOURCE_FAILED = 'CREATE_DATASOURCE_FAILED';

export function resetState() {
  return { type: RESET_STATE };
}

export function saveQuery(query) {
  const url = '/savedqueryviewapi/api/create';
  $.ajax({
    type: 'POST',
    url,
    data: query,
    success: () => notify.success(t('Your query was saved')),
    error: () => notify.error(t('Your query could not be saved')),
    dataType: 'json',
  });
  return { type: SAVE_QUERY };
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
        let msg = t('Failed at retrieving results from the results backend');
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
    const sqlJsonUrl = '/superset/sql_json/' + location.search;
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
          msg = t('Could not connect to server');
        } else if (msg === null) {
          msg = `[${textStatus}] ${errorThrown}`;
        }
        if (msg.indexOf('CSRF token') > 0) {
          msg = t('Your session timed out, please refresh your page and try again.');
        }
        dispatch(queryFailed(query, msg));
      },
    });
  };
}

export function postStopQuery(query) {
  return function (dispatch) {
    const stopQueryUrl = '/superset/stop_query/';
    const stopQueryRequestData = { client_id: query.id };
    dispatch(stopQuery(query));
    $.ajax({
      type: 'POST',
      dataType: 'json',
      url: stopQueryUrl,
      data: stopQueryRequestData,
      success() {
        notify.success(t('Query was stopped.'));
      },
      error() {
        notify.error(t('Failed at stopping query.'));
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

export function addTable(query, tableName, schemaName) {
  return function (dispatch) {
    let table = {
      dbId: query.dbId,
      queryEditorId: query.id,
      schema: schemaName,
      name: tableName,
    };
    dispatch(mergeTable(Object.assign({}, table, {
      isMetadataLoading: true,
      isExtraMetadataLoading: true,
      expanded: false,
    })));

    let url = `/superset/table/${query.dbId}/${tableName}/${schemaName}/`;
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
      const newTable = Object.assign({}, table, data, {
        expanded: true,
        isMetadataLoading: false,
      });
      dispatch(mergeTable(newTable, dataPreviewQuery));
      // Run query to get preview data for table
      dispatch(runQuery(dataPreviewQuery));
    })
    .fail(() => {
      const newTable = Object.assign({}, table, {
        isMetadataLoading: false,
      });
      dispatch(mergeTable(newTable));
      notify.error(t('Error occurred while fetching table metadata'));
    });

    url = `/superset/extra_table_metadata/${query.dbId}/${tableName}/${schemaName}/`;
    $.get(url, (data) => {
      table = Object.assign({}, table, data, { isExtraMetadataLoading: false });
      dispatch(mergeTable(table));
    })
    .fail(() => {
      const newTable = Object.assign({}, table, {
        isExtraMetadataLoading: false,
      });
      dispatch(mergeTable(newTable));
      notify.error(t('Error occurred while fetching table metadata'));
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

export function persistEditorHeight(queryEditor, currentHeight) {
  return { type: QUERY_EDITOR_PERSIST_HEIGHT, queryEditor, currentHeight };
}

export function popStoredQuery(urlId) {
  return function (dispatch) {
    $.ajax({
      type: 'GET',
      url: `/kv/${urlId}`,
      success: (data) => {
        const newQuery = JSON.parse(data);
        const queryEditorProps = {
          title: newQuery.title ? newQuery.title : t('shared query'),
          dbId: newQuery.dbId ? parseInt(newQuery.dbId, 10) : null,
          schema: newQuery.schema ? newQuery.schema : null,
          autorun: newQuery.autorun ? newQuery.autorun : false,
          sql: newQuery.sql ? newQuery.sql : 'SELECT ...',
        };
        dispatch(addQueryEditor(queryEditorProps));
      },
      error: () => notify.error(t('The query couldn\'t be loaded')),
    });
  };
}
export function popSavedQuery(saveQueryId) {
  return function (dispatch) {
    $.ajax({
      type: 'GET',
      url: `/savedqueryviewapi/api/get/${saveQueryId}`,
      success: (data) => {
        const sq = data.result;
        const queryEditorProps = {
          title: sq.label,
          dbId: sq.db_id ? parseInt(sq.db_id, 10) : null,
          schema: sq.schema,
          autorun: false,
          sql: sq.sql,
        };
        dispatch(addQueryEditor(queryEditorProps));
      },
      error: () => notify.error(t('The query couldn\'t be loaded')),
    });
  };
}

export function createDatasourceStarted() {
  return { type: CREATE_DATASOURCE_STARTED };
}
export function createDatasourceSuccess(response) {
  const data = JSON.parse(response);
  const datasource = `${data.table_id}__table`;
  return { type: CREATE_DATASOURCE_SUCCESS, datasource };
}
export function createDatasourceFailed(err) {
  return { type: CREATE_DATASOURCE_FAILED, err };
}

export function createDatasource(vizOptions, context) {
  return (dispatch) => {
    dispatch(createDatasourceStarted());

    return $.ajax({
      type: 'POST',
      url: '/superset/sqllab_viz/',
      async: false,
      data: {
        data: JSON.stringify(vizOptions),
      },
      context,
      dataType: 'json',
      success: (resp) => {
        dispatch(createDatasourceSuccess(resp));
      },
      error: () => {
        dispatch(createDatasourceFailed(t('An error occurred while creating the data source')));
      },
    });
  };
}
