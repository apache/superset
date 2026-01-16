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

import { test, expect, type Page } from '@playwright/test';
import { DatasetListPage } from '../../../pages/DatasetListPage';
import { ExplorePage } from '../../../pages/ExplorePage';
import { CreateDatasetPage } from '../../../pages/CreateDatasetPage';
import { ChartCreationPage } from '../../../pages/ChartCreationPage';
import { apiDeleteDataset, ENDPOINTS } from '../../../helpers/api/dataset';
import { waitForPost } from '../../../helpers/api/intercepts';
import { expectStatusOneOf } from '../../../helpers/api/assertions';
import {
  apiPostDatabase,
  apiDeleteDatabase,
} from '../../../helpers/api/database';

/**
 * Helper to clean up datasets created during a test.
 */
async function cleanupDatasets(page: Page, datasetIds: number[]) {
  const promises = datasetIds.map(id =>
    apiDeleteDataset(page, id, { failOnStatusCode: false }).catch(() => {}),
  );
  await Promise.all(promises);
}

test('should create a dataset via wizard', async ({ page }) => {
  const datasetListPage = new DatasetListPage(page);
  const testDatasetIds: number[] = [];
  let testDatabaseId: number | null = null;

  // Public Google Sheet for testing (published to web, no auth required)
  // This is a Netflix dataset that is publicly accessible via Google Visualization API
  const sheetUrl =
    'https://docs.google.com/spreadsheets/d/19XNqckHGKGGPh83JGFdFGP4Bw9gdXeujq5EoIGwttdM/edit#gid=347941303';
  const sheetName = `test_netflix_${Date.now()}`;
  const dbName = `test_gsheets_db_${Date.now()}`;

  try {
    // Navigate first to establish session and CSRF token
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();

    // Step 1: Create a Google Sheets database via API
    // The catalog must be in `extra` as JSON with engine_params.catalog format
    // (discovered from DatabaseModal/index.tsx lines 867-875)
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
        test.skip();
        return;
      }
      throw new Error(`Failed to create gsheets database: ${errorText}`);
    }

    const createDbBody = await createDbRes.json();
    testDatabaseId = createDbBody.id;
    expect(testDatabaseId).toBeGreaterThan(0);

    // Step 2: Click "Add Dataset" to navigate to create dataset wizard
    await datasetListPage.clickAddDataset();

    // Step 3: Use CreateDatasetPage for wizard interactions
    const createDatasetPage = new CreateDatasetPage(page);
    await createDatasetPage.waitForPageLoad();

    // Select the Google Sheets database
    await createDatasetPage.selectDatabase(dbName);

    // Step 4: Try to select the sheet - if not found due to timeout, log options and skip
    try {
      await createDatasetPage.selectTable(sheetName);
    } catch (error) {
      // Only skip on TimeoutError (sheet not loaded); re-throw everything else
      if (!(error instanceof Error) || error.name !== 'TimeoutError') {
        throw error;
      }
      // Sheet not visible in dropdown - skip test (gsheets may have loading delay)
      test.skip();
      return;
    }

    // Step 5: Set up response intercept to capture new dataset ID
    const createResponsePromise = waitForPost(page, ENDPOINTS.DATASET);

    // Click "Create and explore dataset" button
    await createDatasetPage.clickCreateAndExploreDataset();

    // Step 6: Wait for dataset creation and capture ID for cleanup
    const createResponse = expectStatusOneOf(
      await createResponsePromise,
      [200, 201],
    );
    const createBody = await createResponse.json();
    const newDatasetId = createBody.result?.id ?? createBody.id;

    if (newDatasetId) {
      testDatasetIds.push(newDatasetId);
    }

    // Step 7: Verify we navigated to Chart Creation page with dataset pre-selected
    await page.waitForURL(/.*\/chart\/add.*/);
    const chartCreationPage = new ChartCreationPage(page);
    await chartCreationPage.waitForPageLoad();

    // Verify the dataset is pre-selected
    await chartCreationPage.expectDatasetSelected(sheetName);

    // Step 8: Select a visualization type and create chart
    await chartCreationPage.selectVizType('Table');

    // Click "Create new chart" to go to Explore
    await chartCreationPage.clickCreateNewChart();

    // Step 9: Verify we navigated to Explore page
    await page.waitForURL(/.*\/explore\/.*/);
    const explorePage = new ExplorePage(page);
    await explorePage.waitForPageLoad();

    // Verify the dataset name is shown in Explore
    const loadedDatasetName = await explorePage.getDatasetName();
    expect(loadedDatasetName).toContain(sheetName);
  } finally {
    // Cleanup: Delete dataset first, then database
    await cleanupDatasets(page, testDatasetIds);
    if (testDatabaseId) {
      await apiDeleteDatabase(page, testDatabaseId, {
        failOnStatusCode: false,
      }).catch(() => {});
    }
  }
});
