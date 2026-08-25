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
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';
const WIDE_VIEWPORT = { width: 1400, height: 900 };
const NARROW_VIEWPORT = { width: 700, height: 900 };

testWithAssets(
  'chart in a hidden tab refits its container after the tab is revealed at a new width',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;
    const datasource = `${datasetId}__table`;

    const chartSpecs = [
      {
        slug: 'treemap',
        params: {
          datasource,
          viz_type: 'treemap_v2',
          metric: 'count',
          groupby: ['gender'],
          row_limit: 100,
        },
      },
      {
        slug: 'table',
        params: {
          datasource,
          viz_type: 'table',
          query_mode: 'aggregate',
          groupby: ['name'],
          metrics: ['count'],
          row_limit: 100,
        },
      },
    ];

    const chartIds: Record<string, number> = {};
    for (const { slug, params } of chartSpecs) {
      const resp = await apiPostChart(page, {
        slice_name: `tabs_${slug}_${Date.now()}`,
        viz_type: params.viz_type,
        datasource_id: datasetId,
        datasource_type: 'table',
        params: JSON.stringify(params),
      });
      expect(resp.ok()).toBe(true);
      const chartId = await extractIdFromResponse(resp);
      testAssets.trackChart(chartId);
      chartIds[slug] = chartId;
    }

    const treemapKey = `CHART-${chartIds.treemap}`;
    const tableKey = `CHART-${chartIds.table}`;

    const positionJson: Record<string, unknown> = {
      DASHBOARD_VERSION_KEY: 'v2',
      ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
      GRID_ID: {
        type: 'GRID',
        id: 'GRID_ID',
        children: ['TABS-TOP'],
        parents: ['ROOT_ID'],
      },
      'TABS-TOP': {
        type: 'TABS',
        id: 'TABS-TOP',
        children: ['TAB-A', 'TAB-B'],
        parents: ['ROOT_ID', 'GRID_ID'],
        meta: {},
      },
      'TAB-A': {
        type: 'TAB',
        id: 'TAB-A',
        children: ['ROW-A'],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP'],
        meta: {
          text: 'Tab A',
          defaultText: 'Tab title',
          placeholder: 'Tab title',
        },
      },
      'TAB-B': {
        type: 'TAB',
        id: 'TAB-B',
        children: ['ROW-B'],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP'],
        meta: {
          text: 'Tab B',
          defaultText: 'Tab title',
          placeholder: 'Tab title',
        },
      },
      'ROW-A': {
        type: 'ROW',
        id: 'ROW-A',
        children: [treemapKey],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-A'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
      'ROW-B': {
        type: 'ROW',
        id: 'ROW-B',
        children: [tableKey],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-B'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
      [treemapKey]: {
        type: 'CHART',
        id: treemapKey,
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-A', 'ROW-A'],
        meta: {
          chartId: chartIds.treemap,
          width: 12,
          height: 50,
          sliceName: 'treemap',
        },
      },
      [tableKey]: {
        type: 'CHART',
        id: tableKey,
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-B', 'ROW-B'],
        meta: {
          chartId: chartIds.table,
          width: 12,
          height: 50,
          sliceName: 'table',
        },
      },
    };

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `tabs_resize_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
    });
    expect(dashResp.ok()).toBe(true);
    const dashboardId = await extractIdFromResponse(dashResp);
    testAssets.trackDashboard(dashboardId);

    for (const chartId of Object.values(chartIds)) {
      await apiPutChart(page, chartId, {
        dashboards: [dashboardId],
      });
    }

    await page.setViewportSize(WIDE_VIEWPORT);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    const treemapContainer = page
      .locator('[data-test-viz-type="treemap_v2"]')
      .locator('[data-test="chart-container"]');
    await treemapContainer.waitFor({
      state: 'visible',
      timeout: TIMEOUT.API_RESPONSE,
    });
    await dashboard.waitForChartsToLoad();

    const echartsHost = treemapContainer.locator('.echarts-host');
    const widthAtWide = await echartsHost.evaluate(
      (element: HTMLElement) => element.offsetWidth,
    );

    await dashboard.dashboardTabs.clickTab('Tab B');
    await expect
      .poll(() => dashboard.dashboardTabs.getActiveTabName())
      .toBe('Tab B');
    await page.setViewportSize(NARROW_VIEWPORT);
    await dashboard.dashboardTabs.clickTab('Tab A');
    await expect
      .poll(() => dashboard.dashboardTabs.getActiveTabName())
      .toBe('Tab A');

    await treemapContainer.waitFor({
      state: 'visible',
      timeout: TIMEOUT.API_RESPONSE,
    });
    await dashboard.waitForChartsToLoad();

    await expect
      .poll(
        () =>
          echartsHost.evaluate((element: HTMLElement) => element.offsetWidth),
        {
          timeout: TIMEOUT.API_RESPONSE,
          message: 'treemap should resize after the hidden tab is revealed',
        },
      )
      .toBeLessThan(widthAtWide);
  },
);
