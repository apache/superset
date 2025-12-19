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
import rison from 'rison';
import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import {
  ClientErrorObject,
  getClientErrorObject,
  SupersetClient,
  ParseMethod,
  SupersetClientResponse,
  JsonValue,
  RequestBase,
} from '@superset-ui/core';

export type { JsonResponse, TextResponse } from '@superset-ui/core';

export const supersetClientQuery: BaseQueryFn<
  Pick<RequestBase, 'method' | 'body' | 'jsonPayload' | 'postPayload'> & {
    endpoint: string;
    parseMethod?: ParseMethod;
    transformResponse?: (response: SupersetClientResponse) => JsonValue;
    urlParams?: Record<string, number | string | undefined | boolean | object>;
  },
  JsonValue,
  ClientErrorObject
> = (
  {
    endpoint,
    urlParams,
    transformResponse,
    method = 'GET',
    parseMethod = 'json',
    ...rest
  },
  api,
) =>
  SupersetClient.request({
    ...rest,
    endpoint: `${endpoint}${urlParams ? `?q=${rison.encode(urlParams)}` : ''}`,
    method,
    parseMethod,
    signal: api.signal,
  })
    .then(data => ({
      data: transformResponse?.(data) ?? data,
    }))
    .catch(response =>
      getClientErrorObject(response).then(errorObj => ({
        error: {
          error: errorObj?.message || errorObj?.error || response.statusText,
          errors: errorObj?.errors || [], // used by <ErrorMessageWithStackTrace />
          status: response.status,
        },
      })),
    );

export const api = createApi({
  reducerPath: 'queryApi',
  tagTypes: [
    'Catalogs',
    'Schemas',
    'Tables',
    'DatabaseFunctions',
    'QueryValidations',
    'TableMetadatas',
    'SqlLabInitialState',
    'EditorQueries',
  ],
  endpoints: () => ({}),
  baseQuery: supersetClientQuery,
});
