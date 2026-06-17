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

/**
 * Matches a plain absolute path prefix (e.g. "" for root deployments or
 * "/analytics" for a subdirectory). The character after the leading slash must
 * not be another slash, so protocol-relative URLs ("//host") and scheme-bearing
 * values ("javascript:...") do not qualify.
 */
const SAFE_APPLICATION_ROOT_RE = /^(\/[\w\-.][\w\-./]*)?$/;

/**
 * The application root (SUPERSET_APP_ROOT) is reflected into links and
 * navigation, so constrain it to a plain absolute path before use. Anything
 * that isn't a simple "/path" prefix falls back to the default root so a
 * malformed value can't be reinterpreted as HTML or redirect off-origin. This
 * also keeps the bootstrap-derived value from being treated as a tainted href
 * source by static analysis.
 */
const sanitizeApplicationRoot = (
  path: string | undefined,
  fallback: string,
): string => {
  const normalizedFallback = normalizePathWithFallback(fallback, fallback);
  const normalized = normalizePathWithFallback(path, fallback);
  return SAFE_APPLICATION_ROOT_RE.test(normalized)
    ? normalized
    : normalizedFallback;
};

const APPLICATION_ROOT_NO_TRAILING_SLASH = sanitizeApplicationRoot(
  getBootstrapData().common.application_root,
  DEFAULT_BOOTSTRAP_DATA.common.application_root,
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
