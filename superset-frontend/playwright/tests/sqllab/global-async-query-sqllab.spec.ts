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
 * GAQ (Global Async Queries) TC9 -- SQL Lab keeps working with GAQ turned
 * on. See ../../GAQ_Architecture.md and ../../gaq-test-cases.md (TC9) for
 * the design this test implements.
 *
 * Precondition: `GLOBAL_ASYNC_QUERIES` feature flag enabled instance-wide.
 * Does NOT require Redis/Celery for this test itself -- SQL Lab's own async
 * execution (`ASynchronousSqlJsonExecutor`) is a separate, older Celery
 * mechanism unrelated to GAQ (see below).
 *
 * Scope, explicit (per gaq-test-cases.md): this is a basic regression/smoke
 * check, not a test of SQL Lab's own async execution mechanism.
 * `ASynchronousSqlJsonExecutor` is a separate, older Celery mechanism that
 * shares no code with GAQ (see GAQ_Architecture.md's "SQL Lab and GAQ"
 * section) -- the only thing worth confirming here is that having
 * GLOBAL_ASYNC_QUERIES enabled instance-wide doesn't leak into or break the
 * unrelated system next to it. Deliberately kept to a single, shallow test
 * -- do not grow this into a deeper SQL Lab suite here; see sqllab.spec.ts
 * for that coverage. Placed in tests/sqllab/ (not tests/dashboard/ like the
 * other GAQ specs) so it runs under the `chromium-sqllab` project, same as
 * sqllab.spec.ts -- SQL Lab's tab state is server-side per user, so it needs
 * sequential execution, not the parallel default project.
 *
 * CI green => a plain SELECT in SQL Lab returns 200 synchronously and
 *             renders results exactly as it would with the flag off -- no
 *             /api/v1/async_event/ polling triggered by SQL Lab itself.
 * CI red   => the query fails or hangs, or GAQ's polling endpoint gets hit
 *             at all (a sign GLOBAL_ASYNC_QUERIES started leaking into SQL
 *             Lab's execution path).
 */
import { test, expect } from '../../helpers/fixtures/testAssets';
import { SqlLabPage } from '../../pages/SqlLabPage';
import { expectStatus } from '../../helpers/api/assertions';
import { TIMEOUT } from '../../utils/constants';

let sqlLabPage: SqlLabPage;

test.beforeEach(async ({ page }) => {
  test.setTimeout(TIMEOUT.SLOW_TEST);
  sqlLabPage = new SqlLabPage(page);
  await sqlLabPage.gotoAndReady();
});

test('runs a simple SELECT normally with GLOBAL_ASYNC_QUERIES enabled, never touching the GAQ polling endpoint', async ({
  page,
}) => {
  let sawAsyncEventPoll = false;
  page.on('response', response => {
    if (
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/async_event/')
    ) {
      sawAsyncEventPoll = true;
    }
  });

  const response = await sqlLabPage.executeQuery('SELECT 1 AS test_col');
  expectStatus(response, 200);

  await sqlLabPage.waitForQueryResults('test_col');
  const headers = await sqlLabPage.resultsGrid.getHeaderTexts();
  expect(headers.some(h => h.includes('test_col'))).toBe(true);

  expect(
    sawAsyncEventPoll,
    'SQL Lab execution should never touch GAQ\'s async_event polling endpoint -- it has its own, separate async mechanism',
  ).toBe(false);
});
