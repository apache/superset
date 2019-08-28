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
import invert from 'lodash/invert';
import mapKeys from 'lodash/mapKeys';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

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
export const UPDATE_QUERY_EDITOR = 'UPDATE_QUERY_EDITOR';
export const QUERY_EDITOR_SAVED = 'QUERY_EDITOR_SAVED';
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
export const MIGRATE_QUERY_EDITOR = 'MIGRATE_QUERY_EDITOR';
export const MIGRATE_TAB_HISTORY = 'MIGRATE_TAB_HISTORY';
export const MIGRATE_TABLE = 'MIGRATE_TABLE';

export const SET_DATABASES = 'SET_DATABASES';
export const SET_ACTIVE_QUERY_EDITOR = 'SET_ACTIVE_QUERY_EDITOR';
export const LOAD_QUERY_EDITOR = 'LOAD_QUERY_EDITOR';
export const SET_TABLES = 'SET_TABLES';
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
export const COST_ESTIMATE_STARTED = 'COST_ESTIMATE_STARTED';
export const COST_ESTIMATE_RETURNED = 'COST_ESTIMATE_RETURNED';
export const COST_ESTIMATE_FAILED = 'COST_ESTIMATE_FAILED';

export const CREATE_DATASOURCE_STARTED = 'CREATE_DATASOURCE_STARTED';
export const CREATE_DATASOURCE_SUCCESS = 'CREATE_DATASOURCE_SUCCESS';
export const CREATE_DATASOURCE_FAILED = 'CREATE_DATASOURCE_FAILED';

export const addInfoToast = addInfoToastAction;
export const addSuccessToast = addSuccessToastAction;
export const addDangerToast = addDangerToastAction;

// a map of SavedQuery field names to the different names used client-side,
// because for now making the names consistent is too complicated
// so it might as well only happen in one place
const queryClientMapping = {
  id: 'remoteId',
  db_id: 'dbId',
  client_id: 'id',
  label: 'title',
};
const queryServerMapping = invert(queryClientMapping);

// uses a mapping like those above to convert object key names to another style
const fieldConverter = mapping => obj =>
  mapKeys(obj, (value, key) => key in mapping ? mapping[key] : key);

const convertQueryToServer = fieldConverter(queryServerMapping);
const convertQueryToClient = fieldConverter(queryClientMapping);

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
      postPayload: convertQueryToServer(query),
      stringify: false,
    })
      .then((result) => {
        dispatch({
          type: QUERY_EDITOR_SAVED,
          query,
          result: convertQueryToClient(result.json.item),
        });
        dispatch(addSuccessToast(t('Your query was saved')));
      })
      .catch(() => dispatch(addDangerToast(t('Your query could not be saved'))));
}

export function updateQueryEditor(alterations) {
  return { type: UPDATE_QUERY_EDITOR, alterations };
}

