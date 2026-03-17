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

import {
  test as testWithAssets,
  expect,
} from '../../../helpers/fixtures/testAssets';
import path from 'path';
import { DatasetListPage } from '../../../pages/DatasetListPage';
import { ExplorePage } from '../../../pages/ExplorePage';
import { ConfirmDialog } from '../../../components/modals/ConfirmDialog';
import { DeleteConfirmationModal } from '../../../components/modals/DeleteConfirmationModal';
import { ImportDatasetModal } from '../../../components/modals/ImportDatasetModal';
import { DuplicateDatasetModal } from '../../../components/modals/DuplicateDatasetModal';
import { EditDatasetModal } from '../../../components/modals/EditDatasetModal';
import { Toast } from '../../../components/core/Toast';
import {
  apiDeleteDataset,
  apiGetDataset,
  apiPostVirtualDataset,
  getDatasetByName,
  ENDPOINTS,
} from '../../../helpers/api/dataset';
import { createTestDataset } from './dataset-test-helpers';
import {
  waitForGet,
  waitForPost,
  waitForPut,
} from '../../../helpers/api/intercepts';
import {
  expectStatusOneOf,
  expectValidExportZip,
} from '../../../helpers/api/assertions';
import { TIMEOUT } from '../../../utils/constants';

/**
 * Extend testWithAssets with datasetListPage navigation (beforeEach equivalent).
 */
const test = testWithAssets.extend<{ datasetListPage: DatasetListPage }>({
  datasetListPage: async ({ page }, use) => {
    const datasetListPage = new DatasetListPage(page);
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();
    await use(datasetListPage);
  },
});

