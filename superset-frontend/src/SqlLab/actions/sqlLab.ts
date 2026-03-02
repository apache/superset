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
import type { AnyAction } from 'redux';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import type { QueryColumn, SupersetError } from '@superset-ui/core';
import {
  FeatureFlag,
  SupersetClient,
  isFeatureEnabled,
  COMMON_ERR_MESSAGES,
  getClientErrorObject,
} from '@superset-ui/core';
import { t } from '@apache-superset/core';
import { invert, mapKeys } from 'lodash';

import { now } from '@superset-ui/core/utils/dates';
import {
  addDangerToast as addDangerToastAction,
  addInfoToast as addInfoToastAction,
  addSuccessToast as addSuccessToastAction,
  addWarningToast as addWarningToastAction,
} from 'src/components/MessageToasts/actions';
import { LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY } from 'src/logger/LogUtils';
import type { BootstrapData } from 'src/types/bootstrapTypes';
import getBootstrapData from 'src/utils/getBootstrapData';
import { logEvent } from 'src/logger/actions';
import type { QueryEditor, SqlLabRootState, Table } from '../types';
import { newQueryTabName } from '../utils/newQueryTabName';
import getInitialState from '../reducers/getInitialState';
import { rehydratePersistedState } from '../utils/reduxStateToLocalStorageHelper';
import { PREVIEW_QUERY_LIMIT } from '../constants';

// Type definitions for SqlLab actions
export interface Query {
  id: string;
  dbId?: number;
  sql: string;
  sqlEditorId?: string | null;
  sqlEditorImmutableId?: string;
  tab?: string | null;
  catalog?: string | null;
  schema?: string | null;
  tempTable?: string | null;
  templateParams?: string;
  queryLimit?: number;
  runAsync?: boolean;
  ctas?: boolean;
  ctas_method?: string;
  isDataPreview?: boolean;
  progress?: number;
  startDttm?: number;
  endDttm?: number;
  state?: string;
  cached?: boolean;
  resultsKey?: string | null;
  updateTabState?: boolean;
  tableName?: string;
  link?: string;
  inLocalStorage?: boolean;
  executedSql?: string;
  query_id?: number;
}

export interface Database {
  id: number;
  allow_run_async: boolean;
  disable_data_preview?: boolean;
}

/**
 * Query result data from the SQL execute API (matches QueryResultSchema)
 */
export interface SqlExecuteQueryResult {
  endDttm?: number;
  executedSql?: string;
  limit?: number;
  limitingFactor?: string;
  tempTable?: string | null;
  progress?: number;
  state?: string;
  [key: string]: unknown;
}

/**
 * Response from /api/v1/sqllab/execute/
 * This matches QueryExecutionResponseSchema from the backend
 */
export interface SqlExecuteResponse {
  status?: string;
  data: Record<string, unknown>[];
  columns: QueryColumn[];
  selected_columns?: QueryColumn[];
  expanded_columns?: QueryColumn[];
  query: SqlExecuteQueryResult;
  query_id?: number;
}

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

// SqlLab action interface with optional properties for reducer compatibility.
// Uses explicit property types instead of `any` for better type safety.
export interface SqlLabAction {
  type: string;
  // Query editor related
  queryEditor?: QueryEditor | Partial<QueryEditor>;
  alterations?: Partial<QueryEditor>;
  oldQueryEditor?: QueryEditor;
  newQueryEditor?: QueryEditor;
  queryEditorId?: string;
  // Query related
  query?: Query | Partial<Query>;
  queries?: Query[];
  alteredQueries?: Record<string, Partial<Query>>;
  queryId?: string;
  // Table related
  table?: Table | Partial<Table>;
  tables?: Table[];
  oldTable?: Table;
  newTable?: Table;
  // Database related
  databases?: Database[] | Record<string, Database>;
  dbId?: number;
  // State and config
  sqlLabInitialState?: SqlLabRootState['sqlLab'];
  sql?: string | null;
  name?: string;
  catalog?: string | null;
  schema?: string | null;
  autorun?: boolean;
  templateParams?: string;
  queryLimit?: number;
  position?: { row: number; column: number };
  functionNames?: string[];
  northPercent?: number;
  southPercent?: number;
  hideLeftBar?: boolean;
  // Results and errors
  results?: SqlExecuteResponse;
  errors?: SupersetError[];
  error?: string;
  msg?: string;
  link?: string;
  err?: string;
  // Misc
  tabId?: string | number;
  timestamp?: number;
  interval?: number;
  offline?: boolean;
  datasource?: unknown;
  clientId?: string;
  result?: Record<string, unknown>;
  prepend?: boolean;
  json?: Record<string, unknown>;
  oldQueryId?: string;
  newQuery?: { id: string };
}

