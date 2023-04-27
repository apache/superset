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
import { JsonObject, SupersetClientResponse, t } from '@superset-ui/core';
import {
  SupersetError,
  ErrorTypeEnum,
} from 'src/components/ErrorMessage/types';
import COMMON_ERR_MESSAGES from './errorMessages';

// The response always contains an error attribute, can contain anything from the
// SupersetClientResponse object, and can contain a spread JSON blob
export type ClientErrorObject = {
  error: string;
  errors?: SupersetError[];
  link?: string;
  message?: string;
  severity?: string;
  stacktrace?: string;
  statusText?: string;
} & Partial<SupersetClientResponse>;

// see rejectAfterTimeout.ts
interface TimeoutError {
  statusText: 'timeout';
  timeout: number;
}

type ErrorType =
  | SupersetClientResponse
  | TimeoutError
  | { response: Response }
  | string;

type ErrorTextSource = 'dashboard' | 'chart' | 'query' | 'dataset' | 'database';

export function parseErrorJson(responseObject: JsonObject): ClientErrorObject {
  let error = { ...responseObject };
  // Backwards compatibility for old error renderers with the new error object
  if (error.errors && error.errors.length > 0) {
    error.error = error.description = error.errors[0].message;
    error.link = error.errors[0]?.extra?.link;
  }
  // Marshmallow field validation returns the error message in the format
  // of { message: { field1: [msg1, msg2], field2: [msg], } }
  if (!error.error && error.message) {
    if (typeof error.message === 'object') {
      error.error =
        Object.values(error.message as Record<string, string[]>)[0]?.[0] ||
        t('Invalid input');
    }
    if (typeof error.message === 'string') {
      error.error = error.message;
    }
  }
  if (error.stack) {
    error = {
      ...error,
      error:
        t('Unexpected error: ') +
        (error.description || t('(no description, click to see stack trace)')),
      stacktrace: error.stack,
    };
  } else if (error.responseText && error.responseText.indexOf('CSRF') >= 0) {
    error = {
      ...error,
      error: t(COMMON_ERR_MESSAGES.SESSION_TIMED_OUT),
    };
  }

  return { ...error, error: error.error }; // explicit ClientErrorObject
}

/*
 * Utility to get standardized error text for generic update failures
 */
export async function getErrorText(
  errorObject: ErrorType,
  source: ErrorTextSource,
) {
  const { error, message } = await getClientErrorObject(errorObject);
  let errorText = t('Sorry, an unknown error occurred.');

  if (error) {
    errorText = t(
      'Sorry, there was an error saving this %s: %s',
      source,
      error,
    );
  }
  if (typeof message === 'string' && message === 'Forbidden') {
    errorText = t('You do not have permission to edit this %s', source);
  }
  return errorText;
}

export function getClientErrorObject(
  response:
    | SupersetClientResponse
    | TimeoutError
    | { response: Response }
    | string,
): Promise<ClientErrorObject> {
  // takes a SupersetClientResponse as input, attempts to read response as Json if possible,
  // and returns a Promise that resolves to a plain object with error key and text value.
  return new Promise(resolve => {
    if (typeof response === 'string') {
      resolve({ error: response });
      return;
    }

    if (
      response instanceof TypeError &&
      response.message === 'Failed to fetch'
    ) {
      resolve({
        error: t('Network error'),
      });
      return;
    }

    if (
      'timeout' in response &&
      'statusText' in response &&
      response.statusText === 'timeout'
    ) {
      resolve({
        ...response,
        error: t('Request timed out'),
        errors: [
          {
            error_type: ErrorTypeEnum.FRONTEND_TIMEOUT_ERROR,
            extra: {
              timeout: response.timeout / 1000,
              issue_codes: [
                {
                  code: 1000,
                  message: t('Issue 1000 - The dataset is too large to query.'),
                },
                {
                  code: 1001,
                  message: t(
                    'Issue 1001 - The database is under an unusual load.',
                  ),
                },
              ],
            },
            level: 'error',
            message: 'Request timed out',
          },
        ],
      });
      return;
    }

    const responseObject =
      response instanceof Response ? response : response.response;
    if (responseObject && !responseObject.bodyUsed) {
      // attempt to read the body as json, and fallback to text. we must clone the
      // response in order to fallback to .text() because Response is single-read
      responseObject
        .clone()
        .json()
        .then(errorJson => {
          const error = { ...responseObject, ...errorJson };
          resolve(parseErrorJson(error));
        })
        .catch(() => {
          // fall back to reading as text
          responseObject.text().then((errorText: any) => {
            resolve({ ...responseObject, error: errorText });
          });
        });
      return;
    }

    // fall back to Response.statusText or generic error of we cannot read the response
    let error = (response as any).statusText || (response as any).message;
    if (!error) {
      // eslint-disable-next-line no-console
      console.error('non-standard error:', response);
      error = t('An error occurred');
    }
    resolve({
      ...responseObject,
      error,
    });
  });
}

export function getClientErrorMessage(
  message: string,
  clientError?: ClientErrorObject,
) {
  let finalMessage = message;
  const errorMessage = clientError?.message || clientError?.error;
  if (errorMessage) {
    finalMessage = `${finalMessage}:\n${errorMessage}`;
  }
  return finalMessage;
}
