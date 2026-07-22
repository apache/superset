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
 * E2E migration of the Cypress "Dashboard top-level controls" suite
 * (dashboard/controls.test.ts).
 *
 * The genuine end-to-end behaviour is the dashboard-level force refresh: every
 * chart on the dashboard must re-query the backend with `force=true`. This can
 * only be verified against a real backend, so it is migrated here.
 *
 * Scope note on cache bypass: the original Cypress test ran against the
 * pre-seeded World Health dashboard, whose charts were already warm, so it could
 * assert `is_cached === false` and thereby prove force-refresh busted a
 * populated cache. This test deliberately creates fresh, isolated charts per run
 * for parallel safety — which are never cached — so it cannot make that claim.
 * Reproducing it would require warming the cache and re-reading it mid-test,
 * racing the 30s DATA_CACHE TTL and reintroducing the flakiness this migration
 * exists to remove. The load-bearing assertion here is therefore that every
 * distinct chart issues a `force=true` request and gets a 200; `is_cached` is
 * checked only as a falsy smoke signal (expected `null` for these fresh charts).
 *
 * The other case ("should allow chart level refresh") only asserted the menu
 * item's `ant-dropdown-menu-item-disabled` class — a DOM/state assertion with no
 * backend round-trip, and one the original itself flagged as flaky. It belongs
 * in component/RTL coverage and is intentionally not migrated.
 *
 * CI green => force refresh re-queries every distinct chart with force=true and
 *             each request returns 200.
 * CI red   => force refresh did not re-query every chart, or a request failed.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
  type DashboardLayoutChart,
} from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';
import { sliceIdFromChartDataUrl } from './dashboard-test-helpers';

const DATASET_NAME = 'birth_names';

testWithAssets(
  'dashboard-level force refresh re-queries every chart with force=true and uncached results',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;
    const datasource = `${datasetId}__table`;

    const chartSpecs = [
      { datasource, viz_type: 'big_number_total', metric: 'count' },
      {
        datasource,
        viz_type: 'table',
        query_mode: 'aggregate',
        groupby: ['name'],
        metrics: ['count'],
        row_limit: 100,
      },
    ];

    // Parallel-safe suffix so chart/dashboard names never collide across workers.
    const uniqueSuffix = `${Date.now()}_${testWithAssets.info().parallelIndex}`;

    const charts: DashboardLayoutChart[] = [];
    for (const params of chartSpecs) {
      const sliceName = `controls_${params.viz_type}_${uniqueSuffix}`;
      const resp = await apiPostChart(page, {
        slice_name: sliceName,
        viz_type: params.viz_type,
        datasource_id: datasetId,
        datasource_type: 'table',
        params: JSON.stringify(params),
      });
      expect(resp.ok()).toBe(true);
      const chartId = await extractIdFromResponse(resp);
      testAssets.trackChart(chartId);
      charts.push({ id: chartId, sliceName });
    }
    const chartIds = charts.map(chart => chart.id);

    // Lay all charts out in a single row.
    const positionJson = buildSingleRowDashboardLayout(charts);

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `controls_force_refresh_${uniqueSuffix}`,
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

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    // Initial load warms the cache; the force refresh must then bypass it.
    await dashboard.waitForChartsToLoad();

    // Capture the force-refresh chart-data round-trips, keyed by the chart each
    // one queried for. A `page.on('response')` listener rather than the
    // `waitForPost` helper: those resolve on a single response, and this needs
    // to collect every chart's request and correlate them by slice id.
    const forcedSliceIds = new Set<number>();
    const forceResponses: Promise<{
      sliceId: number;
      status: number;
      isCached: unknown;
    }>[] = [];
    page.on('response', response => {
      const request = response.request();
      if (
        request.method() === 'POST' &&
        response.url().includes('/api/v1/chart/data') &&
        response.url().includes('force=true')
      ) {
        const sliceId = sliceIdFromChartDataUrl(response.url());
        // Only track requests we can tie back to a chart, and keep both
        // collections in agreement: an unparsable slice id would otherwise land
        // in forceResponses as `undefined` and fail the `chartIds.toContain`
        // check below with a confusing message.
        if (sliceId === undefined) return;
        forcedSliceIds.add(sliceId);
        forceResponses.push(
          (async () => {
            const body = await response.json();
            const result = Array.isArray(body.result) ? body.result[0] : body;
            return {
              sliceId,
              status: response.status(),
              isCached: result?.is_cached,
            };
          })(),
        );
      }
    });

    await dashboard.forceRefresh();

    // Every chart — identified by slice_id, not merely by request count — must
    // fire its own forced re-query. Polling on the distinct set (rather than the
    // raw length) rejects a regression that refreshes one chart twice while
    // skipping another.
    await expect
      .poll(() => chartIds.every(id => forcedSliceIds.has(id)), {
        timeout: TIMEOUT.API_RESPONSE,
      })
      .toBe(true);

    const resolved = await Promise.all(forceResponses);
    for (const { sliceId, status, isCached } of resolved) {
      // Each forced request targeted one of this dashboard's charts...
      expect(chartIds).toContain(sliceId);
      // ...and the backend served a real result.
      expect(status).toBe(200);
      // Smoke check only: these freshly-created charts are never cached, so
      // is_cached is expected to be falsy (`null`). This does NOT prove the
      // force-refresh busted a warm cache — see the scope note in the file
      // header for why that guarantee is out of reach here.
      expect(
        isCached,
        `force-refreshed result should not be cached, got is_cached=${isCached}`,
      ).toBeFalsy();
    }

    // The set of refreshed charts matches exactly the charts on the dashboard:
    // none skipped, none foreign.
    const byId = (a: number, b: number) => a - b;
    expect([...forcedSliceIds].sort(byId)).toEqual([...chartIds].sort(byId));
  },
);
