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

import { test, expect } from '../../helpers/fixtures/testAssets';
import type { TestAssets } from '../../helpers/fixtures/testAssets';
import type { Page, TestInfo } from '@playwright/test';
import { ExplorePage } from '../../pages/ExplorePage';
import { CreateDatasetPage } from '../../pages/CreateDatasetPage';
import { DatasetListPage } from '../../pages/DatasetListPage';
import { ChartCreationPage } from '../../pages/ChartCreationPage';
import { ENDPOINTS } from '../../helpers/api/dataset';
import { waitForGet, waitForPost } from '../../helpers/api/intercepts';
import { expectStatusOneOf } from '../../helpers/api/assertions';
import { apiPostDatabase } from '../../helpers/api/database';

interface GsheetsSetupResult {
  sheetName: string;
  dbName: string;
  createDatasetPage: CreateDatasetPage;
}

/**
 * Sets up gsheets database and navigates to create dataset page.
 * Intercepts the tables API to distinguish Superset regressions from transient issues:
 * - Tables API error → hard failure (Superset bug)
 * - Tables API success, sheet missing → skip (Google Sheets API slow)
 * - Tables API success, sheet present → proceed (UI timeout = real regression)
 * @param testInfo - Test info for parallelIndex to avoid name collisions in parallel runs
 * @returns Setup result with names and page object
 */
async function setupGsheetsDataset(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
): Promise<GsheetsSetupResult> {
  // Public Google Sheet for testing (published to web, no auth required).
  // This is a Netflix dataset that is publicly accessible via the Google Visualization API.
  // NOTE: This sheet is hosted on an external Google account and is not created by the test itself.
  // If this sheet is deleted, its ID changes, or its sharing settings are restricted,
  // these tests will start failing when they attempt to create a database pointing at it.
  // In that case, create or select a new publicly readable test sheet, update `sheetUrl`
  // to use its URL, and update this comment to describe who owns/maintains that sheet
  // and the expected access controls (e.g., "anyone with the link can view").
  const sheetUrl =
    'https://docs.google.com/spreadsheets/d/19XNqckHGKGGPh83JGFdFGP4Bw9gdXeujq5EoIGwttdM/edit#gid=347941303';
  // Include parallelIndex to avoid collisions when tests run in parallel
  const uniqueSuffix = `${Date.now()}_${testInfo.parallelIndex}`;
  const sheetName = `test_netflix_${uniqueSuffix}`;
  const dbName = `test_gsheets_db_${uniqueSuffix}`;

  // Create a Google Sheets database via API
  // The catalog must be in `extra` as JSON with engine_params.catalog format
  const catalogDict = { [sheetName]: sheetUrl };
  const createDbRes = await apiPostDatabase(page, {
    database_name: dbName,
    engine: 'gsheets',
    sqlalchemy_uri: 'gsheets://',
    configuration_method: 'dynamic_form',
    expose_in_sqllab: true,
    extra: JSON.stringify({
      engine_params: {
        catalog: catalogDict,
      },
    }),
  });

  // Fail hard if gsheets database creation fails.
  // shillelagh[gsheetsapi] is a base dependency (pyproject.toml), so the engine
  // is always available after `pip install -e .`; a failure here means the CI
  // environment is broken, not that the driver is missing.
  if (!createDbRes.ok()) {
    const errorBody = await createDbRes.json();
    throw new Error(
      `Failed to create gsheets database: ${JSON.stringify(errorBody)}`,
    );
  }

  const createDbBody = await createDbRes.json();
  const dbId = createDbBody.result?.id ?? createDbBody.id;
  if (!dbId) {
    throw new Error('Database creation did not return an ID');
  }
  testAssets.trackDatabase(dbId);

  // Navigate to create dataset page
  const createDatasetPage = new CreateDatasetPage(page);
  await createDatasetPage.goto();
  await createDatasetPage.waitForPageLoad();

  // Select the Google Sheets database and intercept the tables API response
  // to distinguish Superset regressions from transient Google Sheets delays.
  // Pin to our dbId so a stale localStorage selection can't satisfy the waiter.
  const tablesResponsePromise = waitForGet(
    page,
    new RegExp(`/api/v1/database/${dbId}/tables`),
  );
  await createDatasetPage.selectDatabase(dbName);

  // Check the tables API response.
  // Outcomes:
  //   1. Response never arrives (TimeoutError)    → Google Sheets too slow → skip
  //   2. Response arrives, non-OK status          → Superset regression   → fail hard
  //   3. Response OK, empty result (0 tables)     → Google Sheets slow    → skip
  //   4. Response OK, non-empty but sheet missing → Superset wrong data   → fail hard
  //   5. Response OK, sheet present               → proceed to UI select
  let tablesResponse: Awaited<typeof tablesResponsePromise>;
  try {
    tablesResponse = await tablesResponsePromise;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TimeoutError') {
      throw error;
    }
    await test.info().attach('skip-reason', {
      body: `Tables API for database ${dbId} did not respond in time — Google Sheets metadata may be slow.`,
      contentType: 'text/plain',
    });
    test.skip();
    // test.skip() throws; this line is unreachable but satisfies TypeScript
    throw error;
  }

  if (!tablesResponse.ok()) {
    throw new Error(
      `Tables API failed (${tablesResponse.status()}): ${await tablesResponse.text()}`,
    );
  }

  const tablesBody = await tablesResponse.json();
  const tableNames: string[] = (tablesBody.result ?? []).map(
    (t: { value: string }) => t.value,
  );

  if (!tableNames.includes(sheetName)) {
    if (tableNames.length === 0) {
      // Empty result — Google Sheets API hasn't returned table metadata yet.
      // This is the only legitimate transient case: we created the database
      // with exactly one sheet in its catalog, so an empty response means the
      // external API was too slow, not that Superset returned wrong data.
      await test.info().attach('skip-reason', {
        body: `Tables API returned 0 tables for database ${dbId} — Google Sheets API may be slow.`,
        contentType: 'text/plain',
      });
      test.skip();
    }
    // Non-empty result that omits our sheet — Superset returned wrong data
    throw new Error(
      `Tables API returned ${tableNames.length} tables but "${sheetName}" was not among them: [${tableNames.join(', ')}]`,
    );
  }

  // Table confirmed in API response — select it from the dropdown.
  // A timeout here is now a genuine UI regression, not a transient skip.
  await createDatasetPage.selectTable(sheetName);

  return { sheetName, dbName, createDatasetPage };
}

