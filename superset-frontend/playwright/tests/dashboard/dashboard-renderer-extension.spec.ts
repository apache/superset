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
import { DashboardPage } from '../../pages/DashboardPage';
import { TIMEOUT } from '../../utils/constants';

/**
 * Dashboard Renderer extension point E2E tests.
 *
 * Verifies the `dashboards` contribution point end to end: a custom
 * renderer registered through `window.superset.dashboards` replaces the
 * built-in dashboard renderer in place, receives the contract props,
 * restores the built-in renderer on disposal, and never takes over in
 * edit mode.
 *
 * Prerequisites:
 * - Superset running with example dashboards loaded
 * - Admin user authenticated (via global-setup)
 * - ENABLE_EXTENSIONS feature flag on (tests skip themselves otherwise)
 */

const CUSTOM_MARKER = 'CUSTOM DASHBOARD RENDERER ACTIVE';
const CHART_CONTAINER = '[data-test="chart-container"]';

declare global {
  interface Window {
    __rendererDisposable?: { dispose: () => void };
    __rendererProps?: {
      dashboardId?: number;
      title?: string;
      charts: number;
      layoutKeys: number;
      hasInitialDataMask: boolean;
    };
  }
}

async function extensionsEnabled(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Boolean((window as any).featureFlags?.ENABLE_EXTENSIONS),
  );
}

/**
 * Registers a minimal custom renderer from the page context and records
 * the contract props it receives on window.__rendererProps.
 */
async function registerProbeRenderer(page: Page): Promise<void> {
  await page.evaluate(marker => {
    window.__rendererProps = undefined;
    window.__rendererDisposable = (
      window as any
    ).superset.dashboards.registerDashboardRenderer(
      { id: 'e2e.probe-renderer', name: 'E2E Probe Renderer' },
      (props: any) => {
        window.__rendererProps = {
          dashboardId: props.dashboard?.id,
          title: props.dashboard?.title,
          charts: (props.charts || []).length,
          layoutKeys: Object.keys(props.dashboard?.layout || {}).length,
          hasInitialDataMask: Boolean(props.initialDataMask),
        };
        return `${marker} :: ${props.dashboard?.title}`;
      },
    );
  }, CUSTOM_MARKER);
}

test.describe('Dashboard renderer extension point', () => {
  test.setTimeout(90_000);

  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoBySlug('world_health');
    await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });
    test.skip(
      !(await extensionsEnabled(page)),
      'ENABLE_EXTENSIONS feature flag is off',
    );
  });

  test('custom renderer swaps in live, receives contract props, and restores on dispose', async ({
    page,
  }) => {
    // Built-in renderer showing charts before any registration
    await expect(page.locator(CHART_CONTAINER).first()).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });

    // The public namespace is exposed
    expect(
      await page.evaluate(
        () =>
          typeof (window as any).superset?.dashboards
            ?.registerDashboardRenderer,
      ),
    ).toBe('function');

    // The built-in renderer is itself the registered default provider
    expect(
      await page.evaluate(() => ({
        active: (window as any).superset.dashboards.getDashboardRenderer()
          ?.renderer.id,
        default: (
          window as any
        ).superset.dashboards.getDefaultDashboardRenderer()?.renderer.id,
      })),
    ).toEqual({
      active: 'superset.dashboard-renderer',
      default: 'superset.dashboard-renderer',
    });

    // Registering swaps the view in place, no navigation
    await registerProbeRenderer(page);
    await expect(page.getByText(CUSTOM_MARKER)).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });
    await expect(page.locator(CHART_CONTAINER)).toHaveCount(0);

    // The renderer received the contract props for this dashboard
    const props = await page.evaluate(() => window.__rendererProps);
    expect(props?.title).toBeTruthy();
    expect(props?.charts).toBeGreaterThan(0);
    expect(props?.layoutKeys).toBeGreaterThan(0);
    expect(props?.hasInitialDataMask).toBe(true);

    // Disposing restores the built-in renderer
    await page.evaluate(() => window.__rendererDisposable?.dispose());
    await expect(page.getByText(CUSTOM_MARKER)).toHaveCount(0);
    await expect(page.locator(CHART_CONTAINER).first()).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });
  });

  test('edit mode keeps the built-in renderer despite a registered custom renderer', async ({
    page,
  }) => {
    // Enter edit mode first: a full navigation would wipe an in-page
    // registration, so the registration must happen while in edit mode.
    await page.goto(`${page.url().split('?')[0]}?edit=true`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('button', { name: /discard/i })).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await expect(page.locator(CHART_CONTAINER).first()).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });

    // Registering while in edit mode must NOT swap the renderer.
    // (Discard performs a full navigation that would wipe the in-page
    // registration, so the edit→view transition is covered by unit tests.)
    await registerProbeRenderer(page);
    await expect(page.getByText(CUSTOM_MARKER)).toHaveCount(0);
    await expect(page.locator(CHART_CONTAINER).first()).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });
  });
});
