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
import { existsSync } from 'fs';
import {
  apiEnableEmbedding,
  getAccessToken,
  getGuestToken,
} from '../../helpers/api/embedded';
import { getDashboardBySlug } from '../../helpers/api/dashboard';
import { EmbeddedPage } from '../../pages/EmbeddedPage';
import {
  EmbedAppServer,
  SDK_BUNDLE_PATH,
  startEmbedAppServer,
} from '../../helpers/embeddedAppServer';

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

/** Host viewport used throughout, so "taller than the window" is unambiguous. */
const WINDOW_HEIGHT = 800;

/**
 * Real hosts add headroom to the height they apply, which turns any residual
 * dependence on the frame into unbounded growth rather than a fixed offset.
 * The loop test applies the same headroom for that reason.
 */
const HOST_HEADROOM = 40;

function createAdminContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    storageState: 'playwright/.auth/user.json',
    baseURL: SUPERSET_BASE_URL,
  });
}

/** Set the iframe to an exact pixel height. */
function setIframeHeight(page: Page, height: number): Promise<void> {
  return page.evaluate(px => {
    const iframe = document.querySelector(
      '#superset-container iframe',
    ) as HTMLIFrameElement | null;
    if (!iframe) throw new Error('embedded iframe not found');
    iframe.style.height = `${px}px`;
  }, height);
}

/**
 * Poll a measurement until two consecutive reads agree, then return it. The
 * dashboard relays out asynchronously after a resize, so a fixed sleep is
 * either too slow or flaky under CI load.
 */
async function settled<T>(read: () => Promise<T>): Promise<T> {
  let last: T | undefined;
  await expect
    .poll(
      async () => {
        const next = await read();
        const stable = last !== undefined && next === last;
        last = next;
        return stable;
      },
      { intervals: [250], timeout: 15000 },
    )
    .toBe(true);
  return last as T;
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

declare global {
  interface Window {
    __embeddedDashboard: {
      getScrollSize: () => Promise<{ width: number; height: number }>;
    };
  }
}

/** What the SDK reports to the host as the content height. */
function reportedHeight(page: Page): Promise<number> {
  return page
    .evaluate(() => window.__embeddedDashboard.getScrollSize())
    .then(size => size.height);
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
    // A vertical filter bar renders a viewport-sized placeholder until its
    // filters initialise, which is not the content the tests measure.
    await guestFrame(page).waitForFunction(() => {
      const bar = document.querySelector('.filter-bar-bounded');
      return !bar || bar.querySelector('.filter-bar-scroll') !== null;
    });
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
    const atShortFrame = await settled(() => reportedHeight(page));

    await setIframeHeight(page, 2400);
    const atTallFrame = await settled(() => reportedHeight(page));

    // Back to the first height: the answer must be reproducible, not a
    // function of the sequence of heights it has been given.
    await setIframeHeight(page, 800);
    const backAtShortFrame = await settled(() => reportedHeight(page));

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
      const height = await settled(() => reportedHeight(page));
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

  test('measuring the content restores everything it touched', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: WINDOW_HEIGHT });
    await setupEmbeddedPage(page);

    // Lifting the filter bar's cap removes the overflow, which makes the
    // browser clamp the list's scroll offset. Vacuous on a dashboard with no
    // vertical filter bar, meaningful on the ones the reports came from.
    const scrolled = await guestFrame(page).evaluate(() => {
      const scroller =
        document.querySelector<HTMLElement>('.filter-bar-scroll');
      if (!scroller) return null;
      scroller.scrollTop = 400;
      return scroller.scrollTop;
    });

    await reportedHeight(page);

    // The measurement lifts the fill-the-frame constraints for one synchronous
    // read. If it ever fails to restore, the dashboard is left collapsed.
    const leftovers = await guestFrame(page).evaluate(() => {
      const app = document.getElementById('app');
      const bar = document.querySelector<HTMLElement>('.filter-bar-bounded');
      const scroller =
        document.querySelector<HTMLElement>('.filter-bar-scroll');
      return {
        html: document.documentElement.style.height,
        body: document.body.style.height,
        app: app ? app.style.height : '',
        bar: bar ? bar.style.maxHeight : '',
        scrollTop: scroller ? scroller.scrollTop : null,
      };
    });

    expect(leftovers).toEqual({
      html: '',
      body: '',
      app: '',
      bar: '',
      scrollTop: scrolled,
    });
  });

  test('a frame taller than the window keeps the content at the top', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: WINDOW_HEIGHT });
    await setupEmbeddedPage(page);

    const contentBottom = () =>
      guestFrame(page).evaluate(() => {
        const content = document.querySelector('#app .dashboard');
        if (!content) return null;
        return Math.round(
          content.getBoundingClientRect().bottom + window.scrollY,
        );
      });

    await setIframeHeight(page, 800);
    const atShortFrame = await settled(contentBottom);

    await setIframeHeight(page, 4000);
    const atTallFrame = await settled(contentBottom);

    expect(atShortFrame).not.toBeNull();
    // The dashboard must not stretch to fill a frame the host oversized, or
    // everything anchored to its end is pushed out of the viewer's reach.
    expect(atTallFrame).toBe(atShortFrame);
  });
});