test('should create a dataset via wizard', async ({ page, testAssets }) => {
  const { sheetName, createDatasetPage } = await setupGsheetsDataset(
    page,
    testAssets,
    test.info(),
  );

  // Set up response intercept to capture new dataset ID
  const createResponsePromise = waitForPost(page, ENDPOINTS.DATASET, {
    pathMatch: true,
  });

  // Click "Create and explore dataset" button
  await createDatasetPage.clickCreateAndExploreDataset();

  // Wait for dataset creation and capture ID for cleanup
  const createResponse = expectStatusOneOf(
    await createResponsePromise,
    [200, 201],
  );
  const createBody = await createResponse.json();
  const newDatasetId = createBody.result?.id ?? createBody.id;
  expect(newDatasetId).toBeTruthy();
  testAssets.trackDataset(newDatasetId);

  // Verify we navigated to Chart Creation page with dataset pre-selected
  await page.waitForURL(/.*\/chart\/add.*/);
  const chartCreationPage = new ChartCreationPage(page);
  await chartCreationPage.waitForPageLoad();

  // Verify the dataset is pre-selected
  await chartCreationPage.expectDatasetSelected(sheetName);

  // Select a visualization type and create chart
  await chartCreationPage.selectVizType('Table');

  // Click "Create new chart" to go to Explore
  await chartCreationPage.clickCreateNewChart();

  // Verify we navigated to Explore page
  await page.waitForURL(/.*\/explore\/.*/);
  const explorePage = new ExplorePage(page);
  await explorePage.waitForPageLoad();

  // Verify the dataset name is shown in Explore
  const loadedDatasetName = await explorePage.getDatasetName();
  expect(loadedDatasetName).toContain(sheetName);
});

test('should create a dataset without exploring', async ({
  page,
  testAssets,
}) => {
  const { sheetName, createDatasetPage } = await setupGsheetsDataset(
    page,
    testAssets,
    test.info(),
  );

  // Set up response intercept to capture dataset ID
  const createResponsePromise = waitForPost(page, ENDPOINTS.DATASET, {
    pathMatch: true,
  });

  // Click "Create dataset" (not explore)
  await createDatasetPage.clickCreateDataset();

  // Capture dataset ID from response for cleanup
  const createResponse = expectStatusOneOf(
    await createResponsePromise,
    [200, 201],
  );
  const createBody = await createResponse.json();
  const datasetId = createBody.result?.id ?? createBody.id;
  expect(datasetId).toBeTruthy();
  testAssets.trackDataset(datasetId);

  // Verify redirect to dataset list (not chart creation)
  // Note: "Create dataset" action does not show a toast
  await page.waitForURL(/.*tablemodelview\/list.*/);

  // Wait for table load, verify row visible
  const datasetListPage = new DatasetListPage(page);
  await datasetListPage.waitForTableLoad();
  await expect(datasetListPage.getDatasetRow(sheetName)).toBeVisible();
});
