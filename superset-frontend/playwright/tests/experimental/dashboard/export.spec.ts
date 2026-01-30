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
 *
 * SKIP REASON: Ant Design Menu submenu hover behavior is not reliably
 * triggered by Playwright. The submenu popup doesn't appear consistently
 * when hovering over the Download menu item. This functionality is
 * covered by unit tests in DownloadMenuItems.test.tsx.
 *
 * TODO: Investigate Ant Design Menu triggerSubMenuAction or alternative
 * approaches for E2E testing of nested menus.
 */

let dashboardPage: DashboardPage;

test.describe.skip('Dashboard Export', () => {
  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);

    // Navigate to World Health dashboard (standard example)
    await dashboardPage.gotoBySlug('world_health');
    await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });
  });

  test('should download ZIP when clicking Export YAML', async ({ page }) => {
    // Open the header actions menu (three-dot menu)
    await dashboardPage.openHeaderActionsMenu();

    // Open the Download submenu
    await dashboardPage.openDownloadMenu();

    // Click Export YAML and wait for download
    const download = await dashboardPage.clickExportYaml();

    // Verify the download
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.zip$/);
  });

  test('should download example bundle when clicking Export as Example', async ({
    page,
  }) => {
    // Open the header actions menu
    await dashboardPage.openHeaderActionsMenu();

    // Open the Download submenu
    await dashboardPage.openDownloadMenu();

    // Click Export as Example and wait for download
    const download = await dashboardPage.clickExportAsExample();

    // Verify the download
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/_example\.zip$/);
  });

  test('should show success toast after Export as Example', async ({
    page,
  }) => {
    // Open the header actions menu
    await dashboardPage.openHeaderActionsMenu();

    // Open the Download submenu
    await dashboardPage.openDownloadMenu();

    // Click Export as Example
    await dashboardPage.clickExportAsExample();

    // Verify success toast appears
    await expect(
      page.locator('.ant-message-success, [data-test="toast-success"]'),
    ).toBeVisible({ timeout: TIMEOUT.API_RESPONSE });
  });
});
