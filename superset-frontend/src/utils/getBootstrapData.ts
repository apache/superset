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
import { BootstrapData } from 'src/types/bootstrapTypes';
import { DEFAULT_BOOTSTRAP_DATA } from 'src/constants';

let cachedBootstrapData: BootstrapData | null = null;

export default function getBootstrapData(): BootstrapData {
  if (cachedBootstrapData === null) {
    const appContainer = document.getElementById('app');
    const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
    cachedBootstrapData = dataBootstrap
      ? JSON.parse(dataBootstrap)
      : DEFAULT_BOOTSTRAP_DATA;
  }
  // Add a fallback to ensure the returned value is always of type BootstrapData
  return cachedBootstrapData ?? DEFAULT_BOOTSTRAP_DATA;
}

const normalizePathWithFallback = (
  path: string | undefined,
  fallback: string,
): string => (path ?? fallback).replace(/\/$/, '');

// The application root is server-rendered operator configuration, but it
// flows into URL sinks across the app (script.src in ExtensionsLoader,
// history.pushState in navigationUtils), so enforce the documented
// "/segment(/segment)*" shape at the source: a value that doesn't conform
// degrades to a root deployment rather than reaching those sinks.
// Each segment must begin with a non-dot character so a literal "." or ".."
// segment (e.g. "/app/..") is rejected — otherwise browser path normalization
// would collapse `ensureAppRoot('/foo')` → `/app/../foo` → `/foo`, silently
// defeating subdirectory containment. Dots are still allowed inside a
// segment (e.g. "/foo.bar").
//
// This guards the *literal* value only. Percent-encoded dot segments
// ("/app/%2e%2e") pass through unchanged: `%` is a permitted path-segment
// character and the regex does not decode. A browser would later normalize
// "/app/%2e%2e/foo" → "/foo", so such a value silently defeats subdirectory
// prefixing — but application_root is operator-controlled, server-rendered
// configuration (SECURITY.md trust-boundary 2), so an encoded-traversal value
// is an unsupported misconfiguration, not an attacker-reachable input. It is
// intentionally neither decoded nor rejected here; the behavior is pinned by a
// test in getBootstrapData.test.ts.
const APP_ROOT_PATH_RE = /^(?:\/[\w~%-]+(?:\.[\w~%-]+)*)*$/;

const sanitizeAppRoot = (root: string): string =>
  APP_ROOT_PATH_RE.test(root) ? root : '';

const APPLICATION_ROOT_NO_TRAILING_SLASH = sanitizeAppRoot(
  normalizePathWithFallback(
    getBootstrapData().common.application_root,
    DEFAULT_BOOTSTRAP_DATA.common.application_root,
  ),
);

const STATIC_ASSETS_PREFIX_NO_TRAILING_SLASH = normalizePathWithFallback(
  getBootstrapData().common.static_assets_prefix,
  DEFAULT_BOOTSTRAP_DATA.common.static_assets_prefix,
);

/**
 * @returns The configured application root
 */
export function applicationRoot(): string {
  return APPLICATION_ROOT_NO_TRAILING_SLASH;
}

/**
 * @returns The configured static assets prefix
 */
export function staticAssetsPrefix(): string {
  return STATIC_ASSETS_PREFIX_NO_TRAILING_SLASH;
}
