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

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { AddressInfo, Socket } from 'net';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  apiEnableEmbedding,
  getAccessToken,
  getGuestToken,
} from '../../helpers/api/embedded';
import { getDashboardBySlug } from '../../helpers/api/dashboard';
import { EmbeddedPage } from '../../pages/EmbeddedPage';

/**
 * Superset domain (Flask server) — set by CI or defaults to local dev
 */
const SUPERSET_DOMAIN = (() => {
  const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
  return url.replace(/\/+$/, '');
})();

const SUPERSET_BASE_URL = SUPERSET_DOMAIN.endsWith('/')
  ? SUPERSET_DOMAIN
  : `${SUPERSET_DOMAIN}/`;

/**
 * Path to the SDK bundle built from superset-embedded-sdk/
 */
const SDK_BUNDLE_PATH = join(
  __dirname,
  '../../../../superset-embedded-sdk/bundle/index.js',
);

/**
 * Path to the embedded test app static files
 */
const EMBED_APP_DIR = join(__dirname, '../../embedded-app');

/**
 * Create a minimal static file server for the embedded test app.
 * Serves only a fixed allowlist of routes — the test app references just
 * its index.html and the SDK bundle, so anything else is 404.
 */
const INDEX_HTML_PATH = join(EMBED_APP_DIR, 'index.html');

interface EmbedAppServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

/**
 * Start the static test app on an OS-assigned ephemeral port. Tracks open
 * sockets so close() doesn't hang on iframe keep-alive connections, and so
 * different workers/retries never collide on a fixed port.
 */
async function startEmbedAppServer(): Promise<EmbedAppServer> {
  const sockets = new Set<Socket>();
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const urlPath = req.url?.split('?')[0] || '/';

    if (urlPath === '/sdk/index.js') {
      if (!existsSync(SDK_BUNDLE_PATH)) {
        res.writeHead(404);
        res.end(
          'SDK bundle not found. Run: cd superset-embedded-sdk && npm ci && npm run build',
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(readFileSync(SDK_BUNDLE_PATH));
      return;
    }

    if (urlPath === '/' || urlPath === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(INDEX_HTML_PATH));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    server,
    url,
    close: () =>
      new Promise<void>(resolve => {
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        server.close(() => resolve());
      }),
  };
}

/**
 * Create a browser context authenticated as admin for API-only work
 * (enabling embedding, restoring config). Caller is responsible for closing.
 */
function createAdminContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    storageState: 'playwright/.auth/user.json',
    baseURL: SUPERSET_BASE_URL,
  });
}

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
    // Skip all tests if the SDK bundle hasn't been built
    test.skip(
      !existsSync(SDK_BUNDLE_PATH),
      'Embedded SDK bundle not found. Build it with: cd superset-embedded-sdk && npm ci && npm run build',
    );

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
      } catch {
        // Best-effort cleanup — never fail teardown.
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
      await apiEnableEmbedding(setupPage, dashboardId, []);
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
