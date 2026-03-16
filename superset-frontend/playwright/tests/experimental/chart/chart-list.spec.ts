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
import { ChartListPage } from '../../../pages/ChartListPage';
import { ChartPropertiesModal } from '../../../components/modals/ChartPropertiesModal';
import { DeleteConfirmationModal } from '../../../components/modals/DeleteConfirmationModal';
import { Toast } from '../../../components/core/Toast';
import { apiGetChart, ENDPOINTS } from '../../../helpers/api/chart';
import { createTestChart } from './chart-test-helpers';
import { waitForGet, waitForPut } from '../../../helpers/api/intercepts';
import {
  expectStatusOneOf,
  expectValidExportZip,
} from '../../../helpers/api/assertions';

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

  // Verify chart is visible in list
  await expect(chartListPage.getChartRow(chartName)).toBeVisible();

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

  // Verify success toast appears
  const toast = new Toast(page);
  await expect(toast.getSuccess()).toBeVisible();

  // Verify chart is removed from list
  await expect(chartListPage.getChartRow(chartName)).not.toBeVisible();

  // Backend verification: API returns 404
  await expect
    .poll(
      async () => {
        const response = await apiGetChart(page, chartId, {
          failOnStatusCode: false,
        });
        return response.status();
      },
      { timeout: 10000, message: `Chart ${chartId} should return 404` },
    )
    .toBe(404);
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

  // Verify chart is visible in list
  await expect(chartListPage.getChartRow(chartName)).toBeVisible();

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

  // Verify success toast appears
  const toast = new Toast(page);
  await expect(toast.getSuccess()).toBeVisible();

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

  // Verify chart is visible in list
  await expect(chartListPage.getChartRow(chartName)).toBeVisible();

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

  // Verify both charts are visible in list
  await expect(chartListPage.getChartRow(chart1.name)).toBeVisible();
  await expect(chartListPage.getChartRow(chart2.name)).toBeVisible();

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

  // Verify success toast appears
  const toast = new Toast(page);
  await expect(toast.getSuccess()).toBeVisible();

  // Verify both charts are removed from list
  await expect(chartListPage.getChartRow(chart1.name)).not.toBeVisible();
  await expect(chartListPage.getChartRow(chart2.name)).not.toBeVisible();

  // Backend verification: Both return 404
  for (const chart of [chart1, chart2]) {
    await expect
      .poll(
        async () => {
          const response = await apiGetChart(page, chart.id, {
            failOnStatusCode: false,
          });
          return response.status();
        },
        { timeout: 10000, message: `Chart ${chart.id} should return 404` },
      )
      .toBe(404);
  }
});

test('should bulk export multiple charts', async ({
  page,
  chartListPage,
  testAssets,
}) => {
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

  // Verify both charts are visible in list
  await expect(chartListPage.getChartRow(chart1.name)).toBeVisible();
  await expect(chartListPage.getChartRow(chart2.name)).toBeVisible();

  // Enable bulk select mode
  await chartListPage.clickBulkSelectButton();

  // Select both charts
  await chartListPage.selectChartCheckbox(chart1.name);
  await chartListPage.selectChartCheckbox(chart2.name);

  // Set up API response intercept for export endpoint
  const exportResponsePromise = waitForGet(page, ENDPOINTS.CHART_EXPORT);

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
