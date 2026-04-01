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

import { test as testWithAssets, expect } from '../../helpers/fixtures';
import { DashboardListPage } from '../../pages/DashboardListPage';
import {
  DeleteConfirmationModal,
  ImportDatasetModal,
} from '../../components/modals';
import { Toast } from '../../components/core';
import {
  apiGetDashboard,
  apiDeleteDashboard,
  apiExportDashboards,
  getDashboardByName,
  ENDPOINTS,
} from '../../helpers/api/dashboard';
import { createTestDashboard } from './dashboard-test-helpers';
import { waitForGet, waitForPost } from '../../helpers/api/intercepts';
import {
  expectStatusOneOf,
  expectValidExportZip,
} from '../../helpers/api/assertions';
import { TIMEOUT } from '../../utils/constants';

/**
 * Extend testWithAssets with dashboardListPage navigation (beforeEach equivalent).
 */
const test = testWithAssets.extend<{ dashboardListPage: DashboardListPage }>({
  dashboardListPage: async ({ page }, use) => {
    const dashboardListPage = new DashboardListPage(page);
    await dashboardListPage.goto();
    await dashboardListPage.waitForTableLoad();
    await use(dashboardListPage);
  },
});

test('should delete a dashboard with confirmation', async ({
  page,
  dashboardListPage,
  testAssets,
}) => {
  // Create throwaway dashboard for deletion
  const { id: dashboardId, name: dashboardName } = await createTestDashboard(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_delete' },
  );

  // Refresh to see the new dashboard (created via API)
  await dashboardListPage.goto();
  await dashboardListPage.waitForTableLoad();

  // Verify dashboard is visible in list
  await expect(dashboardListPage.getDashboardRow(dashboardName)).toBeVisible();

  // Click delete action button
  await dashboardListPage.clickDeleteAction(dashboardName);

  // Delete confirmation modal should appear
  const deleteModal = new DeleteConfirmationModal(page);
  await deleteModal.waitForVisible();

  // Type "DELETE" to confirm
  await deleteModal.fillConfirmationInput('DELETE');

  // Click the Delete button
  await deleteModal.clickDelete();

  // Modal should close
  await deleteModal.waitForHidden();

  // Verify success toast appears
  const toast = new Toast(page);
  await expect(toast.getSuccess()).toBeVisible();

  // Verify dashboard is removed from list
  await expect(
    dashboardListPage.getDashboardRow(dashboardName),
  ).not.toBeVisible();

  // Backend verification: API returns 404
  await expect
    .poll(
      async () => {
        const response = await apiGetDashboard(page, dashboardId, {
          failOnStatusCode: false,
        });
        return response.status();
      },
      { timeout: 10000, message: `Dashboard ${dashboardId} should return 404` },
    )
    .toBe(404);
});

test('should export a dashboard as a zip file', async ({
  page,
  dashboardListPage,
  testAssets,
}) => {
  // Create throwaway dashboard for export
  const { name: dashboardName } = await createTestDashboard(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_export' },
  );

  // Refresh to see the new dashboard
  await dashboardListPage.goto();
  await dashboardListPage.waitForTableLoad();

  // Verify dashboard is visible in list
  await expect(dashboardListPage.getDashboardRow(dashboardName)).toBeVisible();

  // Set up API response intercept for export endpoint
  const exportResponsePromise = waitForGet(page, ENDPOINTS.DASHBOARD_EXPORT);

  // Click export action button
  await dashboardListPage.clickExportAction(dashboardName);

  // Wait for export API response and validate zip contents
  const exportResponse = expectStatusOneOf(await exportResponsePromise, [200]);
  await expectValidExportZip(exportResponse, {
    resourceDir: 'dashboards',
    expectedNames: [dashboardName],
  });
});

