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
import { apiGet, apiDelete, ApiRequestOptions } from './requests';

const ENDPOINTS = {
  SAVED_QUERY: 'api/v1/saved_query/',
} as const;

/**
 * GET request to fetch a saved query's details
 */
export async function apiGetSavedQuery(
  page: Page,
  savedQueryId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiGet(page, `${ENDPOINTS.SAVED_QUERY}${savedQueryId}`, options);
}

/**
 * DELETE request to remove a saved query
 */
export async function apiDeleteSavedQuery(
  page: Page,
  savedQueryId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.SAVED_QUERY}${savedQueryId}`, options);
}
