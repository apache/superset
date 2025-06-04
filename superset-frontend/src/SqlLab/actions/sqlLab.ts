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
import { nanoid } from 'nanoid';
import rison from 'rison';
import {
  FeatureFlag,
  SupersetClient,
  t,
  isFeatureEnabled,
  COMMON_ERR_MESSAGES,
  getClientErrorObject,
} from '@superset-ui/core';
import { invert, mapKeys } from 'lodash';

import { now } from '@superset-ui/core/utils/dates';
import {
  addDangerToast as addDangerToastAction,
  addInfoToast as addInfoToastAction,
  addSuccessToast as addSuccessToastAction,
  addWarningToast as addWarningToastAction,
} from 'src/components/MessageToasts/actions';
import { LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY } from 'src/logger/LogUtils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { logEvent } from 'src/logger/actions';
import { newQueryTabName } from '../utils/newQueryTabName';
import getInitialState from '../reducers/getInitialState';
import { rehydratePersistedState } from '../utils/reduxStateToLocalStorageHelper';

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
export const QUERY_EDITOR_SET_CATALOG = 'QUERY_EDITOR_SET_CATALOG';
export const QUERY_EDITOR_SET_SCHEMA = 'QUERY_EDITOR_SET_SCHEMA';
export const QUERY_EDITOR_SET_TITLE = 'QUERY_EDITOR_SET_TITLE';
export const QUERY_EDITOR_SET_AUTORUN = 'QUERY_EDITOR_SET_AUTORUN';
export const QUERY_EDITOR_SET_SQL = 'QUERY_EDITOR_SET_SQL';
export const QUERY_EDITOR_SET_CURSOR_POSITION =
  'QUERY_EDITOR_SET_CURSOR_POSITION';
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
export const CLEAR_INACTIVE_QUERIES = 'CLEAR_INACTIVE_QUERIES';
export const CLEAR_QUERY_RESULTS = 'CLEAR_QUERY_RESULTS';
export const REMOVE_DATA_PREVIEW = 'REMOVE_DATA_PREVIEW';
export const CHANGE_DATA_PREVIEW_ID = 'CHANGE_DATA_PREVIEW_ID';

export const COST_ESTIMATE_STARTED = 'COST_ESTIMATE_STARTED';
export const COST_ESTIMATE_RETURNED = 'COST_ESTIMATE_RETURNED';
export const COST_ESTIMATE_FAILED = 'COST_ESTIMATE_FAILED';

export const CREATE_DATASOURCE_STARTED = 'CREATE_DATASOURCE_STARTED';
export const CREATE_DATASOURCE_SUCCESS = 'CREATE_DATASOURCE_SUCCESS';
export const CREATE_DATASOURCE_FAILED = 'CREATE_DATASOURCE_FAILED';

export const SET_EDITOR_TAB_LAST_UPDATE = 'SET_EDITOR_TAB_LAST_UPDATE';
export const SET_LAST_UPDATED_ACTIVE_TAB = 'SET_LAST_UPDATED_ACTIVE_TAB';
export const CLEAR_DESTROYED_QUERY_EDITOR = 'CLEAR_DESTROYED_QUERY_EDITOR';

export const addInfoToast = addInfoToastAction;
export const addSuccessToast = addSuccessToastAction;
export const addDangerToast = addDangerToastAction;
export const addWarningToast = addWarningToastAction;

