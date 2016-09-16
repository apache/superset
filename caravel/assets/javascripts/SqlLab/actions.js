export const RESET_STATE = 'RESET_STATE';
export const ADD_QUERY_EDITOR = 'ADD_QUERY_EDITOR';
export const REMOVE_QUERY_EDITOR = 'REMOVE_QUERY_EDITOR';
export const ADD_TABLE = 'ADD_TABLE';
export const REMOVE_TABLE = 'REMOVE_TABLE';
export const START_QUERY = 'START_QUERY';
export const STOP_QUERY = 'STOP_QUERY';
export const END_QUERY = 'END_QUERY';
export const REMOVE_QUERY = 'REMOVE_QUERY';
export const EXPAND_TABLE = 'EXPAND_TABLE';
export const COLLAPSE_TABLE = 'COLLAPSE_TABLE';
export const QUERY_SUCCESS = 'QUERY_SUCCESS';
export const QUERY_FAILED = 'QUERY_FAILED';
export const QUERY_EDITOR_SETDB = 'QUERY_EDITOR_SETDB';
export const QUERY_EDITOR_SET_SCHEMA = 'QUERY_EDITOR_SET_SCHEMA';
export const QUERY_EDITOR_SET_TITLE = 'QUERY_EDITOR_SET_TITLE';
export const QUERY_EDITOR_SET_AUTORUN = 'QUERY_EDITOR_SET_AUTORUN';
export const QUERY_EDITOR_SET_SQL = 'QUERY_EDITOR_SET_SQL';
export const SET_DATABASES = 'SET_DATABASES';
export const ADD_WORKSPACE_QUERY = 'ADD_WORKSPACE_QUERY';
export const REMOVE_WORKSPACE_QUERY = 'REMOVE_WORKSPACE_QUERY';
export const SET_ACTIVE_QUERY_EDITOR = 'SET_ACTIVE_QUERY_EDITOR';
export const ADD_ALERT = 'ADD_ALERT';
export const REMOVE_ALERT = 'REMOVE_ALERT';
export const REFRESH_QUERIES = 'REFRESH_QUERIES';
export const SET_NETWORK_STATUS = 'SET_NETWORK_STATUS';

export function resetState() {
  return { type: RESET_STATE };
}

export function setDatabases(databases) {
  return { type: SET_DATABASES, databases };
}

export function addQueryEditor(queryEditor) {
  return { type: ADD_QUERY_EDITOR, queryEditor };
}

export function setNetworkStatus(networkOn) {
  return { type: SET_NETWORK_STATUS, networkOn };
}

export function addAlert(alert) {
  return { type: ADD_ALERT, alert };
}

export function removeAlert(alert) {
  return { type: REMOVE_ALERT, alert };
}

export function setActiveQueryEditor(queryEditor) {
  return { type: SET_ACTIVE_QUERY_EDITOR, queryEditor };
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

export function addTable(table) {
  return { type: ADD_TABLE, table };
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

export function startQuery(query) {
  return { type: START_QUERY, query };
}

export function stopQuery(query) {
  return { type: STOP_QUERY, query };
}

export function querySuccess(query, results) {
  return { type: QUERY_SUCCESS, query, results };
}

export function queryFailed(query, msg) {
  return { type: QUERY_FAILED, query, msg };
}

export function addWorkspaceQuery(query) {
  return { type: ADD_WORKSPACE_QUERY, query };
}

export function removeWorkspaceQuery(query) {
  return { type: REMOVE_WORKSPACE_QUERY, query };
}
export function refreshQueries(alteredQueries) {
  return { type: REFRESH_QUERIES, alteredQueries };
}
