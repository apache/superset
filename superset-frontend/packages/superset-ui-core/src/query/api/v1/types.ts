/* eslint-disable camelcase */
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
import {
  SupersetClientClass,
  SupersetClientInterface,
  StrictJsonObject,
  JsonValue,
  JsonObject,
} from '../../../connection';

export type ParsedResponseType<T> = T extends 'text'
  ? string
  : T extends 'raw' | null
  ? Response
  : JsonValue;

/**
 * Runtime options when calling a Superset API. Currently only allow overriding
 * SupersetClient instance.
 */
export interface SupersetApiRequestOptions {
  client?: SupersetClientInterface | SupersetClientClass;
}

/**
 * Superset API error types.
 * Ref: https://github.com/apache/incubator-superset/blob/318e5347bc6f88119725775baa4ab9a398a6f0b0/superset/errors.py#L24
 *
 * TODO: migrate superset-frontend/src/components/ErrorMessage/types.ts over
 */
export enum SupersetApiErrorType {
  // Generic unknown error
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  // Frontend errors
  FRONTEND_CSRF_ERROR = 'FRONTEND_CSRF_ERROR',
  FRONTEND_NETWORK_ERROR = 'FRONTEND_NETWORK_ERROR',
  FRONTEND_TIMEOUT_ERROR = 'FRONTEND_TIMEOUT_ERROR',

  // DB Engine errors,
  GENERIC_DB_ENGINE_ERROR = 'GENERIC_DB_ENGINE_ERROR',

  // Viz errors,
  VIZ_GET_DF_ERROR = 'VIZ_GET_DF_ERROR',
  UNKNOWN_DATASOURCE_TYPE_ERROR = 'UNKNOWN_DATASOURCE_TYPE_ERROR',
  FAILED_FETCHING_DATASOURCE_INFO_ERROR = 'FAILED_FETCHING_DATASOURCE_INFO_ERROR',

  // Security access errors,
  TABLE_SECURITY_ACCESS_ERROR = 'TABLE_SECURITY_ACCESS_ERROR',
  DATASOURCE_SECURITY_ACCESS_ERROR = 'DATASOURCE_SECURITY_ACCESS_ERROR',
  MISSING_OWNERSHIP_ERROR = 'MISSING_OWNERSHIP_ERROR',
}

/**
 * API Error json response from the backend (or fetch API in the frontend).
 * See SIP-40 and SIP-41: https://github.com/apache/incubator-superset/issues/9298
 */
export interface SupersetApiErrorPayload {
  message?: string; // error message via FlaskAppBuilder, e.g. `response_404(message=...)`
  error_type?: SupersetApiErrorType;
  level?: 'error' | 'warn' | 'info';
  extra?: StrictJsonObject;
  /**
   * Error message returned via `json_error_response`.
   * Ref https://github.com/apache/incubator-superset/blob/8e23d4f369f35724b34b14def8a5a8bafb1d2ecb/superset/views/base.py#L94
   */
  error?: string | SupersetApiErrorPayload;
  link?: string;
}

export interface SupersetApiMultiErrorsPayload {
  errors: SupersetApiErrorPayload[];
}

export class SupersetApiError extends Error {
  status?: number;

  statusText?: string;

  errorType: SupersetApiErrorType;

  extra: JsonObject;

  originalError?: Error | Response | JsonValue;

  constructor({
    status,
    statusText,
    message,
    link,
    extra,
    stack,
    error_type: errorType,
    originalError,
  }: Omit<SupersetApiErrorPayload, 'error'> & {
    status?: number;
    statusText?: string;
    message: string;
    stack?: Error['stack'];
    // original JavaScript error or backend JSON response captured
    originalError?: SupersetApiError['originalError'];
  }) {
    super(message);
    const originalErrorStack =
      stack ||
      (originalError instanceof Error ? originalError.stack : undefined);
    this.stack =
      originalErrorStack && this.stack
        ? [
            this.stack.split('\n')[0],
            ...originalErrorStack.split('\n').slice(1),
          ].join('\n')
        : this.stack;
    this.name = 'SupersetApiError';
    this.errorType = errorType || SupersetApiErrorType.UNKNOWN_ERROR;
    this.extra = extra || {};
    if (link) {
      this.extra.link = link;
    }
    this.status = status;
    this.statusText = statusText;
    this.originalError = originalError;
  }
}
