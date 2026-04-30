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
 * Fullscreen toggle E2E tests.
 *
 * Regression tests for subdirectory deployments: when Superset runs at a path
 * prefix (e.g. /pcs), the fullscreen toggle must not duplicate the prefix in
 * the URL (sc-103933).
 */

import { testWithAssets as test, expect } from '../../helpers/fixtures';
import { DashboardPage } from '../../pages/DashboardPage';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { TIMEOUT } from '../../utils/constants';

test('toggling fullscreen adds standalone param without duplicating path segments', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(TIMEOUT.SLOW_TEST);

  // Create a minimal dashboard to test against
  const dashboardResponse = await apiPostDashboard(page, {
    dashboard_title: `test_fullscreen_${Date.now()}`,
    published: true,
  });
  expect(dashboardResponse.status()).toBe(201);
  const { id: dashboardId } = await dashboardResponse.json();
  testAssets.trackDashboard(dashboardId);

  const dashboardPage = new DashboardPage(page);
  await dashboardPage.gotoById(dashboardId);
  await dashboardPage.waitForLoad();

  // Record the pathname before toggling (should be something like /superset/dashboard/N/)
  const pathBefore = new URL(page.url()).pathname;

  // Open the three-dot menu and click "Enter fullscreen"
  await dashboardPage.openHeaderActionsMenu();
  await page.getByText('Enter fullscreen').click();

  // Wait for the URL to update with standalone param
  await page.waitForURL(/standalone=1/, { timeout: TIMEOUT.API_RESPONSE });

  const urlAfter = new URL(page.url());

  // The pathname must not have grown — i.e. no segment was duplicated
  expect(urlAfter.pathname).toBe(pathBefore);

  // standalone=1 must be present
  expect(urlAfter.searchParams.get('standalone')).toBe('1');

  // The dashboard header must still be visible (not a blank page)
  await expect(
    page.locator('[data-test="dashboard-header-container"]'),
  ).toBeVisible();
});

test('toggling fullscreen off removes standalone param without duplicating path segments', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(TIMEOUT.SLOW_TEST);

  const dashboardResponse = await apiPostDashboard(page, {
    dashboard_title: `test_fullscreen_exit_${Date.now()}`,
    published: true,
  });
  expect(dashboardResponse.status()).toBe(201);
  const { id: dashboardId } = await dashboardResponse.json();
  testAssets.trackDashboard(dashboardId);

  const dashboardPage = new DashboardPage(page);
  // Navigate directly into fullscreen mode
  await page.goto(`superset/dashboard/${dashboardId}/?standalone=1`);
  await dashboardPage.waitForLoad();

  const pathBefore = new URL(page.url()).pathname;

  // Open the three-dot menu and click "Exit fullscreen"
  await dashboardPage.openHeaderActionsMenu();
  await page.getByText('Exit fullscreen').click();

  // Wait for standalone param to disappear
  await page.waitForFunction(
    () => !new URL(window.location.href).searchParams.has('standalone'),
    { timeout: TIMEOUT.API_RESPONSE },
  );

  const urlAfter = new URL(page.url());

  // Pathname must be unchanged — no duplicated segment
  expect(urlAfter.pathname).toBe(pathBefore);
  expect(urlAfter.searchParams.get('standalone')).toBeNull();

  // Dashboard must still be rendered
  await expect(
    page.locator('[data-test="dashboard-header-container"]'),
  ).toBeVisible();
});
