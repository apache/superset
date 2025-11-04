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
import { apiGet, apiDelete, apiPost } from './client';
import { TIMEOUT } from '../../utils/constants';

/**
 * Filter operators for dataset queries
 */
export interface DatasetFilter {
  eq?: string;
  sw?: string;
  // Add other operators as needed
}

/**
 * Filters for dataset list queries
 */
export interface DatasetListFilters {
  table_name?: DatasetFilter;
  database?: DatasetFilter;
  schema?: DatasetFilter;
  // Add other filterable fields as needed
}

/**
 * Dataset configuration for creation
 */
export interface DatasetConfig {
  databaseId: number; // Numeric database ID (required by API)
  schema?: string;
  table_name: string;
  dataset_name?: string;
}

/**
 * Dataset response from API
 */
export interface Dataset {
  id: number;
  table_name: string;
  database: {
    id: number;
    database_name: string;
  };
  schema?: string;
  sql?: string;
  owners?: Array<{ id: number; username: string }>;
  changed_on_delta_humanized?: string;
  explore_url?: string;
}

/**
 * Lists datasets from the Superset API.
 *
 * @param context - API request context
 * @param page - Playwright page object
 * @param filters - Optional filters (e.g., { table_name: { sw: 'test_' } })
 * @returns Array of datasets
 */
export async function listDatasets(
  context: APIRequestContext,
  page: Page,
  filters?: DatasetListFilters,
): Promise<Dataset[]> {
  const params: Record<string, string> = {};

  if (filters) {
    params.q = JSON.stringify({ filters });
  }

  const response = await apiGet(context, page, 'api/v1/dataset/', params);

  if (!response.ok()) {
    throw new Error(
      `Failed to list datasets: ${response.status()} ${await response.text()}`,
    );
  }

  const data = await response.json();
  return data.result || [];
}

/**
 * Deletes a dataset by ID.
 *
 * @param context - API request context
 * @param page - Playwright page object
 * @param datasetId - Dataset ID to delete
 * @returns true if deletion was successful
 */
export async function deleteDataset(
  context: APIRequestContext,
  page: Page,
  datasetId: number,
): Promise<boolean> {
  const response = await apiDelete(
    context,
    page,
    `api/v1/dataset/${datasetId}`,
  );

  if (!response.ok()) {
    const text = await response.text();
    console.warn(
      `Failed to delete dataset ${datasetId}: ${response.status()} ${text}`,
    );
    return false;
  }

  return true;
}

/**
 * Deletes a dataset by name (table_name).
 * Finds the dataset by name first, then deletes it.
 *
 * @param context - API request context
 * @param page - Playwright page object
 * @param datasetName - Dataset name to delete
 * @returns true if deletion was successful
 */
export async function deleteDatasetByName(
  context: APIRequestContext,
  page: Page,
  datasetName: string,
): Promise<boolean> {
  const datasets = await listDatasets(context, page, {
    table_name: { eq: datasetName },
  });

  if (datasets.length === 0) {
    console.log(`Dataset '${datasetName}' not found, skipping deletion`);
    return true; // Not found is considered successful cleanup
  }

  // Delete all matching datasets (in case of duplicates)
  const deletePromises = datasets.map(dataset =>
    deleteDataset(context, page, dataset.id),
  );

  const results = await Promise.all(deletePromises);
  return results.every(result => result);
}

/**
 * Cleans up test datasets matching a pattern.
 * Useful for beforeEach hooks to ensure clean state.
 *
 * @param context - API request context
 * @param page - Playwright page object
 * @param pattern - SQL LIKE pattern (e.g., 'test_dataset_%')
 * @returns Number of datasets deleted
 */
export async function cleanTestDatasets(
  context: APIRequestContext,
  page: Page,
  pattern: string,
): Promise<number> {
  // Convert SQL LIKE pattern to filter
  // Pattern 'test_dataset_%' becomes starts with 'test_dataset_'
  const prefix = pattern.replace(/%$/, '');

  const datasets = await listDatasets(context, page, {
    table_name: { sw: prefix }, // 'sw' = starts with
  });

  if (datasets.length === 0) {
    return 0;
  }

  console.log(
    `Cleaning ${datasets.length} test dataset(s) matching '${pattern}'`,
  );

  const deletePromises = datasets.map(dataset =>
    deleteDataset(context, page, dataset.id),
  );

  const results = await Promise.all(deletePromises);
  const successCount = results.filter(result => result).length;

  console.log(
    `Successfully cleaned ${successCount}/${datasets.length} test datasets`,
  );

  return successCount;
}

/**
 * Creates a new dataset.
 *
 * @param context - API request context
 * @param page - Playwright page object
 * @param config - Dataset configuration
 * @returns Created dataset ID
 */
export async function createDataset(
  context: APIRequestContext,
  page: Page,
  config: DatasetConfig,
): Promise<number> {
  const payload = {
    database: config.databaseId, // Numeric ID (required by API)
    schema: config.schema,
    table_name: config.table_name,
    dataset_name: config.dataset_name || config.table_name,
  };

  const response = await apiPost(context, page, 'api/v1/dataset/', payload);

  if (!response.ok()) {
    throw new Error(
      `Failed to create dataset: ${response.status()} ${await response.text()}`,
    );
  }

  const data = await response.json();
  return data.id;
}

/**
 * Waits for a dataset to appear in the list with the given name.
 * Useful after creation operations to ensure backend processing is complete.
 *
 * @param context - API request context
 * @param page - Playwright page object
 * @param datasetName - Dataset name to wait for
 * @param options - Wait options
 * @returns true if dataset found
 */
export async function waitForDataset(
  context: APIRequestContext,
  page: Page,
  datasetName: string,
  options?: { timeout?: number; interval?: number },
): Promise<boolean> {
  const timeout = options?.timeout || TIMEOUT.API_POLL_TIMEOUT;
  const interval = options?.interval || TIMEOUT.API_POLL_INTERVAL;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const datasets = await listDatasets(context, page, {
      table_name: { eq: datasetName },
    });

    if (datasets.length > 0) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}
