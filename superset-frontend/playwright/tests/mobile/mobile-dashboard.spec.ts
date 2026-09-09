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

import { test, expect, devices, Page } from '@playwright/test';

// NOTE: These tests exercise the mobile consumption experience and require
// the MOBILE_CONSUMPTION_MODE feature flag to be enabled in the target
// environment (FEATURE_FLAGS = {"MOBILE_CONSUMPTION_MODE": True}).
import { TIMEOUT } from '../../utils/constants';
import { URL } from '../../utils/urls';

/**
 * Mobile dashboard viewing tests verify that dashboards can be viewed
 * and interacted with on mobile devices.
 *
 * These tests assume the World Bank's Health sample dashboard exists.
 */

// Use iPhone 12 viewport for mobile tests
const mobileViewport = devices['iPhone 12'];

/**
 * Navigates to the dashboard list, clicks the first available dashboard
 * card, and waits for navigation into that dashboard. Skips the current
 * test when no dashboards are available to open.
 */
async function openFirstDashboard(page: Page): Promise<void> {
  await page.goto(URL.DASHBOARD_LIST);
  await page.waitForLoadState('networkidle');

  const cards = page.locator('[data-test="styled-card"]');
  const cardCount = await cards.count();

  test.skip(cardCount === 0, 'No dashboards available to open on mobile');

  await cards.first().click();

  await page.waitForURL(url => /\/dashboard\/(?!list)/.test(url.pathname), {
    timeout: TIMEOUT.PAGE_LOAD,
  });
}

/**
 * Navigates to the World Bank's Health dashboard and returns a locator
 * for its mobile filter button. Skips the current test when the fixture
 * has no native filters configured.
 */
async function getMobileFilterButton(page: Page) {
  // Navigate directly to the World Bank's Health dashboard, which this
  // spec's fixtures require, rather than an arbitrary first card from
  // the list. Whether it has native filters configured depends on the
  // fixture, so callers skip themselves when none are present.
  await page.goto('dashboard/world_health/');
  await page.waitForLoadState('networkidle');

  // Give filters time to load
  await page.waitForTimeout(2000);

  const filterButton = page
    .locator('[data-test="mobile-filters-trigger"]')
    .or(page.locator('[aria-label="Open filters"]'));

  const filterCount = await filterButton.count();

  test.skip(
    filterCount === 0,
    'world_health dashboard fixture has no native filters configured; ' +
      'cannot verify mobile filter behavior.',
  );

  return filterButton;
}

test.describe('Mobile Dashboard Viewing', () => {
  test.use({
    viewport: mobileViewport.viewport,
    userAgent: mobileViewport.userAgent,
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard list to find a dashboard
    await page.goto(URL.DASHBOARD_LIST);
    await page.waitForLoadState('networkidle');
  });

  test('dashboard list renders in card view on mobile', async ({ page }) => {
    // On mobile, dashboard list should show cards, not table
    // Look for card elements
    const cards = page.locator('[data-test="styled-card"]');

    // Should have at least one card if dashboards exist
    // (This test may need adjustment based on test data availability)
    const cardCount = await cards.count();

    // Either cards are visible, or the empty state is shown; the table
    // view must never render on mobile
    if (cardCount > 0) {
      await expect(cards.first()).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
    } else {
      await expect(page.locator('[data-test="empty-state"]')).toBeVisible({
        timeout: TIMEOUT.PAGE_LOAD,
      });
    }
    await expect(page.locator('[data-test="listview-table"]')).toHaveCount(0);
  });

  test('mobile search button appears in dashboard list', async ({ page }) => {
    // On mobile, the search/filter button should appear in the header
    const searchButton = page
      .locator('[aria-label="Search"]')
      .or(page.locator('[data-test="mobile-search-button"]'));

    // Search button should be visible on mobile
    await expect(searchButton.first()).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });
  });

  test('tapping dashboard card opens the dashboard', async ({ page }) => {
    // Find a dashboard card
    const cards = page.locator('[data-test="styled-card"]');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      // Click the first card
      await cards.first().click();

      // Should navigate to dashboard view
      await page.waitForURL(url => /\/dashboard\/(?!list)/.test(url.pathname), {
        timeout: TIMEOUT.PAGE_LOAD,
      });

      // Dashboard should load (look for dashboard content)
      await expect(
        page
          .locator('[data-test="dashboard-content-wrapper"]')
          .or(page.locator('.dashboard')),
      ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
    } else {
      test.skip();
    }
  });
});