// Use AnyAction for ThunkAction/ThunkDispatch to maintain compatibility with
// redux-mock-store and standard Redux patterns. SqlLabAction is used for plain
// action creator return types where the shape is known.
type SqlLabThunkAction<R = void> = ThunkAction<
  R,
  SqlLabRootState,
  undefined,
  AnyAction
>;

type AppDispatch = ThunkDispatch<SqlLabRootState, undefined, AnyAction>;
type GetState = () => SqlLabRootState;

export const addInfoToast = addInfoToastAction;
export const addSuccessToast = addSuccessToastAction;
export const addDangerToast = addDangerToastAction;
export const addWarningToast = addWarningToastAction;

export const CtasEnum = {
  Table: 'TABLE',
  View: 'VIEW',
} as const;

const ERR_MSG_CANT_LOAD_QUERY = t("The query couldn't be loaded");

// a map of SavedQuery field names to the different names used client-side,
// because for now making the names consistent is too complicated
// so it might as well only happen in one place
const queryClientMapping: Record<string, string> = {
  id: 'remoteId',
  db_id: 'dbId',
  label: 'name',
  template_parameters: 'templateParams',
};
const queryServerMapping = invert(queryClientMapping);

// uses a mapping like those above to convert object key names to another style
const fieldConverter =
  (mapping: Record<string, string>) =>
  <T extends Record<string, unknown>>(obj: T): Record<string, unknown> =>
    mapKeys(obj, (_value, key) => (key in mapping ? mapping[key] : key));

export const convertQueryToServer = fieldConverter(queryServerMapping);
export const convertQueryToClient = fieldConverter(queryClientMapping);

export function getUpToDateQuery(
  rootState: SqlLabRootState,
  queryEditor: Partial<QueryEditor>,
  key?: string,
): QueryEditor {
  const {
    sqlLab: { unsavedQueryEditor, queryEditors },
  } = rootState;
  const id = key ?? queryEditor.id;
  return {
    id,
    ...queryEditors.find((qe: QueryEditor) => qe.id === id),
    ...(id === unsavedQueryEditor.id && unsavedQueryEditor),
  } as QueryEditor;
}

export function resetState(data?: Record<string, unknown>): SqlLabThunkAction {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { common } = getState();
    const initialState = getInitialState({
      ...getBootstrapData(),
      common,
      ...(data as Partial<BootstrapData>),
    });

    dispatch({
      type: RESET_STATE,
      sqlLabInitialState: initialState.sqlLab as SqlLabRootState['sqlLab'],
    });
    rehydratePersistedState(
      dispatch,
      initialState as unknown as SqlLabRootState,
    );
  };
}

export function updateQueryEditor(
  alterations: Partial<QueryEditor>,
): SqlLabAction {
  return { type: UPDATE_QUERY_EDITOR, alterations };
}

export function setEditorTabLastUpdate(timestamp: number): SqlLabAction {
  return { type: SET_EDITOR_TAB_LAST_UPDATE, timestamp };
}

