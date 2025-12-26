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

import { test, expect, type Page } from '@playwright/test';
import * as unzipper from 'unzipper';
import { DatasetListPage } from '../../../pages/DatasetListPage';
import { ExplorePage } from '../../../pages/ExplorePage';
import { DeleteConfirmationModal } from '../../../components/modals/DeleteConfirmationModal';
import { DuplicateDatasetModal } from '../../../components/modals/DuplicateDatasetModal';
import { Toast } from '../../../components/core/Toast';
import {
  apiDeleteDataset,
  apiGetDataset,
  getDatasetByName,
  duplicateDataset,
  ENDPOINTS,
} from '../../../helpers/api/dataset';

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
    // Accept both 200 and 201 (endpoint may return either depending on environment)
    const duplicateResponsePromise = page.waitForResponse(
      response =>
        response.url().includes(`${ENDPOINTS.DATASET}duplicate`) &&
        [200, 201].includes(response.status()),
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

    // Get the duplicate dataset ID from response (handle both response shapes)
    const duplicateResponse = await duplicateResponsePromise;
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
  const exportResponsePromise = page.waitForResponse(
    response =>
      response.url().includes('/api/v1/dataset/export/') &&
      response.status() === 200,
  );

  // Click export action button
  await datasetListPage.clickExportAction(datasetName);

  // Wait for export API response
  const exportResponse = await exportResponsePromise;

  // Verify response headers indicate zip file
  const contentType = exportResponse.headers()['content-type'];
  expect(contentType).toContain('application/zip');

  const contentDisposition = exportResponse.headers()['content-disposition'];
  expect(contentDisposition).toMatch(/filename=.*dataset_export.*\.zip/);

  // Verify the response body is a valid zip with expected structure
  const responseBody = await exportResponse.body();
  expect(responseBody.length).toBeGreaterThan(0);

  // Parse zip contents from response buffer
  const entries: string[] = [];
  const directory = await unzipper.Open.buffer(responseBody);
  directory.files.forEach(file => entries.push(file.path));

  // Export should contain at least one dataset YAML file and metadata
  expect(entries.length).toBeGreaterThan(0);

  // Check for dataset directory and YAML file
  const hasDatasetYaml = entries.some(
    entry => entry.includes('datasets/') && entry.endsWith('.yaml'),
  );
  expect(hasDatasetYaml).toBe(true);

  // Check for metadata.yaml (export manifest)
  const hasMetadata = entries.some(entry => entry.endsWith('metadata.yaml'));
  expect(hasMetadata).toBe(true);
});
