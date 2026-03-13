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
 * These tests capture screenshots for the Superset documentation site.
 * They depend on example data loaded via `superset load_examples` in CI.
 *
 * DEPENDENCY: Tests assume example dashboards, charts, and datasets exist.
 * Run with INCLUDE_EXPERIMENTAL=true to execute these tests.
 */

import { test, expect } from '@playwright/test';

const docsPath: string = '../docs/static/img/screenshots/';

test('chart type screenshot', async ({ page }) => {
  await page.goto('/chart/add');
  await page.waitForLoadState('networkidle');

  // Wait for the chart creation page to fully load
  await expect(page.getByText('Choose chart type')).toBeVisible();
  await page.getByRole('tab', { name: 'All charts' }).click();

  // Wait for viz gallery to load all chart types
  const vizGallery = page.locator('.viz-gallery');
  await expect(vizGallery).toBeVisible();
  // Use .first() to handle multiple matching elements in strict mode
  await expect(
    vizGallery.locator('[data-test="viztype-selector-container"]').first(),
  ).toBeVisible();

  // Apply zoom and take screenshot
  await page.addStyleTag({ content: 'body { zoom: 0.8 }' });
  await vizGallery.screenshot({ path: docsPath + 'gallery.jpg', type: 'jpeg' });
});

test('dashboard content screenshot', async ({ page }) => {
  await page.goto('/dashboard/list/');
  await page.waitForLoadState('networkidle');

  // Wait for the dashboard list to load and find Slack Dashboard
  const slackDashboardLink = page.getByRole('link', {
    name: 'Slack Dashboard',
  });
  await expect(slackDashboardLink).toBeVisible();
  await slackDashboardLink.click();

  // Wait for dashboard to fully render
  await page.waitForLoadState('networkidle');
  const dashboardWrapper = page.locator(
    '[data-test="dashboard-content-wrapper"]',
  );
  await expect(dashboardWrapper).toBeVisible();

  // Apply zoom and take screenshot
  await page.addStyleTag({ content: 'body { zoom: 0.8 }' });
  await dashboardWrapper.screenshot({
    path: docsPath + 'slack_dash.jpg',
    type: 'jpeg',
  });
});

test('chart editor screenshot', async ({ page }) => {
  await page.goto('/chart/list/');
  await page.waitForLoadState('networkidle');

  // Search for and open a specific chart
  const searchInput = page.locator('[data-test="filters-search"]');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('life');
  await searchInput.press('Enter');

  // Wait for search results and click on chart
  await page.waitForLoadState('networkidle');
  const chartLink = page.locator(
    '[data-test="Life Expectancy VS Rural %-list-chart-title"]',
  );
  await expect(chartLink).toBeVisible();

  // Use force click to avoid issues with overlays
  await chartLink.click({ force: true });

  // Wait for explore page to fully load
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-test="slice-container"]')).toBeVisible();

  // Take full page screenshot
  await page.screenshot({
    path: docsPath + 'explore.jpg',
    type: 'jpeg',
    fullPage: true,
  });
});

test('sqllab screenshot', async ({ page }) => {
  await page.goto('/sqllab');
  await page.waitForLoadState('networkidle');

  // First, select a database - this is required before schema/table selection
  const databaseSelect = page.getByRole('combobox', {
    name: 'Select database or type to',
  });
  await expect(databaseSelect).toBeVisible();
  // Click to open dropdown and select the examples database
  await databaseSelect.click();
  await page.getByText('examples', { exact: true }).click();

  // Now select schema
  const schemaSelect = page.getByRole('combobox', {
    name: 'Select schema or type to',
  });
  await expect(schemaSelect).toBeEnabled({ timeout: 10000 });
  await schemaSelect.click();
  await page.getByText('main', { exact: true }).click();

  // Select table
  const tableSelect = page.getByRole('combobox', {
    name: 'Select table or type to',
  });
  await expect(tableSelect).toBeEnabled({ timeout: 10000 });
  await tableSelect.click();
  // Look for a table that exists in examples
  await page.getByRole('option').filter({ hasText: 'covid' }).first().click();

  // Type SQL in the editor
  const aceContent = page.locator('.ace_content');
  await expect(aceContent).toBeVisible();
  await aceContent.click();

  const editor = page.getByRole('textbox', { name: 'Cursor at row' });
  await editor.fill(
    'SELECT "developer_researcher",\n"stage_of_development",\n"product_category",\n"country_name"\nFROM main.covid_vaccines',
  );

  // Run the query
  const runButton = page.locator('[data-test="run-query-action"]');
  await expect(runButton).toBeVisible();
  await runButton.click();

  // Wait for results to load
  await page.waitForLoadState('networkidle');
  await aceContent.click(); // Click back to editor to deselect results

  // Take full page screenshot
  await page.screenshot({
    path: docsPath + 'sql_lab.jpg',
    type: 'jpeg',
    fullPage: true,
  });
});
