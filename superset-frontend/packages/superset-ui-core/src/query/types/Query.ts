/* eslint camelcase: 0 */
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
import { DatasourceType } from './Datasource';
import { BinaryOperator, SetOperator, UnaryOperator } from './Operator';
import { AppliedTimeExtras, TimeRange } from './Time';
import { AnnotationLayer } from './AnnotationLayer';
import {
  QueryFields,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from './QueryFormData';
import { Maybe } from '../../types';
import { PostProcessingRule } from './PostProcessing';
import { JsonObject } from '../../connection';
import { TimeGranularity } from '../../time-format';
import { GenericDataType } from './QueryResponse';

export type BaseQueryObjectFilterClause = {
  col: QueryFormColumn;
  grain?: TimeGranularity;
  isExtra?: boolean;
};

export type BinaryQueryObjectFilterClause = BaseQueryObjectFilterClause & {
  op: BinaryOperator;
  val: string | number | boolean;
  formattedVal?: string;
};

export type SetQueryObjectFilterClause = BaseQueryObjectFilterClause & {
  op: SetOperator;
  val: (string | number | boolean)[];
  formattedVal?: string[];
};

export type UnaryQueryObjectFilterClause = BaseQueryObjectFilterClause & {
  op: UnaryOperator;
  formattedVal?: string;
};

export type QueryObjectFilterClause =
  | BinaryQueryObjectFilterClause
  | SetQueryObjectFilterClause
  | UnaryQueryObjectFilterClause;

export type QueryObjectExtras = Partial<{
  /** HAVING condition for SQLAlchemy */
  having?: string;
  relative_start?: string;
  relative_end?: string;
  time_grain_sqla?: TimeGranularity;
  /** WHERE condition */
  where?: string;
  /** Instant Time Comparison */
  instant_time_comparison_range?: string;
}>;

export type ResidualQueryObjectData = {
  [key: string]: unknown;
};

/**
 * Query object directly compatible with the new chart data API.
 * A stricter version of query form data.
 *
 * All information should be related to generating database queries. Config values
 * for client-side processing and chart rendering should happen in `buildQuery`
 * and `transformProps`.
 */
export interface QueryObject
  extends QueryFields,
    TimeRange,
    ResidualQueryObjectData {
  /**
   * Definition for annotation layers.
   */
  annotation_layers?: AnnotationLayer[];

  /** Time filters that have been applied to the query object */
  applied_time_extras?: AppliedTimeExtras;

  /** add fetch value predicate to query if defined in datasource */
  apply_fetch_values_predicate?: boolean;

  /**
   * Extra form data. Current stores information about time granularity, may be
   * cleaned up in the future.
   */
  extras?: QueryObjectExtras;

  /** SIMPLE where filters */
  filters?: QueryObjectFilterClause[];

  /** Time column for SQL */
  granularity?: string;

  /** If set, will group by timestamp */
  is_timeseries?: boolean;

  /** Should the rowcount of the query be fetched */
  is_rowcount?: boolean;

  /** Free-form HAVING SQL, multiple clauses are concatenated by AND */
  having?: string;

  post_processing?: (PostProcessingRule | undefined)[];

  /** Maximum numbers of rows to return */
  row_limit?: number;

  /** Number of rows to skip */
  row_offset?: number;

  /** The column to which direct temporal filters (forthcoming) */
  time_column?: string;

  /** The size of bucket by which to group timeseries data (forthcoming) */
  time_grain?: string;

  /** Direction to ordered by */
  order_desc?: boolean;

  url_params?: Record<string, string>;

  custom_params?: JsonObject;

  /** Free-form WHERE SQL: multiple clauses are concatenated by AND */
  where?: string;

  /** Limit number of series */
  series_columns?: QueryFormColumn[];
  series_limit?: number;
  series_limit_metric?: Maybe<QueryFormMetric>;
}

export interface QueryContext {
  datasource: {
    id: number;
    type: DatasourceType;
  };
  /** Force refresh of all queries */
  force: boolean;
  /** Type of result to return for queries */
  result_type: string;
  /** Response format */
  result_format: string;
  queries: QueryObject[];
  form_data?: QueryFormData;
}

// Keep in sync with superset/errors.py
export const ErrorTypeEnum = {
  // Frontend errors
  FRONTEND_CSRF_ERROR: 'FRONTEND_CSRF_ERROR',
  FRONTEND_NETWORK_ERROR: 'FRONTEND_NETWORK_ERROR',
  FRONTEND_TIMEOUT_ERROR: 'FRONTEND_TIMEOUT_ERROR',

  // DB Engine errors
  GENERIC_DB_ENGINE_ERROR: 'GENERIC_DB_ENGINE_ERROR',
  COLUMN_DOES_NOT_EXIST_ERROR: 'COLUMN_DOES_NOT_EXIST_ERROR',
  TABLE_DOES_NOT_EXIST_ERROR: 'TABLE_DOES_NOT_EXIST_ERROR',
  SCHEMA_DOES_NOT_EXIST_ERROR: 'SCHEMA_DOES_NOT_EXIST_ERROR',
  CONNECTION_INVALID_USERNAME_ERROR: 'CONNECTION_INVALID_USERNAME_ERROR',
  CONNECTION_INVALID_PASSWORD_ERROR: 'CONNECTION_INVALID_PASSWORD_ERROR',
  CONNECTION_INVALID_HOSTNAME_ERROR: 'CONNECTION_INVALID_HOSTNAME_ERROR',
  CONNECTION_PORT_CLOSED_ERROR: 'CONNECTION_PORT_CLOSED_ERROR',
  CONNECTION_INVALID_PORT_ERROR: 'CONNECTION_INVALID_PORT_ERROR',
  CONNECTION_HOST_DOWN_ERROR: 'CONNECTION_HOST_DOWN_ERROR',
  CONNECTION_ACCESS_DENIED_ERROR: 'CONNECTION_ACCESS_DENIED_ERROR',
  CONNECTION_UNKNOWN_DATABASE_ERROR: 'CONNECTION_UNKNOWN_DATABASE_ERROR',
  CONNECTION_DATABASE_PERMISSIONS_ERROR:
    'CONNECTION_DATABASE_PERMISSIONS_ERROR',
  CONNECTION_MISSING_PARAMETERS_ERROR: 'CONNECTION_MISSING_PARAMETERS_ERROR',
  OBJECT_DOES_NOT_EXIST_ERROR: 'OBJECT_DOES_NOT_EXIST_ERROR',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  CONNECTION_DATABASE_TIMEOUT: 'CONNECTION_DATABASE_TIMEOUT',

  // Viz errors
  VIZ_GET_DF_ERROR: 'VIZ_GET_DF_ERROR',
  UNKNOWN_DATASOURCE_TYPE_ERROR: 'UNKNOWN_DATASOURCE_TYPE_ERROR',
  FAILED_FETCHING_DATASOURCE_INFO_ERROR:
    'FAILED_FETCHING_DATASOURCE_INFO_ERROR',

  // Security access errors
  TABLE_SECURITY_ACCESS_ERROR: 'TABLE_SECURITY_ACCESS_ERROR',
  DATASOURCE_SECURITY_ACCESS_ERROR: 'DATASOURCE_SECURITY_ACCESS_ERROR',
  DATABASE_SECURITY_ACCESS_ERROR: 'DATABASE_SECURITY_ACCESS_ERROR',
  QUERY_SECURITY_ACCESS_ERROR: 'QUERY_SECURITY_ACCESS_ERROR',
  MISSING_OWNERSHIP_ERROR: 'MISSING_OWNERSHIP_ERROR',
  USER_ACTIVITY_SECURITY_ACCESS_ERROR: 'USER_ACTIVITY_SECURITY_ACCESS_ERROR',
  DASHBOARD_SECURITY_ACCESS_ERROR: 'DASHBOARD_SECURITY_ACCESS_ERROR',
  CHART_SECURITY_ACCESS_ERROR: 'CHART_SECURITY_ACCESS_ERROR',
  OAUTH2_REDIRECT: 'OAUTH2_REDIRECT',
  OAUTH2_REDIRECT_ERROR: 'OAUTH2_REDIRECT_ERROR',

  // Other errors
  BACKEND_TIMEOUT_ERROR: 'BACKEND_TIMEOUT_ERROR',
  DATABASE_NOT_FOUND_ERROR: 'DATABASE_NOT_FOUND_ERROR',

  // Sql Lab errors
  MISSING_TEMPLATE_PARAMS_ERROR: 'MISSING_TEMPLATE_PARAMS_ERROR',
  INVALID_TEMPLATE_PARAMS_ERROR: 'INVALID_TEMPLATE_PARAMS_ERROR',
  RESULTS_BACKEND_NOT_CONFIGURED_ERROR: 'RESULTS_BACKEND_NOT_CONFIGURED_ERROR',
  DML_NOT_ALLOWED_ERROR: 'DML_NOT_ALLOWED_ERROR',
  INVALID_CTAS_QUERY_ERROR: 'INVALID_CTAS_QUERY_ERROR',
  INVALID_CVAS_QUERY_ERROR: 'INVALID_CVAS_QUERY_ERROR',
  SQLLAB_TIMEOUT_ERROR: 'SQLLAB_TIMEOUT_ERROR',
  RESULTS_BACKEND_ERROR: 'RESULTS_BACKEND_ERROR',
  ASYNC_WORKERS_ERROR: 'ASYNC_WORKERS_ERROR',
  ADHOC_SUBQUERY_NOT_ALLOWED_ERROR: 'ADHOC_SUBQUERY_NOT_ALLOWED_ERROR',
  INVALID_SQL_ERROR: 'INVALID_SQL_ERROR',

  // Generic errors
  GENERIC_COMMAND_ERROR: 'GENERIC_COMMAND_ERROR',
  GENERIC_BACKEND_ERROR: 'GENERIC_BACKEND_ERROR',

  // API errors
  INVALID_PAYLOAD_FORMAT_ERROR: 'INVALID_PAYLOAD_FORMAT_ERROR',
  INVALID_PAYLOAD_SCHEMA_ERROR: 'INVALID_PAYLOAD_SCHEMA_ERROR',
  MARSHMALLOW_ERROR: 'MARSHMALLOW_ERROR',

  // Report errors
  REPORT_NOTIFICATION_ERROR: 'REPORT_NOTIFICATION_ERROR',
} as const;

type ValueOf<T> = T[keyof T];

export type ErrorType = ValueOf<typeof ErrorTypeEnum>;

// Keep in sync with superset/errors.py
export type ErrorLevel = 'info' | 'warning' | 'error';

export type ErrorSource = 'dashboard' | 'explore' | 'sqllab' | 'crud';

export type SupersetError<ExtraType = Record<string, any> | null> = {
  error_type: ErrorType;
  extra: ExtraType;
  level: ErrorLevel;
  message: string;
};

export const CtasEnum = {
  TABLE: 'TABLE',
  VIEW: 'VIEW',
};

export type QueryColumn = {
  name?: string;
  column_name: string;
  type: string | null;
  type_generic: GenericDataType;
  is_dttm: boolean;
};

// Possible states of a query object for processing on the server
export enum QueryState {
  Started = 'started',
  Stopped = 'stopped',
  Failed = 'failed',
  Pending = 'pending',
  Running = 'running',
  Scheduled = 'scheduled',
  Success = 'success',
  Fetching = 'fetching',
  TimedOut = 'timed_out',
}

// Indicates a Query's state is still processing
export const runningQueryStateList: QueryState[] = [
  QueryState.Running,
  QueryState.Started,
  QueryState.Pending,
  QueryState.Fetching,
  QueryState.Scheduled,
];

// Indicates a Query's state has completed processing regardless of success / failure
export const concludedQueryStateList: QueryState[] = [
  QueryState.Stopped,
  QueryState.Failed,
  QueryState.Success,
  QueryState.TimedOut,
];

export type Query = {
  cached: boolean;
  ctas: boolean;
  ctas_method?: keyof typeof CtasEnum;
  dbId: number;
  errors?: SupersetError[];
  errorMessage: string | null;
  extra: {
    progress: string | null;
    errors?: SupersetError[];
  };
  id: string;
  isDataPreview: boolean;
  link?: string;
  progress: number;
  resultsKey: string | null;
  catalog?: string | null;
  schema?: string;
  sql: string;
  sqlEditorId: string;
  state: QueryState;
  tab: string | null;
  tempSchema: string | null;
  tempTable: string;
  trackingUrl: string | null;
  templateParams: any;
  rows: number;
  queryLimit: number;
  limitingFactor: string;
  endDttm: number;
  duration: string;
  startDttm: number;
  time: Record<string, any>;
  user: Record<string, any>;
  userId: number;
  db: Record<string, any>;
  started: string;
  querylink: Record<string, any>;
  queryId: number;
  executedSql: string;
  output: string | Record<string, any>;
  actions: Record<string, any>;
  type: DatasourceType;
  columns: QueryColumn[];
  runAsync?: boolean;
};

export type QueryResults = {
  results: {
    displayLimitReached: boolean;
    columns: QueryColumn[];
    data: Record<string, unknown>[];
    expanded_columns: QueryColumn[];
    selected_columns: QueryColumn[];
    query: { limit: number };
    query_id?: number;
  };
};

export type QueryResponse = Query & QueryResults;

// todo: move out from typing
export const testQuery: Query = {
  id: 'clientId2353',
  dbId: 1,
  sql: 'SELECT * FROM something',
  sqlEditorId: 'dfsadfs',
  tab: 'unimportant',
  tempTable: '',
  ctas: false,
  cached: false,
  errorMessage: null,
  extra: { progress: null },
  isDataPreview: false,
  progress: 0,
  resultsKey: null,
  state: QueryState.Success,
  tempSchema: null,
  trackingUrl: null,
  templateParams: null,
  rows: 42,
  queryLimit: 100,
  limitingFactor: '',
  endDttm: 1476910579693,
  duration: '',
  startDttm: 1476910566092.96,
  time: {},
  user: {},
  userId: 1,
  db: {},
  started: '',
  querylink: {},
  queryId: 1,
  executedSql: '',
  output: '',
  actions: {},
  type: DatasourceType.Query,
  columns: [
    {
      column_name: 'Column 1',
      type: 'STRING',
      is_dttm: false,
      type_generic: GenericDataType.String,
    },
    {
      column_name: 'Column 3',
      type: 'STRING',
      is_dttm: false,
      type_generic: GenericDataType.String,
    },
    {
      column_name: 'Column 2',
      type: 'TIMESTAMP',
      is_dttm: true,
      type_generic: GenericDataType.Temporal,
    },
  ],
};

export const testQueryResults = {
  results: {
    displayLimitReached: false,
    columns: [
      {
        column_name: 'Column 1',
        type: 'STRING',
        type_generic: GenericDataType.String,
        is_dttm: false,
      },
      {
        column_name: 'Column 3',
        type: 'STRING',
        type_generic: GenericDataType.String,
        is_dttm: false,
      },
      {
        column_name: 'Column 2',
        type: 'TIMESTAMP',
        type_generic: GenericDataType.Temporal,
        is_dttm: true,
      },
    ],
    data: [
      { 'Column 1': 'a', 'Column 2': 'b', 'Column 3': '2014-11-11T00:00:00' },
    ],
    expanded_columns: [],
    selected_columns: [
      {
        column_name: 'Column 1',
        type: 'STRING',
        type_generic: GenericDataType.String,
        is_dttm: false,
      },
      {
        column_name: 'Column 3',
        type: 'STRING',
        type_generic: GenericDataType.String,
        is_dttm: false,
      },
      {
        column_name: 'Column 2',
        type: 'TIMESTAMP',
        type_generic: GenericDataType.Temporal,
        is_dttm: true,
      },
    ],
    query: { limit: 6 },
  },
};

export const testQueryResponse = { ...testQuery, ...testQueryResults };

export enum ContributionType {
  Row = 'row',
  Column = 'column',
}

export type DatasourceSamplesQuery = {
  filters?: QueryObjectFilterClause[];
};

export default {};
