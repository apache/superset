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
import { apiPost, apiDelete, ApiRequestOptions } from './requests';

export const ENDPOINTS = {
  THEME: 'api/v1/theme/',
} as const;

/**
 * TypeScript interface for theme creation API payload.
 * Both fields are required (ThemePostSchema).
 */
export interface ThemeCreatePayload {
  theme_name: string;
  json_data: string;
}

/**
 * POST request to create a theme
 * @param page - Playwright page instance (provides authentication context)
 * @param requestBody - Theme configuration object
 * @returns API response from theme creation
 */
export async function apiPostTheme(
  page: Page,
  requestBody: ThemeCreatePayload,
): Promise<APIResponse> {
  return apiPost(page, ENDPOINTS.THEME, requestBody);
}

/**
 * DELETE request to remove a theme
 * @param page - Playwright page instance (provides authentication context)
 * @param themeId - ID of the theme to delete
 * @param options - Optional request options
 * @returns API response from theme deletion
 */
export async function apiDeleteTheme(
  page: Page,
  themeId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.THEME}${themeId}`, options);
}
