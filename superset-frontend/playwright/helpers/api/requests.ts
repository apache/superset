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

import { Page, APIResponse, BrowserContext } from '@playwright/test';

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  failOnStatusCode?: boolean;
}

const API_USERNAME = process.env.PLAYWRIGHT_ADMIN_USERNAME || 'admin';
const API_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'general';
const API_AUTH_PROVIDER = process.env.PLAYWRIGHT_AUTH_PROVIDER || 'db';

const authTokenCache = new WeakMap<BrowserContext, string>();

async function getAccessToken(page: Page): Promise<string | null> {
  const context = page.context();
  const cachedToken = authTokenCache.get(context);
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const response = await page.request.post('api/v1/security/login', {
      data: {
        provider: API_AUTH_PROVIDER,
        username: API_USERNAME,
        password: API_PASSWORD,
      },
      failOnStatusCode: false,
    });

    if (!response.ok()) {
      console.warn('[API Auth] Failed to fetch access token:', response.status());
      return null;
    }

    const body = await response.json();
    if (body?.access_token) {
      authTokenCache.set(context, body.access_token);
      return body.access_token;
    }

    console.warn('[API Auth] Response missing access_token');
  } catch (error) {
    console.warn('[API Auth] Error fetching access token:', error);
  }

  return null;
}

async function buildAuthHeaders(
  page: Page,
  options?: ApiRequestOptions,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...options?.headers,
  };

  const accessToken = await getAccessToken(page);
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * Get base URL for Referer header
 * Reads from environment variable configured in playwright.config.ts
 * Preserves full base URL including path prefix (e.g., /app/prefix)
 */
function getBaseUrl(_page: Page): string {
  // Use environment variable which includes path prefix if configured
  // This matches playwright.config.ts baseURL setting exactly
  return process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
}

/**
 * Get CSRF token from the API endpoint
 * Superset provides a CSRF token via api/v1/security/csrf_token/
 * The session cookie is automatically included by page.request
 */
async function getCsrfToken(page: Page): Promise<string> {
  try {
    const response = await page.request.get('api/v1/security/csrf_token/', {
      failOnStatusCode: false,
    });

    if (!response.ok()) {
      console.warn('[CSRF] Failed to fetch CSRF token:', response.status());
      return '';
    }

    const json = await response.json();
    return json.result || '';
  } catch (error) {
    console.warn('[CSRF] Error fetching CSRF token:', error);
    return '';
  }
}

/**
 * Build headers for mutation requests (POST, PUT, PATCH, DELETE)
 * Includes CSRF token and Referer for Flask-WTF CSRFProtect
 */
async function buildHeaders(
  page: Page,
  options?: ApiRequestOptions,
): Promise<Record<string, string>> {
  const csrfToken = await getCsrfToken(page);
  const headers = await buildAuthHeaders(page, options);

  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Include CSRF token and Referer for Flask-WTF CSRFProtect
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
    headers['Referer'] = getBaseUrl(page);
  }

  return headers;
}

/**
 * Send a GET request
 * Uses page.request to automatically include browser authentication
 */
export async function apiGet(
  page: Page,
  url: string,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  const headers = await buildAuthHeaders(page, options);
  return page.request.get(url, {
    headers,
    params: options?.params,
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

/**
 * Send a POST request
 * Uses page.request to automatically include browser authentication
 */
export async function apiPost(
  page: Page,
  url: string,
  data?: unknown,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  const headers = await buildHeaders(page, options);

  return page.request.post(url, {
    data,
    headers,
    params: options?.params,
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

/**
 * Send a PUT request
 * Uses page.request to automatically include browser authentication
 */
export async function apiPut(
  page: Page,
  url: string,
  data?: unknown,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  const headers = await buildHeaders(page, options);

  return page.request.put(url, {
    data,
    headers,
    params: options?.params,
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

/**
 * Send a PATCH request
 * Uses page.request to automatically include browser authentication
 */
export async function apiPatch(
  page: Page,
  url: string,
  data?: unknown,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  const headers = await buildHeaders(page, options);

  return page.request.patch(url, {
    data,
    headers,
    params: options?.params,
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}

/**
 * Send a DELETE request
 * Uses page.request to automatically include browser authentication
 */
export async function apiDelete(
  page: Page,
  url: string,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  const headers = await buildHeaders(page, options);

  return page.request.delete(url, {
    headers,
    params: options?.params,
    failOnStatusCode: options?.failOnStatusCode ?? true,
  });
}
