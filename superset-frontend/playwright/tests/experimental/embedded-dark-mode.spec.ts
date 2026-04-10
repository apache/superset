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
 * Experimental E2E tests for sc-100647:
 * "Dark border in embedded dashboards when OS is in Dark Mode"
 *
 * Bug: When a user's OS is set to dark mode (e.g. macOS), embedded Superset
 * dashboards show unexpected dark borders/lines because the browser's UA
 * stylesheet applies dark native styling (scrollbars, form controls, etc.)
 * to the iframe. The fix sets `color-scheme: light` on the `html` element
 * via GlobalStyles so native browser chrome matches the app's light theme.
 *
 * These tests emulate OS dark mode via Playwright's `colorScheme: 'dark'`
 * option, then verify the `html` element's `color-scheme` CSS property is
 * explicitly declared so native styling does not leak in.
 */

import { test, expect, Browser } from '@playwright/test';
import { TIMEOUT } from '../../utils/constants';

const ADMIN_USERNAME = process.env.PLAYWRIGHT_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'general';

/**
 * Evaluate the resolved color-scheme on the html element.
 * Uses getComputedStyle so both inline and stylesheet declarations are captured.
 */
async function getHtmlColorScheme(
  page: import('@playwright/test').Page,
): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).colorScheme.trim(),
  );
}

/**
 * Helper: create a new browser context emulating OS dark mode with saved admin auth.
 */
async function darkModeAdminContext(browser: Browser) {
  return browser.newContext({
    colorScheme: 'dark',
    storageState: 'playwright/.auth/user.json',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('html element has color-scheme: light on the welcome page when OS is in dark mode', async ({
  browser,
}) => {
  const context = await darkModeAdminContext(browser);
  const page = await context.newPage();

  try {
    await page.goto('superset/welcome/', { waitUntil: 'networkidle' });

    const colorScheme = await getHtmlColorScheme(page);

    // Superset's default theme is light. Even with OS dark mode emulated,
    // GlobalStyles must declare color-scheme: light so native browser elements
    // (scrollbars, form controls, etc.) render in light mode inside the iframe.
    expect(colorScheme).toBe('light');
  } finally {
    await context.close();
  }
});

test('html element has color-scheme: light on a dashboard page when OS is in dark mode', async ({
  browser,
}) => {
  test.setTimeout(60_000);

  // Create an admin context emulating OS dark mode
  const context = await darkModeAdminContext(browser);
  const page = await context.newPage();

  // Admin context for API calls (uses saved auth, not dark-mode context)
  const adminContext = await browser.newContext({
    storageState: 'playwright/.auth/user.json',
  });
  const adminPage = await adminContext.newPage();

  let dashboardId: number | undefined;

  try {
    // Create a minimal published dashboard via API
    const createRes = await adminPage.request.post('api/v1/dashboard/', {
      data: {
        dashboard_title: `e2e_dark_mode_test_${Date.now()}`,
        published: true,
      },
    });
    expect(createRes.ok()).toBe(true);
    const body = await createRes.json();
    dashboardId = body.id;
    expect(dashboardId).toBeTruthy();

    // Navigate to the dashboard with OS dark mode emulated
    await page.goto(`superset/dashboard/${dashboardId}/`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT.PAGE_LOAD,
    });

    const colorScheme = await getHtmlColorScheme(page);

    // color-scheme: light must be present so the embedded iframe's native
    // browser UI (borders, scrollbars, inputs) stays in light mode.
    expect(colorScheme).toBe('light');
  } finally {
    // Cleanup
    if (dashboardId) {
      await adminPage.request
        .delete(`api/v1/dashboard/${dashboardId}`)
        .catch(() => {});
    }
    await adminContext.close();
    await context.close();
  }
});

test('html element has color-scheme: light on the embedded dashboard route when OS is in dark mode', async ({
  browser,
}) => {
  test.setTimeout(60_000);

  // This test exercises the actual embedded route (/embedded/<uuid>/ or
  // /dashboard/<id>/embedded/) which is the code path affected by sc-100647.
  // Because the embedded route requires a guest token (set up via Switchboard),
  // we test the next best thing: the /dashboard/<id>/embedded/ URL which loads
  // the same EmbeddedContextProviders → GlobalStyles stack without a guest token
  // check, allowing us to verify the color-scheme declaration is present.

  const adminContext = await browser.newContext({
    storageState: 'playwright/.auth/user.json',
  });
  const adminPage = await adminContext.newPage();

  const darkContext = await browser.newContext({
    colorScheme: 'dark',
    storageState: 'playwright/.auth/user.json',
  });
  const page = await darkContext.newPage();

  let dashboardId: number | undefined;

  try {
    const createRes = await adminPage.request.post('api/v1/dashboard/', {
      data: {
        dashboard_title: `e2e_embedded_dark_mode_${Date.now()}`,
        published: true,
      },
    });
    expect(createRes.ok()).toBe(true);
    const body = await createRes.json();
    dashboardId = body.id;

    // The /embedded/ sub-route renders EmbeddedContextProviders which initializes
    // ThemeMode.DEFAULT (light). GlobalStyles must inject color-scheme: light.
    await page.goto(`dashboard/${dashboardId}/embedded/`, {
      waitUntil: 'load',
      timeout: TIMEOUT.PAGE_LOAD,
    });

    // Wait for React to hydrate and Emotion to inject global styles
    await page.waitForFunction(
      () => {
        const sheets = Array.from(document.styleSheets);
        return sheets.some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule =>
              rule.cssText.includes('color-scheme'),
            );
          } catch {
            return false;
          }
        });
      },
      { timeout: TIMEOUT.PAGE_LOAD },
    );

    const colorScheme = await getHtmlColorScheme(page);
    expect(colorScheme).toBe('light');
  } finally {
    if (dashboardId) {
      await adminPage.request
        .delete(`api/v1/dashboard/${dashboardId}`)
        .catch(() => {});
    }
    await adminContext.close();
    await darkContext.close();
  }
});

