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
 * Strips the configured application root from URL fields in API responses so
 * the frontend always speaks router-relative paths. Without normalisation,
 * `SupersetClient` and `<Link>` would re-prefix backend-supplied URLs and
 * produce `/foo/foo/...`.
 */

/**
 * Field names known to be router-relative URLs to this Superset instance.
 *
 * To register a new field: confirm the backend emits a router-relative path
 * (leading `/`, no host) for it under every deployment, add the name here, and
 * add a positive strip test. If the field can ever hold an external/absolute
 * URL, leave it out and document it in `NORMALIZER_EXCLUSIONS` below instead —
 * a missed entry here leaves the field double-prefixed under subdir deployment
 * with no static signal.
 */
// `explore_url` may resolve to an operator-configured `default_endpoint`
// (`connectors/sqla/models.py`) rather than the fixed `/explore/?...` path, so
// the single-pass strip can touch a custom value whose leading segment happens
// to match the app root. That is the intended single-pass contract; absolute
// `default_endpoint`s pass through untouched via SAFE_ABSOLUTE_URL_RE.
export const NORMALIZED_URL_FIELDS = new Set<string>(['explore_url']);

/**
 * URL-shaped fields that look normalisable but are deliberately left alone
 * (external destinations, CDN hosts, OAuth endpoints, deployment-dependent
 * targets). Informational only — keep in sync with the negative tests.
 */
export const NORMALIZER_EXCLUSIONS: ReadonlyArray<{
  field: string;
  reason: string;
}> = [
  { field: 'bug_report_url', reason: 'External (GitHub)' },
  { field: 'documentation_url', reason: 'External (docs site)' },
  { field: 'external_url', reason: 'External by name' },
  { field: 'bundle_url', reason: 'CDN / static asset host' },
  { field: 'tracking_url', reason: 'External (analytics)' },
  { field: 'user_login_url', reason: 'OAuth / SSO endpoint, may be external' },
  { field: 'user_logout_url', reason: 'OAuth / SSO endpoint, may be external' },
  { field: 'user_info_url', reason: 'OAuth / SSO endpoint, may be external' },
  { field: 'thumbnail_url', reason: 'Storage host varies (S3 / local)' },
  { field: 'creator_url', reason: 'User-profile destination varies' },
];

export interface NormalizeOptions {
  /** Application root to strip. Empty string disables normalisation. */
  applicationRoot: string;
}

const SAFE_ABSOLUTE_URL_RE = /^(?:https?|ftp|mailto|tel):/i;

function stripTrailingSlash(root: string): string {
  return root.endsWith('/') ? root.slice(0, -1) : root;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  const proto = Object.getPrototypeOf(value);
  // Accept any prototype that is itself a plain object root — this is
  // cross-realm-safe (a Response.json() result in jsdom may have a different
  // `Object.prototype` instance than the test-side prototype, even though the
  // shape is identical). Reject class instances by requiring the prototype's
  // own prototype to be `null`.
  if (proto === null) return true;
  return Object.getPrototypeOf(proto) === null;
}

/** Normalise a single URL string (used directly when walking is overkill). */
export function normalizeBackendUrlString(
  value: string,
  options: NormalizeOptions,
): string {
  const root = stripTrailingSlash(options.applicationRoot);
  if (!root) return value;
  if (SAFE_ABSOLUTE_URL_RE.test(value)) return value;
  if (value.startsWith('//')) return value;
  if (value === root) return '/';
  if (value.startsWith(`${root}/`)) {
    return value.slice(root.length);
  }
  return value;
}

/**
 * Recursion depth ceiling for `walk()` (AF-6, 2026-06-01). Production
 * payloads rarely nest beyond ~10 levels (chart `form_data` → adhoc filter
 * expressions, dashboard `json_metadata` → native_filter_configuration →
 * targets). A self-referential or pathologically deep object — e.g. a
 * `json_metadata` blob authored by a buggy plugin — must not stack-overflow
 * the renderer or the response-parse worker. At the cap the walker stops
 * descending and returns the subtree unchanged.
 */
export const NORMALIZE_MAX_DEPTH = 100;

function walk(
  value: unknown,
  root: string,
  depth: number,
  visited: WeakSet<object>,
): unknown {
  if (depth >= NORMALIZE_MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    if (visited.has(value)) return value;
    visited.add(value);
    let changed = false;
    const out: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      const next = walk(item, root, depth + 1, visited);
      if (next !== item) changed = true;
      out.push(next);
    }
    return changed ? out : value;
  }

  if (isPlainObject(value)) {
    if (visited.has(value)) return value;
    visited.add(value);
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const fieldValue = value[key];
      const nextValue =
        NORMALIZED_URL_FIELDS.has(key) && typeof fieldValue === 'string'
          ? normalizeBackendUrlString(fieldValue, { applicationRoot: root })
          : walk(fieldValue, root, depth + 1, visited);
      if (nextValue !== fieldValue) changed = true;
      out[key] = nextValue;
    }
    return changed ? out : value;
  }

  return value;
}

/**
 * Recursively normalise URL fields in a JSON-shaped value. Returns the input
 * by reference when nothing changed, so callers can compare with `===`.
 */
export function normalizeBackendUrls<T>(
  value: T,
  options: NormalizeOptions,
): T {
  const root = stripTrailingSlash(options.applicationRoot);
  if (!root) return value;
  return walk(value, root, 0, new WeakSet<object>()) as T;
}
