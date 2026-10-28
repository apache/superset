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
 * @fileoverview Talking to Superset's REST API from an extension.
 *
 * Deliberately small. An extension needs to reach Superset's API with the
 * session and the CSRF token the host already holds, and nothing more: the
 * host owns the transport, so an extension never fetches a CSRF token, never
 * decides where the API lives, and is not exposed to how any of that is
 * implemented.
 *
 * The endpoint is a path under this Superset, so the host applies the
 * application root. An absolute URL is not accepted -- this is the API
 * client, not a general-purpose fetch, and an extension reaching another
 * origin should say so plainly with `fetch`.
 */

/** A parsed response from Superset's API. */
export interface HttpResponse<T = unknown> {
  /** The parsed JSON body. */
  json: T;
  /** The HTTP status code. */
  status: number;
  /** The response headers. */
  headers: Headers;
}

/** What to ask for. */
export interface HttpRequest {
  /**
   * Path under this Superset, beginning with `/`, such as
   * `/api/v1/chart/`. The application root is added by the host.
   */
  endpoint: string;
  /** Serialized as a JSON body. Ignored by `get`. */
  jsonPayload?: unknown;
  /** Appended to the endpoint as a query string. */
  searchParams?: Record<string, string | number | boolean> | URLSearchParams;
  /** Added to the request. The host supplies CSRF and content type. */
  headers?: Record<string, string>;
  /** Aborts the request when signalled. */
  signal?: AbortSignal;
  /** Milliseconds to wait before giving up. */
  timeout?: number;
}

/**
 * Reads from Superset's API.
 *
 * @example
 * ```typescript
 * const { json } = await http.get<{ result: Chart[] }>({
 *   endpoint: '/api/v1/chart/',
 * });
 * ```
 */
export declare function get<T = unknown>(
  request: HttpRequest,
): Promise<HttpResponse<T>>;

/**
 * Creates through Superset's API. The CSRF token is attached by the host.
 *
 * @example
 * ```typescript
 * await http.post({
 *   endpoint: '/api/v1/chart/',
 *   jsonPayload: { slice_name: 'New chart' },
 * });
 * ```
 */
export declare function post<T = unknown>(
  request: HttpRequest,
): Promise<HttpResponse<T>>;

/** Updates through Superset's API. The CSRF token is attached by the host. */
export declare function put<T = unknown>(
  request: HttpRequest,
): Promise<HttpResponse<T>>;

/** Deletes through Superset's API. The CSRF token is attached by the host. */
declare function del<T = unknown>(
  request: HttpRequest,
): Promise<HttpResponse<T>>;

// `delete` is a reserved word, so the declaration is named and then exported
// under the name callers actually use: `http.delete(...)`.
export { del as delete };
