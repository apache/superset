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
import type { ResolvedFilter } from '../filterVocabulary';
import type {
  DataRow,
  SavedWidget,
  WidgetDataClient,
  WidgetRef,
} from '../types';

export interface ApiFetchOptions {
  /** Origin (and optional path prefix) of the Superset deployment. */
  supersetDomain: string;
  /** Omit to call with the browser's own Superset session instead. */
  getGuestToken?: () => Promise<string>;
  guestTokenHeaderName?: string;
}

export type HttpWidgetClientOptions = ApiFetchOptions;

/** Calls a Superset JSON API and unwraps its `result`. */
export type ApiFetch = <T>(path: string, init?: RequestInit) => Promise<T>;

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      errors?: { message?: string }[];
    };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.errors)) {
      return body.errors.map(error => error.message).join('; ');
    }
  } catch {
    // Not JSON; fall back to the status text.
  }
  return response.statusText;
}

const selectorOf = (widget: WidgetRef) =>
  'id' in widget
    ? { id: widget.id }
    : { widget: { type: widget.type, props: widget.props } };

export function createApiFetch({
  supersetDomain,
  getGuestToken,
  guestTokenHeaderName = 'X-GuestToken',
}: ApiFetchOptions): ApiFetch {
  const base = supersetDomain.replace(/\/+$/, '');

  return async function call<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = getGuestToken ? await getGuestToken() : undefined;
    const response = await fetch(`${base}${path}`, {
      ...init,
      mode: 'cors',
      credentials: token ? 'omit' : 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { [guestTokenHeaderName]: token } : {}),
      },
    });
    if (!response.ok) {
      // Without a guest token the viewer's Superset session is the credential,
      // so an auth failure means "sign in", not a broken embed.
      if (!token && response.status === 401) {
        throw new Error(`Sign in to Superset at ${base} to see this widget.`);
      }
      if (!token && response.status === 403) {
        throw new Error('Your Superset account cannot access this data.');
      }
      throw new Error(`${response.status}: ${await responseMessage(response)}`);
    }
    const body = (await response.json()) as { result: T };
    return body.result;
  };
}

/**
 * Talks to Superset's widget API with `fetch` rather than the app-wide
 * `SupersetClient` singleton, so several providers (and several Superset
 * deployments) can live on one page.
 */
export function createHttpWidgetClient(
  options: HttpWidgetClientOptions,
): WidgetDataClient {
  const call = createApiFetch(options);

  return {
    async fetchData({ widget, filters }) {
      const result = await call<{ columns?: string[]; rows?: DataRow[] }>(
        '/api/v1/widget/data',
        {
          method: 'POST',
          body: JSON.stringify({
            ...selectorOf(widget),
            filters: filters.map(
              ({ column, operator, value }: ResolvedFilter) => ({
                column,
                operator,
                value,
              }),
            ),
          }),
        },
      );
      return { columns: result.columns ?? [], rows: result.rows ?? [] };
    },
    fetchValues: ({ widget }) =>
      call<unknown[]>('/api/v1/widget/values', {
        method: 'POST',
        body: JSON.stringify(selectorOf(widget)),
      }),
    getSavedWidget: id =>
      call<SavedWidget>(`/api/v1/widget/${encodeURIComponent(id)}`),
  };
}
