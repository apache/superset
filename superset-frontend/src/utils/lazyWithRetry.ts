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
import { LazyExoticComponent, lazy } from 'react';

/**
 * `React.lazy` memoizes the *rejection* of its factory: once the dynamic
 * `import()` behind a route fails (a chunk that 404s after a redeploy, or a
 * transient 502/503 from the asset server), the payload is permanently marked
 * as rejected and the component throws `ChunkLoadError` forever - even after
 * the asset becomes reachable again and even when the user navigates away and
 * back. Retrying the import *inside* the factory, before the promise handed to
 * `React.lazy` settles, is the only way to recover from a transient failure.
 *
 * See https://github.com/apache/superset/issues/41266
 */
export const DEFAULT_LAZY_RETRIES = 2;
export const DEFAULT_LAZY_RETRY_DELAY_MS = 500;

export interface LazyRetryOptions {
  /** Number of *additional* attempts made after the first one fails. */
  retries?: number;
  /** Base delay between attempts; doubled on every subsequent attempt. */
  retryDelayMs?: number;
  /**
   * Predicate deciding whether an error is worth retrying. Defaults to
   * `isChunkLoadError` so deterministic failures (syntax errors, missing
   * dependencies, module-evaluation errors) surface immediately instead of
   * being retried.
   */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Recognizes the transient "chunk failed to load" errors browsers/bundlers
 * raise on a stale or momentarily-unreachable asset, as opposed to
 * deterministic module errors (syntax errors, missing dependencies) that
 * will fail identically on every retry.
 */
export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'ChunkLoadError' ||
    /loading chunk|failed to fetch dynamically imported module/i.test(
      error.message,
    ));

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

/**
 * Calls `factory`, retrying with exponential backoff when it rejects with a
 * retryable error. Rejects with the last error once every attempt has been
 * exhausted, or immediately when the error is not retryable.
 */
export async function retryImport<T>(
  factory: () => Promise<T>,
  {
    retries = DEFAULT_LAZY_RETRIES,
    retryDelayMs = DEFAULT_LAZY_RETRY_DELAY_MS,
    isRetryable = isChunkLoadError,
  }: LazyRetryOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await factory();
    } catch (error) {
      lastError = error;
      if (attempt < retries && isRetryable(error)) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(retryDelayMs * 2 ** attempt);
      } else {
        break;
      }
    }
  }
  throw lastError;
}

/**
 * The component constraint `React.lazy` itself imposes, extracted from its own
 * signature so that call sites keep their prop types without this module having
 * to spell out an `any`.
 */
type LazyableComponent = Parameters<typeof lazy>[0] extends () => Promise<{
  default: infer C;
}>
  ? C
  : never;

/**
 * Drop-in replacement for `React.lazy` that retries the dynamic import before
 * surfacing a `ChunkLoadError` to the nearest error boundary.
 */
export function lazyWithRetry<T extends LazyableComponent>(
  factory: () => Promise<{ default: T }>,
  options?: LazyRetryOptions,
): LazyExoticComponent<T> {
  return lazy(() => retryImport(factory, options));
}

export default lazyWithRetry;
