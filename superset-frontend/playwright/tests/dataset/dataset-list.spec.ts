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
import { DatasetListPage } from '../../pages/DatasetListPage';
import { ExplorePage } from '../../pages/ExplorePage';

test.describe('Dataset List', () => {
  let datasetListPage: DatasetListPage;
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }) => {
    datasetListPage = new DatasetListPage(page);
    explorePage = new ExplorePage(page);

    // Navigate to dataset list page
    await datasetListPage.goto();
    await datasetListPage.waitForTableLoad();
  });

  test('should navigate to Explore when dataset name is clicked', async () => {
    // Test uses existing fixture dataset 'birth_names'
    // (available in Superset examples database)

    // Verify dataset is visible in list (uses page object + Playwright auto-wait)
    await expect(datasetListPage.getDatasetRow('birth_names')).toBeVisible();

    // Click on dataset name to navigate to Explore
    await datasetListPage.clickDatasetName('birth_names');

    // Wait for Explore page to load (validates URL + datasource control)
    await explorePage.waitForPageLoad();

    // Verify correct dataset is loaded in datasource control
    const datasetName = await explorePage.getDatasetName();
    expect(datasetName).toContain('birth_names');

    // Verify visualization switcher shows default viz type (indicates full page load)
    await expect(explorePage.getVizSwitcher()).toBeVisible();
    await expect(explorePage.getVizSwitcher()).toContainText('Table');
  });
});
