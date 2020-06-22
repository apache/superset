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

  // Viz errors
  VIZ_GET_DF_ERROR: 'VIZ_GET_DF_ERROR',
  UNKNOWN_DATASOURCE_TYPE_ERROR: 'UNKNOWN_DATASOURCE_TYPE_ERROR',
  FAILED_FETCHING_DATASOURCE_INFO_ERROR:
    'FAILED_FETCHING_DATASOURCE_INFO_ERROR',

  // Security access errors
  TABLE_SECURITY_ACCESS_ERROR: 'TABLE_SECURITY_ACCESS_ERROR',
  DATASOURCE_SECURITY_ACCESS_ERROR: 'DATASOURCE_SECURITY_ACCESS_ERROR',
  MISSING_OWNERSHIP_ERROR: 'MISSING_OWNERSHIP_ERROR',
} as const;

type ValueOf<T> = T[keyof T];

export type ErrorType = ValueOf<typeof ErrorTypeEnum>;

// Keep in sync with superset/views/errors.py
export type ErrorLevel = 'info' | 'warning' | 'error';

export type SupersetError = {
  error_type: ErrorType;
  extra: Record<string, any> | null;
  level: ErrorLevel;
  message: string;
};

export type ErrorMessageComponentProps = {
  error: SupersetError;
};

export type ErrorMessageComponent = React.ComponentType<
  ErrorMessageComponentProps
>;
