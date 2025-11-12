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
  DATASET: 'api/v1/dataset/',
} as const;

/**
 * TypeScript interface for dataset creation API payload
 * Provides compile-time safety for required fields
 */
export interface DatasetCreatePayload {
  database: number;
  catalog: string | null;
  schema: string;
  table_name: string;
}

/**
 * POST request to create a dataset
 * @param page - Playwright page instance (provides authentication context)
 * @param requestBody - Dataset configuration object (database, schema, table_name)
 * @returns API response from dataset creation
 */
export async function apiPostDataset(
  page: Page,
  requestBody: DatasetCreatePayload,
): Promise<APIResponse> {
  return apiPost(page, ENDPOINTS.DATASET, requestBody);
}

/**
 * DELETE request to remove a dataset
 * @param page - Playwright page instance (provides authentication context)
 * @param datasetId - ID of the dataset to delete
 * @returns API response from dataset deletion
 */
export async function apiDeleteDataset(
  page: Page,
  datasetId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.DATASET}${datasetId}`, options);
}
