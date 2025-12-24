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

const docsPath: string = '../docs/static/img/screenshots/';

test('chart type screenshot', async ({ page }) => {
  await page.goto('/chart/add');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Choose chart type')).toBeVisible();
  await page.getByRole('tab', { name: 'All charts' }).click();
  await page.addStyleTag({ content: 'body { zoom: 0.8 }' });

  const vizGallery = page.locator('.viz-gallery');
  await expect(vizGallery).toBeVisible();
  // Wait for viz type icons to load
  await expect(
    vizGallery.locator('[data-test="viztype-selector-container"]'),
  ).toBeVisible();

  await vizGallery.screenshot({ path: docsPath + 'gallery.jpg', type: 'jpeg' });
});

test('dashboard content screenshot', async ({ page }) => {
  await page.goto('/dashboard/list/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('link', { name: 'Slack Dashboard' }).click();
  await page.addStyleTag({ content: 'body { zoom: 0.8 }' });

  const dashboardWrapper = page.locator(
    '[data-test="dashboard-content-wrapper"]',
  );
  await expect(dashboardWrapper).toBeVisible();
  await page.waitForLoadState('networkidle');

  await dashboardWrapper.screenshot({
    path: docsPath + 'slack_dash.jpg',
    type: 'jpeg',
  });
});

test('chart editor screenshot', async ({ page }) => {
  await page.goto('/chart/list/');
  await page.waitForLoadState('domcontentloaded');

  const searchInput = page.locator('[data-test="filters-search"]');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('life');
  await searchInput.press('Enter');

  const chartLink = page.locator(
    '[data-test="Life Expectancy VS Rural %-list-chart-title"]',
  );
  await expect(chartLink).toBeVisible();
  await chartLink.click();

  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-test="slice-container"]')).toBeVisible();

  await page.screenshot({
    path: docsPath + 'explore.jpg',
    type: 'jpeg',
    fullPage: true,
  });
});

test('sqllab screenshot', async ({ page }) => {
  await page.goto('/sqllab');
  await page.waitForLoadState('domcontentloaded');

  const schemaSelect = page.getByRole('combobox', {
    name: 'Select schema or type to',
  });
  await expect(schemaSelect).toBeVisible();
  await schemaSelect.fill('main');
  await schemaSelect.press('Enter');

  const tableSelect = page.getByRole('combobox', {
    name: 'Select table or type to',
  });
  await expect(tableSelect).toBeVisible();
  await tableSelect.fill('covid');
  await tableSelect.press('Enter');

  const aceContent = page.locator('.ace_content');
  await expect(aceContent).toBeVisible();
  await aceContent.click();

  const editor = page.getByRole('textbox', { name: 'Cursor at row' });
  await editor.fill(
    'SELECT "developer_researcher",\n"stage_of_development",\n"product_category",\n"country_name"\nFROM main.covid_vaccines',
  );

  const runButton = page.locator('[data-test="run-query-action"]');
  await expect(runButton).toBeVisible();
  await runButton.click();

  await page.waitForLoadState('networkidle');
  await aceContent.click();

  await page.screenshot({
    path: docsPath + 'sql_lab.jpg',
    type: 'jpeg',
    fullPage: true,
  });
});
