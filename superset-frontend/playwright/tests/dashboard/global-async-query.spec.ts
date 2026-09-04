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
 * Global Async Queries (GAQ): the pipeline works for each of its consumers --
 * a single chart, the cache-hit shortcut that bypasses it, many charts at
 * once, and native filter value lookups.
 *
 * Failure and edge-case behavior lives in global-async-query-resilience.spec.ts.
 * SQL Lab's smoke check lives in tests/sqllab/, which needs the
 * `chromium-sqllab` project rather than this directory's default one.
 *
 * Requires the `GLOBAL_ASYNC_QUERIES` feature flag, Redis, and a running
 * Celery worker -- without a worker, submissions still return 202 but no job
 * ever executes and these tests time out. The cache-hit test is the exception:
 * it is served synchronously and needs only the flag.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPostVirtualDataset } from '../../helpers/api/dataset';
import { getDatabaseByName } from '../../helpers/api/database';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { TIMEOUT } from '../../utils/constants';
import {
  BIG_NUMBER_COUNT_SPEC,
  setupDashboardWithBigNumberCharts,
  setupDashboardWithSelectFilter,
  trackGaqSignals,
} from './dashboard-test-helpers';
import { isFeatureEnabled } from '../../helpers/featureFlags';

testWithAssets.beforeEach(async ({ page }) => {
  await page.goto('chart/list/');
  testWithAssets.skip(
    !(await isFeatureEnabled(page, 'GLOBAL_ASYNC_QUERIES')),
    'GLOBAL_ASYNC_QUERIES is not enabled on this instance',
  );
});

testWithAssets(
  'forced dashboard refresh goes through the GAQ 202 -> poll -> done cycle',
  async ({ page, testAssets }) => {
    const { dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc1_cold_cache',
          chartSpecs: [BIG_NUMBER_COUNT_SPEC],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    // Track only after the initial load settles, so these signals describe the
    // forced refresh rather than the load that preceded it.
    const signals = trackGaqSignals(page);

    // A fresh chart's query can still collide with an identical one another
    // suite already cached, so force the refresh: forced requests take the
    // async path regardless of cache state.
    await dashboard.forceRefresh();
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);

    await expect(() => {
      expect(
        signals.submitStatusFor(chart.id),
        'forced chart-data submission should be accepted (202) onto the async path',
      ).toBe(202);
      expect(
        signals.sawAsyncEventPoll,
        'the client should have polled /api/v1/async_event/ while the job ran',
      ).toBe(true);
      expect(
        signals.sawFinalCachedFetch,
        'once done, the client should fetch the real payload from /api/v1/chart/data/<cache_key>',
      ).toBe(true);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });
  },
);

testWithAssets(
  'reloading an already-cached dashboard serves the chart synchronously, without the async cycle',
  async ({ page, testAssets }) => {
    // This first load is what warms the cache -- not the request under test.
    const { dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc2_cache_hit',
          chartSpecs: [BIG_NUMBER_COUNT_SPEC],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    const signals = trackGaqSignals(page);

    // A plain reload -- same filters, no forced refresh -- is what should take
    // the cache-hit shortcut instead of re-entering the async cycle.
    await page.reload();
    await dashboard.waitForLoad();
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);

    await expect(() => {
      expect(
        signals.submitStatusFor(chart.id),
        'a cache-hit reload should resolve chart-data synchronously (200), not queue onto the async path (202)',
      ).toBe(200);
      expect(
        signals.sawAsyncEventPoll,
        'a cache hit should never need to poll /api/v1/async_event/',
      ).toBe(false);
      expect(
        signals.sawFinalCachedFetch,
        'a cache hit should never need the follow-up /api/v1/chart/data/<cache_key> fetch -- the data comes back on the initial POST',
      ).toBe(false);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });
  },
);

