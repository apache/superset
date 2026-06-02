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

import { SupersetClient } from '@superset-ui/core';
import { cacheWrapper } from './cacheWrapper';

export const supersetGetCache = new Map<string, any>();

export const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  supersetGetCache,
  ({ endpoint }) => endpoint || '',
);

/**
 * Clear cached responses for dataset-related endpoints
 * @param datasetId - The ID of the dataset to clear from cache
 */
export function clearDatasetCache(datasetId: number | string): void {
  if (datasetId === null || datasetId === undefined || datasetId === '') return;

  const datasetIdStr = String(datasetId);

  supersetGetCache.forEach((_value, key) => {
    // Match exact dataset ID patterns:
    // - /api/v1/dataset/123 (exact match or end of URL)
    // - /api/v1/dataset/123/ (with trailing slash)
    // - /api/v1/dataset/123? (with query params)
    const patterns = [
      `/api/v1/dataset/${datasetIdStr}`,
      `/api/v1/dataset/${datasetIdStr}/`,
      `/api/v1/dataset/${datasetIdStr}?`,
    ];

    for (const pattern of patterns) {
      if (key.includes(pattern)) {
        // Additional check to ensure we don't match longer IDs
        const afterPattern = key.substring(
          key.indexOf(pattern) + pattern.length,
        );
        // If pattern ends with slash or query, it's already precise
        if (pattern.endsWith('/') || pattern.endsWith('?')) {
          supersetGetCache.delete(key);
          break;
        }
        // For the base pattern, ensure nothing follows or only valid separators
        if (
          afterPattern === '' ||
          afterPattern.startsWith('/') ||
          afterPattern.startsWith('?')
        ) {
          supersetGetCache.delete(key);
          break;
        }
      }
    }
  });
}

/**
 * Clear all cached dataset responses
 */
export function clearAllDatasetCache(): void {
  supersetGetCache.forEach((_value, key) => {
    if (key.includes('/api/v1/dataset/')) {
      supersetGetCache.delete(key);
    }
  });
}