test('should navigate to Explore when dataset name is clicked', async ({
  page,
  datasetListPage,
}) => {
  const explorePage = new ExplorePage(page);

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

test('should delete a dataset with confirmation', async ({
  page,
  datasetListPage,
  testAssets,
}) => {
  // Create throwaway dataset for deletion
  const { id: datasetId, name: datasetName } = await createTestDataset(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_delete' },
  );

  // Refresh to see the new dataset
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

  // Verify via API that dataset no longer exists (404)
  await expect
    .poll(
      async () => {
        const response = await apiGetDataset(page, datasetId, {
          failOnStatusCode: false,
        });
        return response.status();
      },
      { timeout: 10000, message: `Dataset ${datasetId} should return 404` },
    )
    .toBe(404);
});

test('should duplicate a dataset with new name', async ({
  page,
  datasetListPage,
  testAssets,
}) => {
  // Create a virtual dataset first (duplicate UI only works for virtual datasets)
  const { id: originalId, name: originalName } = await createTestDataset(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_duplicate_source' },
  );
  const duplicateName = `duplicate_${Date.now()}_${test.info().parallelIndex}`;

  // Navigate to list and verify original dataset is visible
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();
  await expect(datasetListPage.getDatasetRow(originalName)).toBeVisible();

  // Set up response intercept to capture duplicate dataset ID
  const duplicateResponsePromise = waitForPost(
    page,
    ENDPOINTS.DATASET_DUPLICATE,
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
  const duplicateResponse = expectStatusOneOf(
    await duplicateResponsePromise,
    [200, 201],
  );
  const duplicateData = await duplicateResponse.json();
  const duplicateId = duplicateData.result?.id ?? duplicateData.id;
  expect(duplicateId, 'Duplicate API should return dataset id').toBeTruthy();

  // Track duplicate for cleanup (original is already tracked by createTestDataset)
  testAssets.trackDataset(duplicateId);

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
    apiGetDataset(page, originalId),
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
});

test('should export a dataset as a zip file', async ({
  page,
  datasetListPage,
}) => {
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
  await expectValidExportZip(exportResponse, {
    resourceDir: 'datasets',
    contentDispositionPattern: /filename=.*dataset_export.*\.zip/,
  });
});

test('should export multiple datasets via bulk select action', async ({
  page,
  datasetListPage,
  testAssets,
}) => {
  // Create 2 throwaway datasets for bulk export
  const [dataset1, dataset2] = await Promise.all([
    createTestDataset(page, testAssets, test.info(), {
      prefix: 'bulk_export_1',
    }),
    createTestDataset(page, testAssets, test.info(), {
      prefix: 'bulk_export_2',
    }),
  ]);

  // Refresh to see new datasets
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();

  // Verify both datasets are visible in list
  await expect(datasetListPage.getDatasetRow(dataset1.name)).toBeVisible();
  await expect(datasetListPage.getDatasetRow(dataset2.name)).toBeVisible();

  // Enable bulk select mode
  await datasetListPage.clickBulkSelectButton();

  // Select both datasets
  await datasetListPage.selectDatasetCheckbox(dataset1.name);
  await datasetListPage.selectDatasetCheckbox(dataset2.name);

  // Set up API response intercept for export endpoint
  const exportResponsePromise = waitForGet(page, ENDPOINTS.DATASET_EXPORT);

  // Click bulk export action
  await datasetListPage.clickBulkAction('Export');

  // Wait for export API response and validate zip contains multiple datasets
  const exportResponse = expectStatusOneOf(await exportResponsePromise, [200]);
  await expectValidExportZip(exportResponse, {
    resourceDir: 'datasets',
    minCount: 2,
  });
});

test('should edit dataset name via modal', async ({
  page,
  datasetListPage,
  testAssets,
}) => {
  // Create throwaway dataset for editing
  const { id: datasetId, name: datasetName } = await createTestDataset(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_edit' },
  );

  // Refresh to see new dataset
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
    `${ENDPOINTS.DATASET}${datasetId}`,
  );

  // Click Save button
  await editModal.clickSave();

  // Handle the "Confirm save" dialog that may appear for datasets with sync columns enabled
  const confirmDialog = new ConfirmDialog(page);
  await confirmDialog.clickOk({ timeout: TIMEOUT.CONFIRM_DIALOG });

  // Wait for save to complete and verify success
  expectStatusOneOf(await saveResponsePromise, [200, 201]);

  // Modal should close
  await editModal.waitForHidden();

  // Verify success toast appears
  const toast = new Toast(page);
  await expect(toast.getSuccess()).toBeVisible({ timeout: 10000 });

  // Verify via API that name was saved
  const updatedDatasetRes = await apiGetDataset(page, datasetId);
  const updatedDataset = (await updatedDatasetRes.json()).result;
  expect(updatedDataset.table_name).toBe(newName);
});

test('should bulk delete multiple datasets', async ({
  page,
  datasetListPage,
  testAssets,
}) => {
  // Create 2 throwaway datasets for bulk delete
  const [dataset1, dataset2] = await Promise.all([
    createTestDataset(page, testAssets, test.info(), {
      prefix: 'bulk_delete_1',
    }),
    createTestDataset(page, testAssets, test.info(), {
      prefix: 'bulk_delete_2',
    }),
  ]);

  // Refresh to see new datasets
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();

  // Verify both datasets are visible in list
  await expect(datasetListPage.getDatasetRow(dataset1.name)).toBeVisible();
  await expect(datasetListPage.getDatasetRow(dataset2.name)).toBeVisible();

  // Enable bulk select mode
  await datasetListPage.clickBulkSelectButton();

  // Select both datasets
  await datasetListPage.selectDatasetCheckbox(dataset1.name);
  await datasetListPage.selectDatasetCheckbox(dataset2.name);

  // Click bulk delete action
  await datasetListPage.clickBulkAction('Delete');

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

  // Verify both datasets are removed from list
  await expect(datasetListPage.getDatasetRow(dataset1.name)).not.toBeVisible();
  await expect(datasetListPage.getDatasetRow(dataset2.name)).not.toBeVisible();

  // Verify via API that datasets no longer exist (404)
  // Use polling with explicit timeout since deletes may be async
  await expect
    .poll(
      async () => {
        const response = await apiGetDataset(page, dataset1.id, {
          failOnStatusCode: false,
        });
        return response.status();
      },
      { timeout: 10000, message: `Dataset ${dataset1.id} should return 404` },
    )
    .toBe(404);
  await expect
    .poll(
      async () => {
        const response = await apiGetDataset(page, dataset2.id, {
          failOnStatusCode: false,
        });
        return response.status();
      },
      { timeout: 10000, message: `Dataset ${dataset2.id} should return 404` },
    )
    .toBe(404);
});

// Import test uses a fixed dataset name from the zip fixture.
// Uses test.describe only because Playwright's serial mode API requires it -
// this prevents race conditions when parallel workers import the same fixture.
// (Deviation from "avoid describe" guideline is necessary for functional reasons)
test.describe('import dataset', () => {
  test.describe.configure({ mode: 'serial' });
  test('should import a dataset from a zip file', async ({
    page,
    datasetListPage,
    testAssets,
  }) => {
    // Dataset name from fixture (test_netflix_1768502050965)
    // Note: Fixture contains a Google Sheets dataset - test will skip if gsheets connector unavailable
    const importedDatasetName = 'test_netflix_1768502050965';
    const fixturePath = path.resolve(
      __dirname,
      '../../../fixtures/dataset_export.zip',
    );

    // Cleanup: Delete any existing dataset with the same name from previous runs
    const existingDataset = await getDatasetByName(page, importedDatasetName);
    if (existingDataset) {
      await apiDeleteDataset(page, existingDataset.id, {
        failOnStatusCode: false,
      });
    }

    // Click the import button
    await datasetListPage.clickImportButton();

    // Wait for import modal to be ready
    const importModal = new ImportDatasetModal(page);
    await importModal.waitForReady();

    // Upload the fixture zip file
    await importModal.uploadFile(fixturePath);

    // Set up response intercept to catch the import POST
    // Use pathMatch to avoid false matches if URL lacks trailing slash
    let importResponsePromise = waitForPost(page, ENDPOINTS.DATASET_IMPORT, {
      pathMatch: true,
    });

    // Click Import button
    await importModal.clickImport();

    // Wait for first import response
    let importResponse = await importResponsePromise;

    // Handle overwrite confirmation if dataset already exists
    // First response may be 409/422 indicating overwrite is required - this is expected
    const overwriteInput = importModal.getOverwriteInput();
    await overwriteInput
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(error => {
        // Only ignore TimeoutError (input not visible); re-throw other errors
        if (!(error instanceof Error) || error.name !== 'TimeoutError') {
          throw error;
        }
      });

    if (await overwriteInput.isVisible()) {
      // Set up new intercept for the actual import after overwrite confirmation
      importResponsePromise = waitForPost(page, ENDPOINTS.DATASET_IMPORT, {
        pathMatch: true,
      });
      await importModal.fillOverwriteConfirmation();
      await importModal.clickImport();
      // Wait for the second (final) import response
      importResponse = await importResponsePromise;
    }

    // Check final import response for gsheets connector errors
    if (!importResponse.ok()) {
      const errorBody = await importResponse.json().catch(() => ({}));
      const errorText = JSON.stringify(errorBody);
      // Skip test if gsheets connector not installed
      if (
        errorText.includes('gsheets') ||
        errorText.includes('No such DB engine') ||
        errorText.includes('Could not load database driver')
      ) {
        await test.info().attach('skip-reason', {
          body: `Import failed due to missing gsheets connector: ${errorText}`,
          contentType: 'text/plain',
        });
        test.skip();
        return;
      }
      // Re-throw other errors
      throw new Error(`Import failed: ${errorText}`);
    }

    // Modal should close on success
    await importModal.waitForHidden({ timeout: TIMEOUT.FILE_IMPORT });

    // Verify success toast appears
    const toast = new Toast(page);
    await expect(toast.getSuccess()).toBeVisible({ timeout: 10000 });

    // Refresh the page to see the imported dataset
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Verify dataset appears in list
    await expect(
      datasetListPage.getDatasetRow(importedDatasetName),
    ).toBeVisible();

    // Get dataset ID for cleanup
    const importedDataset = await getDatasetByName(page, importedDatasetName);
    expect(importedDataset).not.toBeNull();
    testAssets.trackDataset(importedDataset!.id);
  });
});

test('should edit column date format via modal', async ({
  page,
  datasetListPage,
  testAssets,
}) => {
  // Create virtual dataset with a date column for testing
  // Using SQL to create a dataset with 'ds' column avoids duplication issues
  const datasetName = `test_date_format_${Date.now()}_${test.info().parallelIndex}`;
  const baseDataset = await getDatasetByName(page, 'members_channels_2');
  expect(baseDataset, 'members_channels_2 dataset must exist').not.toBeNull();

  const createResponse = await apiPostVirtualDataset(page, {
    database: baseDataset!.database.id,
    schema: baseDataset!.schema ?? null,
    table_name: datasetName,
    sql: "SELECT CAST('2024-01-01' AS DATE) as ds, 'test' as name",
  });
  expectStatusOneOf(createResponse, [200, 201]);
  const createBody = await createResponse.json();
  const datasetId = createBody.result?.id ?? createBody.id;
  expect(datasetId, 'Virtual dataset creation should return id').toBeTruthy();
  testAssets.trackDataset(datasetId);

  // Navigate to dataset list, click edit action
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();
  await datasetListPage.clickEditAction(datasetName);

  // Enable edit mode, navigate to Columns tab
  const editModal = new EditDatasetModal(page);
  await editModal.waitForReady();
  await editModal.enableEditMode();
  await editModal.clickColumnsTab();

  // Expand 'ds' column row and fill date format (scoped to row)
  const dateFormat = '%Y-%m-%d';
  await editModal.fillColumnDateFormat('ds', dateFormat);

  // Save and handle confirmation dialog conditionally
  await editModal.clickSave();
  await new ConfirmDialog(page).clickOk({ timeout: TIMEOUT.CONFIRM_DIALOG });
  await editModal.waitForHidden();

  // Verify via API
  const updatedRes = await apiGetDataset(page, datasetId);
  const { columns } = (await updatedRes.json()).result;
  const dsColumn = columns.find(
    (c: { column_name: string }) => c.column_name === 'ds',
  );
  expect(dsColumn, 'ds column should exist in dataset').toBeDefined();
  expect(dsColumn.python_date_format).toBe(dateFormat);
});

test('should edit dataset description via modal', async ({
  page,
  datasetListPage,
  testAssets,
}) => {
  // Create throwaway dataset for editing description
  const { id: datasetId, name: datasetName } = await createTestDataset(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_description' },
  );

  // Navigate to dataset list, click edit action
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();
  await datasetListPage.clickEditAction(datasetName);

  // Enable edit mode, navigate to Settings tab
  const editModal = new EditDatasetModal(page);
  await editModal.waitForReady();
  await editModal.enableEditMode();
  await editModal.clickSettingsTab();

  // Fill description field
  const description = `Test description ${Date.now()}`;
  await editModal.fillDescription(description);

  // Save and handle confirmation dialog conditionally
  await editModal.clickSave();
  await new ConfirmDialog(page).clickOk({ timeout: TIMEOUT.CONFIRM_DIALOG });
  await editModal.waitForHidden();

  // Verify via API
  const updatedRes = await apiGetDataset(page, datasetId);
  const { result } = await updatedRes.json();
  expect(result.description).toBe(description);
});