test('should bulk delete multiple dashboards', async ({
  page,
  dashboardListPage,
  testAssets,
}) => {
  test.setTimeout(60_000);

  // Create 2 throwaway dashboards for bulk delete
  const [dashboard1, dashboard2] = await Promise.all([
    createTestDashboard(page, testAssets, test.info(), {
      prefix: 'bulk_delete_1',
    }),
    createTestDashboard(page, testAssets, test.info(), {
      prefix: 'bulk_delete_2',
    }),
  ]);

  // Refresh to see new dashboards
  await dashboardListPage.goto();
  await dashboardListPage.waitForTableLoad();

  // Verify both dashboards are visible in list
  await expect(
    dashboardListPage.getDashboardRow(dashboard1.name),
  ).toBeVisible();
  await expect(
    dashboardListPage.getDashboardRow(dashboard2.name),
  ).toBeVisible();

  // Enable bulk select mode
  await dashboardListPage.clickBulkSelectButton();

  // Select both dashboards
  await dashboardListPage.selectDashboardCheckbox(dashboard1.name);
  await dashboardListPage.selectDashboardCheckbox(dashboard2.name);

  // Click bulk delete action
  await dashboardListPage.clickBulkAction('Delete');

  // Delete confirmation modal should appear
  const deleteModal = new DeleteConfirmationModal(page);
  await deleteModal.waitForVisible();

  // Type "DELETE" to confirm
  await deleteModal.fillConfirmationInput('DELETE');

  // Click the Delete button
  await deleteModal.clickDelete();

  // Modal should close
  await deleteModal.waitForHidden();

  // Verify success toast appears
  const toast = new Toast(page);
  await expect(toast.getSuccess()).toBeVisible();

  // Verify both dashboards are removed from list
  await expect(
    dashboardListPage.getDashboardRow(dashboard1.name),
  ).not.toBeVisible();
  await expect(
    dashboardListPage.getDashboardRow(dashboard2.name),
  ).not.toBeVisible();

  // Backend verification: Both return 404
  for (const dashboard of [dashboard1, dashboard2]) {
    await expect
      .poll(
        async () => {
          const response = await apiGetDashboard(page, dashboard.id, {
            failOnStatusCode: false,
          });
          return response.status();
        },
        {
          timeout: 10000,
          message: `Dashboard ${dashboard.id} should return 404`,
        },
      )
      .toBe(404);
  }
});

test('should bulk export multiple dashboards', async ({
  page,
  dashboardListPage,
  testAssets,
}) => {
  // Create 2 throwaway dashboards for bulk export
  const [dashboard1, dashboard2] = await Promise.all([
    createTestDashboard(page, testAssets, test.info(), {
      prefix: 'bulk_export_1',
    }),
    createTestDashboard(page, testAssets, test.info(), {
      prefix: 'bulk_export_2',
    }),
  ]);

  // Refresh to see new dashboards
  await dashboardListPage.goto();
  await dashboardListPage.waitForTableLoad();

  // Verify both dashboards are visible in list
  await expect(
    dashboardListPage.getDashboardRow(dashboard1.name),
  ).toBeVisible();
  await expect(
    dashboardListPage.getDashboardRow(dashboard2.name),
  ).toBeVisible();

  // Enable bulk select mode
  await dashboardListPage.clickBulkSelectButton();

  // Select both dashboards
  await dashboardListPage.selectDashboardCheckbox(dashboard1.name);
  await dashboardListPage.selectDashboardCheckbox(dashboard2.name);

  // Set up API response intercept for export endpoint
  const exportResponsePromise = waitForGet(page, ENDPOINTS.DASHBOARD_EXPORT);

  // Click bulk export action
  await dashboardListPage.clickBulkAction('Export');

  // Wait for export API response and validate zip contains both dashboards
  const exportResponse = expectStatusOneOf(await exportResponsePromise, [200]);
  await expectValidExportZip(exportResponse, {
    resourceDir: 'dashboards',
    minCount: 2,
    expectedNames: [dashboard1.name, dashboard2.name],
  });
});

