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
 * The endpoint and the query to send with it.
 *
 * `callApi` builds the final URL by *assigning* `url.search`, so an endpoint
 * that already carries a query -- a rison `q=(...)` filter, which is how
 * Superset's API is asked for anything but the default page -- loses it the
 * moment a caller also passes `searchParams`. Where both exist they are
 * merged here instead.
 *
 * The endpoint is left exactly as written whenever nothing has to be merged
 * into it, which is the common case. Round-tripping a query through
 * `URLSearchParams` re-encodes it -- `?q=(page_size:1)` comes back out as
 * `?q=%28page_size%3A1%29` -- and while Werkzeug reads the two the same, the
 * literal URL is what `callApi` keys its ETag cache on and what shows up in
 * access logs and proxy rules. Merging changes the spelling of a URL the
 * caller wrote; it should only happen when merging is the point.
 */
const withSearchParams = (
  endpoint: string,
  searchParams: httpApi.HttpRequest['searchParams'],
): [string, URLSearchParams | undefined] => {
  const given = toSearchParams(searchParams);
  const at = endpoint.indexOf('?');
  if (!given || given.toString() === '') {
    // Nothing to add: whatever query the endpoint carries is already right,
    // character for character.
    return [endpoint, undefined];
  }
  if (at === -1) {
    return [endpoint, given];
  }
  const merged = new URLSearchParams(endpoint.slice(at + 1));
  // The params passed explicitly are the caller's last word, so a key the
  // endpoint already carries is replaced rather than repeated.
  new Set(given.keys()).forEach(key => merged.delete(key));
  given.forEach((value, key) => merged.append(key, value));
  return [endpoint.slice(0, at), merged];
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
    const [path, query] = withSearchParams(endpoint, searchParams);
    // `callApi` turns `jsonPayload` into a body for POST, PATCH and PUT
    // alone, so a payload handed to `del` would be dropped and the endpoint
    // would find nothing for `request.get_json()` to read. Only `get` is
    // documented as ignoring a payload, and a body on DELETE is a legal
    // request, so serialize it here rather than lose it quietly or narrow the
    // contract to match the omission.
    const bodyIsOurs = method === 'delete' && jsonPayload !== undefined;
    // The client sets the content type for the payload it serializes itself;
    // this body it never sees, so the type is set here. It is set *after* the
    // caller's headers rather than before: `headers` is documented as
    // "the host supplies CSRF and content type", and letting a caller's
    // `text/plain` ride on a JSON body would send something no endpoint can
    // read while the contract says otherwise.
    const sentHeaders = bodyIsOurs
      ? { ...headers, 'Content-Type': 'application/json' }
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
    let json: T | undefined;
    try {
      json = body ? (JSON.parse(body) as T) : undefined;
    } catch (cause) {
      // The same complaint as the 204, one case over: a 2xx whose body is not
      // JSON -- an HTML sign-in page served through a session that expired, a
      // proxy's error page -- otherwise threw a bare `SyntaxError` carrying
      // neither the status nor the headers that say what actually came back.
      // Re-thrown with both, and with enough of the body to recognise it.
      throw Object.assign(
        new Error(
          `The response to ${method.toUpperCase()} ${endpoint} was not JSON ` +
            `(status ${response.status}, content type ` +
            `${response.headers.get('content-type') ?? 'unset'}).`,
        ),
        {
          status: response.status,
          headers: response.headers,
          body: body.slice(0, 512),
          cause,
        },
      );
    }
    return {
      // `T | undefined`, which is what the published type says: a 204 and a
      // 200 with an empty body both have nothing to parse, and a cast to `T`
      // here would be a lie the caller cannot see.
      json,
      status: response.status,
      headers: response.headers,
    };
  };

// Checked against the published namespace rather than cast through
// `unknown`, so a return shape that drifts from `HttpResponse` is a type
// error here instead of something an extension author discovers at runtime.
export const http: typeof httpApi = {
  get: request('get'),
  post: request('post'),
  put: request('put'),
  // `del`, not `delete`: the published declaration cannot use the reserved
  // word, so the namespace is named for what authors can actually write.
  del: request('delete'),
};
