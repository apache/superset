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
 * If `path` is null or undefined, it falls back to the application root so the
 * caller (e.g. partial theme overrides leaving brand tokens unset) doesn't
 * crash.
 *
 * @param path A string path or URL to a resource
 */
export function ensureAppRoot(path: string | null | undefined): string {
  if (path && (SAFE_ABSOLUTE_URL_RE.test(path) || path.startsWith('//'))) {
    return path;
  }
  if (path == null) {
    return applicationRoot() || '/';
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
 * Prefixes a router-relative path with the application root, unconditionally.
 *
 * Unlike `ensureAppRoot`, this does not skip paths that already start with the
 * application root. That guard is only safe for paths that may already have been
 * prefixed; it misfires on genuine routes that happen to collide with the root.
 * With an application root of `/superset`, `ensureAppRoot('/superset/dashboard/1/')`
 * returns the path unchanged, silently producing a broken link.
 *
 * Use this for paths that are known to be router-relative and never pre-prefixed
 * — e.g. the `url` fields the backend emits (`/superset/dashboard/{id}/`,
 * `/explore/?slice_id={id}`) and literal route strings in components. It matches
 * what `<Link to={url}>` renders via the router's `basename`.
 *
 * Absolute URLs with safe schemes and protocol-relative URLs are returned
 * unchanged.
 *
 * @param path A router-relative path, or an absolute URL to pass through
 */
export function prefixAppRoot(path: string | null | undefined): string {
  if (path && (SAFE_ABSOLUTE_URL_RE.test(path) || path.startsWith('//'))) {
    return path;
  }
  if (path == null) {
    return applicationRoot() || '/';
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${applicationRoot()}${normalizedPath}`;
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
