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
import { SupersetClientResponse } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';
import COMMON_ERR_MESSAGES from './errorMessages';

// The response always contains an error attribute, can contain anything from the
// SupersetClientResponse object, and can contain a spread JSON blob
export type ClientErrorObject = {
  error: string;
  severity?: string;
  message?: string;
  stacktrace?: string;
} & Partial<SupersetClientResponse>;

export default function getClientErrorObject(
  response: SupersetClientResponse | string,
): Promise<ClientErrorObject> {
  // takes a SupersetClientResponse as input, attempts to read response as Json if possible,
  // and returns a Promise that resolves to a plain object with error key and text value.
  return new Promise(resolve => {
    if (typeof response === 'string') {
      resolve({ error: response });
    } else {
      const responseObject =
        response instanceof Response ? response : response.response;
      if (responseObject && !responseObject.bodyUsed) {
        // attempt to read the body as json, and fallback to text. we must clone the
        // response in order to fallback to .text() because Response is single-read
        responseObject
          .clone()
          .json()
          .then(errorJson => {
            let error = { ...responseObject, ...errorJson };
            if (error.stack) {
              error = {
                ...error,
                error:
                  t('Unexpected error: ') +
                  (error.description ||
                    t('(no description, click to see stack trace)')),
                stacktrace: error.stack,
              };
            } else if (
              error.responseText &&
              error.responseText.indexOf('CSRF') >= 0
            ) {
              error = {
                ...error,
                error: t(COMMON_ERR_MESSAGES.SESSION_TIMED_OUT),
              };
            }
            resolve(error);
          })
          .catch(() => {
            // fall back to reading as text
            responseObject.text().then(errorText => {
              resolve({ ...responseObject, error: errorText });
            });
          });
      } else {
        // fall back to Response.statusText or generic error of we cannot read the response
        const error =
          'statusText' in response
            ? response.statusText
            : t('An error occurred');
        resolve({
          ...responseObject,
          error,
        });
      }
    }
  });
}
