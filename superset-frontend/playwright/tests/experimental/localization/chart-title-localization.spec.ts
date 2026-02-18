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
  apiPutDashboard,
  apiDeleteDashboard,
  createTestDashboard,
} from '../../../helpers/api/dashboard';
import {
  apiPutChart,
  apiDeleteChart,
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
import { DashboardPage } from '../../../pages/DashboardPage';
import { TIMEOUT } from '../../../utils/constants';

/**
 * Chart Title Localization E2E Tests
 *
 * Verifies that chart titles on a dashboard are displayed in the
 * user's session locale when translations exist on the chart.
 *
 * Prerequisites:
 * - Superset running with ENABLE_CONTENT_LOCALIZATION = True
 * - Multiple LANGUAGES configured in superset_config.py
 * - Admin user authenticated (via global-setup)
 */

const GERMAN_CHART_TITLE = 'Deutscher Diagrammtitel';

// File-scope state (reset in beforeEach)
let testResources: {
  dashboardIds: number[];
  chartIds: number[];
  datasetIds: number[];
  databaseIds: number[];
};

test.beforeEach(async () => {
  testResources = {
    dashboardIds: [],
    chartIds: [],
    datasetIds: [],
    databaseIds: [],
  };
});

test.afterEach(async ({ page }) => {
  // Reset locale to English
  await page.request.get('lang/en', { maxRedirects: 0 }).catch(() => {});

  // Cleanup in reverse creation order: charts → dashboards → datasets → databases
  // Sequential per group to respect FK constraints
  await Promise.all(
    testResources.chartIds.map(id =>
      apiDeleteChart(page, id, { failOnStatusCode: false }).catch(e =>
        console.warn(`[Cleanup] chart ${id}:`, String(e)),
      ),
    ),
  );
  await Promise.all(
    testResources.dashboardIds.map(id =>
      apiDeleteDashboard(page, id, { failOnStatusCode: false }).catch(e =>
        console.warn(`[Cleanup] dashboard ${id}:`, String(e)),
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
 * Build minimal position_json with a single chart component.
 */
function buildPositionJson(
  chartId: number,
  chartUuid: string,
  sliceName: string,
  dashboardTitle: string,
): string {
  return JSON.stringify({
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
    GRID_ID: {
      type: 'GRID',
      id: 'GRID_ID',
      children: ['ROW-test1'],
    },
    HEADER_ID: {
      type: 'HEADER',
      id: 'HEADER_ID',
      meta: { text: dashboardTitle },
    },
    'ROW-test1': {
      type: 'ROW',
      id: 'ROW-test1',
      children: ['CHART-test1'],
      meta: { background: 'BACKGROUND_TRANSPARENT' },
    },
    'CHART-test1': {
      type: 'CHART',
      id: 'CHART-test1',
      children: [],
      meta: {
        chartId,
        sliceName,
        uuid: chartUuid,
        width: 12,
        height: 50,
      },
    },
  });
}

test('should display localized chart title on dashboard when session locale has translation', async ({
  page,
}) => {
  const suffix = Date.now();

  // 1. Create test database and virtual dataset
  const dbId = await createTestDatabase(page, `test_chart_loc_db_${suffix}`);
  expect(dbId).not.toBeNull();
  testResources.databaseIds.push(dbId!);

  const datasetId = await createTestVirtualDataset(
    page,
    `test_chart_loc_ds_${suffix}`,
    dbId!,
  );
  expect(datasetId).not.toBeNull();
  testResources.datasetIds.push(datasetId!);

  // 2. Create chart and dashboard
  const originalTitle = `test_chart_loc_${suffix}`;
  const chart = await createTestChart(page, originalTitle, datasetId!);
  expect(chart).not.toBeNull();
  testResources.chartIds.push(chart!.id);

  const dashboardTitle = `test_dash_chart_loc_${suffix}`;
  const dashboardId = await createTestDashboard(page, dashboardTitle);
  expect(dashboardId).not.toBeNull();
  testResources.dashboardIds.push(dashboardId!);

  // 3. Associate chart with dashboard and set German translation
  const putChartRes = await apiPutChart(page, chart!.id, {
    dashboards: [dashboardId!],
    translations: { slice_name: { de: GERMAN_CHART_TITLE } },
  });
  expect(putChartRes.ok()).toBe(true);

  // 4. Set dashboard layout with the chart
  const putDashRes = await apiPutDashboard(page, dashboardId!, {
    position_json: buildPositionJson(
      chart!.id,
      chart!.uuid,
      originalTitle,
      dashboardTitle,
    ),
  });
  expect(putDashRes.ok()).toBe(true);

  // 5. Switch session locale to German
  await page.request.get('lang/de', { maxRedirects: 0 });

  // 6. Navigate to dashboard and verify localized chart title
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.gotoById(dashboardId!);
  await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });

  // Chart header should show German title
  const chartHeader = page.locator('[data-test="slice-header"]').first();
  await expect(chartHeader).toContainText(GERMAN_CHART_TITLE, {
    timeout: TIMEOUT.API_RESPONSE,
  });
});

test('should display original chart title when session locale has no translation', async ({
  page,
}) => {
  const suffix = Date.now();

  // 1. Create test database and virtual dataset
  const dbId = await createTestDatabase(page, `test_chart_orig_db_${suffix}`);
  expect(dbId).not.toBeNull();
  testResources.databaseIds.push(dbId!);

  const datasetId = await createTestVirtualDataset(
    page,
    `test_chart_orig_ds_${suffix}`,
    dbId!,
  );
  expect(datasetId).not.toBeNull();
  testResources.datasetIds.push(datasetId!);

  // 2. Create chart and dashboard
  const originalTitle = `test_chart_orig_${suffix}`;
  const chart = await createTestChart(page, originalTitle, datasetId!);
  expect(chart).not.toBeNull();
  testResources.chartIds.push(chart!.id);

  const dashboardTitle = `test_dash_chart_orig_${suffix}`;
  const dashboardId = await createTestDashboard(page, dashboardTitle);
  expect(dashboardId).not.toBeNull();
  testResources.dashboardIds.push(dashboardId!);

  // 3. Associate chart with dashboard and set German translation (no French)
  await apiPutChart(page, chart!.id, {
    dashboards: [dashboardId!],
    translations: { slice_name: { de: GERMAN_CHART_TITLE } },
  });

  // Set dashboard layout
  await apiPutDashboard(page, dashboardId!, {
    position_json: buildPositionJson(
      chart!.id,
      chart!.uuid,
      originalTitle,
      dashboardTitle,
    ),
  });

  // 4. Switch to French (no translation exists) — should fallback to original
  await page.request.get('lang/fr', { maxRedirects: 0 });

  // 5. Navigate and verify original title
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.gotoById(dashboardId!);
  await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });

  const chartHeader = page.locator('[data-test="slice-header"]').first();
  await expect(chartHeader).toContainText(originalTitle, {
    timeout: TIMEOUT.API_RESPONSE,
  });
});
