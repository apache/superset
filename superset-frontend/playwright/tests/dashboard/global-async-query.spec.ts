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
 * a cold first load, a forced refresh, the cache-hit shortcut that bypasses the
 * cycle entirely, many charts at once, and native filter value lookups.
 *
 * Failure and edge-case behavior lives in global-async-query-resilience.spec.ts.
 * SQL Lab's smoke check lives in tests/sqllab/ but runs under the same
 * `chromium-gaq` project as these specs -- `chromium-sqllab` deliberately
 * excludes it via `testIgnore`, since it needs the flag only the GAQ job sets.
 *
 * Requires the `GLOBAL_ASYNC_QUERIES` feature flag, Redis, and a running
 * Celery worker -- without a worker, submissions still return 202 but no job
 * ever executes and these tests time out. The cache-hit test is the exception:
 * it is served synchronously and needs only the flag.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { TIMEOUT } from '../../utils/constants';
import {
  ADHOC_COUNT_NAME_METRIC,
  BIG_NUMBER_ADHOC_COUNT_SPEC,
  BIG_NUMBER_COUNT_SPEC,
  BIG_NUMBER_QUERY_CLOCK_SPEC,
  bigNumberValueLocator,
  createCacheColdVirtualDataset,
  createDashboardWithCharts,
  createQueryClockDataset,
  readQueryClock,
  setupDashboardWithBigNumberCharts,
  setupDashboardWithSelectFilter,
  trackGaqSignals,
} from './dashboard-test-helpers';
import { DashboardPage } from '../../pages/DashboardPage';
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
    // The chart renders the server clock rather than a count: example data is
    // static, so "still shows a number" after a refresh holds whether the DOM
    // re-rendered or never changed at all. A stamp that must advance does not.
    const { datasetId } = await createQueryClockDataset(
      page,
      testAssets,
      testWithAssets.info(),
      { namePrefix: 'gaq_tc1_cold_cache' },
    );
    const { dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetId,
          chartNamePrefix: 'gaq_tc1_cold_cache',
          chartSpecs: [BIG_NUMBER_QUERY_CLOCK_SPEC],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    const clockBefore = await readQueryClock(value);
    expect(clockBefore, 'the chart should render a stamp').toBeGreaterThan(0);

    // Track only after the initial load settles, so these signals describe the
    // forced refresh rather than the load that preceded it.
    const signals = trackGaqSignals(page);

    // A fresh chart's query can still collide with an identical one another
    // suite already cached, so force the refresh: forced requests take the
    // async path regardless of cache state.
    await dashboard.forceRefresh();

    await expect(() => {
      expect(
        signals.submitStatusFor(chart.id),
        'forced chart-data submission should be accepted (202) onto the async path',
      ).toBe(202);
      expect(
        signals.sawTaskStatusPoll,
        'the client should have polled /api/v1/task/status_changes while the tasks ran',
      ).toBe(true);
      expect(
        signals.submitStatusesFor(chart.id),
        'the client should re-issue chart-data once the tasks finish and be served 200 from the warmed cache',
      ).toEqual([202, 200]);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // Render-level proof, which the signals above cannot give: the refresh
    // re-executed the query, so the stamp on screen has to be newer.
    await expect
      .poll(() => readQueryClock(value), {
        message:
          'the forced refresh should repaint the chart with its new result',
        timeout: TIMEOUT.CHART_RENDER,
      })
      .toBeGreaterThan(clockBefore);
  },
);

testWithAssets(
  'a cold first load resolves through the GAQ cycle with no manual refresh',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    // The test above forces a refresh, because a fresh chart over a shared
    // physical table can collide with a query another suite already cached and
    // a forced request takes the async path regardless of cache state. That
    // leaves the unforced first load -- the one a real user gets -- unasserted.
    //
    // A cache-cold dataset removes the need to force anything, so the async
    // cycle can be asserted on the initial render itself.
    const { datasetId } = await createCacheColdVirtualDataset(
      page,
      testAssets,
      testWithAssets.info(),
      { namePrefix: 'gaq_cold_first_load' },
    );

    const { dashboardId, charts } = await createDashboardWithCharts(
      page,
      testAssets,
      testWithAssets.info(),
      {
        datasetId,
        chartNamePrefix: 'gaq_cold_first_load',
        // An ad-hoc metric, not the saved `count` the physical example datasets
        // ship with: a dataset created through the API carries no metrics at
        // all, so a saved-metric reference would not resolve.
        chartSpecs: [BIG_NUMBER_ADHOC_COUNT_SPEC],
      },
    );
    const [chart] = charts;
    const dashboard = new DashboardPage(page);
    const value = bigNumberValueLocator(dashboard, chart.id);

    // Track before navigating: the request under test is the one the first page
    // load fires, so there is no later point at which to start listening.
    const signals = trackGaqSignals(page);

    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad({ timeout: TIMEOUT.SLOW_TEST });

    // The regression this guards: the chart resolves on the first load. An async
    // handoff that never completes leaves a spinner here and the user has to
    // refresh to get a number -- which the forced-refresh test cannot catch,
    // because refreshing is the very thing it does.
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);

    await expect(() => {
      expect(
        signals.submitStatusFor(chart.id),
        'a cold first load should be accepted (202) onto the async path',
      ).toBe(202);
      expect(
        signals.sawTaskStatusPoll,
        'the client should have polled /api/v1/task/status_changes while the task ran',
      ).toBe(true);
      expect(
        signals.submitStatusesFor(chart.id),
        'the first load alone should complete the round trip -- 202, then 200 from the warmed cache -- without any user-initiated refresh',
      ).toEqual([202, 200]);
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
    await expect(value).toHaveText(/\d/);
    const cachedText = await value.textContent();

    const signals = trackGaqSignals(page);

    // A plain reload -- same filters, no forced refresh -- is what should take
    // the cache-hit shortcut instead of re-entering the async cycle.
    await page.reload();
    await dashboard.waitForLoad();
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    // The exact value, not just "a digit": a cache hit must reproduce the
    // cached result, and the reload rebuilds the DOM so this cannot pass on
    // what was already on screen.
    await expect(value).toHaveText(cachedText ?? '');

    await expect(() => {
      expect(
        signals.submitStatusesFor(chart.id),
        'a cache-hit reload should resolve chart-data synchronously (200) on the first request, never queueing onto the async path (202) or needing a re-request',
      ).toEqual([200]);
      expect(
        signals.sawTaskStatusPoll,
        'a cache hit should never need to poll /api/v1/task/status_changes',
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

    // Static example data means a correct refresh reproduces every count
    // exactly, so "same number as before" cannot tell a genuine re-render from
    // a DOM that never updated. One extra chart shows the query clock, which
    // must move on a correct refresh.
    const { datasetId } = await createQueryClockDataset(
      page,
      testAssets,
      testWithAssets.info(),
      { namePrefix: 'gaq_tc5_busy_dashboard' },
    );

    const { dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetId,
          chartNamePrefix: 'gaq_tc5_busy_dashboard',
          chartSpecs: [
            ...NAMES.map(name => ({
              viz_type: 'big_number_total',
              params: {
                metric: ADHOC_COUNT_NAME_METRIC,
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
            BIG_NUMBER_QUERY_CLOCK_SPEC,
          ],
          // 9 charts at the default width (4) would exceed the 12-column grid.
          chartWidth: 1,
        },
        { timeout: TIMEOUT.SLOW_TEST },
      );
    const nameCharts = charts.slice(0, NAMES.length);
    const nameValues = valueLocators.slice(0, NAMES.length);
    const clockValue = valueLocators[NAMES.length];
    const readClock = () => readQueryClock(clockValue);

    await Promise.all(
      valueLocators.map(locator =>
        expect(locator).toBeVisible({ timeout: TIMEOUT.CHART_RENDER }),
      ),
    );

    // Each chart's own filter is baked into its query, so its pre-refresh count
    // is per-chart ground truth. "Values aren't all identical" would not catch
    // two charts swapping results; "chart N still shows chart N's count" does.
    const expectedValues = await Promise.all(
      nameValues.map(locator => locator.textContent()),
    );
    const clockBefore = await readClock();
    expect(
      clockBefore,
      'the clock chart should render a timestamp',
    ).toBeGreaterThan(0);

    const signals = trackGaqSignals(page);

    await dashboard.forceRefresh();

    await expect(() => {
      for (const chart of charts) {
        expect(
          signals.submitStatusesFor(chart.id),
          `chart ${chart.id} (${chart.sliceName}) should have gone 202 onto the async path, then 200 on the re-request`,
        ).toEqual([202, 200]);
      }
      expect(
        signals.taskStatusPollCount,
        'the client should have polled /api/v1/task/status_changes while the concurrent tasks ran',
      ).toBeGreaterThan(0);
      expect(
        signals.cachedRereadCount,
        'every chart should have completed its own 202 -> 200 round trip',
      ).toBeGreaterThanOrEqual(charts.length);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // The round trips above are network-level proof. This is the render-level
    // proof: a forced refresh re-executes the query, so the clock chart must
    // show a later stamp than before -- something a DOM that never repainted
    // could not do.
    await expect
      .poll(readClock, {
        message:
          'the clock chart should repaint with the timestamp of the re-executed query',
        timeout: TIMEOUT.CHART_RENDER,
      })
      .toBeGreaterThan(clockBefore);

    // If these names didn't produce distinct counts, the per-chart assertion
    // below would pass no matter how badly results were shuffled.
    expect(
      new Set(expectedValues).size,
      'each chart filters on a different name, so their pre-refresh counts should not all collapse to the same number',
    ).toBeGreaterThan(1);

    // With the repaint established above, "same number as before" is a real
    // correctness check rather than a tautology: static data means each chart
    // must reproduce its own count, and only its own.
    const displayedValues = await Promise.all(
      nameValues.map(locator => locator.textContent()),
    );
    for (const [index, chart] of nameCharts.entries()) {
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

    // A filter's value query depends only on dataset/column, not on anything
    // per-run, so a physical table would be cache-cold once and a cache hit on
    // every later run -- and this test would stop exercising the pipeline.
    const { datasetId } = await createCacheColdVirtualDataset(
      page,
      testAssets,
      testWithAssets.info(),
      { namePrefix: 'gaq_tc8_filter_dropdown' },
    );

    const { dashboardId, dashboard, filterBar, chartId, value } =
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
          // The per-run dataset has no saved metrics, so the default spec's
          // saved `count` would not resolve and the chart would error out.
          chartSpec: BIG_NUMBER_ADHOC_COUNT_SPEC,
        },
      );

    // Track before navigating: the fetch under test fires during the filter
    // panel's own initialization, not in response to anything we do later.
    const signals = trackGaqSignals(page);

    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad({ timeout: TIMEOUT.SLOW_TEST });
    await dashboard.waitForChartsToLoad();

    // The chart is not what this test is about, but a broken one must not slip
    // through just because every assertion below looks at the filter: it has to
    // render a number, and on this cache-cold dataset its own data has to come
    // through the async cycle.
    await expect(value).toHaveText(/\d/, { timeout: TIMEOUT.CHART_RENDER });
    await expect(
      dashboard.getChart(chartId).locator('.ant-alert-error'),
    ).not.toBeAttached();
    await expect(() => {
      expect(
        signals.submitStatusesFor(chartId),
        'the chart itself should have completed its 202 -> 200 round trip',
      ).toEqual([202, 200]);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

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
        signals.sawTaskStatusPoll,
        'the client should have polled /api/v1/task/status_changes while the filter-value tasks ran',
      ).toBe(true);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // Separately: those already-fetched options actually render.
    const filterSelect = filterBar.getFilterSelect();
    await filterSelect.open();

    await expect(filterSelect.options.first()).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });
    await expect(async () => {
      expect(await filterSelect.options.count()).toBeGreaterThanOrEqual(5);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });
  },
);
