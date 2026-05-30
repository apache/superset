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

import { test, expect, devices } from '@playwright/test';
import { URL } from '../../utils/urls';
import { TIMEOUT } from '../../utils/constants';

/**
 * Mobile navigation tests verify the MobileRouteGuard behavior
 * and mobile-specific navigation patterns.
 *
 * These tests run with a mobile viewport to trigger mobile-specific behavior.
 */

// Use iPhone 12 viewport for mobile tests
const mobileViewport = devices['iPhone 12'];

test.describe('Mobile Navigation', () => {
  test.use({
    viewport: mobileViewport.viewport,
    userAgent: mobileViewport.userAgent,
  });

  test.beforeEach(async ({ page }) => {
    // Clear any previous bypass flags
    await page.goto('/');
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem('mobile-bypass');
      } catch {
        // Ignore storage errors
      }
    });
  });

  test('mobile viewport redirects from chart list to MobileUnsupported page', async ({
    page,
  }) => {
    // Navigate to chart list (not mobile-supported)
    await page.goto(URL.CHART_LIST);

    // Should show the MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });

    // Primary action buttons should be visible
    await expect(
      page.getByRole('button', { name: 'View Dashboards' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Go to Welcome Page' }),
    ).toBeVisible();
  });

  test('mobile viewport allows access to dashboard list', async ({ page }) => {
    // Navigate to dashboard list (mobile-supported)
    await page.goto(URL.DASHBOARD_LIST);

    // Should NOT show MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).not.toBeVisible({ timeout: TIMEOUT.FORM_LOAD });

    // Should show dashboard list content (look for dashboard list elements)
    await expect(
      page
        .locator('[data-test="listview-table"]')
        .or(page.locator('[data-test="styled-card"]'))
        .first(),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
  });

  test('mobile viewport allows access to welcome page', async ({ page }) => {
    // Navigate to welcome page (mobile-supported)
    await page.goto(URL.WELCOME);

    // Should NOT show MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).not.toBeVisible({ timeout: TIMEOUT.FORM_LOAD });

    // Should show welcome page content
    await expect(
      page.getByText('Recents').or(page.getByText('Dashboards')).first(),
    ).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });
  });

  test('View Dashboards button navigates to dashboard list', async ({
    page,
  }) => {
    // Navigate to unsupported route
    await page.goto(URL.CHART_LIST);

    // Wait for MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });

    // Click View Dashboards button
    await page.getByRole('button', { name: 'View Dashboards' }).click();

    // Should navigate to dashboard list
    await page.waitForURL(url => url.pathname.includes('dashboard/list'), {
      timeout: TIMEOUT.PAGE_LOAD,
    });

    // Dashboard list should be accessible
    await expect(
      page
        .locator('[data-test="listview-table"]')
        .or(page.locator('[data-test="styled-card"]'))
        .first(),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
  });

  test('Go to Welcome Page button navigates to welcome', async ({ page }) => {
    // Navigate to unsupported route
    await page.goto(URL.CHART_LIST);

    // Wait for MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });

    // Click Go to Welcome Page button
    await page.getByRole('button', { name: 'Go to Welcome Page' }).click();

    // Should navigate to welcome page
    await page.waitForURL(url => url.pathname.includes('superset/welcome'), {
      timeout: TIMEOUT.PAGE_LOAD,
    });
  });

  test('Continue anyway bypasses guard for the session', async ({ page }) => {
    // Navigate to unsupported route
    await page.goto(URL.CHART_LIST);

    // Wait for MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });

    // Click Continue anyway
    await page.getByText('Continue anyway').click();

    // Should navigate to the original destination
    await page.waitForURL(url => url.pathname.includes('chart/list'), {
      timeout: TIMEOUT.PAGE_LOAD,
    });

    // Verify bypass is set in sessionStorage
    const bypassValue = await page.evaluate(() =>
      sessionStorage.getItem('mobile-bypass'),
    );
    expect(bypassValue).toBe('true');

    // Navigate away and back - should still be bypassed
    await page.goto(URL.WELCOME);
    await page.goto(URL.CHART_LIST);

    // Should NOT show MobileUnsupported page anymore
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).not.toBeVisible({ timeout: TIMEOUT.FORM_LOAD });
  });

  test('SQL Lab is not accessible on mobile', async ({ page }) => {
    // Navigate to SQL Lab (not mobile-supported)
    await page.goto(URL.SQLLAB);

    // Should show the MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
  });
});

test.describe('Desktop Navigation (control group)', () => {
  // Use default desktop viewport

  test('desktop viewport allows access to all routes', async ({ page }) => {
    // Navigate to chart list
    await page.goto(URL.CHART_LIST);

    // Should NOT show MobileUnsupported page
    await expect(
      page.getByText("This view isn't available on mobile"),
    ).not.toBeVisible({ timeout: TIMEOUT.FORM_LOAD });

    // Should show chart list content
    await expect(
      page
        .locator('[data-test="listview-table"]')
        .or(page.locator('[data-test="styled-card"]'))
        .first(),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
  });
});
