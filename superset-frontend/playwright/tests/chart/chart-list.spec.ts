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
import { ChartListPage } from '../../pages/ChartListPage';
import {
  ChartPropertiesModal,
  DeleteConfirmationModal,
} from '../../components/modals';
import { Toast } from '../../components/core';
import { apiGetChart, ENDPOINTS } from '../../helpers/api/chart';
import { createTestChart } from './chart-test-helpers';
import { waitForGet, waitForPut } from '../../helpers/api/intercepts';
import {
  expectDeleted,
  expectStatusOneOf,
  expectValidExportZip,
} from '../../helpers/api/assertions';
import { TIMEOUT } from '../../utils/constants';

/**
 * Extend testWithAssets with chartListPage navigation (beforeEach equivalent).
 */
const test = testWithAssets.extend<{ chartListPage: ChartListPage }>({
  chartListPage: async ({ page }, use) => {
    const chartListPage = new ChartListPage(page);
    await chartListPage.goto();
    await chartListPage.waitForTableLoad();
    await use(chartListPage);
  },
});

test('should delete a chart with confirmation', async ({
  page,
  chartListPage,
  testAssets,
}) => {
  // Create throwaway chart for deletion
  const { id: chartId, name: chartName } = await createTestChart(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_delete' },
  );

  // Refresh to see the new chart (created via API)
  await chartListPage.goto();
  await chartListPage.waitForTableLoad();

  // The list query is asynchronous; allow extra time on slow CI before the
  // freshly-created chart appears.
  await expect(chartListPage.getChartRow(chartName)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // Click delete action button
  await chartListPage.clickDeleteAction(chartName);

  // Delete confirmation modal should appear
  const deleteModal = new DeleteConfirmationModal(page);
  await deleteModal.waitForVisible();

  // Type "DELETE" to confirm
  await deleteModal.fillConfirmationInput('DELETE');

  // Click the Delete button
  await deleteModal.clickDelete();

  // Modal should close
  await deleteModal.waitForHidden();

  // Verify success toast appears. Use waitFor instead of toBeVisible so we
  // detect the toast even if it auto-dismisses on a fast machine.
  const toast = new Toast(page);
  await toast.getSuccess().waitFor({ state: 'visible' });

  // Verify chart is removed from list (deleted rows leave the DOM)
  await expect(chartListPage.getChartRow(chartName)).toHaveCount(0);

  // Backend verification: API returns 404
  await expectDeleted(page, ENDPOINTS.CHART, chartId, {
    label: `Chart ${chartId}`,
  });
});

test('should edit chart name via properties modal', async ({
  page,
  chartListPage,
  testAssets,
}) => {
  // Create throwaway chart for editing
  const { id: chartId, name: chartName } = await createTestChart(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_edit' },
  );

  // Refresh to see the new chart
  await chartListPage.goto();
  await chartListPage.waitForTableLoad();

  // The list query is asynchronous; allow extra time on slow CI before the
  // freshly-created chart appears.
  await expect(chartListPage.getChartRow(chartName)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // Click edit action to open properties modal
  await chartListPage.clickEditAction(chartName);

  // Wait for properties modal to be ready
  const propertiesModal = new ChartPropertiesModal(page);
  await propertiesModal.waitForReady();

  // Edit the chart name
  const newName = `renamed_${Date.now()}_${test.info().parallelIndex}`;
  await propertiesModal.fillName(newName);

  // Set up response intercept for save
  const saveResponsePromise = waitForPut(page, `${ENDPOINTS.CHART}${chartId}`);

  // Click Save button
  await propertiesModal.clickSave();

  // Wait for save to complete and verify success
  expectStatusOneOf(await saveResponsePromise, [200, 201]);

  // Modal should close
  await propertiesModal.waitForHidden();

  // Verify success toast appears. Use waitFor instead of toBeVisible so we
  // detect the toast even if it auto-dismisses on a fast machine.
  const toast = new Toast(page);
  await toast.getSuccess().waitFor({ state: 'visible' });

  // Backend verification: API returns updated name
  const response = await apiGetChart(page, chartId);
  const chart = (await response.json()).result;
  expect(chart.slice_name).toBe(newName);
});

test('should export a chart as a zip file', async ({
  page,
  chartListPage,
  testAssets,
}) => {
  // Create throwaway chart for export
  const { name: chartName } = await createTestChart(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_export' },
  );

  // Refresh to see the new chart
  await chartListPage.goto();
  await chartListPage.waitForTableLoad();

  // The list query is asynchronous; allow extra time on slow CI before the
  // freshly-created chart appears.
  await expect(chartListPage.getChartRow(chartName)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // Set up API response intercept for export endpoint
  const exportResponsePromise = waitForGet(page, ENDPOINTS.CHART_EXPORT);

  // Click export action button
  await chartListPage.clickExportAction(chartName);

  // Wait for export API response and validate zip contents
  const exportResponse = expectStatusOneOf(await exportResponsePromise, [200]);
  await expectValidExportZip(exportResponse, {
    resourceDir: 'charts',
    expectedNames: [chartName],
  });
});

test('should bulk delete multiple charts', async ({
  page,
  chartListPage,
  testAssets,
}) => {
  test.setTimeout(60_000);

  // Create 2 throwaway charts for bulk delete
  const [chart1, chart2] = await Promise.all([
    createTestChart(page, testAssets, test.info(), {
      prefix: 'bulk_delete_1',
    }),
    createTestChart(page, testAssets, test.info(), {
      prefix: 'bulk_delete_2',
    }),
  ]);

  // Refresh to see new charts
  await chartListPage.goto();
  await chartListPage.waitForTableLoad();

  // The list query is asynchronous; allow extra time on slow CI before the
  // freshly-created charts appear.
  await expect(chartListPage.getChartRow(chart1.name)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });
  await expect(chartListPage.getChartRow(chart2.name)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // Enable bulk select mode
  await chartListPage.clickBulkSelectButton();

  // Select both charts
  await chartListPage.selectChartCheckbox(chart1.name);
  await chartListPage.selectChartCheckbox(chart2.name);

  // Click bulk delete action
  await chartListPage.clickBulkAction('Delete');

  // Delete confirmation modal should appear
  const deleteModal = new DeleteConfirmationModal(page);
  await deleteModal.waitForVisible();

  // Type "DELETE" to confirm
  await deleteModal.fillConfirmationInput('DELETE');

  // Click the Delete button
  await deleteModal.clickDelete();

  // Modal should close
  await deleteModal.waitForHidden();

  // Verify success toast appears. Use waitFor instead of toBeVisible so we
  // detect the toast even if it auto-dismisses on a fast machine.
  const toast = new Toast(page);
  await toast.getSuccess().waitFor({ state: 'visible' });

  // Verify both charts are removed from list (deleted rows leave the DOM)
  await expect(chartListPage.getChartRow(chart1.name)).toHaveCount(0);
  await expect(chartListPage.getChartRow(chart2.name)).toHaveCount(0);

  // Backend verification: Both return 404
  for (const chart of [chart1, chart2]) {
    await expectDeleted(page, ENDPOINTS.CHART, chart.id, {
      label: `Chart ${chart.id}`,
    });
  }
});

test('should edit chart name from card view', async ({ page, testAssets }) => {
  // Create throwaway chart for editing
  const { id: chartId, name: chartName } = await createTestChart(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_card_edit' },
  );

  // Navigate to card view (not table view)
  const cardListPage = new ChartListPage(page);
  await cardListPage.gotoCardView();
  await cardListPage.waitForCardLoad();

  // The list query is asynchronous; allow extra time on slow CI before the
  // freshly-created chart card appears.
  await expect(cardListPage.getChartCard(chartName)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // Open card dropdown and click edit
  await cardListPage.clickCardEditAction(chartName);

  // Wait for properties modal to be ready
  const propertiesModal = new ChartPropertiesModal(page);
  await propertiesModal.waitForReady();

  // Edit the chart name
  const newName = `card_renamed_${Date.now()}_${test.info().parallelIndex}`;
  await propertiesModal.fillName(newName);

  // Set up response intercept for save
  const saveResponsePromise = waitForPut(page, `${ENDPOINTS.CHART}${chartId}`);

  // Click Save button
  await propertiesModal.clickSave();

  // Wait for save to complete and verify success
  expectStatusOneOf(await saveResponsePromise, [200, 201]);

  // Modal should close
  await propertiesModal.waitForHidden();

  // Verify success toast appears. Use waitFor instead of toBeVisible so we
  // detect the toast even if it auto-dismisses on a fast machine.
  const toast = new Toast(page);
  await toast.getSuccess().waitFor({ state: 'visible' });

  // Verify the renamed card appears in card view and old name is gone
  // (the old card name is removed from the DOM after the rename re-render).
  await expect(cardListPage.getChartCard(newName)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });
  await expect(cardListPage.getChartCard(chartName)).toHaveCount(0);

  // Backend verification: API returns updated name
  const response = await apiGetChart(page, chartId);
  const chart = (await response.json()).result;
  expect(chart.slice_name).toBe(newName);
});

test('should bulk export multiple charts', async ({
  page,
  chartListPage,
  testAssets,
}) => {
  // Chains create×2 → refresh → bulk select → export. Matches the
  // sibling bulk-delete test's budget so the export response wait below
  // can exceed the 30s default without hitting the test timeout.
  test.setTimeout(TIMEOUT.SLOW_TEST);

  // Create 2 throwaway charts for bulk export
  const [chart1, chart2] = await Promise.all([
    createTestChart(page, testAssets, test.info(), {
      prefix: 'bulk_export_1',
    }),
    createTestChart(page, testAssets, test.info(), {
      prefix: 'bulk_export_2',
    }),
  ]);

  // Refresh to see new charts
  await chartListPage.goto();
  await chartListPage.waitForTableLoad();

  // The list query is asynchronous; allow extra time on slow CI before the
  // freshly-created charts appear.
  await expect(chartListPage.getChartRow(chart1.name)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });
  await expect(chartListPage.getChartRow(chart2.name)).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // Enable bulk select mode
  await chartListPage.clickBulkSelectButton();

  // Select both charts
  await chartListPage.selectChartCheckbox(chart1.name);
  await chartListPage.selectChartCheckbox(chart2.name);

  // Set up API response intercept BEFORE the click that triggers it.
  // Exports of multiple charts can take longer than 30s under load,
  // so use SLOW_TEST instead of the default test-timeout-bound budget.
  const exportResponsePromise = waitForGet(page, ENDPOINTS.CHART_EXPORT, {
    timeout: TIMEOUT.SLOW_TEST,
  });

  // Click bulk export action
  await chartListPage.clickBulkAction('Export');

  // Wait for export API response and validate zip contains both charts
  const exportResponse = expectStatusOneOf(await exportResponsePromise, [200]);
  await expectValidExportZip(exportResponse, {
    resourceDir: 'charts',
    minCount: 2,
    expectedNames: [chart1.name, chart2.name],
  });
});
