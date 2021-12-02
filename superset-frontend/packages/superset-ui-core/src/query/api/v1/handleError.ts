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
  SupersetApiError,
  SupersetApiErrorPayload,
  SupersetApiMultiErrorsPayload,
} from './types';

export type ErrorInput = string | Error | Response | SupersetApiErrorPayload;

/**
 * Handle API request errors, convert to consistent Superset API error.
 * @param error the catched error from SupersetClient.request(...)
 */
export default async function handleError(error: ErrorInput): Promise<never> {
  // already a Sueprset error
  if (error instanceof SupersetApiError) {
    throw error;
  }
  // string is the error message itself
  if (typeof error === 'string') {
    throw new SupersetApiError({ message: error });
  }
  // JS errors, normally happens before request was sent
  if (error instanceof Error) {
    throw new SupersetApiError({
      message: error.message || 'Unknown Error',
      originalError: error,
    });
  }

  let errorJson;
  let originalError;
  let errorMessage = 'Unknown Error';
  let status: number | undefined;
  let statusText: string | undefined;

  // catch HTTP errors
  if (error instanceof Response) {
    const { status: responseStatus, statusText: responseStatusText } = error;
    status = responseStatus;
    statusText = responseStatusText;
    errorMessage = `${status} ${statusText}`;
    try {
      errorJson = (await error.json()) as
        | SupersetApiErrorPayload
        | SupersetApiMultiErrorsPayload;
      originalError = errorJson;
    } catch (error_) {
      originalError = error;
    }
  } else if (error) {
    errorJson = error;
  }

  // when API returns 200 but operation fails (see Python API json_error_response(...))
  // or when frontend promise rejects with `{ error: ... }`
  if (
    errorJson &&
    ('error' in errorJson || 'message' in errorJson || 'errors' in errorJson)
  ) {
    let err;
    if ('errors' in errorJson) {
      err = errorJson.errors?.[0] || {};
    } else if (typeof errorJson.error === 'object') {
      err = errorJson.error;
    } else {
      err = errorJson;
    }
    errorMessage =
      err.message ||
      (err.error as string | undefined) ||
      err.error_type ||
      errorMessage;
    throw new SupersetApiError({
      status,
      statusText,
      message: errorMessage,
      originalError,
      ...err,
    });
  }
  // all unknown error
  throw new SupersetApiError({
    status,
    statusText,
    message: errorMessage,
    originalError: error,
  });
}