// Import test uses export-then-reimport approach (no static fixture needed).
// Uses test.describe only because Playwright's serial mode API requires it -
// this prevents race conditions when parallel workers import the same dashboard.
// (Deviation from "avoid describe" guideline is necessary for functional reasons)
test.describe('import dashboard', () => {
  test.describe.configure({ mode: 'serial' });
  test('should import a dashboard from a zip file', async ({
    page,
    dashboardListPage,
    testAssets,
  }) => {
    test.setTimeout(60_000);

    // Create a dashboard, export it via API, then delete it, then reimport via UI
    const { id: dashboardId, name: dashboardName } = await createTestDashboard(
      page,
      testAssets,
      test.info(),
      {
        prefix: 'test_import',
      },
    );

    // Export the dashboard via API to get a zip buffer
    const exportResponse = await apiExportDashboards(page, [dashboardId]);
    expect(exportResponse.ok()).toBe(true);
    const exportBuffer = await exportResponse.body();

    // Delete the dashboard so reimport creates it fresh
    await apiDeleteDashboard(page, dashboardId);

    // Verify it's gone
    await expect
      .poll(
        async () => {
          const response = await apiGetDashboard(page, dashboardId, {
            failOnStatusCode: false,
          });
          return response.status();
        },
        {
          timeout: 10000,
          message: `Dashboard ${dashboardId} should return 404 after delete`,
        },
      )
      .toBe(404);

    // Refresh to confirm dashboard is no longer in the list
    await dashboardListPage.goto();
    await dashboardListPage.waitForTableLoad();
    await expect(
      dashboardListPage.getDashboardRow(dashboardName),
    ).not.toBeVisible();

    // Click the import button
    await dashboardListPage.clickImportButton();

    // Reuse ImportDatasetModal (same shared ImportModelsModal UI)
    const importModal = new ImportDatasetModal(page);
    await importModal.waitForReady();

    // Upload the exported zip via buffer (no temp file needed)
    await page.locator('[data-test="model-file-input"]').setInputFiles({
      name: 'dashboard_export.zip',
      mimeType: 'application/zip',
      buffer: exportBuffer,
    });

    // Set up response intercept for the import POST
    let importResponsePromise = waitForPost(page, ENDPOINTS.DASHBOARD_IMPORT, {
      pathMatch: true,
    });

    // Click Import button
    await importModal.clickImport();

    // Wait for first import response
    let importResponse = await importResponsePromise;

    // Handle overwrite confirmation if dashboard already exists
    const overwriteInput = importModal.getOverwriteInput();
    await overwriteInput
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(error => {
        if (!(error instanceof Error) || error.name !== 'TimeoutError') {
          throw error;
        }
      });

    if (await overwriteInput.isVisible()) {
      importResponsePromise = waitForPost(page, ENDPOINTS.DASHBOARD_IMPORT, {
        pathMatch: true,
      });
      await importModal.fillOverwriteConfirmation();
      await importModal.clickImport();
      importResponse = await importResponsePromise;
    }

    // Verify import succeeded
    expectStatusOneOf(importResponse, [200]);

    // Modal should close on success
    await importModal.waitForHidden({ timeout: TIMEOUT.FILE_IMPORT });

    // Verify success toast appears
    const toast = new Toast(page);
    await expect(toast.getSuccess()).toBeVisible({ timeout: 10000 });

    // Refresh to see the imported dashboard
    await dashboardListPage.goto();
    await dashboardListPage.waitForTableLoad();

    // Verify dashboard appears in list
    await expect(
      dashboardListPage.getDashboardRow(dashboardName),
    ).toBeVisible();

    // Track for cleanup: look up the reimported dashboard by title
    const reimported = await getDashboardByName(page, dashboardName);
    if (reimported) {
      testAssets.trackDashboard(reimported.id);
    }
  });
});
