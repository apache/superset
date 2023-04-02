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
import rison from 'rison';
import { FeatureFlag, SupersetClient, t } from '@superset-ui/core';
import invert from 'lodash/invert';
import mapKeys from 'lodash/mapKeys';
import { isFeatureEnabled } from 'src/featureFlags';

import { now } from 'src/utils/dates';
import {
  addDangerToast as addDangerToastAction,
  addInfoToast as addInfoToastAction,
  addSuccessToast as addSuccessToastAction,
  addWarningToast as addWarningToastAction,
} from 'src/components/MessageToasts/actions';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import COMMON_ERR_MESSAGES from 'src/utils/errorMessages';
import { LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY } from 'src/logger/LogUtils';
import { logEvent } from 'src/logger/actions';
import { newQueryTabName } from '../utils/newQueryTabName';

export const RESET_STATE = 'RESET_STATE';
export const ADD_QUERY_EDITOR = 'ADD_QUERY_EDITOR';
export const UPDATE_QUERY_EDITOR = 'UPDATE_QUERY_EDITOR';
export const QUERY_EDITOR_SAVED = 'QUERY_EDITOR_SAVED';
export const CLONE_QUERY_TO_NEW_TAB = 'CLONE_QUERY_TO_NEW_TAB';
export const REMOVE_QUERY_EDITOR = 'REMOVE_QUERY_EDITOR';
export const MERGE_TABLE = 'MERGE_TABLE';
export const REMOVE_TABLES = 'REMOVE_TABLES';
export const END_QUERY = 'END_QUERY';
export const REMOVE_QUERY = 'REMOVE_QUERY';
export const EXPAND_TABLE = 'EXPAND_TABLE';
export const COLLAPSE_TABLE = 'COLLAPSE_TABLE';
export const QUERY_EDITOR_SETDB = 'QUERY_EDITOR_SETDB';
export const QUERY_EDITOR_SET_SCHEMA = 'QUERY_EDITOR_SET_SCHEMA';
export const QUERY_EDITOR_SET_TABLE_OPTIONS = 'QUERY_EDITOR_SET_TABLE_OPTIONS';
export const QUERY_EDITOR_SET_TITLE = 'QUERY_EDITOR_SET_TITLE';
export const QUERY_EDITOR_SET_AUTORUN = 'QUERY_EDITOR_SET_AUTORUN';
export const QUERY_EDITOR_SET_SQL = 'QUERY_EDITOR_SET_SQL';
export const QUERY_EDITOR_SET_QUERY_LIMIT = 'QUERY_EDITOR_SET_QUERY_LIMIT';
export const QUERY_EDITOR_SET_TEMPLATE_PARAMS =
  'QUERY_EDITOR_SET_TEMPLATE_PARAMS';
export const QUERY_EDITOR_SET_SELECTED_TEXT = 'QUERY_EDITOR_SET_SELECTED_TEXT';
export const QUERY_EDITOR_SET_FUNCTION_NAMES =
  'QUERY_EDITOR_SET_FUNCTION_NAMES';
export const QUERY_EDITOR_PERSIST_HEIGHT = 'QUERY_EDITOR_PERSIST_HEIGHT';
export const QUERY_EDITOR_TOGGLE_LEFT_BAR = 'QUERY_EDITOR_TOGGLE_LEFT_BAR';
export const MIGRATE_QUERY_EDITOR = 'MIGRATE_QUERY_EDITOR';
export const MIGRATE_TAB_HISTORY = 'MIGRATE_TAB_HISTORY';
export const MIGRATE_TABLE = 'MIGRATE_TABLE';
export const MIGRATE_QUERY = 'MIGRATE_QUERY';

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
export const addWarningToast = addWarningToastAction;

export const CtasEnum = {
  TABLE: 'TABLE',
  VIEW: 'VIEW',
};
const ERR_MSG_CANT_LOAD_QUERY = t("The query couldn't be loaded");

// a map of SavedQuery field names to the different names used client-side,
// because for now making the names consistent is too complicated
// so it might as well only happen in one place
const queryClientMapping = {
  id: 'remoteId',
  db_id: 'dbId',
  label: 'name',
  template_parameters: 'templateParams',
};
const queryServerMapping = invert(queryClientMapping);

// uses a mapping like those above to convert object key names to another style
const fieldConverter = mapping => obj =>
  mapKeys(obj, (value, key) => (key in mapping ? mapping[key] : key));

