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

import type { Page, Response, Route, APIResponse } from '@playwright/test';

/**
 * HTTP methods enum for consistency
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

/**
 * Options for waitFor* functions
 */
interface WaitForResponseOptions {
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Match against URL pathname suffix instead of full URL includes (default: false) */
  pathMatch?: boolean;
}

/**
 * Normalize a path by removing trailing slashes
 */
function normalizePath(path: string): string {
  return path.replace(/\/+$/, '');
}

/**
 * Check if a URL matches a pattern
 * - String + pathMatch: pathname.endsWith(pattern) with trailing slash normalization
 * - String: url.includes(pattern)
 * - RegExp: pattern.test(url)
 */
function matchUrl(
  url: string,
  pattern: string | RegExp,
  pathMatch?: boolean,
): boolean {
  if (typeof pattern === 'string') {
    if (pathMatch) {
      const pathname = normalizePath(new URL(url).pathname);
      const normalizedPattern = normalizePath(pattern);
      return pathname.endsWith(normalizedPattern);
    }
    return url.includes(pattern);
  }
  return pattern.test(url);
}

/**
 * Generic helper to wait for a response matching URL pattern and HTTP method
 */
function waitForResponse(
  page: Page,
  urlPattern: string | RegExp,
  method: HttpMethod,
  options?: WaitForResponseOptions,
): Promise<Response> {
  const { pathMatch, ...waitOptions } = options ?? {};
  return page.waitForResponse(
    response =>
      matchUrl(response.url(), urlPattern, pathMatch) &&
      response.request().method() === method,
    waitOptions,
  );
}

/**
 * Wait for a GET response matching the URL pattern
 */
export function waitForGet(
  page: Page,
  urlPattern: string | RegExp,
  options?: WaitForResponseOptions,
): Promise<Response> {
  return waitForResponse(page, urlPattern, HTTP_METHODS.GET, options);
}

/**
 * Intercept the next GET request matching the URL pattern and resolve with
 * the response Playwright itself fetched, after handing an identical
 * response through to the page unmodified via `route.fulfill()`.
 *
 * Unlike `waitForGet`, which only observes the response the browser already
 * received, this fetches it independently via Playwright's own HTTP client,
 * so the returned response's `.body()` doesn't race the page's own
 * consumption of that same response (e.g. a resource-export endpoint that
 * the app reads via `fetch().then(r => r.blob())` to trigger a client-side
 * download). Use this instead of `waitForGet` whenever the body bytes
 * themselves need to be asserted on, not just headers/status.
 */
export function interceptGet(
  page: Page,
  urlPattern: string | RegExp,
  options?: WaitForResponseOptions,
): Promise<APIResponse> {
  const { pathMatch, timeout } = options ?? {};
  const predicate = (url: URL) =>
    matchUrl(url.toString(), urlPattern, pathMatch);
  return new Promise<APIResponse>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handler = async (route: Route) => {
      if (route.request().method() !== HTTP_METHODS.GET) {
        await route.fallback();
        return;
      }
      if (timer) clearTimeout(timer);
      page.unroute(predicate, handler).catch(() => {});
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };
    page.route(predicate, handler);
    if (timeout) {
      timer = setTimeout(() => {
        page.unroute(predicate, handler).catch(() => {});
        reject(
          new Error(
            `interceptGet timed out after ${timeout}ms waiting for a GET matching ${urlPattern}`,
          ),
        );
      }, timeout);
    }
  });
}

/**
 * Wait for a POST response matching the URL pattern
 */
export function waitForPost(
  page: Page,
  urlPattern: string | RegExp,
  options?: WaitForResponseOptions,
): Promise<Response> {
  return waitForResponse(page, urlPattern, HTTP_METHODS.POST, options);
}

/**
 * Wait for a PUT response matching the URL pattern
 */
export function waitForPut(
  page: Page,
  urlPattern: string | RegExp,
  options?: WaitForResponseOptions,
): Promise<Response> {
  return waitForResponse(page, urlPattern, HTTP_METHODS.PUT, options);
}

/**
 * Wait for a DELETE response matching the URL pattern
 */
export function waitForDelete(
  page: Page,
  urlPattern: string | RegExp,
  options?: WaitForResponseOptions,
): Promise<Response> {
  return waitForResponse(page, urlPattern, HTTP_METHODS.DELETE, options);
}

/**
 * Wait for a PATCH response matching the URL pattern
 */
export function waitForPatch(
  page: Page,
  urlPattern: string | RegExp,
  options?: WaitForResponseOptions,
): Promise<Response> {
  return waitForResponse(page, urlPattern, HTTP_METHODS.PATCH, options);
}
