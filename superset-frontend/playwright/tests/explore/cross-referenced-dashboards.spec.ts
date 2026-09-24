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

/**
 * Migrated from the Cypress "Cross-referenced dashboards" suite in
 * explore/chart.test.js. The original did 11 sequential UI saves; this
 * version UI-saves to the first two dashboards (covering the singular vs.
 * plural metadata text and the submenu listing), then attaches the rest via
 * the API to reach the SEARCH_THRESHOLD (10) search-input behavior.
 */
import type { Page } from '@playwright/test';
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPutChart } from '../../helpers/api/chart';
import { createTestDashboard } from '../dashboard/dashboard-test-helpers';
import { waitForPut } from '../../helpers/api/intercepts';
import { ExplorePage } from '../../pages/ExplorePage';
import { TIMEOUT } from '../../utils/constants';
import { createExploreTestChart } from './explore-test-helpers';

const TOTAL_DASHBOARDS = 11; // > SEARCH_THRESHOLD (10) to exercise the search input

/** Overwrites the open chart, adding it to an existing dashboard via the Save modal. */
async function overwriteToDashboard(
  page: Page,
  explorePage: ExplorePage,
  chartId: number,
  dashboardName: string,
): Promise<void> {
  const saveModal = await explorePage.openSaveModal();
  await saveModal.selectSaveAction('overwrite');
  await saveModal.selectDashboard(dashboardName);
  const updated = waitForPut(page, `api/v1/chart/${chartId}`, {
    pathMatch: true,
  });
  await saveModal.clickSave();
  expect((await updated).ok()).toBe(true);
  await explorePage.waitForPageLoad();
}

testWithAssets(
  'chart metadata bar and "On dashboards" submenu reflect dashboard membership',
  async ({ page, testAssets }, testInfo) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const { id: chartId } = await createExploreTestChart(
      page,
      testAssets,
      testInfo,
      { prefix: 'xref_chart' },
    );

    const explorePage = new ExplorePage(page);
    await explorePage.goto(chartId);

    // Initial state: not on any dashboard.
    await expect(explorePage.getDashboardsMetadataText()).toHaveText(
      'Not added to any dashboard',
    );
    const submenuEmpty = await explorePage.openDashboardsSubmenu();
    await expect(submenuEmpty.getByText('None', { exact: true })).toBeVisible();
    await explorePage.closeActionsMenu();

    // Create dashboards 1 and 2 up front so the UI-save select can find them.
    const dashboard1 = await createTestDashboard(page, testAssets, testInfo, {
      prefix: 'xref_dash_1',
    });
    const dashboard2 = await createTestDashboard(page, testAssets, testInfo, {
      prefix: 'xref_dash_2',
    });

    // UI-save to dashboard 1: verifies singular metadata text.
    await overwriteToDashboard(page, explorePage, chartId, dashboard1.name);

    await expect(explorePage.getDashboardsMetadataText()).toHaveText(
      'Added to 1 dashboard',
    );

    // UI-save to dashboard 2: verifies plural metadata text and that both
    // dashboards are listed in the submenu.
    await overwriteToDashboard(page, explorePage, chartId, dashboard2.name);

    await expect(explorePage.getDashboardsMetadataText()).toHaveText(
      'Added to 2 dashboards',
    );

    const submenuTwo = await explorePage.openDashboardsSubmenu();
    await expect(
      submenuTwo.getByText(dashboard1.name, { exact: true }),
    ).toBeVisible();
    await expect(
      submenuTwo.getByText(dashboard2.name, { exact: true }),
    ).toBeVisible();
    await explorePage.closeActionsMenu();

    // Attach the remaining dashboards via the API (PUT replaces the full
    // dashboard list, so dashboard1/dashboard2 must be included again).
    const remainingCount = TOTAL_DASHBOARDS - 2;
    const remainingDashboards = [];
    for (let i = 0; i < remainingCount; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const dash = await createTestDashboard(page, testAssets, testInfo, {
        prefix: `xref_dash_${i + 3}`,
      });
      remainingDashboards.push(dash);
    }
    const allDashboardIds = [
      dashboard1.id,
      dashboard2.id,
      ...remainingDashboards.map(d => d.id),
    ];
    const putResp = await apiPutChart(page, chartId, {
      dashboards: allDashboardIds,
    });
    expect(putResp.ok()).toBe(true);

    // Reload explore to pick up the new metadata via GET /api/v1/explore/.
    await page.reload();
    await explorePage.waitForPageLoad();

    await expect(explorePage.getDashboardsMetadataText()).toHaveText(
      `Added to ${TOTAL_DASHBOARDS} dashboards`,
    );

    // Search: a matching term narrows the list to the matching dashboard(s).
    const submenuFull = await explorePage.openDashboardsSubmenu();
    const searchInput = submenuFull.locator('input[placeholder="Search"]');
    await searchInput.fill(dashboard1.name, { force: true });
    await expect(
      submenuFull.getByText(dashboard1.name, { exact: true }),
    ).toBeVisible();
    await expect(
      submenuFull.getByText(dashboard2.name, { exact: true }),
    ).not.toBeVisible();

    // Gibberish search yields "No results found".
    await searchInput.fill('zzz_no_such_dashboard_zzz', { force: true });
    await expect(
      submenuFull.getByText('No results found', { exact: true }),
    ).toBeVisible();

    // Clearing the search resets the full list.
    const clearIcon = submenuFull.locator('.ant-input-clear-icon');
    await clearIcon.click({ force: true });
    await expect(
      submenuFull.getByText(dashboard1.name, { exact: true }),
    ).toBeVisible();

    // The first dashboard's link opens it (in a new tab) at the right URL.
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      submenuFull.getByText(dashboard1.name, { exact: true }).click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toContain(`/dashboard/${dashboard1.id}`);
    await popup.close();
  },
);