export const convertQueryToServer = fieldConverter(queryServerMapping);
export const convertQueryToClient = fieldConverter(queryClientMapping);

export function getUpToDateQuery(rootState, queryEditor, key) {
  const {
    sqlLab: { unsavedQueryEditor },
  } = rootState;
  const id = key ?? queryEditor.id;
  return {
    ...queryEditor,
    ...(id === unsavedQueryEditor.id && unsavedQueryEditor),
  };
}

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

export function updateQueryEditor(alterations) {
  return { type: UPDATE_QUERY_EDITOR, alterations };
}

export function scheduleQuery(query) {
  return dispatch =>
    SupersetClient.post({
      endpoint: '/savedqueryviewapi/api/create',
      postPayload: query,
      stringify: false,
    })
      .then(() =>
        dispatch(
          addSuccessToast(
            t(
              'Your query has been scheduled. To see details of your query, navigate to Saved queries',
            ),
          ),
        ),
      )
      .catch(() =>
        dispatch(addDangerToast(t('Your query could not be scheduled'))),
      );
}

export function estimateQueryCost(queryEditor) {
  return (dispatch, getState) => {
    const { dbId, schema, sql, selectedText, templateParams } =
      getUpToDateQuery(getState(), queryEditor);
    const requestSql = selectedText || sql;

    const postPayload = {
      database_id: dbId,
      schema,
      sql: requestSql,
      template_params: JSON.parse(templateParams || '{}'),
    };

    return Promise.all([
      dispatch({ type: COST_ESTIMATE_STARTED, query: queryEditor }),
      SupersetClient.post({
        endpoint: '/api/v1/sqllab/estimate/',
        body: JSON.stringify(postPayload),
        headers: { 'Content-Type': 'application/json' },
      })
        .then(({ json }) =>
          dispatch({ type: COST_ESTIMATE_RETURNED, query: queryEditor, json }),
        )
        .catch(response =>
          getClientErrorObject(response).then(error => {
            const message =
              error.error ||
              error.statusText ||
              t('Failed at retrieving results');
            return dispatch({
              type: COST_ESTIMATE_FAILED,
              query: queryEditor,
              error: message,
            });
          }),
        ),
    ]);
  };
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
    const sqlEditorId = results?.query?.sqlEditorId;
    const sync =
      sqlEditorId &&
      !query.isDataPreview &&
      isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
        ? SupersetClient.put({
            endpoint: encodeURI(`/tabstateview/${sqlEditorId}`),
            postPayload: { latest_query_id: query.id },
          })
        : Promise.resolve();

    return sync
      .then(() => dispatch({ type: QUERY_SUCCESS, query, results }))
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while storing the latest query id in the backend. ' +
                'Please contact your administrator if this problem persists.',
            ),
          ),
        ),
      );
  };
}

export function queryFailed(query, msg, link, errors) {
  return function (dispatch) {
    const sync =
      !query.isDataPreview &&
      isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
        ? SupersetClient.put({
            endpoint: encodeURI(`/tabstateview/${query.sqlEditorId}`),
            postPayload: { latest_query_id: query.id },
          })
        : Promise.resolve();

    const eventData = {
      has_err: true,
      start_offset: query.startDttm,
      ts: new Date().getTime(),
    };
    errors?.forEach(({ error_type: errorType, extra }) => {
      const messages = extra?.issue_codes?.map(({ message }) => message) || [
        errorType,
      ];
      messages.forEach(message => {
        dispatch(
          logEvent(LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY, {
            ...eventData,
            error_type: errorType,
            error_details: message,
          }),
        );
      });
    });

    return (
      sync
        .catch(() =>
          dispatch(
            addDangerToast(
              t(
                'An error occurred while storing the latest query id in the backend. ' +
                  'Please contact your administrator if this problem persists.',
              ),
            ),
          ),
        )
        // We should always show the error message, even if we couldn't sync the
        // state to the backend
        .then(() => dispatch({ type: QUERY_FAILED, query, msg, link, errors }))
    );
  };
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

    const queryParams = rison.encode({
      key: query.resultsKey,
      rows: displayLimit || null,
    });

    return SupersetClient.get({
      endpoint: `/api/v1/sqllab/results/?q=${queryParams}`,
      parseMethod: 'json-bigint',
    })
      .then(({ json }) => dispatch(querySuccess(query, json)))
      .catch(response =>
        getClientErrorObject(response).then(error => {
          const message =
            error.error ||
            error.statusText ||
            t('Failed at retrieving results');

          return dispatch(
            queryFailed(query, message, error.link, error.errors),
          );
        }),
      );
  };
}

