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

import { test, expect, Page } from '@playwright/test';
import {
  apiEnableEmbedding,
  getAccessToken,
  getGuestToken,
} from '../../helpers/api/embedded';
import { getDashboardBySlug } from '../../helpers/api/dashboard';
import { EmbeddedPage } from '../../pages/EmbeddedPage';
import {
  EmbedAppServer,
  SUPERSET_DOMAIN,
  createAdminContext,
  skipUnlessSdkBundleBuilt,
  startEmbedAppServer,
} from '../../helpers/embeddedAppServer';

// ─── Test Suite ────────────────────────────────────────────────────────────

// Describe wrapper is needed for shared server state and serial execution:
// all tests share a static file server and must not run in parallel.
test.describe('Embedded Dashboard E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // The full embedded chain (login → guest token → iframe → dashboard render
  // → chart render) routinely exceeds the 30s default on cold CI starts.
  test.setTimeout(60000);

  let appServer: EmbedAppServer;
  let accessToken: string;
  let embedUuid: string;
  let dashboardId: number;

  /**
   * Set up a page to render the default embedded dashboard.
   * Tests that need a different UUID or UI config should not use this helper.
   */
  async function setupEmbeddedPage(page: Page): Promise<EmbeddedPage> {
    const embeddedPage = new EmbeddedPage(page);
    await embeddedPage.exposeTokenFetcher(async () =>
      getGuestToken(page, dashboardId, { accessToken }),
    );
    await embeddedPage.goto({
      appUrl: appServer.url,
      uuid: embedUuid,
      supersetDomain: SUPERSET_DOMAIN,
    });
    await embeddedPage.waitForIframe();
    await embeddedPage.waitForDashboardContent();
    return embeddedPage;
  }

  test.beforeAll(async ({ browser }) => {
    skipUnlessSdkBundleBuilt();

    appServer = await startEmbedAppServer();

    // Use a fresh context with auth to set up test data via API
    const context = await createAdminContext(browser);
    const setupPage = await context.newPage();

    try {
      const dashboard = await getDashboardBySlug(setupPage, 'world_health');
      if (!dashboard) {
        throw new Error(
          'Dashboard "world_health" not found. Ensure load_examples ran in CI setup.',
        );
      }
      dashboardId = dashboard.id;

      // Enable embedding on the dashboard (empty allowed_domains = allow all)
      const embedded = await apiEnableEmbedding(setupPage, dashboardId);
      embedUuid = embedded.uuid;

      // Cache the JWT access token so tests don't re-login per guest token.
      accessToken = await getAccessToken(setupPage);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    // Defensive restore in case the allowed_domains test failed mid-flight.
    if (dashboardId !== undefined) {
      const context = await createAdminContext(browser);
      try {
        const setupPage = await context.newPage();
        await apiEnableEmbedding(setupPage, dashboardId, []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[embedded teardown] restore failed:', err);
      } finally {
        await context.close();
      }
    }

    if (appServer) await appServer.close();
  });

  test('dashboard renders in embedded iframe', async ({ page }) => {
    const embeddedPage = await setupEmbeddedPage(page);

    // Verify the iframe src points to Superset's /embedded/ endpoint
    await expect(
      page.locator('iframe[title="Embedded Dashboard"]'),
    ).toHaveAttribute('src', new RegExp(`/embedded/${embedUuid}`));

    // Verify no errors in the test app
    expect(await embeddedPage.getError()).toBe('');

    // Baseline: title should be visible when hideTitle is not set. This
    // doubles as a positive existence check the `hideTitle` test relies on
    // for distinguishing "title was hidden" from "selector is wrong".
    await expect(embeddedPage.titleLocator).toBeVisible();

    // Prove the dashboard actually renders, not just the chrome.
    await embeddedPage.waitForChartRendered();
  });

  test('UI config hideTitle hides dashboard title', async ({ page }) => {
    const embeddedPage = new EmbeddedPage(page);
    await embeddedPage.exposeTokenFetcher(async () =>
      getGuestToken(page, dashboardId, { accessToken }),
    );
    await embeddedPage.goto({
      appUrl: appServer.url,
      uuid: embedUuid,
      supersetDomain: SUPERSET_DOMAIN,
      hideTitle: true,
    });
    await embeddedPage.waitForIframe();
    await embeddedPage.waitForDashboardContent();

    // The iframe URL should include uiConfig parameter
    await expect(
      page.locator('iframe[title="Embedded Dashboard"]'),
    ).toHaveAttribute('src', /uiConfig=/);

    // hideTitle removes the header from the DOM (rather than CSS-hiding it),
    // so toBeHidden + toHaveCount(0) together assert: not visible AND
    // confirmed-removed (so the test can't pass for the wrong reason if the
    // selector ever drifts — the baseline test asserts the selector matches
    // when hideTitle is off).
    await expect(embeddedPage.titleLocator).toBeHidden();
    await expect(embeddedPage.titleLocator).toHaveCount(0);
  });

  test('charts render inside embedded iframe', async ({ page }) => {
    const embeddedPage = await setupEmbeddedPage(page);

    await embeddedPage.waitForChartRendered();
    const renderedCharts = embeddedPage.iframe.locator(
      EmbeddedPage.RENDERED_CHART_SELECTOR,
    );
    expect(await renderedCharts.count()).toBeGreaterThan(0);
  });

  test('allowed_domains blocks unauthorized referrer', async ({
    page,
    browser,
  }) => {
    const context = await createAdminContext(browser);
    const setupPage = await context.newPage();

    try {
      // Restrict to a domain that is NOT the test app's origin
      const restrictedEmbed = await apiEnableEmbedding(setupPage, dashboardId, [
        'https://allowed.example.com',
      ]);

      const embeddedPage = new EmbeddedPage(page);
      await embeddedPage.exposeTokenFetcher(async () =>
        getGuestToken(page, dashboardId, { accessToken }),
      );

      // The deterministic signal that the referrer check fired is the HTTP
      // status of the /embedded/<uuid> response — assert that directly rather
      // than racing against cross-origin iframe rendering.
      const embeddedResponsePromise = page.waitForResponse(
        resp =>
          resp.url().includes(`/embedded/${restrictedEmbed.uuid}`) &&
          resp.request().resourceType() === 'document',
      );

      await embeddedPage.goto({
        appUrl: appServer.url,
        uuid: restrictedEmbed.uuid,
        supersetDomain: SUPERSET_DOMAIN,
      });

      const response = await embeddedResponsePromise;
      expect(response.status()).toBe(403);
    } finally {
      // Restore the open embedding config for other tests in this file.
      try {
        await apiEnableEmbedding(setupPage, dashboardId, []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[embedded teardown] restore failed:', err);
      }
      await context.close();
    }
  });

  test('guest token enables dashboard data access', async ({ page }) => {
    const embeddedPage = new EmbeddedPage(page);

    let tokenCallCount = 0;
    await embeddedPage.exposeTokenFetcher(async () => {
      tokenCallCount += 1;
      return getGuestToken(page, dashboardId, { accessToken });
    });

    await embeddedPage.goto({
      appUrl: appServer.url,
      uuid: embedUuid,
      supersetDomain: SUPERSET_DOMAIN,
    });
    await embeddedPage.waitForIframe();
    await embeddedPage.waitForDashboardContent();
    await embeddedPage.waitForChartRendered();

    // The SDK fetches the token exactly once per embed (caching is the
    // SDK's responsibility, not ours) — assert the stronger invariant.
    expect(tokenCallCount).toBe(1);

    // Confirm at least one chart actually rendered with data, not just its shell
    const renderedCharts = embeddedPage.iframe.locator(
      EmbeddedPage.RENDERED_CHART_SELECTOR,
    );
    expect(await renderedCharts.count()).toBeGreaterThan(0);
  });
});
