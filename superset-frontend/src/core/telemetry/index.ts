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
 * @fileoverview Host implementation of the `telemetry` contribution type.
 *
 * Extensions get their own bound instance from `ExtensionsLoader`, so the id
 * on every event is the host's word rather than the caller's. Events are
 * dispatched onto the store the logger middleware is attached to, which gives
 * them the same batching, transport and source attribution as the host's own.
 */

import type { telemetry as telemetryApi } from '@apache-superset/core';
import { logEvent } from 'src/logger/actions';
import { store } from 'src/views/store';

/** Anything outside this is replaced, so the name space stays bounded. */
const DISALLOWED = /[^a-z0-9_]+/g;
const MAX_NAME_LENGTH = 64;
/** Beyond this an event is describing content rather than dimensions. */
const MAX_KEYS = 32;
const MAX_VALUE_LENGTH = 256;
/**
 * Admission control. `DebouncedMessageQueue` caps how many events ride in one
 * request but has no rate limit, so an extension reporting from a render loop
 * would otherwise hammer `/log/`.
 */
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 60;

const sanitize = (value: string): string =>
  value
    .toLowerCase()
    .replace(DISALLOWED, '_')
    .replace(/^_+|_+$/g, '');

/** Scalars survive; anything else is dropped rather than stringified. */
const scalar = (
  value: unknown,
): string | number | boolean | null | undefined => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, MAX_VALUE_LENGTH);
  return undefined;
};

const clean = (
  data: telemetryApi.TelemetryEventData,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(data)
      .slice(0, MAX_KEYS)
      .map(([key, value]) => [sanitize(key), scalar(value)] as const)
      .filter(([key, value]) => key !== '' && value !== undefined),
  );

/**
 * Builds the `telemetry` namespace for one extension.
 *
 * Each caller gets its own instance so the extension id cannot be supplied,
 * omitted or spoofed by the extension, and so the rate limit is per extension
 * rather than shared -- one noisy extension cannot silence another.
 */
export function createTelemetry(extensionId: string): typeof telemetryApi {
  const prefix = sanitize(extensionId) || 'extension';
  let windowStarted = 0;
  let seen = 0;
  let warned = false;

  const allowed = (): boolean => {
    const now = Date.now();
    if (now - windowStarted > WINDOW_MS) {
      windowStarted = now;
      seen = 0;
      warned = false;
    }
    seen += 1;
    if (seen <= MAX_PER_WINDOW) return true;
    if (!warned) {
      warned = true;
      // Once per window: a dropped event must not become its own flood.
      // eslint-disable-next-line no-console
      console.warn(
        `Telemetry from "${extensionId}" is rate limited; events are being dropped.`,
      );
    }
    return false;
  };

  return {
    logEvent(name: string, data: telemetryApi.TelemetryEventData = {}): void {
      try {
        const suffix = sanitize(String(name)).slice(0, MAX_NAME_LENGTH);
        if (!suffix || !allowed()) return;
        store.dispatch(
          logEvent(`ext_${prefix}_${suffix}`, {
            ...clean(data),
            extension_id: extensionId,
          }) as never,
        );
      } catch {
        // Best-effort by contract: reporting never breaks the caller.
      }
    },
  };
}

/**
 * The fallback binding, for anything reaching `window.superset` directly
 * rather than through an extension's own scoped copy of the API.
 */
export const telemetry: typeof telemetryApi = createTelemetry('host');
