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
 * GAQ (Global Async Queries) dashboard coverage -- TC1 through TC8.
 * See ../../GAQ_Architecture.md and ../../gaq-test-cases.md for the design
 * each test below implements.
 *
 * TC9 (SQL Lab smoke test) lives separately in
 * tests/sqllab/global-async-query-sqllab.spec.ts, since it must run under
 * the `chromium-sqllab` project rather than this directory's default one.
 *
 * Precondition (all tests): `GLOBAL_ASYNC_QUERIES` feature flag enabled,
 * plus Redis and a running Celery worker -- EXCEPT TC2 (cache-hit reload),
 * which is served synchronously and never touches the async channel, so it
 * needs only the feature flag. See each test's own "Precondition" note below
 * for specifics, and ../../gaq-test-cases.md's "Environment prerequisites"
 * for how to stand up Redis/Celery locally.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import {
  apiGetChart,
  apiPostChart,
  apiPutChart,
} from '../../helpers/api/chart';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
} from '../../helpers/api/dashboard';
import {
  apiPostVirtualDataset,
  getDatasetByName,
} from '../../helpers/api/dataset';
import { getDatabaseByName } from '../../helpers/api/database';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { DashboardPage } from '../../pages/DashboardPage';
import { DashboardFilterBar } from '../../components/dashboard/DashboardFilterBar';
import { TIMEOUT } from '../../utils/constants';
import {
  setupDashboardWithBigNumberCharts,
  sliceIdFromChartDataUrl,
  trackChartAsyncSignals,
  trackMultiChartAsyncSignals,
} from './dashboard-test-helpers';

