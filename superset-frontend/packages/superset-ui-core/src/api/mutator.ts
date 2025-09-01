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

import rison from 'rison';
import SupersetClient from '../connection/SupersetClient';

interface CustomRequestConfig extends RequestInit {
  url: string;
  params?: Record<string, any>;
  data?: any;
  responseType?: 'blob' | 'text' | 'json';
}

/**
 * Get the application root path from SupersetClient configuration
 * This ensures compatibility with existing URL prefix handling
 */
function getAppRoot(): string {
  // For most Superset deployments, the appRoot is empty (root deployment)
  // If Superset is deployed under a subpath, it would be configured in SupersetClient
  // For now, assume root deployment to match existing SupersetClient behavior
  return '';
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

  // Handle query parameters using rison encoding (Superset standard)
  if (config.params) {
    const cleanParams: Record<string, any> = {};
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        cleanParams[key] = value;
      }
    });

    if (Object.keys(cleanParams).length > 0) {
      const risonQuery = rison.encode_uri(cleanParams);
      fullUrl += `${fullUrl.includes('?') ? '&' : '?'}q=${risonQuery}`;
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

  // Return parsed response based on responseType or content-type
  if (config.responseType === 'blob') {
    return response.blob() as T;
  }

  if (config.responseType === 'text') {
    return response.text() as T;
  }

  // Default JSON handling
  const contentType = response.headers.get('content-type');
  if (
    contentType?.includes('application/json') ||
    config.responseType === 'json'
  ) {
    return response.json();
  }

  return response.text() as T;
};

export default customInstance;
