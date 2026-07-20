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
 * Mobile Experience Documentation Screenshot Generator
 *
 * Captures phone-sized screenshots for the mobile consumption mode docs
 * (docs/docs/using-superset/mobile-experience.mdx). Depends on example data
 * loaded via `superset load_examples` AND the MOBILE_CONSUMPTION_MODE
 * feature flag being enabled in the target environment:
 *
 *   FEATURE_FLAGS = {"MOBILE_CONSUMPTION_MODE": True}
 *
 * Run locally:
 *   cd superset-frontend
 *   PLAYWRIGHT_BASE_URL=http://localhost:8088 PLAYWRIGHT_ADMIN_PASSWORD=admin npm run docs:screenshots
 *
 * Screenshots are saved under docs/static/img/screenshots/mobile/.
 */

import path from 'path';
import { Page, test, expect } from '@playwright/test';
import { URL } from '../../utils/urls';

const MOBILE_SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../../docs/static/img/screenshots/mobile',
);

// iPhone 12-class viewport; 2x scale factor for crisp docs images
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
});

/**
 * Waits for animations and async renders to settle before taking a
 * screenshot. ECharts entry animations, drawer transitions, and image
 * lazy-loading require a short pause that can't be expressed as a
 * deterministic wait condition.
 */
async function settle(page: Page, ms = 1000): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Opens the Sales Dashboard (from example data) at phone size and waits for
 * the stacked charts to finish rendering.
 */
async function openSalesDashboardMobile(page: Page): Promise<void> {
  await page.goto(URL.DASHBOARD_LIST);
  // Mobile list is card-only; cards navigate on tap (titles are plain
  // text, not links, in consumption mode)
  const dashboardCard = page.getByText('Sales Dashboard', { exact: true });
  await expect(dashboardCard.first()).toBeVisible({ timeout: 15000 });
  await dashboardCard.first().click();

  await expect(
    page.locator('[data-test="dashboard-content-wrapper"]'),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.locator('.dashboard-component-chart-holder canvas').first(),
  ).toBeVisible({ timeout: 30000 });
}

test('mobile dashboard screenshot', async ({ page }) => {
  await openSalesDashboardMobile(page);
  await settle(page, 2000);
  await page.screenshot({
    path: path.join(MOBILE_SCREENSHOTS_DIR, 'mobile_dashboard.jpg'),
    type: 'jpeg',
  });
});

test('mobile dashboard filter drawer screenshot', async ({ page }) => {
  await openSalesDashboardMobile(page);

  const filterTrigger = page.locator('[data-test="mobile-filters-trigger"]');
  await expect(filterTrigger).toBeVisible({ timeout: 15000 });
  await filterTrigger.click();

  // Wait for the drawer and its filter controls to render
  await expect(page.locator('.ant-drawer-body')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('[data-test="filter-bar"]')).toBeVisible({
    timeout: 10000,
  });
  // Park the pointer so no hover card is open in the capture
  await page.mouse.move(5, 830);
  await settle(page);
  await page.screenshot({
    path: path.join(MOBILE_SCREENSHOTS_DIR, 'mobile_filter_drawer.jpg'),
    type: 'jpeg',
  });
});

test('mobile dashboard list screenshot', async ({ page }) => {
  await page.goto(URL.DASHBOARD_LIST);
  // Card view is forced on mobile; wait for cards to render
  await expect(page.locator('[data-test="styled-card"]').first()).toBeVisible({
    timeout: 15000,
  });
  await settle(page);
  await page.screenshot({
    path: path.join(MOBILE_SCREENSHOTS_DIR, 'mobile_dashboard_list.jpg'),
    type: 'jpeg',
  });
});

test('mobile home screenshot', async ({ page }) => {
  await page.goto(URL.WELCOME);
  await expect(page.getByText('Recents')).toBeVisible({ timeout: 15000 });
  await settle(page, 2000);
  await page.screenshot({
    path: path.join(MOBILE_SCREENSHOTS_DIR, 'mobile_home.jpg'),
    type: 'jpeg',
  });
});

test('mobile navigation drawer screenshot', async ({ page }) => {
  await page.goto(URL.WELCOME);
  await expect(page.getByText('Recents')).toBeVisible({ timeout: 15000 });

  const menuButton = page.getByRole('button', { name: 'Menu' });
  await expect(menuButton).toBeVisible({ timeout: 10000 });
  await menuButton.click();

  await expect(page.locator('.ant-drawer-body')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Dashboards').first()).toBeVisible();
  await settle(page);
  await page.screenshot({
    path: path.join(MOBILE_SCREENSHOTS_DIR, 'mobile_nav_drawer.jpg'),
    type: 'jpeg',
  });
});

test('mobile unsupported route screenshot', async ({ page }) => {
  await page.goto(URL.SQLLAB);
  await expect(
    page.getByText("This view isn't available on mobile"),
  ).toBeVisible({ timeout: 15000 });
  await settle(page);
  await page.screenshot({
    path: path.join(MOBILE_SCREENSHOTS_DIR, 'mobile_unsupported.jpg'),
    type: 'jpeg',
  });
});
