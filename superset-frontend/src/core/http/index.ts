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

/**
 * @fileoverview Host side of the `http` namespace.
 *
 * A thin adapter over `SupersetClient`, which is what actually holds the
 * session, the CSRF token and the API host. The adapter exists so that
 * contract is the only thing an extension sees: `@superset-ui/core` is a
 * large package whose whole surface would otherwise become extension API by
 * accident, and its internals move between releases while this does not.
 */

import { SupersetClient } from '@superset-ui/core';
import type { JsonResponse } from '@superset-ui/core';
import type { http as httpApi } from '@apache-superset/core';

type Verb = 'get' | 'post' | 'put' | 'delete';

const toSearchParams = (
  searchParams: httpApi.HttpRequest['searchParams'],
): URLSearchParams | undefined => {
  if (!searchParams) {
    return undefined;
  }
  if (searchParams instanceof URLSearchParams) {
    return searchParams;
  }
  return new URLSearchParams(
    Object.entries(searchParams).map(([key, value]) => [key, String(value)]),
  );
};

const request =
  (method: Verb) =>
  async <T = unknown>(
    options: httpApi.HttpRequest,
  ): Promise<httpApi.HttpResponse<T>> => {
    const { endpoint, jsonPayload, searchParams, headers, signal, timeout } =
      options;
    // `//host/path` is protocol-relative and resolves to another origin
    // while still beginning with a slash, so the second character has to be
    // checked too. Rejected rather than passed through: this call carries the
    // session and the CSRF token, and neither belongs to anyone else.
    if (!endpoint.startsWith('/') || endpoint.startsWith('//')) {
      throw new Error(
        `http.${method}: endpoint must be a path beginning with "/", got ` +
          `"${endpoint}". This is the client for this Superset's API; use ` +
          `fetch to reach another origin.`,
      );
    }
    const { json, response } = (await SupersetClient[method]({
      endpoint,
      ...(jsonPayload === undefined ? {} : { jsonPayload }),
      ...(searchParams ? { searchParams: toSearchParams(searchParams) } : {}),
      ...(headers ? { headers } : {}),
      ...(signal ? { signal } : {}),
      ...(timeout === undefined ? {} : { timeout }),
    })) as JsonResponse;

    return {
      json: json as T,
      status: response.status,
      headers: response.headers,
    };
  };

export const http = {
  get: request('get'),
  post: request('post'),
  put: request('put'),
  delete: request('delete'),
} as unknown as typeof httpApi;
