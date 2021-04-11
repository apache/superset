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
  TEST_CONNECTION_PORT_CLOSED_ERROR: 'TEST_CONNECTION_PORT_CLOSED_ERROR',
  TEST_CONNECTION_HOST_DOWN_ERROR: 'TEST_CONNECTION_HOST_DOWN_ERROR',

  // Viz errors
  VIZ_GET_DF_ERROR: 'VIZ_GET_DF_ERROR',
  UNKNOWN_DATASOURCE_TYPE_ERROR: 'UNKNOWN_DATASOURCE_TYPE_ERROR',
  FAILED_FETCHING_DATASOURCE_INFO_ERROR:
    'FAILED_FETCHING_DATASOURCE_INFO_ERROR',

  // Security access errors
  TABLE_SECURITY_ACCESS_ERROR: 'TABLE_SECURITY_ACCESS_ERROR',
  DATASOURCE_SECURITY_ACCESS_ERROR: 'DATASOURCE_SECURITY_ACCESS_ERROR',
  DATABASE_SECURITY_ACCESS_ERROR: 'DATABASE_SECURITY_ACCESS_ERROR',
  MISSING_OWNERSHIP_ERROR: 'MISSING_OWNERSHIP_ERROR',

  // Other errors
  BACKEND_TIMEOUT_ERROR: 'BACKEND_TIMEOUT_ERROR',

  // Sqllab error
  MISSING_TEMPLATE_PARAMS_ERROR: 'MISSING_TEMPLATE_PARAMS_ERROR',
  TEST_CONNECTION_INVALID_HOSTNAME_ERROR:
    'TEST_CONNECTION_INVALID_HOSTNAME_ERROR',

  // Generic errors
  GENERIC_COMMAND_ERROR: 'GENERIC_COMMAND_ERROR',
  GENERIC_BACKEND_ERROR: 'GENERIC_BACKEND_ERROR',
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

export type ErrorMessageComponentProps<
  ExtraType = Record<string, any> | null
> = {
  error: SupersetError<ExtraType>;
  source?: ErrorSource;
};

export type ErrorMessageComponent = React.ComponentType<ErrorMessageComponentProps>;