export const CtasEnum = {
  Table: 'TABLE',
  View: 'VIEW',
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
const fieldConverter = (mapping: $TSFixMe) => (obj: $TSFixMe) =>
  mapKeys(obj, (value, key) => (key in mapping ? mapping[key] : key));

export const convertQueryToServer = fieldConverter(queryServerMapping);
export const convertQueryToClient = fieldConverter(queryClientMapping);

export function getUpToDateQuery(
  rootState: $TSFixMe,
  queryEditor: $TSFixMe,
  key: $TSFixMe,
) {
  const {
    sqlLab: { unsavedQueryEditor, queryEditors },
  } = rootState;
  const id = key ?? queryEditor.id;
  return {
    id,
    ...queryEditors.find((qe: $TSFixMe) => qe.id === id),
    ...(id === unsavedQueryEditor.id && unsavedQueryEditor),
  };
}

export function resetState(data: $TSFixMe) {
  return (dispatch: $TSFixMe, getState: $TSFixMe) => {
    const { common } = getState();
    const initialState = getInitialState({
      ...getBootstrapData(),
      common,
      ...data,
    });

    dispatch({
      type: RESET_STATE,
      sqlLabInitialState: initialState.sqlLab,
    });
    // @ts-expect-error TS(2345): Argument of type '{ user?: BootstrapUser; config?:... Remove this comment to see the full error message
    rehydratePersistedState(dispatch, initialState);
  };
}

export function updateQueryEditor(alterations: $TSFixMe) {
  return { type: UPDATE_QUERY_EDITOR, alterations };
}

export function setEditorTabLastUpdate(timestamp: $TSFixMe) {
  return { type: SET_EDITOR_TAB_LAST_UPDATE, timestamp };
}

export function scheduleQuery(query: $TSFixMe) {
  return (dispatch: $TSFixMe) =>
    SupersetClient.post({
      endpoint: '/api/v1/saved_query/',
      jsonPayload: query,
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

export function estimateQueryCost(queryEditor: $TSFixMe) {
  return (dispatch: $TSFixMe, getState: $TSFixMe) => {
    const { dbId, catalog, schema, sql, selectedText, templateParams } =
      // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
      getUpToDateQuery(getState(), queryEditor);
    const requestSql = selectedText || sql;

    const postPayload = {
      database_id: dbId,
      catalog,
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

export function clearInactiveQueries(interval: $TSFixMe) {
  return { type: CLEAR_INACTIVE_QUERIES, interval };
}

export function startQuery(query: $TSFixMe, runPreviewOnly: $TSFixMe) {
  Object.assign(query, {
    id: query.id ? query.id : nanoid(11),
    progress: 0,
    startDttm: now(),
    state: query.runAsync ? 'pending' : 'running',
    cached: false,
  });
  return { type: START_QUERY, query, runPreviewOnly };
}

export function querySuccess(query: $TSFixMe, results: $TSFixMe) {
  return { type: QUERY_SUCCESS, query, results };
}

export function logFailedQuery(query: $TSFixMe, errors: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const eventData = {
      has_err: true,
      start_offset: query.startDttm,
      ts: new Date().getTime(),
    };
    errors?.forEach(({ error_type: errorType, message, extra }: $TSFixMe) => {
      const issueCodes = extra?.issue_codes?.map(
        ({ code }: $TSFixMe) => code,
      ) || [-1];
      dispatch(
        logEvent(LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY, {
          ...eventData,
          error_type: errorType,
          issue_codes: issueCodes,
          error_details: message,
        }),
      );
    });
  };
}

export function queryFailed(
  query: $TSFixMe,
  msg: $TSFixMe,
  link: $TSFixMe,
  errors: $TSFixMe,
) {
  return function (dispatch: $TSFixMe) {
    dispatch(logFailedQuery(query, errors));
    dispatch({ type: QUERY_FAILED, query, msg, link, errors });
  };
}

export function stopQuery(query: $TSFixMe) {
  return { type: STOP_QUERY, query };
}

export function clearQueryResults(query: $TSFixMe) {
  return { type: CLEAR_QUERY_RESULTS, query };
}

export function removeDataPreview(table: $TSFixMe) {
  return { type: REMOVE_DATA_PREVIEW, table };
}

export function requestQueryResults(query: $TSFixMe) {
  return { type: REQUEST_QUERY_RESULTS, query };
}

export function fetchQueryResults(
  query: $TSFixMe,
  displayLimit: $TSFixMe,
  timeoutInMs: $TSFixMe,
) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const { SQLLAB_QUERY_RESULT_TIMEOUT } = getState().common?.conf ?? {};
    dispatch(requestQueryResults(query));

    const queryParams = rison.encode({
      key: query.resultsKey,
      rows: displayLimit || null,
    });
    const timeout = timeoutInMs ?? SQLLAB_QUERY_RESULT_TIMEOUT;
    const controller = new AbortController();
    return SupersetClient.get({
      endpoint: `/api/v1/sqllab/results/?q=${queryParams}`,
      parseMethod: 'json-bigint',
      ...(timeout && { timeout, signal: controller.signal }),
    })
      .then(({ json }) => dispatch(querySuccess(query, json)))
      .catch(response => {
        controller.abort();
        getClientErrorObject(response).then(error => {
          const message =
            error.error ||
            error.statusText ||
            t('Failed at retrieving results');

          return dispatch(
            queryFailed(query, message, error.link, error.errors),
          );
        });
      });
  };
}

export function runQuery(query: $TSFixMe, runPreviewOnly: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    dispatch(startQuery(query, runPreviewOnly));
    const postPayload = {
      client_id: query.id,
      database_id: query.dbId,
      json: true,
      runAsync: query.runAsync,
      catalog: query.catalog,
      schema: query.schema,
      sql: query.sql,
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
  database: $TSFixMe,
  queryEditor: $TSFixMe,
  defaultQueryLimit: $TSFixMe,
  tempTable: $TSFixMe,
  ctas: $TSFixMe,
  ctasMethod: $TSFixMe,
) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const qe = getUpToDateQuery(getState(), queryEditor, queryEditor.id);
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText || qe.sql,
      sqlEditorId: qe.id,
      tab: qe.name,
      catalog: qe.catalog,
      schema: qe.schema,
      tempTable,
      templateParams: qe.templateParams,
      queryLimit: qe.queryLimit || defaultQueryLimit,
      runAsync: database ? database.allow_run_async : false,
      ctas,
      ctas_method: ctasMethod,
      updateTabState: !qe.selectedText,
    };
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    dispatch(runQuery(query));
  };
}

export function reRunQuery(query: $TSFixMe) {
  // run Query with a new id
  return function (dispatch: $TSFixMe) {
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    dispatch(runQuery({ ...query, id: nanoid(11) }));
  };
}

export function postStopQuery(query: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    return SupersetClient.post({
      endpoint: '/api/v1/query/stop',
      body: JSON.stringify({ client_id: query.id }),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => dispatch(stopQuery(query)))
      .then(() => dispatch(addSuccessToast(t('Query was stopped.'))))
      .catch(() => dispatch(addDangerToast(t('Failed to stop query.'))));
  };
}

export function setDatabases(databases: $TSFixMe) {
  return { type: SET_DATABASES, databases };
}

function migrateTable(
  table: $TSFixMe,
  queryEditorId: $TSFixMe,
  dispatch: $TSFixMe,
) {
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

function migrateQuery(
  queryId: $TSFixMe,
  queryEditorId: $TSFixMe,
  dispatch: $TSFixMe,
) {
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

/**
 * Persist QueryEditor from local storage to backend tab state.
 * This ensures that when new tabs are created, query editors are
 * asynchronously stored in local storage and periodically synchronized
 * with the backend.
 * When switching to persistence mode, the QueryEditors previously
 * stored in local storage will also be synchronized to the backend
 * through syncQueryEditor.
 */
export function syncQueryEditor(queryEditor: $TSFixMe) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const { tables, queries } = getState().sqlLab;
    const localStorageTables = tables.filter(
      (table: $TSFixMe) =>
        table.inLocalStorage && table.queryEditorId === queryEditor.id,
    );
    const localStorageQueries = Object.values(queries).filter(
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      query => query.inLocalStorage && query.sqlEditorId === queryEditor.id,
    );
    return SupersetClient.post({
      endpoint: '/tabstateview/',
      postPayload: { queryEditor },
    })
      .then(({ json }) => {
        const newQueryEditor = {
          ...queryEditor,
          id: json.id.toString(),
          inLocalStorage: false,
          loaded: true,
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
          ...localStorageTables.map((table: $TSFixMe) =>
            migrateTable(table, newQueryEditor.id, dispatch),
          ),
          ...localStorageQueries.map(query =>
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
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

export function addQueryEditor(queryEditor: $TSFixMe) {
  const newQueryEditor = {
    ...queryEditor,
    id: nanoid(11),
    loaded: true,
    inLocalStorage: true,
  };
  return {
    type: ADD_QUERY_EDITOR,
    queryEditor: newQueryEditor,
  };
}

export function addNewQueryEditor() {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const {
      sqlLab: { queryEditors, tabHistory, unsavedQueryEditor, databases },
      common,
    } = getState();
    const defaultDbId = common.conf.SQLLAB_DEFAULT_DBID;
    const activeQueryEditor = queryEditors.find(
      (qe: $TSFixMe) => qe.id === tabHistory[tabHistory.length - 1],
    );
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    const dbIds = Object.values(databases).map(database => database.id);
    const firstDbId = dbIds.length > 0 ? Math.min(...dbIds) : undefined;
    const { dbId, catalog, schema, queryLimit, autorun }: $TSFixMe = {
      ...queryEditors[0],
      ...activeQueryEditor,
      ...(unsavedQueryEditor.id === activeQueryEditor?.id &&
        unsavedQueryEditor),
    };
    const warning = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? ''
      : t(
          '-- Note: Unless you save your query, these tabs will NOT persist if you clear your cookies or change browsers.\n\n',
        );

    const name = newQueryTabName(
      queryEditors?.map((qe: $TSFixMe) => ({
        ...qe,
        ...(qe.id === unsavedQueryEditor.id && unsavedQueryEditor),
      })) || [],
    );

    return dispatch(
      addQueryEditor({
        dbId: dbId || defaultDbId || firstDbId,
        catalog: catalog ?? null,
        schema: schema ?? null,
        autorun: autorun ?? false,
        sql: `${warning}SELECT ...`,
        queryLimit: queryLimit || common.conf.DEFAULT_SQLLAB_LIMIT,
        name,
      }),
    );
  };
}

export function cloneQueryToNewTab(query: $TSFixMe, autorun: $TSFixMe) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const state = getState();
    const { queryEditors, unsavedQueryEditor, tabHistory } = state.sqlLab;
    const sourceQueryEditor = {
      ...queryEditors.find(
        (qe: $TSFixMe) => qe.id === tabHistory[tabHistory.length - 1],
      ),
      ...(tabHistory[tabHistory.length - 1] === unsavedQueryEditor.id &&
        unsavedQueryEditor),
    };
    const queryEditor = {
      name: t('Copy of %s', sourceQueryEditor.name),
      dbId: query.dbId ? query.dbId : null,
      catalog: query.catalog ? query.catalog : null,
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

export function setLastUpdatedActiveTab(queryEditorId: $TSFixMe) {
  return {
    type: SET_LAST_UPDATED_ACTIVE_TAB,
    queryEditorId,
  };
}

export function setActiveQueryEditor(queryEditor: $TSFixMe) {
  return {
    type: SET_ACTIVE_QUERY_EDITOR,
    queryEditor,
  };
}

export function switchQueryEditor(goBackward = false) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const { sqlLab } = getState();
    const { queryEditors, tabHistory } = sqlLab;
    const qeid = tabHistory[tabHistory.length - 1];
    const currentIndex = queryEditors.findIndex(
      (qe: $TSFixMe) => qe.id === qeid,
    );
    const nextIndex = goBackward
      ? currentIndex - 1 + queryEditors.length
      : currentIndex + 1;
    const newQueryEditor = queryEditors[nextIndex % queryEditors.length];

    dispatch(setActiveQueryEditor(newQueryEditor));
  };
}

export function loadQueryEditor(queryEditor: $TSFixMe) {
  return { type: LOAD_QUERY_EDITOR, queryEditor };
}

export function setTables(tableSchemas: $TSFixMe) {
  const tables = tableSchemas
    .filter((tableSchema: $TSFixMe) => tableSchema.description !== null)
    .map((tableSchema: $TSFixMe) => {
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
        catalog: tableSchema.catalog,
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

export function fetchQueryEditor(
  queryEditor: $TSFixMe,
  displayLimit: $TSFixMe,
) {
  return function (dispatch: $TSFixMe) {
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
          catalog: json.catalog,
          schema: json.schema,
          queryLimit: json.query_limit,
          remoteId: json.saved_query?.id,
          hideLeftBar: json.hide_left_bar,
        };
        dispatch(loadQueryEditor(loadedQueryEditor));
        dispatch(setTables(json.table_schemas || []));
        if (json.latest_query && json.latest_query.resultsKey) {
          // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
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
  };
}

export function setActiveSouthPaneTab(tabId: $TSFixMe) {
  return { type: SET_ACTIVE_SOUTHPANE_TAB, tabId };
}

export function toggleLeftBar(queryEditor: $TSFixMe) {
  const hideLeftBar = !queryEditor.hideLeftBar;
  return {
    type: QUERY_EDITOR_TOGGLE_LEFT_BAR,
    queryEditor,
    hideLeftBar,
  };
}

export function clearDestoryedQueryEditor(queryEditorId: $TSFixMe) {
  return { type: CLEAR_DESTROYED_QUERY_EDITOR, queryEditorId };
}

export function removeQueryEditor(queryEditor: $TSFixMe) {
  return { type: REMOVE_QUERY_EDITOR, queryEditor };
}

export function removeAllOtherQueryEditors(queryEditor: $TSFixMe) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const { sqlLab } = getState();
    sqlLab.queryEditors?.forEach((otherQueryEditor: $TSFixMe) => {
      if (otherQueryEditor.id !== queryEditor.id) {
        dispatch(removeQueryEditor(otherQueryEditor));
      }
    });
  };
}

export function removeQuery(query: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
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

export function queryEditorSetDb(queryEditor: $TSFixMe, dbId: $TSFixMe) {
  return { type: QUERY_EDITOR_SETDB, queryEditor, dbId };
}

export function queryEditorSetCatalog(
  queryEditor: $TSFixMe,
  catalog: $TSFixMe,
) {
  return {
    type: QUERY_EDITOR_SET_CATALOG,
    queryEditor: queryEditor || {},
    catalog,
  };
}

export function queryEditorSetSchema(queryEditor: $TSFixMe, schema: $TSFixMe) {
  return {
    type: QUERY_EDITOR_SET_SCHEMA,
    queryEditor: queryEditor || {},
    schema,
  };
}

export function queryEditorSetAutorun(
  queryEditor: $TSFixMe,
  autorun: $TSFixMe,
) {
  return { type: QUERY_EDITOR_SET_AUTORUN, queryEditor, autorun };
}

export function queryEditorSetTitle(
  queryEditor: $TSFixMe,
  name: $TSFixMe,
  id: $TSFixMe,
) {
  return {
    type: QUERY_EDITOR_SET_TITLE,
    queryEditor: { ...queryEditor, id },
    name,
  };
}

export function saveQuery(query: $TSFixMe, clientId: $TSFixMe) {
  const { id, ...payload } = convertQueryToServer(query);

  return (dispatch: $TSFixMe) =>
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
  (queryEditor: $TSFixMe, savedQuery: $TSFixMe) => (dispatch: $TSFixMe) => {
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
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

export function updateSavedQuery(query: $TSFixMe, clientId: $TSFixMe) {
  const { id, ...payload } = convertQueryToServer(query);

  return (dispatch: $TSFixMe) =>
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

export function queryEditorSetSql(
  queryEditor: $TSFixMe,
  sql: $TSFixMe,
  queryId: $TSFixMe,
) {
  return { type: QUERY_EDITOR_SET_SQL, queryEditor, sql, queryId };
}

export function queryEditorSetCursorPosition(
  queryEditor: $TSFixMe,
  position: $TSFixMe,
) {
  return { type: QUERY_EDITOR_SET_CURSOR_POSITION, queryEditor, position };
}

export function queryEditorSetAndSaveSql(
  targetQueryEditor: $TSFixMe,
  sql: $TSFixMe,
  queryId: $TSFixMe,
) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const queryEditor = getUpToDateQuery(getState(), targetQueryEditor);
    // saved query and set tab state use this action
    dispatch(queryEditorSetSql(queryEditor, sql, queryId));
    if (isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)) {
      return SupersetClient.put({
        endpoint: encodeURI(`/tabstateview/${queryEditor.id}`),
        postPayload: { sql, latest_query_id: queryId },
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

export function formatQuery(queryEditor: $TSFixMe) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const { sql } = getUpToDateQuery(getState(), queryEditor);
    return SupersetClient.post({
      endpoint: `/api/v1/sqllab/format_sql/`,
      // TODO (betodealmeida): pass engine as a parameter for better formatting
      body: JSON.stringify({ sql }),
      headers: { 'Content-Type': 'application/json' },
    }).then(({ json }) => {
      // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
      dispatch(queryEditorSetSql(queryEditor, json.result));
    });
  };
}

export function queryEditorSetQueryLimit(
  queryEditor: $TSFixMe,
  queryLimit: $TSFixMe,
) {
  return {
    type: QUERY_EDITOR_SET_QUERY_LIMIT,
    queryEditor,
    queryLimit,
  };
}

export function queryEditorSetTemplateParams(
  queryEditor: $TSFixMe,
  templateParams: $TSFixMe,
) {
  return {
    type: QUERY_EDITOR_SET_TEMPLATE_PARAMS,
    queryEditor,
    templateParams,
  };
}

export function queryEditorSetSelectedText(
  queryEditor: $TSFixMe,
  sql: $TSFixMe,
) {
  return { type: QUERY_EDITOR_SET_SELECTED_TEXT, queryEditor, sql };
}

export function mergeTable(
  table: $TSFixMe,
  query: $TSFixMe,
  prepend: $TSFixMe,
) {
  return { type: MERGE_TABLE, table, query, prepend };
}

export function addTable(
  queryEditor: $TSFixMe,
  tableName: $TSFixMe,
  catalogName: $TSFixMe,
  schemaName: $TSFixMe,
) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const { dbId } = getUpToDateQuery(getState(), queryEditor, queryEditor.id);
    const table = {
      dbId,
      queryEditorId: queryEditor.id,
      catalog: catalogName,
      schema: schemaName,
      name: tableName,
    };
    dispatch(
      // @ts-expect-error TS(2554): Expected 3 arguments, but got 1.
      mergeTable({
        ...table,
        id: nanoid(11),
        expanded: true,
      }),
    );
  };
}

export function runTablePreviewQuery(
  newTable: $TSFixMe,
  runPreviewOnly: $TSFixMe,
) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const {
      sqlLab: { databases },
    } = getState();
    const database = databases[newTable.dbId];
    const { dbId, catalog, schema } = newTable;

    if (database && !database.disable_data_preview) {
      const dataPreviewQuery = {
        id: newTable.previewQueryId ?? nanoid(11),
        dbId,
        catalog,
        schema,
        sql: newTable.selectStar,
        tableName: newTable.name,
        sqlEditorId: null,
        tab: '',
        runAsync: database.allow_run_async,
        ctas: false,
        isDataPreview: true,
      };
      if (runPreviewOnly) {
        return dispatch(runQuery(dataPreviewQuery, runPreviewOnly));
      }
      return Promise.all([
        dispatch(
          // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
          mergeTable(
            {
              id: newTable.id,
              dbId: newTable.dbId,
              catalog: newTable.catalog,
              schema: newTable.schema,
              name: newTable.name,
              queryEditorId: newTable.queryEditorId,
              dataPreviewQueryId: dataPreviewQuery.id,
            },
            dataPreviewQuery,
          ),
        ),
        // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
        dispatch(runQuery(dataPreviewQuery)),
      ]);
    }
    return Promise.resolve();
  };
}

export function syncTable(table: $TSFixMe, tableMetadata: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? SupersetClient.post({
          endpoint: encodeURI('/tableschemaview/'),
          postPayload: { table: { ...tableMetadata, ...table } },
        })
      : Promise.resolve({ json: { id: table.id } });

    return sync
      .then(({ json: resultJson }) => {
        const newTable = { ...table, id: `${resultJson.id}` };
        dispatch(
          // @ts-expect-error TS(2554): Expected 3 arguments, but got 1.
          mergeTable({
            ...newTable,
            expanded: true,
            initialized: true,
          }),
        );
      })
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
  };
}

export function changeDataPreviewId(oldQueryId: $TSFixMe, newQuery: $TSFixMe) {
  return { type: CHANGE_DATA_PREVIEW_ID, oldQueryId, newQuery };
}

export function reFetchQueryResults(query: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const newQuery = {
      id: nanoid(),
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
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    dispatch(runQuery(newQuery));
    dispatch(changeDataPreviewId(query.id, newQuery));
  };
}

export function expandTable(table: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
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

export function collapseTable(table: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
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

export function removeTables(tables: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const tablesToRemove = tables?.filter(Boolean) ?? [];
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? Promise.all(
          tablesToRemove.map((table: $TSFixMe) =>
            table.initialized
              ? SupersetClient.delete({
                  endpoint: encodeURI(`/tableschemaview/${table.id}`),
                })
              : Promise.resolve(),
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

export function refreshQueries(alteredQueries: $TSFixMe) {
  return { type: REFRESH_QUERIES, alteredQueries };
}

export function setUserOffline(offline: $TSFixMe) {
  return { type: SET_USER_OFFLINE, offline };
}

export function persistEditorHeight(
  queryEditor: $TSFixMe,
  northPercent: $TSFixMe,
  southPercent: $TSFixMe,
) {
  return {
    type: QUERY_EDITOR_PERSIST_HEIGHT,
    queryEditor,
    northPercent,
    southPercent,
  };
}

export function popPermalink(key: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    return SupersetClient.get({ endpoint: `/api/v1/sqllab/permalink/${key}` })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            name: json.name ? json.name : t('Shared query'),
            dbId: json.dbId ? parseInt(json.dbId, 10) : null,
            catalog: json.catalog ? json.catalog : null,
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

export function popStoredQuery(urlId: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    return SupersetClient.get({
      endpoint: `/api/v1/sqllab/permalink/kv:${urlId}`,
    })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            name: json.name ? json.name : t('Shared query'),
            dbId: json.dbId ? parseInt(json.dbId, 10) : null,
            catalog: json.catalog ? json.catalog : null,
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
export function popSavedQuery(saveQueryId: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    return SupersetClient.get({
      endpoint: `/api/v1/saved_query/${saveQueryId}`,
    })
      .then(({ json }) => {
        const queryEditorProps = {
          ...convertQueryToClient(json.result),
          loaded: true,
          autorun: false,
        };
        const tmpAdaptedProps = {
          // @ts-expect-error TS(2339): Property 'name' does not exist on type '{ loaded: ... Remove this comment to see the full error message
          name: queryEditorProps.name,
          // @ts-expect-error TS(2339): Property 'database' does not exist on type '{ load... Remove this comment to see the full error message
          dbId: queryEditorProps.database.id,
          // @ts-expect-error TS(2339): Property 'catalog' does not exist on type '{ loade... Remove this comment to see the full error message
          catalog: queryEditorProps.catalog,
          // @ts-expect-error TS(2339): Property 'schema' does not exist on type '{ loaded... Remove this comment to see the full error message
          schema: queryEditorProps.schema,
          // @ts-expect-error TS(2339): Property 'sql' does not exist on type '{ loaded: b... Remove this comment to see the full error message
          sql: queryEditorProps.sql,
          // @ts-expect-error TS(2339): Property 'templateParams' does not exist on type '... Remove this comment to see the full error message
          templateParams: queryEditorProps.templateParams,
          // @ts-expect-error TS(2339): Property 'remoteId' does not exist on type '{ load... Remove this comment to see the full error message
          remoteId: queryEditorProps.remoteId,
        };
        return dispatch(addQueryEditor(tmpAdaptedProps));
      })
      .catch(() => dispatch(addDangerToast(ERR_MSG_CANT_LOAD_QUERY)));
  };
}
export function popQuery(queryId: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    return SupersetClient.get({
      endpoint: `/api/v1/query/${queryId}`,
    })
      .then(({ json }) => {
        const queryData = json.result;
        const queryEditorProps = {
          dbId: queryData.database.id,
          catalog: queryData.catalog,
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
export function popDatasourceQuery(datasourceKey: $TSFixMe, sql: $TSFixMe) {
  return function (dispatch: $TSFixMe) {
    const QUERY_TEXT = t('Query');
    const datasetId = datasourceKey.split('__')[0];

    const queryParams = rison.encode({
      keys: ['none'],
      columns: ['name', 'schema', 'database.id', 'select_star'],
    });

    return SupersetClient.get({
      endpoint: `/api/v1/dataset/${datasetId}?q=${queryParams}`,
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
export function createDatasourceSuccess(data: $TSFixMe) {
  const datasource = `${data.id}__table`;
  return { type: CREATE_DATASOURCE_SUCCESS, datasource };
}
export function createDatasourceFailed(err: $TSFixMe) {
  return { type: CREATE_DATASOURCE_FAILED, err };
}

export function createDatasource(vizOptions: $TSFixMe) {
  return (dispatch: $TSFixMe) => {
    dispatch(createDatasourceStarted());
    const { dbId, catalog, schema, datasourceName, sql, templateParams } =
      vizOptions;
    return SupersetClient.post({
      endpoint: '/api/v1/dataset/',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: dbId,
        catalog,
        schema,
        sql,
        table_name: datasourceName,
        is_managed_externally: false,
        external_url: null,
        template_params: templateParams,
      }),
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

export function createCtasDatasource(vizOptions: $TSFixMe) {
  return (dispatch: $TSFixMe) => {
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
