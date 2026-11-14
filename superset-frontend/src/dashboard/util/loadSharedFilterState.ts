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
import { logging } from '@apache-superset/core/utils';

// Upper bound on a single attempt to load shared filter state. Generous
// enough for a slow but healthy metastore read; the retry restarts from zero.
export const SHARED_STATE_ATTEMPT_TIMEOUT_MS = 6000;
export const SHARED_STATE_MAX_ATTEMPTS = 2;
export const SHARED_STATE_RETRY_DELAY_MS = 500;

export type SharedStateResult<T> =
  | { status: 'ok'; value: T }
  // The key no longer exists (404) or its stored value cannot be read;
  // retrying cannot help.
  | { status: 'expired' }
  // Every attempt timed out or errored.
  | { status: 'failed' }
  // The caller aborted (unmount, navigation); nothing should be applied.
  | { status: 'cancelled' };

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Loads shared filter state with a bounded per-attempt timeout and a quiet
 * retry. Aborting `signal` ends the load without retrying or logging.
 */
export async function loadSharedFilterState<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<SharedStateResult<T>> {
  let timedOut = false;
  for (let attempt = 1; attempt <= SHARED_STATE_MAX_ATTEMPTS; attempt += 1) {
    if (signal.aborted) return { status: 'cancelled' };
    const controller = new AbortController();
    const abortAttempt = () => controller.abort();
    signal.addEventListener('abort', abortAttempt, { once: true });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attemptTimedOut = false;
    const timeout = new Promise<'timeout'>(resolve => {
      timeoutId = setTimeout(() => {
        attemptTimedOut = true;
        controller.abort();
        resolve('timeout');
      }, SHARED_STATE_ATTEMPT_TIMEOUT_MS);
    });
    try {
      // eslint-disable-next-line no-await-in-loop
      const outcome = await Promise.race([
        fetcher(controller.signal).then(value => ({ value })),
        timeout,
      ]);
      if (signal.aborted) return { status: 'cancelled' };
      if (outcome !== 'timeout') return { status: 'ok', value: outcome.value };
    } catch (err) {
      if (signal.aborted) return { status: 'cancelled' };
      if (
        (err as { status?: number })?.status === 404 ||
        // The stored value is not valid JSON: it will never load.
        err instanceof SyntaxError
      ) {
        return { status: 'expired' };
      }
    } finally {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', abortAttempt);
    }
    timedOut = timedOut || attemptTimedOut;
    if (attempt < SHARED_STATE_MAX_ATTEMPTS) {
      // eslint-disable-next-line no-await-in-loop
      await wait(SHARED_STATE_RETRY_DELAY_MS, signal);
    }
  }
  if (signal.aborted) return { status: 'cancelled' };
  if (timedOut) {
    logging.warn(
      `Shared filter state did not load within ${SHARED_STATE_ATTEMPT_TIMEOUT_MS}ms; loading the dashboard without it.`,
    );
  }
  return { status: 'failed' };
}