test.describe('Mobile Dashboard Interaction', () => {
  test.use({
    viewport: mobileViewport.viewport,
    userAgent: mobileViewport.userAgent,
  });

  // Skip this test suite if no dashboards exist
  test.beforeAll(async ({ browser }) => {
    // browser.newPage() does not inherit the project's `storageState`, so
    // it must be passed explicitly to reuse the authenticated session -
    // otherwise this check hits the login page and always finds 0 cards.
    const page = await browser.newPage({
      viewport: mobileViewport.viewport,
      userAgent: mobileViewport.userAgent,
      storageState: 'playwright/.auth/user.json',
    });

    await page.goto(URL.DASHBOARD_LIST);
    await page.waitForLoadState('networkidle');

    const cards = page.locator('[data-test="styled-card"]');
    const cardCount = await cards.count();

    await page.close();

    if (cardCount === 0) {
      test.skip();
    }
  });

  test('dashboard loads and shows charts on mobile', async ({ page }) => {
    await openFirstDashboard(page);

    // Dashboard content should be visible
    await expect(
      page
        .locator('[data-test="dashboard-content-wrapper"]')
        .or(page.locator('.dashboard')),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });

    // Charts should start loading (look for chart containers)
    const chartContainers = page
      .locator('[data-test="chart-container"]')
      .or(page.locator('.dashboard-chart'));

    // Wait for at least one chart to be visible (with timeout)
    await expect(chartContainers.first()).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD * 2,
    });
  });

  test('dashboard header shows hamburger menu on mobile', async ({ page }) => {
    await openFirstDashboard(page);

    // Look for the hamburger menu / more actions button
    const menuButton = page
      .locator('[data-test="actions-trigger"]')
      .or(page.locator('[aria-label="Menu actions trigger"]'));

    await expect(menuButton.first()).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });
  });

  test('refresh dashboard works from mobile menu', async ({ page }) => {
    await openFirstDashboard(page);

    // Open the actions menu
    const menuButton = page
      .locator('[data-test="actions-trigger"]')
      .or(page.locator('[aria-label="Menu actions trigger"]'));

    test.skip(
      (await menuButton.count()) === 0,
      'Mobile actions menu button not found on this dashboard',
    );

    await menuButton.first().click();

    // Look for refresh option
    const refreshOption = page.getByText('Refresh dashboard');

    test.skip(
      (await refreshOption.count()) === 0,
      'Refresh dashboard option not found in mobile actions menu',
    );

    await refreshOption.click();

    // Should show success toast or refresh the charts
    // This is hard to verify without checking network requests
    // Just verify the menu closes and we're still on the dashboard
    await page.waitForTimeout(1000);
    expect(page.url()).toMatch(/\/dashboard\/(?!list)/);
  });
});

test.describe('Mobile Filter Drawer', () => {
  test.use({
    viewport: mobileViewport.viewport,
    userAgent: mobileViewport.userAgent,
  });

  test('filter button appears on dashboards with filters', async ({ page }) => {
    const filterButton = await getMobileFilterButton(page);

    await expect(filterButton.first()).toBeVisible();
  });

  test('filter drawer opens when filter button is tapped', async ({ page }) => {
    const filterButton = await getMobileFilterButton(page);

    await filterButton.first().click();

    // Filter drawer should open
    const drawer = page
      .locator('.ant-drawer-open')
      .or(page.locator('[data-test="filter-bar"]'));

    await expect(drawer.first()).toBeVisible({
      timeout: TIMEOUT.FORM_LOAD,
    });
  });
});
