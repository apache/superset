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

import type { Page, Response } from '@playwright/test';

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
}

/**
 * Check if a URL matches a pattern (string includes or regex)
 */
function matchUrl(url: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
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
  return page.waitForResponse(
    response =>
      matchUrl(response.url(), urlPattern) &&
      response.request().method() === method,
    options,
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
