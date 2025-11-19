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
import { apiGet, apiPost, apiDelete, ApiRequestOptions } from './requests';

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
 * Get a dataset by its table name
 * @param page - Playwright page instance (provides authentication context)
 * @param tableName - The table_name to search for
 * @returns Object with id and data if found, null if not found
 */
export async function getDatasetByName(
  page: Page,
  tableName: string,
): Promise<{ id: number; data: any } | null> {
  // Use Superset's filter API to search by table_name
  const filter = {
    filters: [
      {
        col: 'table_name',
        opr: 'eq',
        value: tableName,
      },
    ],
  };
  const queryParam = encodeURIComponent(JSON.stringify(filter));
  const response = await apiGet(page, `${ENDPOINTS.DATASET}?q=${queryParam}`);

  if (!response.ok()) {
    return null;
  }

  const body = await response.json();
  if (body.result && body.result.length > 0) {
    return { id: body.result[0].id, data: body.result[0] };
  }

  return null;
}

/**
 * GET request to fetch a dataset's details
 * @param page - Playwright page instance (provides authentication context)
 * @param datasetId - ID of the dataset to fetch
 * @returns API response with dataset details
 */
export async function apiGetDataset(
  page: Page,
  datasetId: number,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiGet(page, `${ENDPOINTS.DATASET}${datasetId}`, options);
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