export function cleanSqlComments(sql) {
  if (!sql) return '';
  // it sanitizes the following comment block groups
  // group 1 -> /* */
  // group 2 -> --
  return sql.replace(/(--.*?$|\/\*[\s\S]*?\*\/)\n?/gm, '\n').trim();
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
      sql: cleanSqlComments(query.sql),
      sql_editor_id: query.sqlEditorId,
      tab: query.tab,
      tmp_table_name: query.tempTable,
      select_as_cta: query.ctas,
      ctas_method: query.ctas_method,
      templateParams: query.templateParams,
      queryLimit: query.queryLimit,
      expand_data: true,
    };

    const search = window.location.search || '';
    return SupersetClient.post({
      endpoint: `/api/v1/sqllab/execute/${search}`,
      body: JSON.stringify(postPayload),
      headers: { 'Content-Type': 'application/json' },
      parseMethod: 'json-bigint',
    })
      .then(({ json }) => {
        if (!query.runAsync) {
          dispatch(querySuccess(query, json));
        }
      })
      .catch(response =>
        getClientErrorObject(response).then(error => {
          let message =
            error.error ||
            error.message ||
            error.statusText ||
            t('Unknown error');
          if (message.includes('CSRF token')) {
            message = t(COMMON_ERR_MESSAGES.SESSION_TIMED_OUT);
          }
          dispatch(queryFailed(query, message, error.link, error.errors));
        }),
      );
  };
}

export function runQueryFromSqlEditor(
  database,
  queryEditor,
  defaultQueryLimit,
  tempTable,
  ctas,
  ctasMethod,
) {
  return function (dispatch, getState) {
    const qe = getUpToDateQuery(getState(), queryEditor, queryEditor.id);
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText || qe.sql,
      sqlEditorId: qe.id,
      tab: qe.name,
      schema: qe.schema,
      tempTable,
      templateParams: qe.templateParams,
      queryLimit: qe.queryLimit || defaultQueryLimit,
      runAsync: database ? database.allow_run_async : false,
      ctas,
      ctas_method: ctasMethod,
      updateTabState: !qe.selectedText,
    };
    dispatch(runQuery(query));
  };
}

export function reRunQuery(query) {
  // run Query with a new id
  return function (dispatch) {
    dispatch(runQuery({ ...query, id: shortid.generate() }));
  };
}

