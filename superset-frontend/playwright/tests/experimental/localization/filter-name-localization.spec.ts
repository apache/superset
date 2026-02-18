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
 * Native Filter Name Localization E2E Tests
 *
 * Verifies that native filter names on a dashboard are displayed in the
 * user's session locale when translations exist in the filter configuration.
 *
 * Prerequisites:
 * - Superset running with ENABLE_CONTENT_LOCALIZATION = True
 * - Multiple LANGUAGES configured in superset_config.py
 * - Admin user authenticated (via global-setup)
 */

const ORIGINAL_FILTER_NAME = 'Year Filter';
const GERMAN_FILTER_NAME = 'Jahresfilter';

// File-scope state (reset in beforeEach)
let testResources: {
  dashboardIds: number[];
  datasetIds: number[];
  databaseIds: number[];
};

test.beforeEach(async () => {
  testResources = { dashboardIds: [], datasetIds: [], databaseIds: [] };
});

test.afterEach(async ({ page }) => {
  // Reset locale to English
  await page.request.get('lang/en', { maxRedirects: 0 }).catch(() => {});

  // Sequential per group to respect FK constraints
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
 * Build json_metadata with a native filter that has translations.
 */
function buildFilterMetadata(
  datasetId: number,
  filterName: string,
  translations: Record<string, string>,
): string {
  return JSON.stringify({
    native_filter_configuration: [
      {
        id: 'NATIVE_FILTER-test1',
        name: filterName,
        filterType: 'filter_select',
        targets: [{ datasetId, column: { name: 'id' } }],
        defaultDataMask: { filterState: {} },
        controlValues: {
          enableEmptyFilter: false,
          multiSelect: true,
          inverseSelection: false,
        },
        cascadeParentIds: [],
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
        translations: { name: translations },
      },
    ],
    show_native_filters: true,
  });
}

test('should display localized filter name on dashboard when session locale has translation', async ({
  page,
}) => {
  const suffix = Date.now();

  // 1. Create test database and virtual dataset (filter needs a valid datasource)
  const dbId = await createTestDatabase(page, `test_filter_loc_db_${suffix}`);
  expect(dbId).not.toBeNull();
  testResources.databaseIds.push(dbId!);

  const datasetId = await createTestVirtualDataset(
    page,
    `test_filter_loc_ds_${suffix}`,
    dbId!,
  );
  expect(datasetId).not.toBeNull();
  testResources.datasetIds.push(datasetId!);

  // 2. Create dashboard with native filter + German translation
  const dashboardTitle = `test_dash_filter_loc_${suffix}`;
  const dashboardId = await createTestDashboard(page, dashboardTitle);
  expect(dashboardId).not.toBeNull();
  testResources.dashboardIds.push(dashboardId!);

  const putRes = await apiPutDashboard(page, dashboardId!, {
    json_metadata: buildFilterMetadata(datasetId!, ORIGINAL_FILTER_NAME, {
      de: GERMAN_FILTER_NAME,
    }),
  });
  expect(putRes.ok()).toBe(true);

  // 3. Switch session locale to German
  await page.request.get('lang/de', { maxRedirects: 0 });

  // 4. Navigate to dashboard
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.gotoById(dashboardId!);
  await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });

  // 5. Verify filter name is localized
  const filterName = page.locator('[data-test="filter-control-name"]').first();
  await expect(filterName).toContainText(GERMAN_FILTER_NAME, {
    timeout: TIMEOUT.API_RESPONSE,
  });
});

test('should display original filter name when session locale has no translation', async ({
  page,
}) => {
  const suffix = Date.now();

  // 1. Create test database and virtual dataset
  const dbId = await createTestDatabase(page, `test_filter_orig_db_${suffix}`);
  expect(dbId).not.toBeNull();
  testResources.databaseIds.push(dbId!);

  const datasetId = await createTestVirtualDataset(
    page,
    `test_filter_orig_ds_${suffix}`,
    dbId!,
  );
  expect(datasetId).not.toBeNull();
  testResources.datasetIds.push(datasetId!);

  // 2. Create dashboard with native filter + only German translation
  const dashboardTitle = `test_dash_filter_orig_${suffix}`;
  const dashboardId = await createTestDashboard(page, dashboardTitle);
  expect(dashboardId).not.toBeNull();
  testResources.dashboardIds.push(dashboardId!);

  await apiPutDashboard(page, dashboardId!, {
    json_metadata: buildFilterMetadata(datasetId!, ORIGINAL_FILTER_NAME, {
      de: GERMAN_FILTER_NAME,
    }),
  });

  // 3. Switch to French (no translation) — should fallback to original
  await page.request.get('lang/fr', { maxRedirects: 0 });

  // 4. Navigate and verify original name
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.gotoById(dashboardId!);
  await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });

  const filterName = page.locator('[data-test="filter-control-name"]').first();
  await expect(filterName).toContainText(ORIGINAL_FILTER_NAME, {
    timeout: TIMEOUT.API_RESPONSE,
  });
});
