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
import { apiDeleteChart } from '../api/chart';
import { apiDeleteDataset } from '../api/dataset';
import { apiDeleteDatabase } from '../api/database';

/**
 * Test asset tracker for automatic cleanup after each test.
 * Inspired by Cypress's cleanDashboards/cleanCharts pattern.
 */
export interface TestAssets {
  trackChart(id: number): void;
  trackDataset(id: number): void;
  trackDatabase(id: number): void;
}

const EXPECTED_CLEANUP_STATUSES = new Set([200, 202, 204, 404]);

export const test = base.extend<{ testAssets: TestAssets }>({
  testAssets: async ({ page }, use) => {
    // Use Set to de-dupe IDs (same resource may be tracked multiple times)
    const chartIds = new Set<number>();
    const datasetIds = new Set<number>();
    const databaseIds = new Set<number>();

    await use({
      trackChart: id => chartIds.add(id),
      trackDataset: id => datasetIds.add(id),
      trackDatabase: id => databaseIds.add(id),
    });

    // Cleanup order: charts → datasets → databases (respects FK dependencies)
    // Use failOnStatusCode: false to avoid throwing on 404 (resource already deleted by test)
    // Warn on unexpected status codes (401/403/500) that may indicate leaked state
    await Promise.all(
      [...chartIds].map(id =>
        apiDeleteChart(page, id, { failOnStatusCode: false })
          .then(response => {
            if (!EXPECTED_CLEANUP_STATUSES.has(response.status())) {
              console.warn(
                `[testAssets] Unexpected status ${response.status()} cleaning up chart ${id}`,
              );
            }
          })
          .catch(error => {
            console.warn(`[testAssets] Failed to cleanup chart ${id}:`, error);
          }),
      ),
    );
    await Promise.all(
      [...datasetIds].map(id =>
        apiDeleteDataset(page, id, { failOnStatusCode: false })
          .then(response => {
            if (!EXPECTED_CLEANUP_STATUSES.has(response.status())) {
              console.warn(
                `[testAssets] Unexpected status ${response.status()} cleaning up dataset ${id}`,
              );
            }
          })
          .catch(error => {
            console.warn(
              `[testAssets] Failed to cleanup dataset ${id}:`,
              error,
            );
          }),
      ),
    );
    await Promise.all(
      [...databaseIds].map(id =>
        apiDeleteDatabase(page, id, { failOnStatusCode: false })
          .then(response => {
            if (!EXPECTED_CLEANUP_STATUSES.has(response.status())) {
              console.warn(
                `[testAssets] Unexpected status ${response.status()} cleaning up database ${id}`,
              );
            }
          })
          .catch(error => {
            console.warn(
              `[testAssets] Failed to cleanup database ${id}:`,
              error,
            );
          }),
      ),
    );
  },
});

export { expect } from '@playwright/test';
