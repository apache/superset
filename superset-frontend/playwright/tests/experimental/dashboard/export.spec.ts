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

import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../../pages/DashboardPage';
import { Toast } from '../../../components/core';
import { TIMEOUT } from '../../../utils/constants';

/**
 * Dashboard Export E2E tests.
 *
 * These tests verify the Download menu export functionality:
 * - Export YAML (standard export)
 * - Export as Example (new Parquet + YAML format)
 *
 * Prerequisites:
 * - Superset running with example dashboards loaded
 * - Admin user authenticated (via global-setup)
 */

let dashboardPage: DashboardPage;
const downloads: { delete: () => Promise<void> }[] = [];

test.describe('Dashboard Export', () => {
  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);

    // Navigate to World Health dashboard (standard example)
    await dashboardPage.gotoBySlug('world_health');
    await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });
    // Wait for charts to finish loading - Download menu may be disabled while loading
    await dashboardPage.waitForChartsToLoad();
  });

  test.afterEach(async () => {
    // Clean up downloaded files
    await Promise.all(downloads.map(d => d.delete().catch(() => {})));
    downloads.length = 0;
  });

  test('should download ZIP and show success toast when clicking Export YAML', async ({
    page,
  }) => {
    const toast = new Toast(page);
    const download = await dashboardPage.selectDownloadOption('Export YAML');
    downloads.push(download);

    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    await expect(toast.getSuccess()).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });
  });

  test('should download example bundle and show success toast when clicking Export as Example', async ({
    page,
  }) => {
    const toast = new Toast(page);
    const download =
      await dashboardPage.selectDownloadOption('Export as Example');
    downloads.push(download);

    expect(download.suggestedFilename()).toMatch(/_example\.zip$/);
    await expect(toast.getSuccess()).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });
  });
});