export function validateQuery(queryEditor, sql) {
  return function (dispatch, getState) {
    const {
      sqlLab: { unsavedQueryEditor },
    } = getState();
    const qe = {
      ...queryEditor,
      ...(queryEditor.id === unsavedQueryEditor.id && unsavedQueryEditor),
    };

    const query = {
      dbId: qe.dbId,
      sql,
      sqlEditorId: qe.id,
      schema: qe.schema,
      templateParams: qe.templateParams,
    };
    dispatch(startQueryValidation(query));

    const postPayload = {
      schema: query.schema,
      sql: query.sql,
      template_params: query.templateParams,
    };

    return SupersetClient.post({
      endpoint: `/api/v1/database/${query.dbId}/validate_sql/`,
      body: JSON.stringify(postPayload),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(({ json }) => dispatch(queryValidationReturned(query, json.result)))
      .catch(response =>
        getClientErrorObject(response.result).then(error => {
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
      endpoint: '/api/v1/query/stop',
      body: JSON.stringify({ client_id: query.id }),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => dispatch(stopQuery(query)))
      .then(() => dispatch(addSuccessToast(t('Query was stopped.'))))
      .catch(() =>
        dispatch(addDangerToast(t('Failed at stopping query. %s', query.id))),
      );
  };
}

export function setDatabases(databases) {
  return { type: SET_DATABASES, databases };
}

function migrateTable(table, queryEditorId, dispatch) {
  return SupersetClient.post({
    endpoint: encodeURI('/tableschemaview/'),
    postPayload: { table: { ...table, queryEditorId } },
  })
    .then(({ json }) => {
      const newTable = {
        ...table,
        id: json.id,
        queryEditorId,
      };
      return dispatch({ type: MIGRATE_TABLE, oldTable: table, newTable });
    })
    .catch(() =>
      dispatch(
        addWarningToast(
          t(
            'Unable to migrate table schema state to backend. Superset will retry ' +
              'later. Please contact your administrator if this problem persists.',
          ),
        ),
      ),
    );
}

function migrateQuery(queryId, queryEditorId, dispatch) {
  return SupersetClient.post({
    endpoint: encodeURI(`/tabstateview/${queryEditorId}/migrate_query`),
    postPayload: { queryId },
  })
    .then(() => dispatch({ type: MIGRATE_QUERY, queryId, queryEditorId }))
    .catch(() =>
      dispatch(
        addWarningToast(
          t(
            'Unable to migrate query state to backend. Superset will retry later. ' +
              'Please contact your administrator if this problem persists.',
          ),
        ),
      ),
    );
}

export function migrateQueryEditorFromLocalStorage(
  queryEditor,
  tables,
  queries,
) {
  return function (dispatch) {
    return SupersetClient.post({
      endpoint: '/tabstateview/',
      postPayload: { queryEditor },
    })
      .then(({ json }) => {
        const newQueryEditor = {
          ...queryEditor,
          id: json.id.toString(),
        };
        dispatch({
          type: MIGRATE_QUERY_EDITOR,
          oldQueryEditor: queryEditor,
          newQueryEditor,
        });
        dispatch({
          type: MIGRATE_TAB_HISTORY,
          oldId: queryEditor.id,
          newId: newQueryEditor.id,
        });
        return Promise.all([
          ...tables.map(table =>
            migrateTable(table, newQueryEditor.id, dispatch),
          ),
          ...queries.map(query =>
            migrateQuery(query.id, newQueryEditor.id, dispatch),
          ),
        ]);
      })
      .catch(() =>
        dispatch(
          addWarningToast(
            t(
              'Unable to migrate query editor state to backend. Superset will retry ' +
                'later. Please contact your administrator if this problem persists.',
            ),
          ),
        ),
      );
  };
}

export function addQueryEditor(queryEditor) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.post({
          endpoint: '/tabstateview/',
          postPayload: { queryEditor },
        })
      : Promise.resolve({ json: { id: shortid.generate() } });

    return sync
      .then(({ json }) => {
        const newQueryEditor = {
          ...queryEditor,
          id: json.id.toString(),
        };
        return dispatch({
          type: ADD_QUERY_EDITOR,
          queryEditor: newQueryEditor,
        });
      })
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'Unable to add a new tab to the backend. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function addNewQueryEditor() {
  return function (dispatch, getState) {
    const {
      sqlLab: {
        queryEditors,
        tabHistory,
        unsavedQueryEditor,
        defaultDbId,
        databases,
      },
      common,
    } = getState();
    const activeQueryEditor = queryEditors.find(
      qe => qe.id === tabHistory[tabHistory.length - 1],
    );
    const dbIds = Object.values(databases).map(database => database.id);
    const firstDbId = dbIds.length > 0 ? Math.min(...dbIds) : undefined;
    const { dbId, schema, queryLimit, autorun } = {
      ...queryEditors[0],
      ...activeQueryEditor,
      ...(unsavedQueryEditor.id === activeQueryEditor?.id &&
        unsavedQueryEditor),
    };
    const warning = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? ''
      : t(
          '-- Note: Unless you save your query, these tabs will NOT persist if you clear your cookies or change browsers.\n\n',
        );

    const name = newQueryTabName(queryEditors || []);

    return dispatch(
      addQueryEditor({
        dbId: dbId || defaultDbId || firstDbId,
        schema: schema ?? null,
        autorun: autorun ?? false,
        sql: `${warning}SELECT ...`,
        queryLimit: queryLimit || common.conf.DEFAULT_SQLLAB_LIMIT,
        name,
      }),
    );
  };
}

export function cloneQueryToNewTab(query, autorun) {
  return function (dispatch, getState) {
    const state = getState();
    const { queryEditors, tabHistory } = state.sqlLab;
    const sourceQueryEditor = queryEditors.find(
      qe => qe.id === tabHistory[tabHistory.length - 1],
    );
    const queryEditor = {
      name: t('Copy of %s', sourceQueryEditor.name),
      dbId: query.dbId ? query.dbId : null,
      schema: query.schema ? query.schema : null,
      autorun,
      sql: query.sql,
      queryLimit: sourceQueryEditor.queryLimit,
      maxRow: sourceQueryEditor.maxRow,
      templateParams: sourceQueryEditor.templateParams,
    };
    return dispatch(addQueryEditor(queryEditor));
  };
}

export function setActiveQueryEditor(queryEditor) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.post({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}/activate`),
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: SET_ACTIVE_QUERY_EDITOR, queryEditor }))
      .catch(response => {
        if (response.status !== 404) {
          return dispatch(
            addDangerToast(
              t(
                'An error occurred while setting the active tab. Please contact ' +
                  'your administrator.',
              ),
            ),
          );
        }
        return dispatch({ type: REMOVE_QUERY_EDITOR, queryEditor });
      });
  };
}

export function loadQueryEditor(queryEditor) {
  return { type: LOAD_QUERY_EDITOR, queryEditor };
}

export function setTables(tableSchemas) {
  const tables = tableSchemas
    .filter(tableSchema => tableSchema.description !== null)
    .map(tableSchema => {
      const {
        columns,
        selectStar,
        primaryKey,
        foreignKeys,
        indexes,
        dataPreviewQueryId,
      } = tableSchema.description;
      return {
        dbId: tableSchema.database_id,
        queryEditorId: tableSchema.tab_state_id.toString(),
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

export function switchQueryEditor(queryEditor, displayLimit) {
  return function (dispatch) {
    if (
      isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE) &&
      queryEditor &&
      !queryEditor.loaded
    ) {
      SupersetClient.get({
        endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
      })
        .then(({ json }) => {
          const loadedQueryEditor = {
            id: json.id.toString(),
            loaded: true,
            name: json.label,
            sql: json.sql,
            selectedText: null,
            latestQueryId: json.latest_query?.id,
            autorun: json.autorun,
            dbId: json.database_id,
            templateParams: json.template_params,
            schema: json.schema,
            queryLimit: json.query_limit,
            remoteId: json.saved_query?.id,
            validationResult: {
              id: null,
              errors: [],
              completed: false,
            },
            hideLeftBar: json.hide_left_bar,
          };
          dispatch(loadQueryEditor(loadedQueryEditor));
          dispatch(setTables(json.table_schemas || []));
          dispatch(setActiveQueryEditor(loadedQueryEditor));
          if (json.latest_query && json.latest_query.resultsKey) {
            dispatch(fetchQueryResults(json.latest_query, displayLimit));
          }
        })
        .catch(response => {
          if (response.status !== 404) {
            return dispatch(
              addDangerToast(t('An error occurred while fetching tab state')),
            );
          }
          return dispatch({ type: REMOVE_QUERY_EDITOR, queryEditor });
        });
    } else {
      dispatch(setActiveQueryEditor(queryEditor));
    }
  };
}

export function setActiveSouthPaneTab(tabId) {
  return { type: SET_ACTIVE_SOUTHPANE_TAB, tabId };
}

export function toggleLeftBar(queryEditor) {
  const hideLeftBar = !queryEditor.hideLeftBar;
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { hide_left_bar: hideLeftBar },
        })
      : Promise.resolve();

    return sync
      .then(() =>
        dispatch({
          type: QUERY_EDITOR_TOGGLE_LEFT_BAR,
          queryEditor,
          hideLeftBar,
        }),
      )
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while hiding the left bar. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function removeQueryEditor(queryEditor) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.delete({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: REMOVE_QUERY_EDITOR, queryEditor }))
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while removing tab. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function removeAllOtherQueryEditors(queryEditor) {
  return function (dispatch, getState) {
    const { sqlLab } = getState();
    sqlLab.queryEditors?.forEach(otherQueryEditor => {
      if (otherQueryEditor.id !== queryEditor.id) {
        dispatch(removeQueryEditor(otherQueryEditor));
      }
    });
  };
}

export function removeQuery(query) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.delete({
          endpoint: encodeURI(
            `/tabstateview/${query.sqlEditorId}/query/${query.id}`,
          ),
        })
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: REMOVE_QUERY, query }))
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while removing query. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
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
        dispatch(
          addDangerToast(
            t(
              'An error occurred while setting the tab database ID. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function queryEditorSetSchema(queryEditor, schema) {
  return function (dispatch) {
    const sync =
      isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE) &&
      typeof queryEditor === 'object'
        ? SupersetClient.put({
            endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
            postPayload: { schema },
          })
        : Promise.resolve();

    return sync
      .then(() =>
        dispatch({
          type: QUERY_EDITOR_SET_SCHEMA,
          queryEditor: queryEditor || {},
          schema,
        }),
      )
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while setting the tab schema. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
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
      .then(() =>
        dispatch({ type: QUERY_EDITOR_SET_AUTORUN, queryEditor, autorun }),
      )
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while setting the tab autorun. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function queryEditorSetTitle(queryEditor, name, id) {
  return function (dispatch) {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${id}`),
          postPayload: { label: name },
        })
      : Promise.resolve();

    return sync
      .then(() =>
        dispatch({
          type: QUERY_EDITOR_SET_TITLE,
          queryEditor: { ...queryEditor, id },
          name,
        }),
      )
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while setting the tab name. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function saveQuery(query, clientId) {
  const { id, ...payload } = convertQueryToServer(query);

  return dispatch =>
    SupersetClient.post({
      endpoint: '/api/v1/saved_query/',
      jsonPayload: convertQueryToServer(payload),
    })
      .then(result => {
        const savedQuery = convertQueryToClient({
          id: result.json.id,
          ...result.json.result,
        });
        dispatch({
          type: QUERY_EDITOR_SAVED,
          query,
          clientId,
          result: savedQuery,
        });
        dispatch(queryEditorSetTitle(query, query.name, clientId));
        return savedQuery;
      })
      .catch(() =>
        dispatch(addDangerToast(t('Your query could not be saved'))),
      );
}

export const addSavedQueryToTabState =
  (queryEditor, savedQuery) => dispatch => {
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: `/tabstateview/${queryEditor.id}`,
          postPayload: { saved_query_id: savedQuery.remoteId },
        })
      : Promise.resolve();

    return sync
      .catch(() => {
        dispatch(addDangerToast(t('Your query was not properly saved')));
      })
      .then(() => {
        dispatch(addSuccessToast(t('Your query was saved')));
      });
  };

