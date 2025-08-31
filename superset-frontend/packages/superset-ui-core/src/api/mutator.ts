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
 * Custom fetch instance for orval-generated API client
 *
 * Handles:
 * 1. URL prefixing (appRoot from backend configuration)
 * 2. CSRF token injection (compatibility with SupersetClient)
 * 3. Error handling and response processing
 * 4. Authentication flow integration
 */

import SupersetClient from '../connection/SupersetClient';

interface CustomRequestConfig extends RequestInit {
  url: string;
  params?: Record<string, any>;
  data?: any;
}

/**
 * Get the application root path from current SupersetClient configuration
 * This ensures compatibility with existing URL prefix handling
 */
function getAppRoot(): string {
  // Access the singleton SupersetClient's appRoot configuration
  try {
    // SupersetClient stores appRoot internally, we need to extract it
    // For now, use the same logic as SupersetClient.getUrl()
    const currentUrl = new URL(window.location.href);
    const pathSegments = currentUrl.pathname.split('/');

    // Common Superset deployment patterns:
    // - Root: / (appRoot = '')
    // - Subpath: /superset (appRoot = '/superset')
    // - Custom: /analytics (appRoot = '/analytics')

    // Extract from current path or use empty string for root deployment
    return pathSegments.length > 1 && pathSegments[1]
      ? `/${pathSegments[1]}`
      : '';
  } catch {
    // Fallback to empty string (root deployment)
    return '';
  }
}

/**
 * Custom fetch instance that integrates with SupersetClient infrastructure
 */
export const customInstance = async <T>(
  config: CustomRequestConfig,
): Promise<T> => {
  const appRoot = getAppRoot();

  // Build full URL with proper prefix handling
  const baseURL = `${window.location.origin}${appRoot}`;
  let fullUrl = config.url.startsWith('http')
    ? config.url
    : `${baseURL}${config.url}`;

  // Handle query parameters
  if (config.params) {
    const searchParams = new URLSearchParams();
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `${fullUrl.includes('?') ? '&' : '?'}${queryString}`;
    }
  }

  // Ensure authentication - reuse SupersetClient's auth handling
  await SupersetClient.init();

  // Get CSRF token from SupersetClient for write operations
  const needsCSRF = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    config.method?.toUpperCase() || 'GET',
  );

  const headers: HeadersInit = {
    Accept: 'application/json',
    ...config.headers,
  };

  if (needsCSRF) {
    const csrfToken = await SupersetClient.getCSRFToken();
    if (csrfToken) {
      (headers as Record<string, string>)['X-CSRFToken'] = csrfToken;
    }
  }

  // Prepare request body
  let { body } = config;
  if (config.data && !body) {
    body = JSON.stringify(config.data);
  }

  // Execute request with SupersetClient-compatible configuration
  const response = await fetch(fullUrl, {
    ...config,
    body,
    headers,
    credentials: 'same-origin', // Match SupersetClient behavior
  });

  // Handle authentication errors like SupersetClient
  if (response.status === 401) {
    // Trigger SupersetClient's unauthorized handler
    try {
      await SupersetClient.reAuthenticate();
    } catch {
      // Let SupersetClient handle the redirect/login flow
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Return parsed response
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text() as T;
};

export default customInstance;
