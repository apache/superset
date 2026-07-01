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
 * Regression for #33406: in a Pivot Table (v2) with nested rows, collapsing a
 * row group with the [-] toggle should stay collapsed after the collapsed rows
 * scroll out of the viewport and back. The bug reproduces specifically when the
 * dashboard is embedded via an iframe — the collapse/expand state lives in the
 * pivot renderer's local React state (`collapsedRows` initialised to `{}`), so
 * anything that remounts the chart resets it and the rows re-expand.
 *
 * This spec runs on the embedded harness (the only place the bug is reported to
 * reproduce). It collapses a top-level row, scrolls the embedded dashboard so
 * the pivot leaves and re-enters the viewport, and asserts the row is still
 * collapsed.
 *
 * CI green => collapse state survives the scroll round-trip; merging closes
 *             #33406 and guards against regressions.
 * CI red   => the rows re-expanded; the bug is live and the fix belongs in
 *             plugin-chart-pivot-table (lift collapse state out of transient
 *             component state, e.g. persist `collapsedRows`/`collapsedCols`).
 *
 * NOTE: the embedded suite only runs when the embedded SDK bundle is built and
 * INCLUDE_EMBEDDED=true (CI sets both). It is skipped otherwise.
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
import { apiPost, apiPut } from '../../helpers/api/requests';
import {
  apiPostDashboard,
  apiDeleteDashboard,
} from '../../helpers/api/dashboard';
import { apiDeleteChart } from '../../helpers/api/chart';
import { EmbeddedPage } from '../../pages/EmbeddedPage';
import { EMBEDDED } from '../../utils/constants';

const SUPERSET_DOMAIN = (() => {
  const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8088';
  return url.replace(/\/+$/, '');
})();
const SUPERSET_BASE_URL = SUPERSET_DOMAIN.endsWith('/')
  ? SUPERSET_DOMAIN
  : `${SUPERSET_DOMAIN}/`;

const SDK_BUNDLE_PATH = join(
  __dirname,
  '../../../../superset-embedded-sdk/bundle/index.js',
);
const EMBED_APP_DIR = join(__dirname, '../../embedded-app');
const INDEX_HTML_PATH = join(EMBED_APP_DIR, 'index.html');
const DATASET_NAME = 'birth_names';

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

async function findDatasetIdByName(page: Page, name: string): Promise<number> {
  const query = `(filters:!((col:table_name,opr:eq,value:'${name}')))`;
  const resp = await page.request.get(`api/v1/dataset/?q=${query}`);
  const body = await resp.json();
  if (!body.result?.length) {
    throw new Error(`Dataset ${name} not found`);
  }
  return body.result[0].id;
}

test.describe('Embedded Pivot Table collapse state (#33406)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90000);

  let appServer: EmbedAppServer;
  let accessToken: string;
  let embedUuid: string;
  let dashboardId: number;
  let chartId: number;

  test.beforeAll(async ({ browser }) => {
    test.skip(
      !existsSync(SDK_BUNDLE_PATH),
      'Embedded SDK bundle not found. Build it with: cd superset-embedded-sdk && npm ci && npm run build',
    );

    appServer = await startEmbedAppServer();
    const context = await createAdminContext(browser);
    const setupPage = await context.newPage();
    try {
      const datasetId = await findDatasetIdByName(setupPage, DATASET_NAME);

      const params = {
        datasource: `${datasetId}__table`,
        viz_type: 'pivot_table_v2',
        groupbyRows: ['state', 'name'],
        groupbyColumns: [],
        metrics: ['count'],
        metricsLayout: 'COLUMNS',
        aggregateFunction: 'Count',
        rowSubTotals: true,
        rowTotals: true,
        valueFormat: 'SMART_NUMBER',
        row_limit: 1000,
        order_desc: true,
      };
      const chartResp = await apiPost(setupPage, 'api/v1/chart/', {
        slice_name: `pivot_collapse_repro_${Date.now()}`,
        viz_type: 'pivot_table_v2',
        datasource_id: datasetId,
        datasource_type: 'table',
        params: JSON.stringify(params),
      });
      chartId = (await chartResp.json()).id;

      const chartLayoutKey = `CHART-${chartId}`;
      const positionJson = {
        DASHBOARD_VERSION_KEY: 'v2',
        ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
        GRID_ID: {
          type: 'GRID',
          id: 'GRID_ID',
          children: ['ROW-1'],
          parents: ['ROOT_ID'],
        },
        'ROW-1': {
          type: 'ROW',
          id: 'ROW-1',
          children: [chartLayoutKey],
          parents: ['ROOT_ID', 'GRID_ID'],
          meta: { background: 'BACKGROUND_TRANSPARENT' },
        },
        [chartLayoutKey]: {
          type: 'CHART',
          id: chartLayoutKey,
          children: [],
          parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
          meta: {
            chartId,
            width: 6,
            height: 80,
            sliceName: 'pivot_collapse_repro',
          },
        },
      };
      const dashResp = await apiPostDashboard(setupPage, {
        dashboard_title: `pivot_collapse_repro_${Date.now()}`,
        published: true,
        position_json: JSON.stringify(positionJson),
      });
      const dashBody = await dashResp.json();
      dashboardId = dashBody.id;
      await apiPut(setupPage, `api/v1/chart/${chartId}`, {
        dashboards: [dashboardId],
      });

      const embedded = await apiEnableEmbedding(setupPage, dashboardId);
      embedUuid = embedded.uuid;
      accessToken = await getAccessToken(setupPage);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const context = await createAdminContext(browser);
    try {
      const cleanupPage = await context.newPage();
      if (dashboardId !== undefined) {
        await apiDeleteDashboard(cleanupPage, dashboardId, {
          failOnStatusCode: false,
        });
      }
      if (chartId !== undefined) {
        await apiDeleteChart(cleanupPage, chartId, { failOnStatusCode: false });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[pivot-collapse teardown] cleanup failed:', err);
    } finally {
      await context.close();
    }
    if (appServer) await appServer.close();
  });

  test('collapsed rows stay collapsed after a scroll round-trip', async ({
    page,
  }) => {
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
    await embeddedPage.waitForChartRendered();

    const rowLabels = embeddedPage.iframe.locator('.pvtRowLabel');
    await expect
      .poll(() => rowLabels.count(), { timeout: EMBEDDED.CHART_RENDER })
      .toBeGreaterThan(1);
    const expandedCount = await rowLabels.count();

    // Collapse the first top-level row group via its [-] toggle. Scope to
    // `.pvtTable` so we never match a stray `toggle` class elsewhere in the DOM.
    await embeddedPage.iframe.locator('.pvtTable .toggle').first().click();
    await expect
      .poll(() => embeddedPage.iframe.locator('.pvtRowLabel').count(), {
        timeout: EMBEDDED.CHART_RENDER,
      })
      .toBeLessThan(expandedCount);
    const collapsedCount = await embeddedPage.iframe
      .locator('.pvtRowLabel')
      .count();

    // Scroll the embedded dashboard so the pivot leaves the viewport, then back.
    await embeddedPage.iframe.locator('body').evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(800);
    await embeddedPage.iframe.locator('body').evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);

    // The collapsed group must remain collapsed (row-label count unchanged).
    await expect(embeddedPage.iframe.locator('.pvtRowLabel')).toHaveCount(
      collapsedCount,
    );
  });
});
