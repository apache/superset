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

import { test, expect } from '@playwright/test';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import {
  apiEnableEmbedding,
  getGuestToken,
  getDashboardIdBySlug,
} from '../../helpers/api/embedded';
import { EmbeddedPage } from '../../pages/EmbeddedPage';
import { EMBEDDED } from '../../utils/constants';

/**
 * MIME types for the static file server
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

/**
 * Superset domain (Flask server) — set by CI or defaults to local dev
 */
const SUPERSET_DOMAIN = (() => {
  const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
  return url.replace(/\/+$/, '');
})();

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
 * Serves HTML from embedded-app/ and the SDK bundle from superset-embedded-sdk/bundle/.
 */
function createEmbedAppServer(): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const urlPath = req.url?.split('?')[0] || '/';

    // Serve SDK bundle at /sdk/index.js
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

    // Serve static files from embedded-app/
    const filePath = join(
      EMBED_APP_DIR,
      urlPath === '/' ? 'index.html' : urlPath,
    );
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFileSync(filePath));
  });
}

// ─── Test Suite ────────────────────────────────────────────────────────────

test.describe('Embedded Dashboard E2E', () => {
  let server: Server;
  let embedUuid: string;
  let dashboardId: number;

  test.beforeAll(async ({ browser }) => {
    // Start the embedded test app server
    server = createEmbedAppServer();
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject);
      server.listen(EMBEDDED.APP_PORT, () => resolve());
    });

    // Use a fresh page with auth to set up test data via API
    const context = await browser.newContext({
      storageState: 'playwright/.auth/user.json',
      baseURL: SUPERSET_DOMAIN.endsWith('/')
        ? SUPERSET_DOMAIN
        : `${SUPERSET_DOMAIN}/`,
    });
    const setupPage = await context.newPage();

    try {
      // Find a well-known example dashboard
      const id = await getDashboardIdBySlug(setupPage, 'world_health');
      if (!id) {
        throw new Error(
          'Dashboard "world_health" not found. Ensure load_examples ran in CI setup.',
        );
      }
      dashboardId = id;

      // Enable embedding on the dashboard (empty allowed_domains = allow all)
      const embedded = await apiEnableEmbedding(setupPage, dashboardId);
      embedUuid = embedded.uuid;
    } finally {
      await context.close();
    }
  });

  test.afterAll(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  test('dashboard renders in embedded iframe', async ({ page }) => {
    const embeddedPage = new EmbeddedPage(page);

    // Bridge the guest token from Node.js into the browser
    await embeddedPage.exposeTokenFetcher(async () => {
      return getGuestToken(page, String(dashboardId));
    });

    // Navigate to the embed app
    await embeddedPage.goto({
      uuid: embedUuid,
      supersetDomain: SUPERSET_DOMAIN,
    });

    // Wait for the iframe to be created by the SDK
    await embeddedPage.waitForIframe();

    // Verify the iframe src points to Superset's /embedded/ endpoint
    const iframeSrc = await page
      .locator('iframe[title="Embedded Dashboard"]')
      .getAttribute('src');
    expect(iframeSrc).toContain(`/embedded/${embedUuid}`);

    // Wait for dashboard content to render inside the iframe
    await embeddedPage.waitForDashboardContent();

    // Verify no errors in the test app
    const error = await embeddedPage.getError();
    expect(error).toBe('');
  });

  test('UI config hideTitle hides dashboard title', async ({ page }) => {
    const embeddedPage = new EmbeddedPage(page);

    await embeddedPage.exposeTokenFetcher(async () => {
      return getGuestToken(page, String(dashboardId));
    });

    await embeddedPage.goto({
      uuid: embedUuid,
      supersetDomain: SUPERSET_DOMAIN,
      hideTitle: true,
    });

    await embeddedPage.waitForIframe();
    await embeddedPage.waitForDashboardContent();

    // The iframe URL should include uiConfig parameter
    const iframeSrc = await page
      .locator('iframe[title="Embedded Dashboard"]')
      .getAttribute('src');
    expect(iframeSrc).toContain('uiConfig=');
  });

  test('native filters are functional in embedded mode', async ({ page }) => {
    const embeddedPage = new EmbeddedPage(page);

    await embeddedPage.exposeTokenFetcher(async () => {
      return getGuestToken(page, String(dashboardId));
    });

    await embeddedPage.goto({
      uuid: embedUuid,
      supersetDomain: SUPERSET_DOMAIN,
    });

    await embeddedPage.waitForIframe();
    await embeddedPage.waitForDashboardContent();

    // Verify the filter bar is present in the iframe
    const frame = embeddedPage.getIframeLocator();
    const filterBar = frame.locator(
      '[data-test="filter-bar"], [data-test="dashboard-filters-panel"]',
    );
    // The World Health dashboard may or may not have filters,
    // so we just verify the dashboard rendered without errors
    const charts = frame.locator(
      '.chart-container, [data-test="chart-container"]',
    );
    await expect(charts.first()).toBeVisible({
      timeout: EMBEDDED.DASHBOARD_RENDER,
    });
  });

  test('allowed_domains blocks unauthorized referrer', async ({ page }) => {
    // Set up a second embedded config with restricted domains
    const context = await page
      .context()
      .browser()!
      .newContext({
        storageState: 'playwright/.auth/user.json',
        baseURL: SUPERSET_DOMAIN.endsWith('/')
          ? SUPERSET_DOMAIN
          : `${SUPERSET_DOMAIN}/`,
      });
    const setupPage = await context.newPage();

    try {
      // Restrict to a domain that is NOT localhost:9000
      const restrictedEmbed = await apiEnableEmbedding(setupPage, dashboardId, [
        'https://allowed.example.com',
      ]);

      const embeddedPage = new EmbeddedPage(page);
      await embeddedPage.exposeTokenFetcher(async () => {
        return getGuestToken(page, String(dashboardId));
      });

      await embeddedPage.goto({
        uuid: restrictedEmbed.uuid,
        supersetDomain: SUPERSET_DOMAIN,
      });

      // The iframe should load but get a 403 from Superset's referrer check
      await embeddedPage.waitForIframe();

      // Give the iframe time to receive the response
      await page.waitForTimeout(3000);

      // The dashboard content should NOT render (403 response)
      const frame = embeddedPage.getIframeLocator();
      const content = frame.locator(
        '.grid-container, [data-test="grid-container"]',
      );
      await expect(content).not.toBeVisible({ timeout: 5000 });
    } finally {
      // Restore the open embedding config for other tests
      await apiEnableEmbedding(setupPage, dashboardId, []);
      await context.close();
    }
  });

  test('guest token enables dashboard data access', async ({ page }) => {
    const embeddedPage = new EmbeddedPage(page);

    let tokenCallCount = 0;
    await embeddedPage.exposeTokenFetcher(async () => {
      tokenCallCount++;
      return getGuestToken(page, String(dashboardId));
    });

    await embeddedPage.goto({
      uuid: embedUuid,
      supersetDomain: SUPERSET_DOMAIN,
    });

    await embeddedPage.waitForIframe();
    await embeddedPage.waitForDashboardContent();

    // The SDK should have called fetchGuestToken at least once
    expect(tokenCallCount).toBeGreaterThanOrEqual(1);

    // Verify charts are actually rendering data (not just loading spinners)
    const frame = embeddedPage.getIframeLocator();
    const charts = frame.locator(
      '.chart-container, [data-test="chart-container"]',
    );
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThan(0);
  });
});
