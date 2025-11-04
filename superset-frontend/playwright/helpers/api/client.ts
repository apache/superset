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

import { APIRequestContext, Page } from '@playwright/test';

/**
 * Gets the CSRF token from localStorage via page evaluation.
 * Required for authenticated API requests to Superset backend.
 *
 * @param page - Playwright page object (must be authenticated)
 * @returns CSRF access token string
 */
export async function getCSRFToken(page: Page): Promise<string> {
  const token = await page.evaluate(() =>
    window.localStorage.getItem('access_token'),
  );

  if (!token) {
    throw new Error(
      'CSRF token not found in localStorage. Ensure the page is authenticated.',
    );
  }

  return token;
}

/**
 * Extracts the base URL from the current page URL.
 * Falls back to PLAYWRIGHT_BASE_URL env var, then localhost.
 *
 * @param page - Playwright page object
 * @returns Base URL (e.g., 'http://localhost:8088' or 'http://superset:8088' in CI)
 */
function getBaseURL(page: Page): string {
  const currentUrl = page.url();

  // If page has navigated, extract base URL from current URL
  if (currentUrl && currentUrl !== 'about:blank') {
    const url = new URL(currentUrl);
    return `${url.protocol}//${url.host}`;
  }

  // Fallback to environment variable (used in CI) or localhost (local dev)
  return process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
}

/**
 * Makes an authenticated API request to Superset with CSRF token handling.
 * Follows the same pattern as Cypress API requests.
 *
 * @param context - Playwright API request context
 * @param page - Playwright page object (for CSRF token extraction and base URL)
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param endpoint - API endpoint path (e.g., 'api/v1/dataset/')
 * @param data - Optional request body data
 * @param options - Additional fetch options
 * @returns Response object
 */
export async function apiRequest(
  context: APIRequestContext,
  page: Page,
  method: string,
  endpoint: string,
  data?: Record<string, unknown>,
  options?: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
  },
) {
  const csrfToken = await getCSRFToken(page);
  const baseURL = getBaseURL(page);

  // Construct full URL
  const url = endpoint.startsWith('http') ? endpoint : `${baseURL}/${endpoint}`;

  // Prepare headers with CSRF token
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRFToken': csrfToken,
    Cookie: `csrf_access_token=${csrfToken}`,
    Referer: `${baseURL}/`,
    ...options?.headers,
  };

  return context.fetch(url, {
    method,
    headers,
    data: data ? JSON.stringify(data) : undefined,
    params: options?.params,
  });
}

/**
 * Helper for GET requests
 */
export async function apiGet(
  context: APIRequestContext,
  page: Page,
  endpoint: string,
  params?: Record<string, string>,
) {
  return apiRequest(context, page, 'GET', endpoint, undefined, { params });
}

/**
 * Helper for POST requests
 */
export async function apiPost(
  context: APIRequestContext,
  page: Page,
  endpoint: string,
  data?: Record<string, unknown>,
) {
  return apiRequest(context, page, 'POST', endpoint, data);
}

/**
 * Helper for PUT requests
 */
export async function apiPut(
  context: APIRequestContext,
  page: Page,
  endpoint: string,
  data?: Record<string, unknown>,
) {
  return apiRequest(context, page, 'PUT', endpoint, data);
}

/**
 * Helper for DELETE requests
 */
export async function apiDelete(
  context: APIRequestContext,
  page: Page,
  endpoint: string,
) {
  return apiRequest(context, page, 'DELETE', endpoint);
}
