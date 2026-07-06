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
 * Regression coverage for #38152 (PR #38165): the Explore "Results" tab reuses
 * the chart's already-fetched query data instead of firing a second, identical
 * request to /api/v1/chart/data. The duplicate only exists across the real
 * backend round-trip; the reuse-vs-fallback and row-limit slicing logic is
 * unit-tested in useResultsPane.test.tsx, so this E2E asserts only the
 * end-to-end win: opening Results issues no extra chart/data request.
 *
 * Lives under tests/experimental/ until proven stable in CI; run with:
 *   INCLUDE_EXPERIMENTAL=true npm run playwright:test \
 *     tests/experimental/explore/results-tab-reuse.spec.ts -- --headed
 */
import { testWithAssets, expect } from '../../../helpers/fixtures';
import { apiPostChart } from '../../../helpers/api/chart';
import { getDatasetByName } from '../../../helpers/api/dataset';
import { ExplorePage } from '../../../pages/ExplorePage';
import { TIMEOUT } from '../../../utils/constants';

const DATASET_NAME = 'birth_names';
const CHART_DATA_PATH = '/api/v1/chart/data';

testWithAssets(
  'Results tab reuses chart data without a duplicate query (#38165)',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    let chartDataRequests = 0;
    page.on('request', request => {
      if (
        request.method() === 'POST' &&
        request.url().includes(CHART_DATA_PATH)
      ) {
        chartDataRequests += 1;
      }
    });

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

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
    const chartResp = await apiPostChart(page, {
      slice_name: `results_tab_reuse_${Date.now()}`,
      viz_type: 'table',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(params),
    });
    expect(chartResp.ok()).toBe(true);
    const chartBody = await chartResp.json();
    const chartId: number = chartBody.result?.id ?? chartBody.id;
    expect(chartId, 'chart creation should return an id').toBeTruthy();
    testAssets.trackChart(chartId);

    // Wait for the chart query to finish so its result is in Redux; opening
    // Results before that races and falls back to its own request.
    const explorePage = new ExplorePage(page);
    const chartQueryFinished = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        response.url().includes(CHART_DATA_PATH),
      { timeout: TIMEOUT.API_RESPONSE },
    );
    await explorePage.goto(chartId);
    await chartQueryFinished;

    const chartContainer = explorePage.getChartContainer();
    await chartContainer.waitFor({
      state: 'visible',
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await chartContainer
      .getByRole('status', { name: 'Loading' })
      .waitFor({ state: 'hidden', timeout: TIMEOUT.API_RESPONSE })
      .catch(() => {}); // spinner may have already cleared

    expect(chartDataRequests).toBeGreaterThanOrEqual(1);
    const requestsAfterChartLoad = chartDataRequests;

    await explorePage.openResultsTab();
    const grid = explorePage.getResultsGrid();
    await grid.waitForRows({ timeout: TIMEOUT.API_RESPONSE });
    expect(await grid.getRowCount()).toBeGreaterThan(0);

    // Allow time for an unwanted duplicate request, then assert none fired.
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(1500);
    expect(
      chartDataRequests,
      'opening Results must not trigger a second chart/data query',
    ).toBe(requestsAfterChartLoad);
  },
);
