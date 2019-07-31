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
import shortid from 'shortid';
import JSONbig from 'json-bigint';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import { now } from '../../modules/dates';
import {
  addSuccessToast as addSuccessToastAction,
  addDangerToast as addDangerToastAction,
  addInfoToast as addInfoToastAction,
} from '../../messageToasts/actions/index';
import getClientErrorObject from '../../utils/getClientErrorObject';
import COMMON_ERR_MESSAGES from '../../utils/errorMessages';

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
export const QUERY_EDITOR_SET_SCHEMA_OPTIONS = 'QUERY_EDITOR_SET_SCHEMA_OPTIONS';
export const QUERY_EDITOR_SET_TABLE_OPTIONS = 'QUERY_EDITOR_SET_TABLE_OPTIONS';
export const QUERY_EDITOR_SET_TITLE = 'QUERY_EDITOR_SET_TITLE';
export const QUERY_EDITOR_SET_AUTORUN = 'QUERY_EDITOR_SET_AUTORUN';
export const QUERY_EDITOR_SET_SQL = 'QUERY_EDITOR_SET_SQL';
export const QUERY_EDITOR_SET_QUERY_LIMIT = 'QUERY_EDITOR_SET_QUERY_LIMIT';
export const QUERY_EDITOR_SET_TEMPLATE_PARAMS = 'QUERY_EDITOR_SET_TEMPLATE_PARAMS';
export const QUERY_EDITOR_SET_SELECTED_TEXT = 'QUERY_EDITOR_SET_SELECTED_TEXT';
export const QUERY_EDITOR_PERSIST_HEIGHT = 'QUERY_EDITOR_PERSIST_HEIGHT';

export const SET_DATABASES = 'SET_DATABASES';
export const SET_ACTIVE_QUERY_EDITOR = 'SET_ACTIVE_QUERY_EDITOR';
export const SET_ACTIVE_SOUTHPANE_TAB = 'SET_ACTIVE_SOUTHPANE_TAB';
export const REFRESH_QUERIES = 'REFRESH_QUERIES';
export const SET_USER_OFFLINE = 'SET_USER_OFFLINE';
export const RUN_QUERY = 'RUN_QUERY';
export const START_QUERY = 'START_QUERY';
export const STOP_QUERY = 'STOP_QUERY';
export const REQUEST_QUERY_RESULTS = 'REQUEST_QUERY_RESULTS';
export const QUERY_SUCCESS = 'QUERY_SUCCESS';
export const QUERY_FAILED = 'QUERY_FAILED';
export const CLEAR_QUERY_RESULTS = 'CLEAR_QUERY_RESULTS';
export const REMOVE_DATA_PREVIEW = 'REMOVE_DATA_PREVIEW';
export const CHANGE_DATA_PREVIEW_ID = 'CHANGE_DATA_PREVIEW_ID';

export const START_QUERY_VALIDATION = 'START_QUERY_VALIDATION';
export const QUERY_VALIDATION_RETURNED = 'QUERY_VALIDATION_RETURNED';
export const QUERY_VALIDATION_FAILED = 'QUERY_VALIDATION_FAILED';

export const CREATE_DATASOURCE_STARTED = 'CREATE_DATASOURCE_STARTED';
export const CREATE_DATASOURCE_SUCCESS = 'CREATE_DATASOURCE_SUCCESS';
export const CREATE_DATASOURCE_FAILED = 'CREATE_DATASOURCE_FAILED';

export const addInfoToast = addInfoToastAction;
export const addSuccessToast = addSuccessToastAction;
export const addDangerToast = addDangerToastAction;

export function resetState() {
  return { type: RESET_STATE };
}

export function startQueryValidation(query) {
  Object.assign(query, {
    id: query.id ? query.id : shortid.generate(),
  });
  return { type: START_QUERY_VALIDATION, query };
}

export function queryValidationReturned(query, results) {
  return { type: QUERY_VALIDATION_RETURNED, query, results };
}

export function queryValidationFailed(query, message, error) {
  return { type: QUERY_VALIDATION_FAILED, query, message, error };
}

export function saveQuery(query) {
  return dispatch =>
    SupersetClient.post({
      endpoint: '/savedqueryviewapi/api/create',
      postPayload: query,
      stringify: false,
    })
      .then(() => dispatch(addSuccessToast(t('Your query was saved'))))
      .catch(() => dispatch(addDangerToast(t('Your query could not be saved'))));
}

export function scheduleQuery(query) {
  return dispatch =>
    SupersetClient.post({
      endpoint: '/savedqueryviewapi/api/create',
      postPayload: query,
      stringify: false,
    })
      .then(() => dispatch(addSuccessToast(t('Your query has been scheduled. To see details of your query, navigate to Saved Queries'))))
      .catch(() => dispatch(addDangerToast(t('Your query could not be scheduled'))));
}

