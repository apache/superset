/*
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

import { HTTP_STATUS_ACCEPTED } from './constants';
import { JsonObject, JsonResponse } from './types';

/**
 * A write that the server accepted without applying.
 *
 * `202 Accepted` means the request was understood and accepted, but has not
 * been acted on: the entity the caller asked to change is unchanged, and the
 * body carries no updated copy of it. A deployment produces one whenever a
 * write is queued, proxied for approval, or held for any other reason the
 * client is not expected to understand.
 *
 * This matters because `Response.ok` is true for 202, so a success handler
 * that only checks `ok` will treat the write as applied: it will read a
 * `result` that is not there, sync local state from a change that did not
 * happen, and tell the author their edit is live when viewers cannot see it.
 * Every write path therefore has to ask whether it was given a result or an
 * acknowledgement.
 *
 * The body is the server's to shape, with two conventions: `deferred: true`,
 * which is what says this response is one of these, and an optional
 * `message` holding a sentence to show the author, since only the server
 * knows why the write was held.
 */
export interface DeferredWriteBody extends JsonObject {
  /**
   * Marks this response as a write the server accepted without applying.
   *
   * Required, because the status code alone cannot say it. Superset already
   * answers `202` for ordinary asynchronous work -- `sync_permissions`,
   * global async chart data, dashboard screenshots, thumbnails, async SQL
   * Lab -- and none of those held anything: the work is running, and the
   * caller will have its result. Treating those as deferred writes would
   * tell an author their edit is awaiting someone when it is not, and would
   * read an unrelated `id` out of the body as the reference to it.
   */
  deferred: true;
  /** A sentence to show the author, explaining what became of their write. */
  message?: string;
}

/**
 * Whether a successful write response was an acknowledgement, not a result.
 *
 * Pass the `{ json, response }` pair a `SupersetClient` write resolves to, or
 * the `Response` itself. Both halves have to hold: the status is `202`, and
 * the body says `deferred: true`.
 *
 * The status alone is not enough. Superset answers `202` for ordinary
 * asynchronous work as well -- `sync_permissions`, global async chart data,
 * dashboard screenshots, thumbnails, async SQL Lab -- and in each of those
 * the work is running and its result is coming. Only the server that held a
 * write knows it held one, so only the server can say so.
 *
 * @example
 * ```typescript
 * const result = await SupersetClient.put({ endpoint, jsonPayload });
 * if (isDeferredWrite(result)) {
 *   // Nothing changed. Do not apply `result.json` as an update.
 *   return;
 * }
 * ```
 */
export function isDeferredWrite(
  result: JsonResponse | Response | { response?: Response } | unknown,
): boolean {
  if (!result || typeof result !== 'object') {
    return false;
  }
  const { status, response } = result as {
    status?: unknown;
    response?: { status?: unknown };
  };
  // A `Response` carries the status itself; the `{ json, response }` pair a
  // client write resolves to carries it one level down. Accepting both means
  // the host's write handlers -- which are loosely typed, and often see the
  // pair as a bare object -- need no casts to ask the question.
  const code = typeof status === 'number' ? status : response?.status;
  if (code !== HTTP_STATUS_ACCEPTED) {
    return false;
  }
  // The same two shapes again: a parsed body under `json`, or the object
  // itself where a caller already unwrapped it. A bare `Response` has no
  // parsed body here and so cannot carry the marker -- which is right, since
  // a write held without a word about why is not one a client can report.
  const body = (result as { json?: unknown }).json ?? result;
  return (
    !!body &&
    typeof body === 'object' &&
    (body as { deferred?: unknown }).deferred === true
  );
}

/**
 * The sentence a deferred write wants shown, or the caller's fallback.
 *
 * Only the server knows why a write was held, so its own wording is preferred
 * over anything the client could guess. The fallback covers a server that
 * deferred without saying why.
 */
export function deferredWriteMessage(
  body: JsonObject | undefined | null,
  fallback: string,
): string {
  const message = (body as DeferredWriteBody | undefined)?.message;
  return typeof message === 'string' && message ? message : fallback;
}
