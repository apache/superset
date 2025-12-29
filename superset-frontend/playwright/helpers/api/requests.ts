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

import { Page, APIResponse } from '@playwright/test';

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  failOnStatusCode?: boolean;
  allowMissingCsrf?: boolean;
}

/**
 * Get base URL for Referer header
 * Reads from environment variable configured in playwright.config.ts
 * Preserves full base URL including path prefix (e.g., /app/prefix/)
 * Normalizes to always end with '/' for consistent URL resolution
 */
function getBaseUrl(): string {
  // Use environment variable which includes path prefix if configured
  // Normalize to always end with '/' (matches playwright.config.ts normalization)
  const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
  return url.endsWith('/') ? url : `${url}/`;
}

interface CsrfResult {
  token: string;
  error?: string;
}

/**
 * Get CSRF token from the API endpoint
 * Superset provides a CSRF token via api/v1/security/csrf_token/
 * The session cookie is automatically included by page.request
 */
async function getCsrfToken(page: Page): Promise<CsrfResult> {
  try {
    const response = await page.request.get('api/v1/security/csrf_token/', {
      failOnStatusCode: false,
    });

    if (!response.ok()) {
      return {
        token: '',
        error: `HTTP ${response.status()} ${response.statusText()}`,
      };
    }

    const json = await response.json();
    return { token: json.result || '' };
  } catch (error) {
    return { token: '', error: String(error) };
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
  const { token: csrfToken, error: csrfError } = await getCsrfToken(page);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Include CSRF token and Referer for Flask-WTF CSRFProtect
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
    headers['Referer'] = getBaseUrl();
  } else if (!options?.allowMissingCsrf) {
    const errorDetail = csrfError ? ` (${csrfError})` : '';
    throw new Error(
      `Missing CSRF token${errorDetail} - mutation requests require authentication. ` +
        'Ensure global authentication completed or test has valid session.',
    );
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
  return page.request.get(url, {
    headers: options?.headers,
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
