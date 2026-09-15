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
import {
  test,
  expect,
  Browser,
  BrowserContext,
  Frame,
  Page,
} from '@playwright/test';
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
 * A host application cannot know how tall an embedded dashboard's content is,
 * so it asks, then sizes the iframe from the answer. That only terminates if
 * the answer is independent of the iframe height. These tests pin that
 * property, and the two user-visible consequences of losing it: a resize loop
 * that never settles, and a filter bar whose action buttons follow the frame
 * instead of staying with the filter list.
 */

const SUPERSET_DOMAIN = (() => {
  const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
  return url.replace(/\/+$/, '');
})();

const SUPERSET_BASE_URL = SUPERSET_DOMAIN.endsWith('/')
  ? SUPERSET_DOMAIN
  : `${SUPERSET_DOMAIN}/`;

/**
 * Any dashboard exercises the sizing contract; the examples one is the default
 * so CI needs no extra fixture. Override to point at a dashboard with a long
 * vertical filter bar, which is where the original reports came from.
 */
const DASHBOARD_SLUG =
  process.env.EMBEDDED_SIZING_DASHBOARD_SLUG || 'world_health';

const SDK_BUNDLE_PATH = join(
  __dirname,
  '../../../../superset-embedded-sdk/bundle/index.js',
);
const EMBED_APP_DIR = join(__dirname, '../../embedded-app');
const INDEX_HTML_PATH = join(EMBED_APP_DIR, 'index.html');

/** Host viewport used throughout, so "taller than the window" is unambiguous. */
const WINDOW_HEIGHT = 800;

/**
 * Real hosts add headroom to the height they apply, which turns any residual
 * dependence on the frame into unbounded growth rather than a fixed offset.
 * The loop test applies the same headroom for that reason.
 */
const HOST_HEADROOM = 40;

interface EmbedAppServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

async function startEmbedAppServer(): Promise<EmbedAppServer> {
  const sockets = new Set<Socket>();
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const urlPath = req.url?.split('?')[0] || '/';

    if (urlPath === '/sdk/index.js') {
      if (!existsSync(SDK_BUNDLE_PATH)) {
        res.writeHead(404);
        res.end('SDK bundle not found.');
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
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>(resolve => {
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        server.close(() => resolve());
      }),
  };
}

function createAdminContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    storageState: 'playwright/.auth/user.json',
    baseURL: SUPERSET_BASE_URL,
  });
}

/** Set the iframe to an exact pixel height and let layout settle. */
async function setIframeHeight(page: Page, height: number): Promise<void> {
  await page.evaluate(px => {
    const iframe = document.querySelector(
      '#superset-container iframe',
    ) as HTMLIFrameElement | null;
    if (!iframe) throw new Error('embedded iframe not found');
    iframe.style.height = `${px}px`;
  }, height);
  await page.waitForTimeout(1500);
}

/**
 * The guest document itself. The dashboard is served from a different origin,
 * so page-level evaluate cannot reach it; Playwright's Frame can.
 */
function guestFrame(page: Page): Frame {
  const frame = page.frames().find(f => f.url().includes('/embedded/'));
  if (!frame) throw new Error('embedded guest frame not found');
  return frame;
}

/** What the SDK reports to the host as the content height. */
function reportedHeight(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const size = await (window as any).__embeddedDashboard.getScrollSize();
    return size.height as number;
  });
}

