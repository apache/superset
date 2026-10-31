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
 * Regression coverage for the Home page's "Recents" panel after a
 * dashboard/chart is deleted from the Dashboards or Charts card list.
 *
 * Before this fix, deleting an item from some tabs (notably Mine) could
 * leave its stale "Viewed" entry sitting in Recents after the delete had
 * already succeeded, which reads as if the delete silently failed. Each
 * test here creates a throwaway dashboard/chart, views it to seed a real
 * Recents entry, deletes it from a specific tab, and asserts the Recents
 * entry disappears promptly rather than polling/sleeping for a fixed
 * window -- a regression that reintroduces staleness should fail here
 * instead of flaking.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { apiPostChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';
import { apiPost } from '../../helpers/api/requests';
import { DashboardPage } from '../../pages/DashboardPage';
import { ExplorePage } from '../../pages/ExplorePage';
import { HomePage, HomeListTab } from '../../pages/HomePage';
import { Toast } from '../../components/core';
import { TIMEOUT } from '../../utils/constants';

// Uncomment to force video recording when running this file locally (e.g. to
// produce a demo recording). CI relies on the 'retain-on-failure' policy in
// playwright.config.ts instead, so this stays off for the contributed test.
// testWithAssets.use({ video: 'on' });

const DATASET_NAME = 'birth_names';

/** Short, readable, still worker-unique: no epoch timestamps in the title. */
function assetName(prefix: string, testInfo: { parallelIndex: number }) {
  return `${prefix}_${testInfo.parallelIndex}`;
}

for (const tab of ['Favorite', 'Mine', 'All'] as HomeListTab[]) {
  testWithAssets(
    `deleting a dashboard from the ${tab} tab refreshes Recents`,
    async ({ page, testAssets }, testInfo) => {
      const name = assetName(`PR_Dash_${tab}`, testInfo);

      const createResp = await apiPostDashboard(page, {
        dashboard_title: name,
      });
      expect(createResp.ok()).toBe(true);
      const { id: dashboardId } = await createResp.json();
      testAssets.trackDashboard(dashboardId);

      if (tab === 'Favorite') {
        const favResp = await apiPost(
          page,
          `api/v1/dashboard/${dashboardId}/favorites/`,
        );
        expect(favResp.ok()).toBe(true);
      }

      // View it so a "mount_dashboard" log entry seeds a real Recents card.
      // Logging is debounced client-side (loggerMiddleware batches events up
      // to 1s before sending), so wait for the actual beacon request rather
      // than assuming it has landed once the page itself has loaded.
      const dashboardPage = new DashboardPage(page);
      const logRequest = page.waitForResponse(
        resp =>
          resp.request().method() === 'POST' &&
          resp.url().includes('/log/') &&
          (resp.request().postData() ?? '').includes('mount_dashboard'),
        { timeout: TIMEOUT.API_RESPONSE },
      );
      await dashboardPage.gotoById(dashboardId);
      await dashboardPage.waitForLoad();
      await logRequest;

      const homePage = new HomePage(page);
      await homePage.goto();
      await homePage.expandRecents();

      await expect(async () => {
        expect(await homePage.getRecentsViewedCount(name)).toBeGreaterThan(0);
      }).toPass({ timeout: TIMEOUT.API_RESPONSE });

      await homePage.switchTab('Dashboards', tab);
      await expect(homePage.getCard('Dashboards', name)).toBeVisible();

      await homePage.deleteCardViaMenu(
        'Dashboards',
        name,
        'dashboard-card-menu',
        'dashboard-card-option-delete-button',
      );

      const toast = new Toast(page);
      await expect(toast.getSuccess()).toBeVisible();

      await expect(homePage.getCard('Dashboards', name)).toHaveCount(0);
      await expect(async () => {
        expect(await homePage.getRecentsViewedCount(name)).toBe(0);
      }).toPass({ timeout: TIMEOUT.API_RESPONSE });
    },
  );
}

for (const tab of ['Favorite', 'Mine', 'All'] as HomeListTab[]) {
  testWithAssets(
    `deleting a chart from the ${tab} tab refreshes Recents`,
    async ({ page, testAssets }, testInfo) => {
      testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
      const name = assetName(`PR_Chart_${tab}`, testInfo);

      const dataset = await getDatasetByName(page, DATASET_NAME);
      if (!dataset) {
        throw new Error(`Dataset ${DATASET_NAME} not found`);
      }

      const createResp = await apiPostChart(page, {
        slice_name: name,
        viz_type: 'table',
        datasource_id: dataset.id,
        datasource_type: 'table',
        params: JSON.stringify({
          viz_type: 'table',
          datasource: `${dataset.id}__table`,
          query_mode: 'aggregate',
          groupby: ['name'],
          metrics: ['count'],
          adhoc_filters: [],
          row_limit: 5,
        }),
      });
      expect(createResp.ok()).toBe(true);
      const chartBody = await createResp.json();
      const chartId: number = chartBody.result?.id ?? chartBody.id;
      testAssets.trackChart(chartId);

      if (tab === 'Favorite') {
        const favResp = await apiPost(
          page,
          `api/v1/chart/${chartId}/favorites/`,
        );
        expect(favResp.ok()).toBe(true);
      }

      // View it in Explore so a "mount_explorer" log entry seeds a real
      // Recents card. See the dashboard test above for why this waits for
      // the actual (debounced) log beacon rather than just the page load.
      const explorePage = new ExplorePage(page);
      const logRequest = page.waitForResponse(
        resp =>
          resp.request().method() === 'POST' &&
          resp.url().includes('/log/') &&
          (resp.request().postData() ?? '').includes('mount_explorer'),
        { timeout: TIMEOUT.API_RESPONSE },
      );
      await explorePage.goto(chartId);
      await logRequest;

      const homePage = new HomePage(page);
      await homePage.goto();
      await homePage.expandRecents();

      await expect(async () => {
        expect(await homePage.getRecentsViewedCount(name)).toBeGreaterThan(0);
      }).toPass({ timeout: TIMEOUT.API_RESPONSE });

      await homePage.switchTab('Charts', tab);
      await expect(homePage.getCard('Charts', name)).toBeVisible();

      await homePage.deleteCardViaMenu(
        'Charts',
        name,
        'chart-card-menu',
        'chart-list-delete-option',
      );

      const toast = new Toast(page);
      await expect(toast.getSuccess()).toBeVisible();

      await expect(homePage.getCard('Charts', name)).toHaveCount(0);
      await expect(async () => {
        expect(await homePage.getRecentsViewedCount(name)).toBe(0);
      }).toPass({ timeout: TIMEOUT.API_RESPONSE });
    },
  );
}
