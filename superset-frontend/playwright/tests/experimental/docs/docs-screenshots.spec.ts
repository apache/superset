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
  // Navigate to Sales Dashboard via the dashboard list (slug is null)
  await page.goto(URL.DASHBOARD_LIST);
  const searchInput = page.getByPlaceholder('Type a value');
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill('Sales Dashboard');
  await searchInput.press('Enter');

  // Click the Sales Dashboard link
  const dashboardLink = page.getByRole('link', { name: /sales dashboard/i });
  await expect(dashboardLink).toBeVisible({ timeout: 10000 });
  await dashboardLink.click();

  // Wait for dashboard to fully render
  const dashboardWrapper = page.locator(
    '[data-test="dashboard-content-wrapper"]',
  );
  await expect(dashboardWrapper).toBeVisible({ timeout: 30000 });

  // Wait for chart holders to appear, then wait for all loading spinners to clear
  await expect(
    page.locator('.dashboard-component-chart-holder').first(),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    dashboardWrapper.locator('[data-test="loading-indicator"]'),
  ).toHaveCount(0, { timeout: 30000 });

  // Open the filter bar (collapsed by default)
  const expandButton = page.locator(
    '[data-test="filter-bar-expand-button"]',
  );
  if (await expandButton.isVisible()) {
    await expandButton.click();
  }

  // Allow filter bar animation and final chart paint to settle
  await page.waitForTimeout(2000);

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
  const sliceContainer = page.locator('[data-test="slice-container"]');
  await expect(sliceContainer).toBeVisible({ timeout: 15000 });

  // Wait for the chart to finish rendering (loading spinners clear)
  await expect(
    sliceContainer.locator('[data-test="loading-indicator"]'),
  ).toHaveCount(0, { timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'explore.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

test('SQL Lab screenshot', async ({ page }) => {
  await page.goto(URL.SQLLAB);

  // SQL Lab may open with no active query tab — create one if needed
  const addTabButton = page.getByRole('tab', { name: /add a new tab/i });
  const aceEditor = page.locator('.ace_content');

  // Wait for either the editor or the "add tab" prompt
  await expect(addTabButton.or(aceEditor)).toBeVisible({ timeout: 15000 });

  // If no editor is visible, click "Add a new tab" to create a query tab
  if (await addTabButton.isVisible()) {
    await addTabButton.click();
  }
  await expect(aceEditor).toBeVisible({ timeout: 15000 });

  // Select the "public" schema so we can pick a table from the left panel
  const schemaSelect = page.locator('#select-schema');
  await expect(schemaSelect).toBeEnabled({ timeout: 10000 });
  await schemaSelect.click({ force: true });
  await schemaSelect.fill('public');
  await page.getByRole('option', { name: 'public' }).click();

  // Wait for table list to load after schema change, then select birth_names
  const tableSelectWrapper = page
    .locator('.ant-select')
    .filter({ has: page.locator('#select-table') });
  await expect(tableSelectWrapper).toBeVisible({ timeout: 10000 });
  await tableSelectWrapper.click();
  await page.keyboard.type('birth_names');
  // Select the filtered option via keyboard
  await page.keyboard.press('Enter');

  // Wait for table schema to load and show columns in the left panel
  await expect(
    page.locator('[data-test="col-name"]').first(),
  ).toBeVisible({ timeout: 10000 });

  // Close the table dropdown by clicking elsewhere, then switch to the query tab
  await page.locator('[data-test="sql-editor-tabs"]').first().click();
  await page.getByText('Untitled Query').first().click();

  // Write a multi-line SELECT with explicit columns to fill the editor
  await aceEditor.click();
  const editor = page.getByRole('textbox', { name: /cursor/i });
  await editor.fill(
    'SELECT\n  ds,\n  name,\n  gender,\n  state,\n  num\nFROM birth_names\nLIMIT 100',
  );

  // Run the query
  const runButton = page.getByText('Run', { exact: true });
  await expect(runButton).toBeVisible();
  await runButton.click();

  // Wait for results to appear (look for the "N rows" badge in the results panel)
  await expect(page.getByText(/\d+ rows/)).toBeVisible({
    timeout: 30000,
  });

  // Switch to the Results tab (close the public.birth_names metadata tab)
  await page.getByText('Results').click();

  // Move mouse away from buttons to dismiss any tooltips
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'sql_lab.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});
