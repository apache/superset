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
 * E2E migration of the Cypress "Dashboard load" suite (dashboard/load.test.ts).
 *
 * Only the "should load dashboard" case is a genuine end-to-end test: it loads a
 * multi-chart dashboard and proves every chart renders by issuing real backend
 * queries. The remaining legacy cases (edit/standalone URL-param rendering,
 * send-log-data) only assert DOM/URL state with no backend round-trip and belong
 * in component/RTL coverage instead.
 *
 * The dashboard is built from scratch via the API (rather than relying on a
 * seeded example) so the test is hermetic, self-cleaning, and deterministic.
 *
 * CI green => the dashboard route mounts, every chart POSTs /api/v1/chart/data
 *             successfully, and each chart's render marker becomes visible.
 * CI red   => the dashboard failed to load or a chart never rendered.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';

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
  'dashboard loads and every chart renders via real queries',
  async ({ page, testAssets }) => {
    // Building + loading a multi-chart dashboard chains several slow queries.
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const datasetId = await findDatasetIdByName(page, DATASET_NAME);
    const datasource = `${datasetId}__table`;

    // A spread of viz types that all render cleanly from the birth_names dataset.
    const chartSpecs = [
      {
        viz_type: 'big_number_total',
        params: { datasource, viz_type: 'big_number_total', metric: 'count' },
      },
      {
        viz_type: 'table',
        params: {
          datasource,
          viz_type: 'table',
          query_mode: 'aggregate',
          groupby: ['name'],
          metrics: ['count'],
          row_limit: 100,
        },
      },
      {
        viz_type: 'echarts_timeseries_line',
        params: {
          datasource,
          viz_type: 'echarts_timeseries_line',
          x_axis: 'ds',
          time_grain_sqla: 'P1Y',
          metrics: ['count'],
          groupby: [],
          row_limit: 100,
        },
      },
    ];

    // Create each chart via the API.
    const chartIds: number[] = [];
    for (const spec of chartSpecs) {
      const resp = await apiPost(page, 'api/v1/chart/', {
        slice_name: `load_smoke_${spec.viz_type}_${Date.now()}`,
        viz_type: spec.viz_type,
        datasource_id: datasetId,
        datasource_type: 'table',
        params: JSON.stringify(spec.params),
      });
      expect(resp.ok()).toBe(true);
      const body = await resp.json();
      const chartId: number = body.id ?? body.result?.id;
      testAssets.trackChart(chartId);
      chartIds.push(chartId);
    }

    // Lay all charts out in a single row.
    const chartKeys = chartIds.map(id => `CHART-${id}`);
    const positionJson: Record<string, unknown> = {
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
        children: chartKeys,
        parents: ['ROOT_ID', 'GRID_ID'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
    };
    chartIds.forEach((chartId, index) => {
      positionJson[chartKeys[index]] = {
        type: 'CHART',
        id: chartKeys[index],
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
        meta: {
          chartId,
          width: 4,
          height: 50,
          sliceName: `load_smoke_${index}`,
        },
      };
    });

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `load_smoke_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    // Associate every chart with the dashboard so they actually render.
    await apiPut(page, `api/v1/chart/${chartIds[0]}`, {
      dashboards: [dashboardId],
    });
    for (let i = 1; i < chartIds.length; i += 1) {
      await apiPut(page, `api/v1/chart/${chartIds[i]}`, {
        dashboards: [dashboardId],
      });
    }

    // Record the real chart-data round-trips the dashboard makes on load.
    const chartDataStatuses: number[] = [];
    page.on('response', response => {
      const request = response.request();
      if (
        request.method() === 'POST' &&
        response.url().includes('/api/v1/chart/data')
      ) {
        chartDataStatuses.push(response.status());
      }
    });

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    // Every chart grid component must reach its rendered state.
    const renderedCount = await dashboard.waitForAllChartsRendered();
    expect(renderedCount).toBe(chartIds.length);

    // The render came from real backend queries, and all of them succeeded.
    expect(chartDataStatuses.length).toBeGreaterThan(0);
    expect(
      chartDataStatuses.every(status => status === 200),
      `all /api/v1/chart/data responses should be 200, got [${chartDataStatuses}]`,
    ).toBe(true);
  },
);
