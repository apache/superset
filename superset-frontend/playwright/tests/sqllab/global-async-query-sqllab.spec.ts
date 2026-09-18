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
 * Global Async Queries (GAQ): SQL Lab keeps working with the flag turned on.
 *
 * SQL Lab's own async execution (`ASynchronousSqlJsonExecutor`) is a separate,
 * older Celery mechanism that shares no code with GAQ. The only thing worth
 * confirming is that enabling GLOBAL_ASYNC_QUERIES instance-wide does not leak
 * into or break the unrelated system next to it -- so this is deliberately one
 * shallow smoke check, not a SQL Lab suite (see sqllab.spec.ts for that).
 *
 * Requires only the `GLOBAL_ASYNC_QUERIES` feature flag; no Redis/Celery,
 * since nothing here should reach GAQ's pipeline at all.
 *
 * Lives in tests/sqllab/ because it is a SQL Lab test, but it does NOT run
 * under the `chromium-sqllab` project -- that project's `testIgnore` excludes
 * it deliberately. It needs GLOBAL_ASYNC_QUERIES on, which only the workflow's
 * GAQ step provides, so it runs under `chromium-gaq` alongside the dashboard
 * GAQ specs (see the workflow's `playwright-run-gaq` invocation). Without that
 * exclusion it would sit in the ordinary SQL Lab run and skip itself on every
 * execution, reporting coverage it never had.
 */
import { test, expect } from '../../helpers/fixtures/testAssets';
import { SqlLabPage } from '../../pages/SqlLabPage';
import { expectStatus } from '../../helpers/api/assertions';
import { GAQ, TIMEOUT } from '../../utils/constants';
import { isFeatureEnabled } from '../../helpers/featureFlags';

let sqlLabPage: SqlLabPage;
let sawTaskStatusPoll = false;

test.beforeEach(async ({ page }) => {
  test.setTimeout(TIMEOUT.SLOW_TEST);
  sqlLabPage = new SqlLabPage(page);

  // Attached before the first navigation, not inside the test body: loading the
  // SQL Lab bundle is itself part of what must not reach GAQ's pipeline. A
  // listener registered after `gotoAndReady()` cannot see that traffic, so the
  // never-polls assertion below would hold no matter what the page load did.
  sawTaskStatusPoll = false;
  page.on('response', response => {
    if (
      response.request().method() === 'GET' &&
      response.url().includes(GAQ.TASK_STATUS_CHANGES_PATH)
    ) {
      sawTaskStatusPoll = true;
    }
  });

  await sqlLabPage.gotoAndReady();
  test.skip(
    !(await isFeatureEnabled(page, 'GLOBAL_ASYNC_QUERIES')),
    'GLOBAL_ASYNC_QUERIES is not enabled on this instance',
  );
});

test('runs a simple SELECT normally with GLOBAL_ASYNC_QUERIES enabled, never touching the GAQ task-status endpoint', async () => {
  const response = await sqlLabPage.executeQuery('SELECT 1 AS test_col');
  expectStatus(response, 200);

  await sqlLabPage.waitForQueryResults('test_col');
  const headers = await sqlLabPage.resultsGrid.getHeaderTexts();
  expect(headers.some(h => h.includes('test_col'))).toBe(true);

  expect(
    sawTaskStatusPoll,
    "SQL Lab execution should never touch GAQ's task-status polling endpoint -- it has its own, separate async mechanism",
  ).toBe(false);
});
