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

import { testWithAssets as test, expect } from '../../helpers/fixtures';
import type { TestAssets } from '../../helpers/fixtures';
import type { Page, TestInfo } from '@playwright/test';
import { ExplorePage } from '../../pages/ExplorePage';
import { CreateDatasetPage } from '../../pages/CreateDatasetPage';
import { DatasetListPage } from '../../pages/DatasetListPage';
import { ChartCreationPage } from '../../pages/ChartCreationPage';
import { ENDPOINTS } from '../../helpers/api/dataset';
import { waitForPost } from '../../helpers/api/intercepts';
import { expectStatusOneOf } from '../../helpers/api/assertions';
import { getDatabaseByName } from '../../helpers/api/database';
import { apiExecuteSql } from '../../helpers/api/sqllab';

interface ExamplesSetupResult {
  tableName: string;
  dbId: number;
  createDatasetPage: CreateDatasetPage;
}

/**
 * Creates a temporary table in the examples database via SQL Lab,
 * then navigates to the create dataset wizard with it pre-selected.
 *
 * Requires `allow_dml=True` on the examples database (configured in CI setup).
 *
 * @param page - Playwright page instance
 * @param testAssets - Test assets tracker for cleanup
 * @param testInfo - Test info for parallelIndex to avoid name collisions
 * @returns Setup result with table name, database ID, and page object
 */
async function setupExamplesDataset(
  page: Page,
  _testAssets: TestAssets,
  testInfo: TestInfo,
): Promise<ExamplesSetupResult> {
  // Look up the examples database (always available in CI via load_examples)
  const examplesDb = await getDatabaseByName(page, 'examples');
  if (!examplesDb) {
    throw new Error(
      'Examples database not found. Ensure "superset load_examples" has run.',
    );
  }
  const dbId = examplesDb.id;

  // Create a uniquely-named temporary table via SQL Lab
  const uniqueSuffix = `${Date.now()}_${testInfo.parallelIndex}`;
  const tableName = `test_pw_${uniqueSuffix}`;

  // CI examples DB is always PostgreSQL, so 'public' is the correct schema.
  const createTableRes = await apiExecuteSql(
    page,
    dbId,
    `CREATE TABLE ${tableName} AS SELECT 1 AS id, 'test' AS name`,
    'public',
  );
  if (!createTableRes.ok()) {
    const errorBody = await createTableRes.json().catch(() => ({}));
    throw new Error(
      `Failed to create temp table "${tableName}": ${JSON.stringify(errorBody)}`,
    );
  }

  // Navigate to create dataset page
  const createDatasetPage = new CreateDatasetPage(page);
  await createDatasetPage.goto();
  await createDatasetPage.waitForPageLoad();

  // Select the examples database, public schema, and temp table.
  // Schema is 'public' because the CI examples DB is always PostgreSQL.
  await createDatasetPage.selectDatabase('examples');
  await createDatasetPage.selectSchema('public');
  await createDatasetPage.selectTable(tableName);

  return { tableName, dbId, createDatasetPage };
}

/**
 * Drop a temporary table created during test setup.
 * Uses failOnStatusCode: false so cleanup doesn't throw if the table was already removed.
 */
async function dropTempTable(
  page: Page,
  dbId: number,
  tableName: string,
): Promise<void> {
  // Schema matches 'public' used in setupExamplesDataset (CI examples DB is PostgreSQL).
  await apiExecuteSql(
    page,
    dbId,
    `DROP TABLE IF EXISTS ${tableName}`,
    'public',
    { failOnStatusCode: false },
  );
}

// Both tests create a temp table and use the dataset wizard, so they must run serially.
// Uses test.describe only because Playwright's serial mode API requires it -
// (Deviation from "avoid describe" guideline is necessary for functional reasons)
test.describe('create dataset wizard', () => {
  test.describe.configure({ mode: 'serial' });

  test('should create a dataset via wizard', async ({ page, testAssets }) => {
    const { tableName, dbId, createDatasetPage } = await setupExamplesDataset(
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

    if (newDatasetId) {
      testAssets.trackDataset(newDatasetId);
    }

    // Verify we navigated to Chart Creation page with dataset pre-selected
    await page.waitForURL(/.*\/chart\/add.*/);
    const chartCreationPage = new ChartCreationPage(page);
    await chartCreationPage.waitForPageLoad();

    // Verify the dataset is pre-selected
    await chartCreationPage.expectDatasetSelected(tableName);

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
    expect(loadedDatasetName).toContain(tableName);

    // Clean up temp table (dataset cleanup handled by testAssets)
    await dropTempTable(page, dbId, tableName);
  });

  test('should create a dataset without exploring', async ({
    page,
    testAssets,
  }) => {
    const { tableName, dbId, createDatasetPage } = await setupExamplesDataset(
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
    if (datasetId) {
      testAssets.trackDataset(datasetId);
    }

    // Verify redirect to dataset list (not chart creation)
    // Note: "Create dataset" action does not show a toast
    await page.waitForURL(/.*tablemodelview\/list.*/);

    // Wait for table load, verify row visible
    const datasetListPage = new DatasetListPage(page);
    await datasetListPage.waitForTableLoad();
    await expect(datasetListPage.getDatasetRow(tableName)).toBeVisible();

    // Clean up temp table (dataset cleanup handled by testAssets)
    await dropTempTable(page, dbId, tableName);
  });
});