test.describe('Embedded dashboard iframe sizing', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120000);

  let appServer: EmbedAppServer;
  let accessToken: string;
  let embedUuid: string;
  let dashboardId: number;

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
    test.skip(
      !existsSync(SDK_BUNDLE_PATH),
      'Embedded SDK bundle not found. Build it with: cd superset-embedded-sdk && npm ci && npm run build',
    );

    appServer = await startEmbedAppServer();

    const context = await createAdminContext(browser);
    const setupPage = await context.newPage();
    try {
      const dashboard = await getDashboardBySlug(setupPage, DASHBOARD_SLUG);
      if (!dashboard) {
        throw new Error(
          `Dashboard "${DASHBOARD_SLUG}" not found. Ensure load_examples ran in CI setup.`,
        );
      }
      dashboardId = dashboard.id;
      const embedded = await apiEnableEmbedding(setupPage, dashboardId);
      embedUuid = embedded.uuid;
      accessToken = await getAccessToken(setupPage);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    if (dashboardId !== undefined) {
      const context = await createAdminContext(browser);
      try {
        const setupPage = await context.newPage();
        await apiEnableEmbedding(setupPage, dashboardId, []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[embedded sizing teardown] restore failed:', err);
      } finally {
        await context.close();
      }
    }
    if (appServer) await appServer.close();
  });

  test('reported content height does not depend on the iframe height', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: WINDOW_HEIGHT });
    await setupEmbeddedPage(page);

    await setIframeHeight(page, 800);
    const atShortFrame = await reportedHeight(page);

    await setIframeHeight(page, 2400);
    const atTallFrame = await reportedHeight(page);

    // Back to the first height: the answer must be reproducible, not a
    // function of the sequence of heights it has been given.
    await setIframeHeight(page, 800);
    const backAtShortFrame = await reportedHeight(page);

    expect(atShortFrame).toBeGreaterThan(0);
    expect(atTallFrame).toBe(atShortFrame);
    expect(backAtShortFrame).toBe(atShortFrame);
  });

  test('the documented resize loop settles instead of growing', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: WINDOW_HEIGHT });
    await setupEmbeddedPage(page);

    // Seed at the window height, as the docs suggest, then apply what the
    // dashboard reports plus the host's own headroom, repeatedly.
    await setIframeHeight(page, WINDOW_HEIGHT);

    const applied: number[] = [];
    for (let tick = 0; tick < 10; tick += 1) {
      // eslint-disable-next-line no-await-in-loop
      const height = await reportedHeight(page);
      // eslint-disable-next-line no-await-in-loop
      await setIframeHeight(page, height + HOST_HEADROOM);
      applied.push(height + HOST_HEADROOM);
    }

    const deltas = applied.slice(1).map((h, i) => h - applied[i]);
    const tail = deltas.slice(-3);

    // A loop with any residual dependence on the frame shows a constant,
    // non-zero delta that never decays. A settled one shows zeros.
    expect(tail).toEqual([0, 0, 0]);
  });

  test('measuring the content leaves no inline styles behind', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: WINDOW_HEIGHT });
    await setupEmbeddedPage(page);

    await reportedHeight(page);

    // The measurement lifts the fill-the-frame constraint for one synchronous
    // read. If it ever fails to restore, the dashboard is left collapsed.
    const leftovers = await guestFrame(page).evaluate(() => {
      const app = document.getElementById('app');
      return {
        html: document.documentElement.style.height,
        body: document.body.style.height,
        app: app ? app.style.height : '',
      };
    });

    expect(leftovers).toEqual({ html: '', body: '', app: '' });
  });

  test('a frame taller than the window keeps the content at the top', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: WINDOW_HEIGHT });
    await setupEmbeddedPage(page);

    const tallFrame = 4000;
    await setIframeHeight(page, tallFrame);

    const contentBottom = await guestFrame(page).evaluate(() => {
      const wrapper = document.querySelector(
        '[data-test="dashboard-content-wrapper"]',
      );
      if (!wrapper) return null;
      return Math.round(
        wrapper.getBoundingClientRect().bottom + window.scrollY,
      );
    });

    expect(contentBottom).not.toBeNull();
    // The dashboard must not stretch to fill a frame the host oversized, or
    // everything anchored to its end is pushed out of the viewer's reach.
    expect(contentBottom as number).toBeLessThan(tallFrame * 0.75);
  });
});
