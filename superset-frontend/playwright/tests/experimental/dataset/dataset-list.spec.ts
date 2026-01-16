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

import { test, expect, type Page, type Response } from '@playwright/test';
import * as unzipper from 'unzipper';
import { DatasetListPage } from '../../../pages/DatasetListPage';
import { ExplorePage } from '../../../pages/ExplorePage';
import { ConfirmDialog } from '../../../components/modals/ConfirmDialog';
import { DeleteConfirmationModal } from '../../../components/modals/DeleteConfirmationModal';
import { DuplicateDatasetModal } from '../../../components/modals/DuplicateDatasetModal';
import { EditDatasetModal } from '../../../components/modals/EditDatasetModal';
import { Toast } from '../../../components/core/Toast';
import {
  apiDeleteDataset,
  apiGetDataset,
  getDatasetByName,
  duplicateDataset,
  ENDPOINTS,
} from '../../../helpers/api/dataset';
import { waitForGet, waitForPost, waitForPut } from '../../../helpers/api/intercepts';
import { expectStatusOneOf } from '../../../helpers/api/assertions';

/**
 * Helper to clean up datasets created during a test.
 * Each test tracks its own resources to avoid parallel test interference.
 */
async function cleanupDatasets(page: Page, datasetIds: number[]) {
  const promises = datasetIds.map(id =>
    apiDeleteDataset(page, id, { failOnStatusCode: false }).catch(() => {}),
  );
  await Promise.all(promises);
}

/**
 * Helper to validate an export zip response.
 * Verifies headers, parses zip contents, and validates expected structure.
 */
async function expectValidExportZip(
  response: Response,
  options: { minDatasetCount?: number; checkContentDisposition?: boolean } = {},
): Promise<void> {
  const { minDatasetCount = 1, checkContentDisposition = false } = options;

  // Verify headers
  expect(response.headers()['content-type']).toContain('application/zip');
  if (checkContentDisposition) {
    expect(response.headers()['content-disposition']).toMatch(
      /filename=.*dataset_export.*\.zip/,
    );
  }

  // Parse and validate zip contents
  const body = await response.body();
  expect(body.length).toBeGreaterThan(0);

  const entries: string[] = [];
  const directory = await unzipper.Open.buffer(body);
  directory.files.forEach(file => entries.push(file.path));

  // Validate structure
  const datasetYamlFiles = entries.filter(
    entry => entry.includes('datasets/') && entry.endsWith('.yaml'),
  );
  expect(datasetYamlFiles.length).toBeGreaterThanOrEqual(minDatasetCount);
  expect(entries.some(entry => entry.endsWith('metadata.yaml'))).toBe(true);
}

test('should navigate to Explore when dataset name is clicked', async ({
  page,
}) => {
  const datasetListPage = new DatasetListPage(page);
  const explorePage = new ExplorePage(page);

  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();

  // Use existing example dataset (hermetic - loaded in CI via --load-examples)
  const datasetName = 'members_channels_2';
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
  const datasetListPage = new DatasetListPage(page);
  const testDatasetIds: number[] = [];

  try {
    // Get example dataset to duplicate
    const originalDataset = await getDatasetByName(page, 'members_channels_2');
    expect(originalDataset).not.toBeNull();

    // Create throwaway copy for deletion (hermetic - uses duplicate API)
    const datasetName = `test_delete_${Date.now()}`;
    const duplicateDatasetResult = await duplicateDataset(
      page,
      originalDataset!.id,
      datasetName,
    );
    testDatasetIds.push(duplicateDatasetResult.id);

    // Navigate to dataset list page
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

    // Dataset was deleted successfully, clear from cleanup list
    testDatasetIds.length = 0;
  } finally {
    await cleanupDatasets(page, testDatasetIds);
  }
});

test('should duplicate a dataset with new name', async ({ page }) => {
  const datasetListPage = new DatasetListPage(page);
  const testDatasetIds: number[] = [];

  try {
    // Use virtual example dataset (members_channels_2)
    const originalName = 'members_channels_2';
    const duplicateName = `duplicate_${originalName}_${Date.now()}`;

    // Get the dataset by name (ID varies by environment)
    const original = await getDatasetByName(page, originalName);
    expect(original).not.toBeNull();
    expect(original!.id).toBeGreaterThan(0);

    // Navigate to dataset list page
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify original dataset is visible in list
    await expect(datasetListPage.getDatasetRow(originalName)).toBeVisible();

    // Set up response intercept to capture duplicate dataset ID
    const duplicateResponsePromise = waitForPost(page, ENDPOINTS.DATASET_DUPLICATE);

    // Click duplicate action button
    await datasetListPage.clickDuplicateAction(originalName);

    // Duplicate modal should appear and be ready for interaction
    const duplicateModal = new DuplicateDatasetModal(page);
    await duplicateModal.waitForReady();

    // Fill in new dataset name
    await duplicateModal.fillDatasetName(duplicateName);

    // Click the Duplicate button
    await duplicateModal.clickDuplicate();

    // Get the duplicate dataset ID from response (handle both response shapes)
    const duplicateResponse = expectStatusOneOf(await duplicateResponsePromise, [200, 201]);
    const duplicateData = await duplicateResponse.json();
    const duplicateId = duplicateData.result?.id ?? duplicateData.id;
    expect(duplicateId, 'Duplicate API should return dataset id').toBeTruthy();

    // Track duplicate for cleanup (original is example data, don't delete it)
    testDatasetIds.push(duplicateId);

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

    // API Verification: Fetch both datasets via detail API for consistent comparison
    // (list API may return undefined for fields that detail API returns as null)
    const [originalDetailRes, duplicateDetailRes] = await Promise.all([
      apiGetDataset(page, original!.id),
      apiGetDataset(page, duplicateId),
    ]);
    const originalDetail = (await originalDetailRes.json()).result;
    const duplicateDetail = (await duplicateDetailRes.json()).result;

    // Verify key properties were copied correctly
    expect(duplicateDetail.sql).toBe(originalDetail.sql);
    expect(duplicateDetail.database.id).toBe(originalDetail.database.id);
    expect(duplicateDetail.schema).toBe(originalDetail.schema);
    // Name should be different (the duplicate name)
    expect(duplicateDetail.table_name).toBe(duplicateName);
  } finally {
    await cleanupDatasets(page, testDatasetIds);
  }
});

