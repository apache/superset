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
import type { AnyRouter } from '@tanstack/react-router';

/**
 * Prefix an app-relative href with the router's basepath.
 *
 * react-router's history.push prepended the basename automatically;
 * TanStack's router.history is the raw browser history, so call sites
 * that push raw hrefs (kept raw to preserve pre-encoded query strings,
 * e.g. rison) must add the prefix themselves. No-ops when the href is
 * already prefixed, so backend-built URLs that include the application
 * root pass through unchanged.
 */
export function appHref(router: AnyRouter, href: string): string {
  const base = (router.basepath ?? '').replace(/\/+$/, '');
  if (!base || base === '/') return href;
  return href === base || href.startsWith(`${base}/`) ? href : `${base}${href}`;
}

/** Push a raw app-relative href through the router's history. */
export function pushAppHref(
  router: AnyRouter,
  href: string,
  state?: unknown,
): void {
  if (state === undefined) {
    router.history.push(appHref(router, href));
  } else {
    router.history.push(appHref(router, href), state as never);
  }
}

/** Replace the current location with a raw app-relative href. */
export function replaceAppHref(
  router: AnyRouter,
  href: string,
  state?: unknown,
): void {
  if (state === undefined) {
    router.history.replace(appHref(router, href));
  } else {
    router.history.replace(appHref(router, href), state as never);
  }
}
