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

import { test, expect } from '../../../helpers/fixtures/testAssets';
import type { TestAssets } from '../../../helpers/fixtures/testAssets';
import type { Page, TestInfo } from '@playwright/test';
import { ExplorePage } from '../../../pages/ExplorePage';
import { CreateDatasetPage } from '../../../pages/CreateDatasetPage';
import { DatasetListPage } from '../../../pages/DatasetListPage';
import { ChartCreationPage } from '../../../pages/ChartCreationPage';
import { ENDPOINTS } from '../../../helpers/api/dataset';
import { waitForPost } from '../../../helpers/api/intercepts';
import { expectStatusOneOf } from '../../../helpers/api/assertions';
import { apiPostDatabase } from '../../../helpers/api/database';

interface GsheetsSetupResult {
  sheetName: string;
  dbName: string;
  createDatasetPage: CreateDatasetPage;
}

/**
 * Sets up gsheets database and navigates to create dataset page.
 * Skips test if gsheets connector unavailable.
 * @param testInfo - Test info for parallelIndex to avoid name collisions in parallel runs
 * @returns Setup result with names and page object, or null if test.skip() was called
 */
async function setupGsheetsDataset(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
): Promise<GsheetsSetupResult | null> {
  // Public Google Sheet for testing (published to web, no auth required)
  // This is a Netflix dataset that is publicly accessible via Google Visualization API
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

  // Check if gsheets connector is available
  if (!createDbRes.ok()) {
    const errorBody = await createDbRes.json();
    const errorText = JSON.stringify(errorBody);
    // Skip test if gsheets connector not installed
    if (
      errorText.includes('gsheets') ||
      errorText.includes('No such DB engine')
    ) {
      await test.info().attach('skip-reason', {
        body: `Google Sheets connector unavailable: ${errorText}`,
        contentType: 'text/plain',
      });
      test.skip();
      return null;
    }
    throw new Error(`Failed to create gsheets database: ${errorText}`);
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

  // Select the Google Sheets database
  await createDatasetPage.selectDatabase(dbName);

  // Try to select the sheet - if not found due to timeout, skip
  try {
    await createDatasetPage.selectTable(sheetName);
  } catch (error) {
    // Only skip on TimeoutError (sheet not loaded); re-throw everything else
    if (!(error instanceof Error) || error.name !== 'TimeoutError') {
      throw error;
    }
    await test.info().attach('skip-reason', {
      body: `Table "${sheetName}" not found in dropdown after timeout.`,
      contentType: 'text/plain',
    });
    test.skip();
    return null;
  }

  return { sheetName, dbName, createDatasetPage };
}

test('should create a dataset via wizard', async ({ page, testAssets }) => {
  const setup = await setupGsheetsDataset(page, testAssets, test.info());
  if (!setup) return; // test.skip() was called
  const { sheetName, createDatasetPage } = setup;

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

  if (newDatasetId) {
    testAssets.trackDataset(newDatasetId);
  }

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
  const setup = await setupGsheetsDataset(page, testAssets, test.info());
  if (!setup) return; // test.skip() was called
  const { sheetName, createDatasetPage } = setup;

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
  if (datasetId) {
    testAssets.trackDataset(datasetId);
  }

  // Verify redirect to dataset list (not chart creation)
  // Note: "Create dataset" action does not show a toast
  await page.waitForURL(/.*tablemodelview\/list.*/);

  // Wait for table load, verify row visible
  const datasetListPage = new DatasetListPage(page);
  await datasetListPage.waitForTableLoad();
  await expect(datasetListPage.getDatasetRow(sheetName)).toBeVisible();
});