export function updateSavedQuery(query, clientId) {
  const { id, ...payload } = convertQueryToServer(query);

  return dispatch =>
    SupersetClient.put({
      endpoint: `/api/v1/saved_query/${query.remoteId}`,
      jsonPayload: convertQueryToServer(payload),
    })
      .then(() => {
        dispatch(addSuccessToast(t('Your query was updated')));
        dispatch(queryEditorSetTitle(query, query.name, clientId));
      })
      .catch(e => {
        const message = t('Your query could not be updated');
        // eslint-disable-next-line no-console
        console.error(message, e);
        dispatch(addDangerToast(message));
      })
      .then(() => dispatch(updateQueryEditor(query)));
}

export function queryEditorSetSql(queryEditor, sql) {
  return { type: QUERY_EDITOR_SET_SQL, queryEditor, sql };
}

export function queryEditorSetAndSaveSql(targetQueryEditor, sql) {
  return function (dispatch, getState) {
    const queryEditor = getUpToDateQuery(getState(), targetQueryEditor);
    // saved query and set tab state use this action
    dispatch(queryEditorSetSql(queryEditor, sql));
    if (isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)) {
      return SupersetClient.put({
        endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
        postPayload: { sql, latest_query_id: queryEditor.latestQueryId },
      }).catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while storing your query in the backend. To ' +
                'avoid losing your changes, please save your query using the ' +
                '"Save Query" button.',
            ),
          ),
        ),
      );
    }
    return Promise.resolve();
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
      .then(() =>
        dispatch({
          type: QUERY_EDITOR_SET_QUERY_LIMIT,
          queryEditor,
          queryLimit,
        }),
      )
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while setting the tab name. Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function queryEditorSetTemplateParams(queryEditor, templateParams) {
  return function (dispatch) {
    dispatch({
      type: QUERY_EDITOR_SET_TEMPLATE_PARAMS,
      queryEditor,
      templateParams,
    });
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? SupersetClient.put({
          endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
          postPayload: { template_params: templateParams },
        })
      : Promise.resolve();

    return sync.catch(() =>
      dispatch(
        addDangerToast(
          t(
            'An error occurred while setting the tab template parameters. ' +
              'Please contact your administrator.',
          ),
        ),
      ),
    );
  };
}

