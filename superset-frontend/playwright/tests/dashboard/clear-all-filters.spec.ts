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

import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';
const FILTER_COLUMN = 'gender';

async function findDatasetIdByName(page: any, name: string): Promise<number> {
  const rison = `(filters:!((col:table_name,opr:eq,value:'${name}')))`;
  const resp = await page.request.get(`api/v1/dataset/?q=${rison}`);
  const body = await resp.json();
  if (!body.result?.length) {
    throw new Error(`Dataset ${name} not found`);
  }
  return body.result[0].id;
}

testWithAssets(
  'Clear all filters waits for Apply (sc-105059)',
  async ({ page, testAssets }) => {
    const datasetId = await findDatasetIdByName(page, DATASET_NAME);

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
    const chart = await chartResp.json();
    const chartId: number = chart.id ?? chart.result?.id;
    testAssets.trackChart(chartId);

    // Create dashboard with chart in position_json and a native filter in json_metadata
    const filterId = `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`;
    const chartLayoutKey = `CHART-${chartId}`;
    const positionJson = {
      DASHBOARD_VERSION_KEY: 'v2',
      ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
      GRID_ID: {
        type: 'GRID',
        id: 'GRID_ID',
        children: ['ROW-1'],
        parents: ['ROOT_ID'],
      },
      'ROW-1': {
        type: 'ROW',
        id: 'ROW-1',
        children: [chartLayoutKey],
        parents: ['ROOT_ID', 'GRID_ID'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
      [chartLayoutKey]: {
        type: 'CHART',
        id: chartLayoutKey,
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
        meta: {
          chartId,
          width: 6,
          height: 50,
          sliceName: 'clear_all_repro',
        },
      },
    };

    const jsonMetadata = {
      native_filter_configuration: [
        {
          id: filterId,
          name: 'Gender',
          filterType: 'filter_select',
          type: 'NATIVE_FILTER',
          targets: [
            {
              datasetId,
              column: { name: FILTER_COLUMN },
            },
          ],
          controlValues: {
            multiSelect: false,
            enableEmptyFilter: false,
            defaultToFirstItem: false,
            inverseSelection: false,
            searchAllOptions: false,
          },
          defaultDataMask: { filterState: {}, extraFormData: {} },
          cascadeParentIds: [],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
          chartsInScope: [chartId],
        },
      ],
      chart_configuration: {},
      cross_filters_enabled: false,
      global_chart_configuration: {
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
        chartsInScope: [chartId],
      },
    };

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `clear_all_repro_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
      json_metadata: JSON.stringify(jsonMetadata),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    // Associate chart with the dashboard so it actually renders
    const linkResp = await apiPut(page, `api/v1/chart/${chartId}`, {
      dashboards: [dashboardId],
    });
    expect(linkResp.ok()).toBe(true);

    // Visit dashboard
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    // The Gender select should be visible in the filter bar
    const filterCombobox = page
      .locator('[data-test="form-item-value"]')
      .first()
      .locator('[role="combobox"]');
    await filterCombobox.click();
    await page
      .locator('.ant-select-item-option', { hasText: /^boy$/ })
      .first()
      .click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    const applyBtn = page.locator(
      '[data-test="filter-bar__apply-button"], [data-test="filterbar-action-buttons"] button[type="submit"]',
    );

    // Wait for chart data to come back after Apply
    const firstApplyResponse = page.waitForResponse(
      r =>
        r.url().includes('/api/v1/chart/data') &&
        r.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await applyBtn.first().click();
    await firstApplyResponse;
    await dashboardPage.waitForChartsToLoad();

    // Now track POST /api/v1/chart/data requests around Clear All
    const postsAfterClearAll: string[] = [];
    const handler = (req: any) => {
      if (
        req.url().includes('/api/v1/chart/data') &&
        req.method() === 'POST'
      ) {
        postsAfterClearAll.push(req.url());
      }
    };
    page.on('request', handler);

    const clearBtn = page.locator('[data-test="filter-bar__clear-button"]');
    await clearBtn.click();

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
    await applyBtn.first().click();
    await applyAfterClearPromise;
  },
);
