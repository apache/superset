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
 * Global Async Queries (GAQ) under stress: a query that fails, a superseded
 * query racing a newer one, a programmatic request that must stay synchronous,
 * and a page torn down mid-flight.
 *
 * GAQ's happy path is visually identical to a synchronous load, so these are
 * the cases where its machinery actually becomes observable -- or where it
 * must stay invisible. The happy paths live in global-async-query.spec.ts.
 *
 * Requires the `GLOBAL_ASYNC_QUERIES` feature flag, Redis, and a running
 * Celery worker.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiGetChart, apiPutChart } from '../../helpers/api/chart';
import { GAQ, TIMEOUT } from '../../utils/constants';
import { apiPost } from '../../helpers/api/requests';
import {
  BIG_NUMBER_COUNT_SPEC,
  nativeFilterValuesIn,
  setupDashboardWithBigNumberCharts,
  setupDashboardWithSelectFilter,
  sliceIdFromChartDataUrl,
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
  'broken chart surfaces a clean error under GAQ instead of hanging, and recovers once fixed',
  async ({ page, testAssets }) => {
    // Two forced refreshes plus an API round-trip between them exceed the
    // default timeout on a loaded runner.
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const BAD_COLUMN = 'this_column_does_not_exist_gaq_test';

    // A custom SQL metric on a nonexistent column fails in Postgres, not in
    // client-side validation -- so the job really is queued and run, and this
    // exercises the async error path rather than a request that never ships.
    const { dashboardId, dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc3_broken_chart',
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

    // Let the initial (also broken) load settle before tracking.
    await expect(errorAlert).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    const signals = trackGaqSignals(page);
    // The alert is already on screen from that initial load and the refresh
    // re-runs the identical broken query, so its text proves nothing about the
    // refresh. Require the failure to come back over the wire instead.
    const responseBodies: string[] = [];
    page.on('response', async response => {
      if (!response.url().includes(GAQ.CHART_DATA_PATH)) {
        return;
      }
      try {
        responseBodies.push(await response.text());
      } catch {
        // A superseded request's body is no longer retrievable; nothing to record.
      }
    });

    await dashboard.forceRefresh();

    await expect(() => {
      expect(
        signals.submitStatusFor(chart.id),
        'forced chart-data submission for the broken chart should still be accepted (202) onto the async path',
      ).toBe(202);
      expect(
        signals.sawTaskStatusPoll,
        'the client should have polled /api/v1/task/status_changes while the broken query ran',
      ).toBe(true);
      expect(
        responseBodies.filter(body => body.includes(BAD_COLUMN)),
        "the refresh's own chart-data response should carry the failure, rather than the alert being left over from the initial load",
      ).not.toHaveLength(0);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Data error');
    await expect(errorAlert).toContainText(BAD_COLUMN);

    // Fix the config and confirm the chart recovers, rather than staying stuck.
    const chartResp = await apiGetChart(page, chart.id);
    expect(chartResp.ok()).toBe(true);
    const { result } = await chartResp.json();
    const fixedParams = { ...JSON.parse(result.params), metric: 'count' };

    const updateResp = await apiPutChart(page, chart.id, {
      params: JSON.stringify(fixedParams),
    });
    expect(updateResp.ok()).toBe(true);

    // Refreshing re-submits the form_data already loaded client-side, so it
    // would not pick up an out-of-band config change. Re-navigating refetches
    // the chart's metadata.
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);
    await expect(errorAlert).not.toBeAttached();
  },
);

testWithAssets(
  'rapidly switching a filter value never lets the superseded selection clobber the screen',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    // Generous enough that girl's own select/apply cycle plus network latency
    // cannot consume the window while boy sits parked -- the delay starts when
    // boy is applied, i.e. before that cycle even begins.
    const RACE_DELAY_MS = 8000;
    const FILTER_COLUMN = 'gender';

    const { chartId, dashboardId, dashboard, filterBar, value } =
      await setupDashboardWithSelectFilter(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          namePrefix: 'gaq_tc4_filter_race',
          filterColumn: 'gender',
          filterName: 'Gender',
        },
      );

    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad({ timeout: TIMEOUT.SLOW_TEST });
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    // Learn "girl"'s real count first, so the race can assert on that number.
    // The chart still shows the unfiltered total while the query is in flight,
    // and that already contains a digit -- so a bare /\d/ would capture the
    // *pre-filter* value. Wait for the round trip at the network level instead.
    const baselineSignals = trackGaqSignals(page);
    await filterBar.selectOption('girl');
    await filterBar.apply();
    await expect(() => {
      const statuses = baselineSignals.submitStatusesFor(chartId);
      expect(
        statuses,
        '"girl"\'s chart-data request should have been answered',
      ).not.toHaveLength(0);
      expect(
        statuses.every(status => status === 200 || status === 202),
        `"girl"'s chart-data statuses should all be 200/202, got ${statuses.join(', ')}`,
      ).toBe(true);
      expect(
        statuses[statuses.length - 1],
        '"girl"\'s chart-data round trip should end with a 200',
      ).toBe(200);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/, { timeout: TIMEOUT.CHART_RENDER });
    const expectedGirlText = await value.textContent();

    // Example queries settle in ~1-2s, too fast to race for real. Delaying only
    // the next request makes "boy" reliably still in flight when "girl" fires.
    // Both stamped at interception -- when the delay actually starts, and when
    // girl's request actually leaves. Measuring either from the surrounding
    // test flow would fold in the UI cycle and the response wait.
    let boyParkedAt = 0;
    let girlRequestedAt = 0;
    let boyCancelled = false;
    const raceRoute = (url: URL) =>
      sliceIdFromChartDataUrl(url.toString()) === chartId;
    await page.route(raceRoute, async route => {
      // By payload rather than arrival order: both requests are for this slice.
      const filterValues = nativeFilterValuesIn(
        route.request().postData() ?? '',
        FILTER_COLUMN,
      );
      const isBoy = filterValues.includes('boy');
      if (isBoy && boyParkedAt === 0) {
        boyParkedAt = Date.now();
        await new Promise(resolve => {
          setTimeout(resolve, RACE_DELAY_MS);
        });
      } else if (filterValues.includes('girl') && girlRequestedAt === 0) {
        girlRequestedAt = Date.now();
      }
      // Continuing a request the app already aborted rejects; that rejection is
      // the expected outcome here, not a test failure.
      await route.continue().catch(() => {
        boyCancelled = boyCancelled || isBoy;
      });
    });
    page.on('requestfailed', request => {
      if (
        sliceIdFromChartDataUrl(request.url()) === chartId &&
        nativeFilterValuesIn(request.postData() ?? '', FILTER_COLUMN).includes(
          'boy',
        )
      ) {
        boyCancelled = true;
      }
    });

    // The chart keeps rendering its previous value while a query is in flight,
    // so asserting the expected text alone would pass against what is already
    // on screen. These signals give a network-level proof instead.
    const signals = trackGaqSignals(page);

    await filterBar.selectOption('boy');
    await filterBar.apply();
    // Deliberately no wait -- "boy" is still in flight as "girl" is applied.
    await filterBar.selectOption('girl');
    await filterBar.apply();

    // Identify a response by the filter that produced it: both requests are for
    // this same slice, so "first status seen for the slice" could be either.
    const statusesFor = (value: string) =>
      signals.submitStatusesWhere(chartId, body =>
        nativeFilterValuesIn(body, FILTER_COLUMN).includes(value),
      );

    // "girl" ran once already, so this repeat may be a 200 cache hit rather
    // than a fresh 202 -- but it has to be one of the two. Accepting any
    // recorded status would accept a 4xx/5xx, and the text assertion below
    // would then pass on the stale value still on screen.
    await expect(() => {
      const girlStatuses = statusesFor('girl');
      expect(
        girlStatuses,
        '"girl"\'s fast chart-data request should have been answered',
      ).not.toHaveLength(0);
      expect(
        [200, 202],
        '"girl"\'s fast chart-data submission should have succeeded (200 cache-hit or 202 async-accepted)',
      ).toContain(girlStatuses[0]);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // The race only exists if "girl" started while "boy" was still parked.
    // Compared stamp-to-stamp: measuring against `Date.now()` here would fold
    // in however long "girl"'s response took, so a healthy race with a slow
    // response would read as "boy was already released".
    expect(
      boyParkedAt,
      '"boy"\'s request should have been intercepted and parked',
    ).toBeGreaterThan(0);
    expect(
      girlRequestedAt,
      '"girl"\'s request should have been intercepted',
    ).toBeGreaterThan(0);
    expect(
      girlRequestedAt - boyParkedAt,
      '"girl" should have started while "boy" was still parked',
    ).toBeLessThan(RACE_DELAY_MS);

    await expect(value).toHaveText(expectedGirlText ?? '', {
      timeout: TIMEOUT.UI_TRANSITION,
    });
    const raceResultText = await value.textContent();

    // What actually protects the screen: the app cancels the superseded request
    // (`chartAction.ts` aborts the previous controller), so "boy"'s result never
    // arrives. Wait out the rest of its park -- the window a regressed
    // cancellation would let a stale result land in.
    await page.waitForTimeout(
      Math.max(RACE_DELAY_MS - (Date.now() - boyParkedAt), 0) + 2000,
    );
    expect(
      boyCancelled,
      '"boy" should have been cancelled client-side when "girl" superseded it',
    ).toBe(true);
    expect(
      statusesFor('boy'),
      '"boy" was superseded, so its result should never have reached the client',
    ).toHaveLength(0);
    await expect(value).toHaveText(raceResultText ?? '');

    await page.unroute(raceRoute);
  },
);

testWithAssets(
  'a programmatic chart-data request stays synchronous unless it opts into async_mode',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const { dashboard, charts, valueLocators } =
      await setupDashboardWithBigNumberCharts(
        page,
        testAssets,
        testWithAssets.info(),
        {
          datasetName: 'birth_names',
          chartNamePrefix: 'gaq_tc6_async_mode_optin',
          chartSpecs: [BIG_NUMBER_COUNT_SPEC],
        },
      );
    const [chart] = charts;
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    // Under GTF, enabling the feature flag only makes async *available*: each
    // request decides via an `async_mode` flag, which the endpoint defaults to
    // false. So an API client that does not opt in keeps the synchronous 200
    // flow even on a deployment where the browser is running everything async.
    // Replaying the app's own payload keeps this honest -- a hand-built body
    // could fail validation and 400 for reasons unrelated to async gating.
    const submissionPromise = page.waitForRequest(
      req =>
        req.method() === 'POST' &&
        req.url().includes('/api/v1/chart/data') &&
        sliceIdFromChartDataUrl(req.url()) === chart.id,
      { timeout: TIMEOUT.CHART_RENDER },
    );
    await dashboard.forceRefresh();
    const submission = await submissionPromise;
    const body = submission.postDataJSON();
    expect(
      body,
      'the app should have submitted a chart-data payload',
    ).toBeTruthy();
    expect(
      body.async_mode,
      'the browser is expected to opt into async on a GAQ-enabled deployment',
    ).toBe(true);

    // Same payload, async_mode dropped and the cache bypassed, so a 200 here
    // means the query really ran inline rather than being served from a warm
    // cache entry that would mask the difference. `apiPost` carries the browser
    // session and the CSRF token the mutation needs.
    const { async_mode: _optedIn, ...syncBody } = body;
    const response = await apiPost(
      page,
      submission.url(),
      { ...syncBody, force: true },
      // The status is the assertion here, so it must not throw on a non-2xx.
      { failOnStatusCode: false },
    );

    expect(
      response.status(),
      'without async_mode the request should be answered synchronously (200), never queued (202)',
    ).toBe(200);
  },
);

// Pre-existing noise in this dev stack (HMR socket, antd deprecations, a React
// key warning in MetadataBar) -- present on any page load, not caused by
// navigating away mid-load.
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
          chartSpecs: [BIG_NUMBER_COUNT_SPEC],
        },
      );
    const [value] = valueLocators;
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(value).toHaveText(/\d/);
    const valueBeforeLeaving = await value.textContent();

    // forceRefresh() only awaits the menu click, so wait for the request to
    // actually ship -- otherwise navigation wins the race and nothing was ever
    // in flight to tear down. Superset fully reloads between top-level
    // sections, so leaving for Welcome really does destroy the query's context.
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

    // The abandoned job keeps running server-side; coming back should be a
    // clean re-fetch, not a stuck spinner or stale data.
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    // The value it had before, not merely "a digit": returning must re-fetch
    // the same result rather than leave a stuck spinner or a different number.
    await expect(value).toHaveText(valueBeforeLeaving ?? '');

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