export function queryEditorSetSelectedText(queryEditor, sql) {
  return { type: QUERY_EDITOR_SET_SELECTED_TEXT, queryEditor, sql };
}

export function mergeTable(table, query, prepend) {
  return { type: MERGE_TABLE, table, query, prepend };
}

function getTableMetadata(table, query, dispatch) {
  return SupersetClient.get({
    endpoint: encodeURI(
      `/api/v1/database/${query.dbId}/table/${encodeURIComponent(
        table.name,
      )}/${encodeURIComponent(table.schema)}/`,
    ),
  })
    .then(({ json }) => {
      const newTable = {
        ...table,
        ...json,
        expanded: true,
        isMetadataLoading: false,
      };
      dispatch(mergeTable(newTable)); // Merge table to tables in state
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
        dispatch(
          addDangerToast(t('An error occurred while fetching table metadata')),
        ),
      ]),
    );
}

function getTableExtendedMetadata(table, query, dispatch) {
  return SupersetClient.get({
    endpoint: encodeURI(
      `/api/v1/database/${query.dbId}/table_extra/` +
        `${encodeURIComponent(table.name)}/${encodeURIComponent(
          table.schema,
        )}/`,
    ),
  })
    .then(({ json }) => {
      dispatch(
        mergeTable({ ...table, ...json, isExtraMetadataLoading: false }),
      );
      return json;
    })
    .catch(() =>
      Promise.all([
        dispatch(mergeTable({ ...table, isExtraMetadataLoading: false })),
        dispatch(
          addDangerToast(t('An error occurred while fetching table metadata')),
        ),
      ]),
    );
}

