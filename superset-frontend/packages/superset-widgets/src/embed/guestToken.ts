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

const REFRESH_MARGIN_MS = 60_000;
const FALLBACK_LIFETIME_MS = 5 * 60_000;
export const DEFAULT_GUEST_TOKEN_FETCH_TIMEOUT_MS = 30_000;

export interface GuestTokenSource {
  /** A token valid for at least the refresh margin, fetching a new one when needed. */
  get(): Promise<string>;
}

/** Epoch milliseconds the token expires at, from its `exp` claim. */
export function guestTokenExpiry(token: string): number | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const claims = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`fetchGuestToken timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Caches the host's guest token and fetches a fresh one shortly before it
 * expires. Concurrent callers share a single in-flight fetch, so a page of
 * widgets asks the host's broker once.
 */
export function createGuestTokenSource(
  fetchGuestToken: () => Promise<string>,
  timeoutMs: number = DEFAULT_GUEST_TOKEN_FETCH_TIMEOUT_MS,
): GuestTokenSource {
  let token: string | undefined;
  let expiresAt = 0;
  let pending: Promise<string> | undefined;

  return {
    get() {
      if (token && Date.now() < expiresAt - REFRESH_MARGIN_MS) {
        return Promise.resolve(token);
      }
      if (!pending) {
        pending = withTimeout(fetchGuestToken(), timeoutMs)
          .then(next => {
            token = next;
            expiresAt =
              guestTokenExpiry(next) ?? Date.now() + FALLBACK_LIFETIME_MS;
            return next;
          })
          .finally(() => {
            pending = undefined;
          });
      }
      return pending;
    },
  };
}
