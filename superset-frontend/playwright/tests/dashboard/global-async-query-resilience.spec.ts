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
 * query racing a newer one, a lost channel token, and a page torn down
 * mid-flight.
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
import { TIMEOUT } from '../../utils/constants';
import {
  BIG_NUMBER_COUNT_SPEC,
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

    await dashboard.forceRefresh();

    await expect(errorAlert).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    await expect(errorAlert).toContainText('Data error');
    await expect(errorAlert).toContainText(BAD_COLUMN);

    await expect(() => {
      expect(
        signals.submitStatusFor(chart.id),
        'forced chart-data submission for the broken chart should still be accepted (202) onto the async path',
      ).toBe(202);
      expect(
        signals.sawTaskStatusPoll,
        'the client should have polled /api/v1/task/status_changes while the broken query ran',
      ).toBe(true);
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

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

    const RACE_DELAY_MS = 3000;

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

    // Learn "girl"'s real count first, so the race can assert on that specific
    // number. The unfiltered total already contains a digit, so a bare /\d/
    // would pass even if the request never completed.
    await filterBar.selectOption('girl');
    await filterBar.apply();
    await expect(value).toHaveText(/\d/, { timeout: TIMEOUT.CHART_RENDER });
    const expectedGirlText = await value.textContent();

    // Example queries settle in ~1-2s, too fast to race for real. Delaying only
    // the next request makes "boy" reliably still in flight when "girl" fires.
    let matchCount = 0;
    const raceRoute = (url: URL) =>
      sliceIdFromChartDataUrl(url.toString()) === chartId;
    await page.route(raceRoute, async route => {
      matchCount += 1;
      if (matchCount === 1) {
        await new Promise(resolve => {
          setTimeout(resolve, RACE_DELAY_MS);
        });
      }
      await route.continue();
    });

    // The chart keeps rendering its previous value while a query is in flight
    // -- it does not blank or spinner over the number (confirmed by trace). So
    // asserting the expected text alone would pass instantly against what is
    // already on screen, proving nothing. Tracking from here gives a
    // network-level proof instead: "boy" is parked in the artificial delay and
    // has not reached the server, so any chart-data response seen inside the
    // race window belongs to "girl".
    const signals = trackGaqSignals(page);

    await filterBar.selectOption('boy');
    await filterBar.apply();
    // Deliberately no wait -- "boy" is still in flight as "girl" is applied.
    await filterBar.selectOption('girl');
    await filterBar.apply();

    // "girl" ran once already, so this repeat may be a synchronous cache hit
    // rather than a fresh 202. Either proves the round-trip happened, which is
    // all that is being established here -- but it has to be one of those two.
    // Merely asserting a status was recorded would accept a 4xx/5xx, and since
    // the chart keeps displaying the previous "girl" value while a query is in
    // flight, the text assertion below would then pass on stale pixels and the
    // test would be green without a successful round trip.
    await expect(() => {
      expect(
        [200, 202],
        '"girl"\'s fast chart-data submission should have succeeded (200 cache-hit or 202 async-accepted)',
      ).toContain(signals.submitStatusFor(chartId));
    }).toPass({ timeout: RACE_DELAY_MS - 500 });

    await expect(value).toHaveText(expectedGirlText ?? '', {
      timeout: TIMEOUT.UI_TRANSITION,
    });
    const raceResultText = await value.textContent();

    // Give the superseded "boy" response every chance to arrive and clobber it.
    await page.waitForTimeout(RACE_DELAY_MS + 2000);
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

    const { origin } = new URL(submission.url());
    const csrfResponse = await page.request.get(
      `${origin}/api/v1/security/csrf_token/`,
    );
    const headers: Record<string, string> = { Referer: origin };
    if (csrfResponse.ok()) {
      headers['X-CSRFToken'] = (await csrfResponse.json()).result;
    }

    // Same payload, async_mode dropped and the cache bypassed, so a 200 here
    // means the query really ran inline rather than being served from a warm
    // cache entry that would mask the difference.
    const { async_mode: _optedIn, ...syncBody } = body;
    const response = await page.request.post(submission.url(), {
      headers,
      data: { ...syncBody, force: true },
    });

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
