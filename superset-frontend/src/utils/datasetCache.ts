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

import { supersetGetCache } from './cachedSupersetGet';

/**
 * Clear all cached API responses for a specific dataset.
 * This ensures that any subsequent API calls will fetch fresh data from the server.
 *
 * @param datasetId - The ID of the dataset to clear from cache
 */
export function clearDatasetCache(datasetId: number | string): void {
  if (!datasetId) return;

  const keysToDelete: string[] = [];

  // Find all cache keys related to this dataset
  supersetGetCache.forEach((_value, key) => {
    // Match any endpoint that references this dataset ID
    // This includes:
    // - /api/v1/dataset/{id}
    // - /api/v1/dataset/{id}?q=...
    // - /api/v1/dataset/{id}/related_objects
    // - etc.
    if (
      key.includes(`/api/v1/dataset/${datasetId}`) ||
      key.includes(`/api/v1/dataset/${datasetId}/`) ||
      key.includes(`/api/v1/dataset/${datasetId}?`)
    ) {
      keysToDelete.push(key);
    }
  });

  // Delete all matching keys
  keysToDelete.forEach(key => {
    supersetGetCache.delete(key);
  });
}

/**
 * Clear the entire dataset cache.
 * Use this when you need to ensure all dataset data is refreshed.
 */
export function clearAllDatasetCache(): void {
  const keysToDelete: string[] = [];

  supersetGetCache.forEach((_value, key) => {
    if (key.includes('/api/v1/dataset/')) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => supersetGetCache.delete(key));
}
