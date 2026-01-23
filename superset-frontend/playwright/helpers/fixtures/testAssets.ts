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

import { test as base } from '@playwright/test';
import { apiDeleteDataset } from '../api/dataset';
import { apiDeleteDatabase } from '../api/database';

/**
 * Test asset tracker for automatic cleanup after each test.
 * Inspired by Cypress's cleanDashboards/cleanCharts pattern.
 */
export interface TestAssets {
  trackDataset(id: number): void;
  trackDatabase(id: number): void;
}

export const test = base.extend<{ testAssets: TestAssets }>({
  testAssets: async ({ page }, use) => {
    // Use Set to de-dupe IDs (same resource may be tracked multiple times)
    const datasetIds = new Set<number>();
    const databaseIds = new Set<number>();

    await use({
      trackDataset: id => datasetIds.add(id),
      trackDatabase: id => databaseIds.add(id),
    });

    // Cleanup: Delete datasets FIRST (they reference databases)
    // Then delete databases. Use failOnStatusCode: false for tolerance.
    await Promise.all(
      [...datasetIds].map(id =>
        apiDeleteDataset(page, id, { failOnStatusCode: false }).catch(error => {
          console.warn(`[testAssets] Failed to cleanup dataset ${id}:`, error);
        }),
      ),
    );
    await Promise.all(
      [...databaseIds].map(id =>
        apiDeleteDatabase(page, id, { failOnStatusCode: false }).catch(
          error => {
            console.warn(
              `[testAssets] Failed to cleanup database ${id}:`,
              error,
            );
          },
        ),
      ),
    );
  },
});

export { expect } from '@playwright/test';
