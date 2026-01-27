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
 * Documentation Screenshot Tests
 *
 * Captures screenshots for the Superset documentation site.
 * Depends on example data loaded via `superset load_examples` in CI.
 *
 * Run with: INCLUDE_EXPERIMENTAL=true npx playwright test experimental/docs/
 *
 * Screenshots are saved to docs/static/img/screenshots/ for use in
 * the README and documentation site.
 */

import path from 'path';
import { test, expect } from '@playwright/test';
import { URL } from '../../../utils/urls';

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../../../docs/static/img/screenshots',
);

test('chart gallery screenshot', async ({ page }) => {
  await page.goto(URL.CHART_ADD);

  // Wait for chart creation page to load
  await expect(page.getByText('Choose chart type')).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('tab', { name: 'All charts' }).click();

  // Wait for viz gallery to render chart type thumbnails
  const vizGallery = page.locator('.viz-gallery');
  await expect(vizGallery).toBeVisible();
  await expect(
    vizGallery.locator('[data-test="viztype-selector-container"]').first(),
  ).toBeVisible();

  await page.addStyleTag({ content: 'body { zoom: 0.8 }' });
  await vizGallery.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'gallery.jpg'),
    type: 'jpeg',
  });
});

test('dashboard screenshot', async ({ page }) => {
  // Navigate to the World Bank dashboard via its slug (reliable example data)
  await page.goto('superset/dashboard/world_health/');

  // Wait for dashboard to fully render
  const dashboardWrapper = page.locator(
    '[data-test="dashboard-content-wrapper"]',
  );
  await expect(dashboardWrapper).toBeVisible({ timeout: 30000 });

  // Wait for charts to load inside the dashboard
  await expect(
    page.locator('.dashboard-component-chart-holder').first(),
  ).toBeVisible({ timeout: 15000 });

  // Allow charts a moment to finish rendering
  await page.waitForTimeout(3000);

  await page.addStyleTag({ content: 'body { zoom: 0.8 }' });
  await dashboardWrapper.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'dashboard.jpg'),
    type: 'jpeg',
  });
});

test('chart editor screenshot', async ({ page }) => {
  await page.goto(URL.CHART_LIST);

  // Wait for chart list to load
  const listView = page.locator('[data-test="listview-table"]');
  await expect(listView).toBeVisible({ timeout: 15000 });

  // Click the first chart link in the list to open explore
  const firstChartLink = page
    .locator('[data-test="table-row"] a[href*="/explore"]')
    .first();
  await expect(firstChartLink).toBeVisible();
  await firstChartLink.click();

  // Wait for explore page to fully load
  await page.waitForURL('**/explore/**', { timeout: 15000 });
  await expect(page.locator('[data-test="slice-container"]')).toBeVisible({
    timeout: 15000,
  });

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'explore.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

test('SQL Lab screenshot', async ({ page }) => {
  await page.goto(URL.SQLLAB);

  // Wait for SQL Lab editor to be ready
  const aceEditor = page.locator('.ace_content');
  await expect(aceEditor).toBeVisible({ timeout: 15000 });

  // Select the examples database
  const databaseSelect = page.getByRole('combobox', {
    name: /select database/i,
  });
  await expect(databaseSelect).toBeVisible();
  await databaseSelect.click();
  await page.getByText('examples', { exact: true }).click();

  // Select schema
  const schemaSelect = page.getByRole('combobox', {
    name: /select schema/i,
  });
  await expect(schemaSelect).toBeEnabled({ timeout: 10000 });
  await schemaSelect.click();
  // Use the first available schema option
  await page.getByRole('option').first().click();

  // Type a query in the editor
  await aceEditor.click();
  const editor = page.getByRole('textbox', { name: /cursor/i });
  await editor.fill('SELECT * FROM birth_names LIMIT 100');

  // Run the query
  const runButton = page.locator('[data-test="run-query-action"]');
  await expect(runButton).toBeVisible();
  await runButton.click();

  // Wait for results table to appear (not networkidle which hangs on WebSockets)
  await expect(page.locator('.ReactVirtualized__Table')).toBeVisible({
    timeout: 30000,
  });

  // Click editor area to deselect results
  await aceEditor.click();

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'sql_lab.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});