export function updateSavedQuery(query) {
  return dispatch =>
    SupersetClient.put({
      endpoint: `/savedqueryviewapi/api/update/${query.remoteId}`,
      postPayload: convertQueryToServer(query),
      stringify: false,
    })
      .then(() => dispatch(addSuccessToast(t('Your query was updated'))))
      .catch(() => dispatch(addDangerToast(t('Your query could not be updated'))))
      .then(() => dispatch(updateQueryEditor(query)));
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

export function estimateQueryCost(query) {
  const { dbId, schema, sql, templateParams } = query;
  const endpoint = schema === null
      ? `/superset/estimate_query_cost/${dbId}/`
      : `/superset/estimate_query_cost/${dbId}/${schema}/`;
  return dispatch => Promise.all([
    dispatch({ type: COST_ESTIMATE_STARTED, query }),
    SupersetClient.post({
      endpoint,
      postPayload: { sql, templateParams: JSON.parse(templateParams) },
    })
      .then(({ json }) => dispatch({ type: COST_ESTIMATE_RETURNED, query, json }))
      .catch(response =>
        getClientErrorObject(response).then((error) => {
          const message = error.error || error.statusText || t('Failed at retrieving results');
          return dispatch({ type: COST_ESTIMATE_FAILED, query, error: message });
        }),
      ),
  ]);
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
  return function (dispatch) {
    // table preview queries have `sqlEditorId` set to the string 'null'; those
    // shouldn't be synced to the tab state view since they're not the main query
    const isDataPreview = results.query && results.query.sqlEditorId === 'null';
    const sync = (!isDataPreview && isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE))
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${results.query.sqlEditorId}`),
          postPayload: { query_id: results.query_id },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_SUCCESS, query, results }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while updating tab query'))),
      );
  };
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

export function fetchQueryResults(query, displayLimit) {
  return function (dispatch) {
    dispatch(requestQueryResults(query));

    return SupersetClient.get({
      endpoint: `/superset/results/${query.resultsKey}/?rows=${displayLimit}`,
      parseMethod: 'text',
    })
      .then(({ text = '{}' }) => {
        const bigIntJson = JSONbig.parse(text);
        const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
          ? SupersetClient.put({
              endpoint: encodeURI(`/tabstateview/${bigIntJson.query.sqlEditorId}`),
              postPayload: { query_id: bigIntJson.query_id },
            })
          : Promise.resolve();

        return sync
          .then(() => dispatch({ type: QUERY_SUCCESS, query, results: bigIntJson }))
          .catch(() =>
            dispatch(addDangerToast(t('An error occurred while updating tab query'))),
          );
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
      expand_data: true,
    };

    return SupersetClient.post({
      endpoint: '/superset/sql_json/',
      body: JSON.stringify(postPayload),
      headers: { 'Content-Type': 'application/json' },
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
      .then(({ json }) => dispatch(queryValidationReturned(query, json)))
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

export function migrateLocalStorage(queryEditor, tables, queries) {
  return function (dispatch) {
    return SupersetClient.post({ endpoint: '/tabstateview/', postPayload: { queryEditor } })
      .then(({ json }) => {
        const newQueryEditor = {
          ...queryEditor,
          id: json.id.toString(),
        };
        dispatch({ type: MIGRATE_QUERY_EDITOR, oldQueryEditor: queryEditor, newQueryEditor });
        dispatch({ type: MIGRATE_TAB_HISTORY, oldId: queryEditor.id, newId: newQueryEditor.id });
        return Promise.all(tables.map(table =>
          SupersetClient.post({
            endpoint: encodeURI('/tableschemaview/'),
            postPayload: { table: { ...table, queryEditorId: newQueryEditor.id } },
          })
            .then(({ json: resultJson }) => {
              const newTable = {
                ...table,
                id: resultJson.id,
              };
              return Promise.all([
                dispatch({ type: MIGRATE_TABLE, oldTable: table, newTable }),
                dispatch(runQuery(queries[table.dataPreviewQueryId])),
              ]);
            }),
        ));
      })
      .catch(() => dispatch(addDangerToast(t('Unable to add a new tab'))));
  };
}

export function addQueryEditor(queryEditor) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.post({ endpoint: '/tabstateview/', postPayload: { queryEditor } })
      : Promise.resolve({ json: { id: shortid.generate() } });

    return sync
      .then(({ json }) => {
        const newQueryEditor = {
          ...queryEditor,
          id: json.id.toString(),
        };
        return dispatch({ type: ADD_QUERY_EDITOR, queryEditor: newQueryEditor });
      })
      .catch(() => dispatch(addDangerToast(t('Unable to add a new tab'))));
  };
}

export function cloneQueryToNewTab(query) {
  return function (dispatch, getState) {
    const { queryEditors, tabHistory } = getState();
    const progenitor = queryEditors.find(qe => qe.id === tabHistory[tabHistory.length - 1]);
    const queryEditor = {
      title: t('Copy of %s', progenitor.title),
      dbId: query.dbId ? query.dbId : null,
      schema: query.schema ? query.schema : null,
      autorun: true,
      sql: query.sql,
      queryLimit: query.queryLimit,
      maxRow: query.maxRow,
    };
    return dispatch({ type: ADD_QUERY_EDITOR, queryEditor });
  };
}

export function setActiveQueryEditor(queryEditor) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.post({ endpoint: encodeURI(`/tabstateview/${queryEditor.id}/activate`) })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: SET_ACTIVE_QUERY_EDITOR, queryEditor }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting active tab'))),
      );
  };
}

export function loadQueryEditor(queryEditor) {
  return { type: LOAD_QUERY_EDITOR, queryEditor };
}

export function setTables(tableSchemas) {
  const tables = tableSchemas.map((tableSchema) => {
    const {
      columns,
      selectStar,
      primaryKey,
      foreignKeys,
      indexes,
      dataPreviewQueryId,
    } = tableSchema.results;
    return {
      dbId: tableSchema.database_id,
      queryEditorId: tableSchema.tab_state_id,
      schema: tableSchema.schema,
      name: tableSchema.table,
      expanded: tableSchema.expanded,
      id: tableSchema.id,
      dataPreviewQueryId,
      columns,
      selectStar,
      primaryKey,
      foreignKeys,
      indexes,
      isMetadataLoading: false,
      isExtraMetadataLoading: false,
    };
  });
  return { type: SET_TABLES, tables };
}

export function switchQueryEditor(queryEditor) {
  return function (dispatch) {
    if (isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE) && !queryEditor.loaded) {
      SupersetClient.get({
        endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
      })
        .then(({ json }) => {
          const loadedQueryEditor = {
            id: json.id.toString(),
            loaded: true,
            title: json.label,
            sql: json.query.sql,
            selectedText: null,
            latestQueryId: json.query.id,
            autorun: json.autorun,
            dbId: json.database_id,
            templateParams: json.template_params,
            schema: json.schema,
            queryLimit: json.queryLimit,
            validationResult: {
              id: null,
              errors: [],
              completed: false,
            },
          };
          dispatch(loadQueryEditor(loadedQueryEditor));
          dispatch(setTables(json.table_schemas || []));
          dispatch(setActiveQueryEditor(loadedQueryEditor));
          if (json.query.resultsKey) {
            dispatch(fetchQueryResults(json.query));
          }
        })
        .catch(() =>
          dispatch(addDangerToast(t('An error occurred while fetching tab state'))),
        );
    } else {
      dispatch(setActiveQueryEditor(queryEditor));
    }
  };
}

export function setActiveSouthPaneTab(tabId) {
  return { type: SET_ACTIVE_SOUTHPANE_TAB, tabId };
}

export function removeQueryEditor(queryEditor) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.delete({ endpoint: encodeURI(`/tabstateview/${queryEditor.id}`) })
      : Promise.resolve();

    return sync
      .then(() =>
        dispatch({ type: REMOVE_QUERY_EDITOR, queryEditor }),
      )
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while removing tab'))),
      );
  };
}

export function removeQuery(query) {
  return { type: REMOVE_QUERY, query };
}

export function queryEditorSetDb(queryEditor, dbId) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { database_id: dbId },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_EDITOR_SETDB, queryEditor, dbId }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting tab database ID'))),
      );
  };
}

export function queryEditorSetSchema(queryEditor, schema) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { schema },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_EDITOR_SET_SCHEMA, queryEditor, schema }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting tab schema'))),
      );
  };
}

export function queryEditorSetSchemaOptions(queryEditor, options) {
  return { type: QUERY_EDITOR_SET_SCHEMA_OPTIONS, queryEditor, options };
}

export function queryEditorSetTableOptions(queryEditor, options) {
  return { type: QUERY_EDITOR_SET_TABLE_OPTIONS, queryEditor, options };
}

export function queryEditorSetAutorun(queryEditor, autorun) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { autorun },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_EDITOR_SET_AUTORUN, queryEditor, autorun }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting tab autorun'))),
      );
  };
}

export function queryEditorSetTitle(queryEditor, title) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { label: title },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_EDITOR_SET_TITLE, queryEditor, title }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting tab title'))),
      );
  };
}

export function queryEditorSetSql(queryEditor, sql) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}/query`),
          postPayload: { sql },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_EDITOR_SET_SQL, queryEditor, sql }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting tab SQL'))),
      );
  };
}