export function startQuery(query) {
  Object.assign(query, {
    id: query.id ? query.id : shortid.generate(),
    progress: 0,
    startDttm: now(),
    state: query.runAsync ? 'pending' : 'running',
    cached: false,
  });
  return { type: START_QUERY, query };
}

export function querySuccess(query, results) {
  return { type: QUERY_SUCCESS, query, results };
}

export function queryFailed(query, msg, link) {
  return { type: QUERY_FAILED, query, msg, link };
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

    return SupersetClient.get({
      endpoint: `/superset/results/${query.resultsKey}/`,
      parseMethod: 'text',
    })
      .then(({ text = '{}' }) => {
        const bigIntJson = JSONbig.parse(text);
        dispatch(querySuccess(query, bigIntJson));
      })
      .catch(response =>
        getClientErrorObject(response).then((error) => {
          const message = error.error || error.statusText || t('Failed at retrieving results');

          return dispatch(queryFailed(query, message, error.link));
        }),
      );
    };
}

export function runQuery(query) {
  return function (dispatch) {
    dispatch(startQuery(query));
    const postPayload = {
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
      templateParams: query.templateParams,
      queryLimit: query.queryLimit,
    };

    return SupersetClient.post({
      endpoint: `/superset/sql_json/${window.location.search}`,
      postPayload,
      stringify: false,
      parseMethod: 'text',
    })
      .then(({ text = '{}' }) => {
        if (!query.runAsync) {
          const bigIntJson = JSONbig.parse(text);
          dispatch(querySuccess(query, bigIntJson));
        }
      })
      .catch(response =>
        getClientErrorObject(response).then((error) => {
          let message = error.error || error.statusText || t('Unknown error');
          if (message.includes('CSRF token')) {
            message = t(COMMON_ERR_MESSAGES.SESSION_TIMED_OUT);
          }
          dispatch(queryFailed(query, message, error.link));
        }),
      );
  };
}

export function validateQuery(query) {
  return function (dispatch) {
    dispatch(startQueryValidation(query));

    const postPayload = {
      client_id: query.id,
      database_id: query.dbId,
      json: true,
      schema: query.schema,
      sql: query.sql,
      sql_editor_id: query.sqlEditorId,
      templateParams: query.templateParams,
      validate_only: true,
    };

    return SupersetClient.post({
      endpoint: `/superset/validate_sql_json/${window.location.search}`,
      postPayload,
      stringify: false,
    })
      .then(({ json }) => {
        dispatch(queryValidationReturned(query, json));
      })
      .catch(response =>
        getClientErrorObject(response).then((error) => {
          let message = error.error || error.statusText || t('Unknown error');
          if (message.includes('CSRF token')) {
            message = t(COMMON_ERR_MESSAGES.SESSION_TIMED_OUT);
          }
          dispatch(queryValidationFailed(query, message, error));
        }),
      );
  };
}

export function postStopQuery(query) {
  return function (dispatch) {
    return SupersetClient.post({
      endpoint: '/superset/stop_query/',
      postPayload: { client_id: query.id },
      stringify: false,
    })
      .then(() => dispatch(stopQuery(query)))
      .then(() => dispatch(addSuccessToast(t('Query was stopped.'))))
      .catch(() => dispatch(addDangerToast(t('Failed at stopping query. ') + `'${query.id}'`)));
  };
}

export function setDatabases(databases) {
  return { type: SET_DATABASES, databases };
}

export function addQueryEditor(queryEditor) {
  const newQueryEditor = {
    ...queryEditor,
    id: shortid.generate(),
  };
  return { type: ADD_QUERY_EDITOR, queryEditor: newQueryEditor };
}

