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
 * Documentation Screenshot Generator
 *
 * Captures screenshots for the Superset documentation site and README.
 * Depends on example data loaded via `superset load_examples`.
 *
 * Run locally:
 *   cd superset-frontend
 *   PLAYWRIGHT_BASE_URL=http://localhost:9000 npm run docs:screenshots
 *
 * Or directly:
 *   npx playwright test --config=playwright/generators/playwright.config.ts docs/
 *
 * Screenshots are saved under docs/static/img/.
 * As new screenshots are scripted, entries are removed from screenshot-manifest.yaml
 * and the output path moves from that manifest into the test below.
 */

import path from 'path';
import { test, expect } from '@playwright/test';
import { URL } from '../../utils/urls';

const DOCS_STATIC = path.resolve(__dirname, '../../../../docs/static/img');
const SCREENSHOTS_DIR = path.join(DOCS_STATIC, 'screenshots');
const TUTORIAL_DIR = path.join(DOCS_STATIC, 'tutorial');

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

  // Wait for at least one chart to finish rendering (ECharts renders to canvas)
  await expect(
    page.locator('.dashboard-component-chart-holder canvas').first(),
  ).toBeVisible({ timeout: 15000 });

  // Open the filter bar (collapsed by default)
  const expandButton = page.locator('[data-test="filter-bar__expand-button"]');
  if (await expandButton.isVisible()) {
    await expandButton.click();
    // Wait for filter bar content to expand and render filter controls
    await expect(
      page.locator('[data-test="filter-bar__collapsable"]'),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[data-test="filterbar-action-buttons"]'),
    ).toBeVisible({ timeout: 5000 });
  }

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'dashboard.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

test('chart editor screenshot', async ({ page }) => {
  await page.goto(URL.CHART_LIST);

  // Search for the Scatter Plot chart by name
  const searchInput = page.getByPlaceholder('Type a value');
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill('Scatter Plot');
  await searchInput.press('Enter');

  // Click the Scatter Plot link to open explore
  const chartLink = page.getByRole('link', { name: /scatter plot/i });
  await expect(chartLink).toBeVisible({ timeout: 10000 });
  await chartLink.click();

  // Wait for explore page to fully load
  await page.waitForURL('**/explore/**', { timeout: 15000 });
  const sliceContainer = page.locator('[data-test="slice-container"]');
  await expect(sliceContainer).toBeVisible({ timeout: 15000 });

  // Wait for the chart to finish rendering (loading spinners clear, chart content appears)
  await expect(
    sliceContainer.locator('[data-test="loading-indicator"]'),
  ).toHaveCount(0, { timeout: 15000 });
  await expect(sliceContainer.locator('canvas, svg').first()).toBeVisible({
    timeout: 15000,
  });

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'explore.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

test('SQL Lab screenshot', async ({ page }) => {
  // SQL Lab has many interactive steps — allow extra time
  test.setTimeout(90000);
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

  // Click the active query tab to ensure focus is on the editor pane
  await page.getByText('Untitled Query').first().click();

  // Write a multi-line SELECT with explicit columns to fill the editor
  await aceEditor.click();
  const editor = page.getByRole('textbox', { name: /cursor/i });
  await editor.fill(
    'SELECT\n  ds,\n  name,\n  gender,\n  state,\n  num\nFROM birth_names\nLIMIT 100',
  );

  // Run the query — use role to avoid matching "Run" text in other tab panels
  const runButton = page.getByRole('button', { name: /caret-right Run/i });
  await expect(runButton).toBeVisible();
  await runButton.click();

  // Wait for results to appear (look for the "N rows" badge in the results panel)
  await expect(page.getByText(/\d+ rows/)).toBeVisible({
    timeout: 30000,
  });

  // Switch to the Results tab to show the query output
  await page.getByRole('tab', { name: 'Results' }).click();

  // Move mouse away from buttons to dismiss any tooltips, then wait for them to disappear
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0, { timeout: 2000 });

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'sql_lab.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

// ---------------------------------------------------------------------------
// Tutorial screenshots
// ---------------------------------------------------------------------------

test('datasets list screenshot', async ({ page }) => {
  await page.goto(URL.DATASET_LIST);

  const table = page.locator('[data-test="listview-table"]');
  await expect(table).toBeVisible({ timeout: 15000 });
  // Wait for at least one visible data row (skip ant-table-measure-row which is always hidden)
  await expect(
    table.locator('tbody tr:not(.ant-table-measure-row)').first(),
  ).toBeVisible({
    timeout: 10000,
  });

  await table.screenshot({
    path: path.join(TUTORIAL_DIR, 'tutorial_08_sources_tables.png'),
    type: 'png',
  });
});

test('chart type picker screenshot', async ({ page }) => {
  await page.goto(URL.CHART_ADD);

  await expect(page.getByText('Choose chart type')).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('tab', { name: 'All charts' }).click();

  const vizGallery = page.locator('.viz-gallery');
  await expect(vizGallery).toBeVisible();
  await expect(
    vizGallery.locator('[data-test="viztype-selector-container"]').first(),
  ).toBeVisible();

  await vizGallery.screenshot({
    path: path.join(TUTORIAL_DIR, 'create_pivot.png'),
    type: 'png',
  });
});