export function queryEditorSetQueryLimit(queryEditor, queryLimit) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { query_limit: queryLimit },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_EDITOR_SET_QUERY_LIMIT, queryEditor, queryLimit }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting tab title'))),
      );
  };
}

export function queryEditorSetTemplateParams(queryEditor, templateParams) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { template_params: templateParams },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_EDITOR_SET_TEMPLATE_PARAMS, queryEditor, templateParams }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while setting tab template parameters'))),
      );
  };
}

export function queryEditorSetSelectedText(queryEditor, sql) {
  return { type: QUERY_EDITOR_SET_SELECTED_TEXT, queryEditor, sql };
}

export function mergeTable(table, query) {
  return { type: MERGE_TABLE, table, query };
}

function getTableMetadata(table, query, dispatch) {
  return SupersetClient.get({ endpoint: encodeURI(`/superset/table/${query.dbId}/` +
          `${encodeURIComponent(table.name)}/${encodeURIComponent(table.schema)}/`) })
    .then(({ json }) => {
      const dataPreviewQuery = {
        id: shortid.generate(),
        dbId: query.dbId,
        sql: json.selectStar,
        tableName: table.name,
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
        dataPreviewQueryId: dataPreviewQuery.id,
      };
      Promise.all([
        dispatch(mergeTable(newTable, dataPreviewQuery)), // Merge table to tables in state
        dispatch(runQuery(dataPreviewQuery)), // Run query to get preview data for table
      ]);
      return newTable;
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
}

function getTableExtendedMetadata(table, query, dispatch) {
  return SupersetClient.get({
    endpoint: encodeURI(`/superset/extra_table_metadata/${query.dbId}/` +
        `${encodeURIComponent(table.name)}/${encodeURIComponent(table.schema)}/`),
  })
    .then(({ json }) => {
      dispatch(mergeTable({ ...table, ...json, isExtraMetadataLoading: false }));
      return json;
    })
    .catch(() =>
      Promise.all([
        dispatch(mergeTable({ ...table, isExtraMetadataLoading: false })),
        dispatch(addDangerToast(t('An error occurred while fetching table metadata'))),
      ]),
    );
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

    return Promise.all([
      getTableMetadata(table, query, dispatch),
      getTableExtendedMetadata(table, query, dispatch),
    ])
      .then(([newTable, json]) => {
        const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
          ? SupersetClient.post({
              endpoint: encodeURI('/tableschemaview/'),
              postPayload: { table: { ...newTable, ...json } },
            })
          : Promise.resolve({ json: { id: shortid.generate() } });

        return sync
          .then(({ json: resultJson }) =>
            dispatch(mergeTable({ ...table, id: resultJson.id })),
          )
          .catch(() =>
            dispatch(addDangerToast(t('An error occurred while fetching table metadata'))),
          );
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
      queryLimit: query.queryLimit,
    };
    dispatch(runQuery(newQuery));
    dispatch(changeDataPreviewId(query.id, newQuery));
  };
}

export function expandTable(table) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.post({
          endpoint: encodeURI(`/tableschemaview/${table.id}/expanded`),
          postPayload: { expanded: true },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: EXPAND_TABLE, table }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while expanding the table schema'))),
      );
  };
}

export function collapseTable(table) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.post({
          endpoint: encodeURI(`/tableschemaview/${table.id}/expanded`),
          postPayload: { expanded: false },
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: COLLAPSE_TABLE, table }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while collapsing the table schema'))),
      );
  };
}

export function removeTable(table) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.delete({ endpoint: encodeURI(`/tableschemaview/${table.id}`) })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: REMOVE_TABLE, table }))
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while removing the table schema'))),
      );
  };
}

export function refreshQueries(alteredQueries) {
  return { type: REFRESH_QUERIES, alteredQueries };
}

export function setUserOffline(offline) {
  return { type: SET_USER_OFFLINE, offline };
}

export function persistEditorHeight(queryEditor, northPercent, southPercent) {
  return { type: QUERY_EDITOR_PERSIST_HEIGHT, queryEditor, northPercent, southPercent };
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
        const queryEditorProps = {
          ...convertQueryToClient(json.result),
          autorun: false,
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
      .then(({ json }) => {
        dispatch(createDatasourceSuccess(json));

        return Promise.resolve(json);
      })
      .catch(() => {
        dispatch(createDatasourceFailed(t('An error occurred while creating the data source')));

        return Promise.reject();
      });
  };
}
