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
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';
import { buildDashboardPositionJson } from './dashboard-test-helpers';

const DATASET_NAME = 'birth_names';

testWithAssets(
  'dashboard loads and every chart renders via real queries',
  async ({ page, testAssets }) => {
    // Building + loading a multi-chart dashboard chains several slow queries.
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;
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

    // Parallel-safe suffix so chart/dashboard names never collide across workers.
    const uniqueSuffix = `${Date.now()}_${testWithAssets.info().parallelIndex}`;

    // Create each chart via the API.
    const charts: { id: number; sliceName: string }[] = [];
    for (const spec of chartSpecs) {
      const sliceName = `load_smoke_${spec.viz_type}_${uniqueSuffix}`;
      const resp = await apiPostChart(page, {
        slice_name: sliceName,
        viz_type: spec.viz_type,
        datasource_id: datasetId,
        datasource_type: 'table',
        params: JSON.stringify(spec.params),
      });
      expect(resp.ok()).toBe(true);
      const chartId = await extractIdFromResponse(resp);
      testAssets.trackChart(chartId);
      charts.push({ id: chartId, sliceName });
    }
    const chartIds = charts.map(chart => chart.id);

    // Lay all charts out in a single row.
    const positionJson = buildDashboardPositionJson(charts);

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `load_smoke_${uniqueSuffix}`,
      published: true,
      position_json: JSON.stringify(positionJson),
    });
    expect(dashResp.ok()).toBe(true);
    const dashboardId = await extractIdFromResponse(dashResp);
    testAssets.trackDashboard(dashboardId);

    // Associate every chart with the dashboard so they actually render.
    for (const chartId of chartIds) {
      await apiPutChart(page, chartId, { dashboards: [dashboardId] });
    }

    // Record the real chart-data round-trips the dashboard makes on load,
    // keyed by the chart each one queried for. The chart-data POST carries its
    // slice id in the encoded `form_data={"slice_id":<id>}` query param (see
    // chartAction.ts), so parsing it lets us prove every chart queried — not
    // just that some chart did.
    const chartDataStatusBySliceId = new Map<number, number>();
    page.on('response', response => {
      const request = response.request();
      if (
        request.method() !== 'POST' ||
        !response.url().includes('/api/v1/chart/data')
      ) {
        return;
      }
      const formData = new URL(response.url()).searchParams.get('form_data');
      if (!formData) {
        return;
      }
      try {
        const sliceId = JSON.parse(formData).slice_id;
        if (typeof sliceId === 'number') {
          chartDataStatusBySliceId.set(sliceId, response.status());
        }
      } catch {
        // Not a slice-id form_data payload; ignore.
      }
    });

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    // Each expected chart must reach its rendered state; a chart that never
    // renders makes this time out and fail rather than passing silently.
    await dashboard.waitForAllChartsRendered(chartIds);

    // The render came from real backend queries: every chart issued its own
    // chart-data POST and each one succeeded.
    for (const chartId of chartIds) {
      const status = chartDataStatusBySliceId.get(chartId);
      expect(
        status,
        `chart ${chartId} should have issued a /api/v1/chart/data POST`,
      ).toBeDefined();
      expect(
        status,
        `chart ${chartId}'s /api/v1/chart/data response should be 200`,
      ).toBe(200);
    }
  },
);
