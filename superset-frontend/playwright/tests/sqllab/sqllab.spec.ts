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
 * SQL Lab E2E tests — sequential via chromium-sqllab project.
 *
 * Tab state is stored server-side per user (/tabstateview/*), and all workers
 * share the same authenticated user. Parallel workers adding/removing tabs
 * would cause nondeterministic tab counts and cross-worker deletions.
 * See playwright.config.ts chromium-sqllab project for details.
 */

import { test, expect } from '../../helpers/fixtures/testAssets';
import { SqlLabPage } from '../../pages/SqlLabPage';
import { ExplorePage } from '../../pages/ExplorePage';
import { Input } from '../../components/core';
import { SaveQueryModal } from '../../components/modals/SaveQueryModal';
import { SaveDatasetModal } from '../../components/modals/SaveDatasetModal';
import { waitForPost } from '../../helpers/api/intercepts';
import {
  expectStatus,
  extractIdFromResponse,
} from '../../helpers/api/assertions';
import { apiGetSavedQuery } from '../../helpers/api/savedQuery';
import { TIMEOUT } from '../../utils/constants';
import { URL } from '../../utils/urls';

let sqlLabPage: SqlLabPage;

test.beforeEach(async ({ page }) => {
  test.setTimeout(TIMEOUT.SLOW_TEST);
  sqlLabPage = new SqlLabPage(page);
  await sqlLabPage.gotoAndReady();
});

// ── Query Execution ──

test('executes a simple SELECT query and displays results', async () => {
  await expect(sqlLabPage.databaseSelector.element).toBeVisible();

  const response = await sqlLabPage.executeQuery('SELECT 1 AS test_col');
  expectStatus(response, 200);

  await sqlLabPage.waitForQueryResults('test_col');
  const headers = await sqlLabPage.resultsGrid.getHeaderTexts();
  expect(headers.some(h => h.includes('test_col'))).toBe(true);
});

test('shows error message for invalid SQL', async () => {
  const invalidTable = 'a_table_that_does_not_exist_xyz_pw';
  await sqlLabPage.executeQuery(`SELECT * FROM ${invalidTable}`);

  const { errorAlert } = sqlLabPage;
  await expect(errorAlert).toBeVisible({ timeout: TIMEOUT.QUERY_EXECUTION });
  // Assert the error references the specific table name, proving this query
  // triggered the failure — not a stale error from a prior test or session.
  await expect(errorAlert).toContainText(invalidTable);
});

test('re-runs a query and refreshes results', async () => {
  const firstResponse = await sqlLabPage.executeQuery('SELECT 1 AS first_col');
  expectStatus(firstResponse, 200);
  await sqlLabPage.waitForQueryResults('first_col');

  const firstHeaders = await sqlLabPage.resultsGrid.getHeaderTexts();
  expect(firstHeaders.some(h => h.includes('first_col'))).toBe(true);

  const secondResponse = await sqlLabPage.executeQuery(
    'SELECT 2 AS second_col',
  );
  expectStatus(secondResponse, 200);
  await sqlLabPage.waitForQueryResults('second_col');

  const secondHeaders = await sqlLabPage.resultsGrid.getHeaderTexts();
  expect(secondHeaders.some(h => h.includes('second_col'))).toBe(true);
  expect(secondHeaders.some(h => h.includes('first_col'))).toBe(false);
});

// ── Tabs ──

test('creates a new tab via button', async () => {
  const initialTabCount = await sqlLabPage.getTabCount();

  await sqlLabPage.addTab();
  await sqlLabPage.editor.waitForReady();

  expect(await sqlLabPage.getTabCount()).toBe(initialTabCount + 1);

  const defaultContent = await sqlLabPage.getQuery();
  expect(defaultContent).toContain('SELECT');

  await sqlLabPage.closeLastTab();
  expect(await sqlLabPage.getTabCount()).toBe(initialTabCount);
});

test('closes a tab via close button', async () => {
  const initialTabCount = await sqlLabPage.getTabCount();

  await sqlLabPage.addTab();
  await sqlLabPage.editor.waitForReady();
  expect(await sqlLabPage.getTabCount()).toBe(initialTabCount + 1);

  await sqlLabPage.closeLastTab();
  expect(await sqlLabPage.getTabCount()).toBe(initialTabCount);
});

test('preserves query state when switching tabs', async () => {
  const tabOneSql = `SELECT 'tab_one_${Date.now()}'`;
  const tabTwoSql = `SELECT 'tab_two_${Date.now()}'`;

  const firstTabName = await sqlLabPage.getActiveTabName();

  await sqlLabPage.setQuery(tabOneSql);

  await sqlLabPage.addTab();
  await sqlLabPage.editor.waitForReady();
  const secondTabName = await sqlLabPage.getActiveTabName();
  await sqlLabPage.setQuery(tabTwoSql);

  // Use positional selection — tab names can collide in CI (both tabs may be
  // named "Untitled Query 1" depending on server-side tab state from prior tests).
  // Content assertions use toPass() because the editor hydrates asynchronously
  // after the tab switch — the Ace editor mounts first, then Redux populates it.
  await sqlLabPage.getTab(firstTabName).first().click();
  await sqlLabPage.editor.waitForReady();
  await expect(async () => {
    expect(await sqlLabPage.getQuery()).toContain('tab_one_');
  }).toPass({ timeout: TIMEOUT.UI_TRANSITION });

  await sqlLabPage.getTab(secondTabName).last().click();
  await sqlLabPage.editor.waitForReady();
  await expect(async () => {
    expect(await sqlLabPage.getQuery()).toContain('tab_two_');
  }).toPass({ timeout: TIMEOUT.UI_TRANSITION });

  await sqlLabPage.closeLastTab();
});

test('should open new tab by keyboard shortcut with correct defaults', async ({
  page,
}) => {
  const initialTabCount = await sqlLabPage.getTabCount();

  await sqlLabPage.setQuery('some random query string');

  // Register before addTabByShortcut — EditorAutoSync POSTs the new tab
  // within its 5 s interval, so the POST can fire before any later line.
  const tabStatePromise = waitForPost(page, /tabstateview\/?$/);

  await sqlLabPage.addTabByShortcut();
  await sqlLabPage.editor.waitForReady();
  expect(await sqlLabPage.getTabCount()).toBe(initialTabCount + 1);

  // Verify new tab has default SQL (not carried over from previous tab)
  const defaultContent = await sqlLabPage.getQuery();
  expect(defaultContent).toContain('SELECT');

  // Wait for the auto-sync POST that persists the new tab to the backend
  await tabStatePromise;

  await page.reload();
  await sqlLabPage.waitForPageLoad();
  await sqlLabPage.ensureEditorReady();

  expect(await sqlLabPage.getTabCount()).toBe(initialTabCount + 1);

  await sqlLabPage.closeLastTab();
  expect(await sqlLabPage.getTabCount()).toBe(initialTabCount);
});

// ── Save and Share ──

test('saves a query and loads it from saved queries', async ({
  page,
  testAssets,
}) => {
  const queryText = 'SELECT 1 AS saved_test_col';
  const savedQueryTitle = `pw_test_saved_query_${Date.now()}`;

  await expect(sqlLabPage.databaseSelector.element).toBeVisible();

  const executeResponse = await sqlLabPage.executeQuery(queryText);
  expectStatus(executeResponse, 200);
  await sqlLabPage.waitForQueryResults('saved_test_col');

  await sqlLabPage.saveButton.click();
  const saveModal = new SaveQueryModal(page);
  await saveModal.waitForReady();

  await saveModal.fillName(savedQueryTitle);

  const savePromise = waitForPost(page, 'api/v1/saved_query/', {
    timeout: TIMEOUT.API_RESPONSE,
  });
  await saveModal.clickFooterButton('Save');
  const saveResponse = await savePromise;
  expectStatus(saveResponse, 201);

  const savedQueryId = await extractIdFromResponse(saveResponse);
  testAssets.trackSavedQuery(savedQueryId);

  await saveModal.waitForHidden();

  const getResponse = await apiGetSavedQuery(page, savedQueryId);
  const savedQuery = (await getResponse.json()).result;
  expect(savedQuery.sql).toContain('saved_test_col');
  expect(savedQuery.label).toBe(savedQueryTitle);

  // Navigate through the Saved Queries list UI (not deep-link) to verify
  // the query appears in the list and can be loaded from there.
  await page.goto(URL.SAVED_QUERIES_LIST, { waitUntil: 'domcontentloaded' });
  await page.locator('.ant-table').waitFor({
    state: 'visible',
    timeout: TIMEOUT.PAGE_LOAD,
  });

  // Search for the saved query by its unique name
  const searchInput = new Input(page, 'input[data-test="filters-search"]');
  await searchInput.fill(savedQueryTitle);

  // Wait for the filtered row to appear in the table
  const queryLink = page.getByRole('link', { name: savedQueryTitle });
  await queryLink.waitFor({ state: 'visible', timeout: TIMEOUT.API_RESPONSE });

  // Navigate to SQL Lab with the saved query ID. The list-view React Router
  // <Link> uses makeUrl() which double-prefixes with basename in CI, causing
  // the click to silently fail. Direct navigation tests the loading path
  // reliably — the list search above already proves the query appears in the UI.
  await page.goto(`${URL.SQLLAB}?savedQueryId=${savedQueryId}`);
  await sqlLabPage.waitForPageLoad();
  await sqlLabPage.ensureEditorReady();

  const loadedSql = await sqlLabPage.getQuery();
  expect(loadedSql).toContain('saved_test_col');
});

test('creates a dataset from query results', async ({ page, testAssets }) => {
  await sqlLabPage.selectDatabase('examples');

  const executeResponse = await sqlLabPage.executeQuery(
    'SELECT 1 AS ds_test_col',
  );
  expectStatus(executeResponse, 200);
  await sqlLabPage.waitForQueryResults('ds_test_col');

  await sqlLabPage.saveDatasetButton.click();

  const saveDatasetModal = new SaveDatasetModal(page);
  await saveDatasetModal.waitForReady();

  const datasetName = `pw_test_dataset_${Date.now()}`;
  await saveDatasetModal.fillName(datasetName);

  const datasetCreatePromise = waitForPost(page, 'api/v1/dataset/', {
    timeout: TIMEOUT.API_RESPONSE,
  });
  const newPagePromise = page.context().waitForEvent('page', {
    timeout: TIMEOUT.API_RESPONSE,
  });

  await saveDatasetModal.clickFooterButton('Save & Explore');

  const createResponse = await datasetCreatePromise;
  const datasetId = await extractIdFromResponse(createResponse);
  testAssets.trackDataset(datasetId);

  const newPage = await newPagePromise;

  const explorePage = new ExplorePage(newPage);
  await explorePage.waitForPageLoad({ timeout: TIMEOUT.PAGE_LOAD });

  const loadedDatasetName = await explorePage.getDatasetName();
  expect(loadedDatasetName).toContain(datasetName);

  await newPage.close();
});

// ── Create Chart ──

test('should navigate to Explore from SQL Lab query results', async ({
  page,
}) => {
  await sqlLabPage.selectDatabase('examples');

  const query = 'SELECT gender, name FROM birth_names';
  const executeResponse = await sqlLabPage.executeQuery(query);
  expectStatus(executeResponse, 200);

  await sqlLabPage.waitForQueryResults('gender');

  await expect(sqlLabPage.createChartButton.element).toBeEnabled();
  await sqlLabPage.createChartButton.click();

  const explorePage = new ExplorePage(page);
  await explorePage.waitForPageLoad({ timeout: TIMEOUT.PAGE_LOAD });

  const datasetName = await explorePage.getDatasetName();
  expect(datasetName).toContain(query);
});