export function scheduleQuery(
  query: Record<string, unknown>,
): SqlLabThunkAction<Promise<unknown>> {
  return (dispatch: AppDispatch) =>
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

export function estimateQueryCost(
  queryEditor: QueryEditor,
): SqlLabThunkAction<Promise<unknown[]>> {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { dbId, catalog, schema, sql, selectedText, templateParams } =
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

export function clearInactiveQueries(interval: number): SqlLabAction {
  return { type: CLEAR_INACTIVE_QUERIES, interval };
}

export function startQuery(query: Query, runPreviewOnly?: boolean) {
  Object.assign(query, {
    id: query.id ? query.id : nanoid(11),
    progress: 0,
    startDttm: now(),
    state: 'pending',
    cached: false,
  });
  return { type: START_QUERY, query, runPreviewOnly } as const;
}

export function querySuccess(query: Query, results: SqlExecuteResponse) {
  return { type: QUERY_SUCCESS, query, results } as const;
}

export function logFailedQuery(
  query: Query,
  errors?: SupersetError[],
): SqlLabThunkAction<void> {
  return function (dispatch) {
    const eventData = {
      has_err: true,
      start_offset: query.startDttm,
      ts: new Date().getTime(),
    };
    errors?.forEach(({ error_type: errorType, message, extra }) => {
      const issueCodes = (
        extra as { issue_codes?: { code: number }[] }
      )?.issue_codes?.map(({ code }) => code) || [-1];
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

export function createQueryFailedAction(
  query: Query,
  msg: string,
  link?: string,
  errors?: SupersetError[],
) {
  return { type: QUERY_FAILED, query, msg, link, errors } as const;
}

export function queryFailed(
  query: Query,
  msg: string,
  link?: string,
  errors?: SupersetError[],
): SqlLabThunkAction<void> {
  return function (dispatch) {
    dispatch(logFailedQuery(query, errors));
    dispatch(createQueryFailedAction(query, msg, link, errors));
  };
}

export function stopQuery(query: Query) {
  return { type: STOP_QUERY, query } as const;
}

export function clearQueryResults(query: Query): SqlLabAction {
  return { type: CLEAR_QUERY_RESULTS, query };
}

export function removeDataPreview(table: Table): SqlLabAction {
  return { type: REMOVE_DATA_PREVIEW, table };
}

export function requestQueryResults(query: Query): SqlLabAction {
  return { type: REQUEST_QUERY_RESULTS, query };
}

export function fetchQueryResults(
  query: Query,
  displayLimit?: number,
  timeoutInMs?: number,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch, getState: GetState) {
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
      .then(({ json }) => {
        dispatch(querySuccess(query, json as SqlExecuteResponse));
      })
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

export function runQuery(
  query: Query,
  runPreviewOnly?: boolean,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    dispatch(startQuery(query, runPreviewOnly));
    const postPayload = {
      client_id: query.id,
      database_id: query.dbId,
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
          dispatch(querySuccess(query, json as SqlExecuteResponse));
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
  database: Database | null,
  queryEditor: QueryEditor,
  defaultQueryLimit: number,
  tempTable?: string,
  ctas?: boolean,
  ctasMethod?: string,
): SqlLabThunkAction {
  return function (dispatch: AppDispatch, getState: GetState) {
    const qe = getUpToDateQuery(getState(), queryEditor, queryEditor.id);
    const query: Query = {
      id: nanoid(11),
      dbId: qe.dbId,
      sql: qe.selectedText || qe.sql,
      sqlEditorId: qe.tabViewId ?? qe.id,
      sqlEditorImmutableId: qe.immutableId,
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
    dispatch(runQuery(query));
  };
}

export function reRunQuery(query: Query): SqlLabThunkAction {
  // run Query with a new id
  return function (dispatch: AppDispatch) {
    dispatch(runQuery({ ...query, id: nanoid(11) }));
  };
}

export function postStopQuery(
  query: Query,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
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

export function setDatabases(databases: Database[]): SqlLabAction {
  return { type: SET_DATABASES, databases };
}

function migrateTable(
  table: Table,
  queryEditorId: string,
  dispatch: AppDispatch,
): Promise<unknown> {
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
  queryId: string,
  queryEditorId: string,
  dispatch: AppDispatch,
): Promise<unknown> {
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
export function syncQueryEditor(
  queryEditor: QueryEditor,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { tables, queries } = getState().sqlLab;
    const localStorageTables = tables.filter(
      (table: Table) =>
        table.inLocalStorage && table.queryEditorId === queryEditor.id,
    );
    const localStorageQueries = Object.values(queries).filter(
      query => query.inLocalStorage && query.sqlEditorId === queryEditor.id,
    );
    return SupersetClient.post({
      endpoint: '/tabstateview/',
      postPayload: { queryEditor },
    })
      .then(({ json }) => {
        const newQueryEditor = {
          ...queryEditor,
          inLocalStorage: false,
          loaded: true,
          tabViewId: json.id.toString(),
        };
        dispatch({
          type: MIGRATE_QUERY_EDITOR,
          oldQueryEditor: queryEditor,
          newQueryEditor,
        });
        return Promise.all([
          ...localStorageTables.map((table: Table) =>
            migrateTable(table, newQueryEditor.tabViewId!, dispatch),
          ),
          ...localStorageQueries.map((query: Query) =>
            migrateQuery(query.id, newQueryEditor.tabViewId!, dispatch),
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

export function addQueryEditor(
  queryEditor: Partial<QueryEditor>,
): SqlLabAction {
  const newQueryEditor = {
    ...queryEditor,
    id: nanoid(11),
    immutableId: nanoid(11),
    loaded: true,
    inLocalStorage: true,
  };
  return {
    type: ADD_QUERY_EDITOR,
    queryEditor: newQueryEditor,
  };
}

export function addNewQueryEditor(): SqlLabThunkAction<SqlLabAction> {
  return function (dispatch: AppDispatch, getState: GetState) {
    const {
      sqlLab: { queryEditors, tabHistory, unsavedQueryEditor, databases },
      common,
    } = getState();
    const defaultDbId = common.conf.SQLLAB_DEFAULT_DBID as number | undefined;
    const activeQueryEditor = queryEditors.find(
      (qe: QueryEditor) => qe.id === tabHistory[tabHistory.length - 1],
    );
    const dbIds = Object.values(databases).map(
      (database: { id: number }) => database.id,
    );
    const firstDbId = dbIds.length > 0 ? Math.min(...dbIds) : undefined;
    const { dbId, catalog, schema, queryLimit, autorun } = {
      ...queryEditors[0],
      ...activeQueryEditor,
      ...(unsavedQueryEditor.id === activeQueryEditor?.id &&
        unsavedQueryEditor),
    } as Partial<QueryEditor>;
    const warning = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? ''
      : t(
          '-- Note: Unless you save your query, these tabs will NOT persist if you clear your cookies or change browsers.\n\n',
        );

    const name = newQueryTabName(
      queryEditors?.map((qe: QueryEditor) => ({
        ...qe,
        ...(qe.id === unsavedQueryEditor.id && unsavedQueryEditor),
      })) || [],
    );

    return dispatch(
      addQueryEditor({
        dbId: dbId || defaultDbId || firstDbId,
        catalog,
        schema,
        autorun: autorun ?? false,
        sql: `${warning}SELECT ...`,
        queryLimit: queryLimit || common.conf.DEFAULT_SQLLAB_LIMIT,
        name,
      }),
    );
  };
}

export function cloneQueryToNewTab(
  query: Query,
  autorun: boolean,
): SqlLabThunkAction<SqlLabAction> {
  return function (dispatch: AppDispatch, getState: GetState) {
    const state = getState();
    const { queryEditors, unsavedQueryEditor, tabHistory } = state.sqlLab;
    const sourceQueryEditor = {
      ...queryEditors.find(
        (qe: QueryEditor) => qe.id === tabHistory[tabHistory.length - 1],
      ),
      ...(tabHistory[tabHistory.length - 1] === unsavedQueryEditor.id &&
        unsavedQueryEditor),
    };
    const queryEditor = {
      name: t('Copy of %s', sourceQueryEditor.name),
      dbId: query.dbId,
      catalog: query.catalog,
      schema: query.schema ?? undefined,
      autorun,
      sql: query.sql,
      queryLimit: sourceQueryEditor.queryLimit,
      templateParams: sourceQueryEditor.templateParams,
    };
    return dispatch(addQueryEditor(queryEditor));
  };
}

export function setLastUpdatedActiveTab(queryEditorId: string): SqlLabAction {
  return {
    type: SET_LAST_UPDATED_ACTIVE_TAB,
    queryEditorId,
  };
}

export function setActiveQueryEditor(queryEditor: QueryEditor): SqlLabAction {
  return {
    type: SET_ACTIVE_QUERY_EDITOR,
    queryEditor,
  };
}

export function switchQueryEditor(goBackward = false): SqlLabThunkAction {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sqlLab } = getState();
    const { queryEditors, tabHistory } = sqlLab;
    const qeid = tabHistory[tabHistory.length - 1];
    const currentIndex = queryEditors.findIndex(
      (qe: QueryEditor) => qe.id === qeid,
    );
    const nextIndex = goBackward
      ? currentIndex - 1 + queryEditors.length
      : currentIndex + 1;
    const newQueryEditor = queryEditors[nextIndex % queryEditors.length];

    dispatch(setActiveQueryEditor(newQueryEditor));
  };
}

export function loadQueryEditor(queryEditor: QueryEditor): SqlLabAction {
  return { type: LOAD_QUERY_EDITOR, queryEditor };
}

interface TableSchema {
  description: {
    columns: unknown[];
    selectStar: string;
    primaryKey: unknown;
    foreignKeys: unknown[];
    indexes: unknown[];
    dataPreviewQueryId: string;
  } | null;
  database_id: number;
  tab_state_id: number;
  catalog: string;
  schema: string;
  table: string;
  expanded: boolean;
  id: string;
}

export function setTables(tableSchemas: TableSchema[]): SqlLabAction {
  const tables = tableSchemas
    .filter((tableSchema: TableSchema) => tableSchema.description !== null)
    .map((tableSchema: TableSchema) => {
      const {
        columns,
        selectStar,
        primaryKey,
        foreignKeys,
        indexes,
        dataPreviewQueryId,
      } = tableSchema.description!;
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
  queryEditor: QueryEditor,
  displayLimit: number,
): SqlLabThunkAction {
  return function (dispatch: AppDispatch) {
    const queryEditorId = queryEditor.tabViewId ?? queryEditor.id;
    SupersetClient.get({
      endpoint: encodeURI(`/tabstateview/${queryEditorId}`),
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
        dispatch(loadQueryEditor(loadedQueryEditor as unknown as QueryEditor));
        dispatch(setTables(json.table_schemas || []));
        if (json.latest_query?.resultsKey) {
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

export function setActiveSouthPaneTab(tabId: string): SqlLabAction {
  return { type: SET_ACTIVE_SOUTHPANE_TAB, tabId };
}

export function toggleLeftBar(queryEditor: QueryEditor): SqlLabAction {
  const hideLeftBar = !queryEditor.hideLeftBar;
  return {
    type: QUERY_EDITOR_TOGGLE_LEFT_BAR,
    queryEditor,
    hideLeftBar,
  };
}

export function clearDestoryedQueryEditor(queryEditorId: string): SqlLabAction {
  return { type: CLEAR_DESTROYED_QUERY_EDITOR, queryEditorId };
}

export function removeQueryEditor(queryEditor: QueryEditor): SqlLabAction {
  return { type: REMOVE_QUERY_EDITOR, queryEditor };
}

export function removeAllOtherQueryEditors(
  queryEditor: QueryEditor,
): SqlLabThunkAction {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sqlLab } = getState();
    sqlLab.queryEditors?.forEach((otherQueryEditor: QueryEditor) => {
      if (otherQueryEditor.id !== queryEditor.id) {
        dispatch(removeQueryEditor(otherQueryEditor));
      }
    });
  };
}

export function removeQuery(query: Query): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    const queryEditorId = query.sqlEditorId ?? query.id;
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? SupersetClient.delete({
          endpoint: encodeURI(
            `/tabstateview/${queryEditorId}/query/${query.id}`,
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

export function queryEditorSetDb(
  queryEditor: Partial<QueryEditor>,
  dbId: number,
): SqlLabAction {
  return { type: QUERY_EDITOR_SETDB, queryEditor, dbId };
}

export function queryEditorSetCatalog(
  queryEditor: Partial<QueryEditor> | null,
  catalog: string | null,
): SqlLabAction {
  return {
    type: QUERY_EDITOR_SET_CATALOG,
    queryEditor: queryEditor || {},
    catalog,
  };
}

export function queryEditorSetSchema(
  queryEditor: Partial<QueryEditor> | null,
  schema: string | null,
): SqlLabAction {
  return {
    type: QUERY_EDITOR_SET_SCHEMA,
    queryEditor: queryEditor || {},
    schema,
  };
}

export function queryEditorSetAutorun(
  queryEditor: Partial<QueryEditor>,
  autorun: boolean,
): SqlLabAction {
  return { type: QUERY_EDITOR_SET_AUTORUN, queryEditor, autorun };
}

export function queryEditorSetTitle(
  queryEditor: Partial<QueryEditor>,
  name: string,
  id: string,
): SqlLabAction {
  return {
    type: QUERY_EDITOR_SET_TITLE,
    queryEditor: { ...queryEditor, id },
    name,
  };
}

export function saveQuery(
  query: Partial<QueryEditor>,
  clientId: string,
): SqlLabThunkAction<Promise<Record<string, unknown> | void>> {
  const { id: _id, ...payload } = convertQueryToServer(
    query as Record<string, unknown>,
  );

  return (dispatch: AppDispatch) =>
    SupersetClient.post({
      endpoint: '/api/v1/saved_query/',
      jsonPayload: convertQueryToServer(payload as Record<string, unknown>),
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
        dispatch(queryEditorSetTitle(query, query.name ?? '', clientId));
        return savedQuery;
      })
      .catch(() =>
        dispatch(addDangerToast(t('Your query could not be saved'))),
      );
}

export const addSavedQueryToTabState =
  (
    queryEditor: QueryEditor,
    savedQuery: { remoteId: string },
  ): SqlLabThunkAction<Promise<unknown>> =>
  (dispatch: AppDispatch) => {
    const queryEditorId = queryEditor.tabViewId ?? queryEditor.id;
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? SupersetClient.put({
          endpoint: `/tabstateview/${queryEditorId}`,
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

export function updateSavedQuery(
  query: Partial<QueryEditor>,
  clientId: string,
): SqlLabThunkAction<Promise<unknown>> {
  const { id: _id, ...payload } = convertQueryToServer(
    query as Record<string, unknown>,
  );

  return (dispatch: AppDispatch) =>
    SupersetClient.put({
      endpoint: `/api/v1/saved_query/${query.remoteId}`,
      jsonPayload: convertQueryToServer(payload as Record<string, unknown>),
    })
      .then(() => {
        dispatch(addSuccessToast(t('Your query was updated')));
        dispatch(queryEditorSetTitle(query, query.name ?? '', clientId));
      })
      .catch(e => {
        const message = t('Your query could not be updated');
        // eslint-disable-next-line no-console
        console.error(message, e);
        dispatch(addDangerToast(message));
      })
      .then(() => {
        dispatch(updateQueryEditor(query));
      });
}

export function queryEditorSetSql(
  queryEditor: Partial<QueryEditor>,
  sql: string,
  queryId?: string,
): SqlLabAction {
  return { type: QUERY_EDITOR_SET_SQL, queryEditor, sql, queryId };
}

export function queryEditorSetCursorPosition(
  queryEditor: Partial<QueryEditor>,
  position: { row: number; column: number },
): SqlLabAction {
  return { type: QUERY_EDITOR_SET_CURSOR_POSITION, queryEditor, position };
}

export function queryEditorSetAndSaveSql(
  targetQueryEditor: Partial<QueryEditor>,
  sql: string,
  queryId?: string,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch, getState: GetState) {
    const queryEditor = getUpToDateQuery(getState(), targetQueryEditor);
    // saved query and set tab state use this action
    dispatch(queryEditorSetSql(queryEditor, sql, queryId));
    const queryEditorId = queryEditor.tabViewId ?? queryEditor.id;
    if (isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)) {
      return SupersetClient.put({
        endpoint: encodeURI(`/tabstateview/${queryEditorId}`),
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

export function formatQuery(
  queryEditor: QueryEditor,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { sql, dbId, templateParams } = getUpToDateQuery(
      getState(),
      queryEditor,
    );
    const body: {
      sql: string;
      database_id?: number;
      template_params?: string;
    } = { sql };

    // Include database_id and template_params if available for Jinja processing
    if (dbId) {
      body.database_id = dbId;
    }
    if (templateParams) {
      // Send templateParams as a JSON string to match the backend schema
      body.template_params =
        typeof templateParams === 'string'
          ? templateParams
          : JSON.stringify(templateParams);
    }

    return SupersetClient.post({
      endpoint: `/api/v1/sqllab/format_sql/`,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }).then(({ json }) => {
      dispatch(queryEditorSetSql(queryEditor, json.result));
    });
  };
}

export function queryEditorSetQueryLimit(
  queryEditor: Partial<QueryEditor>,
  queryLimit: number,
): SqlLabAction {
  return {
    type: QUERY_EDITOR_SET_QUERY_LIMIT,
    queryEditor,
    queryLimit,
  };
}

export function queryEditorSetTemplateParams(
  queryEditor: Partial<QueryEditor>,
  templateParams: string,
): SqlLabAction {
  return {
    type: QUERY_EDITOR_SET_TEMPLATE_PARAMS,
    queryEditor,
    templateParams,
  };
}

export function queryEditorSetSelectedText(
  queryEditor: Partial<QueryEditor>,
  sql: string | null,
): SqlLabAction {
  return { type: QUERY_EDITOR_SET_SELECTED_TEXT, queryEditor, sql };
}

export function mergeTable(
  table: Partial<Table>,
  query?: Query,
  prepend?: boolean,
): SqlLabAction {
  return { type: MERGE_TABLE, table, query, prepend };
}

export function addTable(
  queryEditor: Partial<QueryEditor>,
  tableName: string,
  catalogName: string | null,
  schemaName: string,
  expanded = true,
): SqlLabThunkAction {
  return function (dispatch: AppDispatch, getState: GetState) {
    const { dbId } = getUpToDateQuery(getState(), queryEditor, queryEditor.id);
    const table = {
      dbId,
      queryEditorId: queryEditor.tabViewId ?? queryEditor.id,
      catalog: catalogName,
      schema: schemaName,
      name: tableName,
    };
    dispatch(
      mergeTable({
        ...table,
        id: nanoid(11),
        expanded,
      }),
    );
  };
}

interface NewTable {
  id?: string;
  dbId: number | string;
  catalog?: string | null;
  schema?: string;
  name: string;
  queryEditorId?: string;
  selectStar?: string;
  previewQueryId?: string;
}

export function runTablePreviewQuery(
  newTable: NewTable,
  runPreviewOnly?: boolean,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch, getState: GetState) {
    const {
      sqlLab: { databases },
    } = getState();
    const database = databases[newTable.dbId];
    const { dbId, catalog, schema } = newTable;

    if (database && !database.disable_data_preview) {
      const dataPreviewQuery: Query = {
        id: newTable.previewQueryId ?? nanoid(11),
        dbId: dbId as number | undefined,
        catalog: catalog ?? undefined,
        schema: schema ?? '',
        sql: newTable.selectStar ?? '',
        tableName: newTable.name,
        sqlEditorId: null,
        tab: '',
        runAsync: database.allow_run_async,
        ctas: false,
        isDataPreview: true,
        queryLimit: PREVIEW_QUERY_LIMIT,
      };
      if (runPreviewOnly) {
        return dispatch(runQuery(dataPreviewQuery, runPreviewOnly));
      }
      return Promise.all([
        dispatch(
          mergeTable(
            {
              id: newTable.id,
              dbId: newTable.dbId as number | undefined,
              catalog: newTable.catalog ?? undefined,
              schema: newTable.schema ?? '',
              name: newTable.name,
              queryEditorId: newTable.queryEditorId,
              dataPreviewQueryId: dataPreviewQuery.id,
            },
            dataPreviewQuery,
          ),
        ),
        dispatch(runQuery(dataPreviewQuery)),
      ]);
    }
    return Promise.resolve();
  };
}

interface TableMetaData {
  columns?: unknown[];
  selectStar?: string;
  primaryKey?: unknown;
  foreignKeys?: unknown[];
  indexes?: unknown[];
}

export function syncTable(
  table: Table,
  tableMetadata: TableMetaData,
  finalQueryEditorId?: string,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    const finalTable = { ...table, queryEditorId: finalQueryEditorId };
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? SupersetClient.post({
          endpoint: encodeURI('/tableschemaview/'),
          postPayload: { table: { ...tableMetadata, ...finalTable } },
        })
      : Promise.resolve({ json: { id: table.id } });

    return sync
      .then(({ json: resultJson }) => {
        const newTable = { ...table, id: `${resultJson.id}` };
        dispatch(
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

export function changeDataPreviewId(
  oldQueryId: string,
  newQuery: Query,
): SqlLabAction {
  return { type: CHANGE_DATA_PREVIEW_ID, oldQueryId, newQuery };
}

export function reFetchQueryResults(query: Query): SqlLabThunkAction {
  return function (dispatch: AppDispatch) {
    const newQuery: Query = {
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
    dispatch(runQuery(newQuery));
    dispatch(changeDataPreviewId(query.id, newQuery));
  };
}

export function expandTable(table: Table): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    const sync =
      isFeatureEnabled(FeatureFlag.SqllabBackendPersistence) &&
      table.initialized
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

export function collapseTable(
  table: Table,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    const sync =
      isFeatureEnabled(FeatureFlag.SqllabBackendPersistence) &&
      table.initialized
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

export function removeTables(
  tables: Table[],
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    const tablesToRemove = tables?.filter(Boolean) ?? [];
    const sync = isFeatureEnabled(FeatureFlag.SqllabBackendPersistence)
      ? Promise.all(
          tablesToRemove.map((table: Table) =>
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

export function refreshQueries(
  alteredQueries: Record<string, Query>,
): SqlLabAction {
  return { type: REFRESH_QUERIES, alteredQueries };
}

export function setUserOffline(offline: boolean): SqlLabAction {
  return { type: SET_USER_OFFLINE, offline };
}

export function persistEditorHeight(
  queryEditor: QueryEditor,
  northPercent: number,
  southPercent: number,
): SqlLabAction {
  return {
    type: QUERY_EDITOR_PERSIST_HEIGHT,
    queryEditor,
    northPercent,
    southPercent,
  };
}

export function popPermalink(key: string): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    return SupersetClient.get({ endpoint: `/api/v1/sqllab/permalink/${key}` })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            name: json.name ? json.name : t('Shared query'),
            dbId: json.dbId ? parseInt(json.dbId, 10) : undefined,
            catalog: json.catalog ?? null,
            schema: json.schema ?? undefined,
            autorun: json.autorun ? json.autorun : false,
            sql: json.sql ? json.sql : 'SELECT ...',
            templateParams: json.templateParams,
          }),
        ),
      )
      .catch(() => dispatch(addDangerToast(ERR_MSG_CANT_LOAD_QUERY)));
  };
}

export function popStoredQuery(
  urlId: string,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    return SupersetClient.get({
      endpoint: `/api/v1/sqllab/permalink/kv:${urlId}`,
    })
      .then(({ json }) =>
        dispatch(
          addQueryEditor({
            name: json.name ? json.name : t('Shared query'),
            dbId: json.dbId ? parseInt(json.dbId, 10) : undefined,
            catalog: json.catalog ?? null,
            schema: json.schema ?? undefined,
            autorun: json.autorun ? json.autorun : false,
            sql: json.sql ? json.sql : 'SELECT ...',
            templateParams: json.templateParams,
          }),
        ),
      )
      .catch(() => dispatch(addDangerToast(ERR_MSG_CANT_LOAD_QUERY)));
  };
}
export function popSavedQuery(
  saveQueryId: string,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
    return SupersetClient.get({
      endpoint: `/api/v1/saved_query/${saveQueryId}`,
    })
      .then(({ json }) => {
        const queryEditorProps = {
          ...convertQueryToClient(json.result),
          loaded: true,
          autorun: false,
        } as Record<string, unknown>;
        const tmpAdaptedProps = {
          name: queryEditorProps.name as string,
          dbId: (queryEditorProps.database as { id: number }).id,
          catalog: queryEditorProps.catalog as string,
          schema: queryEditorProps.schema as string,
          sql: queryEditorProps.sql as string,
          templateParams: queryEditorProps.templateParams as string,
          remoteId: queryEditorProps.remoteId as number | null,
        };
        return dispatch(addQueryEditor(tmpAdaptedProps));
      })
      .catch(() => dispatch(addDangerToast(ERR_MSG_CANT_LOAD_QUERY)));
  };
}
export function popQuery(queryId: string): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
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
export function popDatasourceQuery(
  datasourceKey: string,
  sql?: string,
): SqlLabThunkAction<Promise<unknown>> {
  return function (dispatch: AppDispatch) {
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
export function createDatasourceStarted(): SqlLabAction {
  return { type: CREATE_DATASOURCE_STARTED };
}
export function createDatasourceSuccess(data: { id: number }): SqlLabAction {
  const datasource = `${data.id}__table`;
  return { type: CREATE_DATASOURCE_SUCCESS, datasource };
}
export function createDatasourceFailed(err: string): SqlLabAction {
  return { type: CREATE_DATASOURCE_FAILED, err };
}

interface VizOptions {
  dbId: number;
  catalog?: string | null;
  schema: string;
  datasourceName: string;
  sql: string;
  templateParams?: string;
}

export function createDatasource(
  vizOptions: VizOptions,
): SqlLabThunkAction<Promise<unknown>> {
  return (dispatch: AppDispatch) => {
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
        dispatch(createDatasourceSuccess(json as { id: number }));

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

export function createCtasDatasource(
  vizOptions: Record<string, unknown>,
): SqlLabThunkAction<Promise<{ id: number }>> {
  return (dispatch: AppDispatch) => {
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
