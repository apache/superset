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

import { test, expect, Page } from '@playwright/test';
import { DatasetListPage } from '../../../pages/DatasetListPage';
import { ExplorePage } from '../../../pages/ExplorePage';
import { DeleteConfirmationModal } from '../../../components/modals/DeleteConfirmationModal';
import { Toast } from '../../../components/core/Toast';
import { createTestDataset } from '../../../helpers/api/dataset.factories';
import { apiDeleteDataset } from '../../../helpers/api/dataset';
import { apiDeleteDatabase } from '../../../helpers/api/database';

test.describe('Dataset List', () => {
  let datasetListPage: DatasetListPage;
  let explorePage: ExplorePage;
  let testResources: { datasetId?: number; dbId?: number } = {};

  test.beforeEach(async ({ page }) => {
    datasetListPage = new DatasetListPage(page);
    explorePage = new ExplorePage(page);
    testResources = {}; // Reset for each test

    // Navigate to dataset list page
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup any resources created during the test
    await cleanupTestAssets(page, testResources);
  });

  function cleanupTestAssets(
    page: Page,
    resources: { datasetId?: number; dbId?: number },
  ) {
    const promises = [];

    if (resources.datasetId) {
      promises.push(
        apiDeleteDataset(page, resources.datasetId, {
          failOnStatusCode: false,
        }).catch(() => {}),
      );
    }

    if (resources.dbId) {
      promises.push(
        apiDeleteDatabase(page, resources.dbId, {
          failOnStatusCode: false,
        }).catch(() => {}),
      );
    }

    return Promise.all(promises);
  }

  test('should navigate to Explore when dataset name is clicked', async ({
    page,
  }) => {
    // Create test dataset (hermetic - no dependency on sample data)
    const datasetName = `test_nav_${Date.now()}`;
    testResources = await createTestDataset(page, datasetName);

    // Refresh page to see new dataset
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify dataset is visible in list (uses page object + Playwright auto-wait)
    await expect(datasetListPage.getDatasetRow(datasetName)).toBeVisible();

    // Click on dataset name to navigate to Explore
    await datasetListPage.clickDatasetName(datasetName);

    // Wait for Explore page to load (validates URL + datasource control)
    await explorePage.waitForPageLoad();

    // Verify correct dataset is loaded in datasource control
    const loadedDatasetName = await explorePage.getDatasetName();
    expect(loadedDatasetName).toContain(datasetName);

    // Verify visualization switcher shows default viz type (indicates full page load)
    await expect(explorePage.getVizSwitcher()).toBeVisible();
    await expect(explorePage.getVizSwitcher()).toContainText('Table');
  });

  test('should delete a dataset with confirmation', async ({ page }) => {
    // Create test dataset (hermetic - creates own test data)
    const datasetName = `test_delete_${Date.now()}`;
    testResources = await createTestDataset(page, datasetName);

    // Refresh page to see new dataset
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify dataset is visible in list
    await expect(datasetListPage.getDatasetRow(datasetName)).toBeVisible();

    // Click delete action button
    await datasetListPage.clickDeleteAction(datasetName);

    // Delete confirmation modal should appear
    const deleteModal = new DeleteConfirmationModal(page);
    await deleteModal.waitForVisible();

    // Type "DELETE" to confirm
    await deleteModal.fillConfirmationInput('DELETE');

    // Click the Delete button
    await deleteModal.clickDelete();

    // Modal should close
    await deleteModal.waitForHidden();

    // Verify success toast appears with correct message
    const toast = new Toast(page);
    const successToast = toast.getSuccess();
    await expect(successToast).toBeVisible();
    await expect(toast.getMessage()).toContainText('Deleted');

    // Verify dataset is removed from list
    await expect(datasetListPage.getDatasetRow(datasetName)).not.toBeVisible();
  });
});