export function cloneQueryToNewTab(query) {
  return { type: CLONE_QUERY_TO_NEW_TAB, query };
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

export function queryEditorSetSchemaOptions(queryEditor, options) {
  return { type: QUERY_EDITOR_SET_SCHEMA_OPTIONS, queryEditor, options };
}

export function queryEditorSetTableOptions(queryEditor, options) {
  return { type: QUERY_EDITOR_SET_TABLE_OPTIONS, queryEditor, options };
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

export function queryEditorSetQueryLimit(queryEditor, queryLimit) {
  return { type: QUERY_EDITOR_SET_QUERY_LIMIT, queryEditor, queryLimit };
}

export function queryEditorSetTemplateParams(queryEditor, templateParams) {
  return { type: QUERY_EDITOR_SET_TEMPLATE_PARAMS, queryEditor, templateParams };
}

export function queryEditorSetSelectedText(queryEditor, sql) {
  return { type: QUERY_EDITOR_SET_SELECTED_TEXT, queryEditor, sql };
}

export function mergeTable(table, query) {
  return { type: MERGE_TABLE, table, query };
}

export function addTable(query, tableName, schemaName) {
  return function (dispatch) {
    const table = {
      dbId: query.dbId,
      queryEditorId: query.id,
      schema: schemaName,
      name: tableName,
    };
    dispatch(
      mergeTable({
        ...table,
        isMetadataLoading: true,
        isExtraMetadataLoading: true,
        expanded: false,
      }),
    );

    SupersetClient.get({ endpoint: encodeURI(`/superset/table/${query.dbId}/` +
            `${encodeURIComponent(tableName)}/${encodeURIComponent(schemaName)}/`) })
      .then(({ json }) => {
        const dataPreviewQuery = {
          id: shortid.generate(),
          dbId: query.dbId,
          sql: json.selectStar,
          tableName,
          sqlEditorId: null,
          tab: '',
          runAsync: false,
          ctas: false,
        };
        const newTable = {
          ...table,
          ...json,
          expanded: true,
          isMetadataLoading: false,
        };

        return Promise.all([
          dispatch(mergeTable(newTable, dataPreviewQuery)), // Merge table to tables in state
          dispatch(runQuery(dataPreviewQuery)), // Run query to get preview data for table
        ]);
      })
      .catch(() =>
        Promise.all([
          dispatch(
            mergeTable({
              ...table,
              isMetadataLoading: false,
            }),
          ),
          dispatch(addDangerToast(t('An error occurred while fetching table metadata'))),
        ]),
      );

    SupersetClient.get({
      endpoint: encodeURI(`/superset/extra_table_metadata/${query.dbId}/` +
          `${encodeURIComponent(tableName)}/${encodeURIComponent(schemaName)}/`),
    })
      .then(({ json }) =>
        dispatch(mergeTable({ ...table, ...json, isExtraMetadataLoading: false })),
      )
      .catch(() =>
        Promise.all([
          dispatch(mergeTable({ ...table, isExtraMetadataLoading: false })),
          dispatch(addDangerToast(t('An error occurred while fetching table metadata'))),
        ]),
      );
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
      queryLimit: query.queryLimit,
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

export function setUserOffline(offline) {
  return { type: SET_USER_OFFLINE, offline };
}

export function persistEditorHeight(queryEditor, currentHeight) {
  return { type: QUERY_EDITOR_PERSIST_HEIGHT, queryEditor, currentHeight };
}

export function popStoredQuery(urlId) {
  return function (dispatch) {
    return SupersetClient.get({ endpoint: `/kv/${urlId}` })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            title: json.title ? json.title : t('Sjsonhared query'),
            dbId: json.dbId ? parseInt(json.dbId, 10) : null,
            schema: json.schema ? json.schema : null,
            autorun: json.autorun ? json.autorun : false,
            sql: json.sql ? json.sql : 'SELECT ...',
          }),
        ),
      )
      .catch(() => dispatch(addDangerToast(t("The query couldn't be loaded"))));
  };
}
export function popSavedQuery(saveQueryId) {
  return function (dispatch) {
    return SupersetClient.get({ endpoint: `/savedqueryviewapi/api/get/${saveQueryId}` })
      .then(({ json }) => {
        const { result } = json;
        const queryEditorProps = {
          title: result.label,
          dbId: result.db_id ? parseInt(result.db_id, 10) : null,
          schema: result.schema,
          autorun: false,
          sql: result.sql,
        };
        return dispatch(addQueryEditor(queryEditorProps));
      })
      .catch(() => dispatch(addDangerToast(t("The query couldn't be loaded"))));
  };
}
export function popDatasourceQuery(datasourceKey, sql) {
  return function (dispatch) {
    return SupersetClient.get({
      endpoint: `/superset/fetch_datasource_metadata?datasourceKey=${datasourceKey}`,
    })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            title: 'Query ' + json.name,
            dbId: json.database.id,
            schema: json.schema,
            autorun: sql !== undefined,
            sql: sql || json.select_star,
          }),
        ),
      )
      .catch(() => dispatch(addDangerToast(t("The datasource couldn't be loaded"))));
  };
}
export function createDatasourceStarted() {
  return { type: CREATE_DATASOURCE_STARTED };
}
export function createDatasourceSuccess(data) {
  const datasource = `${data.table_id}__table`;
  return { type: CREATE_DATASOURCE_SUCCESS, datasource };
}
export function createDatasourceFailed(err) {
  return { type: CREATE_DATASOURCE_FAILED, err };
}

export function createDatasource(vizOptions) {
  return (dispatch) => {
    dispatch(createDatasourceStarted());
    return SupersetClient.post({
      endpoint: '/superset/sqllab_viz/',
      postPayload: { data: vizOptions },
    })
      .then(({ data }) => {
        dispatch(createDatasourceSuccess(data));

        return Promise.resolve(data);
      })
      .catch(() => {
        dispatch(createDatasourceFailed(t('An error occurred while creating the data source')));

        return Promise.reject();
      });
  };
}
