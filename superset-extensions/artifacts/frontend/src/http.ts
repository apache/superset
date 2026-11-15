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
 * @fileoverview JSON requests to Superset under the viewer's own session,
 * with the CSRF token on writes.
 */

// Known limit: paths are absolute from the site root, so a deployment under
// an application root (a subdirectory) isn't supported yet.

import { authentication } from '@apache-superset/core';

/** A failed request, with the extension's error code when it sent one. */
export class RequestError extends Error {
  readonly status: number;

  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The message of a rejection, whatever was thrown. */
export const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

export async function requestJson<T>(
  path: string,
  { method = 'GET', body, headers = {} }: RequestOptions = {},
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...headers },
  };
  if (method !== 'GET') {
    init.headers = {
      ...init.headers,
      'Content-Type': 'application/json',
      'X-CSRFToken': (await authentication.getCSRFToken()) ?? '',
    };
    init.body = JSON.stringify(body ?? {});
  }
  const response = await fetch(path, init);
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      isRecord(json) && typeof json.message === 'string'
        ? json.message
        : `${response.status} ${response.statusText}`;
    const code =
      isRecord(json) && typeof json.code === 'string' ? json.code : undefined;
    throw new RequestError(message, response.status, code);
  }
  return json as T;
}
