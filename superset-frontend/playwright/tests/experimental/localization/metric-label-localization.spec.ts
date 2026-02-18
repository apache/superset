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
import {
  apiDeleteChart,
  apiPutChart,
  createTestChart,
} from '../../../helpers/api/chart';
import {
  createTestVirtualDataset,
  apiDeleteDataset,
} from '../../../helpers/api/dataset';
import {
  createTestDatabase,
  apiDeleteDatabase,
} from '../../../helpers/api/database';
import { ExplorePage } from '../../../pages/ExplorePage';
import { TIMEOUT } from '../../../utils/constants';

/**
 * Metric Label Localization E2E Tests
 *
 * Verifies that the LocaleSwitcher in the metric edit popover title
 * works correctly: clicking the dropdown does not exit edit mode.
 *
 * Prerequisites:
 * - Superset running with ENABLE_CONTENT_LOCALIZATION = True
 * - Multiple LANGUAGES configured in superset_config.py
 * - Admin user authenticated (via global-setup)
 */

let testResources: {
  chartIds: number[];
  datasetIds: number[];
  databaseIds: number[];
};

test.beforeEach(async () => {
  testResources = {
    chartIds: [],
    datasetIds: [],
    databaseIds: [],
  };
});

test.afterEach(async ({ page }) => {
  await page.request.get('lang/en', { maxRedirects: 0 }).catch(() => {});

  await Promise.all(
    testResources.chartIds.map(id =>
      apiDeleteChart(page, id, { failOnStatusCode: false }).catch(e =>
        console.warn(`[Cleanup] chart ${id}:`, String(e)),
      ),
    ),
  );
  await Promise.all(
    testResources.datasetIds.map(id =>
      apiDeleteDataset(page, id, { failOnStatusCode: false }).catch(e =>
        console.warn(`[Cleanup] dataset ${id}:`, String(e)),
      ),
    ),
  );
  await Promise.all(
    testResources.databaseIds.map(id =>
      apiDeleteDatabase(page, id, { failOnStatusCode: false }).catch(e =>
        console.warn(`[Cleanup] database ${id}:`, String(e)),
      ),
    ),
  );
});

/**
 * Creates a chart with a custom metric label and translations in params.
 */
async function createChartWithCustomMetric(
  page: import('@playwright/test').Page,
  suffix: number,
) {
  const dbId = await createTestDatabase(
    page,
    `test_metric_loc_db_${suffix}`,
  );
  expect(dbId).not.toBeNull();
  testResources.databaseIds.push(dbId!);

  const datasetId = await createTestVirtualDataset(
    page,
    `test_metric_loc_ds_${suffix}`,
    dbId!,
  );
  expect(datasetId).not.toBeNull();
  testResources.datasetIds.push(datasetId!);

  const chart = await createTestChart(
    page,
    `test_metric_loc_${suffix}`,
    datasetId!,
  );
  expect(chart).not.toBeNull();
  testResources.chartIds.push(chart!.id);

  // Set custom metric label with translation via params
  const putRes = await apiPutChart(page, chart!.id, {
    params: JSON.stringify({
      metrics: [
        {
          expressionType: 'SQL',
          sqlExpression: 'COUNT(*)',
          label: 'Call Count',
          hasCustomLabel: true,
          optionName: `metric_${suffix}`,
          translations: { label: { de: 'Anzahl Anrufe' } },
        },
      ],
      viz_type: 'table',
      datasource: `${datasetId!}__table`,
    }),
  });
  expect(putRes.ok()).toBe(true);

  return { chartId: chart!.id, datasetId: datasetId! };
}

test('clicking locale dropdown in metric edit popover does not exit edit mode', async ({
  page,
}) => {
  const suffix = Date.now();
  const { chartId } = await createChartWithCustomMetric(page, suffix);

  // Navigate to explore with this chart
  await page.goto(`/explore/?slice_id=${chartId}`);
  const explorePage = new ExplorePage(page);
  await explorePage.waitForPageLoad({ timeout: TIMEOUT.PAGE_LOAD });

  // Click on the metric pill to open the popover
  const metricPill = page.locator('[data-test="option-label"]').first();
  await metricPill.click();

  // Popover opens — title may be in view mode (trigger) or edit mode (input)
  // Try to enter edit mode by clicking the trigger if visible
  const popoverTitle = page.getByRole('button', { name: /Click to edit metric label/i });
  const input = page.getByRole('textbox', { name: /Edit metric label/i });

  // Wait for either trigger or input to appear
  await expect(popoverTitle.or(input)).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });

  // If trigger is visible, click to enter edit mode
  if (await popoverTitle.isVisible()) {
    await popoverTitle.click();
    await expect(input).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });
  }

  // Wait for locale dropdown to load (API call to /available_locales)
  const localeDropdown = page.getByRole('button', {
    name: /Locale switcher/i,
  });
  await expect(localeDropdown).toBeVisible({ timeout: TIMEOUT.API_RESPONSE });

  // Click the locale dropdown
  await localeDropdown.click();

  // Input must STILL be visible — edit mode should NOT have been cancelled
  await expect(input).toBeVisible();

  // Dropdown menu should be open
  const menuItem = page.getByRole('menuitem', { name: /Deutsch|German/i });
  await expect(menuItem).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });
});

test('selecting a locale in metric popover shows translation input', async ({
  page,
}) => {
  const suffix = Date.now();
  const { chartId } = await createChartWithCustomMetric(page, suffix);

  await page.goto(`/explore/?slice_id=${chartId}`);
  const explorePage = new ExplorePage(page);
  await explorePage.waitForPageLoad({ timeout: TIMEOUT.PAGE_LOAD });

  // Open metric popover
  const metricPill = page.locator('[data-test="option-label"]').first();
  await metricPill.click();

  const popoverTitle = page.getByRole('button', { name: /Click to edit metric label/i });
  const input = page.getByRole('textbox', { name: /Edit metric label/i });

  await expect(popoverTitle.or(input)).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });

  if (await popoverTitle.isVisible()) {
    await popoverTitle.click();
    await expect(input).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });
  }

  // Wait for locale dropdown to load, then select German
  const localeDropdown = page.getByRole('button', {
    name: /Locale switcher/i,
  });
  await expect(localeDropdown).toBeVisible({ timeout: TIMEOUT.API_RESPONSE });
  await localeDropdown.click();

  const germanItem = page.getByRole('menuitem', { name: /Deutsch|German/i });
  await expect(germanItem).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });
  await germanItem.click();

  // Input should still be visible and show the translation value
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Anzahl Anrufe');
});