export function addTable(queryEditor, database, tableName, schemaName) {
  return function (dispatch, getState) {
    const query = getUpToDateQuery(getState(), queryEditor, queryEditor.id);
    const table = {
      dbId: query.dbId,
      queryEditorId: query.id,
      schema: schemaName,
      name: tableName,
    };
    dispatch(
      mergeTable(
        {
          ...table,
          isMetadataLoading: true,
          isExtraMetadataLoading: true,
          expanded: true,
        },
        null,
        true,
      ),
    );

    return Promise.all([
      getTableMetadata(table, query, dispatch),
      getTableExtendedMetadata(table, query, dispatch),
    ]).then(([newTable, json]) => {
      const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
        ? SupersetClient.post({
            endpoint: encodeURI('/tableschemaview/'),
            postPayload: { table: { ...newTable, ...json } },
          })
        : Promise.resolve({ json: { id: shortid.generate() } });

      if (!database.disable_data_preview && database.id === query.dbId) {
        const dataPreviewQuery = {
          id: shortid.generate(),
          dbId: query.dbId,
          sql: newTable.selectStar,
          tableName: table.name,
          sqlEditorId: null,
          tab: '',
          runAsync: database.allow_run_async,
          ctas: false,
          isDataPreview: true,
        };
        Promise.all([
          dispatch(
            mergeTable(
              {
                ...newTable,
                dataPreviewQueryId: dataPreviewQuery.id,
              },
              dataPreviewQuery,
            ),
          ),
          dispatch(runQuery(dataPreviewQuery)),
        ]);
      }

      return sync
        .then(({ json: resultJson }) =>
          dispatch(mergeTable({ ...table, id: resultJson.id })),
        )
        .catch(() =>
          dispatch(
            addDangerToast(
              t(
                'An error occurred while fetching table metadata. ' +
                  'Please contact your administrator.',
              ),
            ),
          ),
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
      isDataPreview: query.isDataPreview,
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
        dispatch(
          addDangerToast(
            t(
              'An error occurred while expanding the table schema. ' +
                'Please contact your administrator.',
            ),
          ),
        ),
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
        dispatch(
          addDangerToast(
            t(
              'An error occurred while collapsing the table schema. ' +
                'Please contact your administrator.',
            ),
          ),
        ),
      );
  };
}

export function removeTables(tables) {
  return function (dispatch) {
    const tablesToRemove = tables?.filter(Boolean) ?? [];
    const sync = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? Promise.all(
          tablesToRemove.map(table =>
            SupersetClient.delete({
              endpoint: encodeURI(`/tableschemaview/${table.id}`),
            }),
          ),
        )
      : Promise.resolve();

    return sync
      .then(() => dispatch({ type: REMOVE_TABLES, tables: tablesToRemove }))
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'An error occurred while removing the table schema. ' +
                'Please contact your administrator.',
            ),
          ),
        ),
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
  return {
    type: QUERY_EDITOR_PERSIST_HEIGHT,
    queryEditor,
    northPercent,
    southPercent,
  };
}

