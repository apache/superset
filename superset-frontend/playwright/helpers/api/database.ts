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

const ENDPOINTS = {
  DATABASE: '/api/v1/database/',
} as const;

/**
 * POST request to create a database connection
 * @param page - Playwright page instance (provides authentication context)
 * @param requestBody - Database configuration object
 * @returns API response from database creation
 */
export async function apiPostDatabase(
  page: Page,
  requestBody: object,
): Promise<APIResponse> {
  return apiPost(page, ENDPOINTS.DATABASE, requestBody);
}

/**
 * DELETE request to remove a database connection
 * @param page - Playwright page instance (provides authentication context)
 * @param databaseId - ID of the database to delete
 * @returns API response from database deletion
 */
export async function apiDeleteDatabase(
  page: Page,
  databaseId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.DATABASE}${databaseId}`, options);
}