test('html element has color-scheme: dark when Superset dark theme is active with OS dark mode', async ({
  browser,
}) => {
  // Sanity-check the inverse: when the user explicitly switches to dark theme,
  // color-scheme should be dark (not stuck on light).
  // This confirms dynamic switching works end-to-end.
  //
  // Note: This test navigates to the welcome page and toggles dark mode via
  // localStorage (the ThemeController persists mode there for non-embedded pages).

  const context = await browser.newContext({
    colorScheme: 'dark',
    storageState: 'playwright/.auth/user.json',
  });
  const page = await context.newPage();

  try {
    // Pre-set dark mode in localStorage before loading the page
    await context.addInitScript(() => {
      try {
        localStorage.setItem('superset_theme_mode', 'dark');
      } catch {
        // localStorage may not be available in all contexts
      }
    });

    await page.goto('superset/welcome/', { waitUntil: 'networkidle' });

    const colorScheme = await getHtmlColorScheme(page);

    // With dark theme active, color-scheme should be dark so native browser
    // UI (scrollbars, inputs) renders dark to match the app theme.
    expect(colorScheme).toBe('dark');
  } finally {
    await context.close();
  }
});

/**
 * Login helper for tests that need a fresh session (not using saved auth).
 */
async function loginAs(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
) {
  await page.goto('login/');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('[type="submit"]');
  await page.waitForURL('**/superset/welcome/**', {
    timeout: TIMEOUT.PAGE_LOAD,
  });
}

test('color-scheme: light is present after fresh login with OS dark mode emulated', async ({
  browser,
}) => {
  // Test the full login → welcome flow without pre-saved auth state
  // to ensure GlobalStyles applies color-scheme from the very first paint.
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();

  try {
    await loginAs(page, ADMIN_USERNAME, ADMIN_PASSWORD);

    const colorScheme = await getHtmlColorScheme(page);
    expect(colorScheme).toBe('light');
  } finally {
    await context.close();
  }
});