export function popStoredQuery(urlId) {
  return function (dispatch) {
    return SupersetClient.get({ endpoint: `/kv/${urlId}` })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            name: json.name ? json.name : t('Shared query'),
            dbId: json.dbId ? parseInt(json.dbId, 10) : null,
            schema: json.schema ? json.schema : null,
            autorun: json.autorun ? json.autorun : false,
            sql: json.sql ? json.sql : 'SELECT ...',
            templateParams: json.templateParams,
          }),
        ),
      )
      .catch(() => dispatch(addDangerToast(ERR_MSG_CANT_LOAD_QUERY)));
  };
}
export function popSavedQuery(saveQueryId) {
  return function (dispatch) {
    return SupersetClient.get({
      endpoint: `/api/v1/saved_query/${saveQueryId}`,
    })
      .then(({ json }) => {
        const queryEditorProps = {
          ...convertQueryToClient(json.result),
          dbId: json.result?.database?.id,
          loaded: true,
          autorun: false,
        };
        return dispatch(addQueryEditor(queryEditorProps));
      })
      .catch(() => dispatch(addDangerToast(ERR_MSG_CANT_LOAD_QUERY)));
  };
}
export function popQuery(queryId) {
  return function (dispatch) {
    return SupersetClient.get({
      endpoint: `/api/v1/query/${queryId}`,
    })
      .then(({ json }) => {
        const queryData = json.result;
        const queryEditorProps = {
          dbId: queryData.database.id,
          schema: queryData.schema,
          sql: queryData.sql,
          name: t('Copy of %s', queryData.tab_name),
          autorun: false,
        };
        return dispatch(addQueryEditor(queryEditorProps));
      })
      .catch(() => dispatch(addDangerToast(ERR_MSG_CANT_LOAD_QUERY)));
  };
}
export function popDatasourceQuery(datasourceKey, sql) {
  return function (dispatch) {
    const QUERY_TEXT = t('Query');
    const datasetId = datasourceKey.split('__')[0];
    return SupersetClient.get({
      endpoint: `/api/v1/dataset/${datasetId}?q=(keys:!(none))`,
    })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            name: `${QUERY_TEXT} ${json.result.name}`,
            dbId: json.result.database.id,
            schema: json.result.schema,
            autorun: sql !== undefined,
            sql: sql || json.result.select_star,
          }),
        ),
      )
      .catch(() =>
        dispatch(addDangerToast(t("The datasource couldn't be loaded"))),
      );
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
  return dispatch => {
    dispatch(createDatasourceStarted());
    return SupersetClient.post({
      endpoint: '/superset/sqllab_viz/',
      postPayload: { data: vizOptions },
    })
      .then(({ json }) => {
        dispatch(createDatasourceSuccess(json));

        return Promise.resolve(json);
      })
      .catch(error => {
        getClientErrorObject(error).then(e => {
          dispatch(addDangerToast(e.error));
        });
        dispatch(
          createDatasourceFailed(
            t('An error occurred while creating the data source'),
          ),
        );

        return Promise.reject();
      });
  };
}

export function createCtasDatasource(vizOptions) {
  return dispatch => {
    dispatch(createDatasourceStarted());
    return SupersetClient.post({
      endpoint: '/api/v1/dataset/get_or_create/',
      jsonPayload: vizOptions,
    })
      .then(({ json }) => {
        dispatch(createDatasourceSuccess(json.result));

        return json.result;
      })
      .catch(() => {
        const errorMsg = t('An error occurred while creating the data source');
        dispatch(createDatasourceFailed(errorMsg));
        return Promise.reject(new Error(errorMsg));
      });
  };
}

export function queryEditorSetFunctionNames(queryEditor, dbId) {
  return function (dispatch) {
    return SupersetClient.get({
      endpoint: encodeURI(`/api/v1/database/${dbId}/function_names/`),
    })
      .then(({ json }) =>
        dispatch({
          type: QUERY_EDITOR_SET_FUNCTION_NAMES,
          queryEditor,
          functionNames: json.function_names,
        }),
      )
      .catch(err => {
        if (err.status === 404) {
          // for databases that have been deleted, just reset the function names
          dispatch({
            type: QUERY_EDITOR_SET_FUNCTION_NAMES,
            queryEditor,
            functionNames: [],
          });
        } else {
          dispatch(
            addDangerToast(
              t('An error occurred while fetching function names.'),
            ),
          );
        }
      });
  };
}
