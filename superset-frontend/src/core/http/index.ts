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

/**
 * An endpoint split into its path and its own query string.
 *
 * The query is taken off the endpoint and merged into the search params
 * because `callApi` builds the final URL by *assigning* `url.search`: an
 * endpoint that already carries a query -- a rison `q=(...)` filter, which is
 * how Superset's API is asked for anything but the default page -- would
 * otherwise lose it the moment a caller also passed `searchParams`.
 */
const splitEndpoint = (endpoint: string): [string, string] => {
  const at = endpoint.indexOf('?');
  return at === -1
    ? [endpoint, '']
    : [endpoint.slice(0, at), endpoint.slice(at + 1)];
};

const mergeSearchParams = (
  endpointQuery: string,
  searchParams: httpApi.HttpRequest['searchParams'],
): URLSearchParams | undefined => {
  const given = toSearchParams(searchParams);
  if (!endpointQuery) {
    return given;
  }
  const merged = new URLSearchParams(endpointQuery);
  if (given) {
    // The params passed explicitly are the caller's last word, so a key the
    // endpoint already carries is replaced rather than repeated.
    new Set(given.keys()).forEach(key => merged.delete(key));
    given.forEach((value, key) => merged.append(key, value));
  }
  return merged;
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
    const [path, endpointQuery] = splitEndpoint(endpoint);
    const query = mergeSearchParams(endpointQuery, searchParams);
    // `callApi` turns `jsonPayload` into a body for POST, PATCH and PUT
    // alone, so a payload handed to `del` would be dropped and the endpoint
    // would find nothing for `request.get_json()` to read. Only `get` is
    // documented as ignoring a payload, and a body on DELETE is a legal
    // request, so serialize it here rather than lose it quietly or narrow the
    // contract to match the omission.
    const bodyIsOurs = method === 'delete' && jsonPayload !== undefined;
    // The client sets the content type for the payload it serializes itself;
    // this body it never sees. A caller's own header still wins.
    const sentHeaders = bodyIsOurs
      ? { 'Content-Type': 'application/json', ...headers }
      : headers;
    // Parsed here rather than by the client: its default `parseMethod` calls
    // `response.json()`, and a 204 -- which Werkzeug sends with no body at
    // all, and which a successful DELETE often is -- makes that throw a
    // SyntaxError carrying neither status nor headers, so a request that
    // succeeded arrives as an error with nothing to say about itself. `raw`
    // leaves the body to us; a non-2xx still rejects with the response, as
    // before.
    const response = (await SupersetClient[method]({
      endpoint: path,
      ...(jsonPayload === undefined || bodyIsOurs ? {} : { jsonPayload }),
      ...(bodyIsOurs ? { body: JSON.stringify(jsonPayload) } : {}),
      ...(query ? { searchParams: query } : {}),
      ...(sentHeaders ? { headers: sentHeaders } : {}),
      ...(signal ? { signal } : {}),
      ...(timeout === undefined ? {} : { timeout }),
      parseMethod: 'raw',
    })) as Response;

    // Trimmed before the emptiness test: a body of nothing but whitespace is
    // no more parseable than none at all.
    const body = (await response.text()).trim();
    return {
      json: body ? (JSON.parse(body) as T) : undefined,
      status: response.status,
      headers: response.headers,
    };
  };

export const http = {
  get: request('get'),
  post: request('post'),
  put: request('put'),
  // `del`, not `delete`: the published declaration cannot use the reserved
  // word, so the namespace is named for what authors can actually write.
  del: request('delete'),
} as unknown as typeof httpApi;
