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
 * for parallel safety — which are never cached — so that guarantee is out of
 * reach: `is_cached` would always be null here and prove nothing, so it is not
 * asserted. Reproducing the original claim would require warming the cache and
 * re-reading it mid-test, racing the 30s DATA_CACHE TTL and reintroducing the
 * flakiness this migration exists to remove. The load-bearing assertion is
 * therefore that every distinct chart issues a `force=true` request and each is
 * accepted (200).
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
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';
import {
  createDashboardWithCharts,
  sliceIdFromChartDataUrl,
} from './dashboard-test-helpers';

testWithAssets(
  'dashboard-level force refresh re-queries every chart with force=true',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const { dashboardId, charts } = await createDashboardWithCharts(
      page,
      testAssets,
      testWithAssets.info(),
      {
        datasetName: 'birth_names',
        chartNamePrefix: 'controls',
        dashboardTitlePrefix: 'controls_force_refresh',
        chartSpecs: [
          { viz_type: 'big_number_total', params: { metric: 'count' } },
          {
            viz_type: 'table',
            params: {
              query_mode: 'aggregate',
              groupby: ['name'],
              metrics: ['count'],
              row_limit: 100,
            },
          },
        ],
      },
    );
    const chartIds = charts.map(chart => chart.id);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await dashboard.waitForChartsToLoad();

    // Capture the force-refresh chart-data round-trips, keyed by the chart each
    // one queried for. A `page.on('response')` listener rather than the
    // `waitForPost` helper: those resolve on a single response, and this needs
    // to collect every chart's request and correlate them by slice id. Set up
    // after the initial load so only the forced requests are recorded.
    const forcedStatusBySliceId = new Map<number, number>();
    page.on('response', response => {
      const request = response.request();
      if (
        request.method() === 'POST' &&
        response.url().includes('/api/v1/chart/data') &&
        response.url().includes('force=true')
      ) {
        const sliceId = sliceIdFromChartDataUrl(response.url());
        if (sliceId !== undefined) {
          forcedStatusBySliceId.set(sliceId, response.status());
        }
      }
    });

    await dashboard.forceRefresh();

    // Every chart — identified by slice_id, not merely by request count — must
    // fire its own forced re-query. Polling on the distinct set (rather than the
    // raw length) rejects a regression that refreshes one chart twice while
    // skipping another.
    await expect
      .poll(() => chartIds.every(id => forcedStatusBySliceId.has(id)), {
        timeout: TIMEOUT.API_RESPONSE,
      })
      .toBe(true);

    // Each forced request the backend served was accepted.
    for (const chartId of chartIds) {
      expect(
        forcedStatusBySliceId.get(chartId),
        `chart ${chartId}'s forced /api/v1/chart/data response should be 200`,
      ).toBe(200);
    }

    // The set of refreshed charts matches exactly the charts on the dashboard:
    // none skipped, none foreign.
    const byId = (a: number, b: number) => a - b;
    expect([...forcedStatusBySliceId.keys()].sort(byId)).toEqual(
      [...chartIds].sort(byId),
    );
  },
);
