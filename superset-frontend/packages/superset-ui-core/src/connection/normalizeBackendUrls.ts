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
 * Strips the configured application root from a single backend-supplied URL
 * string so the frontend speaks router-relative paths. Apply it at the few call
 * sites that surface a router-relative URL from an API response (e.g. a
 * dataset's `explore_url`) before handing the value to a consumer that
 * re-prefixes the root — `SupersetClient.getUrl`, `makeUrl`, or a react-router
 * `<Link>` resolving against the Router `basename`. Without it those consumers
 * would re-prefix an already-rooted path into `/superset/superset/...`.
 *
 * Absolute (`https:`, `ftp:`, `mailto:`, `tel:`) and protocol-relative (`//`)
 * URLs pass through untouched, so an operator-configured external
 * `default_endpoint` on a dataset is left alone.
 */

export interface NormalizeOptions {
  /** Application root to strip. Empty string disables normalisation. */
  applicationRoot: string;
}

const SAFE_ABSOLUTE_URL_RE = /^(?:https?|ftp|mailto|tel):/i;

function stripTrailingSlash(root: string): string {
  return root.endsWith('/') ? root.slice(0, -1) : root;
}

/** Normalise a single router-relative URL string. */
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