test('should export a dataset as a zip file', async ({ page }) => {
  const datasetListPage = new DatasetListPage(page);

  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();

  // Use existing example dataset
  const datasetName = 'members_channels_2';
  const dataset = await getDatasetByName(page, datasetName);
  expect(dataset).not.toBeNull();

  // Verify dataset is visible in list
  await expect(datasetListPage.getDatasetRow(datasetName)).toBeVisible();

  // Set up API response intercept for export endpoint
  // Note: We intercept the API response instead of relying on download events because
  // Superset uses blob downloads (createObjectURL) which don't trigger Playwright's
  // download event consistently, especially in app-prefix configurations.
  const exportResponsePromise = waitForGet(page, ENDPOINTS.DATASET_EXPORT);

  // Click export action button
  await datasetListPage.clickExportAction(datasetName);

  // Wait for export API response and validate zip contents
  const exportResponse = expectStatusOneOf(await exportResponsePromise, [200]);
  await expectValidExportZip(exportResponse, { checkContentDisposition: true });
});

test('should export multiple datasets via bulk select action', async ({
  page,
}) => {
  const datasetListPage = new DatasetListPage(page);
  const testDatasetIds: number[] = [];

  try {
    // Get example dataset to duplicate
    const originalDataset = await getDatasetByName(page, 'members_channels_2');
    expect(originalDataset).not.toBeNull();

    // Create 2 throwaway copies for bulk export (hermetic - uses duplicate API)
    const dataset1Name = `test_bulk_export_1_${Date.now()}`;
    const dataset2Name = `test_bulk_export_2_${Date.now()}`;

    const [duplicate1, duplicate2] = await Promise.all([
      duplicateDataset(page, originalDataset!.id, dataset1Name),
      duplicateDataset(page, originalDataset!.id, dataset2Name),
    ]);
    testDatasetIds.push(duplicate1.id, duplicate2.id);

    // Navigate to dataset list page
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify both datasets are visible in list
    await expect(datasetListPage.getDatasetRow(dataset1Name)).toBeVisible();
    await expect(datasetListPage.getDatasetRow(dataset2Name)).toBeVisible();

    // Enable bulk select mode
    await datasetListPage.clickBulkSelectButton();

    // Select both datasets
    await datasetListPage.selectDatasetCheckbox(dataset1Name);
    await datasetListPage.selectDatasetCheckbox(dataset2Name);

    // Set up API response intercept for export endpoint
    const exportResponsePromise = waitForGet(page, ENDPOINTS.DATASET_EXPORT);

    // Click bulk export action
    await datasetListPage.clickBulkAction('Export');

    // Wait for export API response and validate zip contains multiple datasets
    const exportResponse = expectStatusOneOf(await exportResponsePromise, [200]);
    await expectValidExportZip(exportResponse, { minDatasetCount: 2 });
  } finally {
    await cleanupDatasets(page, testDatasetIds);
  }
});

test('should edit dataset name via modal', async ({ page }) => {
  const datasetListPage = new DatasetListPage(page);
  const testDatasetIds: number[] = [];

  try {
    // Get example dataset to duplicate
    const originalDataset = await getDatasetByName(page, 'members_channels_2');
    expect(originalDataset).not.toBeNull();

    // Create throwaway copy for editing (hermetic - uses duplicate API)
    const datasetName = `test_edit_${Date.now()}`;
    const duplicateDatasetResult = await duplicateDataset(
      page,
      originalDataset!.id,
      datasetName,
    );
    testDatasetIds.push(duplicateDatasetResult.id);

    // Navigate to dataset list page
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify dataset is visible in list
    await expect(datasetListPage.getDatasetRow(datasetName)).toBeVisible();

    // Click edit action to open modal
    await datasetListPage.clickEditAction(datasetName);

    // Wait for edit modal to be ready
    const editModal = new EditDatasetModal(page);
    await editModal.waitForReady();

    // Enable edit mode by clicking the lock icon
    await editModal.enableEditMode();

    // Edit the dataset name
    const newName = `test_renamed_${Date.now()}`;
    await editModal.fillName(newName);

    // Set up response intercept for save
    const saveResponsePromise = waitForPut(
      page,
      `${ENDPOINTS.DATASET}${duplicateDatasetResult.id}`,
    );

    // Click Save button
    await editModal.clickSave();

    // Handle the "Confirm save" dialog that appears for datasets with sync columns enabled
    const confirmDialog = new ConfirmDialog(page);
    await confirmDialog.clickOk();

    // Wait for save to complete and verify success
    expectStatusOneOf(await saveResponsePromise, [200, 201]);

    // Modal should close
    await editModal.waitForHidden();

    // Verify success toast appears
    const toast = new Toast(page);
    await expect(toast.getSuccess()).toBeVisible({ timeout: 10000 });

    // Verify via API that name was saved
    const updatedDatasetRes = await apiGetDataset(
      page,
      duplicateDatasetResult.id,
    );
    const updatedDataset = (await updatedDatasetRes.json()).result;
    expect(updatedDataset.table_name).toBe(newName);
  } finally {
    await cleanupDatasets(page, testDatasetIds);
  }
});
