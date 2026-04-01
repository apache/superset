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
import { AuthPage } from '../../pages/AuthPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { apiPostTheme, apiDeleteTheme } from '../../helpers/api/theme';
import {
  apiPostDashboard,
  apiPutDashboard,
  apiDeleteDashboard,
} from '../../helpers/api/dashboard';
import { apiGet } from '../../helpers/api/requests';
import { TIMEOUT } from '../../utils/constants';

/**
 * Dashboard Theme E2E tests.
 *
 * Prerequisites:
 * - Superset running with example data loaded
 * - Admin user authenticated (via global-setup)
 * - Non-admin test user created by `superset load-test-users`
 *
 * Credentials are configurable via environment variables:
 * - PLAYWRIGHT_NONADMIN_USERNAME (default: 'gamma')
 * - PLAYWRIGHT_NONADMIN_PASSWORD (default: 'general')
 */

const NONADMIN_USERNAME = process.env.PLAYWRIGHT_NONADMIN_USERNAME || 'gamma';
const NONADMIN_PASSWORD = process.env.PLAYWRIGHT_NONADMIN_PASSWORD || 'general';

// Clear storageState so the default page fixture starts unauthenticated.
// Admin API calls use an explicit admin context with saved auth instead.
test.use({ storageState: { cookies: [], origins: [] } });

test('non-admin user can view a themed dashboard without 403 or infinite spinner', async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);

  // --- ADMIN SETUP (explicit admin context with saved auth) ---
  const adminContext = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: 'playwright/.auth/user.json',
  });
  const adminPage = await adminContext.newPage();

  let themeId: number | undefined;
  let dashboardId: number | undefined;

  try {
    // 1. Create a theme
    const themeRes = await apiPostTheme(adminPage, {
      theme_name: `e2e_theme_test_${Date.now()}`,
      json_data: '{}',
    });
    expect(themeRes.ok()).toBe(true);
    const themeBody = await themeRes.json();
    themeId = themeBody.id;
    expect(themeId).toBeTruthy();

    // 2. Create a published dashboard with the theme assigned
    const dashRes = await apiPostDashboard(adminPage, {
      dashboard_title: `E2E Theme Test ${Date.now()}`,
      published: true,
      theme_id: themeId,
    });
    expect(dashRes.ok()).toBe(true);
    const dashBody = await dashRes.json();
    dashboardId = dashBody.id;
    expect(dashboardId).toBeTruthy();

    // 3. Grant non-admin user access by adding them as a dashboard editor
    const usersRes = await apiGet(
      adminPage,
      `api/v1/dashboard/related/editors?q=(filter:'${NONADMIN_USERNAME}')`,
    );
    expect(usersRes.ok()).toBe(true);
    const usersBody = await usersRes.json();
    const gammaSubjectId = usersBody.result?.[0]?.value;
    expect(gammaSubjectId).toBeTruthy();
    const putRes = await apiPutDashboard(adminPage, dashboardId!, {
      editors: [gammaSubjectId],
    });
    expect(putRes.ok()).toBe(true);

    // --- NON-ADMIN USER PHASE (page has no cached auth via test.use) ---

    // 4. Instrument network: track any /api/v1/theme/ requests and 403 responses
    const themeApiRequests: string[] = [];
    const forbiddenResponses: string[] = [];
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/v1/theme/')) {
        themeApiRequests.push(url);
      }
      if (response.status() === 403 && url.includes('/api/v1/theme/')) {
        forbiddenResponses.push(url);
      }
    });

    // 5. Login as non-admin user
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.waitForLoginForm();
    await authPage.loginWithCredentials(NONADMIN_USERNAME, NONADMIN_PASSWORD);
    await authPage.waitForLoginSuccess();

    // 6. Navigate to the themed dashboard
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId!);

    // 7. Assert dashboard fully loads (not stuck on infinite spinner)
    await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });
    await dashboardPage.waitForChartsToLoad();

    // 8. Assert no /api/v1/theme/ requests were made (theme data comes from dashboard response)
    expect(themeApiRequests).toHaveLength(0);
    // Assert no 403 responses on /api/v1/theme/ (scoped to avoid login/unrelated 403 noise)
    expect(forbiddenResponses).toHaveLength(0);
  } finally {
    // Cleanup: delete test resources using admin context
    if (dashboardId) {
      await apiDeleteDashboard(adminPage, dashboardId, {
        failOnStatusCode: false,
      }).catch(() => {});
    }
    if (themeId) {
      await apiDeleteTheme(adminPage, themeId, {
        failOnStatusCode: false,
      }).catch(() => {});
    }
    await adminContext.close();
  }
});