testWithAssets(
  'refreshing a dashboard with many charts resolves every chart independently and correctly',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    // Distinct names, so a misrouted event (one chart rendering another's
    // result) is actually detectable -- identical queries would hide it.
    const NAMES = [
      'John',
      'Mary',
      'James',
      'Linda',
      'Robert',
      'Patricia',
      'Michael',
      'Barbara',
    ];

    const { dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc5_busy_dashboard',
          chartSpecs: NAMES.map(name => ({
            viz_type: 'big_number_total',
            params: {
              metric: 'count',
              adhoc_filters: [
                {
                  clause: 'WHERE',
                  expressionType: 'SIMPLE',
                  subject: 'name',
                  operator: '==',
                  comparator: name,
                },
              ],
            },
          })),
          // 8 charts at the default width (4) would exceed the 12-column grid.
          chartWidth: 1,
        },
        { timeout: TIMEOUT.SLOW_TEST },
      );

    await Promise.all(
      valueLocators.map(locator =>
        expect(locator).toBeVisible({ timeout: TIMEOUT.CHART_RENDER }),
      ),
    );

    // Each chart's own filter is baked into its query, so its pre-refresh count
    // is per-chart ground truth. "Values aren't all identical" would not catch
    // two charts swapping results; "chart N still shows chart N's count" does.
    const expectedValues = await Promise.all(
      valueLocators.map(locator => locator.textContent()),
    );

    const signals = trackGaqSignals(page);

    await dashboard.forceRefresh();

    await Promise.all(
      valueLocators.map(locator =>
        expect(locator).toHaveText(/\d/, { timeout: TIMEOUT.CHART_RENDER }),
      ),
    );

    await expect(() => {
      for (const chart of charts) {
        expect(
          signals.submitStatusFor(chart.id),
          `chart ${chart.id} (${chart.sliceName}) should have been accepted (202) onto the async path`,
        ).toBe(202);
      }
      expect(
        signals.asyncEventPollCount,
        'the client should have polled /api/v1/async_event/ while the concurrent jobs ran',
      ).toBeGreaterThan(0);
      expect(
        signals.finalFetchCount,
        'every chart should have fetched its own final payload once done',
      ).toBeGreaterThanOrEqual(charts.length);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // If these names didn't produce distinct counts, the per-chart assertion
    // below would pass no matter how badly results were shuffled.
    expect(
      new Set(expectedValues).size,
      'each chart filters on a different name, so their pre-refresh counts should not all collapse to the same number',
    ).toBeGreaterThan(1);

    const displayedValues = await Promise.all(
      valueLocators.map(locator => locator.textContent()),
    );
    for (const [index, chart] of charts.entries()) {
      expect(
        displayedValues[index],
        `chart ${chart.id} (${chart.sliceName}) should show its own count (${expectedValues[index]}) after the refresh, not another chart's result`,
      ).toBe(expectedValues[index]);
    }
  },
);

testWithAssets(
  "opening a native filter's value dropdown populates via the same async pipeline as chart data",
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const examplesDb = await getDatabaseByName(page, 'examples');
    if (!examplesDb) {
      throw new Error('examples database not found');
    }

    // A filter's value query depends only on dataset/column, not on anything
    // per-run, so pointing at the physical table would make this cache-cold
    // once and a cache hit on every later run. The per-run SQL comment keeps
    // the query text -- and so its cache key -- unique.
    const uniqueSuffix = `${Date.now()}_${testWithAssets.info().parallelIndex}`;
    const datasetResp = await apiPostVirtualDataset(page, {
      database: examplesDb.id,
      schema: '',
      table_name: `gaq_tc8_filter_dropdown_${uniqueSuffix}`,
      sql: `SELECT name FROM birth_names /* run:${uniqueSuffix} */`,
      editors: [],
    });
    expect(datasetResp.ok()).toBe(true);
    const datasetId = await extractIdFromResponse(datasetResp);
    testAssets.trackDataset(datasetId);

    const { dashboardId, dashboard, filterBar } =
      await setupDashboardWithSelectFilter(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetId,
          namePrefix: 'gaq_tc8_filter_dropdown',
          // Thousands of distinct values, so populating the dropdown needs a
          // real query rather than a handful of values the UI could inline.
          filterColumn: 'name',
          filterName: 'Name',
        },
      );

    // Track before navigating: the fetch under test fires during the filter
    // panel's own initialization, not in response to anything we do later.
    const signals = trackGaqSignals(page);

    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad({ timeout: TIMEOUT.SLOW_TEST });
    await dashboard.waitForChartsToLoad();

    // Filter-value requests hit the same endpoint as chart data but carry no
    // slice_id, which is exactly how they're told apart here.
    //
    // Asserted before the dropdown is touched at all: the options are fetched
    // during panel init and then served from client state, so opening the
    // dropdown does not trigger this cycle and must not appear to.
    await expect(() => {
      expect(
        signals.submitStatusFor(),
        'the filter-value fetch should be accepted (202) onto the async path, same as a chart-data request',
      ).toBe(202);
      expect(
        signals.sawAsyncEventPoll,
        'the client should have polled /api/v1/async_event/ while the filter-value job ran',
      ).toBe(true);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // Separately: those already-fetched options actually render.
    const filterSelect = filterBar.getFilterValueSelect();
    await filterSelect.open();

    await expect(filterSelect.options.first()).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });
    await expect(async () => {
      expect(await filterSelect.options.count()).toBeGreaterThanOrEqual(5);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });
  },
);
