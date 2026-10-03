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
import { test, expect, Frame, Page } from '@playwright/test';
import {
  apiEnableEmbedding,
  getAccessToken,
  getGuestToken,
} from '../../helpers/api/embedded';
import {
  apiDeleteDashboard,
  apiPostDashboard,
  buildSingleRowDashboardLayout,
} from '../../helpers/api/dashboard';
import {
  apiDeleteChart,
  apiPostChart,
  apiPutChart,
} from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import {
  buildFilterJsonMetadata,
  buildSelectFilter,
} from '../dashboard/dashboard-test-helpers';
import { EmbeddedPage } from '../../pages/EmbeddedPage';
import {
  EmbedAppServer,
  SUPERSET_DOMAIN,
  createAdminContext,
  skipUnlessSdkBundleBuilt,
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

/**
 * The reports came from dashboards with a long vertical filter bar, so the
 * fixture is one chart plus enough filters that the bar overflows the window:
 * that is what makes the bar's scroll offset and its action buttons observable.
 * Built here rather than borrowed from the examples so the suite does not
 * depend on which filters an example ships with.
 */
const DATASET_NAME = 'birth_names';
const FILTER_COLUMNS = ['gender', 'state', 'name'] as const;
const FILTER_COUNT = 12;

/** Host viewport used throughout, so "taller than the window" is unambiguous. */
const WINDOW_HEIGHT = 800;

/**
 * Real hosts add headroom to the height they apply, which turns any residual
 * dependence on the frame into unbounded growth rather than a fixed offset.
 * The loop test applies the same headroom for that reason.
 */
const HOST_HEADROOM = 40;

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
 * Poll a measurement until it has not changed for `holdMs`. Unlike `settled`,
 * which accepts the first two reads that agree, this rides out size changes
 * that arrive in bursts with quiet gaps between them.
 */
async function stableFor<T>(
  read: () => Promise<T>,
  holdMs: number,
): Promise<T> {
  let last: T | undefined;
  let lastChange = Date.now();
  await expect
    .poll(
      async () => {
        const next = await read();
        if (next !== last) {
          last = next;
          lastChange = Date.now();
        }
        return Date.now() - lastChange >= holdMs;
      },
      { intervals: [250], timeout: 30000 },
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
  let chartId: number;

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
    // Every filter control renders a loading row until its values arrive,
    // then swaps in the real control at a different height, and the browser
    // re-anchors the list's scroll offset each time. Measure only once all
    // of them have loaded and the list has held its size for a while: on a
    // loaded CI runner the last few values can land seconds apart.
    await guestFrame(page).waitForFunction(
      expectedCount => {
        const controls = document.querySelectorAll(
          '[data-test="form-item-value"]',
        );
        return (
          controls.length === expectedCount &&
          ![...controls].some(control => control.querySelector('.loading'))
        );
      },
      FILTER_COUNT,
      { timeout: 60000 },
    );
    await page.waitForLoadState('networkidle');
    await stableFor(
      () =>
        guestFrame(page).evaluate(
          () => document.querySelector('.filter-bar-scroll')?.scrollHeight ?? 0,
        ),
      2000,
    );
    return embeddedPage;
  }

  test.beforeAll(async ({ browser }) => {
    skipUnlessSdkBundleBuilt();

    appServer = await startEmbedAppServer();

    const context = await createAdminContext(browser);
    const setupPage = await context.newPage();
    try {
      const dataset = await getDatasetByName(setupPage, DATASET_NAME);
      if (!dataset) {
        throw new Error(
          `Dataset "${DATASET_NAME}" not found. Ensure load_examples ran in CI setup.`,
        );
      }
      const suffix = `${Date.now()}`;
      const chartResp = await apiPostChart(setupPage, {
        slice_name: `embedded_sizing_${suffix}`,
        viz_type: 'big_number_total',
        datasource_id: dataset.id,
        datasource_type: 'table',
        params: JSON.stringify({
          datasource: `${dataset.id}__table`,
          viz_type: 'big_number_total',
          metric: 'count',
          adhoc_filters: [],
        }),
      });
      expect(chartResp.ok()).toBe(true);
      chartId = await extractIdFromResponse(chartResp);

      const nativeFilters = Array.from({ length: FILTER_COUNT }, (_, i) =>
        buildSelectFilter({
          datasetId: dataset.id,
          column: FILTER_COLUMNS[i % FILTER_COLUMNS.length],
          chartsInScope: [chartId],
          name: `Filter ${String(i + 1).padStart(2, '0')}`,
        }),
      );
      const dashResp = await apiPostDashboard(setupPage, {
        dashboard_title: `embedded_sizing_${suffix}`,
        published: true,
        position_json: JSON.stringify(
          buildSingleRowDashboardLayout([
            { id: chartId, sliceName: 'embedded_sizing', width: 6, height: 50 },
          ]),
        ),
        json_metadata: JSON.stringify(
          buildFilterJsonMetadata({ chartsInScope: [chartId], nativeFilters }),
        ),
      });
      expect(dashResp.ok()).toBe(true);
      dashboardId = await extractIdFromResponse(dashResp);
      const linkResp = await apiPutChart(setupPage, chartId, {
        dashboards: [dashboardId],
      });
      expect(linkResp.ok()).toBe(true);

      const embedded = await apiEnableEmbedding(setupPage, dashboardId);
      embedUuid = embedded.uuid;
      accessToken = await getAccessToken(setupPage);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    if (dashboardId !== undefined || chartId !== undefined) {
      const context = await createAdminContext(browser);
      try {
        const setupPage = await context.newPage();
        if (dashboardId !== undefined) {
          await apiDeleteDashboard(setupPage, dashboardId);
        }
        if (chartId !== undefined) {
          await apiDeleteChart(setupPage, chartId);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[embedded sizing teardown] cleanup failed:', err);
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
    // browser clamp the list's scroll offset. The fixture's filter list is
    // taller than the frame, so an offset of 400 is a real scroll position.
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

  test('a frame taller than the content keeps the filter bar actions with the filter list', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: WINDOW_HEIGHT });
    await setupEmbeddedPage(page);

    const applyButtonTop = () =>
      guestFrame(page).evaluate(() => {
        const apply = document.querySelector(
          '[data-test="filter-bar__apply-button"]',
        );
        if (!apply) return null;
        return Math.round(apply.getBoundingClientRect().top + window.scrollY);
      });

    // Both frames are taller than the content, so nothing in view should move
    // between them. The window-sized frame is deliberately not the baseline:
    // there the bar is capped to the frame and the buttons sit at its bottom
    // by design, with the list scrolling inside.
    await setIframeHeight(page, 2400);
    const atTallFrame = await settled(applyButtonTop);
    const contentHeight = await settled(() => reportedHeight(page));

    await setIframeHeight(page, 4000);
    const atTallerFrame = await settled(applyButtonTop);

    expect(atTallFrame).not.toBeNull();
    // The buttons must follow the filter list, not the bottom of whatever
    // frame the host set. Before the fix they sat after a viewport-sized
    // list, so they landed 3908px down in a 4000px frame.
    expect(atTallerFrame).toBe(atTallFrame);
    expect(atTallFrame).toBeLessThan(contentHeight);
  });
});
