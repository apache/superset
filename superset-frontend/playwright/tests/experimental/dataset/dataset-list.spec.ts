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
import { DuplicateDatasetModal } from '../../../components/modals/DuplicateDatasetModal';
import { Toast } from '../../../components/core/Toast';
import { createTestDataset } from '../../../helpers/api/dataset.factories';
import { apiDeleteDataset, apiGetDataset } from '../../../helpers/api/dataset';
import { apiDeleteDatabase } from '../../../helpers/api/database';

test.describe('Dataset List', () => {
  let datasetListPage: DatasetListPage;
  let explorePage: ExplorePage;
  let testResources: { datasetIds: number[]; dbId?: number } = {
    datasetIds: [],
  };

  test.beforeEach(async ({ page }) => {
    datasetListPage = new DatasetListPage(page);
    explorePage = new ExplorePage(page);
    testResources = { datasetIds: [] }; // Reset for each test

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
    resources: { datasetIds: number[]; dbId?: number },
  ) {
    const promises = [];

    // Delete all datasets
    for (const datasetId of resources.datasetIds) {
      promises.push(
        apiDeleteDataset(page, datasetId, {
          failOnStatusCode: false,
        }).catch(() => {}),
      );
    }

    // Delete database if exists
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
    const { datasetId, dbId } = await createTestDataset(page, datasetName);
    testResources.datasetIds.push(datasetId);
    testResources.dbId = dbId;

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
    const { datasetId, dbId } = await createTestDataset(page, datasetName);
    testResources.datasetIds.push(datasetId);
    testResources.dbId = dbId;

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

  test('should duplicate a dataset with new name', async ({ page }) => {
    // Create test dataset (hermetic - creates own test data)
    const originalName = `test_original_${Date.now()}`;
    const duplicateName = `test_duplicate_${Date.now()}`;
    const { datasetId, dbId } = await createTestDataset(page, originalName);
    testResources.datasetIds.push(datasetId);
    testResources.dbId = dbId;

    // Refresh page to see new dataset
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify original dataset is visible in list
    await expect(datasetListPage.getDatasetRow(originalName)).toBeVisible();

    // Set up response intercept to capture duplicate dataset ID
    const duplicateResponsePromise = page.waitForResponse(
      response =>
        response.url().includes('/dataset/duplicate') &&
        response.status() === 200,
    );

    // Click duplicate action button
    await datasetListPage.clickDuplicateAction(originalName);

    // Duplicate modal should appear
    const duplicateModal = new DuplicateDatasetModal(page);
    await duplicateModal.waitForVisible();

    // Fill in new dataset name
    await duplicateModal.fillDatasetName(duplicateName);

    // Click the Duplicate button
    await duplicateModal.clickDuplicate();

    // Get the duplicate dataset ID from response
    const duplicateResponse = await duplicateResponsePromise;
    const duplicateData = await duplicateResponse.json();
    const duplicateId = duplicateData.id;

    // Track duplicate for cleanup
    testResources.datasetIds.push(duplicateId);

    // Modal should close
    await duplicateModal.waitForHidden();

    // Verify success toast appears
    const toast = new Toast(page);
    const successToast = toast.getSuccess();
    await expect(successToast).toBeVisible();

    // Refresh to see the duplicated dataset
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify both datasets exist in list
    await expect(datasetListPage.getDatasetRow(originalName)).toBeVisible();
    await expect(datasetListPage.getDatasetRow(duplicateName)).toBeVisible();

    // API Verification: Compare original and duplicate datasets
    const originalResponse = await apiGetDataset(page, datasetId);
    const originalData = await originalResponse.json();

    const duplicateResponseData = await apiGetDataset(page, duplicateId);
    const duplicateDataFull = await duplicateResponseData.json();

    // Verify key properties were copied correctly
    expect(duplicateDataFull.result.sql).toBe(originalData.result.sql);
    expect(duplicateDataFull.result.database.id).toBe(
      originalData.result.database.id,
    );
    expect(duplicateDataFull.result.schema).toBe(originalData.result.schema);
    // Name should be different (the duplicate name)
    expect(duplicateDataFull.result.table_name).toBe(duplicateName);
  });
});
