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
import { applicationRoot } from 'src/utils/getBootstrapData';

/**
 * Matches safe URI schemes that should pass through without an application root
 * prefix. Only well-known schemes are allowed; unknown or dangerous schemes
 * (e.g. javascript:, data:) are treated as relative paths and prefixed.
 */
const SAFE_ABSOLUTE_URL_RE = /^(https?|ftp|mailto|tel):/i;

/**
 * Takes a string path to a resource and prefixes it with the application root
 * defined in the application configuration.
 *
 * Absolute URLs with safe schemes (e.g. https://..., ftp://..., mailto:...,
 * tel:...) and protocol-relative URLs (e.g. //example.com) are returned
 * unchanged — only relative paths receive the application root prefix.
 * Potentially dangerous schemes such as javascript: and data: are not treated
 * as absolute and will be prefixed.
 *
 * Protocol-relative detection is backslash-aware: browsers normalise the
 * leading `\` of `/\evil.com`, `\/evil.com`, `\\evil.com` etc. into `//` in
 * the special-scheme authority, so these inputs are cross-origin navigations
 * masquerading as router-relative paths. Returning them unchanged lets the
 * downstream navigation guard reject them (see
 * `navigationUtils.assertSafeNavigationUrl`).
 *
 * If `path` is null or undefined, it falls back to the application root so the
 * caller (e.g. partial theme overrides leaving brand tokens unset) doesn't
 * crash.
 *
 * @param path A string path or URL to a resource
 */
const PROTOCOL_RELATIVE_LIKE_RE = /^[/\\][/\\]/;

export function ensureAppRoot(path: string | null | undefined): string {
  if (path == null) {
    return applicationRoot() || '/';
  }
  if (SAFE_ABSOLUTE_URL_RE.test(path) || PROTOCOL_RELATIVE_LIKE_RE.test(path)) {
    return path;
  }
  const root = applicationRoot();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (
    root &&
    (normalizedPath === root || normalizedPath.startsWith(`${root}/`))
  ) {
    return normalizedPath;
  }
  return `${root}${normalizedPath}`;
}

/**
 * Creates a URL suitable for navigation, API calls, or file downloads. Relative
 * paths are prefixed with the application root for subdirectory deployments.
 * Absolute URLs (e.g. https://...) and protocol-relative URLs (e.g. //example.com)
 * are returned unchanged.
 *
 * @param path - The path or URL to resolve (e.g., '/sqllab', 'https://example.com')
 * @returns The resolved URL (e.g., '/superset/sqllab' or 'https://example.com')
 *
 * @example
 * // In a subdirectory deployment at /superset
 * makeUrl('/sqllab?new=true')          // returns '/superset/sqllab?new=true'
 * makeUrl('https://external.example.com') // returns 'https://external.example.com'
 */
export function makeUrl(path: string): string {
  return ensureAppRoot(path);
}

/**
 * Returns the path with a leading application-root segment removed. Useful when
 * handing an already-rooted path to a consumer that re-prepends the root —
 * e.g. react-router-dom's Link resolves its `to` prop against the Router's
 * `basename`, so passing an already-rooted path would result in a doubled
 * prefix in the rendered anchor href.
 *
 * Idempotent: stripping a path that does not start with the application root
 * returns it unchanged. Absolute URLs and protocol-relative URLs pass through.
 *
 * @param path - The path to strip
 * @returns The path without a leading application-root segment
 */
export function stripAppRoot(path: string): string {
  if (SAFE_ABSOLUTE_URL_RE.test(path) || path.startsWith('//')) {
    return path;
  }
  const root = applicationRoot();
  if (!root) return path;
  // Single-pass strip mirrors
  // `normalizeBackendUrlString` and `SupersetClientClass.getUrl` exactly. A
  // genuine `/superset/superset/<slug>` is a legitimate route under the
  // single-prefix invariant (backend emits relative URLs, frontend prefixes once),
  // not a double-prefix bug. Greedy stripping would corrupt such routes.
  if (path === root) return '/';
  if (path.startsWith(`${root}/`)) return path.slice(root.length);
  return path;
}