// ---------------------------------------------------------------------------
// TC1 -- Normal load, happy path (cold cache).
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled, plus Redis and a running
// Celery worker. Without a worker, the chart-data POST below still returns
// 202, but no job ever executes and this test times out waiting for the
// chart to render.
//
// A freshly created chart's query could still coincidentally share a cache
// key with an identical query cached by another test (e.g. another suite
// also querying birth_names/count/big_number_total), so this test forces a
// refresh rather than relying on a plain first load -- a forced request
// always takes the async path regardless of cache state, which is the
// deterministic way to guarantee we're exercising the real cycle and not
// silently hitting the cache-hit shortcut (see TC2).
//
// CI green => the forced chart-data request was accepted (202), at least one
//             /api/v1/async_event/ poll occurred, the real payload was
//             fetched from /api/v1/chart/data/<cache_key>, and the chart
//             rendered its queried value.
// CI red   => any of the above didn't happen (e.g. flag disabled, no worker
//             running, or the async pipeline broke).
// ---------------------------------------------------------------------------
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
          dashboardTitlePrefix: 'gaq_tc1_cold_cache',
          chartSpecs: [
            {
              viz_type: 'big_number_total',
              params: { metric: 'count' },
            },
          ],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    // Only start recording once the initial load has settled, so these
    // signals reflect the forced refresh below rather than the first load.
    const signals = trackChartAsyncSignals(page, chart.id);

    await dashboard.forceRefresh();
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);

    await expect(() => {
      expect(
        signals.submitStatus,
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

// ---------------------------------------------------------------------------
// TC2 -- Cache-hit fast reload.
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled. Unlike every other GAQ test
// case, this one does NOT depend on Redis/Celery: a cache hit is served
// synchronously from the chart-data endpoint itself
// (`force_cached`/`force=false`), so it never touches the async channel.
//
// The dashboard is loaded once first to warm the cache for this chart's
// exact query context, then reloaded via a plain page reload -- no filter
// change, no "Refresh dashboard" -- which is what should hit the cache-hit
// shortcut rather than re-entering the 202 -> poll -> done cycle exercised
// by TC1.
//
// CI green => on reload, the chart-data request for this chart resolved
//             with a synchronous 200 (never a 202), no
//             /api/v1/async_event/ poll occurred, and no separate
//             /api/v1/chart/data/<cache_key> fetch occurred -- the reload
//             got its data straight from the initial POST response.
// CI red   => any of the above didn't hold (e.g. the cache-hit shortcut
//             regressed into taking the async path).
// ---------------------------------------------------------------------------
testWithAssets(
  'reloading an already-cached dashboard serves the chart synchronously, without the async cycle',
  async ({ page, testAssets }) => {
    // First load warms the cache for this chart's exact query context --
    // not the request under test, so no listeners attached yet.
    const { dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc2_cache_hit',
          dashboardTitlePrefix: 'gaq_tc2_cache_hit',
          chartSpecs: [
            {
              viz_type: 'big_number_total',
              params: { metric: 'count' },
            },
          ],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    const signals = trackChartAsyncSignals(page, chart.id);

    // Plain reload -- same filters, no "Refresh dashboard" -- is what should
    // take the cache-hit shortcut rather than re-entering the async cycle.
    await page.reload();
    await dashboard.waitForLoad();
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);

    await expect(() => {
      expect(
        signals.submitStatus,
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

// ---------------------------------------------------------------------------
// TC3 -- Broken chart yields a clean error, not a hang.
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled, plus Redis and a running
// Celery worker. The broken chart still queues and runs a real job under GAQ -- the query
// just fails once Postgres executes it -- so this exercises the async error
// path (STATUS_ERROR over the async channel), not a client-side validation
// failure that would never reach the async pipeline at all.
//
// The chart's metric is a custom SQL expression referencing a column that
// doesn't exist, guaranteeing a real backend query error regardless of
// dataset contents.
//
// CI green => the forced chart-data request was accepted (202), at least one
//             /api/v1/async_event/ poll occurred, and the chart surfaced a
//             legible "Data error" alert (not an indefinite spinner) with
//             the real Postgres error naming the bad column. Then, after
//             fixing the chart's metric via the API and forcing another
//             refresh, the chart renders real data and the error clears.
// CI red   => any of the above didn't happen (e.g. flag disabled, no worker
//             running, the error never surfaced, or it hung instead).
// ---------------------------------------------------------------------------
testWithAssets(
  'broken chart surfaces a clean error under GAQ instead of hanging, and recovers once fixed',
  async ({ page, testAssets }) => {
    // Two forced refreshes plus an API round-trip in between exceed the
    // default 30s test timeout on a loaded runner.
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const BAD_COLUMN = 'this_column_does_not_exist_gaq_test';

    const { dashboardId, dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc3_broken_chart',
          dashboardTitlePrefix: 'gaq_tc3_broken_chart',
          chartSpecs: [
            {
              viz_type: 'big_number_total',
              params: {
                metric: {
                  expressionType: 'SQL',
                  sqlExpression: `SUM(${BAD_COLUMN})`,
                  label: 'broken_metric',
                  hasCustomLabel: true,
                },
              },
            },
          ],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    const errorAlert = dashboard.getChart(chart.id).locator('.ant-alert-error');

    // Let the initial (also broken) load settle before recording signals, so
    // they reflect the forced refresh below rather than the first load.
    await expect(errorAlert).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    const signals = trackChartAsyncSignals(page, chart.id);

    // Force-refresh guarantees this exercises the async path
    // deterministically, the same way TC1 does for the happy path.
    await dashboard.forceRefresh();

    await expect(errorAlert).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(errorAlert).toContainText('Data error');
    await expect(errorAlert).toContainText(BAD_COLUMN);

    await expect(() => {
      expect(
        signals.submitStatus,
        'forced chart-data submission for the broken chart should still be accepted (202) onto the async path',
      ).toBe(202);
      expect(
        signals.sawAsyncEventPoll,
        'the client should have polled /api/v1/async_event/ while the broken query ran',
      ).toBe(true);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // Fix the underlying config and confirm the chart recovers normally,
    // rather than staying stuck in an error state.
    const chartResp = await apiGetChart(page, chart.id);
    expect(chartResp.ok()).toBe(true);
    const { result } = await chartResp.json();
    const fixedParams = { ...JSON.parse(result.params), metric: 'count' };

    const updateResp = await apiPutChart(page, chart.id, {
      params: JSON.stringify(fixedParams),
    });
    expect(updateResp.ok()).toBe(true);

    // "Refresh dashboard" re-submits whatever form_data the dashboard already
    // has loaded client-side -- it doesn't pick up a chart config change made
    // out-of-band via the API. A fresh navigation re-fetches chart metadata
    // (including the fixed metric) from the backend.
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);
    await expect(errorAlert).not.toBeAttached();
  },
);

// ---------------------------------------------------------------------------
// TC4 -- Filter change mid-load shows no stale data.
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled, plus Redis and a running
// Celery worker.
//
// The prepopulated example queries here resolve in ~1-2s, too fast to
// reliably race in real time, so the first filter selection's response is
// artificially delayed via page.route() -- this guarantees it's still
// in-flight when the second selection fires, which is what actually
// exercises the client's stale-query guard (chartAction.ts dispatches
// CHART_UPDATE_STOPPED to abort a superseded query's controller when a new
// one starts for the same chart) rather than two selections that happen to
// resolve one after another with no overlap.
//
// The filter is single-select (multiSelect: false) specifically so each
// click replaces the prior selection instead of accumulating -- the failure
// mode from an earlier manual pass against a multi-select filter, per
// gaq-test-cases.md's automation notes for this test case.
//
// CI green => after rapidly selecting "boy" (delayed) then "girl"
//             (undelayed) with no wait in between, the chart settles on
//             girl's count and never flips to boy's count even after
//             waiting well past the artificial delay -- proving the
//             superseded "boy" job's late result never clobbers the screen.
// CI red   => the chart shows boy's count at any point after girl's
//             selection was applied (stale data winning the race), or the
//             two counts are indistinguishable (test can't actually tell).
// ---------------------------------------------------------------------------
testWithAssets(
  'rapidly switching a filter value never lets the superseded selection clobber the screen',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const DATASET_NAME = 'birth_names';
    const FILTER_COLUMN = 'gender';
    const RACE_DELAY_MS = 3000;

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

    const chartParams = {
      datasource: `${datasetId}__table`,
      viz_type: 'big_number_total',
      metric: 'count',
      adhoc_filters: [],
    };
    const chartResp = await apiPostChart(page, {
      slice_name: `gaq_tc4_filter_race_${Date.now()}`,
      viz_type: 'big_number_total',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(chartParams),
    });
    expect(chartResp.ok()).toBe(true);
    const chart = await chartResp.json();
    const chartId: number = chart.id ?? chart.result?.id;
    testAssets.trackChart(chartId);

    const filterId = `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`;
    const positionJson = buildSingleRowDashboardLayout([
      { id: chartId, sliceName: 'gaq_tc4_filter_race', width: 6, height: 50 },
    ]);
    const jsonMetadata = {
      native_filter_configuration: [
        {
          id: filterId,
          name: 'Gender',
          filterType: 'filter_select',
          type: 'NATIVE_FILTER',
          targets: [{ datasetId, column: { name: FILTER_COLUMN } }],
          controlValues: {
            // Single-select: each click replaces the current value instead
            // of accumulating, so no explicit "clear" step is needed between
            // the two rapid selections below.
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
      dashboard_title: `gaq_tc4_filter_race_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
      json_metadata: JSON.stringify(jsonMetadata),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    const linkResp = await apiPutChart(page, chartId, {
      dashboards: [dashboardId],
    });
    expect(linkResp.ok()).toBe(true);

    const dashboard = new DashboardPage(page);
    const filterBar = new DashboardFilterBar(page);
    const value = dashboard
      .getChart(chartId)
      .locator('.superset-legacy-chart-big-number .header-line');

    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad({ timeout: TIMEOUT.SLOW_TEST });
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    // Learn "girl"'s real count up front, sequentially and with no delay, so
    // the race assertions below can check for this specific value instead of
    // a bare "some digit is on screen" -- the pre-filter total already
    // contains a digit, so a bare regex would pass even if "girl"'s request
    // never completed.
    await filterBar.selectOption('girl');
    await filterBar.apply();
    await expect(value).toHaveText(/\d/, { timeout: TIMEOUT.CHART_RENDER });
    const expectedGirlText = await value.textContent();

    // Delay only the first chart-data submission this route sees (the
    // upcoming "boy" selection) so it's still in-flight when "girl" fires
    // right after it -- a real race instead of two sequential updates.
    let matchCount = 0;
    await page.route(
      url => sliceIdFromChartDataUrl(url.toString()) === chartId,
      async route => {
        matchCount += 1;
        if (matchCount === 1) {
          await new Promise(resolve => {
            setTimeout(resolve, RACE_DELAY_MS);
          });
        }
        await route.continue();
      },
    );

    // Confirmed by trace: the chart shows "girl"'s stale value the entire
    // time "boy"'s (delayed) request is in flight -- it does not blank or
    // spinner-out during load. So a bare `toHaveText(expectedGirlText)` right
    // after this point would pass instantly, before "girl"'s own second,
    // fast request ever completes, and would prove nothing. A fresh signal
    // tracker attached here (after the delayed route is installed, so it
    // can't pick up stale traffic from learning "girl"'s count above) gives
    // an unambiguous, network-level proof instead: within the race window,
    // "boy"'s request hasn't even reached the server yet (it's parked in the
    // artificial delay before `route.continue()`), so any chart-data response
    // this tracker observes before the delay elapses can only belong to
    // "girl"'s fast request.
    const signals = trackChartAsyncSignals(page, chartId);

    await filterBar.selectOption('boy');
    await filterBar.apply();
    // No wait here on purpose -- "boy"'s request is still delayed in-flight
    // when "girl" is selected and applied immediately below.
    await filterBar.selectOption('girl');
    await filterBar.apply();

    // "girl" was already queried once above to learn her count, so this
    // second, identical request may be served as a cache hit (200,
    // synchronous) rather than re-entering the 202 -> poll -> done cycle --
    // either is an acceptable proof of completion here; the point isn't which
    // path "girl" takes, only that a real, fresh server round-trip for her
    // specific request actually happened (as opposed to nothing happening at
    // all, which the display alone couldn't rule out).
    await expect(() => {
      expect(
        signals.submitStatus,
        '"girl"\'s fast chart-data submission should have gotten a real response (200 cache-hit or 202 async-accepted)',
      ).toBeDefined();
    }).toPass({ timeout: RACE_DELAY_MS - 500 });

    // Now that the network layer has proven "girl"'s request genuinely
    // completed, confirm the UI actually reflects it too.
    await expect(value).toHaveText(expectedGirlText ?? '', {
      timeout: TIMEOUT.UI_TRANSITION,
    });
    const raceResultText = await value.textContent();

    // Give "boy"'s delayed response every chance to arrive and, if the
    // stale-query guard didn't work, clobber the screen.
    await page.waitForTimeout(RACE_DELAY_MS + 2000);
    await expect(value).toHaveText(raceResultText ?? '');

    await page.unroute(
      url => sliceIdFromChartDataUrl(url.toString()) === chartId,
    );
  },
);

// ---------------------------------------------------------------------------
// TC5 -- Busy multi-chart dashboard holds up.
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled, plus Redis and a running
// Celery worker.
//
// Each chart filters on a different, distinct name so a misrouted/dropped
// event (one chart showing another chart's data, or a job never resolving)
// is actually detectable -- charts with identical query contexts would make
// cross-contamination invisible to this test.
//
// CI green => "Refresh dashboard" produces one 202 per chart (all of them
//             concurrently in flight on the same channel), each chart polls
//             /api/v1/async_event/ and fetches its own final payload, every
//             chart ends up showing a real number, and the numbers aren't
//             all identical (ruling out a mixup where every widget renders
//             the same, possibly wrong, chart's result).
// CI red   => any chart is stuck pending, any chart never got a 202, or the
//             displayed values collapse to a single repeated number.
// ---------------------------------------------------------------------------
testWithAssets(
  'refreshing a dashboard with many charts resolves every chart independently and correctly',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    // Common enough in the birth_names example data to reliably produce a
    // non-zero, and mutually distinct, count per name.
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
          dashboardTitlePrefix: 'gaq_tc5_busy_dashboard',
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

    // Let the initial (cache-cold) load settle before recording signals, so
    // they reflect the forced refresh below, same as the other GAQ tests.
    await Promise.all(
      valueLocators.map(locator =>
        expect(locator).toBeVisible({ timeout: TIMEOUT.CHART_RENDER }),
      ),
    );

    // Each chart's own name filter is baked into its query, so its initial
    // count is a stable ground truth to check the post-refresh value
    // against -- a swap between two charts wouldn't be visible in "are the
    // values not all identical", only in "does chart N still show chart N's
    // own count".
    const expectedValues = await Promise.all(
      valueLocators.map(locator => locator.textContent()),
    );

    const chartIds = new Set(charts.map(chart => chart.id));
    const signals = trackMultiChartAsyncSignals(page, chartIds);

    await dashboard.forceRefresh();

    await Promise.all(
      valueLocators.map(locator =>
        expect(locator).toHaveText(/\d/, { timeout: TIMEOUT.CHART_RENDER }),
      ),
    );

    await expect(() => {
      for (const chart of charts) {
        expect(
          signals.submitStatusBySliceId.get(chart.id),
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

    // Sanity-check the ground truth itself: if these 8 names didn't actually
    // produce distinct counts, a swap between charts would be undetectable
    // below no matter how the assertion is written.
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

// ---------------------------------------------------------------------------
// TC6 -- Session hiccup recovery.
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled, plus Redis and a running
// Celery worker.
//
// This asserts the *actual*, confirmed-by-live-testing behavior, which is
// not what the naive expectation would be. The `async-token` cookie is a
// private channel identifier for GAQ's polling mechanism -- it is NOT the
// user's real login session. Losing it should, in principle, be an internal
// hiccup the async pipeline recovers from transparently. It isn't:
// `ChartDataRestApi._run_async` (superset/charts/data/api.py) validates that
// token *before accepting the job at all*, so a missing token fails the
// chart-data submission itself with 401, and the frontend's generic 401
// handler (`SupersetClientClass.handleUnauthorized`) reacts to that by
// hard-redirecting the whole page to `/login?next=...` -- even though the
// user's real login session was never touched and stays valid the entire
// time. This is a UX defect candidate (bouncing a still-logged-in user to
// login over an internal channel-token hiccup), not a security boundary --
// flagged for triage, not fixed here.
//
// CI green => after the async-token cookie is cleared, forcing a chart
//             refresh gets a 401 on the chart-data submission and the page
//             navigates away from the dashboard. The client redirects to
//             `/login?next=...`, but since the real session is still valid,
//             Superset's login view immediately bounces an
//             already-authenticated visitor onward -- a server-side
//             redirect chain the browser collapses into a single navigation,
//             so `page.url()` is observed landing on `/welcome/`, never on
//             `/login` itself. Then, navigating straight back to the
//             dashboard succeeds with no re-authentication prompt, proving
//             the real session was never actually invalidated -- the user
//             just got silently bounced off their dashboard for an internal
//             channel-token hiccup.
// CI red   => the submission doesn't 401 (the gap silently disappeared --
//             worth re-checking this test's assumptions), the page doesn't
//             navigate away from the dashboard at all, or re-navigating to
//             the dashboard afterward actually requires logging in again
//             (the real session *was* lost, a much more serious regression
//             than the documented gap).
// ---------------------------------------------------------------------------
testWithAssets(
  'losing the async-token cookie bounces chart refresh to /login even though the real session stays valid',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const { dashboardId, dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc6_session_hiccup',
          dashboardTitlePrefix: 'gaq_tc6_session_hiccup',
          chartSpecs: [
            {
              viz_type: 'big_number_total',
              params: { metric: 'count' },
            },
          ],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    // The load above should have minted the async-channel cookie.
    const cookiesBeforeClear = await page.context().cookies();
    expect(
      cookiesBeforeClear.some(cookie => cookie.name === 'async-token'),
      'a completed GAQ request should have set the async-token cookie',
    ).toBe(true);

    await page.context().clearCookies({ name: 'async-token' });

    const chartDataResponsePromise = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/v1/chart/data') &&
        sliceIdFromChartDataUrl(response.url()) === chart.id,
      { timeout: TIMEOUT.CHART_RENDER },
    );

    await dashboard.forceRefresh();

    const chartDataResponse = await chartDataResponsePromise;
    expect(
      chartDataResponse.status(),
      'chart-data submission should be rejected (401) once the async-channel token is gone',
    ).toBe(401);

    // The 401 handler navigates to /login?next=..., but since the real
    // session is still valid, Superset's login view immediately redirects
    // an already-authenticated visitor onward -- the browser collapses that
    // server-side hop into one navigation, so the URL we observe here is the
    // post-login-redirect destination (e.g. /welcome/), not /login itself.
    await page.waitForURL(
      url => !url.toString().includes(`dashboard/${dashboardId}`),
      { timeout: TIMEOUT.PAGE_LOAD },
    );
    expect(
      page.url(),
      'the user should have been bounced off the dashboard, not left on a login form',
    ).not.toContain('/login');

    // Prove the real login session was never actually invalidated: going
    // straight back to the dashboard should work with no re-auth prompt.
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    expect(page.url()).not.toContain('/login');
  },
);

// ---------------------------------------------------------------------------
// TC7 -- Navigate away and back causes no glitches.
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled, plus Redis and a running
// Celery worker.
//
// A force-refresh is triggered and the browser navigates away to an
// unrelated page (Superset always fully reloads between top-level sections
// like the dashboard view and Welcome -- each bootstraps its own React app
// -- so this genuinely tears down the in-flight query's JS context, the
// scenario this test case cares about) before that job's result would ever
// arrive. Per GAQ_Architecture.md, job submission is fire-and-forget from
// the request's perspective -- the Celery job keeps running server-side
// and populates the cache regardless of what the browser does next.
//
// CI green => navigating away mid-load and back produces no browser console
//             errors or uncaught page errors across the whole sequence, and
//             the dashboard cleanly re-fetches and renders real data on
//             return -- no stuck spinner, no stale/blank chart.
// CI red   => a console error or uncaught exception fires (e.g. an orphaned
//             polling callback touching torn-down state), or the chart fails
//             to render on return.
// ---------------------------------------------------------------------------

// Pre-existing dev-environment noise unrelated to GAQ or navigation (HMR
// websocket, antd deprecation warnings, a React key-prop warning in
// MetadataBar) -- present on any page load in this dev stack, not caused by
// navigating away mid-load. Filtered out so the assertion below targets
// errors this test case actually cares about.
const BENIGN_CONSOLE_NOISE = [
  /WebSocket connection to 'ws:\/\/.*\/ws' failed/,
  /\[webpack-dev-server\]/,
  /Warning: \[antd:/,
  /Warning: Each child in a list should have a unique "key" prop/,
];

testWithAssets(
  'navigating away mid-load and back causes no console errors and re-renders cleanly',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    const { dashboardId, dashboard, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc7_navigate_away',
          dashboardTitlePrefix: 'gaq_tc7_navigate_away',
          chartSpecs: [
            {
              viz_type: 'big_number_total',
              params: { metric: 'count' },
            },
          ],
        },
      );
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    // Force a fresh async job, then leave before it can possibly resolve
    // (prepopulated example queries settle in ~1-2s) -- a real top-level
    // navigation, not an in-app route change, so any in-flight query's JS
    // context is genuinely torn down mid-flight.
    //
    // forceRefresh() only awaits the menu click, not the resulting request,
    // so wait for the chart-data submission to actually go out before
    // navigating away -- otherwise navigation could win the race and this
    // test would leave before a request was ever in flight.
    const refreshRequestPromise = page.waitForRequest(
      request =>
        request.method() === 'POST' &&
        request.url().includes('/api/v1/chart/data'),
    );
    await dashboard.forceRefresh();
    await refreshRequestPromise;
    await page.goto('/superset/welcome/');
    await expect(page.getByRole('button', { name: /Recents/i })).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });

    // Navigate back and confirm a clean re-fetch/re-render, not a stuck
    // spinner or stale data left over from the abandoned job.
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);

    const unexpectedConsoleErrors = consoleErrors.filter(
      text => !BENIGN_CONSOLE_NOISE.some(pattern => pattern.test(text)),
    );
    expect(
      unexpectedConsoleErrors,
      'navigating away mid-load and back should not log any new browser console errors',
    ).toEqual([]);
    expect(
      pageErrors,
      'navigating away mid-load and back should not throw any uncaught page errors',
    ).toEqual([]);
  },
);

// ---------------------------------------------------------------------------
// TC8 -- Native filter value dropdown populates under GAQ.
//
// Precondition: GLOBAL_ASYNC_QUERIES enabled, plus Redis and a running
// Celery worker.
//
// Per GAQ_Architecture.md, `FilterValue.tsx` / `FiltersConfigForm.tsx` call
// `waitForAsyncData` directly -- the same pipeline chart data uses, but a
// different call site that's easy to overlook if testing focuses only on
// charts. The filter targets `birth_names.name`, a column with thousands of
// distinct values, specifically so populating it requires a real query
// rather than an inline handful of values the frontend could render without
// ever hitting the async pipeline.
//
// A filter-value request hits the same `/api/v1/chart/data` endpoint as
// chart data, distinguished only by *not* carrying a `slice_id` in its
// `form_data` (chart requests always do) -- reusing `sliceIdFromChartDataUrl`
// here the same way the other GAQ tests use it to find chart requests, just
// inverted.
//
// Unlike chart queries (each tied to a fresh, disposable chart), a filter's
// value-fetch query context depends only on the dataset/column, not on
// anything per-test-run -- reusing the physical `birth_names` table directly
// would make this test cache-cold (202) only on a genuinely fresh
// environment, then a cache-hit (200) on every subsequent run once that
// query is warm in Redis. A disposable virtual dataset with a per-run SQL
// comment keeps the query text (and therefore its cache key) unique every
// run, so this always exercises the async path it's meant to test.
//
// CI green => opening the filter's value dropdown produces a chart-data POST
//             with no slice_id, accepted as 202, the client polls
//             /api/v1/async_event/, and the dropdown ends up populated with
//             multiple real options -- no separate/degraded path for this
//             consumer of the async pipeline.
// CI red   => the dropdown never populates, the request isn't 202'd, or no
//             polling occurs (the value-fetch silently bypassed GAQ).
// ---------------------------------------------------------------------------
testWithAssets(
  "opening a native filter's value dropdown populates via the same async pipeline as chart data",
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    // Thousands of distinct values in this example dataset -- forces a real
    // server-side fetch instead of a handful of values the UI could render
    // without ever touching the async pipeline.
    const FILTER_COLUMN = 'name';

    const examplesDb = await getDatabaseByName(page, 'examples');
    if (!examplesDb) {
      throw new Error('examples database not found');
    }
    const uniqueSuffix = `${Date.now()}_${testWithAssets.info().parallelIndex}`;
    const datasetResp = await apiPostVirtualDataset(page, {
      database: examplesDb.id,
      schema: '',
      table_name: `gaq_tc8_filter_dropdown_${uniqueSuffix}`,
      // The comment makes this query text -- and therefore its GAQ cache
      // key -- unique per run, so the filter-value fetch is always
      // cache-cold instead of hitting a prior run's cached result.
      sql: `SELECT name FROM birth_names /* run:${uniqueSuffix} */`,
      editors: [],
    });
    expect(datasetResp.ok()).toBe(true);
    const datasetId = await extractIdFromResponse(datasetResp);
    testAssets.trackDataset(datasetId);

    // A chart in scope so the filter actually renders in the filter bar.
    const chartParams = {
      datasource: `${datasetId}__table`,
      viz_type: 'big_number_total',
      metric: 'count',
      adhoc_filters: [],
    };
    const chartResp = await apiPostChart(page, {
      slice_name: `gaq_tc8_filter_dropdown_${Date.now()}`,
      viz_type: 'big_number_total',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(chartParams),
    });
    expect(chartResp.ok()).toBe(true);
    const chart = await chartResp.json();
    const chartId: number = chart.id ?? chart.result?.id;
    testAssets.trackChart(chartId);

    const filterId = `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`;
    const positionJson = buildSingleRowDashboardLayout([
      {
        id: chartId,
        sliceName: 'gaq_tc8_filter_dropdown',
        width: 6,
        height: 50,
      },
    ]);
    const jsonMetadata = {
      native_filter_configuration: [
        {
          id: filterId,
          name: 'Name',
          filterType: 'filter_select',
          type: 'NATIVE_FILTER',
          targets: [{ datasetId, column: { name: FILTER_COLUMN } }],
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
      dashboard_title: `gaq_tc8_filter_dropdown_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
      json_metadata: JSON.stringify(jsonMetadata),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    const linkResp = await apiPutChart(page, chartId, {
      dashboards: [dashboardId],
    });
    expect(linkResp.ok()).toBe(true);

    const signals = trackChartAsyncSignals(page, undefined);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad({ timeout: TIMEOUT.SLOW_TEST });
    await dashboard.waitForChartsToLoad();

    // Unlike chart data, a native filter's value options are fetched once as
    // part of the filter panel's own initialization (confirmed via trace:
    // the POST/poll/fetch cycle completes before the dropdown is ever
    // clicked) and are then served from client state on open -- there is no
    // separate, click-triggered request to wait for here. So this asserts the
    // GAQ signals *before* touching the dropdown at all, proving the async
    // pipeline ran during panel initialization on its own merits, rather than
    // asserting it after the click in a way that could look like the click
    // caused it.
    await expect(() => {
      expect(
        signals.submitStatus,
        'the filter-value fetch should be accepted (202) onto the async path, same as a chart-data request',
      ).toBe(202);
      expect(
        signals.sawAsyncEventPoll,
        'the client should have polled /api/v1/async_event/ while the filter-value job ran',
      ).toBe(true);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // Separately, confirm opening the dropdown actually renders those
    // already-fetched options -- this is a UI-rendering check, not a second
    // GAQ trigger.
    const filterBar = new DashboardFilterBar(page);
    await filterBar.getFilterValueSelect().open();

    const options = page.locator('.ant-select-item-option');
    await expect(options.first()).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });
    await expect(async () => {
      expect(await options.count()).toBeGreaterThanOrEqual(5);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });
  },
);
