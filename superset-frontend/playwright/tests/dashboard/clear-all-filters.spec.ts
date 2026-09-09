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

import type { Request } from '@playwright/test';
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
} from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { DashboardPage } from '../../pages/DashboardPage';
import { TIMEOUT } from '../../utils/constants';
import {
  buildFilterJsonMetadata,
  buildSelectFilter,
} from './dashboard-test-helpers';

const DATASET_NAME = 'birth_names';
const FILTER_COLUMN = 'gender';

testWithAssets(
  'Clear all filters waits for Apply (sc-105059)',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

    // Create a chart that the dashboard filter will target
    const chartParams = {
      datasource: `${datasetId}__table`,
      viz_type: 'big_number_total',
      metric: 'count',
      adhoc_filters: [],
      header_font_size: 0.4,
      subheader_font_size: 0.15,
    };
    const chartResp = await apiPost(page, 'api/v1/chart/', {
      slice_name: `clear_all_repro_${Date.now()}`,
      viz_type: 'big_number_total',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(chartParams),
    });
    expect(chartResp.ok()).toBe(true);
    const chartId = await extractIdFromResponse(chartResp);
    testAssets.trackChart(chartId);

    // Create dashboard with chart in position_json and a native filter in json_metadata
    const positionJson = buildSingleRowDashboardLayout([
      {
        id: chartId,
        sliceName: 'clear_all_repro',
        width: 6,
        height: 50,
      },
    ]);

    const jsonMetadata = buildFilterJsonMetadata({
      chartsInScope: [chartId],
      nativeFilters: [
        buildSelectFilter({
          datasetId,
          column: FILTER_COLUMN,
          chartsInScope: [chartId],
          name: 'Gender',
        }),
      ],
    });

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `clear_all_repro_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
      json_metadata: JSON.stringify(jsonMetadata),
    });
    expect(dashResp.ok()).toBe(true);
    const dashboardId = await extractIdFromResponse(dashResp);
    testAssets.trackDashboard(dashboardId);

    // Associate chart with the dashboard so it actually renders
    const linkResp = await apiPut(page, `api/v1/chart/${chartId}`, {
      dashboards: [dashboardId],
    });
    expect(linkResp.ok()).toBe(true);

    // Visit dashboard
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad({ timeout: TIMEOUT.SLOW_TEST });
    await dashboardPage.waitForChartsToLoad();
    const filterBar = await dashboardPage.waitForFilterBar();

    await filterBar.selectOption('boy');

    // Wait for chart data to come back after Apply
    const firstApplyResponse = page.waitForResponse(
      r =>
        r.url().includes('/api/v1/chart/data') &&
        r.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await filterBar.apply();
    await firstApplyResponse;
    await dashboardPage.waitForChartsToLoad();

    // Now track POST /api/v1/chart/data requests around Clear All
    const postsAfterClearAll: string[] = [];
    const handler = (req: Request) => {
      if (req.url().includes('/api/v1/chart/data') && req.method() === 'POST') {
        postsAfterClearAll.push(req.url());
      }
    };
    page.on('request', handler);

    await filterBar.clearAll();

    // Allow time for any debounced reload to fire if the bug is present
    await page.waitForTimeout(2000);

    page.off('request', handler);

    // BUG: on master, the Clear All triggers an immediate dispatch which
    // re-runs the chart query before the user clicks Apply. After the fix,
    // no chart/data request should fire until Apply is clicked.
    expect(
      postsAfterClearAll,
      'Clear All must not reload charts until Apply is clicked',
    ).toEqual([]);

    // After Apply, the chart should reload
    const applyAfterClearPromise = page.waitForResponse(
      r =>
        r.url().includes('/api/v1/chart/data') &&
        r.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await filterBar.apply();
    await applyAfterClearPromise;
  },
);
