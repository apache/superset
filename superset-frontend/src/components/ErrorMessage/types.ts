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

// Keep in sync with superset/views/errors.py
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
  CONNECTION_MISSING_PARAMETERS_ERRORS: 'CONNECTION_MISSING_PARAMETERS_ERRORS',
  OBJECT_DOES_NOT_EXIST_ERROR: 'OBJECT_DOES_NOT_EXIST_ERROR',
  SYNTAX_ERROR: 'SYNTAX_ERROR',

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

  // Other errors
  BACKEND_TIMEOUT_ERROR: 'BACKEND_TIMEOUT_ERROR',
  DATABASE_NOT_FOUND_ERROR: 'DATABASE_NOT_FOUND_ERROR',

  // Sqllab error
  MISSING_TEMPLATE_PARAMS_ERROR: 'MISSING_TEMPLATE_PARAMS_ERROR',
  INVALID_TEMPLATE_PARAMS_ERROR: 'INVALID_TEMPLATE_PARAMS_ERROR',
  RESULTS_BACKEND_NOT_CONFIGURED_ERROR: 'RESULTS_BACKEND_NOT_CONFIGURED_ERROR',
  DML_NOT_ALLOWED_ERROR: 'DML_NOT_ALLOWED_ERROR',
  INVALID_CTAS_QUERY_ERROR: 'INVALID_CTAS_QUERY_ERROR',
  INVALID_CVAS_QUERY_ERROR: 'INVALID_CVAS_QUERY_ERROR',
  SQLLAB_TIMEOUT_ERROR: 'SQLLAB_TIMEOUT_ERROR',
  RESULTS_BACKEND_ERROR: 'RESULTS_BACKEND_ERROR',
  ASYNC_WORKERS_ERROR: 'ASYNC_WORKERS_ERROR',

  // Generic errors
  GENERIC_COMMAND_ERROR: 'GENERIC_COMMAND_ERROR',
  GENERIC_BACKEND_ERROR: 'GENERIC_BACKEND_ERROR',

  // API errors
  INVALID_PAYLOAD_FORMAT_ERROR: 'INVALID_PAYLOAD_FORMAT_ERROR',
  INVALID_PAYLOAD_SCHEMA_ERROR: 'INVALID_PAYLOAD_SCHEMA_ERROR',
} as const;

type ValueOf<T> = T[keyof T];

export type ErrorType = ValueOf<typeof ErrorTypeEnum>;

// Keep in sync with superset/views/errors.py
export type ErrorLevel = 'info' | 'warning' | 'error';

export type ErrorSource = 'dashboard' | 'explore' | 'sqllab';

export type SupersetError<ExtraType = Record<string, any> | null> = {
  error_type: ErrorType;
  extra: ExtraType;
  level: ErrorLevel;
  message: string;
};

export type ErrorMessageComponentProps<ExtraType = Record<string, any> | null> =
  {
    error: SupersetError<ExtraType>;
    source?: ErrorSource;
    subtitle?: React.ReactNode;
  };

export type ErrorMessageComponent =
  React.ComponentType<ErrorMessageComponentProps>;
