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
import { DatasetListPage } from '../../../pages/DatasetListPage';
import { ExplorePage } from '../../../pages/ExplorePage';
import { DeleteConfirmationModal } from '../../../components/modals/DeleteConfirmationModal';
import { DuplicateDatasetModal } from '../../../components/modals/DuplicateDatasetModal';
import { Toast } from '../../../components/core/Toast';
import {
  apiDeleteDataset,
  apiGetDataset,
  getDatasetByName,
  ENDPOINTS,
} from '../../../helpers/api/dataset';

/**
 * Test data constants
 * These reference example datasets loaded via --load-examples in CI.
 *
 * DEPENDENCY: Tests assume the example dataset exists and is a virtual dataset.
 * If examples aren't loaded or the dataset changes, tests will fail.
 * This is acceptable for experimental tests; stable tests should use dedicated
 * seeded test data to decouple from example data changes.
 */
const TEST_DATASETS = {
  EXAMPLE_DATASET: 'members_channels_2',
} as const;

/**
 * Dataset List E2E Tests
 *
 * Uses flat test() structure per project convention (matches login.spec.ts).
 * Shared state and hooks are at file scope.
 */

// File-scope state (reset in beforeEach)
let datasetListPage: DatasetListPage;
let explorePage: ExplorePage;
let testResources: { datasetIds: number[] } = { datasetIds: [] };

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
  const promises = [];
  for (const datasetId of testResources.datasetIds) {
    promises.push(
      apiDeleteDataset(page, datasetId, {
        failOnStatusCode: false,
      }).catch(error => {
        // Log cleanup failures to avoid silent resource leaks
        console.warn(
          `[Cleanup] Failed to delete dataset ${datasetId}:`,
          String(error),
        );
      }),
    );
  }
  await Promise.all(promises);
});

test('should navigate to Explore when dataset name is clicked', async ({
  page,
}) => {
  // Use existing example dataset (hermetic - loaded in CI via --load-examples)
  const datasetName = TEST_DATASETS.EXAMPLE_DATASET;
  const dataset = await getDatasetByName(page, datasetName);
  expect(dataset).not.toBeNull();

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
  // Get example dataset to duplicate
  const originalName = TEST_DATASETS.EXAMPLE_DATASET;
  const originalDataset = await getDatasetByName(page, originalName);
  expect(originalDataset).not.toBeNull();

  // Create throwaway copy for deletion (hermetic - uses UI duplication)
  const datasetName = `test_delete_${Date.now()}`;

  // Verify original dataset is visible in list
  await expect(datasetListPage.getDatasetRow(originalName)).toBeVisible();

  // Set up response intercept to capture duplicate dataset ID
  const duplicateResponsePromise = page.waitForResponse(
    response =>
      response.url().includes(`${ENDPOINTS.DATASET}duplicate`) &&
      response.status() === 201,
  );

  // Click duplicate action button
  await datasetListPage.clickDuplicateAction(originalName);

  // Duplicate modal should appear and be ready for interaction
  const duplicateModal = new DuplicateDatasetModal(page);
  await duplicateModal.waitForReady();

  // Fill in new dataset name
  await duplicateModal.fillDatasetName(datasetName);

  // Click the Duplicate button
  await duplicateModal.clickDuplicate();

  // Get the duplicate dataset ID from response and track immediately
  const duplicateResponse = await duplicateResponsePromise;
  const duplicateData = await duplicateResponse.json();
  const duplicateId = duplicateData.id;

  // Track duplicate for cleanup immediately (before any operations that could fail)
  testResources = { datasetIds: [duplicateId] };

  // Modal should close
  await duplicateModal.waitForHidden();

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
  // Use virtual example dataset
  const originalName = TEST_DATASETS.EXAMPLE_DATASET;
  const duplicateName = `duplicate_${originalName}_${Date.now()}`;

  // Get the dataset by name (ID varies by environment)
  const original = await getDatasetByName(page, originalName);
  expect(original).not.toBeNull();
  expect(original!.id).toBeGreaterThan(0);

  // Verify original dataset is visible in list
  await expect(datasetListPage.getDatasetRow(originalName)).toBeVisible();

  // Set up response intercept to capture duplicate dataset ID
  const duplicateResponsePromise = page.waitForResponse(
    response =>
      response.url().includes(`${ENDPOINTS.DATASET}duplicate`) &&
      response.status() === 201,
  );

  // Click duplicate action button
  await datasetListPage.clickDuplicateAction(originalName);

  // Duplicate modal should appear and be ready for interaction
  const duplicateModal = new DuplicateDatasetModal(page);
  await duplicateModal.waitForReady();

  // Fill in new dataset name
  await duplicateModal.fillDatasetName(duplicateName);

  // Click the Duplicate button
  await duplicateModal.clickDuplicate();

  // Get the duplicate dataset ID from response
  const duplicateResponse = await duplicateResponsePromise;
  const duplicateData = await duplicateResponse.json();
  const duplicateId = duplicateData.id;

  // Track duplicate for cleanup (original is example data, don't delete it)
  testResources = { datasetIds: [duplicateId] };

  // Modal should close
  await duplicateModal.waitForHidden();

  // Note: Duplicate action does not show a success toast (only errors)
  // Verification is done via API and UI list check below

  // Refresh to see the duplicated dataset
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();

  // Verify both datasets exist in list
  await expect(datasetListPage.getDatasetRow(originalName)).toBeVisible();
  await expect(datasetListPage.getDatasetRow(duplicateName)).toBeVisible();

  // API Verification: Compare original and duplicate datasets
  const duplicateResponseData = await apiGetDataset(page, duplicateId);
  const duplicateDataFull = await duplicateResponseData.json();

  // Verify key properties were copied correctly (original data already fetched)
  expect(duplicateDataFull.result.sql).toBe(original!.sql);
  expect(duplicateDataFull.result.database.id).toBe(original!.database.id);
  expect(duplicateDataFull.result.schema).toBe(original!.schema);
  // Name should be different (the duplicate name)
  expect(duplicateDataFull.result.table_name).toBe(duplicateName);
});
