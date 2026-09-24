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
 * Migrated from the deleted Cypress `_skip.link.test.ts` (save-as/overwrite
 * coverage only; the view-query and iframe cases moved to RTL elsewhere).
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import {
  apiPostChart,
  apiGetChart,
  getChartsByName,
} from '../../helpers/api/chart';
import { getDashboardsByName } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { waitForPost, waitForPut } from '../../helpers/api/intercepts';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { ExplorePage } from '../../pages/ExplorePage';
import { TIMEOUT } from '../../utils/constants';

const DATASET_NAME = 'birth_names';

async function createBaseChart(
  page: import('@playwright/test').Page,
  name: string,
  datasetId: number,
): Promise<number> {
  const params = {
    datasource: `${datasetId}__table`,
    viz_type: 'table',
    query_mode: 'raw',
    all_columns: ['name', 'gender', 'num'],
    adhoc_filters: [],
    order_by_cols: [],
    row_limit: 1000,
    server_pagination: false,
  };
  const resp = await apiPostChart(page, {
    slice_name: name,
    viz_type: 'table',
    datasource_id: datasetId,
    datasource_type: 'table',
    params: JSON.stringify(params),
  });
  expect(resp.ok()).toBe(true);
  return extractIdFromResponse(resp);
}

testWithAssets(
  'save as a new chart, then overwrite it (exactly one chart by name)',
  async ({ page, testAssets }, testInfo) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) throw new Error(`Dataset ${DATASET_NAME} not found`);

    const uniqueSuffix = `${Date.now()}_${testInfo.parallelIndex}`;
    const baseChartName = `explore_save_base_${uniqueSuffix}`;
    const newChartName = `explore_save_new_${uniqueSuffix}`;

    const baseChartId = await createBaseChart(page, baseChartName, dataset.id);
    testAssets.trackChart(baseChartId);

    const explorePage = new ExplorePage(page);
    await explorePage.goto(baseChartId);

    // Save as a brand-new chart.
    const saveModal = await explorePage.openSaveModal();
    await saveModal.selectSaveAction('saveas');
    await saveModal.fillChartName(newChartName);
    const created = waitForPost(page, 'api/v1/chart/');
    await saveModal.clickSave();
    const createdResponse = await created;
    const newChartId = await extractIdFromResponse(createdResponse);
    testAssets.trackChart(newChartId);

    await explorePage.waitForPageLoad();

    // Overwrite the newly created chart.
    const saveModal2 = await explorePage.openSaveModal();
    await saveModal2.selectSaveAction('overwrite');
    const updated = waitForPut(page, `api/v1/chart/${newChartId}`, {
      pathMatch: true,
    });
    await saveModal2.clickSave();
    expect((await updated).ok()).toBe(true);

    const { count } = await getChartsByName(page, newChartName);
    expect(count).toBe(1);
  },
);

testWithAssets(
  'save as + add to new dashboard, then overwrite selecting the existing dashboard',
  async ({ page, testAssets }, testInfo) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) throw new Error(`Dataset ${DATASET_NAME} not found`);

    const uniqueSuffix = `${Date.now()}_${testInfo.parallelIndex}`;
    const baseChartName = `explore_save_dash_base_${uniqueSuffix}`;
    const newChartName = `explore_save_dash_new_${uniqueSuffix}`;
    const dashboardTitle = `explore_save_dash_${uniqueSuffix}`;

    const baseChartId = await createBaseChart(page, baseChartName, dataset.id);
    testAssets.trackChart(baseChartId);

    const explorePage = new ExplorePage(page);
    await explorePage.goto(baseChartId);

    // Save as a new chart, adding it to a brand-new dashboard (creatable select).
    const saveModal = await explorePage.openSaveModal();
    await saveModal.selectSaveAction('saveas');
    await saveModal.fillChartName(newChartName);
    await saveModal.selectDashboard(dashboardTitle);
    const dashboardCreated = waitForPost(page, 'api/v1/dashboard/', {
      pathMatch: true,
    });
    const created = waitForPost(page, 'api/v1/chart/');
    await saveModal.clickSave();
    // Track the dashboard before the chart POST so a later failure still
    // cleans it up.
    const dashboardId = await extractIdFromResponse(await dashboardCreated);
    testAssets.trackDashboard(dashboardId);
    const createdResponse = await created;
    const newChartId = await extractIdFromResponse(createdResponse);
    testAssets.trackChart(newChartId);

    const dashboardsAfterCreate = await getDashboardsByName(
      page,
      dashboardTitle,
    );
    expect(dashboardsAfterCreate.count).toBe(1);
    expect(dashboardsAfterCreate.result[0].id).toBe(dashboardId);

    await explorePage.waitForPageLoad();

    // Overwrite, selecting the now-existing dashboard by the same title.
    const saveModal2 = await explorePage.openSaveModal();
    await saveModal2.selectSaveAction('overwrite');
    await saveModal2.selectDashboard(dashboardTitle);
    const updated = waitForPut(page, `api/v1/chart/${newChartId}`, {
      pathMatch: true,
    });
    await saveModal2.clickSave();
    expect((await updated).ok()).toBe(true);

    const chartsResult = await getChartsByName(page, newChartName);
    expect(chartsResult.count).toBe(1);

    const dashboardsResult = await getDashboardsByName(page, dashboardTitle);
    expect(dashboardsResult.count).toBe(1);

    // Confirm the chart is actually associated with the dashboard.
    const chartDetail = await apiGetChart(page, newChartId);
    const chartBody = await chartDetail.json();
    const dashboardIds: number[] = (chartBody.result?.dashboards ?? []).map(
      (d: { id: number }) => d.id,
    );
    expect(dashboardIds).toContain(dashboardsResult.result[0].id);
  },
);
