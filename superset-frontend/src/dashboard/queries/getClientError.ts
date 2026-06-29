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
  getClientErrorObject,
  parseErrorJson,
  SupersetApiError,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';

/**
 * Normalizes an unknown error (TanStack errors are typed `Error` but are really the
 * SupersetClient response) into a ClientErrorObject, centralizing the boundary cast.
 */
export const getClientErrorFromUnknown = (error: unknown) =>
  getClientErrorObject(error as Parameters<typeof getClientErrorObject>[0]);

/**
 * Human-readable reason for a failed dashboard save, for the "... were not
 * saved: %s" toasts. Permission and availability failures get a fixed message;
 * anything else surfaces the server's own message when it has one.
 */
export const describeSaveFailure = (err: unknown): string => {
  const apiError = err instanceof SupersetApiError ? err : undefined;
  const status = apiError?.status;
  const original = apiError?.originalError;
  const message =
    original && typeof original === 'object' && 'message' in original
      ? typeof original.message === 'object'
        ? parseErrorJson({ message: original.message }).error
        : original.message
      : err instanceof Error
        ? err.message
        : undefined;
  if (status === 403) {
    return t('you do not have permission to edit this dashboard.');
  }
  if (status === 404) {
    return t('this dashboard is unavailable or you no longer have access.');
  }
  return typeof message === 'string' && message.trim()
    ? message
    : apiError?.statusText || t('An error occurred');
};
