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

const CACHE_TIMEOUT_KEYS = [
  'schema_cache_timeout',
  'table_cache_timeout',
  'catalog_cache_timeout',
] as const;

/**
 * Converts numeric-string cache timeouts stored in `extra.metadata_cache_timeout`
 * (e.g. `"1800"`) to integers, since the API only accepts integers. Values that
 * are not non-negative integer strings are left untouched so that genuine
 * validation errors still surface. Returns the input unchanged when nothing
 * needs normalizing or when it is not a JSON object string.
 */
export function normalizeMetadataCacheTimeouts<
  T extends string | null | undefined,
>(extra: T): T {
  if (!extra) return extra;
  let parsed: unknown;
  try {
    parsed = JSON.parse(extra);
  } catch {
    return extra;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return extra;
  }
  const extraJson = parsed as Record<string, unknown>;
  const timeouts = extraJson.metadata_cache_timeout;
  if (!timeouts || typeof timeouts !== 'object' || Array.isArray(timeouts)) {
    return extra;
  }
  const normalized: Record<string, unknown> = {
    ...(timeouts as Record<string, unknown>),
  };
  let changed = false;
  CACHE_TIMEOUT_KEYS.forEach(key => {
    const value = normalized[key];
    if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) {
      normalized[key] = Number(value);
      changed = true;
    }
  });
  if (!changed) return extra;
  return JSON.stringify({
    ...extraJson,
    metadata_cache_timeout: normalized,
  }) as T;
}
