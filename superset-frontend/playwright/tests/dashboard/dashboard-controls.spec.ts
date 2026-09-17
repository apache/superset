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
 * pre-seeded World Health dashboard and asserted `is_cached === false` on the
 * refreshed responses, proving force-refresh busted a populated cache. This
 * migration asserts the observable network contract instead — every chart
 * re-queries with `force=true` and each response is accepted (200) — and does
 * not assert `is_cached`. Tying the assertion to cache state would mean
 * reasoning about whatever the initial dashboard load left in the DATA_CACHE and
 * racing its 30s TTL, reintroducing the flakiness this migration exists to
 * remove. `force=true` is itself the server-side instruction to bypass the
 * cache, so asserting it fires on every distinct chart — and each request is
 * accepted (200) — is a direct, deterministic check of the force-refresh
 * behaviour.
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
    // after the initial load so only the forced requests are recorded. Statuses
    // accumulate per chart rather than being overwritten, so a failure followed
    // by a successful retry still surfaces, provided both responses land before
    // the assertions read the map. That is a defence-in-depth choice more than a
    // guarantee: the client retries only 502/503/504, so an application-level
    // failure is never retried away to begin with.
    const forcedStatusesBySliceId = new Map<number, number[]>();
    page.on('response', response => {
      const request = response.request();
      if (request.method() !== 'POST') {
        return;
      }
      const url = new URL(response.url());
      // Match `force` exactly as a query param — a substring check would also
      // accept `enforce=true` or `force=trueish`.
      if (
        !url.pathname.includes('/api/v1/chart/data') ||
        url.searchParams.get('force') !== 'true'
      ) {
        return;
      }
      const sliceId = sliceIdFromChartDataUrl(response.url());
      if (sliceId !== undefined) {
        const statuses = forcedStatusesBySliceId.get(sliceId) ?? [];
        statuses.push(response.status());
        forcedStatusesBySliceId.set(sliceId, statuses);
      }
    });

    await dashboard.forceRefresh();

    // Every chart — identified by slice_id, not merely by request count — must
    // fire its own forced re-query, and no foreign chart may: polling the
    // distinct set (rather than the raw request count) rejects a regression that
    // refreshes one chart twice while skipping another. On timeout the diff
    // names the slice ids that never arrived.
    const byId = (a: number, b: number) => a - b;
    await expect
      .poll(() => [...forcedStatusesBySliceId.keys()].sort(byId), {
        message:
          'every dashboard chart should issue its own forced /api/v1/chart/data request',
        timeout: TIMEOUT.API_RESPONSE,
      })
      .toEqual([...chartIds].sort(byId));

    // Every forced request recorded for a chart was accepted — all attempts, not
    // just the last. The poll above already established that the recorded slice
    // ids are exactly the dashboard's charts, so iterating the map needs no
    // presence or emptiness guard.
    for (const [sliceId, statuses] of forcedStatusesBySliceId) {
      expect(
        statuses.every(status => status === 200),
        `chart ${sliceId}'s forced /api/v1/chart/data responses should all be 200, got [${statuses}]`,
      ).toBe(true);
    }
  },
);
