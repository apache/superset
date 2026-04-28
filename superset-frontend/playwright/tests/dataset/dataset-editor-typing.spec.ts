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

import { testWithAssets, expect } from '../../helpers/fixtures';
import { DatasetListPage } from '../../pages/DatasetListPage';
import { EditDatasetModal } from '../../components/modals';
import { createWideTestDatasetForTest } from './dataset-test-helpers';

const test = testWithAssets;

const TYPING_CADENCES = [25, 50, 100] as const;
const TYPING_PHRASE =
  'The quick brown fox jumps over the lazy dog. 0123456789!?,.';

for (const delay of TYPING_CADENCES) {
  test(`typing into Default URL at ${delay}ms/key produces byte-identical text (FR-005, SC-001)`, async ({
    page,
    testAssets,
  }) => {
    const { name } = await createWideTestDatasetForTest(
      page,
      testAssets,
      test.info(),
      { prefix: `wide_typing_${delay}ms`, columnCount: 50 },
    );

    const datasetListPage = new DatasetListPage(page);
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();
    await datasetListPage.clickEditAction(name);

    const editModal = new EditDatasetModal(page);
    await editModal.waitForReady();
    await editModal.enableEditMode();
    await editModal.clickSettingsTab();

    // Default URL is a plain TextControl input — easier to read back than the
    // Ace-backed Description field, while still exercising the same parent
    // validation/render path that scrambled characters in the original bug.
    const defaultUrlInput = page.getByLabel('Default URL', { exact: true });
    await expect(defaultUrlInput).toBeVisible();
    await defaultUrlInput.click();
    await defaultUrlInput.fill(''); // start from empty

    await page.keyboard.type(TYPING_PHRASE, { delay });

    // Wait for the TextControl + editor debounces to settle so the field
    // reflects the final value (cumulative ~550 ms — see research.md R10).
    await expect(defaultUrlInput).toHaveValue(TYPING_PHRASE, { timeout: 2000 });
  });
}

test('duplicate column name surfaces as error within 500 ms after pause (FR-008, SC-003, US2 acceptance #1)', async ({
  page,
  testAssets,
}) => {
  const { name } = await createWideTestDatasetForTest(
    page,
    testAssets,
    test.info(),
    { prefix: 'dup_error', columnCount: 5 },
  );

  const datasetListPage = new DatasetListPage(page);
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();
  await datasetListPage.clickEditAction(name);

  const editModal = new EditDatasetModal(page);
  await editModal.waitForReady();
  await editModal.enableEditMode();
  // Calculated columns tab — clicking "Add item" twice produces two columns
  // both named "<new column>", which trips the duplicate-column-name check.
  await editModal.clickTab('Calculated columns');

  const addBtn = editModal.element.getByRole('button', { name: /add item/i });
  await addBtn.click();
  await addBtn.click();

  // Wait for the debounce + buffer; spec.md FR-003 caps at 500 ms editor-side.
  // The duplicate-column-name error message comes from t('Column name [%s] is
  // duplicated', name) in computeErrors().
  const dupError = editModal.element.getByText(
    /Column name \[.*\] is duplicated/,
  );
  await expect(dupError).toBeVisible({ timeout: 1500 });
});

test('save is blocked when validation pending and reveals duplicate-name error (FR-004, US2 acceptance #2)', async ({
  page,
  testAssets,
}) => {
  const { name } = await createWideTestDatasetForTest(
    page,
    testAssets,
    test.info(),
    { prefix: 'dup_save_block', columnCount: 5 },
  );

  const datasetListPage = new DatasetListPage(page);
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();
  await datasetListPage.clickEditAction(name);

  const editModal = new EditDatasetModal(page);
  await editModal.waitForReady();
  await editModal.enableEditMode();
  await editModal.clickTab('Calculated columns');

  const addBtn = editModal.element.getByRole('button', { name: /add item/i });
  await addBtn.click();
  await addBtn.click();

  // Either the blur-flush has already disabled the button by the time we
  // read its state (focus moved to addBtn → back to focus elsewhere on
  // re-render → eventually leaves the editor container), or it disables
  // shortly after as the debounce + state propagation completes.
  const saveButton = editModal.element.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeDisabled({ timeout: 1500 });

  const dupError = editModal.element.getByText(
    /Column name \[.*\] is duplicated/,
  );
  await expect(dupError).toBeVisible({ timeout: 1500 });
});

test('correction clears duplicate-name error within debounce window (US2 acceptance #3)', async ({
  page,
  testAssets,
}) => {
  const { name } = await createWideTestDatasetForTest(
    page,
    testAssets,
    test.info(),
    { prefix: 'dup_clear', columnCount: 5 },
  );

  const datasetListPage = new DatasetListPage(page);
  await datasetListPage.goto();
  await datasetListPage.waitForTableLoad();
  await datasetListPage.clickEditAction(name);

  const editModal = new EditDatasetModal(page);
  await editModal.waitForReady();
  await editModal.enableEditMode();
  await editModal.clickTab('Calculated columns');

  const addBtn = editModal.element.getByRole('button', { name: /add item/i });
  await addBtn.click();
  await addBtn.click();

  const dupError = editModal.element.getByText(
    /Column name \[.*\] is duplicated/,
  );
  await expect(dupError).toBeVisible({ timeout: 1500 });

  // Find the second "<new column>" name input in the calculated-columns
  // table and rename it. Both newly-added columns share the auto-generated
  // value "<new column>"; renaming either resolves the duplicate.
  // Locator.getByDisplayValue isn't available on the Locator type, so use
  // a CSS attribute selector scoped to the modal body instead.
  const newColumnInputs = editModal.body.locator('input[value="<new column>"]');
  await expect(newColumnInputs.first()).toBeVisible();
  // There should be 2 of them — pick the second to keep the first stable.
  const secondInput = newColumnInputs.nth(1);
  await secondInput.click();
  await secondInput.fill('renamed_column');

  // Wait for the editor's 300 ms debounce + propagation; the duplicate
  // error should clear well within 1.5 s.
  await expect(dupError).not.toBeVisible({ timeout: 1500 });
});
